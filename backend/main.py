
import hashlib
import hmac
import ipaddress
import os
import re
import secrets
import string
import threading
import time
import uuid
from contextlib import asynccontextmanager, contextmanager
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Annotated, Literal

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Query, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, StringConstraints

load_dotenv()

import logging
import db_setup

FRONTEND_ORIGINS = [
    o.strip()
    for o in os.getenv("FRONTEND_ORIGINS", "http://localhost:3000").split(",")
    if o.strip()
]
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").strip().lower() == "true"


@asynccontextmanager
async def lifespan(app):
    if os.getenv("AUTO_DB_SETUP", "true").lower() == "true":
        try:
            db_setup.run()
        except Exception:
            logging.getLogger("uvicorn.error").exception("Database setup failed")
            raise
    yield


app = FastAPI(title="TrendsTees API", lifespan=lifespan)

# Allow the configured frontend origins to call this API from the browser
app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,  # needed so the browser sends the login cookie
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["*"],
)

# Serve design images from the media folder next to main.py (works from any start directory)
MEDIA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "media")
os.makedirs(MEDIA_DIR, exist_ok=True)
app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")


@contextmanager
def get_connection():
    with psycopg.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT", "5432"),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        row_factory=dict_row,
        connect_timeout=5,
    ) as conn:
        yield conn


@app.get("/")
def home():
    return {"message": "TrendsTees Backend is running!"}


@app.get("/products")
def get_products():
    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT
                        product_id,
                        product_code,
                        product_name,
                        product_type,
                        product_status
                    FROM products
                    WHERE product_status = 'active'
                    ORDER BY product_id
                """)
                return cursor.fetchall()

    except psycopg.Error as e:
        print("DATABASE ERROR:", repr(e))
        raise HTTPException(
            status_code=503,
            detail="Database connection or query failed"
        )


@app.get("/products/{product_id}/variants")
def get_product_variants(product_id: int):
    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:
                # Step 1: make sure the product exists and is active
                cursor.execute(
                    """
                    SELECT product_id, product_name
                    FROM products
                    WHERE product_id = %s AND product_status = 'active'
                    """,
                    (product_id,),
                )
                product = cursor.fetchone()

                if product is None:
                    raise HTTPException(status_code=404, detail="Product not found")

                # Step 2: get the active variants for this product
                cursor.execute(
                    """
                    SELECT
                        product_variant_id,
                        sku,
                        color_name,
                        color_hex,
                        size_code,
                        size_name,
                        customer_price
                    FROM product_variants
                    WHERE product_id = %s AND variant_status = 'active'
                    ORDER BY
                        color_name,
                        array_position(ARRAY['XS','S','M','L','XL','2XL','3XL']::text[], size_code::text),
                        size_code
                    """,
                    (product_id,),
                )
                variants = cursor.fetchall()

                # Step 3: return product info plus its variants
                return {"product": product, "variants": variants}

    except psycopg.Error as e:
        print("DATABASE ERROR:", repr(e))
        raise HTTPException(
            status_code=503,
            detail="Database connection or query failed"
        )


@app.get("/interests")
def get_interests(trending: bool = False):
    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:
                # Top-level active categories; when trending=true, keep only trending ones
                cursor.execute(
                    """
                    SELECT
                        c.category_id,
                        c.category_name,
                        c.category_slug,
                        c.description,
                        cover.cover_url,
                        (
                            -- published designs in this interest or any of its niches
                            SELECT COUNT(*)
                            FROM designs d
                            JOIN categories dc ON dc.category_id = d.category_id
                            WHERE d.design_status = 'published'
                              AND (dc.category_id = c.category_id
                                   OR dc.parent_category_id = c.category_id)
                        ) AS design_count
                    FROM categories c
                    LEFT JOIN LATERAL (
                        -- preview image of the most recently published design
                        SELECT '/media/' || f.storage_key AS cover_url
                        FROM designs d
                        JOIN categories dc ON dc.category_id = d.category_id
                        JOIN files f ON f.file_id = d.preview_file_id
                        WHERE d.design_status = 'published'
                          AND (dc.category_id = c.category_id
                               OR dc.parent_category_id = c.category_id)
                        ORDER BY d.first_published_at DESC NULLS LAST, d.design_id DESC
                        LIMIT 1
                    ) cover ON true
                    WHERE c.parent_category_id IS NULL
                      AND c.category_status = 'active'
                      AND (%s = false OR c.is_trending = true)
                    ORDER BY c.display_order, c.category_name
                    """,
                    (trending,),
                )
                return cursor.fetchall()

    except psycopg.Error as e:
        print("DATABASE ERROR:", repr(e))
        raise HTTPException(
            status_code=503,
            detail="Database connection or query failed"
        )


@app.get("/interests/{category_slug}/niches")
def get_interest_niches(category_slug: str):
    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:
                # Step 1: find the active top-level interest by slug (case-insensitive)
                cursor.execute(
                    """
                    SELECT
                        category_id,
                        category_name,
                        category_slug,
                        description
                    FROM categories
                    WHERE lower(category_slug) = lower(%s)
                      AND parent_category_id IS NULL
                      AND category_status = 'active'
                    """,
                    (category_slug,),
                )
                interest = cursor.fetchone()

                if interest is None:
                    raise HTTPException(status_code=404, detail="Interest not found")

                # Step 2: get the active niches under this interest
                cursor.execute(
                    """
                    SELECT
                        category_id,
                        category_name,
                        category_slug,
                        description
                    FROM categories
                    WHERE parent_category_id = %s
                      AND category_status = 'active'
                    ORDER BY display_order, category_name
                    """,
                    (interest["category_id"],),
                )
                niches = cursor.fetchall()

                # Step 3: return the interest plus its niches
                return {"interest": interest, "niches": niches}

    except psycopg.Error as e:
        print("DATABASE ERROR:", repr(e))
        raise HTTPException(
            status_code=503,
            detail="Database connection or query failed"
        )


# Shared SQL for GET /designs (fixed text, no user input is ever added to it).
# base = published designs matching category, search and product type, with
# starting_price and popularity calculated once per design.
DESIGNS_BASE_SQL = """
WITH base AS (
    SELECT
        d.design_id,
        d.public_design_code,
        d.title,
        d.preview_file_id,
        CASE WHEN f.storage_key IS NULL THEN NULL
             ELSE '/media/' || f.storage_key END AS preview_url,
        c.category_name,
        d.first_published_at,
        (
            -- cheapest active variant of an active, enabled product
            SELECT MIN(pv.customer_price)
            FROM design_product_settings dps
            JOIN products p ON p.product_id = dps.product_id
            JOIN product_variants pv ON pv.product_id = p.product_id
            WHERE dps.design_id = d.design_id
              AND dps.is_enabled = true
              AND p.product_status = 'active'
              AND pv.variant_status = 'active'
        ) AS starting_price,
        (
            -- number of order items for this design
            SELECT COUNT(*) FROM order_items oi WHERE oi.design_id = d.design_id
        ) AS popularity
    FROM designs d
    LEFT JOIN files f ON f.file_id = d.preview_file_id
    LEFT JOIN categories c ON c.category_id = d.category_id
    LEFT JOIN categories pc ON pc.category_id = c.parent_category_id
    WHERE d.design_status = 'published'
      AND (%s::text IS NULL
           OR lower(c.category_slug) = lower(%s)
           OR lower(pc.category_slug) = lower(%s))
      AND (%s::text IS NULL OR d.title ILIKE %s)
      AND (%s::text IS NULL OR EXISTS (
            -- enabled for an active product of this type
            SELECT 1
            FROM design_product_settings dps2
            JOIN products p2 ON p2.product_id = dps2.product_id
            WHERE dps2.design_id = d.design_id
              AND dps2.is_enabled = true
              AND p2.product_status = 'active'
              AND lower(p2.product_type::text) = lower(%s)
          ))
)
"""

# Price filter on the calculated starting_price (applied to the base CTE)
DESIGNS_FILTER_SQL = """
FROM base
WHERE (%s::numeric IS NULL OR starting_price >= %s::numeric)
  AND (%s::numeric IS NULL OR starting_price <= %s::numeric)
