#!/bin/sh
# Bootstraps a Keycloak realm end-to-end, via kcadm — works for local dev,
# a Render-hosted instance, or a separately self-hosted instance shared
# across multiple projects (see "Production deployment" in the README).
# It only ever touches the realm named $KEYCLOAK_REALM — safe to run
# against a shared instance that also hosts other projects' realms.
#
# Local dev why this exists: this Keycloak instance runs in `start-dev`
# mode with an embedded, non-persisted database (see docker-compose.yml) —
# a container *recreate* (not just a restart) wipes the realm entirely,
# and this has already happened twice during development. Re-running this
# script is faster and more reliable than redoing the console clicks by
# hand.
#
# Run from inside the Keycloak container (kcadm.sh only exists there):
#   docker compose exec keycloak sh -c "$(cat keycloak/setup-realm.sh)"        # local
#   docker exec -it <your-keycloak-container> sh                              # self-hosted, then paste the script
#
# Set KCADM_ADMIN_USER/KCADM_ADMIN_PASSWORD if the instance's bootstrap
# admin isn't the local-dev default (admin/admin) — true for any real
# instance, definitely true for a shared self-hosted one.
#
# Set APP_PUBLIC_URL to your real https:// production app URL to run this
# against a production-style deploy — sslRequired is only ever disabled
# for a plain-http APP_PUBLIC_URL (see the case statements below), so
# this never weakens a real deployment.
#
# Set SMTP_HOST/SMTP_PORT/SMTP_FROM/SMTP_USER/SMTP_PASSWORD to configure
# the realm's outgoing email (Mailjet/Mailgun/etc., any standard SMTP
# relay) and turn on email verification for new accounts. Optional — if
# SMTP_HOST is unset, both are skipped entirely, so local dev keeps
# working with no real email account needed.
#
# NOT everything here is dev-only:
#   - Realm/client/redirect-URI creation, the admin group, and the group
#     membership mapper are exactly what you'd also do in production
#     (console clicks or an equivalent kcadm/Terraform script there).
#   - Google/Facebook IdP federation and real user passwords still need
#     the founder's own action (README's Keycloak setup section) — this
#     script does not touch either.

set -e

REALM="${KEYCLOAK_REALM:-find-my-game-parts}"
CLIENT_ID="${KEYCLOAK_CLIENT_ID:-find-my-game-parts}"
ADMIN_GROUP="${KEYCLOAK_ADMIN_GROUP:-admin}"
APP_PUBLIC_URL="${APP_PUBLIC_URL:-http://localhost:3030}"
REDIRECT_URI="$APP_PUBLIC_URL/api/auth/callback/keycloak"

KCADM="/opt/keycloak/bin/kcadm.sh"
KCADM_ADMIN_USER="${KCADM_ADMIN_USER:-admin}"
KCADM_ADMIN_PASSWORD="${KCADM_ADMIN_PASSWORD:-admin}"

echo "== Logging into master realm =="
$KCADM config credentials --server http://localhost:8080 --realm master --user "$KCADM_ADMIN_USER" --password "$KCADM_ADMIN_PASSWORD"

# Only touch sslRequired for a plain-http APP_PUBLIC_URL (local dev). A
# real https:// APP_PUBLIC_URL means this is a production-style deploy —
# leave sslRequired at its default rather than silently weakening it.
case "$APP_PUBLIC_URL" in
  https://*)
    echo "== APP_PUBLIC_URL is https:// — leaving sslRequired at its default =="
    ;;
  *)
    echo "== Dev-only: disabling SSL-required on master (see README) =="
    $KCADM update realms/master -s sslRequired=NONE
    ;;
esac

echo "== Creating realm: $REALM (skips if it already exists) =="
$KCADM create realms -s realm="$REALM" -s enabled=true 2>/dev/null || echo "   (already exists)"

case "$APP_PUBLIC_URL" in
  https://*) ;;
  *)
    echo "== Dev-only: disabling SSL-required on $REALM =="
    $KCADM update realms/"$REALM" -s sslRequired=NONE
    ;;
esac

