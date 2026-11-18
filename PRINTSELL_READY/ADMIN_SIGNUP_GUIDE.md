# Separate customer and admin registration (local development)

Customer: `/signup` → `/login` → `/account`.

Admin: `/admin-signup` → `/admin-login` → `/admin`. The admin signup requires a single-use invitation.

1. `npm install`
2. `npm run create-admin` — provision the **first** admin locally.
3. `npm run create-admin-invite` — issue a one-time invite, valid for 24 hours. Run only from the trusted owner terminal. This command requires that an admin exists, **but it does not authenticate the terminal operator**.
4. `npm run dev`
5. Open `/admin-signup` and provide name, email, password and private invite code.

Never disclose admin invitation codes publicly. Public `/signup` **always** creates `customer` role. The protected `/admin` layout checks user role server side.

**Not production ready:** file-based JSON records and sessions, local invite generation and missing MFA, email verification, rate limiting on signup, multi-instance concurrency, audit logs and secure managed secret distribution require production replacement with a database-backed identity provider.
