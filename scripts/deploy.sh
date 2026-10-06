#!/usr/bin/env bash
# Pull the latest code and deploy it to production on this server.
#
#   sudo scripts/deploy.sh               # pull origin/main, build, restart
#   sudo scripts/deploy.sh --no-pull     # deploy the checkout as it is
#   BRANCH=release sudo scripts/deploy.sh
#
# Steps: git pull (fast-forward only) → bundle install → db migrate →
# npm ci + next build → swap the frontend release → restart backend,
# sidekiq and frontend → health-check both.
#
# Production settings live in /etc/beryl-hrms/production.env (root-only, not
# in git). Rails ignores .env in production, so both this script and the
# systemd units read that file instead.
#
# The systemd units themselves live in /etc/systemd/system and are managed
# there; this script only restarts them.
set -euo pipefail

APP_DIR=/var/www/beryl-hrms
ENV_FILE=/etc/beryl-hrms/production.env
RELEASE_DIR=/opt/beryl-hrms/frontend
NODE_VERSION=24.20.0
BRANCH=${BRANCH:-main}
SERVICES=(hrms-backend hrms-sidekiq hrms-frontend)

PULL=1
for arg in "$@"; do
  case $arg in
    --no-pull) PULL=0 ;;
    -h|--help) sed -n 2,17p "$0"; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
die() { printf '\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "run as root (sudo $0)"
[[ -f $ENV_FILE ]] || die "$ENV_FILE is missing — production settings are required"

# One deploy at a time.
exec 9>/var/lock/beryl-hrms-deploy.lock
flock -n 9 || die "another deploy is already running"

cd "$APP_DIR"

# --- 1. Code ---------------------------------------------------------------
if (( PULL )); then
  log "Pulling origin/$BRANCH"
  git diff --quiet && git diff --cached --quiet \
    || die "tracked files have local changes; commit or stash them first (or use --no-pull)"
  git fetch origin "$BRANCH"
  git checkout -q "$BRANCH"
  git merge --ff-only "origin/$BRANCH"
fi
log "Deploying $(git log -1 --format='%h %s')"

# Production env for every Rails/rake command below.
set -a
# shellcheck source=/dev/null
. "$ENV_FILE"
set +a
export RAILS_ENV=production

export PATH="/root/.rbenv/shims:/root/.rbenv/bin:$PATH"
export NVM_DIR=/root/.nvm
# nvm.sh returns non-zero when no default is active; don't let -e trip on it.
set +e; . "$NVM_DIR/nvm.sh"; set -e
nvm use --silent "$NODE_VERSION" || die "Node $NODE_VERSION is not installed (nvm install $NODE_VERSION)"

# --- 2. Backend ------------------------------------------------------------
log "Installing gems"
cd "$APP_DIR/backend"
bundle install --quiet

log "Migrating database ($DATABASE_NAME)"
# A brand-new database loads db/schema.rb; an existing one runs migrations.
# Seeds are never run here — they create demo data.
has_schema=$(PGPASSWORD=$DATABASE_PASSWORD psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" \
  -U "$DATABASE_USER" -d "$DATABASE_NAME" -Atc \
  "select to_regclass('public.schema_migrations') is not null" 2>/dev/null || echo missing)
case $has_schema in
  t) bin/rails db:migrate ;;
  f) bin/rails db:schema:load ;;
  *) bin/rails db:create db:schema:load ;;
esac

# --- 3. Frontend -----------------------------------------------------------
log "Building frontend"
cd "$APP_DIR/frontend"
npm ci --no-audit --no-fund
# Inlined at build time; empty means same-origin /api/v1 through nginx.
NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-}" NEXT_TELEMETRY_DISABLED=1 npm run build

# The standalone server needs static assets and public/ copied beside it.
# Build into a fresh directory and swap, so the running server keeps its
# files until the restart.
staging="$RELEASE_DIR.new"
rm -rf "$staging"
mkdir -p "$(dirname "$RELEASE_DIR")"
cp -a .next/standalone "$staging"
mkdir -p "$staging/.next"
cp -a .next/static "$staging/.next/static"
[[ -d public ]] && cp -a public "$staging/public"
rm -rf "$RELEASE_DIR.old"
[[ -d $RELEASE_DIR ]] && mv "$RELEASE_DIR" "$RELEASE_DIR.old"
mv "$staging" "$RELEASE_DIR"

# --- 4. Services -----------------------------------------------------------
# Units live in /etc/systemd/system and are managed there, not from this repo.
log "Restarting services"
systemctl restart "${SERVICES[@]}"

# --- 5. Health check -------------------------------------------------------
log "Health check"
check() {
  local name=$1 url=$2
  for _ in $(seq 1 30); do
    if curl -fsS -o /dev/null -m 5 "$url"; then echo "  $name OK ($url)"; return 0; fi
    sleep 2
  done
  echo "  $name FAILED ($url) — see: journalctl -u $3 -n 100" >&2
  return 1
}
ok=1
check backend  http://127.0.0.1:4000/up hrms-backend  || ok=0
check frontend http://127.0.0.1:3000/   hrms-frontend || ok=0
systemctl is-active --quiet hrms-sidekiq && echo "  sidekiq OK" \
  || { echo "  sidekiq FAILED — see: journalctl -u hrms-sidekiq -n 100" >&2; ok=0; }

(( ok )) || die "deploy finished but a service is unhealthy"
rm -rf "$RELEASE_DIR.old"
log "Deployed $(git -C "$APP_DIR" log -1 --format='%h') successfully"