"""


@app.get("/designs")
def get_designs(
    category_slug: str | None = None,
    search: str | None = Query(default=None, max_length=100),
    price_min: float | None = Query(default=None, ge=0),
    price_max: float | None = Query(default=None, ge=0),
    product_type: str | None = Query(default=None, max_length=50),
    sort: Literal["newest", "price_asc", "price_desc", "popular"] = "newest",
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    # Build the ILIKE pattern in Python and pass it as a parameter (None = no search)
    search_pattern = f"%{search}%" if search else None
    # Treat empty strings as "no filter"
    slug = category_slug if category_slug else None
    ptype = product_type if product_type else None

    # Same filter values are used by the list query and the total query
    filter_params = (
        slug, slug, slug,
        search_pattern, search_pattern,
        ptype, ptype,
        price_min, price_min,
        price_max, price_max,
    )

    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:
                # Step 1: the page of designs, filtered and sorted
                cursor.execute(
                    DESIGNS_BASE_SQL
                    + "SELECT * "
                    + DESIGNS_FILTER_SQL
                    + """
                    ORDER BY
                        CASE WHEN %s = 'price_asc' THEN starting_price END ASC NULLS LAST,
                        CASE WHEN %s = 'price_desc' THEN starting_price END DESC NULLS LAST,
                        CASE WHEN %s = 'popular' THEN popularity END DESC,
                        CASE WHEN %s IN ('newest', 'popular') THEN first_published_at END DESC NULLS LAST,
                        design_id DESC
                    LIMIT %s OFFSET %s
                    """,
                    filter_params + (sort, sort, sort, sort, limit, offset),
                )
                rows = cursor.fetchall()

                # Step 2: total matching designs, ignoring limit/offset
                cursor.execute(
                    DESIGNS_BASE_SQL + "SELECT COUNT(*) AS total " + DESIGNS_FILTER_SQL,
                    filter_params,
                )
                total = cursor.fetchone()["total"]

                # Remove internal fields from the response (only used for ordering)
                for row in rows:
                    row.pop("design_id")
                    row.pop("popularity")

                return {"items": rows, "total": total, "limit": limit, "offset": offset}

    except psycopg.Error as e:
        print("DATABASE ERROR:", repr(e))
        raise HTTPException(
            status_code=503,
            detail="Database connection or query failed"
        )


@app.get("/designs/{public_design_code}")
def get_design(public_design_code: uuid.UUID):
    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:
                # Step 1: find the published design by its public code
                cursor.execute(
                    """
                    SELECT
                        d.design_id,
                        d.public_design_code,
                        d.title,
                        d.description,
                        d.preview_file_id,
                        CASE WHEN f.storage_key IS NULL THEN NULL
                             ELSE '/media/' || f.storage_key END AS preview_url,
                        d.content_rating,
                        c.category_name,
                        c.category_slug
                    FROM designs d
                    LEFT JOIN files f ON f.file_id = d.preview_file_id
                    LEFT JOIN categories c ON c.category_id = d.category_id
                    WHERE d.public_design_code = %s
                      AND d.design_status = 'published'
                    """,
                    (public_design_code,),
                )
                design = cursor.fetchone()

                if design is None:
                    raise HTTPException(status_code=404, detail="Design not found")

                # Step 2: products enabled for this design, with the cheapest active variant price
                cursor.execute(
                    """
                    SELECT
                        p.product_id,
                        p.product_name,
                        p.product_type,
                        dps.mockup_file_id,
                        MIN(pv.customer_price) AS starting_price
                    FROM design_product_settings dps
                    JOIN products p ON p.product_id = dps.product_id
                    LEFT JOIN product_variants pv
                           ON pv.product_id = p.product_id
                          AND pv.variant_status = 'active'
                    WHERE dps.design_id = %s
                      AND dps.is_enabled = true
                      AND p.product_status = 'active'
                    GROUP BY p.product_id, p.product_name, p.product_type, dps.mockup_file_id
                    ORDER BY p.product_id
                    """,
                    (design["design_id"],),
                )
                products = cursor.fetchall()

                # Step 3: hide the internal id and return design plus products
                design.pop("design_id")
                design["products"] = products
                return design

    except psycopg.Error as e:
        print("DATABASE ERROR:", repr(e))
        raise HTTPException(
            status_code=503,
            detail="Database connection or query failed"
        )


# ---------- Cart ----------

class AddCartItem(BaseModel):
    public_design_code: uuid.UUID
    product_variant_id: int
    quantity: int = Field(ge=1, le=100)


class UpdateCartItem(BaseModel):
    quantity: int = Field(ge=1, le=100)


def build_cart_response(cursor, cart_id, cart_token):
    # Items with CURRENT variant prices (not the stored snapshot)
    cursor.execute(
        """
        SELECT
            ci.cart_item_id,
            d.public_design_code,
            d.title,
            p.product_name,
            pv.sku,
            pv.color_name,
            pv.size_code,
            pv.product_variant_id,
            p.product_id,
            p.product_type,
            pv.color_hex,
            CASE WHEN f.storage_key IS NULL THEN NULL
                 ELSE '/media/' || f.storage_key END AS preview_url,
            ci.quantity,
            pv.customer_price AS unit_price,
            ci.quantity * pv.customer_price AS line_total
        FROM cart_items ci
        JOIN designs d ON d.design_id = ci.design_id
        LEFT JOIN files f ON f.file_id = d.preview_file_id
        JOIN product_variants pv ON pv.product_variant_id = ci.product_variant_id
        JOIN products p ON p.product_id = pv.product_id
        WHERE ci.cart_id = %s
        ORDER BY ci.created_at, ci.cart_item_id
        """,
        (cart_id,),
    )
    items = cursor.fetchall()

    # Totals are calculated from the rows above
    item_count = sum(item["quantity"] for item in items)
    subtotal = sum(item["line_total"] for item in items)

    return {
        "cart_token": cart_token,
        "items": items,
        "item_count": item_count,
        "subtotal": subtotal,
    }


@app.post("/cart")
def create_cart():
    # The token is generated by the server, never by the client
    cart_token = uuid.uuid4()

    try:
        with get_connection() as conn:
            with conn.transaction():
                with conn.cursor() as cursor:
                    # New active guest cart that expires in 30 days
                    cursor.execute(
                        """
                        INSERT INTO carts (guest_cart_token, cart_status, expires_at)
                        VALUES (%s, 'active', now() + interval '30 days')
                        """,
                        (cart_token,),
                    )
                    return {"cart_token": cart_token}

    except psycopg.Error as e:
        print("DATABASE ERROR:", repr(e))
        raise HTTPException(
            status_code=503,
            detail="Database connection or query failed"
        )


@app.get("/cart/{cart_token}")
def get_cart(cart_token: uuid.UUID):
    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:
                # Step 1: find the active cart
                cursor.execute(
                    """
                    SELECT cart_id
                    FROM carts
                    WHERE guest_cart_token = %s AND cart_status = 'active'
                    """,
                    (cart_token,),
                )
                cart = cursor.fetchone()

                if cart is None:
                    raise HTTPException(status_code=404, detail="Cart not found")

                # Step 2: build the cart response
                return build_cart_response(cursor, cart["cart_id"], cart_token)

    except psycopg.Error as e:
        print("DATABASE ERROR:", repr(e))
        raise HTTPException(
            status_code=503,
            detail="Database connection or query failed"
        )


@app.post("/cart/{cart_token}/items")
def add_cart_item(cart_token: uuid.UUID, body: AddCartItem):
    try:
        with get_connection() as conn:
            # One transaction: any error or HTTPException rolls everything back
            with conn.transaction():
                with conn.cursor() as cursor:
                    # a. cart exists and is active (row is locked until the transaction ends)
                    cursor.execute(
                        """
                        SELECT cart_id
                        FROM carts
                        WHERE guest_cart_token = %s AND cart_status = 'active'
                        FOR UPDATE
                        """,
                        (cart_token,),
                    )
                    cart = cursor.fetchone()
                    if cart is None:
                        raise HTTPException(status_code=404, detail="Cart not found")

                    # b. design exists and is published
                    cursor.execute(
                        """
                        SELECT design_id
                        FROM designs
                        WHERE public_design_code = %s AND design_status = 'published'
                        """,
                        (body.public_design_code,),
                    )
                    design = cursor.fetchone()
                    if design is None:
                        raise HTTPException(status_code=404, detail="Design not found")

                    # c. variant exists, is active, and its product is active
                    cursor.execute(
                        """
                        SELECT
                            pv.product_variant_id,
                            pv.product_id,
                            pv.customer_price,
                            pv.minimum_quantity,
                            pv.variant_status,
                            p.product_status
                        FROM product_variants pv
                        JOIN products p ON p.product_id = pv.product_id
                        WHERE pv.product_variant_id = %s
                        """,
                        (body.product_variant_id,),
                    )
                    variant = cursor.fetchone()
                    if variant is None:
                        raise HTTPException(status_code=404, detail="Variant not found")
                    if variant["variant_status"] != "active" or variant["product_status"] != "active":
                        raise HTTPException(status_code=400, detail="Variant is not available")

                    # d. the product must be enabled for this design
                    cursor.execute(
                        """
                        SELECT 1
                        FROM design_product_settings
                        WHERE design_id = %s AND product_id = %s AND is_enabled = true
                        """,
                        (design["design_id"], variant["product_id"]),
                    )
                    if cursor.fetchone() is None:
                        raise HTTPException(
                            status_code=400,
                            detail="This product is not available for this design"
                        )

                    # e. quantity must reach the variant minimum
                    if body.quantity < variant["minimum_quantity"]:
                        raise HTTPException(
                            status_code=400,
                            detail="Minimum quantity for this variant is "
                                   + str(variant["minimum_quantity"])
                        )

                    # Is this design + variant already in the cart?
                    cursor.execute(
                        """
                        SELECT cart_item_id, quantity
                        FROM cart_items
                        WHERE cart_id = %s AND design_id = %s AND product_variant_id = %s
                        FOR UPDATE
                        """,
                        (cart["cart_id"], design["design_id"], body.product_variant_id),
                    )
                    existing = cursor.fetchone()

                    if existing is not None:
                        # Same item: increase quantity (max 100) and refresh the price snapshot
                        new_quantity = existing["quantity"] + body.quantity
                        if new_quantity > 100:
                            raise HTTPException(
                                status_code=400,
                                detail="Maximum quantity per item is 100"
                            )
                        cursor.execute(
                            """
                            UPDATE cart_items
                            SET quantity = %s,
                                unit_price_snapshot = %s,
                                updated_at = now()
                            WHERE cart_item_id = %s
                            """,
                            (new_quantity, variant["customer_price"], existing["cart_item_id"]),
                        )
                    else:
                        # New item: price comes from the database, never from the client
                        cursor.execute(
                            """
                            INSERT INTO cart_items
                                (cart_id, design_id, product_variant_id, quantity,
                                 unit_price_snapshot, saved_for_later)
                            VALUES (%s, %s, %s, %s, %s, false)
                            """,
                            (
                                cart["cart_id"],
                                design["design_id"],
                                body.product_variant_id,
                                body.quantity,
                                variant["customer_price"],
                            ),
                        )

                    # Touch the cart
                    cursor.execute(
                        "UPDATE carts SET updated_at = now() WHERE cart_id = %s",
                        (cart["cart_id"],),
                    )

                    # Return the updated cart
                    return build_cart_response(cursor, cart["cart_id"], cart_token)

    except psycopg.Error as e:
        print("DATABASE ERROR:", repr(e))
        raise HTTPException(
            status_code=503,
            detail="Database connection or query failed"
        )


@app.patch("/cart/{cart_token}/items/{cart_item_id}")
def update_cart_item(cart_token: uuid.UUID, cart_item_id: int, body: UpdateCartItem):
    try:
        with get_connection() as conn:
            # One transaction: any error or HTTPException rolls everything back
            with conn.transaction():
                with conn.cursor() as cursor:
                    # Step 1: find the active cart (locked until the transaction ends)
                    cursor.execute(
                        """
                        SELECT cart_id
                        FROM carts
                        WHERE guest_cart_token = %s AND cart_status = 'active'
                        FOR UPDATE
                        """,
                        (cart_token,),
                    )
                    cart = cursor.fetchone()
                    if cart is None:
                        raise HTTPException(status_code=404, detail="Cart not found")

                    # Step 2: the item must belong to this cart
                    cursor.execute(
                        """
                        SELECT pv.minimum_quantity
                        FROM cart_items ci
                        JOIN product_variants pv ON pv.product_variant_id = ci.product_variant_id
                        WHERE ci.cart_item_id = %s AND ci.cart_id = %s
                        """,
                        (cart_item_id, cart["cart_id"]),
                    )
                    item = cursor.fetchone()
                    if item is None:
                        raise HTTPException(status_code=404, detail="Cart item not found")

                    # Step 3: quantity must reach the variant minimum
                    if body.quantity < item["minimum_quantity"]:
                        raise HTTPException(
                            status_code=400,
                            detail="Minimum quantity for this variant is "
                                   + str(item["minimum_quantity"])
                        )

                    # Step 4: update the quantity and touch the cart
                    cursor.execute(
                        """
                        UPDATE cart_items
                        SET quantity = %s, updated_at = now()
                        WHERE cart_item_id = %s AND cart_id = %s
                        """,
                        (body.quantity, cart_item_id, cart["cart_id"]),
                    )
                    cursor.execute(
                        "UPDATE carts SET updated_at = now() WHERE cart_id = %s",
                        (cart["cart_id"],),
                    )

                    # Return the updated cart
                    return build_cart_response(cursor, cart["cart_id"], cart_token)

    except psycopg.Error as e:
        print("DATABASE ERROR:", repr(e))
        raise HTTPException(
            status_code=503,
            detail="Database connection or query failed"
        )


@app.delete("/cart/{cart_token}/items/{cart_item_id}")
def delete_cart_item(cart_token: uuid.UUID, cart_item_id: int):
    try:
        with get_connection() as conn:
            # One transaction: any error or HTTPException rolls everything back
            with conn.transaction():
                with conn.cursor() as cursor:
                    # Step 1: find the active cart (locked until the transaction ends)
                    cursor.execute(
                        """
                        SELECT cart_id
                        FROM carts
                        WHERE guest_cart_token = %s AND cart_status = 'active'
                        FOR UPDATE
                        """,
                        (cart_token,),
                    )
                    cart = cursor.fetchone()
                    if cart is None:
                        raise HTTPException(status_code=404, detail="Cart not found")

                    # Step 2: delete the item, only if it belongs to this cart
                    cursor.execute(
                        """
                        DELETE FROM cart_items
                        WHERE cart_item_id = %s AND cart_id = %s
                        RETURNING cart_item_id
                        """,
                        (cart_item_id, cart["cart_id"]),
                    )
                    if cursor.fetchone() is None:
                        raise HTTPException(status_code=404, detail="Cart item not found")

                    # Step 3: touch the cart
                    cursor.execute(
                        "UPDATE carts SET updated_at = now() WHERE cart_id = %s",
                        (cart["cart_id"],),
                    )

                    # Return the updated cart
                    return build_cart_response(cursor, cart["cart_id"], cart_token)

    except psycopg.Error as e:
        print("DATABASE ERROR:", repr(e))
        raise HTTPException(
            status_code=503,
            detail="Database connection or query failed"
        )


# ---------- Checkout and orders ----------

# Shipping methods (static for now). free_over: free when (subtotal - discount) >= this amount
SHIPPING_METHODS = {
    "standard": {
        "code": "standard",
        "name": "Standard Shipping",
        "price": Decimal("5.99"),
        "min_days": 5,
        "max_days": 8,
        "free_over": Decimal("75.00"),
    },
    "express": {
        "code": "express",
        "name": "Express Shipping",
        "price": Decimal("14.99"),
        "min_days": 2,
        "max_days": 3,
        "free_over": None,
    },
}

# Simple email format check (no extra library needed)
EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class ShippingAddress(BaseModel):
    # Max lengths match the order_addresses columns
    full_name: str = Field(min_length=1, max_length=150)
    phone: str = Field(min_length=1, max_length=40)
    line_1: str = Field(min_length=1, max_length=200)
    line_2: str | None = Field(default=None, max_length=200)
    city: str = Field(min_length=1, max_length=100)
    state_region: str = Field(min_length=1, max_length=100)
    postal_code: str = Field(min_length=1, max_length=30)
    country_code: str = Field(pattern=r"^[A-Za-z]{2}$")


class CheckoutBody(BaseModel):
    cart_token: uuid.UUID
    contact_email: str = Field(max_length=320, pattern=EMAIL_PATTERN)
    shipping_method_code: Literal["standard", "express"]
    shipping_address: ShippingAddress


class PlaceOrderBody(BaseModel):
    cart_token: uuid.UUID


def money(value):
    # Round a Decimal to 2 places (cents)
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def calculate_quote(cursor, cart_id, shipping_method_code):
    method = SHIPPING_METHODS[shipping_method_code]

    # Step 1: cart items with CURRENT prices (items saved for later are not ordered)
    cursor.execute(
        """
        SELECT
            ci.design_id,
            ci.product_variant_id,
            ci.quantity,
            d.public_design_code,
            d.title,
            d.design_status,
            CASE WHEN f.storage_key IS NULL THEN NULL
                 ELSE '/media/' || f.storage_key END AS preview_url,
            pv.sku,
            pv.color_name,
            pv.size_code,
            pv.customer_price,
            pv.variant_status,
            p.product_name,
            p.product_type,
            p.product_status,
            p.production_days_max
        FROM cart_items ci
        JOIN designs d ON d.design_id = ci.design_id
        LEFT JOIN files f ON f.file_id = d.preview_file_id
        JOIN product_variants pv ON pv.product_variant_id = ci.product_variant_id
        JOIN products p ON p.product_id = pv.product_id
        WHERE ci.cart_id = %s AND ci.saved_for_later = false
        ORDER BY ci.created_at, ci.cart_item_id
        """,
        (cart_id,),
    )
    items = cursor.fetchall()

    if not items:
        raise HTTPException(status_code=400, detail="Your cart is empty")

    # Step 2: every item must still be available
    for item in items:
        if (
            item["design_status"] != "published"
            or item["variant_status"] != "active"
            or item["product_status"] != "active"
        ):
            raise HTTPException(
                status_code=400,
                detail=item["title"] + " is no longer available. Please remove it from your cart.",
            )
        item["unit_price"] = item["customer_price"]
        item["line_total"] = item["quantity"] * item["customer_price"]

    subtotal = sum((item["line_total"] for item in items), Decimal("0"))
    total_quantity = sum(item["quantity"] for item in items)
    product_types = {item["product_type"] for item in items}

    # Step 3: pick the single biggest discount (rules never stack)
    cursor.execute(
        """
        SELECT
            discount_rule_id,
            rule_name,
            rule_type,
            min_total_quantity,
            required_product_types_json,
            discount_type,
            discount_value
        FROM discount_rules
        WHERE rule_status = 'active'
          AND starts_at <= now()
          AND (ends_at IS NULL OR ends_at > now())
        ORDER BY discount_rule_id
        """
    )
    best = None
    discount = Decimal("0")
    for rule in cursor.fetchall():
        # Does the cart qualify for this rule?
        if rule["rule_type"] == "bundle":
            required = set(rule["required_product_types_json"])
            qualifies = len(required) > 0 and required <= product_types
        else:
            qualifies = total_quantity >= (rule["min_total_quantity"] or 0)
        if not qualifies:
            continue

        # Discount amount, never more than the subtotal
        if rule["discount_type"] == "percent":
            amount = money(subtotal * rule["discount_value"] / Decimal("100"))
        else:
            amount = money(rule["discount_value"])
        amount = min(amount, subtotal)

        if amount > discount:
            discount = amount
            best = rule

    # Step 4: shipping (standard is free over the threshold, based on subtotal - discount)
    shipping = method["price"]
    if method["free_over"] is not None and (subtotal - discount) >= method["free_over"]:
        shipping = Decimal("0.00")

    # Step 5: tax is 0 for now, then the total
    tax = Decimal("0.00")
    total = subtotal - discount + shipping + tax

    # Step 6: delivery window = today + longest production time + shipping days
    production_days = max(item["production_days_max"] for item in items)
    today = date.today()
    delivery_start = today + timedelta(days=production_days + method["min_days"])
    delivery_end = today + timedelta(days=production_days + method["max_days"])

    return {
        "items": items,
        "subtotal": money(subtotal),
        "discount_total": money(discount),
        "discount_rule_id": best["discount_rule_id"] if best else None,
        "discount_type": best["rule_type"] if best else None,
        "discount_name": best["rule_name"] if best else None,
        "shipping_amount": money(shipping),
        "tax_total": money(tax),
        "total": money(total),
        "estimated_delivery_start": delivery_start,
        "estimated_delivery_end": delivery_end,
    }


@app.get("/shipping-methods")
def get_shipping_methods():
    # Static list for now
    return list(SHIPPING_METHODS.values())


@app.post("/checkout")
def create_checkout(body: CheckoutBody, request: Request):
    # Address as plain JSON (country code in upper case)
    address = body.shipping_address.model_dump()
    address["country_code"] = address["country_code"].upper()

    try:
        # Logged-in customer (None for guests)
        user = get_current_user(request)
        user_id = user["user_id"] if user else None

        with get_connection() as conn:
            # One transaction: any error or HTTPException rolls everything back
            with conn.transaction():
                with conn.cursor() as cursor:
                    # Step 1: the cart must be active (locked until the transaction ends)
                    cursor.execute(
                        """
                        SELECT cart_id
                        FROM carts
                        WHERE guest_cart_token = %s AND cart_status = 'active'
                        FOR UPDATE
                        """,
                        (body.cart_token,),
                    )
                    cart = cursor.fetchone()
                    if cart is None:
                        raise HTTPException(status_code=404, detail="Cart not found")

                    # Step 2: the address must be real (country, state, city); saves the proper names
                    validate_shipping_address(cursor, address)

                    # Step 3: calculate the quote (also rejects an empty cart)
                    quote = calculate_quote(cursor, cart["cart_id"], body.shipping_method_code)

                    # Step 3: older open/ready sessions for this cart are no longer valid
                    cursor.execute(
                        """
                        UPDATE checkout_sessions
                        SET checkout_status = 'expired', updated_at = now()
                        WHERE cart_id = %s AND checkout_status IN ('open', 'ready')
                        """,
                        (cart["cart_id"],),
                    )

                    # Step 4: save the new session; the quote is valid for 30 minutes
                    cursor.execute(
                        """
                        INSERT INTO checkout_sessions
                            (cart_id, user_id, contact_email, guest_shipping_address_json,
                             shipping_method_code, shipping_amount,
                             estimated_delivery_start, estimated_delivery_end,
                             item_subtotal, discount_total, tax_total, checkout_total,
                             checkout_status, quote_expires_at, applied_discount_rule_id)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                                'ready', now() + interval '30 minutes', %s)
                        RETURNING checkout_session_id, quote_expires_at
                        """,
                        (
                            cart["cart_id"],
                            user_id,
                            body.contact_email,
                            Jsonb(address),
                            body.shipping_method_code,
                            quote["shipping_amount"],
                            quote["estimated_delivery_start"],
                            quote["estimated_delivery_end"],
                            quote["subtotal"],
                            quote["discount_total"],
                            quote["tax_total"],
                            quote["total"],
                            quote["discount_rule_id"],
                        ),
                    )
                    session = cursor.fetchone()

                    # Step 5: return the quote (only fields the customer needs)
                    items = [
                        {
                            "public_design_code": item["public_design_code"],
                            "title": item["title"],
                            "product_name": item["product_name"],
                            "sku": item["sku"],
                            "color_name": item["color_name"],
                            "size_code": item["size_code"],
                            "quantity": item["quantity"],
                            "unit_price": item["unit_price"],
                            "line_total": item["line_total"],
                            "preview_url": item["preview_url"],
                        }
                        for item in quote["items"]
                    ]
                    return {
                        "checkout_session_id": session["checkout_session_id"],
                        "items": items,
                        "subtotal": quote["subtotal"],
                        "discount_total": quote["discount_total"],
                        "discount_name": quote["discount_name"],
                        "shipping_amount": quote["shipping_amount"],
                        "tax_total": quote["tax_total"],
                        "total": quote["total"],
                        "estimated_delivery_start": quote["estimated_delivery_start"],
                        "estimated_delivery_end": quote["estimated_delivery_end"],
                        "quote_expires_at": session["quote_expires_at"],
                    }

    except psycopg.Error as e:
        print("DATABASE ERROR:", repr(e))
        raise HTTPException(
            status_code=503,
            detail="Database connection or query failed"
        )


@app.post("/checkout/{checkout_session_id}/place-order")
def place_order(checkout_session_id: int, body: PlaceOrderBody, request: Request):
    try:
        # Logged-in customer (None for guests)
        user = get_current_user(request)
        user_id = user["user_id"] if user else None

        with get_connection() as conn:
            # One transaction: any error or HTTPException rolls everything back
            with conn.transaction():
                with conn.cursor() as cursor:
                    # Step 1: lock the cart (any status, so a repeat call gets a clear message)
                    cursor.execute(
                        """
                        SELECT cart_id, cart_status
                        FROM carts
                        WHERE guest_cart_token = %s
                        FOR UPDATE
                        """,
                        (body.cart_token,),
                    )
                    cart = cursor.fetchone()
                    if cart is None:
                        raise HTTPException(status_code=404, detail="Cart not found")

                    # Step 2: lock the checkout session; it must belong to this cart
                    cursor.execute(
                        """
                        SELECT
                            checkout_session_id,
                            contact_email,
                            guest_shipping_address_json,
                            shipping_method_code,
                            checkout_total,
                            checkout_status,
                            quote_expires_at > now() AS quote_valid
                        FROM checkout_sessions
                        WHERE checkout_session_id = %s AND cart_id = %s
                        FOR UPDATE
                        """,
                        (checkout_session_id, cart["cart_id"]),
                    )
                    session = cursor.fetchone()
                    if session is None:
                        raise HTTPException(status_code=404, detail="Checkout session not found")

                    # Step 3: the session must be ready and not expired
                    if session["checkout_status"] == "completed":
                        raise HTTPException(
                            status_code=400,
                            detail="This order was already placed"
                        )
                    if (
                        session["checkout_status"] != "ready"
                        or not session["quote_valid"]
                        or cart["cart_status"] != "active"
                    ):
                        raise HTTPException(
                            status_code=400,
                            detail="Checkout expired, please review your order again"
                        )

                    # Step 4: recalculate; if the total changed the customer must review again
                    quote = calculate_quote(cursor, cart["cart_id"], session["shipping_method_code"])
                    if quote["total"] != session["checkout_total"]:
                        raise HTTPException(
                            status_code=409,
                            detail="Prices changed, please review your order again"
                        )

                    # Step 5: create the order with a random public code (retry if taken)
                    alphabet = string.ascii_uppercase + string.digits
                    order = None
                    for _ in range(10):
                        code = "TT-" + "".join(secrets.choice(alphabet) for _ in range(8))
                        cursor.execute(
                            """
                            INSERT INTO orders
                                (order_public_code, checkout_session_id, user_id, contact_email,
                                 item_subtotal, discount_total, shipping_total, tax_total,
                                 order_total, order_status, payment_status,
                                 applied_discount_rule_id, applied_discount_type)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s,
                                    'payment_pending', 'unpaid', %s, %s)
                            ON CONFLICT (order_public_code) DO NOTHING
                            RETURNING order_id
                            """,
                            (
                                code,
                                checkout_session_id,
                                user_id,
                                session["contact_email"],
                                quote["subtotal"],
                                quote["discount_total"],
                                quote["shipping_amount"],
                                quote["tax_total"],
                                quote["total"],
                                quote["discount_rule_id"],
                                quote["discount_type"],
                            ),
                        )
                        order = cursor.fetchone()
                        if order is not None:
                            break
                    if order is None:
                        raise HTTPException(status_code=500, detail="Could not create order code")
                    order_id = order["order_id"]

                    # Step 6: one order item per cart item, with snapshots
                    for item in quote["items"]:
                        cursor.execute(
                            """
                            INSERT INTO order_items
                                (order_id, design_id, product_variant_id, item_title_snapshot,
                                 design_snapshot_json, product_snapshot_json,
                                 quantity, unit_price, line_total, item_status)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending')
                            """,
                            (
                                order_id,
                                item["design_id"],
                                item["product_variant_id"],
                                item["title"] + " - " + item["product_name"],
                                Jsonb({
                                    "public_design_code": str(item["public_design_code"]),
                                    "title": item["title"],
                                    "preview_url": item["preview_url"],
                                }),
                                Jsonb({
                                    "product_name": item["product_name"],
                                    "product_type": item["product_type"],
                                    "sku": item["sku"],
                                    "color_name": item["color_name"],
                                    "size_code": item["size_code"],
                                }),
                                item["quantity"],
                                item["unit_price"],
                                item["line_total"],
                            ),
                        )

                    # Step 7: shipping address
                    address = session["guest_shipping_address_json"]
                    cursor.execute(
                        """
                        INSERT INTO order_addresses
                            (order_id, address_type, recipient_name, phone_number,
                             line_1, line_2, city, state_region, postal_code, country_code)
                        VALUES (%s, 'shipping', %s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        (
                            order_id,
                            address["full_name"],
                            address["phone"],
                            address["line_1"],
                            address.get("line_2"),
                            address["city"],
                            address["state_region"],
                            address["postal_code"],
                            address["country_code"],
                        ),
                    )

                    # Step 8: demo payment record (waiting for payment)
                    cursor.execute(
                        """
                        INSERT INTO payments
                            (order_id, action_type, provider_code, currency_code,
                             amount, payment_status)
                        VALUES (%s, 'charge', 'demo', 'USD', %s, 'pending')
                        """,
                        (order_id, quote["total"]),
                    )

                    # Step 9: first status history entry
                    cursor.execute(
                        """
                        INSERT INTO order_status_history (order_id, status_code, status_message)
                        VALUES (%s, 'payment_pending', 'Order placed. Waiting for payment.')
                        """,
                        (order_id,),
                    )

                    # Step 10: close the checkout session and convert the cart
                    cursor.execute(
                        """
                        UPDATE checkout_sessions
                        SET checkout_status = 'completed', updated_at = now()
                        WHERE checkout_session_id = %s
                        """,
                        (checkout_session_id,),
                    )
                    cursor.execute(
                        """
                        UPDATE carts
                        SET cart_status = 'converted', updated_at = now()
                        WHERE cart_id = %s
                        """,
                        (cart["cart_id"],),
                    )

                    return {"order_public_code": code, "order_total": quote["total"]}

    except psycopg.Error as e:
        print("DATABASE ERROR:", repr(e))
        raise HTTPException(
            status_code=503,
            detail="Database connection or query failed"
        )


