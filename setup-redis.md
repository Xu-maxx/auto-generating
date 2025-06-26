# Redis Setup Guide

## Option 1: Docker (Recommended)

1. Install Docker Desktop for Windows
2. Run Redis container:
```bash
docker run -d --name material-gen-redis -p 6379:6379 redis:7-alpine
```

3. Verify Redis is running:
```bash
docker exec -it material-gen-redis redis-cli ping
```
Should return `PONG`

## Option 2: WSL (Windows Subsystem for Linux)

1. Install WSL2 and Ubuntu
2. Install Redis:
```bash
sudo apt update
sudo apt install redis-server
```

3. Start Redis:
```bash
sudo service redis-server start
```

4. Test connection:
```bash
redis-cli ping
```

## Option 3: Windows Native

1. Download Redis for Windows from: https://github.com/tporadowski/redis/releases
2. Install and run as a Windows service
3. Test connection from PowerShell:
```bash
redis-cli ping
```

## Verification

Test your Redis connection by running:
```bash
npm run dev
```

Check the console for "Redis Client Connected" message.

## Environment Configuration

Add to your `.env.local` file:
```
REDIS_URL=redis://localhost:6379
```

## Production Notes

For production, consider:
- Redis Cloud (https://redis.com/cloud/)
- AWS ElastiCache
- Azure Cache for Redis

The application will gracefully handle Redis connection failures and show appropriate error messages. 