# syntax=docker/dockerfile:1

# ---- build stage: compile TypeScript with full (dev) dependencies ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json .npmrc ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- runtime stage: slim image with production dependencies only ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json .npmrc ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY migrations ./migrations
# Run as the unprivileged built-in `node` user.
USER node
EXPOSE 3000
# Apply pending migrations, then start the server. If migrations fail, the server
# never starts (exit-on-failure), so we never serve against an out-of-date schema.
CMD ["sh", "-c", "node dist/db/migrate.js up && node dist/server.js"]
