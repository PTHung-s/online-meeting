# syntax=docker/dockerfile:1

# --- Build Stage: Client ---
FROM node:20-alpine AS build-client
WORKDIR /client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# --- Build Stage: Server ---
FROM node:20-alpine AS build-server
WORKDIR /server
COPY server/package*.json ./
RUN npm install
COPY server/ ./
RUN npm run build

# --- Final Production Stage ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build-server /server/dist ./dist
COPY --from=build-server /server/node_modules ./node_modules
COPY --from=build-server /server/package*.json ./

# Also copy built client to static if server is supposed to serve it
# In a professional setup, Nginx serves client. But for this Dockerfile:
# COPY --from=build-client /client/dist ./public

EXPOSE 5000
CMD ["npm", "start"]
