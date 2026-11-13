# ==============================================================================
# Stage 1: Build React/Vite assets
# ==============================================================================
FROM node:20-alpine AS build

WORKDIR /app

# Cache dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code and config
COPY . .

# Build argument for backend REST & WebSocket URL resolution
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

ARG VITE_WS_URL
ENV VITE_WS_URL=${VITE_WS_URL}

ARG VITE_API_KEY
ENV VITE_API_KEY=${VITE_API_KEY}

# Compile production bundle
RUN npm run build

# ==============================================================================
# Stage 2: Serve static bundle via Nginx
# ==============================================================================
FROM nginx:alpine

# Copy custom Nginx configuration with SPA routing fallback
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
    CMD wget -qO- http://localhost/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
