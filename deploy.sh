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
rsync -a --delete "$SCRIPT_DIR/dist/" "$WEB_ROOT/"
chown -R www-data:www-data "$WEB_ROOT"

# ─────────────────────────────────────────────────────────────────────────────
# 5. Apache2 — enable required modules
# ─────────────────────────────────────────────────────────────────────────────
info "Configuring Apache2…"
a2enmod rewrite headers ssl 2>/dev/null || true

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

    Header always set X-Content-Type-Options "nosniff"
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-XSS-Protection "1; mode=block"

    <Directory ${WEB_ROOT}>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted

        # React SPA — send all routes to index.html
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
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
  systemctl reload apache2
  info "SSL certificate installed. Site available at https://${DOMAIN}"
else
  warn "SSL skipped. Re-run with --ssl to enable HTTPS (recommended for production)."
fi

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