# ---------- Order tracking ----------

# Shared by /orders/track and /me/orders/{code} (fixed text; each endpoint adds its own WHERE)
ORDER_SQL = """
    SELECT
        o.order_id,
        o.order_public_code,
        o.placed_at,
        o.order_status,
        o.payment_status,
        o.item_subtotal,
        o.discount_total,
        o.shipping_total,
        o.tax_total,
        o.order_total,
        dr.rule_name AS discount_name
    FROM orders o
    LEFT JOIN discount_rules dr ON dr.discount_rule_id = o.applied_discount_rule_id
"""


def build_order_response(cursor, order):
    # Step 1: limited shipping info (name, city, country only)
    cursor.execute(
        """
        SELECT recipient_name, city, country_code
        FROM order_addresses
        WHERE order_id = %s AND address_type = 'shipping'
        """,
        (order["order_id"],),
    )
    shipping_address = cursor.fetchone()

    # Step 2: items from the snapshots saved at order time
    cursor.execute(
        """
        SELECT
            item_title_snapshot AS title,
            design_snapshot_json,
            product_snapshot_json,
            quantity,
            unit_price,
            line_total,
            item_status
        FROM order_items
        WHERE order_id = %s
        ORDER BY order_item_id
        """,
        (order["order_id"],),
    )
    items = [
        {
            "title": row["title"],
            "preview_url": row["design_snapshot_json"].get("preview_url"),
            "product_name": row["product_snapshot_json"].get("product_name"),
            "color_name": row["product_snapshot_json"].get("color_name"),
            "size_code": row["product_snapshot_json"].get("size_code"),
            "quantity": row["quantity"],
            "unit_price": row["unit_price"],
            "line_total": row["line_total"],
            "item_status": row["item_status"],
        }
        for row in cursor.fetchall()
    ]

    # Step 3: customer-visible status history, oldest first
    cursor.execute(
        """
        SELECT status_code, status_message, changed_at
        FROM order_status_history
        WHERE order_id = %s AND is_customer_visible = true
        ORDER BY changed_at, order_status_history_id
        """,
        (order["order_id"],),
    )
    history = cursor.fetchall()

    return {
        "order_public_code": order["order_public_code"],
        "placed_at": order["placed_at"],
        "order_status": order["order_status"],
        "payment_status": order["payment_status"],
        "item_subtotal": order["item_subtotal"],
        "discount_total": order["discount_total"],
        "discount_name": order["discount_name"],
        "shipping_total": order["shipping_total"],
        "tax_total": order["tax_total"],
        "order_total": order["order_total"],
        "shipping_address": shipping_address,
        "items": items,
        "status_history": history,
    }


@app.get("/orders/track")
def track_order(
    code: str = Query(min_length=1, max_length=40),
    email: str = Query(min_length=1, max_length=320),
):
    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:
                # The order code and email must both match
                cursor.execute(
                    ORDER_SQL
                    + """
                    WHERE o.order_public_code = %s
                      AND lower(o.contact_email) = lower(%s)
                    """,
                    (code.strip().upper(), email.strip()),
                )
                order = cursor.fetchone()

                # Same message for a wrong code or a wrong email
                if order is None:
                    raise HTTPException(
                        status_code=404,
                        detail="Order not found. Check the order number and email."
                    )

                return build_order_response(cursor, order)

    except psycopg.Error as e:
        print("DATABASE ERROR:", repr(e))
        raise HTTPException(
            status_code=503,
            detail="Database connection or query failed"
        )


# ---------- Customer accounts ----------

SESSION_COOKIE = "tt_session"
SESSION_DAYS = 7
MAX_FAILED_LOGINS = 8
LOGIN_WINDOW_SECONDS = 15 * 60

# Trimmed, lower-case email in the normal email format
Email = Annotated[
    str,
    StringConstraints(strip_whitespace=True, to_lower=True, max_length=320, pattern=EMAIL_PATTERN),
]


class SignupBody(BaseModel):
    full_name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=150)]
    email: Email
    password: str = Field(min_length=12, max_length=128)


class LoginBody(BaseModel):
    email: str = Field(min_length=1, max_length=320)
    password: str = Field(min_length=1, max_length=128)


def hash_password(password):
    # Random 16-byte salt + scrypt, stored as "scrypt$<salt_hex>$<hash_hex>"
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=16384, r=8, p=1, dklen=64)
    return "scrypt$" + salt.hex() + "$" + digest.hex()


def verify_password(password, stored):
    # Any value that is not in the format above (for example a placeholder) never matches
    try:
        scheme, salt_hex, hash_hex = stored.split("$")
        if scheme != "scrypt":
            return False
        expected = bytes.fromhex(hash_hex)
        digest = hashlib.scrypt(
            password.encode("utf-8"), salt=bytes.fromhex(salt_hex), n=16384, r=8, p=1, dklen=64
        )
    except ValueError:
        return False
    # Constant-time comparison
    return hmac.compare_digest(digest, expected)


# Used when the email is unknown, so a wrong email takes about as long as a wrong password
DUMMY_PASSWORD_HASH = hash_password("not-a-real-password")

# Failed logins kept in memory: {(email, ip): [time, time, ...]}
login_failures = {}
login_lock = threading.Lock()


def too_many_failed_logins(key):
    now = time.monotonic()
    with login_lock:
        recent = [t for t in login_failures.get(key, []) if now - t < LOGIN_WINDOW_SECONDS]
        if recent:
            login_failures[key] = recent
        else:
            login_failures.pop(key, None)
        return len(recent) >= MAX_FAILED_LOGINS


def record_failed_login(key):
    now = time.monotonic()
    with login_lock:
        login_failures.setdefault(key, []).append(now)
        # Keep memory small: drop keys whose attempts are all old
        if len(login_failures) > 10000:
            for k in list(login_failures):
                if now - login_failures[k][-1] >= LOGIN_WINDOW_SECONDS:
                    del login_failures[k]


def clear_failed_logins(key):
    with login_lock:
        login_failures.pop(key, None)


def client_ip(request):
    # Valid IP address text, or None
    host = request.client.host if request.client else None
    try:
        return str(ipaddress.ip_address(host))
    except ValueError:
        return None


def start_session(cursor, request, response, user_id):
    # Random token for the browser; only its sha256 hash is stored
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    device = (request.headers.get("user-agent") or "")[:150] or None

    cursor.execute(
        """
        INSERT INTO user_sessions (user_id, refresh_token_hash, device_label, ip_address, expires_at)
        VALUES (%s, %s, %s, %s::inet, now() + make_interval(days => %s))
        """,
        (user_id, token_hash, device, client_ip(request), SESSION_DAYS),
    )

    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=SESSION_DAYS * 24 * 60 * 60,
        path="/",
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,
    )


def get_current_user(request):
    # Logged-in user from the session cookie, or None
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        return None
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()

    with get_connection() as conn:
        with conn.cursor() as cursor:
            # Session must be unrevoked and unexpired; the account must be active
            cursor.execute(
                """
                SELECT s.session_id, u.user_id, u.full_name, u.email
                FROM user_sessions s
                JOIN app_users u ON u.user_id = s.user_id
                WHERE s.refresh_token_hash = %s
                  AND s.revoked_at IS NULL
                  AND s.expires_at > now()
                  AND u.account_status = 'active'
                  AND u.deleted_at IS NULL
                """,
                (token_hash,),
            )
            row = cursor.fetchone()
            if row is None:
                return None

            cursor.execute(
                "UPDATE user_sessions SET last_active_at = now(), updated_at = now() WHERE session_id = %s",
                (row["session_id"],),
            )
            return {"user_id": row["user_id"], "full_name": row["full_name"], "email": row["email"]}


@app.post("/auth/signup")
def signup(body: SignupBody, request: Request, response: Response):
    # Hash first (CPU work), before opening the database transaction
    password_hash = hash_password(body.password)

    try:
        with get_connection() as conn:
            # One transaction: user, role and session are saved together or not at all
            with conn.transaction():
                with conn.cursor() as cursor:
                    # Step 1: the email must be new
                    cursor.execute(
                        "SELECT 1 FROM app_users WHERE lower(email) = %s",
                        (body.email,),
                    )
                    if cursor.fetchone() is not None:
                        raise HTTPException(status_code=409, detail="This email is already registered.")

                    # Step 2: create the active user and give it the customer role
                    cursor.execute(
                        """
                        INSERT INTO app_users (full_name, email, password_hash, account_status)
                        VALUES (%s, %s, %s, 'active')
                        RETURNING user_id
                        """,
                        (body.full_name, body.email, password_hash),
                    )
                    user_id = cursor.fetchone()["user_id"]
                    cursor.execute(
                        "INSERT INTO user_roles (user_id, role_code) VALUES (%s, 'customer')",
                        (user_id,),
                    )

                    # Step 3: log the new user in
                    start_session(cursor, request, response, user_id)
                    return {"user_id": user_id, "full_name": body.full_name, "email": body.email}

    except psycopg.errors.UniqueViolation:
        # Two signups with the same email at the same moment
        raise HTTPException(status_code=409, detail="This email is already registered.")

    except psycopg.Error as e:
        print("DATABASE ERROR:", repr(e))
        raise HTTPException(
            status_code=503,
            detail="Database connection or query failed"
        )


