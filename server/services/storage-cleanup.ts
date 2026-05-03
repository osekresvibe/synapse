import fs from "fs";
import path from "path";
import { storage } from "../storage";
import { Project, Video } from "../types"; // Assuming Project and Video types are defined elsewhere
import { VideoProcessor } from "./video-processor";

const VIDEOS_DIR = path.join(process.cwd(), "uploads", "videos");
const THUMBNAILS_DIR = path.join(process.cwd(), "uploads", "thumbnails");
const FRAMES_DIR = path.join(process.cwd(), "uploads", "frames");
const AUDIO_DIR = path.join(process.cwd(), "uploads", "audio");
const TEMP_CLIPS_DIR = path.join(process.cwd(), "uploads", "temp-clips");

// Configuration: Max storage size (5GB for videos, 500MB for others)
const MAX_VIDEO_STORAGE_MB = 5000;
const MAX_TEMP_STORAGE_MB = 500;
const FILE_RETENTION_DAYS = 7; // Keep files for 7 days

console.log("[StorageCleanup] Initialized with retention:", FILE_RETENTION_DAYS, "days");

// File prefixes that indicate generated/temporary files (safe to delete)
const GENERATED_FILE_PREFIXES = [
  'clip-',
  'cropped-',
  'generated-',
  'graded-',
  'standard-',
  'transcribe-',
  'concat-',
  'export-',
];

export class StorageCleanup {
  /**
   * Get set of source video paths that are still needed by active projects
   */
  private static async getProtectedSourceVideoPaths(): Promise<Set<string>> {
    const protectedPaths = new Set<string>();

    try {
      // Get all active projects (not error/deleted status)
      const activeProjects = await this.getActiveProjects();
      // Include ALL projects that have a source video path, regardless of status
      // Only exclude if the project is explicitly marked as deleted
      const projects = await storage.getAllProjects();

      for (const project of projects) {
        // Protect source videos for projects that aren't in error state
        if (project.sourceVideoPath && project.status !== 'error') {
          protectedPaths.add(project.sourceVideoPath);
          // Also protect by filename only (in case path format differs)
          const filename = path.basename(project.sourceVideoPath);
          protectedPaths.add(path.join(VIDEOS_DIR, filename));
        }
      }

      console.log(`[StorageCleanup] Protecting ${protectedPaths.size} source videos from active projects`);
    } catch (err) {
      console.error('[StorageCleanup] Error getting protected paths:', err);
    }

    return protectedPaths;
  }

  /**
   * Get all active project source videos AND generated videos
   */
  private static async getActiveProjects(): Promise<Project[]> {
    const allProjects = await storage.getAllProjects();
    // Include ALL projects that have a source video path, regardless of status
    // Only exclude if the project is explicitly marked as deleted
    return allProjects.filter(p => p.sourceVideoPath);
  }

