FROM node:20-bookworm-slim AS base
# fontconfig + fonts are required so sharp/librsvg can render the watermark text
# (without them the SVG text renders as empty "tofu" boxes).
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    openssl ca-certificates fontconfig fonts-liberation fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
RUN npm remove @shopify/cli || true

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci && npm cache clean --force
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN npm run build

FROM base AS runtime
COPY package.json package-lock.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3000
ENV PORT=3000

CMD ["npm", "run", "docker-start"]
