#!/usr/bin/env bash
# deploy.sh — Frontend deployment: Node build + Apache2 static serve
# Usage: sudo bash deploy.sh [--domain front.yourdomain.com] [--ssl]
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Argument parsing
# ─────────────────────────────────────────────────────────────────────────────
DOMAIN="front.montassar-benaziza.com"
USE_SSL=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --ssl)    USE_SSL=true; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_ROOT="/var/www/iteams-front"

# ─────────────────────────────────────────────────────────────────────────────
# Colour helpers
# ─────────────────────────────────────────────────────────────────────────────
GREEN="\033[0;32m"; YELLOW="\033[1;33m"; RED="\033[0;31m"; NC="\033[0m"
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# ─────────────────────────────────────────────────────────────────────────────
# 1. System packages
# ─────────────────────────────────────────────────────────────────────────────
info "Updating apt and installing base packages…"
apt-get update -qq
apt-get install -y -qq \
  curl \
  ca-certificates \
  gnupg \
  nginx \
  ufw \
  certbot \
  python3-certbot-nginx

# Disable Apache if a previous deploy installed it — nginx owns ports 80/443.
if systemctl is-enabled apache2 &>/dev/null; then
  info "Disabling legacy Apache install…"
  systemctl stop apache2 2>/dev/null || true
  systemctl disable apache2 2>/dev/null || true
fi

# ─────────────────────────────────────────────────────────────────────────────
# 2. Node.js (via NodeSource — LTS)
# ─────────────────────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  info "Installing Node.js LTS…"
  curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
  apt-get install -y -qq nodejs
else
  info "Node.js already installed — $(node -v)"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 3. Build the frontend
# ─────────────────────────────────────────────────────────────────────────────
info "Installing dependencies…"
cd "$SCRIPT_DIR"
npm ci --silent

info "Building production bundle…"
npm run build

# ─────────────────────────────────────────────────────────────────────────────
# 4. Deploy dist/ to web root
# ─────────────────────────────────────────────────────────────────────────────
info "Deploying to ${WEB_ROOT}…"
mkdir -p "$WEB_ROOT"

# PWA sanity check: verify Vite actually copied public/icons into dist/icons.
# If it didn't, repair it before rsync so the served site has the manifest icons.
if [[ ! -f "$SCRIPT_DIR/dist/icons/icon-192.svg" ]]; then
  warn "PWA icons missing in dist/. Re-copying from public/…"
  mkdir -p "$SCRIPT_DIR/dist/icons"
  cp -f "$SCRIPT_DIR/public/icons/"*.svg "$SCRIPT_DIR/dist/icons/" 2>/dev/null || true
fi
[[ ! -f "$SCRIPT_DIR/dist/manifest.webmanifest" ]] && \
  cp -f "$SCRIPT_DIR/public/manifest.webmanifest" "$SCRIPT_DIR/dist/manifest.webmanifest" 2>/dev/null || true
[[ ! -f "$SCRIPT_DIR/dist/sw.js" ]] && \
  cp -f "$SCRIPT_DIR/public/sw.js" "$SCRIPT_DIR/dist/sw.js" 2>/dev/null || true

rsync -a --delete "$SCRIPT_DIR/dist/" "$WEB_ROOT/"
chown -R www-data:www-data "$WEB_ROOT"


# ─────────────────────────────────────────────────────────────────────────────
# 5. nginx — write the frontend vhost
# ─────────────────────────────────────────────────────────────────────────────
info "Configuring nginx…"

# WS upgrade map must live in http{}; drop it once so it's reusable.
if [[ ! -f /etc/nginx/conf.d/ws-upgrade-map.conf ]]; then
  cat > /etc/nginx/conf.d/ws-upgrade-map.conf <<'NGINX_MAP'
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}
NGINX_MAP
fi

rm -f /etc/nginx/sites-enabled/default

FRONT_SITE="/etc/nginx/sites-available/iteams-front"

# HTTP-only bootstrap if the cert doesn't exist yet
if [[ ! -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]]; then
  info "No cert yet — writing HTTP-only bootstrap vhost."
  cat > "$FRONT_SITE" <<NGINX