@app.post("/auth/login")
def login(body: LoginBody, request: Request, response: Response):
    email = body.email.strip().lower()
    key = (email, client_ip(request) or "unknown")

    # Step 1: too many recent failures for this email + IP
    if too_many_failed_logins(key):
        raise HTTPException(status_code=429, detail="Too many attempts. Try again in 15 minutes.")

    try:
        with get_connection() as conn:
            with conn.transaction():
                with conn.cursor() as cursor:
                    # Step 2: find the active user
                    cursor.execute(
                        """
                        SELECT user_id, full_name, email, password_hash
                        FROM app_users
                        WHERE lower(email) = %s
                          AND account_status = 'active'
                          AND deleted_at IS NULL
                        """,
                        (email,),
                    )
                    user = cursor.fetchone()

                    # Step 3: check the password (a dummy hash is checked for unknown emails)
                    stored = user["password_hash"] if user else DUMMY_PASSWORD_HASH
                    password_ok = verify_password(body.password, stored)

                    # Same message for a wrong email and a wrong password
                    if user is None or not password_ok:
                        record_failed_login(key)
                        raise HTTPException(status_code=401, detail="Invalid email or password.")

                    # Step 4: success - reset the counter, save the login time, start a session
                    clear_failed_logins(key)
                    cursor.execute(
                        "UPDATE app_users SET last_login_at = now(), updated_at = now() WHERE user_id = %s",
                        (user["user_id"],),
                    )
                    start_session(cursor, request, response, user["user_id"])
                    return {"user_id": user["user_id"], "full_name": user["full_name"], "email": user["email"]}

    except psycopg.Error as e:
        print("DATABASE ERROR:", repr(e))
        raise HTTPException(
            status_code=503,
            detail="Database connection or query failed"
        )


@app.post("/auth/logout")
def logout(request: Request, response: Response):
    token = request.cookies.get(SESSION_COOKIE)

    try:
        if token:
            token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
            with get_connection() as conn:
                with conn.transaction():
                    with conn.cursor() as cursor:
                        # Revoke the session (does nothing if it is unknown or already revoked)
                        cursor.execute(
                            """
                            UPDATE user_sessions
                            SET revoked_at = now(), updated_at = now()
                            WHERE refresh_token_hash = %s AND revoked_at IS NULL
                            """,
                            (token_hash,),
                        )

        # Always remove the cookie and answer 200, even when nobody was logged in
        response.delete_cookie(SESSION_COOKIE, path="/", httponly=True, samesite="lax", secure=COOKIE_SECURE)
        return {"message": "Logged out"}

    except psycopg.Error as e:
        print("DATABASE ERROR:", repr(e))
        raise HTTPException(
            status_code=503,
            detail="Database connection or query failed"
        )


@app.get("/auth/me")
def get_me(request: Request):
    try:
        user = get_current_user(request)
        if user is None:
            raise HTTPException(status_code=401, detail="Not logged in")

        # Tell the website which admin pages and actions this user may use
        with get_connection() as conn:
            with conn.cursor() as cursor:
                roles = get_user_roles(cursor, user["user_id"])
                permissions = get_user_permissions(cursor, user["user_id"])

        is_super_admin = any(role["role_code"] == "admin" for role in roles)
        user["is_admin"] = is_super_admin  # kept for older callers; same as is_super_admin
        user["is_super_admin"] = is_super_admin
        user["is_staff"] = any(role["is_staff"] for role in roles)
        user["roles"] = [{"role_code": r["role_code"], "role_name": r["role_name"]} for r in roles]
        user["permissions"] = permissions
        return user

    except psycopg.Error as e:
        print("DATABASE ERROR:", repr(e))
        raise HTTPException(
            status_code=503,
            detail="Database connection or query failed"
        )


@app.post("/cart/{cart_token}/claim")
def claim_cart(cart_token: uuid.UUID, request: Request):
    try:
        user = get_current_user(request)
        if user is None:
            raise HTTPException(status_code=401, detail="Not logged in")

        with get_connection() as conn:
            # One transaction: the merge is all or nothing
            with conn.transaction():
                with conn.cursor() as cursor:
                    # Step 1: the cart must be active and free (or already this user's)
                    cursor.execute(
                        """
                        SELECT cart_id, user_id
                        FROM carts
                        WHERE guest_cart_token = %s AND cart_status = 'active'
                        FOR UPDATE
                        """,
                        (cart_token,),
                    )
                    cart = cursor.fetchone()
                    if cart is None or cart["user_id"] not in (None, user["user_id"]):
                        raise HTTPException(status_code=404, detail="Cart not found")

                    if cart["user_id"] is None:
                        # Step 2: does the user already have another active cart?
                        cursor.execute(
                            """
                            SELECT cart_id
                            FROM carts
                            WHERE user_id = %s AND cart_status = 'active' AND cart_id <> %s
                            FOR UPDATE
                            """,
                            (user["user_id"], cart["cart_id"]),
                        )
                        old_cart = cursor.fetchone()

                        if old_cart is not None:
                            # Step 3: move its items into this cart (same design + variant adds up, max 100)
                            cursor.execute(
                                """
                                SELECT cart_item_id, design_id, product_variant_id, quantity
                                FROM cart_items
                                WHERE cart_id = %s
                                ORDER BY cart_item_id
                                """,
                                (old_cart["cart_id"],),
                            )
                            for item in cursor.fetchall():
                                cursor.execute(
                                    """
                                    UPDATE cart_items
                                    SET quantity = LEAST(quantity + %s, 100), updated_at = now()
                                    WHERE cart_id = %s AND design_id = %s AND product_variant_id = %s
                                    RETURNING cart_item_id
                                    """,
                                    (item["quantity"], cart["cart_id"], item["design_id"], item["product_variant_id"]),
                                )
                                if cursor.fetchone() is None:
                                    # Not in this cart yet: move the row
                                    cursor.execute(
                                        "UPDATE cart_items SET cart_id = %s, updated_at = now() WHERE cart_item_id = %s",
                                        (cart["cart_id"], item["cart_item_id"]),
                                    )
                                else:
                                    # Merged into an existing row: remove the old one
                                    cursor.execute(
                                        "DELETE FROM cart_items WHERE cart_item_id = %s",
                                        (item["cart_item_id"],),
                                    )

                            # Step 4: the old cart is retired first (only one active cart per user is allowed)
                            cursor.execute(
                                "UPDATE carts SET cart_status = 'abandoned', updated_at = now() WHERE cart_id = %s",
                                (old_cart["cart_id"],),
                            )

                        # Step 5: this cart now belongs to the user
                        cursor.execute(
                            "UPDATE carts SET user_id = %s, updated_at = now() WHERE cart_id = %s",
                            (user["user_id"], cart["cart_id"]),
                        )

                    return build_cart_response(cursor, cart["cart_id"], cart_token)

    except psycopg.Error as e:
        print("DATABASE ERROR:", repr(e))
        raise HTTPException(
            status_code=503,
            detail="Database connection or query failed"
        )


@app.get("/me/orders")
def get_my_orders(request: Request):
    try:
        user = get_current_user(request)
        if user is None:
            raise HTTPException(status_code=401, detail="Not logged in")

        with get_connection() as conn:
            with conn.cursor() as cursor:
                # The user's orders, newest first, with the first item's image
                cursor.execute(
                    """
                    SELECT
                        o.order_public_code,
                        o.placed_at,
                        o.order_status,
                        o.payment_status,
                        o.order_total,
                        (
                            SELECT COALESCE(SUM(oi.quantity), 0)::int
                            FROM order_items oi
                            WHERE oi.order_id = o.order_id
                        ) AS item_count,
                        (
                            SELECT oi.design_snapshot_json ->> 'preview_url'
                            FROM order_items oi
                            WHERE oi.order_id = o.order_id
                            ORDER BY oi.order_item_id
                            LIMIT 1
                        ) AS preview_url
                    FROM orders o
                    WHERE o.user_id = %s
                    ORDER BY o.placed_at DESC, o.order_id DESC
                    """,
                    (user["user_id"],),
                )
                return cursor.fetchall()

    except psycopg.Error as e:
        print("DATABASE ERROR:", repr(e))
        raise HTTPException(
            status_code=503,
            detail="Database connection or query failed"
        )


@app.get("/me/orders/{order_public_code}")
def get_my_order(order_public_code: str, request: Request):
    try:
        user = get_current_user(request)
        if user is None:
            raise HTTPException(status_code=401, detail="Not logged in")

        with get_connection() as conn:
            with conn.cursor() as cursor:
                # Only an order that belongs to this user
                cursor.execute(
                    ORDER_SQL
                    + """
                    WHERE o.order_public_code = %s AND o.user_id = %s
                    """,
                    (order_public_code.strip().upper(), user["user_id"]),
                )
                order = cursor.fetchone()
                if order is None:
                    raise HTTPException(status_code=404, detail="Order not found")

                return build_order_response(cursor, order)

    except psycopg.Error as e:
        print("DATABASE ERROR:", repr(e))
        raise HTTPException(
            status_code=503,
            detail="Database connection or query failed"
        )


# ---------- Admin ----------

ORDER_STATUSES = [
    "payment_pending", "confirmed", "printing", "quality_check",
    "packed", "shipped", "delivered", "cancelled", "refunded",
]

# Allowed status moves: current status -> statuses it may move to
ALLOWED_STATUS_MOVES = {
    "payment_pending": ["confirmed", "cancelled"],
    "confirmed": ["printing", "cancelled"],
    "printing": ["quality_check"],
    "quality_check": ["packed", "printing"],  # printing again = failed quality check, reprint
    "packed": ["shipped"],
    "shipped": ["delivered"],
}

# Message shown to the customer when the admin does not type one
DEFAULT_STATUS_MESSAGES = {
    "confirmed": "Your order is confirmed.",
    "printing": "Your order is being printed.",
    "quality_check": "Your order is in quality check.",
    "packed": "Your order is packed and ready to ship.",
    "shipped": "Your order has shipped.",
    "delivered": "Your order has been delivered.",
    "cancelled": "Your order was cancelled.",
}


class OrderStatusBody(BaseModel):
    new_status: str = Field(min_length=1, max_length=30)
    message: str | None = Field(default=None, max_length=250)
    customer_visible: bool = True


def has_admin_role(cursor, user_id):
    # True if the user has an admin role that is not revoked
    cursor.execute(
        """
        SELECT 1
        FROM user_roles
        WHERE user_id = %s AND role_code = 'admin' AND revoked_at IS NULL
        """,
        (user_id,),
    )
    return cursor.fetchone() is not None


def get_user_roles(cursor, user_id):
    # The user's active (not revoked) roles
    cursor.execute(
        """
        SELECT r.role_code, r.role_name, r.is_staff
        FROM user_roles ur
        JOIN admin_roles r ON r.role_code = ur.role_code
        WHERE ur.user_id = %s AND ur.revoked_at IS NULL
        ORDER BY r.is_system DESC, r.role_name
        """,
        (user_id,),
    )
    return cursor.fetchall()


def get_user_permissions(cursor, user_id):
    # Permission codes of the user's active roles, in display order
    cursor.execute(
        "SELECT role_code FROM user_roles WHERE user_id = %s AND revoked_at IS NULL",
        (user_id,),
    )
    role_codes = [row["role_code"] for row in cursor.fetchall()]
    if not role_codes:
        return []

    if "admin" in role_codes:
        # Super Admin has every permission, no role_permission rows needed
        cursor.execute("SELECT permission_code FROM admin_permissions ORDER BY sort_order, permission_code")
    else:
        # Everyone else: the union of the permissions of their roles
        cursor.execute(
            """
            SELECT DISTINCT p.permission_code, p.sort_order
            FROM admin_role_permissions rp
            JOIN admin_permissions p ON p.permission_code = rp.permission_code
            WHERE rp.role_code = ANY(%s)
            ORDER BY p.sort_order, p.permission_code
            """,
            (role_codes,),
        )
    return [row["permission_code"] for row in cursor.fetchall()]


def require_permission(request, permission_code):
    return require_any_permission(request, [permission_code])


def require_any_permission(request, permission_codes):
    # Not logged in or account not active -> 401; none of the permissions -> 403.
    # Returns the user with "permissions", "roles" and "is_super_admin" added.
    user = get_current_user(request)  # only returns users whose account is active
    if user is None:
        raise HTTPException(status_code=401, detail="Not logged in")

    with get_connection() as conn:
        with conn.cursor() as cursor:
            roles = get_user_roles(cursor, user["user_id"])
            permissions = get_user_permissions(cursor, user["user_id"])

    if not any(code in permissions for code in permission_codes):
        raise HTTPException(status_code=403, detail="You don't have permission for this.")

    user["permissions"] = permissions
    user["roles"] = roles
    user["is_super_admin"] = any(role["role_code"] == "admin" for role in roles)
    return user


def write_audit(cursor, request, admin, action_code, entity_id, summary, before, after, entity_type="order"):
    # One audit_logs row for every admin change
    cursor.execute(
        """
        INSERT INTO audit_logs
            (acted_by_user_id, action_code, entity_type, entity_id, action_summary,
             before_data, after_data, ip_address, device_label)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s::inet, %s)
        """,
        (
            admin["user_id"],
            action_code,
            entity_type,
            entity_id,
            summary,
            Jsonb(before),
            Jsonb(after),
            client_ip(request),
            (request.headers.get("user-agent") or "")[:150] or None,
        ),
    )


def build_admin_order_response(cursor, order_public_code):
    # Same data as /orders/track, plus the private details only admins may see
    cursor.execute(
        ORDER_SQL + " WHERE o.order_public_code = %s",
        (order_public_code,),
    )
    order = cursor.fetchone()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    result = build_order_response(cursor, order)

    # Contact email and the customer account (None for a guest order)
    cursor.execute(
        """
        SELECT o.contact_email, u.user_id, u.full_name, u.email
        FROM orders o
        LEFT JOIN app_users u ON u.user_id = o.user_id
        WHERE o.order_id = %s
        """,
        (order["order_id"],),
    )
    who = cursor.fetchone()
    result["contact_email"] = who["contact_email"]
    result["customer"] = (
        None if who["user_id"] is None
        else {"user_id": who["user_id"], "full_name": who["full_name"], "email": who["email"]}
    )

    # Full shipping address (the customer view only has name, city and country)
    cursor.execute(
        """
        SELECT recipient_name, phone_number, line_1, line_2, city,
               state_region, postal_code, country_code
        FROM order_addresses
        WHERE order_id = %s AND address_type = 'shipping'
        """,
        (order["order_id"],),
    )
    result["shipping_address"] = cursor.fetchone()

    # Payments
    cursor.execute(
        """
        SELECT payment_public_code, action_type, provider_code, provider_reference,
               currency_code, amount, payment_status, reason, processed_at
        FROM payments
        WHERE order_id = %s
        ORDER BY payment_id
        """,
        (order["order_id"],),
    )
    result["payments"] = cursor.fetchall()

    # All status history, including entries the customer cannot see
    cursor.execute(
        """
        SELECT h.status_code, h.status_message, h.is_customer_visible, h.changed_at,
               h.changed_by_user_id, u.full_name AS changed_by_name
        FROM order_status_history h
        LEFT JOIN app_users u ON u.user_id = h.changed_by_user_id
        WHERE h.order_id = %s
        ORDER BY h.changed_at, h.order_status_history_id
        """,
        (order["order_id"],),
    )
    result["status_history"] = cursor.fetchall()
    return result


@app.get("/admin/stats")
def get_admin_stats(request: Request):
    try:
        admin = require_permission(request, "dashboard.view")

        with get_connection() as conn:
            with conn.cursor() as cursor:
                # Order counts and revenue (cancelled orders are not counted as revenue)
                cursor.execute(
                    """
                    SELECT
                        COUNT(*) FILTER (WHERE placed_at >= date_trunc('day', now())) AS orders_today,
                        COUNT(*) AS orders_total,
                        COALESCE(SUM(order_total) FILTER (WHERE order_status <> 'cancelled'), 0) AS revenue_total
                    FROM orders
                    """
                )
                totals = cursor.fetchone()

                # Orders per status (every status is listed, with 0 when there are none)
                cursor.execute("SELECT order_status, COUNT(*) AS n FROM orders GROUP BY order_status")
                by_status = {status: 0 for status in ORDER_STATUSES}
                for row in cursor.fetchall():
                    by_status[row["order_status"]] = row["n"]

                cursor.execute("SELECT COUNT(*) AS n FROM designs WHERE design_status = 'published'")
                designs_published = cursor.fetchone()["n"]

                # Customers = users who have a customer role and are not deleted
                cursor.execute(
                    """
                    SELECT COUNT(DISTINCT u.user_id) AS n
                    FROM app_users u
                    JOIN user_roles r ON r.user_id = u.user_id
                    WHERE r.role_code = 'customer' AND r.revoked_at IS NULL AND u.deleted_at IS NULL
                    """
                )
                customers_total = cursor.fetchone()["n"]

                # Last 5 orders
                cursor.execute(
                    """
                    SELECT
                        o.order_public_code,
                        o.placed_at,
                        COALESCE(u.full_name, o.contact_email) AS customer,
                        o.order_total,
                        o.order_status
                    FROM orders o
                    LEFT JOIN app_users u ON u.user_id = o.user_id
                    ORDER BY o.placed_at DESC, o.order_id DESC
                    LIMIT 5
                    """
                )
                recent_orders = cursor.fetchall()

                return {
                    "orders_today": totals["orders_today"],
                    "orders_total": totals["orders_total"],
                    # Revenue is finance data: hidden (null) without finance.view
                    "revenue_total": totals["revenue_total"] if "finance.view" in admin["permissions"] else None,
                    "orders_by_status": by_status,
                    "designs_published": designs_published,
                    "customers_total": customers_total,
                    "recent_orders": recent_orders,
                }

    except psycopg.Error as e:
        print("DATABASE ERROR:", repr(e))
        raise HTTPException(
            status_code=503,
            detail="Database connection or query failed"
        )


