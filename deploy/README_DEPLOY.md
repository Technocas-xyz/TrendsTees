# TrendsTees - Deploy on an Ubuntu VPS

## Before you start
- Ubuntu 22.04 or 24.04 VPS (2 GB RAM or more), with SSH access.
- A domain (e.g. `shop.example.com`) whose DNS **A record** points to the server IP.
  Without a domain you can test on the IP, but logins need https on the live site.

## Install (first time)
```bash
ssh root@YOUR_SERVER_IP
curl -fsSL https://raw.githubusercontent.com/Technocas-xyz/TrendsTees/main/deploy/install.sh -o install.sh
sudo bash install.sh
```
It asks for: domain, repo/branch, first Super Admin email + password, and an email for SSL.
Then it installs everything, creates the database **automatically**, builds the site and starts it.

Open `https://YOUR_DOMAIN` (store) and `https://YOUR_DOMAIN/admin-login` (admin).

## Update (after pushing new code to `main`)
```bash
sudo bash /opt/trendstees/deploy/install.sh
```
New database changes in `backend/db/migrations/` run by themselves.

## How the database setup works
`backend/db_setup.py` runs every time the API starts (and once during install):
1. creates the database if it does not exist
2. runs new files from `backend/db/migrations/` (tables, rules, indexes)
3. runs new files from `backend/db/seeds/` (products, variants, discounts, interests, countries)
4. creates the first Super Admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD` if there is no admin
Applied files are remembered in the `schema_migrations` table, so nothing runs twice.

**Adding a database change later:** create the next numbered file, e.g.
`backend/db/migrations/0005_add_wishlist_notes.sql`. Never edit a file that already ran.

## Useful commands
| What | Command |
|---|---|
| API logs | `sudo journalctl -u trendstees-api -f` |
| Website logs | `sudo journalctl -u trendstees-web -f` |
| Restart | `sudo systemctl restart trendstees-api trendstees-web` |
| Run DB setup by hand | `cd /opt/trendstees/backend && sudo -u trendstees venv/bin/python db_setup.py` |
| Database backup | `sudo -u postgres pg_dump trendstees_db > backup_$(date +%F).sql` |

## Never on the live site
- TeePublic demo designs (`SEED_DEMO_DESIGNS=true`) - copyrighted, testing server only.
- Committing `backend/.env` or `backend/media/`.

Location data: dr5hn/countries-states-cities-database (ODbL).
