FROM node:20-slim

WORKDIR /app

# Copy only the relay package — no monorepo root, no workspace deps.
COPY package.json ./
RUN npm install

# Copy source and build.
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Prune dev deps.
RUN npm prune --production

EXPOSE 8080
ENV PORT=8080

CMD ["node", "dist/index.js"]