# Shared by the admin order list and its total (fixed text, values are always %s)
ADMIN_ORDERS_FROM_SQL = """
    FROM orders o
    LEFT JOIN app_users u ON u.user_id = o.user_id
    WHERE (%s::text IS NULL OR o.order_status = %s)
      AND (%s::text IS NULL OR o.order_public_code ILIKE %s OR o.contact_email ILIKE %s)
"""


@app.get("/admin/orders")
def get_admin_orders(
    request: Request,
    status: Literal[
        "payment_pending", "confirmed", "printing", "quality_check",
        "packed", "shipped", "delivered", "cancelled", "refunded",
    ] | None = None,
    search: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    # ILIKE pattern with the user's % and _ treated as plain characters
    term = search.strip() if search else ""
    pattern = None
    if term:
        escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        pattern = "%" + escaped + "%"

    filter_params = (status, status, pattern, pattern, pattern)

    try:
        require_permission(request, "orders.view")

        with get_connection() as conn:
            with conn.cursor() as cursor:
                # Step 1: one page of orders, newest first
                cursor.execute(
                    """
                    SELECT
                        o.order_public_code,
                        o.placed_at,
                        o.contact_email,
                        u.full_name AS customer_name,
                        (
                            SELECT COALESCE(SUM(oi.quantity), 0)::int
                            FROM order_items oi
                            WHERE oi.order_id = o.order_id
                        ) AS item_count,
                        o.order_total,
                        o.order_status,
                        o.payment_status
                    """
                    + ADMIN_ORDERS_FROM_SQL
                    + """
                    ORDER BY o.placed_at DESC, o.order_id DESC
                    LIMIT %s OFFSET %s
                    """,
                    filter_params + (limit, offset),
                )
                items = cursor.fetchall()

                # Step 2: how many orders match, ignoring limit/offset
                cursor.execute(
                    "SELECT COUNT(*) AS total " + ADMIN_ORDERS_FROM_SQL,
                    filter_params,
                )
                total = cursor.fetchone()["total"]

                return {"items": items, "total": total}

    except psycopg.Error as e:
        print("DATABASE ERROR:", repr(e))
        raise HTTPException(
            status_code=503,
            detail="Database connection or query failed"
        )


@app.get("/admin/orders/{order_public_code}")
def get_admin_order(order_public_code: str, request: Request):
    try:
        require_permission(request, "orders.view")

        with get_connection() as conn:
            with conn.cursor() as cursor:
                return build_admin_order_response(cursor, order_public_code.strip().upper())

    except psycopg.Error as e:
        print("DATABASE ERROR:", repr(e))
        raise HTTPException(
            status_code=503,
            detail="Database connection or query failed"
        )


@app.post("/admin/orders/{order_public_code}/status")
def change_order_status(order_public_code: str, body: OrderStatusBody, request: Request):
    code = order_public_code.strip().upper()

    try:
        admin = require_permission(request, "orders.manage")

        with get_connection() as conn:
            # One transaction: status, history and audit log are saved together or not at all
            with conn.transaction():
                with conn.cursor() as cursor:
                    # Step 1: lock the order
                    cursor.execute(
                        """
                        SELECT order_id, order_status
                        FROM orders
                        WHERE order_public_code = %s
                        FOR UPDATE
                        """,
                        (code,),
                    )
                    order = cursor.fetchone()
                    if order is None:
                        raise HTTPException(status_code=404, detail="Order not found")

                    # Step 2: only the allowed moves
                    old_status = order["order_status"]
                    new_status = body.new_status
                    if new_status not in ALLOWED_STATUS_MOVES.get(old_status, []):
                        raise HTTPException(
                            status_code=400,
                            detail="Cannot move from " + old_status + " to " + new_status,
                        )

                    # Step 3: save the new status (cancelled also records the time)
                    cursor.execute(
                        """
                        UPDATE orders
                        SET order_status = %s,
                            cancelled_at = CASE WHEN %s = 'cancelled' THEN now() ELSE cancelled_at END,
                            updated_at = now()
                        WHERE order_id = %s
                        """,
                        (new_status, new_status, order["order_id"]),
                    )

                    # Step 4: history entry (a typed message, or the default for this status)
                    message = (body.message or "").strip() or DEFAULT_STATUS_MESSAGES[new_status]
                    cursor.execute(
                        """
                        INSERT INTO order_status_history
                            (order_id, status_code, status_message, is_customer_visible, changed_by_user_id)
                        VALUES (%s, %s, %s, %s, %s)
                        """,
                        (order["order_id"], new_status, message, body.customer_visible, admin["user_id"]),
                    )

                    # Step 5: audit log
                    write_audit(
                        cursor, request, admin, "order_status_changed", order["order_id"],
                        "Order " + code + " moved from " + old_status + " to " + new_status,
                        {"order_status": old_status},
                        {"order_status": new_status, "message": message,
                         "customer_visible": body.customer_visible},
                    )

                    return build_admin_order_response(cursor, code)

    except psycopg.Error as e:
        print("DATABASE ERROR:", repr(e))
        raise HTTPException(
            status_code=503,
            detail="Database connection or query failed"
        )


@app.post("/admin/orders/{order_public_code}/mark-paid")
def mark_order_paid(order_public_code: str, request: Request):
    code = order_public_code.strip().upper()

    try:
        admin = require_permission(request, "finance.manage")

        with get_connection() as conn:
            # One transaction: payment, order, history and audit log are saved together or not at all
            with conn.transaction():
                with conn.cursor() as cursor:
                    # Step 1: lock the order
                    cursor.execute(
                        """
                        SELECT order_id, order_status, payment_status, order_total
                        FROM orders
                        WHERE order_public_code = %s
                        FOR UPDATE
                        """,
                        (code,),
                    )
                    order = cursor.fetchone()
                    if order is None:
                        raise HTTPException(status_code=404, detail="Order not found")

                    # Step 2: only an unpaid order that is not cancelled
                    if order["payment_status"] != "unpaid":
                        raise HTTPException(
                            status_code=400,
                            detail="Payment status is " + order["payment_status"] + ", not unpaid",
                        )
                    if order["order_status"] == "cancelled":
                        raise HTTPException(
                            status_code=400,
                            detail="Cannot mark a cancelled order as paid",
                        )

                    # Step 3: the pending charge becomes successful (demo payment, marked by hand)
                    cursor.execute(
                        """
                        UPDATE payments
                        SET payment_status = 'successful', processed_at = now(), updated_at = now()
                        WHERE order_id = %s AND action_type = 'charge' AND payment_status = 'pending'
                        RETURNING payment_id
                        """,
                        (order["order_id"],),
                    )
                    if cursor.fetchone() is None:
                        # No pending charge exists: record a successful one
                        cursor.execute(
                            """
                            INSERT INTO payments
                                (order_id, action_type, provider_code, currency_code, amount, payment_status)
                            VALUES (%s, 'charge', 'demo', 'USD', %s, 'successful')
                            """,
                            (order["order_id"], order["order_total"]),
                        )

                    # Step 4: the order is paid; a waiting order becomes confirmed
                    new_status = order["order_status"]
                    if new_status == "payment_pending":
                        new_status = "confirmed"
                    cursor.execute(
                        """
                        UPDATE orders
                        SET payment_status = 'paid', order_status = %s, updated_at = now()
                        WHERE order_id = %s
                        """,
                        (new_status, order["order_id"]),
                    )
                    if new_status != order["order_status"]:
                        cursor.execute(
                            """
                            INSERT INTO order_status_history
                                (order_id, status_code, status_message, is_customer_visible, changed_by_user_id)
                            VALUES (%s, 'confirmed', 'Payment received. Your order is confirmed.', true, %s)
                            """,
                            (order["order_id"], admin["user_id"]),
                        )

                    # Step 5: audit log
                    write_audit(
                        cursor, request, admin, "order_marked_paid", order["order_id"],
                        "Order " + code + " marked as paid",
                        {"payment_status": "unpaid", "order_status": order["order_status"]},
                        {"payment_status": "paid", "order_status": new_status},
                    )

                    return build_admin_order_response(cursor, code)

    except psycopg.Error as e:
        print("DATABASE ERROR:", repr(e))
        raise HTTPException(
            status_code=503,
            detail="Database connection or query failed"
        )


# ---------- Roles, admin users, locations ----------

SUPER_ADMIN_ONLY = "Only a Super Admin can give or remove the admin role."
LAST_ADMIN = "There must always be at least one active Super Admin."
ROLES_SUPER_ONLY = "Only a Super Admin can create, edit or delete roles."
CANNOT_GIVE = "You can't give permissions you don't have."
SUPER_TARGET = "Only a Super Admin can change a Super Admin's account."
OWN_ROLES = "You can't change your own roles."
OWN_ROLES_REMOVE = "You can't remove your own roles."

PermissionCode = Annotated[str, StringConstraints(max_length=60)]
RoleCode = Annotated[str, StringConstraints(pattern=r"^[a-z][a-z0-9_]{1,29}$")]
RoleName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]


class RoleCreateBody(BaseModel):
    role_code: RoleCode
    role_name: RoleName
    description: str | None = Field(default=None, max_length=250)
    permissions: list[PermissionCode] = Field(default_factory=list, max_length=50)


class RoleUpdateBody(BaseModel):
    role_name: RoleName
    description: str | None = Field(default=None, max_length=250)
    permissions: list[PermissionCode] = Field(default_factory=list, max_length=50)


class AdminUserCreateBody(BaseModel):
    full_name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=150)]
    email: Email
    password: str = Field(min_length=12, max_length=128)  # temporary password
    roles: list[RoleCode] = Field(min_length=1, max_length=20)


class UserRolesBody(BaseModel):
    roles: list[RoleCode] = Field(max_length=20)


class CountrySettingBody(BaseModel):
    is_shipping_enabled: bool


def like_pattern(text):
    # "%text%" for ILIKE, with the user's % and _ treated as plain characters
    term = (text or "").strip()
    if not term:
        return None
    return "%" + term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"


def require_super_admin_for_roles(admin):
    # Creating, editing and deleting roles is for Super Admins only
    if not admin["is_super_admin"]:
        raise HTTPException(status_code=403, detail=ROLES_SUPER_ONLY)


def check_can_give_roles(cursor, admin, role_codes):
    # A Super Admin may give any role; everyone else only roles whose permissions they have themselves
    if admin["is_super_admin"] or not role_codes:
        return
    cursor.execute(
        "SELECT DISTINCT permission_code FROM admin_role_permissions WHERE role_code = ANY(%s)",
        (role_codes,),
    )
    for row in cursor.fetchall():
        if row["permission_code"] not in admin["permissions"]:
            raise HTTPException(status_code=403, detail=CANNOT_GIVE)


def check_not_super_admin_target(cursor, admin, target_user_id):
    # Only a Super Admin may change the account of a Super Admin
    if not admin["is_super_admin"] and has_admin_role(cursor, target_user_id):
        raise HTTPException(status_code=403, detail=SUPER_TARGET)


def lock_admin_role(cursor):
    # Serialises changes that could remove the last Super Admin
    cursor.execute("SELECT role_code FROM admin_roles WHERE role_code = 'admin' FOR UPDATE")


def count_other_active_admins(cursor, user_id):
    # Active, non-deleted users with the admin role, not counting this user
    cursor.execute(
        """
        SELECT COUNT(DISTINCT u.user_id) AS n
        FROM user_roles ur
        JOIN app_users u ON u.user_id = ur.user_id
        WHERE ur.role_code = 'admin' AND ur.revoked_at IS NULL
          AND u.account_status = 'active' AND u.deleted_at IS NULL
          AND u.user_id <> %s
        """,
        (user_id,),
    )
    return cursor.fetchone()["n"]


def check_permission_codes(cursor, codes):
    # Every code must exist; returns the codes without duplicates
    codes = list(dict.fromkeys(codes))
    if codes:
        cursor.execute(
            "SELECT permission_code FROM admin_permissions WHERE permission_code = ANY(%s)",
            (codes,),
        )
        known = {row["permission_code"] for row in cursor.fetchall()}
        unknown = [code for code in codes if code not in known]
        if unknown:
            raise HTTPException(status_code=400, detail="Unknown permission: " + ", ".join(unknown))
    return codes


def check_staff_roles(cursor, role_codes):
    # Every role must exist and be a staff role; returns the codes without duplicates
    role_codes = list(dict.fromkeys(role_codes))
    if role_codes:
        cursor.execute(
            "SELECT role_code FROM admin_roles WHERE role_code = ANY(%s) AND is_staff = true",
            (role_codes,),
        )
        known = {row["role_code"] for row in cursor.fetchall()}
        unknown = [code for code in role_codes if code not in known]
        if unknown:
            raise HTTPException(status_code=400, detail="Unknown or non-staff role: " + ", ".join(unknown))
    return role_codes


def fetch_roles(cursor, role_code=None):
    # Roles except 'customer' with their permission codes and number of users holding them
    cursor.execute(
        """
        SELECT
            r.role_code,
            r.role_name,
            r.description,
            r.is_system,
            r.is_staff,
            CASE WHEN r.role_code = 'admin' THEN (
                    SELECT COALESCE(array_agg(p.permission_code ORDER BY p.sort_order, p.permission_code), '{}')
                    FROM admin_permissions p
                 ) ELSE (
                    SELECT COALESCE(array_agg(p.permission_code ORDER BY p.sort_order, p.permission_code), '{}')
                    FROM admin_role_permissions rp
                    JOIN admin_permissions p ON p.permission_code = rp.permission_code
                    WHERE rp.role_code = r.role_code
                 ) END AS permissions,
            (
                SELECT COUNT(DISTINCT ur.user_id)::int
                FROM user_roles ur
                WHERE ur.role_code = r.role_code AND ur.revoked_at IS NULL
            ) AS user_count
        FROM admin_roles r
        WHERE r.role_code <> 'customer'
          AND (%s::text IS NULL OR r.role_code = %s)
        ORDER BY r.is_system DESC, r.role_name
        """,
        (role_code, role_code),
    )
    return cursor.fetchall()


def fetch_users(cursor, search=None, user_id=None, staff_only=True):
    # Users (staff only, or any) with their active staff roles
    pattern = like_pattern(search)
    cursor.execute(
        """
        SELECT
            u.user_id,
            u.full_name,
            u.email,
            u.account_status,
            u.last_login_at,
            COALESCE((
                SELECT json_agg(json_build_object('role_code', r.role_code, 'role_name', r.role_name)
                                ORDER BY r.role_name)
                FROM user_roles ur
                JOIN admin_roles r ON r.role_code = ur.role_code
                WHERE ur.user_id = u.user_id AND ur.revoked_at IS NULL AND r.is_staff = true
            ), '[]'::json) AS roles
        FROM app_users u
        WHERE u.deleted_at IS NULL
          AND (%s = false OR EXISTS (
                SELECT 1
                FROM user_roles ur
                JOIN admin_roles r ON r.role_code = ur.role_code
                WHERE ur.user_id = u.user_id AND ur.revoked_at IS NULL AND r.is_staff = true
          ))
          AND (%s::text IS NULL OR u.full_name ILIKE %s OR u.email ILIKE %s)
          AND (%s::bigint IS NULL OR u.user_id = %s)
        ORDER BY u.full_name, u.user_id
        """,
        (staff_only, pattern, pattern, pattern, user_id, user_id),
    )
    return cursor.fetchall()


