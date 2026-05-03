# Storage Management Strategy for Synapse Edit

## Problem
When users upload many videos, the `uploads` directory grows to 5GB+, causing:
- Vite file watcher overload
- Browser reconnection drops every 30-50 seconds
- Storage exhaustion on Replit

## Solution: Automatic Storage Cleanup Service

### How It Works

#### 1. **Scheduled Cleanup (Every 30 Minutes)**
- Runs automatically on server startup
- Then executes every 30 minutes
- Cleans up without affecting user operations

#### 2. **Three-Tier Cleanup Strategy**

**Tier 1: Delete Old Temporary Files (7+ days old)**
- `uploads/frames/` - Deleted after 7 days
- `uploads/audio/` - Deleted after 7 days  
- `uploads/temp-clips/` - Deleted after 7 days
- `uploads/thumbnails/` - Deleted after 7 days

**Tier 2: Enforce Storage Quotas**
- **Video Storage Limit:** 5GB
  - If exceeded, deletes oldest videos first
- **Temp Storage Limit:** 500MB per directory
  - If exceeded, deletes oldest files first

**Tier 3: Intelligent Deletion**
- Deletes oldest files first (by modification time)
- Only deletes when limits exceeded
- Logs all cleanup actions for monitoring

### Configuration

Edit `server/services/storage-cleanup.ts` to adjust:

```typescript
// Maximum storage sizes (adjust as needed)
const MAX_VIDEO_STORAGE_MB = 5000;      // 5GB for videos
const MAX_TEMP_STORAGE_MB = 500;        // 500MB for temp files

// How long to keep temp files (in days)
const FILE_RETENTION_DAYS = 7;          // Keep for 7 days

// Cleanup frequency (in minutes)
StorageCleanup.schedulePeriodicCleanup(30); // Every 30 minutes
```

### What Gets Cleaned

| Directory | Max Size | Retention | Purpose |
|-----------|----------|-----------|---------|
| `/uploads/videos/` | 5GB | Auto-delete when over | Generated videos |
| `/uploads/frames/` | 500MB | 7 days old | AI analysis frames |
| `/uploads/audio/` | 500MB | 7 days old | Audio extraction |
| `/uploads/temp-clips/` | 500MB | 7 days old | Temporary clips |
| `/uploads/thumbnails/` | 500MB | 7 days old | Video thumbnails |

### Logs to Monitor

```
[StorageCleanup] Starting full storage cleanup...
[StorageCleanup] Cleaned /uploads/frames: deleted 50 files, 200MB remaining
[StorageCleanup] Video storage 5200MB exceeds limit 5000MB, cleaning up oldest files...
[StorageCleanup] Deleted 12 files from /uploads/videos. New size: 4800MB
[StorageCleanup] Full cleanup complete
```

### How This Prevents the Connection Issue

1. **File watcher never sees huge accumulation** - Old files cleaned regularly
2. **Disk space stays manageable** - 5GB cap on videos prevents runaway growth
3. **Temp files auto-expire** - No stale frame/audio files piling up
4. **Non-blocking** - Cleanup runs in background every 30 minutes
5. **Production-ready** - Scales with number of users and videos

### For Production Deployment

When deploying to production:
- Reduce cleanup interval to `20` minutes for higher traffic
- Consider adding S3/cloud storage integration for unlimited video hosting
- Monitor logs to adjust storage limits based on actual usage

### Future Enhancements

Consider implementing:
1. **Cloud Storage Integration** - Move videos to S3/Google Cloud Storage
2. **Database Cleanup** - Delete project records and metadata after 30 days
3. **User Storage Quotas** - Limit storage per user account
4. **Alert System** - Notify admins when storage exceeds 80% of limit

---

**Status:** ✅ Implemented and active on server startup
**Next Restart:** Cleanup service will activate automatically
