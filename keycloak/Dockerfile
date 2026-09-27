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

# Production mode defaults --cache to 'ispn', clustering via JGroups/
# Infinispan across server nodes — pure overhead for this single-instance
# deployment (no HA per the design doc's stated scope), and confirmed via
# a real Render deploy to be what pushed the container over the starter
# plan's 512Mi limit (Out of memory, repeated JGroups connection-handshake
# failures in the logs). 'local' disables clustering entirely.
ENV KC_CACHE=local

# Still OOM'd on the starter plan's 512Mi even with clustering disabled —
# kc.sh's own container-aware default (JAVA_OPTS_KC_HEAP, confirmed by
# reading kc.sh/kc.bat directly) sizes the heap to 70% of detected
# container memory, plus a 256m metaspace cap from its other JAVA_OPTS
# default. An initial pass at 50%/128m still measured at 433Mi/512Mi
# (84%) idle in local testing (no traffic yet) and still OOM'd on Render
# — Render's actual enforcement runs tighter than a local --memory=512m
# test reproduces, so this leaves real headroom rather than living at
# the edge of a limit that can't be verified precisely from outside.
ENV JAVA_OPTS_KC_HEAP="-XX:MaxRAMPercentage=35 -XX:MinRAMPercentage=35 -XX:InitialRAMPercentage=25"
ENV JAVA_OPTS_APPEND="-XX:MaxMetaspaceSize=128m -XX:MetaspaceSize=64m"

COPY docker-entrypoint.sh /opt/keycloak/bin/docker-entrypoint.sh
USER root
RUN chmod +x /opt/keycloak/bin/docker-entrypoint.sh
USER keycloak

ENTRYPOINT ["/opt/keycloak/bin/docker-entrypoint.sh"]
CMD ["start", "--optimized"]
