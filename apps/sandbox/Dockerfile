FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/sandbox ./apps/sandbox
COPY tsconfig.strict.json ./tsconfig.strict.json
RUN npm ci
EXPOSE 4310
CMD ["npx", "tsx", "apps/sandbox/src/server.ts"]
