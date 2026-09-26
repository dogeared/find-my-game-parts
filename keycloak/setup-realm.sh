#!/bin/sh
# Bootstraps a Keycloak realm end-to-end, via kcadm — works for both local
# dev and production (see "Production deployment" in the README).
#
# Local dev why this exists: this Keycloak instance runs in `start-dev`
# mode with an embedded, non-persisted database (see docker-compose.yml) —
# a container *recreate* (not just a restart) wipes the realm entirely,
# and this has already happened twice during development. Re-running this
# script is faster and more reliable than redoing the console clicks by
# hand.
#
# Run from inside the Keycloak container (kcadm.sh only exists there):
#   docker compose exec keycloak sh -c "$(cat keycloak/setup-realm.sh)"   # local
#   render ssh find-my-game-parts-keycloak                                # production, then paste the script
#
# Set APP_PUBLIC_URL to your real https:// production app URL to run this
# against a production-style deploy — sslRequired is only ever disabled
# for a plain-http APP_PUBLIC_URL (see the case statements below), so
# this never weakens a real deployment.
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

echo "== Logging into master realm =="
$KCADM config credentials --server http://localhost:8080 --realm master --user admin --password admin

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

echo "== Setting login theme to find-my-game-parts =="
$KCADM update realms/"$REALM" -s loginTheme=find-my-game-parts

echo "== Creating client: $CLIENT_ID (skips if it already exists) =="
CLIENT_UUID=$($KCADM create clients -r "$REALM" -i \
  -s clientId="$CLIENT_ID" \
  -s enabled=true \
  -s publicClient=false \
  -s protocol=openid-connect \
  -s redirectUris="[\"$REDIRECT_URI\"]" \
  -s webOrigins="[\"$APP_PUBLIC_URL\"]" \
  -s standardFlowEnabled=true \
  -s directAccessGrantsEnabled=false 2>/dev/null) || \
  CLIENT_UUID=$($KCADM get clients -r "$REALM" -q clientId="$CLIENT_ID" --fields id --format csv --noquotes | tail -1)
echo "   client id: $CLIENT_UUID"

echo "== Client secret (put this in .env as KEYCLOAK_CLIENT_SECRET) =="
$KCADM get clients/"$CLIENT_UUID"/client-secret -r "$REALM"

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

echo ""
echo "Done. Still manual, on purpose: creating real users (Users -> Add user),"
echo "adding them to the $ADMIN_GROUP group, and Google/Facebook IdP setup"
echo "(README's Keycloak setup section)."
