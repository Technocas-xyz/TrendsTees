
import os
import secrets
import string
import uuid
from contextlib import contextmanager
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Literal

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

load_dotenv()

app = FastAPI(title="TrendsTees API")

# Allow the Next.js dev server to call this API from the browser
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["*"],
)

# Serve design images from the media folder next to main.py (works from any start directory)
MEDIA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "media")
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
def create_checkout(body: CheckoutBody):
    # Address as plain JSON (country code in upper case)
    address = body.shipping_address.model_dump()
    address["country_code"] = address["country_code"].upper()

    try:
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

                    # Step 2: calculate the quote (also rejects an empty cart)
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
                            (cart_id, contact_email, guest_shipping_address_json,
                             shipping_method_code, shipping_amount,
                             estimated_delivery_start, estimated_delivery_end,
                             item_subtotal, discount_total, tax_total, checkout_total,
                             checkout_status, quote_expires_at, applied_discount_rule_id)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                                'ready', now() + interval '30 minutes', %s)
                        RETURNING checkout_session_id, quote_expires_at
                        """,
                        (
                            cart["cart_id"],
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
def place_order(checkout_session_id: int, body: PlaceOrderBody):
    try:
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
                                (order_public_code, checkout_session_id, contact_email,
                                 item_subtotal, discount_total, shipping_total, tax_total,
                                 order_total, order_status, payment_status,
                                 applied_discount_rule_id, applied_discount_type)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s,
                                    'payment_pending', 'unpaid', %s, %s)
                            ON CONFLICT (order_public_code) DO NOTHING
                            RETURNING order_id
                            """,
                            (
                                code,
                                checkout_session_id,
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


@app.get("/orders/track")
def track_order(
    code: str = Query(min_length=1, max_length=40),
    email: str = Query(min_length=1, max_length=320),
):
    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:
                # Step 1: the order code and email must both match
                cursor.execute(
                    """
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

                # Step 2: limited shipping info (name, city, country only)
                cursor.execute(
                    """
                    SELECT recipient_name, city, country_code
                    FROM order_addresses
                    WHERE order_id = %s AND address_type = 'shipping'
                    """,
                    (order["order_id"],),
                )
                shipping_address = cursor.fetchone()

                # Step 3: items from the snapshots saved at order time
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

                # Step 4: customer-visible status history, oldest first
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

    except psycopg.Error as e:
        print("DATABASE ERROR:", repr(e))
        raise HTTPException(
            status_code=503,
            detail="Database connection or query failed"
        )
