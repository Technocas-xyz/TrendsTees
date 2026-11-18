# PRINT&SELL daily image upload automation

This is an **importable n8n workflow**, not an activated live automation. The image source is a local `/files/pending` folder mounted into **self-hosted n8n**. If you use n8n Cloud, you must replace the Read Incoming Images node with a supported cloud storage integration (Google Drive, S3, etc.).

## What it does

At **9 AM America/Los_Angeles** each day, n8n reads PNG/JPEG/WebP files in `/files/pending`, picks up to **100 not previously uploaded filenames** (alphabetical order), sends them as multipart uploads to the PRINT&SELL server, and records each successfully processed filename in n8n workflow static data. It does not generate artwork. It needs 100 *new* source images daily to actually upload 100. Failed uploads should not be marked completed; failed executions need review. Filename reuse will not be picked up, so keep source filenames unique. Server also deduplicates identical image bytes by SHA-256.

## Local setup

1. Extract ZIP. In `PRINTSELL_READY`, copy `.env.example` to `.env.local`, generate a **random 32-byte+ secret**, and replace `AUTOMATION_UPLOAD_TOKEN`. Never commit this file or share token.
2. `npm install` then `npm run dev` from the `PRINTSELL_READY` folder. Test `http://localhost:3000/new-designs` (empty until uploads).
3. Install/self-host n8n separately. Mount a folder of authorized image assets into its container at `/files/pending` (read-only preferred).
4. Set n8n environment variables: `PRINTSELL_UPLOAD_URL=http://host.docker.internal:3000/api/design-images` when n8n runs via Docker on Windows and Next.js runs on the host; use a public HTTPS URL only for remote deployments. Set `PRINTSELL_UPLOAD_TOKEN` equal to the website secret.
5. Import `n8n/PRINTSELL_DAILY_100_IMPORT.json` in n8n; confirm all node names and operations match your installed n8n version. Set time zone to your preference. **Test manually with 2-3 sample images first**, inspect the execution response, then enable workflow.
6. Check `http://localhost:3000/new-designs` for published images.

### Docker mount example

For Docker Compose n8n service:

```yaml
volumes:
  - C:/Users/ABC/Downloads/printsell-images:/files/pending:ro
```

Place images in `C:\Users\ABC\Downloads\printsell-images`. This is an illustration; adapt to your actual Docker Compose file.

### Important restrictions

- n8n environment access via `$env` can be restricted by your n8n installation; in that case configure the upload token securely in n8n credentials and update the header expression, rather than placing it in node literals.
- Some n8n versions/configurations restrict disk access or Code-node static workflow data. Validate workflow against your n8n version before enabling it. n8n workflow static data persists when workflow is active and executions occur via trigger, not reliably in manual testing.
- 100 per day is a **cap**. If fewer than 100 eligible files exist, fewer will be uploaded. If an upload fails, retry later and inspect n8n error logs.
- Image uploads appear in `/new-designs` gallery. **They are not automatically purchasable product listings**. Product pricing, mapping to variants, and approval require a separate workflow.
- This filesystem/JSON-index service is for **local/single-server prototyping**. For production, replace uploaded file storage with S3-compatible object storage, JSON metadata with PostgreSQL, and use managed secrets, rate limits, malware scanning, approval/moderation, monitoring, backups and per-image ownership/rights checks.
- Never upload images you don't own or have rights to use. Do not connect the public API without HTTPS and a strong secret.
