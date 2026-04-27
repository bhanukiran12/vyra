# Multi-stage build for Vyra full-stack app

# Stage 1: Build the frontend
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

# Stage 2: Setup the backend
FROM python:3.11-slim

WORKDIR /app

# Copy backend requirements
COPY backend/requirements.txt ./

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ ./

# Copy built frontend to static directory
COPY --from=frontend /app/frontend/build ./static

# Expose port 10000 for Render
EXPOSE 10000

# Run the FastAPI server
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "10000"]