  /**
   * Check if a file is a generated/temporary file (safe to delete)
   */
  private static isGeneratedFile(filename: string): boolean {
    return GENERATED_FILE_PREFIXES.some(prefix => filename.startsWith(prefix));
  }
  /**
   * Get total size of a directory in bytes
   */
  private static getDirSize(dirPath: string): number {
    if (!fs.existsSync(dirPath)) return 0;

    let size = 0;
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);
      if (stat.isFile()) {
        size += stat.size;
      }
    }

    return size;
  }

  /**
   * Convert bytes to MB
   */
  private static bytesToMB(bytes: number): number {
    return Math.round(bytes / (1024 * 1024));
  }

  /**
   * Clean up old temp files (frames, audio, temp-clips)
   * Deletes files older than FILE_RETENTION_DAYS
   */
  static cleanupTempFiles(): void {
    const now = Date.now();
    const dirs = [FRAMES_DIR, AUDIO_DIR, TEMP_CLIPS_DIR];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) continue;

      try {
        const files = fs.readdirSync(dir);
        let deletedCount = 0;

        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          const ageInDays = (now - stat.mtimeMs) / (1000 * 60 * 60 * 24);

          // Delete if older than retention period
          if (ageInDays > FILE_RETENTION_DAYS) {
            try {
              fs.unlinkSync(filePath);
              deletedCount++;
            } catch (err) {
              console.warn(`[StorageCleanup] Failed to delete ${filePath}:`, err);
            }
          }
        }

        if (deletedCount > 0) {
          const sizeAfter = this.getDirSize(dir);
          console.log(
            `[StorageCleanup] Cleaned ${dir}: deleted ${deletedCount} files, ${this.bytesToMB(sizeAfter)}MB remaining`
          );
        }
      } catch (err) {
        console.error(`[StorageCleanup] Error cleaning ${dir}:`, err);
      }
    }
  }

  /**
   * Enforce storage quota: delete oldest files if exceeding max size
   * IMPORTANT: Protects source videos that are still needed by active projects
   */
  static async enforceStorageQuota(): Promise<void> {
    // Get protected paths first
    const protectedPaths = await this.getProtectedSourceVideoPaths();

    // Check and cleanup video storage
    const videoSizeBytes = this.getDirSize(VIDEOS_DIR);
    const videoSizeMB = this.bytesToMB(videoSizeBytes);

    if (videoSizeMB > MAX_VIDEO_STORAGE_MB) {
      console.log(
        `[StorageCleanup] Video storage ${videoSizeMB}MB exceeds limit ${MAX_VIDEO_STORAGE_MB}MB, cleaning up oldest files...`
      );
      await this.deleteOldestFiles(VIDEOS_DIR, MAX_VIDEO_STORAGE_MB, protectedPaths);
    }

    // Check and cleanup temp storage (thumbnails, frames, audio)
    const tempDirs = [THUMBNAILS_DIR, FRAMES_DIR, AUDIO_DIR];
    for (const dir of tempDirs) {
      const tempSizeBytes = this.getDirSize(dir);
      const tempSizeMB = this.bytesToMB(tempSizeBytes);

      if (tempSizeMB > MAX_TEMP_STORAGE_MB) {
        console.log(
          `[StorageCleanup] ${dir} is ${tempSizeMB}MB, exceeds limit ${MAX_TEMP_STORAGE_MB}MB, deleting oldest files...`
        );
        await this.deleteOldestFiles(dir, MAX_TEMP_STORAGE_MB, new Set()); // No protection for temp files
      }
    }
  }

  /**
   * Delete oldest files in directory until size is under limit
   * Prioritizes deleting generated files before source videos
   * Never deletes files in the protectedPaths set
   */
  private static async deleteOldestFiles(
    dirPath: string,
    maxSizeMB: number,
    protectedPaths: Set<string>
  ): Promise<void> {
    if (!fs.existsSync(dirPath)) return;

    try {
      const files = fs.readdirSync(dirPath);
      const fileStats = files
        .map((file) => {
          const filePath = path.join(dirPath, file);
          const stat = fs.statSync(filePath);
          const isGenerated = this.isGeneratedFile(file);
          const isProtected = protectedPaths.has(filePath);
          return {
            file,
            filePath,
            mtime: stat.mtimeMs,
            size: stat.size,
            isGenerated,
            isProtected,
            // Priority: generated files first (0), then unprotected old files (1), protected never (2)
            deletePriority: isProtected ? 2 : (isGenerated ? 0 : 1)
          };
        })
        // Sort by priority first, then by age (oldest first within each priority)
        .sort((a, b) => {
          if (a.deletePriority !== b.deletePriority) {
            return a.deletePriority - b.deletePriority;
          }
          return a.mtime - b.mtime;
        });

      let currentSizeBytes = this.getDirSize(dirPath);
      const maxSizeBytes = maxSizeMB * 1024 * 1024;
      let deletedCount = 0;
      let skippedProtected = 0;

      for (const { file, filePath, size, isProtected } of fileStats) {
        if (currentSizeBytes <= maxSizeBytes) break;

        // Never delete protected source videos
        if (isProtected) {
          skippedProtected++;
          continue;
        }

        try {
          fs.unlinkSync(filePath);
          currentSizeBytes -= size;
          deletedCount++;
          console.log(`[StorageCleanup] Deleted: ${file}`);
        } catch (err) {
          console.warn(`[StorageCleanup] Failed to delete ${filePath}:`, err);
        }
      }

      console.log(
        `[StorageCleanup] Deleted ${deletedCount} files from ${dirPath}. Skipped ${skippedProtected} protected. New size: ${this.bytesToMB(currentSizeBytes)}MB`
      );
    } catch (err) {
      console.error(`[StorageCleanup] Error enforcing quota for ${dirPath}:`, err);
    }
  }

  /**
   * Full cleanup routine (run on startup and periodically)
   */
  static async runFullCleanup(): Promise<void> {
    console.log("[StorageCleanup] Starting full storage cleanup...");
    this.cleanupTempFiles();
    await this.enforceStorageQuota();

    // Clean up extracted frames older than 24 hours
    let deletedFrames = 0;
    if (fs.existsSync(FRAMES_DIR)) {
      const frames = fs.readdirSync(FRAMES_DIR);
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

      for (const frame of frames) {
        const framePath = path.join(FRAMES_DIR, frame);
        const stats = fs.statSync(framePath);

        if (stats.mtimeMs < oneDayAgo) {
          fs.unlinkSync(framePath);
          deletedFrames++;
        }
      }
    }
    console.log(`[StorageCleanup] Deleted ${deletedFrames} old frames`);

    // Clean up orphaned upload chunks older than 6 hours
    const CHUNKS_DIR = path.join(process.cwd(), 'uploads', 'chunks');
    let deletedChunks = 0;

    if (fs.existsSync(CHUNKS_DIR)) {
      const uploadIds = fs.readdirSync(CHUNKS_DIR);
      const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;

      for (const uploadId of uploadIds) {
        const uploadPath = path.join(CHUNKS_DIR, uploadId);
        if (!fs.statSync(uploadPath).isDirectory()) continue;

        const stats = fs.statSync(uploadPath);
        if (stats.mtimeMs < sixHoursAgo) {
          fs.rmSync(uploadPath, { recursive: true, force: true });
          deletedChunks++;
        }
      }
    }
    console.log(`[StorageCleanup] Deleted ${deletedChunks} orphaned chunk directories`);

    console.log('[StorageCleanup] Full cleanup complete');
  }

  /**
   * Validate all projects - mark ones with missing files as "error"
   * This prevents users from getting stuck with unusable projects
   */
  static async validateProjectSourceFiles(): Promise<void> {
    console.log('[StorageCleanup] Validating project source files...');
    const projects = await storage.getAllProjects();

    for (const project of projects) {
      if (project.sourceVideoPath) {
        const fullPath = VideoProcessor.getFullPath(project.sourceVideoPath);
        if (!fs.existsSync(fullPath)) {
          console.warn(`[StorageCleanup] Missing video for project ${project.id}: ${fullPath}`);
          // Only mark as error if the project was previously in a working state
          if (project.status !== 'error' && project.status !== 'pending') {
            await storage.updateProject(project.id, { status: 'error' });
          }
        }
      }
    }

    console.log('[StorageCleanup] All project source files validated');
  }

  /**
   * Schedule periodic cleanup (runs every 30 minutes in production)
   */
  static schedulePeriodicCleanup(intervalMinutes: number = 30): void {
    const intervalMs = intervalMinutes * 60 * 1000;

    // Run immediately on startup - validate projects first, then cleanup
    this.validateProjectSourceFiles().then(() => {
      this.runFullCleanup();
    });

    // Then run periodically
    setInterval(() => {
      this.runFullCleanup();
    }, intervalMs);

    console.log(
      `[StorageCleanup] Scheduled periodic cleanup every ${intervalMinutes} minutes`
    );
  }
}