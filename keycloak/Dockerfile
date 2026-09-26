# Production Keycloak image with the find-my-game-parts login theme baked
# in (no bind mount in production — see README's "Production deployment").
# Two-stage build+optimized-start pattern is Keycloak's own documented
# production setup; flags below (build --db, start --optimized,
# --hostname, --proxy-headers, --http-enabled) were confirmed directly
# against this exact image version's `kc.sh --help-all` output, not
# assumed from memory.
FROM quay.io/keycloak/keycloak:26.4 AS builder

ENV KC_HEALTH_ENABLED=true
ENV KC_METRICS_ENABLED=true
ENV KC_DB=postgres

COPY themes/find-my-game-parts /opt/keycloak/themes/find-my-game-parts

RUN /opt/keycloak/bin/kc.sh build

FROM quay.io/keycloak/keycloak:26.4
COPY --from=builder /opt/keycloak/ /opt/keycloak/

# Render (and most PaaS load balancers) terminate TLS at the edge and
# forward plain HTTP with X-Forwarded-* headers — hence http-enabled plus
# trusting xforwarded headers, rather than Keycloak terminating its own
# HTTPS. KC_HOSTNAME must be set at runtime to the real public URL (see
# render.yaml) — hostname-strict defaults to true in production and
# requires it.
ENV KC_PROXY_HEADERS=xforwarded
ENV KC_HTTP_ENABLED=true

ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
CMD ["start", "--optimized"]
