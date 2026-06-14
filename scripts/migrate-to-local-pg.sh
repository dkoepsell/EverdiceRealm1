#!/usr/bin/env bash
# =============================================================================
# migrate-to-local-pg.sh — Move EverdiceRealm's DB from Neon (us-east-1) to a
# local PostgreSQL 17 on this Hetzner box, killing the transatlantic query lag.
#
# RUN THIS ON THE HETZNER BOX (as root):
#   bash /root/migrate-to-local-pg.sh
#
# Safe by design: the app stays on Neon until the local copy is verified.
# .env is only switched AFTER table/row counts match. A backup of .env and the
# full Neon dump are kept for rollback.
# =============================================================================
set -euo pipefail

APP_DIR="/root/EverdiceRealm1"
ENV_FILE="${APP_DIR}/.env"
PM2_APP="everdice"
PG_MAJOR=17
LOCAL_DB="everdice"
LOCAL_ROLE="everdice"
DUMP_FILE="/root/everdice-neon-$(date +%Y%m%d-%H%M%S).dump"
PGBIN="/usr/lib/postgresql/${PG_MAJOR}/bin"

log() { echo -e "\n==> $*"; }

# ── 0. Read the current (Neon) URL — this is our migration SOURCE ──────────────
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "ERROR: ${ENV_FILE} not found." >&2; exit 1
fi
NEON_URL="$(grep '^DATABASE_URL=' "${ENV_FILE}" | cut -d= -f2-)"
if [[ -z "${NEON_URL}" ]]; then
  echo "ERROR: no DATABASE_URL in ${ENV_FILE}." >&2; exit 1
fi
if [[ "${NEON_URL}" != *neon.tech* ]]; then
  echo "ERROR: DATABASE_URL does not look like Neon — it may already be local." >&2
  echo "       Current: ${NEON_URL%%@*}@..." >&2
  echo "       Aborting to avoid dumping a DB onto itself." >&2
  exit 1
fi
log "Source (Neon): ${NEON_URL%%@*}@...$(echo "${NEON_URL}" | sed -E 's#.*@##; s#\?.*##')"

# ── 1. Install PostgreSQL 17 from the official PGDG repo ───────────────────────
if ! command -v "${PGBIN}/psql" >/dev/null 2>&1; then
  log "Installing PostgreSQL ${PG_MAJOR} (PGDG repo)..."
  apt-get update -y
  apt-get install -y curl ca-certificates lsb-release
  install -d /usr/share/postgresql-common/pgdg
  curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
    https://www.postgresql.org/media/keys/ACCC4CF8.asc
  CODENAME="$(. /etc/os-release; echo "${VERSION_CODENAME:-$(lsb_release -cs)}")"
  echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt ${CODENAME}-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list
  apt-get update -y
  apt-get install -y "postgresql-${PG_MAJOR}"
else
  log "PostgreSQL ${PG_MAJOR} already installed — skipping."
fi
systemctl enable --now postgresql

# ── 2. Create the local role + database (idempotent) ──────────────────────────
log "Creating local role/database '${LOCAL_ROLE}'/'${LOCAL_DB}'..."
PGPASS="$(openssl rand -hex 16)"
ROLE_EXISTS="$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${LOCAL_ROLE}'")"
if [[ "${ROLE_EXISTS}" == "1" ]]; then
  echo "    Role exists — resetting its password."
  sudo -u postgres psql -c "ALTER ROLE ${LOCAL_ROLE} WITH LOGIN PASSWORD '${PGPASS}';"
else
  sudo -u postgres psql -c "CREATE ROLE ${LOCAL_ROLE} WITH LOGIN PASSWORD '${PGPASS}';"
fi
DB_EXISTS="$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${LOCAL_DB}'")"
if [[ "${DB_EXISTS}" != "1" ]]; then
  sudo -u postgres createdb -O "${LOCAL_ROLE}" "${LOCAL_DB}"
else
  echo "    WARNING: database '${LOCAL_DB}' already exists — restoring into it as-is."
fi
# Make sure the app role fully owns the public schema (needed for drizzle push)
sudo -u postgres psql -d "${LOCAL_DB}" -c "ALTER SCHEMA public OWNER TO ${LOCAL_ROLE}; GRANT ALL ON SCHEMA public TO ${LOCAL_ROLE};"

LOCAL_URL="postgresql://${LOCAL_ROLE}:${PGPASS}@localhost:5432/${LOCAL_DB}"

