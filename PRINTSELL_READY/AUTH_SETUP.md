# PRINT&SELL accounts (local development MVP)

## Run
Open the `PRINTSELL_READY` folder, the one containing this `package.json`:

```powershell
npm install
npm run create-admin
npm run dev
```

- Customer sign-up: http://localhost:3000/signup
- Customer login: http://localhost:3000/login
- Customer profile: http://localhost:3000/account
- Admin login: http://localhost:3000/admin-login
- Protected admin: http://localhost:3000/admin

`create-admin` requires an explicit local terminal step. Password input is visible, so keep your screen private. Ordinary `/signup` **never** gives admin permissions. Existing customer accounts cannot be promoted by public routes.

Authentication data is server-side in `data/auth.json` (ignored by git). Passwords are hashed using salted scrypt. Sessions are random tokens in HttpOnly cookies; only SHA-256 hashes of tokens are stored server side. The admin route is checked on the server on every navigation.

**Security scope:** this is a single-machine/local development auth MVP using a JSON file; it is **not production-ready**. It lacks database transactions, robust distributed rate limiting, email verification/password resets, full audit logs, admin lifecycle management and deployment-hardening. Don't publish this publicly until migrated to managed Postgres, a supported auth service and proper infrastructure. Customer cart/checkout and admin data remain separate demo/localStorage data and are not real customer orders.