def db_error_503(e):
    print("DATABASE ERROR:", repr(e))
    return HTTPException(status_code=503, detail="Database connection or query failed")


@app.get("/admin/permissions")
def get_admin_permissions(request: Request):
    try:
        require_permission(request, "users.view")

        with get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT permission_code, module, action, label
                    FROM admin_permissions
                    ORDER BY sort_order, permission_code
                    """
                )
                # Grouped by module; modules keep the order of their first permission
                groups = {}
                for row in cursor.fetchall():
                    groups.setdefault(row["module"], []).append(
                        {"permission_code": row["permission_code"], "action": row["action"], "label": row["label"]}
                    )
                return [{"module": module, "permissions": items} for module, items in groups.items()]

    except psycopg.Error as e:
        raise db_error_503(e)


@app.get("/admin/roles")
def get_admin_roles(request: Request):
    try:
        require_permission(request, "users.view")

        with get_connection() as conn:
            with conn.cursor() as cursor:
                return fetch_roles(cursor)

    except psycopg.Error as e:
        raise db_error_503(e)


@app.post("/admin/roles")
def create_role(body: RoleCreateBody, request: Request):
    try:
        admin = require_permission(request, "users.manage")
        require_super_admin_for_roles(admin)

        with get_connection() as conn:
            with conn.transaction():
                with conn.cursor() as cursor:
                    # Step 1: the code must be new and every permission must exist
                    cursor.execute("SELECT 1 FROM admin_roles WHERE role_code = %s", (body.role_code,))
                    if cursor.fetchone() is not None:
                        raise HTTPException(status_code=409, detail="This role code already exists.")
                    codes = check_permission_codes(cursor, body.permissions)

                    # Step 2: save the role (custom roles are staff roles) and its permissions
                    cursor.execute(
                        """
                        INSERT INTO admin_roles (role_code, role_name, description, is_system, is_staff)
                        VALUES (%s, %s, %s, false, true)
                        """,
                        (body.role_code, body.role_name, (body.description or "").strip() or None),
                    )
                    for code in codes:
                        cursor.execute(
                            "INSERT INTO admin_role_permissions (role_code, permission_code) VALUES (%s, %s)",
                            (body.role_code, code),
                        )

                    # Step 3: audit log (roles have a text key, so entity_id is 0 and the code is in the data)
                    role = fetch_roles(cursor, body.role_code)[0]
                    write_audit(
                        cursor, request, admin, "role_created", 0,
                        "Created role " + body.role_code,
                        {}, {"role_code": body.role_code, "role_name": role["role_name"],
                             "description": role["description"], "permissions": codes},
                        entity_type="role",
                    )
                    return role

    except psycopg.errors.UniqueViolation:
        raise HTTPException(status_code=409, detail="This role code already exists.")

    except psycopg.Error as e:
        raise db_error_503(e)


@app.put("/admin/roles/{role_code}")
def update_role(role_code: str, body: RoleUpdateBody, request: Request):
    try:
        admin = require_permission(request, "users.manage")
        require_super_admin_for_roles(admin)

        with get_connection() as conn:
            with conn.transaction():
                with conn.cursor() as cursor:
                    # Step 1: the role must exist and must not be a system role
                    cursor.execute(
                        "SELECT is_system FROM admin_roles WHERE role_code = %s FOR UPDATE",
                        (role_code,),
                    )
                    role = cursor.fetchone()
                    if role is None:
                        raise HTTPException(status_code=404, detail="Role not found")
                    if role["is_system"]:
                        raise HTTPException(status_code=400, detail="System roles cannot be edited.")

                    codes = check_permission_codes(cursor, body.permissions)
                    before = fetch_roles(cursor, role_code)[0]

                    # Step 2: new name and description, then replace the permission rows
                    cursor.execute(
                        """
                        UPDATE admin_roles
                        SET role_name = %s, description = %s, updated_at = now()
                        WHERE role_code = %s
                        """,
                        (body.role_name, (body.description or "").strip() or None, role_code),
                    )
                    cursor.execute("DELETE FROM admin_role_permissions WHERE role_code = %s", (role_code,))
                    for code in codes:
                        cursor.execute(
                            "INSERT INTO admin_role_permissions (role_code, permission_code) VALUES (%s, %s)",
                            (role_code, code),
                        )

                    # Step 3: audit log
                    after = fetch_roles(cursor, role_code)[0]
                    write_audit(
                        cursor, request, admin, "role_updated", 0,
                        "Updated role " + role_code,
                        {"role_code": role_code, "role_name": before["role_name"],
                         "description": before["description"], "permissions": before["permissions"]},
                        {"role_code": role_code, "role_name": after["role_name"],
                         "description": after["description"], "permissions": after["permissions"]},
                        entity_type="role",
                    )
                    return after

    except psycopg.Error as e:
        raise db_error_503(e)


@app.delete("/admin/roles/{role_code}")
def delete_role(role_code: str, request: Request):
    try:
        admin = require_permission(request, "users.manage")
        require_super_admin_for_roles(admin)

        with get_connection() as conn:
            with conn.transaction():
                with conn.cursor() as cursor:
                    # Step 1: the role must exist and must not be a system role
                    cursor.execute(
                        "SELECT is_system FROM admin_roles WHERE role_code = %s FOR UPDATE",
                        (role_code,),
                    )
                    role = cursor.fetchone()
                    if role is None:
                        raise HTTPException(status_code=404, detail="Role not found")
                    if role["is_system"]:
                        raise HTTPException(status_code=400, detail="System roles cannot be deleted.")

                    # Step 2: nobody may still have it
                    before = fetch_roles(cursor, role_code)[0]
                    if before["user_count"] > 0:
                        n = before["user_count"]
                        raise HTTPException(
                            status_code=400,
                            detail="Role is still assigned to " + str(n) + (" user" if n == 1 else " users"),
                        )

                    # Step 3: remove the old (revoked) assignments, then the role; its permission rows cascade
                    cursor.execute("DELETE FROM user_roles WHERE role_code = %s", (role_code,))
                    cursor.execute("DELETE FROM admin_roles WHERE role_code = %s", (role_code,))

                    # Step 4: audit log
                    write_audit(
                        cursor, request, admin, "role_deleted", 0,
                        "Deleted role " + role_code,
                        {"role_code": role_code, "role_name": before["role_name"],
                         "description": before["description"], "permissions": before["permissions"]},
                        {},
                        entity_type="role",
                    )
                    return {"message": "Role deleted"}

    except psycopg.Error as e:
        raise db_error_503(e)


@app.get("/admin/users")
def get_admin_users(request: Request, search: str | None = Query(default=None, max_length=100)):
    try:
        require_permission(request, "users.view")

        with get_connection() as conn:
            with conn.cursor() as cursor:
                return fetch_users(cursor, search=search)

    except psycopg.Error as e:
        raise db_error_503(e)


@app.post("/admin/users")
def create_admin_user(body: AdminUserCreateBody, request: Request):
    # Hash first (CPU work), before opening the database transaction
    password_hash = hash_password(body.password)

    try:
        admin = require_permission(request, "users.manage")

        with get_connection() as conn:
            with conn.transaction():
                with conn.cursor() as cursor:
                    # Step 1: only a Super Admin can create another Super Admin
                    role_codes = check_staff_roles(cursor, body.roles)
                    if "admin" in role_codes and not admin["is_super_admin"]:
                        raise HTTPException(status_code=400, detail=SUPER_ADMIN_ONLY)
                    # Everyone else may only give permissions they have themselves
                    check_can_give_roles(cursor, admin, role_codes)

                    # Step 2: the email must be new
                    cursor.execute("SELECT 1 FROM app_users WHERE lower(email) = %s", (body.email,))
                    if cursor.fetchone() is not None:
                        raise HTTPException(status_code=409, detail="This email is already registered.")

                    # Step 3: active user with the chosen roles
                    cursor.execute(
                        """
                        INSERT INTO app_users (full_name, email, password_hash, account_status)
                        VALUES (%s, %s, %s, 'active')
                        RETURNING user_id
                        """,
                        (body.full_name, body.email, password_hash),
                    )
                    user_id = cursor.fetchone()["user_id"]
                    for code in role_codes:
                        cursor.execute(
                            "INSERT INTO user_roles (user_id, role_code, assigned_by_user_id) VALUES (%s, %s, %s)",
                            (user_id, code, admin["user_id"]),
                        )

                    # Step 4: audit log (never the password)
                    write_audit(
                        cursor, request, admin, "admin_user_created", user_id,
                        "Created admin user " + body.email,
                        {}, {"email": body.email, "full_name": body.full_name, "roles": role_codes},
                        entity_type="user",
                    )
                    return fetch_users(cursor, user_id=user_id, staff_only=False)[0]

    except psycopg.errors.UniqueViolation:
        raise HTTPException(status_code=409, detail="This email is already registered.")

    except psycopg.Error as e:
        raise db_error_503(e)


@app.put("/admin/users/{user_id}/roles")
def set_user_roles(user_id: int, body: UserRolesBody, request: Request):
    try:
        admin = require_permission(request, "users.manage")

        with get_connection() as conn:
            with conn.transaction():
                with conn.cursor() as cursor:
                    lock_admin_role(cursor)

                    # Step 1: the user must exist
                    cursor.execute(
                        "SELECT user_id, account_status FROM app_users WHERE user_id = %s AND deleted_at IS NULL FOR UPDATE",
                        (user_id,),
                    )
                    target = cursor.fetchone()
                    if target is None:
                        raise HTTPException(status_code=404, detail="User not found")

                    # Only a Super Admin may change a Super Admin
                    check_not_super_admin_target(cursor, admin, user_id)

                    # Step 2: work out what changes (only staff roles are managed here)
                    wanted = check_staff_roles(cursor, body.roles)
                    cursor.execute(
                        """
                        SELECT ur.role_code
                        FROM user_roles ur
                        JOIN admin_roles r ON r.role_code = ur.role_code
                        WHERE ur.user_id = %s AND ur.revoked_at IS NULL AND r.is_staff = true
                        """,
                        (user_id,),
                    )
                    current = [row["role_code"] for row in cursor.fetchall()]
                    to_add = [code for code in wanted if code not in current]
                    to_remove = [code for code in current if code not in wanted]

                    # Step 3: safety rules
                    # Nobody changes their own roles; a Super Admin may only add roles to themselves
                    if user_id == admin["user_id"] and (to_add or to_remove):
                        if "admin" in to_remove:
                            raise HTTPException(status_code=400, detail="You cannot remove your own admin role.")
                        if not admin["is_super_admin"]:
                            raise HTTPException(status_code=403, detail=OWN_ROLES)
                        if to_remove:
                            raise HTTPException(status_code=403, detail=OWN_ROLES_REMOVE)
                    if ("admin" in to_add or "admin" in to_remove) and not admin["is_super_admin"]:
                        raise HTTPException(status_code=400, detail=SUPER_ADMIN_ONLY)
                    if "admin" in to_remove:
                        if target["account_status"] == "active" and count_other_active_admins(cursor, user_id) == 0:
                            raise HTTPException(status_code=400, detail=LAST_ADMIN)
                    # Everyone else may only give roles whose permissions they have themselves
                    check_can_give_roles(cursor, admin, to_add)

                    # Step 4: revoke removed roles, add new ones
                    if to_remove:
                        cursor.execute(
                            """
                            UPDATE user_roles
                            SET revoked_at = now()
                            WHERE user_id = %s AND role_code = ANY(%s) AND revoked_at IS NULL
                            """,
                            (user_id, to_remove),
                        )
                    for code in to_add:
                        cursor.execute(
                            "INSERT INTO user_roles (user_id, role_code, assigned_by_user_id) VALUES (%s, %s, %s)",
                            (user_id, code, admin["user_id"]),
                        )

                    # Step 5: audit log (only when something actually changed)
                    if to_add or to_remove:
                        write_audit(
                            cursor, request, admin, "user_roles_changed", user_id,
                            "Changed roles of user " + str(user_id),
                            {"roles": current}, {"roles": wanted},
                            entity_type="user",
                        )
                    return fetch_users(cursor, user_id=user_id, staff_only=False)[0]

    except psycopg.Error as e:
        raise db_error_503(e)


def change_account_status(request, user_id, disable):
    # Shared by /disable and /enable
    try:
        admin = require_permission(request, "users.manage")

        with get_connection() as conn:
            with conn.transaction():
                with conn.cursor() as cursor:
                    lock_admin_role(cursor)

                    # Step 1: the user must exist
                    cursor.execute(
                        "SELECT user_id, account_status FROM app_users WHERE user_id = %s AND deleted_at IS NULL FOR UPDATE",
                        (user_id,),
                    )
                    target = cursor.fetchone()
                    if target is None:
                        raise HTTPException(status_code=404, detail="User not found")
                    old_status = target["account_status"]

                    # Only a Super Admin may disable or enable a Super Admin
                    check_not_super_admin_target(cursor, admin, user_id)

                    if disable:
                        # Step 2: safety rules
                        if user_id == admin["user_id"]:
                            raise HTTPException(status_code=400, detail="You cannot disable your own account.")
                        if old_status == "closed":
                            raise HTTPException(status_code=400, detail="A closed account cannot be disabled.")
                        if (old_status == "active" and has_admin_role(cursor, user_id)
                                and count_other_active_admins(cursor, user_id) == 0):
                            raise HTTPException(status_code=400, detail=LAST_ADMIN)
                        new_status = "suspended"

                        # Step 3: log them out everywhere
                        cursor.execute(
                            """
                            UPDATE user_sessions
                            SET revoked_at = now(), updated_at = now()
                            WHERE user_id = %s AND revoked_at IS NULL
                            """,
                            (user_id,),
                        )
                    else:
                        if old_status not in ("suspended", "disabled"):
                            raise HTTPException(
                                status_code=400,
                                detail="Account status is " + old_status + ", so it cannot be enabled.",
                            )
                        new_status = "active"

                    # Step 4: save the status and write the audit log
                    cursor.execute(
                        "UPDATE app_users SET account_status = %s, updated_at = now() WHERE user_id = %s",
                        (new_status, user_id),
                    )
                    write_audit(
                        cursor, request, admin, "user_disabled" if disable else "user_enabled", user_id,
                        ("Disabled" if disable else "Enabled") + " user " + str(user_id),
                        {"account_status": old_status}, {"account_status": new_status},
                        entity_type="user",
                    )
                    return fetch_users(cursor, user_id=user_id, staff_only=False)[0]

    except psycopg.Error as e:
        raise db_error_503(e)


@app.post("/admin/users/{user_id}/disable")
def disable_user(user_id: int, request: Request):
    return change_account_status(request, user_id, True)


@app.post("/admin/users/{user_id}/enable")
def enable_user(user_id: int, request: Request):
    return change_account_status(request, user_id, False)


# ---------- Locations ----------

def clean_country_code(code):
    # "us" -> "US"; anything that is not 2 letters can never match a country
    code = code.strip().upper()
    return code if len(code) == 2 else None


@app.get("/locations/countries")
def get_countries():
    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT country_code AS code, country_name AS name, phone_code
                    FROM countries
                    WHERE is_shipping_enabled = true
                    ORDER BY display_order, country_name
                    """
                )
                return cursor.fetchall()

    except psycopg.Error as e:
        raise db_error_503(e)


@app.get("/locations/countries/{code}/states")
def get_country_states(code: str):
    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:
                # The country must be one we ship to
                cursor.execute(
                    "SELECT 1 FROM countries WHERE country_code = %s AND is_shipping_enabled = true",
                    (clean_country_code(code),),
                )
                if cursor.fetchone() is None:
                    raise HTTPException(status_code=404, detail="Country not found")

                cursor.execute(
                    """
                    SELECT state_id, state_code, state_name
                    FROM states
                    WHERE country_code = %s AND is_active = true
                    ORDER BY state_name
                    """,
                    (clean_country_code(code),),
                )
                return cursor.fetchall()

    except psycopg.Error as e:
        raise db_error_503(e)


