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

# Reverse proxies (Render, Cloudflare Tunnel, most PaaS load balancers)
# terminate TLS at the edge and forward plain HTTP — hence http-enabled,
# rather than Keycloak terminating its own HTTPS.
#
# proxy-headers=forwarded + hostname-strict=false is Keycloak's own
# documented "Fully dynamic URLs" recipe (confirmed against
# keycloak.org/server/hostname) — required for serving more than one
# public hostname/realm off a single instance, which is the actual
# deployment shape now (see README's "Production deployment"). The more
# obvious-looking proxy-headers=xforwarded is documented as "Partially
# dynamic": only scheme/port/context-path resolve per-request, while the
# hostname itself stays statically defined — a real bug hit live: the
# initial redirect looked fine (the app already sends the browser to the
# right host), but Keycloak's own follow-up links (e.g.
# login-actions/authenticate) fell back to a different realm's fixed
# hostname, breaking the session cookie across origins ("we're sorry,
# cookie not found"). No KC_HOSTNAME is set here on purpose — fully
# dynamic mode derives it per-request instead.
ENV KC_HOSTNAME_STRICT=false
ENV KC_PROXY_HEADERS=forwarded
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
