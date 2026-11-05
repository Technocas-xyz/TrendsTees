# PRINT&SELL — Integrated Customer + Admin Frontend

This is **one Next.js project** with a single `/login` page. Signed-in customers navigate to `/account`; authorized admins navigate to `/admin`. Public sign-up always creates customer accounts. `/admin-login` redirects to `/login`. The admin screens preserve the supplied purple-sidebar reference designs.

## Start locally

```powershell
npm install
npm run dev
```

Open http://localhost:3000 for the store, http://localhost:3000/signup for customer registration, http://localhost:3000/login for **both roles**. After signing in admins use `/admin` and customers `/account`.

To create a *local development* admin (not public signup):

```powershell
npm run create-admin
```

## Frontend routes

Store: `/`, `/designs`, `/animals-pets`, `/dog-designs`, `/designs/1`, `/designs/1/choose-product`, `/designs/1/customize`, `/wishlist`, `/cart`, `/checkout/shipping`, `/checkout/payment`, `/checkout/confirmation`, `/track-order`.

Customer dashboard: `/account`, `/account/orders`, `/account/wishlist`, `/account/addresses`, `/account/profile`, `/account/settings`.

Admin: `/admin`, `/admin/designs`, `/admin/interests`, `/admin/products`, `/admin/orders`, `/admin/discounts`, `/admin/customers`, `/admin/customer-requests`, `/admin/admin-users`, `/admin/upload-csv`, `/admin/review-csv`, `/admin/csv-validations`, `/admin/reports`, `/admin/settings`.

## Honest limitations

**Frontend-complete prototype, NOT a production-ready system.** The inherited basic authentication uses a local JSON file and HTTP-only session cookies only for development, not a production database or managed identity. Cart, wishlist, admin sample records and demo checkout may be stored in browser localStorage. Real checkout, tax/shipping quotes, live payment capture, server-side order processing, verified account recovery and persistent data integration are not connected. Admin UI is for local testing only. Do not publicly deploy this package as a live commerce store. Original product imagery remains placeholders per request.

No separate admin website; customer and admin run within the **same Next.js app**.
