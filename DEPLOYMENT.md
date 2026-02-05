# ROR Partnership Platform - Deployment Guide

## Coolify Deployment

### Prerequisites

1. Coolify instance running
2. Domain configured (e.g., api.rorpartnership.com)
3. SSL certificate (Coolify handles this automatically)

### Deployment Steps

#### 1. Create New Service in Coolify

1. Go to your Coolify dashboard
2. Click **"New Resource"** → **"Docker Compose"**
3. Connect your Git repository or upload the project
4. Select the `docker-compose.yml` file

#### 2. Configure Environment Variables

In Coolify's environment variables section, add:

```bash
# Required
BUN_ENV=production
PORT=3000
JWT_SECRET=<generate-with: openssl rand -base64 64>
API_URL=https://api.rorpartnership.com
APP_URL=https://dashboard.rorpartnership.com
MOBILE_APP_SCHEME=rorpartnership

# MongoDB (use Coolify's built-in MongoDB or external)
MONGODB_URI=mongodb://mongo:27017/ror_partnership
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=<secure-password>

# Redis
REDIS_URL=redis://redis:6379

# KingsChat OAuth
KINGCHAT_CLIENT_ID=com.kingschat
KINGCHAT_CALLBACK_URL=https://api.rorpartnership.com/v1/auth/kingschat/callback

# Payment Gateways (add your production keys)
PAYSTACK_SECRET_KEY=sk_live_xxxxx
PAYSTACK_PUBLIC_KEY=pk_live_xxxxx
```

#### 3. Configure Domain & SSL

1. In Coolify, go to **"Domains"**
2. Add your domain: `api.rorpartnership.com`
3. Enable **"SSL"** (Let's Encrypt)
4. Set the service to expose port **3000**

#### 4. Deploy

Click **"Deploy"** and wait for the build to complete.

### API-Only Deployment (Without Docker Compose)

If you only want to deploy the API (using external MongoDB/Redis):

#### 1. Create Dockerfile-based Service

1. In Coolify: **"New Resource"** → **"Dockerfile"**
2. Point to `/apps/api/Dockerfile`
3. Set build context to repository root

#### 2. Environment Variables

```bash
BUN_ENV=production
PORT=3000
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/ror_partnership
REDIS_URL=redis://your-redis-host:6379
JWT_SECRET=<your-secret>
API_URL=https://api.rorpartnership.com
APP_URL=https://dashboard.rorpartnership.com
KINGCHAT_CALLBACK_URL=https://api.rorpartnership.com/v1/auth/kingschat/callback
```

### KingsChat OAuth Setup

For KingsChat authentication to work:

1. **API_URL** must be publicly accessible (HTTPS)
2. **KINGCHAT_CALLBACK_URL** must be `{API_URL}/v1/auth/kingschat/callback`
3. Update mobile app's `api.config.ts`:
   ```typescript
   webCallbackBase: 'https://api.rorpartnership.com'
   ```

### Health Check

Test your deployment:

```bash
curl https://api.rorpartnership.com/v1/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-02-05T12:00:00.000Z",
  "version": "1.0.0"
}
```

### Troubleshooting

#### KingsChat "No access token received"
- Ensure `API_URL` is correct and publicly accessible
- Check that `KINGCHAT_CALLBACK_URL` matches exactly
- Verify mobile app's `webCallbackBase` points to your API

#### MongoDB Connection Failed
- Check `MONGODB_URI` is correct
- Ensure MongoDB is running and accessible
- Check network/firewall settings

#### CORS Errors
- Verify `APP_URL` is in the allowed origins
- Check the mobile app scheme is correct

### Monitoring

Coolify provides built-in:
- Container logs
- Resource usage metrics
- Health check status

### Scaling

To scale the API:
1. In Coolify, increase replicas
2. Or use Docker Swarm mode

### Backup

MongoDB data is persisted in Docker volumes. For backups:
```bash
docker exec ror-mongo mongodump --out /backup
docker cp ror-mongo:/backup ./mongo-backup
```

---

## Local Development with Docker

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop services
docker-compose down

# Rebuild after changes
docker-compose up -d --build api
```

## Production Checklist

- [ ] Strong JWT_SECRET generated
- [ ] MongoDB authentication enabled
- [ ] Redis password set (if exposed)
- [ ] SSL/HTTPS configured
- [ ] Payment gateway keys are production keys
- [ ] KingsChat callback URL is correct
- [ ] Backup strategy in place
- [ ] Monitoring configured