echo "== Setting login theme to find-my-game-parts, enabling self-registration =="
# registrationAllowed puts a "Register" link on Keycloak's own hosted login
# page — the registration form (username/email/name/password) is served by
# the same theme automatically, since it extends keycloak.v2 broadly rather
# than forking specific templates (confirmed live: same pf-v5-c-button.pf-m-primary
# classes this theme's CSS already targets). No app-side changes needed —
# it's a Keycloak-hosted page, reached the same way login already is.
$KCADM update realms/"$REALM" -s loginTheme=find-my-game-parts -s registrationAllowed=true

echo "== Creating client: $CLIENT_ID (skips if it already exists) =="
# Public client (Authorization Code + PKCE, no client secret) — the app
# (lib/auth.ts) sets token_endpoint_auth_method: "none" to match. A
# confidential client here would make every login fail with
# "client_secret_basic client authentication method requires a
# client_secret" (hit live), since the app never sends one.
CLIENT_UUID=$($KCADM create clients -r "$REALM" -i \
  -s clientId="$CLIENT_ID" \
  -s enabled=true \
  -s publicClient=true \
  -s protocol=openid-connect \
  -s redirectUris="[\"$REDIRECT_URI\"]" \
  -s webOrigins="[\"$APP_PUBLIC_URL\"]" \
  -s standardFlowEnabled=true \
  -s directAccessGrantsEnabled=false 2>/dev/null) || \
  CLIENT_UUID=$($KCADM get clients -r "$REALM" -q clientId="$CLIENT_ID" --fields id --format csv --noquotes | tail -1)
echo "   client id: $CLIENT_UUID"

# Idempotent even if the client already existed as confidential from
# before this script switched to publicClient=true.
$KCADM update clients/"$CLIENT_UUID" -r "$REALM" -s publicClient=true

echo "== Adding the group-membership protocol mapper (no console UI for this) =="
$KCADM create clients/"$CLIENT_UUID"/protocol-mappers/models -r "$REALM" \
  -s name=groups \
  -s protocol=openid-connect \
  -s protocolMapper=oidc-group-membership-mapper \
  -s 'config."full.path"=false' \
  -s 'config."id.token.claim"=true' \
  -s 'config."access.token.claim"=true' \
  -s 'config."userinfo.token.claim"=true' \
  -s 'config."claim.name"=groups' 2>/dev/null || echo "   (already exists)"

echo "== Creating the $ADMIN_GROUP group (skips if it already exists) =="
$KCADM create groups -r "$REALM" -s name="$ADMIN_GROUP" 2>/dev/null || echo "   (already exists)"

# Email verification — optional, only configured if SMTP_HOST is set, so
# local dev is untouched by default (registering there keeps working with
# no real email account needed). Must be set as a single JSON object in
# one -s call: per-field dot-notation (-s smtpServer.host=...) silently
# no-ops against a realm's smtpServer map — confirmed live by setting it
# that way and finding smtpServer still empty afterward, even though
# kcadm's own docs describe dot-notation as generally supported. All
# values must be strings (Keycloak's smtpServer is a Map<String,String>),
# including port/auth/starttls/ssl — a bare number or boolean here is a
# JSON-type mismatch against that schema, not just a style choice.
if [ -n "$SMTP_HOST" ]; then
  echo "== Configuring SMTP and enabling email verification =="
  $KCADM update realms/"$REALM" \
    -s verifyEmail=true \
    -s "smtpServer={\"host\":\"$SMTP_HOST\",\"port\":\"${SMTP_PORT:-587}\",\"from\":\"$SMTP_FROM\",\"auth\":\"true\",\"starttls\":\"true\",\"ssl\":\"false\",\"user\":\"$SMTP_USER\",\"password\":\"$SMTP_PASSWORD\"}"
else
  echo "== Skipping SMTP/email verification (SMTP_HOST not set) =="
fi

echo ""
echo "Done. Still manual, on purpose: creating real users (Users -> Add user),"
echo "adding them to the $ADMIN_GROUP group, and Google/Facebook IdP setup"
echo "(README's Keycloak setup section)."
