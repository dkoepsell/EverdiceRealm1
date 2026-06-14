#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Deploy EverdiceRealm to your VPS
# =============================================================================
# Usage (from project root):
#   ./scripts/deploy.sh [user@host]
#
# Example:
#   ./scripts/deploy.sh root@123.45.67.89
#   ./scripts/deploy.sh everdice@myserver.com
#
# First-time setup:
#   1. Run scripts/setup-vps.sh on the VPS once.
#   2. Copy your .env to the VPS:
#        scp .env user@host:/var/www/everdice/.env
#   3. Then use this script for all future deploys.
# =============================================================================
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
VPS="${1:-}"
APP_DIR="/root/EverdiceRealm1"
PM2_APP="everdice"
REMOTE_TMP="/tmp/everdice-deploy"

# ── Validation ────────────────────────────────────────────────────────────────
if [[ -z "${VPS}" ]]; then
  echo "Usage: $0 user@host"
  echo "Example: $0 root@123.45.67.89"
  exit 1
fi

# Check we're in the project root
if [[ ! -f "package.json" ]]; then
  echo "Error: run this script from the project root (where package.json lives)"
  exit 1
fi

echo "==> Deploying EverdiceRealm to ${VPS}..."

# ── 1. Build locally ──────────────────────────────────────────────────────────
echo ""
echo "[1/5] Building production bundle..."
npm run build

# ── 2. Create a deployment archive (exclude heavy dev-only dirs) ───────────────
echo ""
echo "[2/5] Creating deployment archive..."
ARCHIVE=$(mktemp /tmp/everdice-XXXXXX.tar.gz)
tar -czf "${ARCHIVE}" \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='attached_assets' \
  --exclude='uploads' \
  --exclude='.env' \
  --exclude='*.log' \
  dist \
  package.json \
  package-lock.json \
  drizzle.config.ts \
  migrations \
  shared

echo "    Archive: ${ARCHIVE} ($(du -sh "${ARCHIVE}" | cut -f1))"

# ── 3. Upload to VPS ──────────────────────────────────────────────────────────
echo ""
echo "[3/5] Uploading to ${VPS}..."
ssh "${VPS}" "mkdir -p ${REMOTE_TMP}"
scp "${ARCHIVE}" "${VPS}:${REMOTE_TMP}/release.tar.gz"
rm -f "${ARCHIVE}"

# ── 4. Extract & install on VPS ───────────────────────────────────────────────
echo ""
echo "[4/5] Installing on VPS..."
ssh "${VPS}" bash <<REMOTE
set -euo pipefail

APP_DIR="${APP_DIR}"
REMOTE_TMP="${REMOTE_TMP}"
PM2_APP="${PM2_APP}"

echo "  -> Extracting release..."
mkdir -p "\${APP_DIR}"
tar -xzf "\${REMOTE_TMP}/release.tar.gz" -C "\${APP_DIR}"
rm -rf "\${REMOTE_TMP}"

echo "  -> Installing production dependencies..."
cd "\${APP_DIR}"
npm ci --omit=dev --ignore-scripts 2>&1 | tail -5

echo "  -> Running database migrations..."
# Only push schema if DATABASE_URL is set in .env
if [ -f "\${APP_DIR}/.env" ]; then
  set -a; source "\${APP_DIR}/.env"; set +a
fi
if [ -n "\${DATABASE_URL:-}" ]; then
  npx drizzle-kit push --config "\${APP_DIR}/drizzle.config.ts" 2>&1 | tail -5 || echo "  (migration skipped or up to date)"
else
  echo "  (no DATABASE_URL — skipping migration)"
fi

echo "  -> Restarting app with PM2..."
# Always force NODE_ENV=production regardless of what .env says.
# NOTE: .env was already sourced into this shell above (set -a; source), so PM2
# inherits DATABASE_URL etc. from the process environment. This PM2 build has no
# working --env-file flag, and 'pm2 reload --update-env' does NOT re-read a file —
# it reuses the env cached at first start. So we 'restart --update-env' to force
# the freshly-sourced values in (this is what bit us migrating off Neon).
export NODE_ENV=production
if pm2 describe "\${PM2_APP}" &>/dev/null; then
  pm2 restart "\${PM2_APP}" --update-env
else
  pm2 start "\${APP_DIR}/dist/index.js" \
    --name "\${PM2_APP}" \
    --interpreter node \
    --max-memory-restart 1G \
    --restart-delay 3000 \
    --time
fi
pm2 save

echo "  -> PM2 status:"
pm2 list | grep "\${PM2_APP}" || true
REMOTE

# ── 5. Health check ───────────────────────────────────────────────────────────
echo ""
echo "[5/5] Health check..."
sleep 3
HOST=$(echo "${VPS}" | cut -d@ -f2)
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "http://${HOST}" 2>/dev/null || echo "000")
if [[ "${HTTP_STATUS}" =~ ^[23] ]]; then
  echo "    HTTP ${HTTP_STATUS} — app is up!"
else
  echo "    HTTP ${HTTP_STATUS} — app may still be starting. Check with:"
  echo "      ssh ${VPS} 'pm2 logs ${PM2_APP} --lines 30'"
fi

echo ""
echo "==> Deploy complete!"
echo ""
echo "Useful commands:"
echo "  View logs:    ssh ${VPS} 'pm2 logs ${PM2_APP}'"
echo "  Restart app:  ssh ${VPS} 'pm2 restart ${PM2_APP}'"
echo "  App status:   ssh ${VPS} 'pm2 status'"
