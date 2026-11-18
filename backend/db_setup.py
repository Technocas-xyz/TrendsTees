"""
TrendsTees - database setup (auto-migration)

Kya karta hai (har baar safe hai, dobara chalao to kuch duplicate nahi banta):
  1. Database na ho to bana deta hai (CREATE DATABASE)
  2. db/migrations/*.sql  -> tables, rules, indexes   (sirf jo abhi tak nahi chali)
  3. db/seeds/*.sql       -> zaroori data: products, variants, discounts, interests
  4. Pehla Super Admin banata hai (ADMIN_EMAIL + ADMIN_PASSWORD .env mein hon,
     aur abhi tak koi admin na ho)
  5. SEED_DEMO_DESIGNS=true ho to TeePublic demo designs import karta hai
     (SIRF testing server ke liye - live site pe kabhi nahi)

Kaise chalta hai:
  - main.py start hote waqt khud chalata hai (AUTO_DB_SETUP=true)
  - ya haath se:  python db_setup.py

Kaunsi file chal chuki hai, yeh "schema_migrations" table yaad rakhta hai.
"""

import glob
import hashlib
import os
import secrets
import subprocess
import sys

import psycopg
from psycopg import sql
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MIGRATIONS_DIR = os.path.join(BASE_DIR, "db", "migrations")
SEEDS_DIR = os.path.join(BASE_DIR, "db", "seeds")
LOCK_ID = 774411  # advisory lock: do server ek saath start hon to bhi migration ek hi baar chale


def log(message):
    print(f"[db_setup] {message}", flush=True)


def db_settings(dbname=None):
    return dict(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
        dbname=dbname or os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        connect_timeout=10,
    )


# ---------- Step 1: database ----------

def ensure_database():
    """Database na ho to banao. Iske liye DB_USER ke paas CREATEDB permission chahiye."""
    name = os.getenv("DB_NAME")
    try:
        psycopg.connect(**db_settings()).close()
        return
    except psycopg.OperationalError as e:
        if "does not exist" not in str(e):
            raise  # galat password / server band - asal error dikhao

    log(f"Database '{name}' not found, creating it...")
    with psycopg.connect(**db_settings("postgres"), autocommit=True) as conn:
        conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))
    log(f"Database '{name}' created.")


# ---------- Step 2 + 3: migrations and seeds ----------

def read_sql(path):
    # Files apna BEGIN/COMMIT nahi rakhti; har file hum khud ek transaction mein chalate hain
    with open(path, encoding="utf-8") as f:
        return f.read()


def checksum(path):
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def adopt_existing_database(cur):
    """
    Purana database (jo SQL files haath se chala ke bana tha) pehli baar is system pe aaye,
    to jo cheez pehle se hai us ki file 'applied' mark kar do - dobara chalane se error aata.
    """
    def table_exists(name):
        cur.execute("SELECT to_regclass(%s) IS NOT NULL", ("public." + name,))
        return cur.fetchone()[0]

    def has_rows(name):
        # Pehle table check, phir rows (khaali naye database pe table hi nahi hoti)
        if not table_exists(name):
            return False
        cur.execute(sql.SQL("SELECT EXISTS (SELECT 1 FROM {})").format(sql.Identifier(name)))
        return cur.fetchone()[0]

    def has_column(table, column):
        cur.execute("""SELECT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema = 'public' AND table_name = %s AND column_name = %s)""",
                    (table, column))
        return cur.fetchone()[0]

    if not table_exists("app_users"):
        return  # bilkul naya database - adopt karne ko kuch nahi

    checks = {
        "0000_base_schema.sql": True,
        "0001_constraints_indexes_discounts.sql": table_exists("discount_rules"),
        "0002_demo_design_source.sql": has_column("designs", "source_platform"),
        "0003_locations.sql": table_exists("countries"),
        "0004_roles_permissions.sql": table_exists("admin_roles"),
        "0100_products.sql": has_rows("products"),
        "0101_variants.sql": has_rows("product_variants"),
        "0102_discount_rules.sql": has_rows("discount_rules"),
        "0103_interests.sql": has_rows("categories"),
    }
    for filename, present in checks.items():
        if present:
            cur.execute(
                "INSERT INTO schema_migrations (filename, checksum, note) VALUES (%s, '', 'already present') "
                "ON CONFLICT DO NOTHING",
                (filename,),
            )
            log(f"Already present, marked as applied: {filename}")


