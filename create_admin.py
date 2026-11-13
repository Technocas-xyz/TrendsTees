"""Create an admin account, or give an existing user the admin role.

Run it by hand from this folder, with the virtual environment's Python:
    python create_admin.py

It uses the same .env database settings and the same password hashing as main.py.
"""
import getpass
import re

import main  # loads .env and gives us hash_password and get_connection


def ask_password():
    # 12-128 characters, typed twice (nothing is shown on screen)
    while True:
        password = getpass.getpass("Password (12-128 characters): ")
        if not 12 <= len(password) <= 128:
            print("The password must be 12 to 128 characters long.")
            continue
        if getpass.getpass("Repeat the password: ") != password:
            print("The passwords do not match. Try again.")
            continue
        return password


def run():
    email = input("Email: ").strip().lower()
    if len(email) > 320 or not re.match(main.EMAIL_PATTERN, email):
        raise SystemExit("That does not look like an email address.")

    # Step 1: does a user with this email already exist?
    with main.get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT user_id, password_hash, account_status, deleted_at
                FROM app_users
                WHERE lower(email) = %s
                """,
                (email,),
            )
            user = cursor.fetchone()

    if user is not None and user["deleted_at"] is not None:
        raise SystemExit("That account was deleted. Use a different email.")

    # Step 2: ask only for what is needed
    full_name = None
    password_hash = None
    if user is None:
        full_name = input("Full name: ").strip()
        if not 1 <= len(full_name) <= 150:
            raise SystemExit("The name must be 1 to 150 characters long.")
        password_hash = hash_new_password()
    else:
        print("This email already has an account; it will get the admin role.")
        # A placeholder hash can never log in, so such an account needs a real password
        if not user["password_hash"].startswith("scrypt$"):
            print("This account has no usable password yet, so set one now.")
            password_hash = hash_new_password()

    # Step 3: save everything in one transaction
    with main.get_connection() as conn:
        with conn.transaction():
            with conn.cursor() as cursor:
                if user is None:
                    cursor.execute(
                        """
                        INSERT INTO app_users (full_name, email, password_hash, account_status)
                        VALUES (%s, %s, %s, 'active')
                        RETURNING user_id
                        """,
                        (full_name, email, password_hash),
                    )
                    user_id = cursor.fetchone()["user_id"]
                else:
                    user_id = user["user_id"]
                    if password_hash is not None:
                        cursor.execute(
                            "UPDATE app_users SET password_hash = %s, updated_at = now() WHERE user_id = %s",
                            (password_hash, user_id),
                        )

                # Add the admin role unless the user already has an active one
                if not main.has_admin_role(cursor, user_id):
                    cursor.execute(
                        "INSERT INTO user_roles (user_id, role_code) VALUES (%s, 'admin')",
                        (user_id,),
                    )

    if user is not None and user["account_status"] != "active":
        print("Warning: the account status is '" + user["account_status"] + "'. It must be 'active' to log in.")
    print("Admin ready: " + email)


def hash_new_password():
    return main.hash_password(ask_password())


if __name__ == "__main__":
    run()
