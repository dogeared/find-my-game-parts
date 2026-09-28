FROM node:22-slim AS base
WORKDIR /app
# Prisma's query engine needs OpenSSL; node:22-slim doesn't ship it.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install

FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
# node_modules lives in its own anonymous volume in docker-compose.yml (kept
# separate from the bind-mounted source so hot-reload doesn't churn on it),
# which means a schema change or a fresh volume can leave the generated
# Prisma client stale or missing entirely. Regenerate on every start — it's
# fast and idempotent — rather than requiring a manual `prisma generate`.
CMD ["sh", "-c", "npx prisma generate && npm run dev"]

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# prisma generate only reads schema.prisma, it never connects — this
# placeholder just satisfies prisma.config.ts's env("DATABASE_URL")
# lookup at build time (mirrors .github/workflows/ci.yml). The real
# DATABASE_URL is a runtime env var, not a build arg — never wired
# through here, since Docker build args get baked into image history.
ENV DATABASE_URL=postgresql://user:password@localhost:5432/placeholder
RUN npx prisma generate
RUN npm run build

# Separate prod-deps stage: the `prisma` CLI (and vitest, eslint, etc.) are
# devDependencies with vulnerable transitive deps (mysql2, deepmerge-ts —
# irrelevant to us on Postgres, but no reason to ship them). Only
# @prisma/client's generated output and runtime deps make it to production.
FROM base AS prod-deps
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

FROM base AS production
ENV NODE_ENV=production
# No public/ dir exists in this repo yet (no static assets) — add this
# COPY back if one gets added later.
COPY --from=build /app/.next ./.next
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/prisma ./prisma
# opengraph-image.tsx reads these fonts from disk at request time — not
# traced/bundled automatically (no `output: "standalone"`), same class of
# bug as the earlier missing prisma.config.ts copy.
COPY --from=build /app/assets ./assets
EXPOSE 3000
CMD ["npm", "run", "start"]
