#!/usr/bin/env bash
# =============================================================================
# setup-vps.sh — Run ONCE on a fresh Ubuntu 22.04 / 24.04 VPS as root
# =============================================================================
# Usage:
#   ssh root@YOUR_VPS_IP "bash -s" < scripts/setup-vps.sh
# Or copy to the VPS and run:
#   chmod +x setup-vps.sh && sudo ./setup-vps.sh
# =============================================================================
set -euo pipefail

APP_USER="everdice"
APP_DIR="/root/EverdiceRealm1"
NODE_VERSION="22"

echo "==> Updating system packages..."
apt-get update -y && apt-get upgrade -y

echo "==> Installing base dependencies..."
apt-get install -y curl git build-essential nginx ufw

# ── Node.js ──────────────────────────────────────────────────────────────────
echo "==> Installing Node.js ${NODE_VERSION}.x..."
curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash -
apt-get install -y nodejs
node -v && npm -v

# ── PM2 (process manager) ────────────────────────────────────────────────────
echo "==> Installing PM2..."
npm install -g pm2
pm2 startup systemd -u root --hp /root | tail -1 | bash || true

# ── App user & directory ─────────────────────────────────────────────────────
echo "==> Creating app user '${APP_USER}'..."
id "${APP_USER}" &>/dev/null || useradd -r -m -s /bin/bash "${APP_USER}"
mkdir -p "${APP_DIR}"
chown "${APP_USER}:${APP_USER}" "${APP_DIR}"

# ── Firewall ──────────────────────────────────────────────────────────────────
echo "==> Configuring UFW firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# ── Nginx config ─────────────────────────────────────────────────────────────
echo "==> Writing Nginx config..."
# Replace YOUR_DOMAIN with your actual domain or VPS IP
cat > /etc/nginx/sites-available/everdice <<'NGINX'
server {
    listen 80;
    server_name YOUR_DOMAIN;          # ← change this

    # Increase buffer sizes for large AI responses
    proxy_buffers 16 64k;
    proxy_buffer_size 128k;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
    send_timeout 300s;
    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/everdice /etc/nginx/sites-enabled/everdice
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ── HTTPS (optional) ─────────────────────────────────────────────────────────
echo ""
echo "==> (Optional) To enable HTTPS with Let's Encrypt, run:"
echo "      apt-get install -y certbot python3-certbot-nginx"
echo "      certbot --nginx -d YOUR_DOMAIN"
echo ""

echo "==> VPS setup complete!"
echo "    Next: run  scripts/deploy.sh  from your local machine."
