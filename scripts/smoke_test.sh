#!/usr/bin/env bash
# Dev-only smoke test for the auth flow documented in docs/API_CONVENTIONS.md:
# bootstrap CSRF -> register -> confirm unverified -> verify email (token
# fetched directly via `bin/rails runner`, a dev shortcut no real client has)
# -> logout -> confirm the session is actually revoked.
#
# Requires: backend running and reachable at $API (default localhost:3001),
# curl, jq. Run from anywhere; resolves backend/ relative to this script.
set -euo pipefail

API="${API:-http://localhost:3001}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/../backend" && pwd)"
JAR="$(mktemp)"
trap 'rm -f "$JAR" /tmp/smoke_*.json' EXIT

pass() { echo "  OK  $1"; }
fail() { echo "FAIL  $1"; exit 1; }
csrf_token() { grep -i 'csrf_token' "$JAR" | awk '{print $NF}' | tail -1; }

command -v jq >/dev/null || fail "jq is required"

STAMP=$(date +%s)
EMAIL="smoke+${STAMP}@example.com"
COMPANY="Smoke Test Co ${STAMP}"
PASSWORD='Sm0keTest!Passw0rd'

echo "== 1. bootstrap CSRF cookie (GET /auth/me while unauthenticated, expect 401) =="
STATUS=$(curl -s -o /tmp/smoke_me1.json -w '%{http_code}' -c "$JAR" -b "$JAR" "$API/api/v1/auth/me")
[ "$STATUS" = "401" ] && pass "unauthenticated /auth/me -> 401" || fail "/auth/me expected 401, got $STATUS: $(cat /tmp/smoke_me1.json)"
CSRF=$(csrf_token)
[ -n "$CSRF" ] || fail "no csrf_token cookie set on bootstrap request"
pass "csrf cookie established"

echo "== 2. register (company + first admin user) =="
STATUS=$(curl -s -o /tmp/smoke_register.json -w '%{http_code}' -c "$JAR" -b "$JAR" \
  -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF" \
  -d "{\"companyName\":\"$COMPANY\",\"firstName\":\"Smoke\",\"lastName\":\"Test\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"passwordConfirmation\":\"$PASSWORD\"}" \
  "$API/api/v1/auth/register")
[ "$STATUS" = "201" ] || fail "register expected 201, got $STATUS: $(cat /tmp/smoke_register.json)"
jq -e '.data.roles | map(.slug) | index("admin")' /tmp/smoke_register.json >/dev/null || fail "registering user should hold the admin role"
pass "register -> 201, admin role assigned"
CSRF=$(csrf_token) # rotated by start_new_session_for on register

echo "== 3. /auth/me reflects the new, not-yet-verified user =="
curl -s -c "$JAR" -b "$JAR" "$API/api/v1/auth/me" -o /tmp/smoke_me2.json
jq -e '.data.user.emailVerifiedAt == null' /tmp/smoke_me2.json >/dev/null || fail "expected emailVerifiedAt null before verification"
pass "me reflects unverified user"

echo "== 4. verify email (token generated via rails runner — dev-only shortcut) =="
TOKEN=$(cd "$BACKEND_DIR" && bin/rails runner "ActsAsTenant.without_tenant { puts User.find_by(email_address: '$EMAIL').generate_token_for(:email_verification) }" 2>/dev/null | tail -1)
[ -n "$TOKEN" ] || fail "could not generate an email verification token"
STATUS=$(curl -s -o /tmp/smoke_verify.json -w '%{http_code}' -c "$JAR" -b "$JAR" \
  -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF" \
  -d "{\"token\":\"$TOKEN\"}" "$API/api/v1/auth/verify_email")
[ "$STATUS" = "200" ] || fail "verify_email expected 200, got $STATUS: $(cat /tmp/smoke_verify.json)"
jq -e '.data.user.emailVerifiedAt != null' /tmp/smoke_verify.json >/dev/null || fail "emailVerifiedAt should be set after verification"
pass "verify_email -> 200, emailVerifiedAt set"

echo "== 5. logout, then confirm the session is actually revoked (not just cleared client-side) =="
STATUS=$(curl -s -o /dev/null -w '%{http_code}' -c "$JAR" -b "$JAR" -X DELETE -H "X-CSRF-Token: $CSRF" "$API/api/v1/auth/logout")
[ "$STATUS" = "204" ] || fail "logout expected 204, got $STATUS"
pass "logout -> 204"

STATUS=$(curl -s -o /dev/null -w '%{http_code}' -c "$JAR" -b "$JAR" "$API/api/v1/auth/me")
[ "$STATUS" = "401" ] || fail "post-logout /auth/me expected 401, got $STATUS (session not actually revoked!)"
pass "session revoked — /auth/me 401s after logout"

echo
echo "All smoke checks passed against $API."
