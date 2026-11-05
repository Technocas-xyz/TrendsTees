# PRINT&SELL + n8n Daily 100 Images

This folder is your **existing PRINT&SELL customer/admin project**, extended with an n8n workflow and a publicly viewable `/new-designs` gallery. Existing authentication and UI remain unchanged except that the New Arrivals navigation links to the new gallery.

## API

- `POST /api/design-images` — protected multipart upload; `Authorization: Bearer <AUTOMATION_UPLOAD_TOKEN>`, fields `file` (PNG/JPG/WebP under 10 MB), `title`, and `category`.
- `GET /api/design-images` — publicly list images.
- `GET /api/design-images/<id>` — serve a validated stored image.
- `GET /new-designs` — storefront gallery.

Setup instructions in `n8n/README_N8N_SETUP.md`. **No n8n automation has been activated on your PC**. Import the JSON and connect a source folder and token first. This is not a production-rated media pipeline or real purchasable catalog.
