FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/scripts/serve-prod.mjs ./scripts/serve-prod.mjs
COPY --from=builder /app/scripts/ws-relay.mjs ./scripts/ws-relay.mjs
EXPOSE 8080
CMD ["node", "scripts/serve-prod.mjs"]
