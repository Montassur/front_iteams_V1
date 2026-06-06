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
  apache2 \
  ufw \
  certbot \
  python3-certbot-apache

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
# 5. Apache2 — enable required modules
# ─────────────────────────────────────────────────────────────────────────────
info "Configuring Apache2…"
# rewrite + headers + ssl: required by the vhost below.
# deflate + expires + mime: gzip + long-cache hashed assets (PWA & perf).
# http2: HTTP/2 over TLS for faster bundle delivery.
a2enmod rewrite headers ssl deflate expires mime http2 2>/dev/null || true

# ─────────────────────────────────────────────────────────────────────────────
# 6. Apache2 — virtual host (sites-available)
# ─────────────────────────────────────────────────────────────────────────────
VHOST_FILE="/etc/apache2/sites-available/iteams-front.conf"

cat > "$VHOST_FILE" <<APACHE
<VirtualHost *:80>
    ServerName ${DOMAIN}

    DocumentRoot ${WEB_ROOT}

    ErrorLog  \${APACHE_LOG_DIR}/iteams_front_error.log
    CustomLog \${APACHE_LOG_DIR}/iteams_front_access.log combined

    # ── Security headers ────────────────────────────────────────────────────
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
    # HSTS is added only when --ssl is used (see post-cert step further down).

    # ── PWA MIME types (override defaults to make sure they're correct) ─────
    AddType application/manifest+json .webmanifest
    AddType image/svg+xml .svg
    AddType application/javascript .js
    AddType application/wasm .wasm

    # ── Gzip compression (huge win on the Vite bundle) ──────────────────────
    <IfModule mod_deflate.c>
        AddOutputFilterByType DEFLATE \\
            text/html text/css text/plain text/xml \\
            application/javascript application/json application/manifest+json \\
            image/svg+xml application/xml application/x-font-ttf font/opentype
    </IfModule>

    # ── PWA-aware caching policy ────────────────────────────────────────────
    # Service worker MUST NOT be cached — otherwise updates won't roll out.
    <Files "sw.js">
        Header set Cache-Control "no-cache, no-store, must-revalidate"
        Header set Pragma "no-cache"
    </Files>
    # Manifest: refetch frequently so manifest edits take effect.
    <Files "manifest.webmanifest">
        Header set Cache-Control "no-cache"
    </Files>
    # index.html: never cache — must be fresh so users always get latest asset hashes.
    <Files "index.html">
        Header set Cache-Control "no-cache, no-store, must-revalidate"
    </Files>
    # Vite emits hashed filenames under /assets/*; safe to cache forever.
    <Directory "${WEB_ROOT}/assets">
        Header set Cache-Control "public, max-age=31536000, immutable"
    </Directory>
    # Icons under /icons/*: medium cache; replace with hashed names later if you want.
    <Directory "${WEB_ROOT}/icons">
        Header set Cache-Control "public, max-age=604800"
    </Directory>

    <Directory ${WEB_ROOT}>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted

        # React SPA — send all routes to index.html, except real files.
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>
</VirtualHost>
APACHE

# ─────────────────────────────────────────────────────────────────────────────
# 7. Enable site & test config
# ─────────────────────────────────────────────────────────────────────────────
a2dissite 000-default.conf 2>/dev/null || true
a2ensite iteams-front.conf

apachectl configtest || error "Apache config test failed — check $VHOST_FILE"
systemctl enable --now apache2
systemctl reload apache2
info "Apache2 configured and reloaded."

# ─────────────────────────────────────────────────────────────────────────────
# 8. Firewall
# ─────────────────────────────────────────────────────────────────────────────
info "Configuring UFW firewall…"
ufw allow OpenSSH      2>/dev/null || true
ufw allow "Apache Full" 2>/dev/null || true
ufw --force enable     2>/dev/null || true

# ─────────────────────────────────────────────────────────────────────────────
# 9. Optional: Let's Encrypt SSL
# ─────────────────────────────────────────────────────────────────────────────
if [[ "$USE_SSL" == true ]]; then
  info "Requesting Let's Encrypt certificate for ${DOMAIN}…"
  certbot --apache -d "${DOMAIN}" --non-interactive --agree-tos \
    -m "admin@${DOMAIN}" --redirect

  # Inject HSTS into the SSL vhost that certbot just generated.
  SSL_VHOST="/etc/apache2/sites-available/iteams-front-le-ssl.conf"
  if [[ -f "$SSL_VHOST" ]] && ! grep -q "Strict-Transport-Security" "$SSL_VHOST"; then
    sed -i '/<\/VirtualHost>/i \    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"' "$SSL_VHOST"
  fi
  systemctl reload apache2
  info "SSL certificate installed. Site available at https://${DOMAIN}"
else
  warn "SSL skipped. Re-run with --ssl to enable HTTPS."
  warn "⚠ The PWA install prompt + service worker require HTTPS — they will NOT work over plain HTTP."
fi

# ─────────────────────────────────────────────────────────────────────────────
# 9b. Smoke test — make sure the site actually returns 200 + manifest + sw
# ─────────────────────────────────────────────────────────────────────────────
SCHEME=$([ "$USE_SSL" = true ] && echo "https" || echo "http")
info "Smoke-testing ${SCHEME}://${DOMAIN}…"
for path in "/" "/manifest.webmanifest" "/sw.js" "/icons/icon-192.svg" "/icons/icon-512.svg"; do
  code=$(curl -k -s -o /dev/null -w "%{http_code}" "${SCHEME}://${DOMAIN}${path}")
  if [[ "$code" == "200" ]]; then
    echo "  ✓ ${path} → 200"
  else
    warn "  ✗ ${path} → ${code} (check Apache logs and ${WEB_ROOT}${path})"
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