def apply_files(conn, folder):
    applied_now = 0
    for path in sorted(glob.glob(os.path.join(folder, "*.sql"))):
        filename = os.path.basename(path)
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM schema_migrations WHERE filename = %s", (filename,))
            if cur.fetchone():
                continue

        log(f"Applying {filename} ...")
        # Poori file + uska record ek transaction mein: beech mein error = kuch save nahi
        with conn.transaction():
            with conn.cursor() as cur:
                cur.execute(read_sql(path))
                cur.execute("SET search_path TO public")  # base dump search_path khaali kar deta hai
                cur.execute(
                    "INSERT INTO schema_migrations (filename, checksum) VALUES (%s, %s)",
                    (filename, checksum(path)),
                )
        applied_now += 1
    return applied_now


# ---------- Step 4: first Super Admin ----------

def hash_password(password):
    # main.py jaisa hi format: "scrypt$<salt_hex>$<hash_hex>"
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=16384, r=8, p=1, dklen=64)
    return "scrypt$" + salt.hex() + "$" + digest.hex()


def ensure_first_admin(conn):
    email = (os.getenv("ADMIN_EMAIL") or "").strip().lower()
    password = os.getenv("ADMIN_PASSWORD") or ""
    name = os.getenv("ADMIN_NAME") or "Super Admin"

    with conn.transaction(), conn.cursor() as cur:
        cur.execute("""SELECT 1 FROM user_roles ur JOIN app_users u ON u.user_id = ur.user_id
                       WHERE ur.role_code = 'admin' AND ur.revoked_at IS NULL
                         AND u.account_status = 'active' AND u.password_hash LIKE 'scrypt$%'""")
        if cur.fetchone():
            return  # admin pehle se hai - kuch mat karo
        if not email or len(password) < 12:
            log("WARNING: no Super Admin yet. Set ADMIN_EMAIL and ADMIN_PASSWORD (12+ chars) "
                "in .env and restart, or run: python create_admin.py")
            return

        cur.execute("SELECT user_id FROM app_users WHERE lower(email) = %s", (email,))
        row = cur.fetchone()
        if row:
            user_id = row[0]
            cur.execute("UPDATE app_users SET password_hash = %s, account_status = 'active', updated_at = now() "
                        "WHERE user_id = %s", (hash_password(password), user_id))
        else:
            cur.execute("""INSERT INTO app_users (full_name, email, password_hash, account_status)
                           VALUES (%s, %s, %s, 'active') RETURNING user_id""",
                        (name, email, hash_password(password)))
            user_id = cur.fetchone()[0]
        cur.execute("INSERT INTO user_roles (user_id, role_code) VALUES (%s, 'admin') ON CONFLICT DO NOTHING",
                    (user_id,))
    log(f"Super Admin ready: {email}  (remove ADMIN_PASSWORD from .env now)")


# ---------- Step 5: optional demo designs ----------

def maybe_import_demo_designs(conn):
    if os.getenv("SEED_DEMO_DESIGNS", "false").lower() != "true":
        return
    folder = os.getenv("DEMO_DESIGNS_PATH", "")
    with conn.cursor() as cur:
        cur.execute("SELECT count(*) FROM designs WHERE source_platform = 'teepublic_demo'")
        if cur.fetchone()[0] > 0:
            return
    if not os.path.isdir(folder):
        log(f"WARNING: SEED_DEMO_DESIGNS=true but DEMO_DESIGNS_PATH '{folder}' not found. Skipped.")
        return
    log("Importing TeePublic DEMO designs (testing server only!) ...")
    subprocess.run([sys.executable, os.path.join(BASE_DIR, "import_teepublic.py"), folder], check=True)


# ---------- main ----------

def run():
    load_dotenv(os.path.join(BASE_DIR, ".env"))
    for key in ("DB_NAME", "DB_USER", "DB_PASSWORD"):
        if not os.getenv(key):
            raise RuntimeError(f"{key} is missing in .env")

    ensure_database()

    with psycopg.connect(**db_settings()) as conn:
        conn.execute("SELECT pg_advisory_lock(%s)", (LOCK_ID,))
        try:
            with conn.transaction():
                conn.execute("""CREATE TABLE IF NOT EXISTS schema_migrations (
                                    filename   varchar(200) PRIMARY KEY,
                                    checksum   varchar(64)  NOT NULL,
                                    note       varchar(100),
                                    applied_at timestamptz  NOT NULL DEFAULT now())""")
                count = conn.execute("SELECT count(*) FROM schema_migrations").fetchone()[0]
                if count == 0:
                    adopt_existing_database(conn.cursor())

            migrations = apply_files(conn, MIGRATIONS_DIR)
            seeds = apply_files(conn, SEEDS_DIR)
            ensure_first_admin(conn)
            maybe_import_demo_designs(conn)
        finally:
            conn.execute("SELECT pg_advisory_unlock(%s)", (LOCK_ID,))

    log(f"Done. New migrations: {migrations}, new seeds: {seeds}. Database is ready.")


if __name__ == "__main__":
    run()
