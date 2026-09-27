#!/bin/sh
set -e

# Render's `fromDatabase` connectionString gives a plain postgresql://
# URI with embedded credentials (postgresql://user:pass@host[:port]/db).
# Keycloak's JDBC driver rejects that shape outright ("Driver does not
# support the provided URL") — it needs jdbc:postgresql://host[:port]/db,
# with credentials supplied separately via KC_DB_USERNAME/KC_DB_PASSWORD
# (see render.yaml). Rewrite it here rather than ask Render to produce a
# JDBC URL directly — its Postgres fromDatabase `property` only supports
# connectionString/connectionPoolString/user/password/database, never a
# JDBC-shaped value or bare host/port.
case "$KC_DB_URL" in
  jdbc:*) ;;
  *://*@*)
    KC_DB_URL="jdbc:postgresql://$(echo "$KC_DB_URL" | sed -E 's#^[a-zA-Z0-9+.-]+://[^@]*@##')"
    export KC_DB_URL
    ;;
esac

exec /opt/keycloak/bin/kc.sh "$@"