server {
    listen 80;
    server_name ${DOMAIN};
    root ${WEB_ROOT};
    index index.html;
    location / { try_files \$uri \$uri/ /index.html; }
}
NGINX
else
  cat > "$FRONT_SITE" <<NGINX
server {
    listen 80;
    server_name ${DOMAIN};
    return 301 https://\$server_name\$request_uri;
}
server {
    listen 443 ssl;
    server_name ${DOMAIN};

    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;

    root ${WEB_ROOT};
    index index.html;

    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # PWA: service worker + manifest must not be cached
    location = /sw.js                { add_header Cache-Control "no-cache, no-store, must-revalidate"; }
    location = /manifest.webmanifest { add_header Cache-Control "no-cache"; }
    location = /index.html           { add_header Cache-Control "no-cache, no-store, must-revalidate"; }

    # Vite hashed assets — long cache
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback — only when the requested file does not exist
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml application/manifest+json;
}
NGINX
fi

ln -sf "$FRONT_SITE" /etc/nginx/sites-enabled/iteams-front
nginx -t || error "nginx config test failed"
systemctl enable --now nginx
systemctl reload nginx
info "nginx configured and reloaded."

# ─────────────────────────────────────────────────────────────────────────────
# 6. Firewall
# ─────────────────────────────────────────────────────────────────────────────
info "Configuring UFW firewall…"
ufw allow OpenSSH     2>/dev/null || true
ufw allow "Nginx Full" 2>/dev/null || true
ufw --force enable    2>/dev/null || true

# ─────────────────────────────────────────────────────────────────────────────
# 7. Let's Encrypt SSL
# ─────────────────────────────────────────────────────────────────────────────
if [[ "$USE_SSL" == true ]]; then
  info "Requesting / renewing Let's Encrypt certificate for ${DOMAIN}…"
  certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos \
    -m "admin@${DOMAIN}" --redirect --keep-until-expiring

  # Re-write canonical SSL vhost so PWA cache/SPA fallback are correct.
  cat > "$FRONT_SITE" <<NGINX
server {
    listen 80;
    server_name ${DOMAIN};
    return 301 https://\$server_name\$request_uri;
}
server {
    listen 443 ssl;
    server_name ${DOMAIN};

    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;

    root ${WEB_ROOT};
    index index.html;

    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location = /sw.js                { add_header Cache-Control "no-cache, no-store, must-revalidate"; }
    location = /manifest.webmanifest { add_header Cache-Control "no-cache"; }
    location = /index.html           { add_header Cache-Control "no-cache, no-store, must-revalidate"; }

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml application/manifest+json;
}
NGINX

  nginx -t || error "nginx config test failed after certbot"
  systemctl reload nginx
  info "SSL certificate installed."
else
  warn "SSL skipped. Re-run with --ssl to enable HTTPS (required for the PWA install prompt)."
fi

# ─────────────────────────────────────────────────────────────────────────────
# 9. Smoke tests
# ─────────────────────────────────────────────────────────────────────────────
SCHEME=$([ "$USE_SSL" = true ] && echo "https" || echo "http")
info "Smoke-testing ${SCHEME}://${DOMAIN}…"
for path in "/" "/manifest.webmanifest" "/sw.js" "/icons/icon-192.svg" "/icons/icon-512.svg"; do
  code=$(curl -k -s -o /dev/null -w "%{http_code}" "${SCHEME}://${DOMAIN}${path}")
  if [[ "$code" == "200" ]]; then
    echo "  ✓ ${path} → 200"
  else
    warn "  ✗ ${path} → ${code} (check ${WEB_ROOT}${path} and nginx error log)"
  fi
done

# ─────────────────────────────────────────────────────────────────────────────
# 10. Done
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Frontend deployment complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  URL : http://${DOMAIN}  (or https:// if --ssl used)"
echo ""
echo "  To redeploy after code changes:"
echo "    sudo bash deploy.sh"
echo ""