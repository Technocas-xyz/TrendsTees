"""
TrendsTees - TeePublic demo data import (LOCAL DEMO ONLY)

Kya karta hai:
  1. metadata_v2.json padhta hai (har design ka title, category, image file)
  2. images_v2 se images ko backend ke media/ folder mein copy karta hai
  3. Database mein daalta hai:
       categories  -> har source_category ek "interest" (Music, Anime, ...)
       files       -> har image ka record
       designs     -> design (source_platform = 'teepublic_demo')
       design_product_settings -> design ko T-Shirt aur Hoodie pe enable

Kaise chalana hai (backend folder mein, venv on karke):
  python import_teepublic.py "E:\\path\\to\\TeePublic"

Dobara chalao to koi duplicate nahi banega (pehle se imported designs skip).
Sab kuch ek transaction mein: beech mein error aaye to kuch save nahi hoga.
"""

import json
import os
import re
import shutil
import sys

import psycopg
from dotenv import load_dotenv

load_dotenv()

SOURCE = "teepublic_demo"
MEDIA_SUBFOLDER = os.path.join("designs", "teepublic")  # media/designs/teepublic/


def make_slug(text):
    """'Sci-Fi & Fantasy' -> 'sci-fi-fantasy'"""
    text = text.lower().replace("&", " ")
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def clean_title(name):
    """'Cat T-Shirt' -> 'Cat'  (product type hamara apna hai)"""
    title = re.sub(r"\s*T-?Shirt\s*$", "", name.strip(), flags=re.IGNORECASE)
    return (title or name.strip())[:160]


def get_or_create_interest(cur, name, order):
    """Top-level category (interest) dhoondo, na mile to bana do."""
    slug = make_slug(name)
    cur.execute(
        "SELECT category_id FROM categories WHERE lower(category_slug) = %s",
        (slug,),
    )
    row = cur.fetchone()
    if row:
        return row[0]
    cur.execute(
        """INSERT INTO categories
               (category_name, category_slug, description, display_order,
                category_status, is_trending)
           VALUES (%s, %s, %s, %s, 'active', true)
           RETURNING category_id""",
        (name, slug, f"{name} designs", order),
    )
    return cur.fetchone()[0]


def get_front_print_area(cur, product_id):
    """Product ka 'front' print area dhoondo, na ho to bana do."""
    cur.execute(
        "SELECT print_area_id FROM product_print_areas WHERE product_id = %s AND area_code = 'front'",
        (product_id,),
    )
    row = cur.fetchone()
    if row:
        return row[0]
    cur.execute(
        """INSERT INTO product_print_areas
               (product_id, area_code, area_name, max_width_in, max_height_in,
                preview_x_percent, preview_y_percent)
           VALUES (%s, 'front', 'Front', 12, 16, 50, 40)
           RETURNING print_area_id""",
        (product_id,),
    )
    return cur.fetchone()[0]


def main():
    # ---- Step 1: input folder check ----
    if len(sys.argv) != 2:
        print('Usage: python import_teepublic.py "E:\\path\\to\\TeePublic"')
        sys.exit(1)

    source_folder = sys.argv[1]
    metadata_file = os.path.join(source_folder, "metadata_v2.json")
    images_folder = os.path.join(source_folder, "images_v2")
    media_folder = os.path.join(os.path.dirname(os.path.abspath(__file__)), "media", MEDIA_SUBFOLDER)

    for path in (metadata_file, images_folder):
        if not os.path.exists(path):
            print("Not found:", path)
            sys.exit(1)

    with open(metadata_file, encoding="utf-8") as f:
        items = list(json.load(f).values())
    print(f"Designs in metadata: {len(items)}")

    os.makedirs(media_folder, exist_ok=True)

    added = skipped_existing = skipped_no_image = 0

    # ---- Step 2: database connection (same .env as main.py) ----
    with psycopg.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT", "5432"),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
    ) as conn:
        with conn.transaction():
            cur = conn.cursor()

            # Uploader = admin user (na mile to pehla user)
            cur.execute(
                """SELECT user_id FROM user_roles
                   WHERE role_code = 'admin' AND revoked_at IS NULL
                   ORDER BY user_id LIMIT 1"""
            )
            row = cur.fetchone()
            if row is None:
                cur.execute("SELECT min(user_id) FROM app_users")
                row = cur.fetchone()
            if row is None or row[0] is None:
                print("No user found in app_users. Create an admin user first.")
                sys.exit(1)
            uploader_id = row[0]

            # Active products (T-Shirt, Hoodie) + un ka front print area
            cur.execute("SELECT product_id FROM products WHERE product_status = 'active' ORDER BY product_id")
            products = [(pid, get_front_print_area(cur, pid)) for (pid,) in cur.fetchall()]
            print(f"Active products to enable: {len(products)}")

            # Interests: har source_category ke liye ek
            category_names = sorted({i["source_category"] for i in items})
            category_ids = {
                name: get_or_create_interest(cur, name, order)
                for order, name in enumerate(category_names, start=1)
            }

            # ---- Step 3: har design ----
            for item in items:
                reference = str(item["design_id"])

                # Pehle se imported? skip
                cur.execute(
                    "SELECT 1 FROM designs WHERE source_platform = %s AND source_reference = %s",
                    (SOURCE, reference),
                )
                if cur.fetchone():
                    skipped_existing += 1
                    continue

                # Image hai? copy karo
                image_name = item["local_file"]
                image_path = os.path.join(images_folder, image_name)
                if not os.path.isfile(image_path):
                    skipped_no_image += 1
                    continue
                shutil.copy2(image_path, os.path.join(media_folder, image_name))

                # files table: image ka record
                storage_key = f"designs/teepublic/{image_name}"
                cur.execute(
                    """INSERT INTO files
                           (uploaded_by_user_id, file_kind, original_name, storage_key,
                            mime_type, file_size_bytes, scan_status)
                       VALUES (%s, 'artwork', %s, %s, 'image/jpeg', %s, 'clean')
                       ON CONFLICT (storage_key) DO UPDATE SET updated_at = now()
                       RETURNING file_id""",
                    (uploader_id, image_name, storage_key, os.path.getsize(image_path)),
                )
                file_id = cur.fetchone()[0]

                # designs table
                cur.execute(
                    """INSERT INTO designs
                           (uploaded_by_user_id, category_id, title, artwork_file_id,
                            preview_file_id, background_type, rights_status,
                            design_status, first_published_at, last_published_at,
                            source_platform, source_reference)
                       VALUES (%s, %s, %s, %s, %s, 'dark', 'unclear',
                               'published', now(), now(), %s, %s)
                       RETURNING design_id""",
                    (
                        uploader_id,
                        category_ids[item["source_category"]],
                        clean_title(item["product_name"]),
                        file_id,
                        file_id,
                        SOURCE,
                        reference,
                    ),
                )
                design_id = cur.fetchone()[0]

                # Har active product pe enable
                for product_id, print_area_id in products:
                    cur.execute(
                        """INSERT INTO design_product_settings
                               (design_id, product_id, print_area_id, is_enabled,
                                placement_x_percent, placement_y_percent, scale_percent,
                                mockup_status)
                           VALUES (%s, %s, %s, true, 50, 40, 80, 'pending')""",
                        (design_id, product_id, print_area_id),
                    )

                added += 1

    print(f"Added: {added} | Already imported: {skipped_existing} | Image missing: {skipped_no_image}")
    print(f"Images copied to: {media_folder}")


if __name__ == "__main__":
    main()