@app.get("/locations/states/{state_id}/cities")
def get_state_cities(state_id: int):
    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:
                # The state must be active and in a country we ship to
                cursor.execute(
                    """
                    SELECT 1
                    FROM states s
                    JOIN countries c ON c.country_code = s.country_code
                    WHERE s.state_id = %s AND s.is_active = true AND c.is_shipping_enabled = true
                    """,
                    (state_id,),
                )
                if cursor.fetchone() is None:
                    raise HTTPException(status_code=404, detail="State not found")

                cursor.execute(
                    """
                    SELECT city_id, city_name
                    FROM cities
                    WHERE state_id = %s AND is_active = true
                    ORDER BY lower(city_name), city_id
                    """,
                    (state_id,),
                )
                return cursor.fetchall()

    except psycopg.Error as e:
        raise db_error_503(e)


def fetch_country_settings(cursor, country_code=None):
    # All countries (or one) with the number of active states loaded for them
    cursor.execute(
        """
        SELECT
            c.country_code AS code,
            c.country_name AS name,
            c.phone_code,
            c.is_shipping_enabled,
            c.display_order,
            (SELECT COUNT(*)::int FROM states s WHERE s.country_code = c.country_code AND s.is_active = true) AS states_count
        FROM countries c
        WHERE (%s::text IS NULL OR c.country_code = %s)
        ORDER BY c.display_order, c.country_name
        """,
        (country_code, country_code),
    )
    return cursor.fetchall()


@app.get("/admin/settings/countries")
def get_country_settings(request: Request):
    try:
        require_permission(request, "settings.view")

        with get_connection() as conn:
            with conn.cursor() as cursor:
                return fetch_country_settings(cursor)

    except psycopg.Error as e:
        raise db_error_503(e)


@app.put("/admin/settings/countries/{code}")
def set_country_shipping(code: str, body: CountrySettingBody, request: Request):
    try:
        admin = require_permission(request, "settings.manage")

        with get_connection() as conn:
            with conn.transaction():
                with conn.cursor() as cursor:
                    # Step 1: the country must exist
                    country_code = clean_country_code(code)
                    cursor.execute(
                        "SELECT is_shipping_enabled FROM countries WHERE country_code = %s FOR UPDATE",
                        (country_code,),
                    )
                    country = cursor.fetchone()
                    if country is None:
                        raise HTTPException(status_code=404, detail="Country not found")

                    # Step 2: a country without states cannot take orders
                    if body.is_shipping_enabled and fetch_country_settings(cursor, country_code)[0]["states_count"] == 0:
                        raise HTTPException(
                            status_code=400,
                            detail="Load states and cities for this country first",
                        )

                    # Step 3: save and write the audit log (entity_id 0, the code is in the data)
                    cursor.execute(
                        "UPDATE countries SET is_shipping_enabled = %s WHERE country_code = %s",
                        (body.is_shipping_enabled, country_code),
                    )
                    write_audit(
                        cursor, request, admin, "country_shipping_changed", 0,
                        ("Enabled" if body.is_shipping_enabled else "Disabled") + " shipping to " + country_code,
                        {"country_code": country_code, "is_shipping_enabled": country["is_shipping_enabled"]},
                        {"country_code": country_code, "is_shipping_enabled": body.is_shipping_enabled},
                        entity_type="country",
                    )
                    return fetch_country_settings(cursor, country_code)[0]

    except psycopg.Error as e:
        raise db_error_503(e)


def validate_shipping_address(cursor, address):
    # Checks the address against the location tables and replaces state/city with the proper names
    country_code = address["country_code"]

    cursor.execute(
        "SELECT country_name FROM countries WHERE country_code = %s AND is_shipping_enabled = true",
        (country_code,),
    )
    country = cursor.fetchone()
    if country is None:
        raise HTTPException(status_code=400, detail="Sorry, we do not ship to that country yet.")

    if not address["phone"].strip():
        raise HTTPException(status_code=400, detail="Please enter a phone number.")

    # State: matches the state code or the state name, ignoring case
    cursor.execute(
        """
        SELECT state_id, state_name
        FROM states
        WHERE country_code = %s AND is_active = true
          AND (lower(state_code) = lower(%s) OR lower(state_name) = lower(%s))
        ORDER BY state_id
        LIMIT 1
        """,
        (country_code, address["state_region"].strip(), address["state_region"].strip()),
    )
    state = cursor.fetchone()
    if state is None:
        raise HTTPException(
            status_code=400,
            detail="Please choose a valid state for " + country["country_name"] + ".",
        )

    # City: must exist in that state, ignoring case
    cursor.execute(
        """
        SELECT city_name
        FROM cities
        WHERE state_id = %s AND is_active = true AND lower(city_name) = lower(%s)
        LIMIT 1
        """,
        (state["state_id"], address["city"].strip()),
    )
    city = cursor.fetchone()
    if city is None:
        raise HTTPException(
            status_code=400,
            detail="Please choose a valid city for " + state["state_name"] + ".",
        )

    # US ZIP code format
    if country_code == "US" and not re.match(r"^\d{5}(-\d{4})?$", address["postal_code"].strip()):
        raise HTTPException(status_code=400, detail="Please enter a valid US ZIP code (12345 or 12345-6789).")

    # Save the proper names
    address["state_region"] = state["state_name"]
    address["city"] = city["city_name"]
    address["phone"] = address["phone"].strip()
    address["postal_code"] = address["postal_code"].strip()


# ---------- Admin: design management ----------

MAX_IMAGE_BYTES = 15 * 1024 * 1024
DESIGN_SORT_STATUSES = ["draft", "published", "hidden", "reported", "removed", "archived"]

# Allowed status moves: current status -> statuses it may move to
DESIGN_STATUS_MOVES = {
    "draft": ["published", "archived"],
    "published": ["hidden", "archived"],
    "hidden": ["published", "archived"],
    "reported": ["archived"],
    "removed": ["archived"],
}


class DesignPatchBody(BaseModel):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)] | None = None
    description: str | None = Field(default=None, max_length=2000)  # null clears it
    category_id: int | None = None
    tags: list[str] | None = Field(default=None, max_length=100)
    product_ids: list[int] | None = Field(default=None, max_length=100)


class DesignStatusBody(BaseModel):
    status: Literal["draft", "published", "hidden", "archived"]


class BulkDesignStatusBody(BaseModel):
    codes: list[uuid.UUID] = Field(min_length=1, max_length=100)
    status: Literal["draft", "published", "hidden", "archived"]


def read_image_upload(image):
    # Reads the upload (never more than the limit + 1 byte) and checks the size
    data = image.file.read(MAX_IMAGE_BYTES + 1)
    if not data:
        raise HTTPException(status_code=400, detail="The image file is empty.")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="The image is too large. The maximum size is 15 MB.")
    return data


def detect_image_type(data):
    # The type comes from the first bytes of the file, never from its name or the browser's content type
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png", "png", "transparent"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg", "jpg", "light"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp", "webp", "light"
    raise HTTPException(status_code=400, detail="Only PNG, JPEG or WEBP images are allowed.")


def write_image_file(data, ext):
    # Saves to media/designs/own/<random uuid>.<ext>; the uploaded file name is never used in the path
    folder = os.path.join(MEDIA_DIR, "designs", "own")
    os.makedirs(folder, exist_ok=True)
    name = uuid.uuid4().hex + "." + ext
    path = os.path.join(folder, name)
    with open(path, "xb") as f:  # "x" = fail instead of overwriting
        f.write(data)
    return path, "designs/own/" + name


def safe_original_name(filename, ext):
    # Only kept as information in the files table
    name = os.path.basename((filename or "").replace("\\", "/"))
    name = "".join(ch for ch in name if ch.isprintable()).strip()[:255]
    return name or "upload." + ext


def normalize_tags(items):
    # Trimmed, lower-cased, no duplicates; at most 15 tags of at most 40 characters
    tags = []
    for item in items:
        tag = " ".join(item.split()).lower()
        if tag and tag not in tags:
            tags.append(tag)
    if len(tags) > 15:
        raise HTTPException(status_code=400, detail="A design can have at most 15 tags.")
    for tag in tags:
        if len(tag) > 40:
            raise HTTPException(status_code=400, detail="Each tag can have at most 40 characters.")
    return tags


def parse_id_list(text):
    # "1, 2,3" -> [1, 2, 3]
    ids = []
    for part in (text or "").split(","):
        part = part.strip()
        if not part:
            continue
        if not part.isdigit() or len(part) > 12:
            raise HTTPException(status_code=400, detail="product_ids must be numbers separated by commas.")
        if int(part) not in ids:
            ids.append(int(part))
    return ids


def check_active_products(cursor, product_ids):
    # Every product must exist and be active
    if product_ids:
        cursor.execute(
            "SELECT product_id FROM products WHERE product_id = ANY(%s) AND product_status = 'active'",
            (product_ids,),
        )
        known = {row["product_id"] for row in cursor.fetchall()}
        unknown = [str(pid) for pid in product_ids if pid not in known]
        if unknown:
            raise HTTPException(status_code=400, detail="Unknown or inactive product: " + ", ".join(unknown))
    return product_ids


def all_active_product_ids(cursor):
    cursor.execute("SELECT product_id FROM products WHERE product_status = 'active' ORDER BY product_id")
    return [row["product_id"] for row in cursor.fetchall()]


def check_category_exists(cursor, category_id):
    cursor.execute("SELECT 1 FROM categories WHERE category_id = %s", (category_id,))
    if cursor.fetchone() is None:
        raise HTTPException(status_code=400, detail="Category not found.")


def front_print_area_id(cursor, product_id):
    # The product's 'front' print area; created when missing (same values as import_teepublic.py)
    cursor.execute(
        "SELECT print_area_id FROM product_print_areas WHERE product_id = %s AND area_code = 'front'",
        (product_id,),
    )
    row = cursor.fetchone()
    if row is not None:
        return row["print_area_id"]
    cursor.execute(
        """
        INSERT INTO product_print_areas
            (product_id, area_code, area_name, max_width_in, max_height_in, preview_x_percent, preview_y_percent)
        VALUES (%s, 'front', 'Front', 12, 16, 50, 40)
        RETURNING print_area_id
        """,
        (product_id,),
    )
    return cursor.fetchone()["print_area_id"]


def set_design_products(cursor, design_id, product_ids):
    # Exactly these products are enabled; the others are disabled, never deleted
    for product_id in product_ids:
        cursor.execute(
            """
            UPDATE design_product_settings
            SET is_enabled = true, updated_at = now()
            WHERE design_id = %s AND product_id = %s
            RETURNING design_product_setting_id
            """,
            (design_id, product_id),
        )
        if cursor.fetchone() is None:
            cursor.execute(
                """
                INSERT INTO design_product_settings
                    (design_id, product_id, print_area_id, is_enabled,
                     placement_x_percent, placement_y_percent, scale_percent, mockup_status)
                VALUES (%s, %s, %s, true, 50, 40, 80, 'pending')
                """,
                (design_id, product_id, front_print_area_id(cursor, product_id)),
            )
    cursor.execute(
        """
        UPDATE design_product_settings
        SET is_enabled = false, updated_at = now()
        WHERE design_id = %s AND is_enabled = true AND NOT (product_id = ANY(%s))
        """,
        (design_id, product_ids),
    )


def set_design_tags(cursor, design_id, tag_names):
    # Exactly these tags are linked; missing tags are created; usage_count is kept up to date
    wanted_ids = []
    for name in tag_names:
        cursor.execute("SELECT tag_id FROM tags WHERE lower(tag_name) = %s", (name,))
        row = cursor.fetchone()
        if row is None:
            cursor.execute("INSERT INTO tags (tag_name) VALUES (%s) RETURNING tag_id", (name,))
            row = cursor.fetchone()
        wanted_ids.append(row["tag_id"])

    cursor.execute("SELECT tag_id FROM design_tags WHERE design_id = %s", (design_id,))
    current_ids = [row["tag_id"] for row in cursor.fetchall()]

    for tag_id in current_ids:
        if tag_id not in wanted_ids:
            cursor.execute("DELETE FROM design_tags WHERE design_id = %s AND tag_id = %s", (design_id, tag_id))
            cursor.execute(
                "UPDATE tags SET usage_count = GREATEST(usage_count - 1, 0), updated_at = now() WHERE tag_id = %s",
                (tag_id,),
            )
    for tag_id in wanted_ids:
        if tag_id not in current_ids:
            cursor.execute(
                "INSERT INTO design_tags (design_id, tag_id, tag_source) VALUES (%s, %s, 'manual')",
                (design_id, tag_id),
            )
            cursor.execute(
                "UPDATE tags SET usage_count = usage_count + 1, updated_at = now() WHERE tag_id = %s",
                (tag_id,),
            )


def lock_design(cursor, code):
    # The design (not soft-deleted), locked until the transaction ends
    cursor.execute(
        """
        SELECT design_id, public_design_code, title, description, category_id, design_status,
               artwork_file_id, fingerprint_method, fingerprint_value
        FROM designs
        WHERE public_design_code = %s AND deleted_at IS NULL
        FOR UPDATE
        """,
        (code,),
    )
    design = cursor.fetchone()
    if design is None:
        raise HTTPException(status_code=404, detail="Design not found")
    return design


def check_not_duplicate_image(cursor, digest):
    cursor.execute("SELECT title FROM designs WHERE fingerprint_value = %s", (digest,))
    row = cursor.fetchone()
    if row is not None:
        raise HTTPException(
            status_code=409,
            detail="This image is already uploaded as design " + row["title"],
        )


def insert_file_row(cursor, admin, filename, storage_key, mime, size):
    cursor.execute(
        """
        INSERT INTO files (uploaded_by_user_id, file_kind, original_name, storage_key, mime_type, file_size_bytes)
        VALUES (%s, 'artwork', %s, %s, %s, %s)
        RETURNING file_id
        """,
        (admin["user_id"], safe_original_name(filename, storage_key.rsplit(".", 1)[-1]), storage_key, mime, size),
    )
    return cursor.fetchone()["file_id"]


def design_snapshot(cursor, design_id):
    # What the audit log stores about a design's editable data
    cursor.execute("SELECT title, description, category_id FROM designs WHERE design_id = %s", (design_id,))
    snapshot = dict(cursor.fetchone())
    cursor.execute(
        """
        SELECT t.tag_name FROM design_tags dt JOIN tags t ON t.tag_id = dt.tag_id
        WHERE dt.design_id = %s ORDER BY t.tag_name
        """,
        (design_id,),
    )
    snapshot["tags"] = [row["tag_name"] for row in cursor.fetchall()]
    cursor.execute(
        """
        SELECT s.product_id FROM design_product_settings s
        JOIN products p ON p.product_id = s.product_id
        WHERE s.design_id = %s AND s.is_enabled = true AND p.product_status = 'active'
        ORDER BY s.product_id
        """,
        (design_id,),
    )
    snapshot["product_ids"] = [row["product_id"] for row in cursor.fetchall()]
    return snapshot


