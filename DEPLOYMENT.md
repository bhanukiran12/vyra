# =============================================
# Vyra - Production Deployment Guide
# =============================================

## Overview

Vyra is a full-stack real-time multiplayer board game built with FastAPI (Python) and React. This guide covers production deployment with proper WebSocket support.

## Quick Start (Render.com)

Render.com is the recommended hosting platform for easy deployment with free tier support.

### Step 1: Fork/Clone Repository
```bash
git clone https://github.com/your-repo/vyra.git
cd vyra
```

### Step 2: Create Render Account
- Sign up at https://render.com (free tier available)
- Connect your GitHub repository

### Step 3: Create MongoDB Database
1. Go to https://dashboard.render.com/databases
2. Create New → PostgreSQL/MongoDB → MongoDB
3. Name: `vyra-database`
4. Plan: Free Sandbox (for testing) or Starter ($7/mo for production)
5. Wait for database to be created

### Step 4: Deploy Backend
1. Create New → Web Service
2. Connect repository: `vyra`
3. Configure:
   - **Name**: vyra-backend
   - **Region**: Choose closest
   - **Branch**: main
   - **Runtime**: Python 3.11
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`
   - **Plan**: Starter ($7/mo) - **Required for WebSocket persistence**
4. Environment Variables (add to Settings → Environment):
   - `JWT_SECRET`: Generate with `openssl rand -hex 32`
   - `DB_NAME`: `vyra`
   - `CORS_ORIGINS`: `https://vyra-vyra.onrender.com` (or your custom domain)
   - `LOG_LEVEL`: `INFO`
5. Auto-Deploy: ✅ Enabled
6. Click **Create Web Service**

### Step 5: Deploy Frontend (Optional)
If deploying separately:
1. Create New → Static Site
2. Configure:
   - **Name**: vyra-frontend
   - **Root Directory**: `frontend`
   - **Build Command**: `cd frontend && yarn install --frozen-lockfile && yarn build`
   - **Publish Directory**: `frontend/build`
3. Environment Variables:
   - `REACT_APP_BACKEND_URL`: (leave empty to use relative path)

### Step 6: Test Deployment
- Backend health: `https://vyra-backend.onrender.com/api/health`
- Frontend: `https://vyra-frontend.onrender.com`
- WebSocket test: Create a game room and join with another browser

## Docker Deployment

### Using Docker Compose (Recommended)

```bash
# Development (with hot reload)
docker compose up --build

# Production (optimized, no rebuild needed)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

### Using Single Docker Image

```bash
# Build production image
docker build --target all-in-one -t vyra-app .

# Run with environment variables
docker run -d \
  -p 80:80 \
  -p 443:443 \
  -p 10000:10000 \
  -e MONGO_URL=mongodb://user:pass@host:27017/vyra \
  -e JWT_SECRET=your-32-char-secret-key \
  -e CORS_ORIGINS=https://yourdomain.com \
  -e LOG_LEVEL=INFO \
  --name vyra \
  vyra-app

# Check logs
docker logs -f vyra

# Stop
docker stop vyra
```

## Manual Deployment

### Prerequisites
- Python 3.11+
- Node.js 20+
- MongoDB 7.0+
- Nginx (reverse proxy)
- SSL certificates (Let's Encrypt recommended)

### Backend Setup

```bash
# Clone repository
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export JWT_SECRET="your-secret-key"
export MONGO_URL="mongodb://localhost:27017/vyra"
export DB_NAME="vyra"
export CORS_ORIGINS="https://yourdomain.com"

# Start server
uvicorn server:app --host 0.0.0.0 --port 10000
```

### Frontend Setup

```bash
# Clone repository
cd frontend

# Install dependencies
yarn install --frozen-lockfile

# Build for production
yarn build

