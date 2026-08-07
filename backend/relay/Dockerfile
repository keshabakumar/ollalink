FROM node:20-slim

WORKDIR /app

# Copy only the relay package — no monorepo root, no workspace deps.
COPY backend/relay/package.json ./
RUN npm install

# Copy source and build.
COPY backend/relay/tsconfig.json ./
COPY backend/relay/src ./src
RUN npm run build

# Prune dev deps.
RUN npm prune --production

EXPOSE 8080
ENV PORT=8080

CMD ["node", "dist/index.js"]