# =============================================
# Multi-stage build for Vyra full-stack app
# =============================================

# =============================================
# Stage 1: Build the frontend
# =============================================
FROM node:20-alpine AS frontend

WORKDIR /app/frontend

# Copy package files
COPY frontend/package*.json ./
COPY frontend/yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source code
COPY frontend/ ./

# Build the app
RUN yarn build

# =============================================
# Stage 2: Backend with Python + Uvicorn
# =============================================
FROM python:3.11-slim AS backend

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements
COPY backend/requirements.txt ./

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ ./

# Copy built frontend to static directory
COPY --from=frontend /app/frontend/build ./static

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Environment variables
ENV PORT=10000
ENV PYTHONUNBUFFERED=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:${PORT}/api/health')" || exit 1

# Expose port
EXPOSE 10000

# Use entrypoint for validation
ENTRYPOINT ["docker-entrypoint.sh"]

# Default command
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "10000"]

# =============================================
# Stage 3: Production Nginx + Backend (All-in-One)
# =============================================
FROM nginx:1.25-alpine AS production

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl bash

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built frontend from frontend stage
COPY --from=frontend /app/frontend/build /usr/share/nginx/html

# Copy backend (standalone)
FROM backend AS backend-only

# Combine nginx + backend for true all-in-one
FROM production AS all-in-one

# Install Python for backend
RUN apk add --no-cache python3 py3-pip bash

# Install Python dependencies
COPY backend/requirements.txt ./
RUN pip install --break-system-packages --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ ./

# Also expose the frontend build to the backend app so the API process can
# serve the SPA if the platform routes traffic directly to PORT 10000.
COPY --from=frontend /app/frontend/build ./static

# Copy nginx config with backend upstream
COPY nginx.allinone.conf /etc/nginx/nginx.conf

# Copy entrypoint
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Health check (checks both nginx and backend)
HEALTHCHECK --interval=30s --timeout=10s --start-period=50s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Expose ports
EXPOSE 80 443

# Entrypoint
ENTRYPOINT ["docker-entrypoint.sh"]

# Start both backend and nginx
CMD /bin/sh -c ' \
    # Start uvicorn in background \
    uvicorn server:app --host 0.0.0.0 --port 10000 & \
    \
    # Log backend readiness without blocking container startup \
    ( \
        until curl -sf http://localhost:10000/api/health > /dev/null; do \
            echo "Waiting for backend..."; \
            sleep 2; \
        done; \
        echo "Backend is ready." \
    ) & \
    \
    # Start nginx in foreground immediately so the container is reachable \
    echo "Starting nginx..."; \
    nginx -g "daemon off;" \
'

# =============================================
# Build Instructions:
# =============================================
# 
# Development (backend only):
#   docker build --target backend -t vyra-backend .
#
# Production (all-in-one with nginx):
#   docker build --target all-in-one -t vyra-app .
#
# Run all-in-one:
#   docker run -p 80:80 -p 443:443 -p 10000:10000 \
#     -e MONGO_URL=mongodb://host:27017/vyra \
#     -e JWT_SECRET=your-secret \
#     -e CORS_ORIGINS=https://yourdomain.com \
#     vyra-app
