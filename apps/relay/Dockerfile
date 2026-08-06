FROM node:20-slim

WORKDIR /app

# Copy the relay package files and install deps.
COPY apps/relay/package.json apps/relay/package-lock.json* ./
RUN npm install --production=false

# Copy the source and build.
COPY apps/relay/tsconfig.json ./
COPY apps/relay/src ./src
RUN npm run build

# Production deps only.
RUN npm prune --production

EXPOSE 8080
ENV PORT=8080

CMD ["node", "dist/index.js"]