# Serve with nginx
# Copy build output to nginx root directory
```

### Nginx Configuration

See `nginx.conf` for complete configuration. Key points:

1. **WebSocket Support**:
```nginx
location /api/ws/ {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

2. **Reverse Proxy**:
```nginx
location /api/ {
    proxy_pass http://backend:10000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

3. **Static Files**:
```nginx
location / {
    root /usr/share/nginx/html;
    try_files $uri $uri/ /index.html;
}
```

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | JWT signing secret (32+ chars) | `openssl rand -hex 32` |
| `MONGO_URL` | MongoDB connection string | `mongodb://user:pass@host:27017/db` |
| `DB_NAME` | Database name | `vyra` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `CORS_ORIGINS` | Allowed origins (comma-separated) | `*` |
| `PORT` | Server port | `10000` |
| `LOG_LEVEL` | Logging level (DEBUG/INFO/WARNING/ERROR) | `INFO` |
| `ENABLE_HEALTH_CHECK` | Enable health endpoints | `true` |
| `WS_PING_INTERVAL` | WebSocket ping interval (sec) | `20` |
| `WS_PING_TIMEOUT` | WebSocket ping timeout (sec) | `10` |

### Frontend

| Variable | Description | Default |
|----------|-------------|---------|
| `REACT_APP_BACKEND_URL` | Backend API URL | `window.location.origin` |

## WebSocket Troubleshooting

### Issue: WebSocket connections fail in production

**Causes**:
1. Reverse proxy not configured for WebSocket upgrade
2. Wrong WebSocket URL (ws:// instead of wss://)
3. CORS restrictions blocking connection
4. Load balancer timeout

**Solutions**:

1. **Nginx Configuration**: Ensure `/api/ws/` location has:
```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_read_timeout 86400s;
```

2. **HTTPS**: Use `wss://` for secure connections:
```javascript
// WebSocket URL should be:
wss://yourdomain.com/api/ws/{code}?token={jwt}
```

3. **CORS**: Set allowed origins properly:
```bash
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

4. **Render Free Tier**: WebSocket connections drop after 15 min idle. Upgrade to Starter ($7/mo).

### Issue: 4401 Unauthorized when connecting

**Causes**:
1. Invalid or missing JWT token
2. Token expired
3. Token not in localStorage

**Solutions**:
```javascript
// Check token exists
const token = localStorage.getItem('vyra_token');
if (!token) {
    // Re-authenticate user
}
```

### Issue: 4404 Room not found

**Causes**:
1. Room code is incorrect
2. Room doesn't exist in database
3. Database connection issue

**Solutions**:
```javascript
// Verify room exists before connecting
await api.get(`/api/rooms/${code}`);
```

## Scaling Considerations

### Horizontal Scaling

For multiple backend instances, use Redis for WebSocket state management:

1. Add Redis to docker-compose.yml:
```yaml
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
```

2. Update backend to use Redis:
```python
# Use Redis pub/sub for cross-instance communication
import redis.asyncio as redis

redis_client = redis.from_url("redis://redis:6379/0")
```

### Database

- Use MongoDB replica set for high availability
- Enable regular backups
- Monitor connection pool size

### Load Balancing

- Enable sticky sessions (session affinity)
- Use Redis for shared state
- Configure health checks

## Monitoring

### Health Checks

```bash
# Backend health
curl http://localhost:10000/api/health

# Frontend health
curl http://localhost/80/health
```

### Logs

```bash
# Docker logs
docker logs -f vyra-backend

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### Metrics

Consider adding:
- Prometheus for metrics
- Grafana for dashboards
- Sentry for error tracking

## Security Checklist

- [ ] Change default MongoDB credentials
- [ ] Set strong JWT_SECRET (32+ random chars)
- [ ] Enable HTTPS with Let's Encrypt
- [ ] Set restrictive CORS_ORIGINS
- [ ] Use firewall (UFW) to restrict ports
- [ ] Enable MongoDB authentication
- [ ] Regular backups configured
- [ ] Update dependencies regularly
- [ ] Monitor logs for suspicious activity
- [ ] Use `.env` file, never commit secrets

## Backup Strategy

### MongoDB Backups

```bash
# Daily backup
mongodump --uri="mongodb://user:pass@host:27017/vyra" --out=/backup/$(date +%Y%m%d)

# Restore
mongorestore --uri="mongodb://user:pass@host:27017/vyra" /backup/20241201/vyra
```

### Render Database Backups

Render provides automated daily backups for paid plans.

## Cost Estimation

| Service | Plan | Cost/Month |
|---------|------|------------|
| Render Backend | Starter | $7 |
| Render Database | Shared CPU | $7 |
| Render Frontend | Free | $0 |
| Domain | Namecheap | $1 |
| SSL | Let's Encrypt | $0 |
| **Total** | | **~$15** |

## Support

For issues or questions:
1. Check Render logs: https://dashboard.render.com/[service]/logs
2. Review this guide
3. Check WebSocket troubleshooting section
4. Verify environment variables
5. Test with development build first

## Quick Commands

```bash
# Deploy all changes
git add . && git commit -m "Update" && git push

# View logs
docker compose logs -f

# Rebuild images
docker compose up --build -d

# Stop services
docker compose down

# Clean up
docker compose down -v

# Production deploy
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Notes

- Render Free tier WebSocket connections timeout after 15 min of inactivity
- Consider upgrading to Starter plan for production use ($7/mo)
- MongoDB backups essential for data safety
- Always test in development before deploying to production
- Use HTTPS in production (Let's Encrypt is free)
- Monitor application logs regularly
