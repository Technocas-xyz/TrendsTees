#!/usr/bin/env bash
# =====================================================================
# TrendsTees - one-command install / update for Ubuntu 22.04 / 24.04
#
#   sudo bash install.sh
#
# Pehli baar: sab install karta hai (PostgreSQL 17, Python, Node 22,
#   Nginx, SSL), database user banata hai, code laata hai, build karta
#   hai aur website chalu kar deta hai.
# Dobara chalao: naya code (git pull) le ke build + restart karta hai.
#   Database ki tables khud update ho jati hain (db_setup.py).
#
# Website:  https://DOMAIN        -> Next.js (port 3000)
# API:      https://DOMAIN/api/   -> FastAPI (port 8000)
# =====================================================================
set -euo pipefail

APP_DIR=/opt/trendstees
APP_USER=trendstees
REPO_URL_DEFAULT=https://github.com/Technocas-xyz/TrendsTees.git
CONF_FILE=/etc/trendstees/install.conf

log()  { echo -e "\n\033[1;32m==> $*\033[0m"; }
warn() { echo -e "\033[1;33m[warning] $*\033[0m"; }
die()  { echo -e "\033[1;31m[error] $*\033[0m"; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Run with sudo: sudo bash install.sh"
. /etc/os-release
[ "${ID:-}" = "ubuntu" ] || die "This script supports Ubuntu only."

# ---------- 1. Settings (pehli baar poochta hai, phir yaad rakhta hai) ----------
mkdir -p /etc/trendstees && chmod 700 /etc/trendstees
if [ -f "$CONF_FILE" ]; then
  # shellcheck disable=SC1090
  . "$CONF_FILE"
  log "Using saved settings for $DOMAIN (edit $CONF_FILE to change)"
else
  read -rp "Domain (e.g. shop.example.com) or server IP: " DOMAIN
  read -rp "Git repo URL [$REPO_URL_DEFAULT]: " REPO_URL; REPO_URL=${REPO_URL:-$REPO_URL_DEFAULT}
  read -rp "Git branch [main]: " BRANCH; BRANCH=${BRANCH:-main}
  read -rp "First Super Admin email: " ADMIN_EMAIL
  while true; do
    read -rsp "Super Admin password (12+ chars): " ADMIN_PASSWORD; echo
    [ ${#ADMIN_PASSWORD} -ge 12 ] && break; echo "Too short."
  done
  read -rp "Email for SSL certificate notices (blank = skip SSL): " SSL_EMAIL
  DB_PASSWORD=$(openssl rand -hex 24)
  cat > "$CONF_FILE" <<EOF
DOMAIN='$DOMAIN'
REPO_URL='$REPO_URL'
BRANCH='$BRANCH'
SSL_EMAIL='$SSL_EMAIL'
DB_PASSWORD='$DB_PASSWORD'
EOF
  chmod 600 "$CONF_FILE"
fi

# Domain hai ya sirf IP? (IP pe SSL nahi milta, to cookie "secure" off rakhni padti hai)
if [[ "$DOMAIN" =~ ^[0-9.]+$ ]] || [ -z "${SSL_EMAIL:-}" ]; then USE_SSL=false; SCHEME=http; else USE_SSL=true; SCHEME=https; fi
SITE_URL="$SCHEME://$DOMAIN"

# ---------- 2. System packages ----------
log "Installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl ca-certificates gnupg git nginx python3 python3-venv python3-pip openssl ufw

if ! command -v psql >/dev/null || ! psql --version | grep -qE " (1[5-9]|[2-9][0-9])\."; then
  log "Installing PostgreSQL 17 (official repo)"
  install -d /usr/share/postgresql-common/pgdg
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
  echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt ${VERSION_CODENAME}-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list
  apt-get update -y && apt-get install -y postgresql-17
fi
systemctl enable --now postgresql

if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  log "Installing Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

# ---------- 3. App user + code ----------
id "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"
if [ -d "$APP_DIR/.git" ]; then
  log "Updating code ($BRANCH)"
  sudo -u "$APP_USER" git -C "$APP_DIR" fetch origin "$BRANCH"
  sudo -u "$APP_USER" git -C "$APP_DIR" checkout "$BRANCH"
  sudo -u "$APP_USER" git -C "$APP_DIR" pull --ff-only origin "$BRANCH"
else
  log "Downloading code"
  install -d -o "$APP_USER" -g "$APP_USER" "$APP_DIR"
  sudo -u "$APP_USER" git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

# ---------- 4. Database user (database khud db_setup.py banayega) ----------
log "Preparing PostgreSQL user"
sudo -u postgres psql -v ON_ERROR_STOP=1 -q <<SQL
DO \$\$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'trendstees') THEN
    CREATE ROLE trendstees LOGIN CREATEDB PASSWORD '$DB_PASSWORD';
  ELSE
    ALTER ROLE trendstees WITH LOGIN CREATEDB PASSWORD '$DB_PASSWORD';
  END IF;
END\$\$;
SQL

# ---------- 5. Backend ----------
log "Setting up backend"
BE="$APP_DIR/backend"
if [ ! -f "$BE/.env" ]; then
  cat > "$BE/.env" <<EOF
DB_HOST=localhost
DB_PORT=5432
DB_NAME=trendstees_db
DB_USER=trendstees
DB_PASSWORD=$DB_PASSWORD
FRONTEND_ORIGINS=$SITE_URL
COOKIE_SECURE=$USE_SSL
AUTO_DB_SETUP=true
ADMIN_NAME=Super Admin
ADMIN_EMAIL=${ADMIN_EMAIL:-}
ADMIN_PASSWORD=${ADMIN_PASSWORD:-}
# TeePublic demo designs: ONLY on a private testing server, never on the live site
SEED_DEMO_DESIGNS=false
DEMO_DESIGNS_PATH=
EOF
fi
chown "$APP_USER:$APP_USER" "$BE/.env" && chmod 600 "$BE/.env"
install -d -o "$APP_USER" -g "$APP_USER" "$BE/media"
sudo -u "$APP_USER" python3 -m venv "$BE/venv"
sudo -u "$APP_USER" "$BE/venv/bin/pip" install -q --upgrade pip
sudo -u "$APP_USER" "$BE/venv/bin/pip" install -q -r "$BE/requirements.txt"

log "Creating / updating database"
sudo -u "$APP_USER" bash -c "cd '$BE' && venv/bin/python db_setup.py"
# Admin ban gaya, ab password .env mein rakhne ki zaroorat nahi
sed -i 's/^ADMIN_PASSWORD=.*/ADMIN_PASSWORD=/' "$BE/.env"

# ---------- 6. Frontend ----------
log "Building frontend"
FE="$APP_DIR/PRINTSELL_READY"
echo "NEXT_PUBLIC_API_URL=$SITE_URL/api" > "$FE/.env.production"
chown "$APP_USER:$APP_USER" "$FE/.env.production"
sudo -u "$APP_USER" bash -c "cd '$FE' && npm ci --no-audit --no-fund && npm run build"

# ---------- 7. Services (server restart pe khud chalu ho jayenge) ----------
log "Installing services"
cat > /etc/systemd/system/trendstees-api.service <<EOF
[Unit]
Description=TrendsTees API (FastAPI)
After=network.target postgresql.service

[Service]
User=$APP_USER
WorkingDirectory=$BE
ExecStart=$BE/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --root-path /api --proxy-headers --forwarded-allow-ips 127.0.0.1
Restart=always

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/trendstees-web.service <<EOF
[Unit]
Description=TrendsTees website (Next.js)
After=network.target trendstees-api.service

[Service]
User=$APP_USER
WorkingDirectory=$FE
Environment=NODE_ENV=production
ExecStart=$FE/node_modules/.bin/next start -H 127.0.0.1 -p 3000
Restart=always

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable trendstees-api trendstees-web
systemctl restart trendstees-api trendstees-web

# ---------- 8. Nginx ----------
log "Configuring Nginx"
cat > /etc/nginx/sites-available/trendstees <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    client_max_body_size 20m;   # design uploads (backend limit 15 MB)

    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
ln -sf /etc/nginx/sites-available/trendstees /etc/nginx/sites-enabled/trendstees
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

ufw allow OpenSSH >/dev/null; ufw allow 'Nginx Full' >/dev/null; ufw --force enable >/dev/null

if [ "$USE_SSL" = true ]; then
  log "Getting SSL certificate"
  apt-get install -y certbot python3-certbot-nginx
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$SSL_EMAIL" --redirect || \
    warn "SSL failed. Check that $DOMAIN points to this server, then run: sudo certbot --nginx -d $DOMAIN"
else
  warn "No SSL (IP address or no email). Logins work over http only for testing - use a domain + SSL for the live site."
fi

# ---------- 9. Health check ----------
sleep 3
log "Checking"
curl -fsS "http://127.0.0.1:8000/" >/dev/null && echo "API: OK" || warn "API not responding: sudo journalctl -u trendstees-api -n 50"
curl -fsS -o /dev/null "http://127.0.0.1:3000/" && echo "Website: OK" || warn "Website not responding: sudo journalctl -u trendstees-web -n 50"

echo
echo "Done!  Website: $SITE_URL   Admin: $SITE_URL/admin-login"
echo "Logs:  sudo journalctl -u trendstees-api -f   |   sudo journalctl -u trendstees-web -f"
echo "Update later: sudo bash $APP_DIR/deploy/install.sh"
