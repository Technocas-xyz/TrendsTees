# PRINT&SELL — Usability and Motion Upgrade

This package keeps the customer storefront, customer account dashboard, and protected admin dashboard together in **one Next.js project**. Customer `/signup` and admin `/admin-signup` remain distinct, with the admin invitation requirement unchanged.

## What changed
- Sign-in and sign-up screens redesigned with responsive two-column layout and mobile single-column layout.
- Password reveal/hide, password-strength guidance, matching-password feedback, input labels, accessible error messages, disabled submission state and loading indicator.
- More visible focus indicators, subtle button/card hover movement, table row highlighting and a reduced-motion accessibility fallback.
- Account and admin screen content, storage logic and authentication implementation retained.

## Run on Windows
1. Extract ZIP.
2. Open the **nested `PRINTSELL_READY` folder** that contains `package.json` in VS Code.
3. Run `npm install` then `npm run dev`.
4. Open `/signup`, `/login`, `/admin-signup`, `/admin-login`, `/account`, `/admin`.

**Security:** Development-only authentication remains unchanged. Do not deploy publicly without production-grade authentication, database, rate limiting, verified payment integration, and security reviews.