def build_admin_design(cursor, code):
    cursor.execute(
        """
        SELECT
            d.design_id, d.public_design_code, d.title, d.description, d.content_rating,
            d.background_type, d.primary_color_hex, d.rights_status, d.design_status,
            d.source_platform, d.source_reference, d.fingerprint_method, d.fingerprint_value,
            d.first_published_at, d.last_published_at, d.created_at, d.updated_at,
            c.category_id, c.category_name, pc.category_id AS parent_id, pc.category_name AS parent_name,
            pf.storage_key AS preview_key,
            af.storage_key AS artwork_key, af.mime_type, af.file_size_bytes, af.original_name,
            u.full_name AS uploaded_by
        FROM designs d
        LEFT JOIN categories c ON c.category_id = d.category_id
        LEFT JOIN categories pc ON pc.category_id = c.parent_category_id
        LEFT JOIN files pf ON pf.file_id = d.preview_file_id
        LEFT JOIN files af ON af.file_id = d.artwork_file_id
        LEFT JOIN app_users u ON u.user_id = d.uploaded_by_user_id
        WHERE d.public_design_code = %s AND d.deleted_at IS NULL
        """,
        (code,),
    )
    d = cursor.fetchone()
    if d is None:
        raise HTTPException(status_code=404, detail="Design not found")

    cursor.execute(
        """
        SELECT t.tag_name FROM design_tags dt JOIN tags t ON t.tag_id = dt.tag_id
        WHERE dt.design_id = %s ORDER BY t.tag_name
        """,
        (d["design_id"],),
    )
    tags = [row["tag_name"] for row in cursor.fetchall()]

    # Every active product, with whether it is enabled for this design
    cursor.execute(
        """
        SELECT
            p.product_id, p.product_name, p.product_type,
            EXISTS (
                SELECT 1 FROM design_product_settings s
                WHERE s.design_id = %s AND s.product_id = p.product_id AND s.is_enabled = true
            ) AS is_enabled
        FROM products p
        WHERE p.product_status = 'active'
        ORDER BY p.product_id
        """,
        (d["design_id"],),
    )
    products = cursor.fetchall()

    cursor.execute("SELECT COUNT(*) AS n FROM order_items WHERE design_id = %s", (d["design_id"],))
    times_ordered = cursor.fetchone()["n"]

    return {
        "public_design_code": d["public_design_code"],
        "title": d["title"],
        "description": d["description"],
        "content_rating": d["content_rating"],
        "background_type": d["background_type"],
        "primary_color_hex": d["primary_color_hex"],
        "rights_status": d["rights_status"],
        "design_status": d["design_status"],
        "source_platform": d["source_platform"],
        "source_reference": d["source_reference"],
        "fingerprint_method": d["fingerprint_method"],
        "fingerprint_value": d["fingerprint_value"],
        "first_published_at": d["first_published_at"],
        "last_published_at": d["last_published_at"],
        "created_at": d["created_at"],
        "updated_at": d["updated_at"],
        "preview_url": "/media/" + d["preview_key"] if d["preview_key"] else None,
        "artwork_url": "/media/" + d["artwork_key"] if d["artwork_key"] else None,
        "image": {
            "mime_type": d["mime_type"],
            "file_size_bytes": d["file_size_bytes"],
            "original_name": d["original_name"],
        },
        "uploaded_by": d["uploaded_by"],
        "category": {
            "category_id": d["category_id"],
            "name": d["category_name"],
            "parent": (
                None if d["parent_id"] is None
                else {"category_id": d["parent_id"], "name": d["parent_name"]}
            ),
        },
        "tags": tags,
        "products": products,
        "times_ordered": times_ordered,
    }


def move_design_status(cursor, request, admin, design, new_status):
    # One status change with its rules and audit row; raises HTTPException when not allowed
    old_status = design["design_status"]
    if new_status not in DESIGN_STATUS_MOVES.get(old_status, []):
        raise HTTPException(status_code=400, detail="Cannot move from " + old_status + " to " + new_status)

    if new_status == "published":
        cursor.execute(
            """
            SELECT COUNT(*) AS n
            FROM design_product_settings s
            JOIN products p ON p.product_id = s.product_id
            WHERE s.design_id = %s AND s.is_enabled = true AND p.product_status = 'active'
            """,
            (design["design_id"],),
        )
        if cursor.fetchone()["n"] == 0:
            raise HTTPException(status_code=400, detail="Publishing needs at least one enabled product.")

    cursor.execute(
        """
        UPDATE designs
        SET design_status = %s,
            first_published_at = CASE WHEN %s THEN COALESCE(first_published_at, now()) ELSE first_published_at END,
            last_published_at = CASE WHEN %s THEN now() ELSE last_published_at END,
            updated_at = now()
        WHERE design_id = %s
        """,
        (new_status, new_status == "published", new_status == "published", design["design_id"]),
    )
    write_audit(
        cursor, request, admin, "design_status_changed", design["design_id"],
        "Design " + str(design["public_design_code"]) + " moved from " + old_status + " to " + new_status,
        {"design_status": old_status}, {"design_status": new_status},
        entity_type="design",
    )


@app.get("/admin/categories")
def get_admin_categories(request: Request):
    try:
        require_any_permission(request, ["designs.view", "catalog.view"])

        with get_connection() as conn:
            with conn.cursor() as cursor:
                # All categories, any status; interests (no parent) with their niches
                cursor.execute(
                    """
                    SELECT category_id, parent_category_id, category_name, category_slug, category_status
                    FROM categories
                    ORDER BY display_order, category_name, category_id
                    """
                )
                rows = cursor.fetchall()

                def node(row):
                    return {
                        "category_id": row["category_id"],
                        "name": row["category_name"],
                        "slug": row["category_slug"],
                        "status": row["category_status"],
                    }

                tree = []
                for row in rows:
                    if row["parent_category_id"] is None:
                        item = node(row)
                        item["niches"] = [
                            node(child) for child in rows
                            if child["parent_category_id"] == row["category_id"]
                        ]
                        tree.append(item)
                return tree

    except psycopg.Error as e:
        raise db_error_503(e)


# Shared by the admin design list and its total (fixed text, values are always %s)
ADMIN_DESIGNS_FROM_SQL = """
    FROM designs d
    LEFT JOIN categories c ON c.category_id = d.category_id
    LEFT JOIN files f ON f.file_id = d.preview_file_id
    WHERE d.deleted_at IS NULL
      AND (%s::text IS NULL OR d.design_status = %s)
      AND (%s::text IS NOT NULL OR %s::boolean OR d.design_status <> 'archived')
      AND (%s::bigint IS NULL OR d.category_id = %s OR c.parent_category_id = %s)
      AND (%s::text IS NULL OR d.title ILIKE %s)
      AND (%s::text IS NULL OR d.source_platform = %s)
"""


@app.get("/admin/designs")
def get_admin_designs(
    request: Request,
    status: Literal["draft", "published", "hidden", "reported", "removed", "archived"] | None = None,
    category_id: int | None = None,
    search: str | None = Query(default=None, max_length=100),
    source: Literal["own", "teepublic_demo"] | None = None,
    include_archived: bool = False,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    pattern = like_pattern(search)
    # Without a status filter, archived designs are left out unless include_archived is true
    filter_params = (
        status, status,
        status, include_archived,
        category_id, category_id, category_id,
        pattern, pattern,
        source, source,
    )

    try:
        require_permission(request, "designs.view")

        with get_connection() as conn:
            with conn.cursor() as cursor:
                # Step 1: one page, newest first
                cursor.execute(
                    """
                    SELECT
                        d.public_design_code,
                        d.title,
                        CASE WHEN f.storage_key IS NULL THEN NULL ELSE '/media/' || f.storage_key END AS preview_url,
                        c.category_name,
                        d.design_status,
                        d.source_platform,
                        (
                            SELECT COUNT(*)::int
                            FROM design_product_settings s
                            JOIN products p ON p.product_id = s.product_id
                            WHERE s.design_id = d.design_id AND s.is_enabled = true AND p.product_status = 'active'
                        ) AS enabled_products,
                        (SELECT COUNT(*)::int FROM order_items oi WHERE oi.design_id = d.design_id) AS times_ordered,
                        d.created_at,
                        d.first_published_at
                    """
                    + ADMIN_DESIGNS_FROM_SQL
                    + """
                    ORDER BY d.created_at DESC, d.design_id DESC
                    LIMIT %s OFFSET %s
                    """,
                    filter_params + (limit, offset),
                )
                items = cursor.fetchall()

                # Step 2: total matches, ignoring limit/offset
                cursor.execute("SELECT COUNT(*) AS total " + ADMIN_DESIGNS_FROM_SQL, filter_params)
                return {"items": items, "total": cursor.fetchone()["total"]}

    except psycopg.Error as e:
        raise db_error_503(e)


@app.post("/admin/designs/bulk-status")
def bulk_design_status(body: BulkDesignStatusBody, request: Request):
    try:
        admin = require_permission(request, "designs.manage")

        updated = 0
        skipped = []
        with get_connection() as conn:
            with conn.transaction():
                with conn.cursor() as cursor:
                    for code in dict.fromkeys(body.codes):  # no duplicates, same order
                        try:
                            # Each design in its own savepoint: a refused one changes nothing
                            with conn.transaction():
                                design = lock_design(cursor, code)
                                move_design_status(cursor, request, admin, design, body.status)
                            updated += 1
                        except HTTPException as e:
                            skipped.append({"code": str(code), "reason": e.detail})
        return {"updated": updated, "skipped": skipped}

    except psycopg.Error as e:
        raise db_error_503(e)


@app.get("/admin/designs/{code}")
def get_admin_design(code: uuid.UUID, request: Request):
    try:
        require_permission(request, "designs.view")

        with get_connection() as conn:
            with conn.cursor() as cursor:
                return build_admin_design(cursor, code)

    except psycopg.Error as e:
        raise db_error_503(e)


@app.post("/admin/designs")
def create_design(
    request: Request,
    image: UploadFile = File(...),
    title: str = Form(...),
    description: str | None = Form(None),
    category_id: int = Form(...),
    tags: str | None = Form(None),
    product_ids: str | None = Form(None),
    status: Literal["draft", "published"] = Form("draft"),
):
    saved_path = None
    committed = False
    try:
        admin = require_permission(request, "designs.manage")

        # Step 1: check everything that does not need the database
        title = title.strip()
        if not 1 <= len(title) <= 160:
            raise HTTPException(status_code=400, detail="The title must be 1 to 160 characters.")
        description = (description or "").strip() or None
        if description is not None and len(description) > 2000:
            raise HTTPException(status_code=400, detail="The description can have at most 2000 characters.")
        tag_names = normalize_tags((tags or "").split(","))
        wanted_products = parse_id_list(product_ids)

        data = read_image_upload(image)
        mime, ext, background = detect_image_type(data)
        digest = hashlib.sha256(data).hexdigest()

        with get_connection() as conn:
            # One transaction: everything is saved together or not at all
            with conn.transaction():
                with conn.cursor() as cursor:
                    # Step 2: checks that need the database (nothing is saved yet)
                    check_not_duplicate_image(cursor, digest)
                    check_category_exists(cursor, category_id)
                    products = check_active_products(cursor, wanted_products) or all_active_product_ids(cursor)
                    if status == "published" and not products:
                        raise HTTPException(status_code=400, detail="Publishing needs at least one enabled product.")

                    # Step 3: save the image file, then the rows
                    saved_path, storage_key = write_image_file(data, ext)
                    file_id = insert_file_row(cursor, admin, image.filename, storage_key, mime, len(data))
                    cursor.execute(
                        """
                        INSERT INTO designs
                            (uploaded_by_user_id, category_id, title, description,
                             artwork_file_id, preview_file_id, background_type, rights_status,
                             design_status, first_published_at, last_published_at,
                             source_platform, fingerprint_method, fingerprint_value)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, 'original', %s,
                                CASE WHEN %s THEN now() END, CASE WHEN %s THEN now() END,
                                'own', 'sha256', %s)
                        RETURNING design_id, public_design_code
                        """,
                        (
                            admin["user_id"], category_id, title, description,
                            file_id, file_id, background, status,
                            status == "published", status == "published", digest,
                        ),
                    )
                    design = cursor.fetchone()
                    set_design_tags(cursor, design["design_id"], tag_names)
                    set_design_products(cursor, design["design_id"], products)

                    # Step 4: audit log
                    write_audit(
                        cursor, request, admin, "design_created", design["design_id"],
                        "Created design " + title,
                        {},
                        {"title": title, "category_id": category_id, "design_status": status,
                         "tags": tag_names, "product_ids": products,
                         "storage_key": storage_key, "sha256": digest},
                        entity_type="design",
                    )
                    result = build_admin_design(cursor, design["public_design_code"])
        committed = True
        return result

    except psycopg.errors.UniqueViolation:
        # Two uploads of the same image at the same moment
        raise HTTPException(status_code=409, detail="This image is already uploaded.")

    except psycopg.Error as e:
        raise db_error_503(e)

    finally:
        # Anything failed after the file was saved: remove the file
        if saved_path and not committed and os.path.exists(saved_path):
            os.remove(saved_path)


@app.patch("/admin/designs/{code}")
def update_design(code: uuid.UUID, body: DesignPatchBody, request: Request):
    # Only what was sent changes (description: null clears it; the other fields ignore null)
    sent = {k for k in body.model_fields_set if k == "description" or getattr(body, k) is not None}
    if not sent:
        raise HTTPException(status_code=400, detail="Send at least one field to change.")

    try:
        admin = require_permission(request, "designs.manage")
        tag_names = normalize_tags(body.tags) if "tags" in sent else None
        description = (body.description or "").strip() or None
        if description is not None and len(description) > 2000:
            raise HTTPException(status_code=400, detail="The description can have at most 2000 characters.")

        with get_connection() as conn:
            with conn.transaction():
                with conn.cursor() as cursor:
                    design = lock_design(cursor, code)
                    before = design_snapshot(cursor, design["design_id"])

                    if "category_id" in sent:
                        check_category_exists(cursor, body.category_id)
                    products = None
                    if "product_ids" in sent:
                        products = check_active_products(cursor, list(dict.fromkeys(body.product_ids)))
                        if design["design_status"] == "published" and not products:
                            raise HTTPException(
                                status_code=400,
                                detail="A published design needs at least one enabled product.",
                            )

                    # Update only the fields that were sent
                    cursor.execute(
                        """
                        UPDATE designs
                        SET title = CASE WHEN %s THEN %s ELSE title END,
                            description = CASE WHEN %s THEN %s ELSE description END,
                            category_id = CASE WHEN %s THEN %s::bigint ELSE category_id END,
                            updated_at = now()
                        WHERE design_id = %s
                        """,
                        (
                            "title" in sent, body.title,
                            "description" in sent, description,
                            "category_id" in sent, body.category_id,
                            design["design_id"],
                        ),
                    )
                    if tag_names is not None:
                        set_design_tags(cursor, design["design_id"], tag_names)
                    if products is not None:
                        set_design_products(cursor, design["design_id"], products)

                    # Audit log: only the fields that changed
                    after = design_snapshot(cursor, design["design_id"])
                    changed = [k for k in after if after[k] != before[k]]
                    write_audit(
                        cursor, request, admin, "design_updated", design["design_id"],
                        "Updated design " + str(code),
                        {k: before[k] for k in changed}, {k: after[k] for k in changed},
                        entity_type="design",
                    )
                    return build_admin_design(cursor, code)

    except psycopg.Error as e:
        raise db_error_503(e)


@app.post("/admin/designs/{code}/image")
def replace_design_image(code: uuid.UUID, request: Request, image: UploadFile = File(...)):
    saved_path = None
    committed = False
    try:
        admin = require_permission(request, "designs.manage")

        data = read_image_upload(image)
        mime, ext, background = detect_image_type(data)
        digest = hashlib.sha256(data).hexdigest()

        with get_connection() as conn:
            with conn.transaction():
                with conn.cursor() as cursor:
                    design = lock_design(cursor, code)
                    check_not_duplicate_image(cursor, digest)

                    # Save the new file and point the design to it; the old file row stays (orders may use it)
                    saved_path, storage_key = write_image_file(data, ext)
                    file_id = insert_file_row(cursor, admin, image.filename, storage_key, mime, len(data))
                    cursor.execute(
                        """
                        UPDATE designs
                        SET artwork_file_id = %s, preview_file_id = %s, background_type = %s,
                            fingerprint_method = 'sha256', fingerprint_value = %s, updated_at = now()
                        WHERE design_id = %s
                        """,
                        (file_id, file_id, background, digest, design["design_id"]),
                    )
                    write_audit(
                        cursor, request, admin, "design_image_replaced", design["design_id"],
                        "Replaced the image of design " + str(code),
                        {"artwork_file_id": design["artwork_file_id"], "sha256": design["fingerprint_value"]},
                        {"artwork_file_id": file_id, "storage_key": storage_key, "sha256": digest},
                        entity_type="design",
                    )
                    result = build_admin_design(cursor, code)
        committed = True
        return result

    except psycopg.errors.UniqueViolation:
        raise HTTPException(status_code=409, detail="This image is already uploaded.")

    except psycopg.Error as e:
        raise db_error_503(e)

    finally:
        if saved_path and not committed and os.path.exists(saved_path):
            os.remove(saved_path)


@app.post("/admin/designs/{code}/status")
def change_design_status(code: uuid.UUID, body: DesignStatusBody, request: Request):
    try:
        admin = require_permission(request, "designs.manage")

        with get_connection() as conn:
            with conn.transaction():
                with conn.cursor() as cursor:
                    design = lock_design(cursor, code)
                    move_design_status(cursor, request, admin, design, body.status)
                    return build_admin_design(cursor, code)

    except psycopg.Error as e:
        raise db_error_503(e)