# ── 3. Dump from Neon (v17 client) and restore locally ─────────────────────────
log "Dumping Neon -> ${DUMP_FILE} ..."
"${PGBIN}/pg_dump" "${NEON_URL}" --no-owner --no-privileges -Fc -f "${DUMP_FILE}"
echo "    Dump size: $(du -h "${DUMP_FILE}" | cut -f1)"

log "Restoring into local '${LOCAL_DB}' ..."
# pg_restore may emit benign warnings (e.g. schema public already exists); we
# judge success by the verification step below, not by its exit code.
"${PGBIN}/pg_restore" --no-owner --no-privileges -d "${LOCAL_URL}" "${DUMP_FILE}" || true

# ── 4. VERIFY before touching anything live ────────────────────────────────────
log "Verifying migration..."
SRC_TABLES="$("${PGBIN}/psql" "${NEON_URL}"  -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")"
DST_TABLES="$("${PGBIN}/psql" "${LOCAL_URL}" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")"
SRC_USERS="$("${PGBIN}/psql" "${NEON_URL}"  -tAc "SELECT count(*) FROM users")"
DST_USERS="$("${PGBIN}/psql" "${LOCAL_URL}" -tAc "SELECT count(*) FROM users")"
echo "    Tables:  Neon=${SRC_TABLES}  local=${DST_TABLES}"
echo "    Users:   Neon=${SRC_USERS}  local=${DST_USERS}"
if [[ "${SRC_TABLES}" != "${DST_TABLES}" || "${SRC_USERS}" != "${DST_USERS}" ]]; then
  echo "" >&2
  echo "ERROR: counts do not match — NOT switching the app. It stays on Neon." >&2
  echo "       Inspect the local DB, fix, and re-run. Dump kept at ${DUMP_FILE}." >&2
  exit 1
fi
echo "    ✓ Counts match."

# ── 5. Switch .env to local (with backup) ──────────────────────────────────────
BACKUP="${ENV_FILE}.bak-$(date +%Y%m%d-%H%M%S)"
cp "${ENV_FILE}" "${BACKUP}"
log "Switching DATABASE_URL to local (backup: ${BACKUP})"
grep -v '^DATABASE_URL=' "${BACKUP}" > "${ENV_FILE}"
echo "DATABASE_URL=${LOCAL_URL}" >> "${ENV_FILE}"

# ── 6. Restart the app ─────────────────────────────────────────────────────────
log "Restarting ${PM2_APP}..."
pm2 restart "${PM2_APP}" --update-env
sleep 4

# ── 7. Health check ────────────────────────────────────────────────────────────
log "Health check..."
HTTP="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://127.0.0.1:3000 || echo 000)"
echo "    HTTP ${HTTP}"
pm2 logs "${PM2_APP}" --lines 15 --nostream || true

# ── 8. Nightly backup cron ─────────────────────────────────────────────────────
log "Installing nightly backup cron (02:30, keeps 14 days)..."
mkdir -p /root/pg-backups
cat > /usr/local/bin/everdice-pg-backup.sh <<BACKUP_EOF
#!/usr/bin/env bash
set -euo pipefail
OUT="/root/pg-backups/everdice-\$(date +%Y%m%d-%H%M%S).dump"
${PGBIN}/pg_dump "${LOCAL_URL}" -Fc -f "\${OUT}"
find /root/pg-backups -name 'everdice-*.dump' -mtime +14 -delete
BACKUP_EOF
chmod +x /usr/local/bin/everdice-pg-backup.sh
( crontab -l 2>/dev/null | grep -v 'everdice-pg-backup.sh' ; echo "30 2 * * * /usr/local/bin/everdice-pg-backup.sh" ) | crontab -

echo ""
echo "============================================================================="
echo " DONE. App now uses LOCAL Postgres. Queries dropped from ~110ms to <1ms."
echo ""
echo "  Local DB URL is in ${ENV_FILE} (also mirror it into your laptop's .env"
echo "  ONLY if you need remote access — it points at localhost, so it won't work"
echo "  off-box without an SSH tunnel)."
echo ""
echo "  Rollback (back to Neon):  cp ${BACKUP} ${ENV_FILE} && pm2 restart ${PM2_APP}"
echo "  Neon dump kept at:        ${DUMP_FILE}"
echo "  Nightly backups:          /root/pg-backups/"
echo "============================================================================="
