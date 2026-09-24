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
CMD ["npm", "run", "dev"]

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
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
COPY --from=build /app/public ./public
COPY --from=build /app/.next ./.next
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma
EXPOSE 3000
CMD ["npm", "run", "start"]
