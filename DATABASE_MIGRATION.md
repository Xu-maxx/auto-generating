# Database Migration Guide: Redis to MongoDB

This guide explains how to migrate your application from Redis to MongoDB storage.

## Overview

The application now supports both Redis and MongoDB as storage backends. You can switch between them by changing the `STORAGE_TYPE` environment variable.

## MongoDB Connection Details

Add these settings to your `.env.local` file:

```env
# Database Configuration
STORAGE_TYPE=mongodb

# MongoDB Configuration
MONGODB_URI=mongodb://root:123456@192.168.0.239:27017/material_generation?authSource=admin

# Redis Configuration (keep for migration)
REDIS_URL=redis://localhost:6379
```

## Migration Steps

### Option 1: Automatic Migration (Recommended)

1. **Keep both Redis and MongoDB running** during migration
2. **Keep STORAGE_TYPE=redis** initially
3. **Call the migration API**:
   ```bash
   curl -X POST http://localhost:3000/api/database \
     -H "Content-Type: application/json" \
     -d '{"action": "migrate"}'
   ```
4. **Update environment variable**:
   ```env
   STORAGE_TYPE=mongodb
   ```
5. **Restart the application**

### Option 2: Manual Migration Steps

1. **Backup your current Redis data**:
   ```bash
   redis-cli BGSAVE
   ```

2. **Update your environment configuration**:
   ```env
   STORAGE_TYPE=mongodb
   MONGODB_URI=mongodb://root:123456@192.168.0.239:27017/material_generation?authSource=admin
   ```

3. **Restart the application**

4. **The application will automatically create the necessary MongoDB collections and indexes**

## Database Health Check

Check your database connection status:

```bash
curl http://localhost:3000/api/database
```

This will return:
- Database health status
- Current storage type
- Statistics (number of projects, sessions, avatar sessions)

## Database Operations

### Health Check
```bash
curl -X POST http://localhost:3000/api/database \
  -H "Content-Type: application/json" \
  -d '{"action": "health"}'
```

### Get Statistics
```bash
curl -X POST http://localhost:3000/api/database \
  -H "Content-Type: application/json" \
  -d '{"action": "stats"}'
```

## Storage Comparison

| Feature | Redis | MongoDB |
|---------|--------|---------|
| **Performance** | Excellent for caching | Good for complex queries |
| **Scalability** | Vertical scaling | Horizontal scaling |
| **Data Structure** | Key-value with sets | Document-based |
| **Querying** | Limited | Rich query language |
| **Persistence** | Memory + disk | Disk-based |
| **Backup** | RDB/AOF | Built-in backup tools |

## MongoDB Collections Structure

The application creates these collections:

- `projects` - Project documents
- `sessions` - Session documents  
- `avatar_sessions` - Avatar session documents
- `projects_sets` - Project relationship data
- `sessions_sets` - Session relationship data
- `avatar_sessions_sets` - Avatar session relationship data

## Indexes

Automatically created indexes:
- `projects.id` (unique)
- `sessions.id` (unique)
- `sessions.projectId`
- `avatar_sessions.id` (unique)
- `avatar_sessions.productId`

## Troubleshooting

### Connection Issues
```bash
# Test MongoDB connection
mongosh "mongodb://root:123456@192.168.0.239:27017/material_generation?authSource=admin"

# Test Redis connection
redis-cli -h localhost -p 6379 ping
```

### Common Issues

1. **Authentication Error**: Ensure MongoDB credentials are correct
2. **Network Error**: Check MongoDB server IP and port
3. **Permission Error**: Ensure MongoDB user has read/write permissions
4. **Collection Not Found**: Run the application once to create collections automatically

### Migration Troubleshooting

1. **Partial Migration**: Check logs for specific errors
2. **Data Loss**: Ensure both databases are accessible during migration
3. **Performance Issues**: Migration may take time for large datasets

## Performance Considerations

### Redis (Current)
- ✅ Ultra-fast in-memory operations
- ✅ Excellent for session data
- ❌ Limited querying capabilities
- ❌ Memory constraints

### MongoDB (New)
- ✅ Rich querying and indexing
- ✅ Better for complex data relationships
- ✅ Horizontal scaling capability
- ✅ Built-in backup and replication
- ❌ Slightly slower than Redis for simple operations

## Rollback Plan

To rollback to Redis:

1. **Update environment**:
   ```env
   STORAGE_TYPE=redis
   ```

2. **Restart the application**

3. **Your Redis data should still be available** (if not cleared)

## Best Practices

1. **Test in development** before production migration
2. **Backup both databases** before migration
3. **Monitor performance** after migration
4. **Keep Redis running** until migration is confirmed successful
5. **Use health checks** to monitor database status

## Support

For issues or questions:
1. Check the application logs
2. Use the health check API
3. Verify database connectivity
4. Check environment variables

The migration maintains 100% data compatibility between Redis and MongoDB storage systems. 