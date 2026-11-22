#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Deploy EverdiceRealm to the production VPS
# =============================================================================
# Usage (from project root):
#   ./scripts/deploy.sh [user@host]        default: root@204.168.167.44
#
# What it does:
#   1. Checks your local main is committed and pushed to origin/main.
#   2. On the server: git pull --ff-only origin main, npm ci if the lockfile
#      changed, npm run build (type-gated), pm2 restart.
#   3. Checks the site serves the bundle the server just built.
#
# What it never does: touch the database schema. NEVER run db:push /
# drizzle-kit push against prod — it drops the session table (everyone is
# logged out) and fights the hand-made tables. Schema changes ship as SQL
# files in scripts/migrations/ and are run by hand with psql; this script
# lists any that arrived with the pull so you don't forget them.
# =============================================================================
set -euo pipefail

VPS="${1:-root@204.168.167.44}"
APP_DIR="/root/EverdiceRealm1"
PM2_APP="everdice"
SITE_URL="${SITE_URL:-https://realmofeverdice.com}"

if [[ ! -f "package.json" ]]; then
  echo "Error: run this script from the project root (where package.json lives)"
  exit 1
fi

echo "==> Deploying EverdiceRealm to ${VPS}..."

# ── 1. Local checks ──────────────────────────────────────────────────────────
echo ""
echo "[1/4] Checking local main is committed and pushed..."
branch=$(git rev-parse --abbrev-ref HEAD)
if [[ "${branch}" != "main" ]]; then
  echo "Error: you are on '${branch}'. Deploys go from main."
  exit 1
fi
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "Error: uncommitted changes to tracked files. Commit or stash them first."
  exit 1
fi
git fetch -q origin main
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
if [[ "${LOCAL}" != "${REMOTE}" ]]; then
  echo "Error: local main (${LOCAL:0:7}) and origin/main (${REMOTE:0:7}) differ."
  echo "       Push or pull first — the server deploys origin/main."
  exit 1
fi
echo "    main = origin/main = ${LOCAL:0:7}"

# ── 2. Pull, build, restart on the server ────────────────────────────────────
echo ""
echo "[2/4] Pulling, building and restarting on ${VPS}..."
ssh "${VPS}" bash <<REMOTE
set -euo pipefail
cd "${APP_DIR}"
BEFORE=\$(git rev-parse HEAD)
GIT_SSH_COMMAND="ssh -i ~/.ssh/id_ed25519" git pull -q --ff-only origin main
AFTER=\$(git rev-parse HEAD)
echo "    server: \${BEFORE:0:7} -> \${AFTER:0:7}"

if ! git diff --quiet "\${BEFORE}" "\${AFTER}" -- package-lock.json; then
  echo "    package-lock.json changed — npm ci"
  npm ci 2>&1 | tail -3
fi

NEW_MIGRATIONS=\$(git diff --name-only --diff-filter=A "\${BEFORE}" "\${AFTER}" -- scripts/migrations/ || true)
if [[ -n "\${NEW_MIGRATIONS}" ]]; then
  echo ""
  echo "    !! New migrations arrived with this pull. Run them by hand if you haven't:"
  for m in \${NEW_MIGRATIONS}; do
    echo "       psql \"\\\$DATABASE_URL\" -f \${m}"
  done
  echo "       (from ${APP_DIR}, after: set -a && source .env && set +a)"
  echo ""
fi

if ! npm run build > /tmp/everdice-build.log 2>&1; then
  echo "    BUILD FAILED — app NOT restarted (still running the previous build)."
  tail -30 /tmp/everdice-build.log
  exit 1
fi
grep -E "type errors|built in" /tmp/everdice-build.log || true

pm2 restart "${PM2_APP}" >/dev/null
sleep 5
pm2 describe "${PM2_APP}" | grep -m1 status
REMOTE

# ── 3. Verify the live site serves the new build ─────────────────────────────
echo ""
echo "[3/4] Checking ${SITE_URL} serves the new bundle..."
BUILT=$(ssh "${VPS}" "grep -o 'assets/index-[^\"]*\.js' ${APP_DIR}/dist/public/index.html" || true)
LIVE=$(curl -s --max-time 10 "${SITE_URL}/" | grep -o 'assets/index-[^"]*\.js' || true)
if [[ -n "${BUILT}" && "${BUILT}" == "${LIVE}" ]]; then
  echo "    OK: ${LIVE}"
else
  echo "    WARNING: server built '${BUILT}', site serves '${LIVE}'."
  echo "    Check: ssh ${VPS} 'pm2 logs ${PM2_APP} --lines 30'"
  exit 1
fi

# ── 4. Done ──────────────────────────────────────────────────────────────────
echo ""
echo "[4/4] Deploy complete (${LOCAL:0:7}). Users need a hard refresh (Ctrl+Shift+R)."
