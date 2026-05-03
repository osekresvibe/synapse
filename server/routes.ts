import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { uploadSessions as uploadSessionsTable } from "@shared/schema";
import { eq, lt, sql } from "drizzle-orm";
import { VideoProcessor } from "./services/video-processor";
import { AIAnalyzer } from "./services/ai-analyzer";
import { MockProcessor } from "./services/mock-processor";
import { TransitionEngine } from "./services/transition-engine";
import { ScriptAnalyzer } from "./services/script-analyzer";
import { TTSGenerator } from "./services/tts-generator";
import { SlideGenerator } from "./services/slide-generator";
import { CarouselGenerator, type CarouselSlide } from "./services/carousel-generator";
import {
  insertProjectSchema,
  insertReferenceVideoSchema,
  finalizationConfigSchema,
  type VideoAnalysisProgress,
  type TriptychVideos,
  type IntentConfig,
  type Project,
  type InsertSmartSlice,
} from "@shared/schema";
import { z } from "zod";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { nanoid } from "nanoid";
import multer from "multer";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import rateLimit from "express-rate-limit";
import OpenAI from "openai";
import pLimit from "p-limit";
import { AudioMixer } from './services/audio-mixer';
import { generateAIVideoFromScript } from './services/ai-video-generator';
import { PexelsAPI } from './services/pexels-api';
import { PromptRefiner } from './services/prompt-refiner';
import stockMediaRoutes from "./routes/stock-media";
import batchUploadRoutes from "./routes/batch-upload";
import compilationRoutes from "./routes/compilation";
import contentStudioRoutes from "./routes/content-studio";

// Mock mode for testing - ALWAYS DISABLED in production (set MOCK_MODE=true env var to enable)
const MOCK_MODE = false; // Explicitly disabled - comment out to enable mock testing
// const MOCK_MODE = process.env.MOCK_MODE === "true";

// Constants for directory paths
// CRITICAL FIX: Use persistent storage to prevent video loss
const PROCESSING_ROOT = path.join(process.cwd(), "uploads");
const UPLOADS_DIR = path.join(PROCESSING_ROOT, "videos"); // All videos (persistent)
const AUDIO_UPLOADS_DIR = path.join(PROCESSING_ROOT, "audio");
const TEMP_CLIPS_DIR = path.join(PROCESSING_ROOT, "temp-clips"); // Temp clips (persistent)
const VIDEOS_DIR = path.join(PROCESSING_ROOT, "videos"); // All videos (persistent)
const CHUNKS_DIR = path.join(PROCESSING_ROOT, "chunks"); // Chunked uploads (persistent)

// Ensure directories exist
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(AUDIO_UPLOADS_DIR)) {
  fs.mkdirSync(AUDIO_UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(TEMP_CLIPS_DIR)) {
  fs.mkdirSync(TEMP_CLIPS_DIR, { recursive: true });
}
if (!fs.existsSync(VIDEOS_DIR)) {
  fs.mkdirSync(VIDEOS_DIR, { recursive: true });
}
if (!fs.existsSync(CHUNKS_DIR)) {
  fs.mkdirSync(CHUNKS_DIR, { recursive: true });
}

// Initialize OpenAI client with runtime validation
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
let openai: OpenAI | null = null;

if (OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
  });
  console.log("[OpenAI] Client initialized successfully");
} else {
  console.warn("[OpenAI] API key not found - AI-powered features will be disabled");
  console.warn("[OpenAI] Add OPENAI_API_API_KEY to Replit Secrets");
}

// In-memory progress tracking
export const progressMap = new Map<string, VideoAnalysisProgress>();

// In-memory editing log clients (for SSE real-time updates)
interface EditingLogClient {
  res: any;
  projectId: string;
}
export const editingLogClients = new Map<string, EditingLogClient[]>();

// Function to broadcast editing progress to all connected clients
export function broadcastEditingProgress(projectId: string, update: any) {
  const clients = editingLogClients.get(projectId) || [];
  clients.forEach(client => {
    try {
      client.res.write(`data: ${JSON.stringify(update)}\n\n`);
    } catch (err) {
      console.warn(`[EditingLog] Failed to send to client:`, err);
    }
  });
}

// Function to complete editing log stream
export function completeEditingLog(projectId: string, eventType: string = "complete") {
  const clients = editingLogClients.get(projectId) || [];
  clients.forEach(client => {
    try {
      client.res.write(`event: ${eventType}\ndata: {}\n\n`);
      client.res.end();
    } catch (err) {
      console.warn(`[EditingLog] Failed to complete stream:`, err);
    }
  });
  editingLogClients.delete(projectId);
}

// Processing config type for upload sessions
interface ProcessingConfig {
  operation: 'original' | 'compress' | 'convert' | 'both';
  quality?: 'low' | 'medium' | 'high';
  targetFormat?: string;
}

// Database-backed upload session helpers (survives server restarts)
async function getUploadSession(sessionId: string) {
  const results = await db.select().from(uploadSessionsTable).where(eq(uploadSessionsTable.sessionId, sessionId));
  return results[0] || null;
}

async function createUploadSession(data: {
  sessionId: string;
  fileName: string;
  mimeType?: string;
  totalSize: number;
  totalChunks: number;
  uploadDir: string;
  batchId?: string | null;
  processingConfig?: ProcessingConfig | null;
}) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  await db.insert(uploadSessionsTable).values({
    sessionId: data.sessionId,
    fileName: data.fileName,
    mimeType: data.mimeType || null,
    totalSize: data.totalSize,
    totalChunks: data.totalChunks,
    completedChunksArray: [],
    status: 'uploading',
    uploadDir: data.uploadDir,
    batchId: data.batchId || null,
    processingConfig: data.processingConfig || null,
    expiresAt,
  });
}

async function addCompletedChunk(sessionId: string, chunkIndex: number) {
  // Use atomic JSONB update to prevent race conditions in concurrent uploads
  // This appends the chunk index only if it doesn't already exist in the array
  await db.execute(sql`
    UPDATE upload_sessions 
    SET completed_chunks_array = (
      SELECT jsonb_agg(DISTINCT val ORDER BY val)
      FROM jsonb_array_elements(
        COALESCE(completed_chunks_array, '[]'::jsonb) || ${JSON.stringify([chunkIndex])}::jsonb
      ) AS val
    )
    WHERE session_id = ${sessionId}
  `);

  // Return updated session
  return await getUploadSession(sessionId);
}

async function deleteUploadSession(sessionId: string) {
  await db.delete(uploadSessionsTable).where(eq(uploadSessionsTable.sessionId, sessionId));
}

// Cleanup expired upload sessions periodically (every 30 minutes)
setInterval(async () => {
  try {
    const now = new Date();
    const expiredSessions = await db.select().from(uploadSessionsTable).where(lt(uploadSessionsTable.expiresAt, now));

    for (const session of expiredSessions) {
      // Clean up directory
      try {
        if (fs.existsSync(session.uploadDir)) {
          const files = fs.readdirSync(session.uploadDir);
          files.forEach(file => {
            fs.unlinkSync(path.join(session.uploadDir, file));
          });
          fs.rmdirSync(session.uploadDir);
        }
      } catch (err) {
        console.warn(`[upload] Failed to cleanup session ${session.sessionId}:`, err);
      }
      await deleteUploadSession(session.sessionId);
    }

    if (expiredSessions.length > 0) {
      console.log(`[upload] Cleaned up ${expiredSessions.length} expired sessions`);
    }
  } catch (err) {
    console.error('[upload] Error during session cleanup:', err);
  }
}, 30 * 60 * 1000);

// Video processing helper functions
async function processVideoFromFile(projectId: string, videoPath: string) {
  console.log(`\n========================================`);
  console.log(`[processVideoFromFile] Starting processing for project ${projectId}`);
  console.log(`[processVideoFromFile] Video path: ${videoPath}`);
  console.log(`========================================\n`);

  try {
    // Update project status to processing
    await storage.updateProject(projectId, { status: "processing" });

    // Get project to check intent config
    const project = await storage.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const intentConfig = (project.intentConfig || {}) as IntentConfig;
    const intent = project.userIntent || "single-video";
    const isOneClick = intentConfig.isOneClick === true;

    if (isOneClick) {
      console.log(`[processVideoFromFile] ONE-CLICK MODE: Prioritizing speed for project ${projectId}`);
    }

    // Update progress
    progressMap.set(projectId, {
      stage: "analyzing",
      progress: 15,
      message: "Analyzing video content...",
    });
    broadcastEditingProgress(projectId, { stage: "analyzing", message: "Starting AI video analysis...", progress: 15 });

    // Analyze video with AI (static method)
    const analysis = await AIAnalyzer.analyzeVideo(videoPath, intent, projectId);

    console.log(`[processVideoFromFile] Analysis complete: ${analysis.slices.length} slices, category: ${analysis.videoCategory}`);

    // Store slices in database
    progressMap.set(projectId, {
      stage: "slicing",
      progress: 50,
      message: `Storing ${analysis.slices.length} smart slices...`,
    });
    broadcastEditingProgress(projectId, { stage: "slicing", message: `Found ${analysis.slices.length} smart slices`, progress: 50 });

    for (const slice of analysis.slices) {
      await storage.createSlice({
        ...slice,
        projectId,
      });
    }

    // Update project with metadata and category
    await storage.updateProject(projectId, {
      duration: Math.floor(analysis.metadata.duration),
      intentConfig: {
        ...intentConfig,
        videoCategory: analysis.videoCategory,
        detectedCategory: analysis.videoCategory,
      } as any,
    });

    // Get stored slices for video generation
    const slices = await storage.getSlicesByProject(projectId);
    const videoCategory = analysis.videoCategory || "generic";
    const targetDuration = intentConfig.targetDuration || 30;
    const aspectRatio = intentConfig.aspectRatio || "16:9";
    const outputMode = intentConfig.outputMode || "polished_reels";

    // Generate videos based on intent
    progressMap.set(projectId, {
      stage: "generating",
      progress: 60,
      message: "Generating videos from slices...",
    });
    broadcastEditingProgress(projectId, { stage: "generating", message: "Selecting best clips for video...", progress: 60 });

    // Determine video type based on intent
    let videoType: "short" | "standard" | "comprehensive" = "standard";
    if (intent === "multiple-shorts" || intent === "tiktok-series") {
      videoType = "short";
    } else if (intent === "comprehensive-edit") {
      videoType = "comprehensive";
    }

    // Select clips for video using AI
    const clipSequence = await AIAnalyzer.selectClipsForVideo(
      slices.map(s => ({
        id: s.id,
        startTime: s.startTime,
        endTime: s.endTime,
        engagementScore: s.engagementScore,
        clipType: s.clipType
      })),
      targetDuration,
      videoType,
      videoCategory,
      analysis.metadata.duration,
      undefined,
      undefined,
      undefined,
      videoCategory
    );

    console.log(`[processVideoFromFile] Selected ${clipSequence.length} clips for ${videoType} video`);

    if (clipSequence.length === 0) {
      throw new Error("No clips were selected for the video");
    }

    // Extract and concatenate clips
    progressMap.set(projectId, {
      stage: "generating",
      progress: 70,
      message: `Extracting ${clipSequence.length} clips...`,
    });
    broadcastEditingProgress(projectId, { stage: "generating", message: `Extracting ${clipSequence.length} clips...`, progress: 70 });

    const sequenceSlices = clipSequence
      .map(clipId => slices.find(s => s.id === clipId))
      .filter((s): s is typeof slices[0] => !!s);

    const clipPaths: string[] = [];
    for (let i = 0; i < sequenceSlices.length; i++) {
      const slice = sequenceSlices[i];
      const clipPath = await VideoProcessor.extractClip(
        videoPath,
        slice.startTime,
        slice.endTime
      );
      clipPaths.push(clipPath);

      const progress = 70 + Math.floor((i / sequenceSlices.length) * 10);
      progressMap.set(projectId, {
        stage: "generating",
        progress,
        message: `Extracting clip ${i + 1}/${sequenceSlices.length}...`,
      });
    }

    // PHASE 1: Apply smart transitions with J/L cuts (if polished mode and multiple clips)
    progressMap.set(projectId, {
      stage: "generating",
      progress: 80,
      message: "Adding smart transitions...",
    });
    broadcastEditingProgress(projectId, { stage: "generating", message: "Adding smart transitions with J/L cuts...", progress: 80 });

    let concatenatedPath = path.join(process.cwd(), "uploads", "videos", `generated-${nanoid()}.mp4`);

    if (outputMode === "polished_reels" && clipPaths.length > 1) {
      // Apply smart transitions with J/L cuts for professional flow
      const baseTransition = {
        type: "dissolve" as TransitionType,
        duration: 0.8,
      };

      await TransitionEngine.applySmartTransitionsToSequence(
        clipPaths,
        concatenatedPath,
        baseTransition,
        {
          enableBeatSync: videoCategory === "music_video" || videoCategory === "hype",
          enableSceneAware: true,
          enableJLCuts: true,
          preferredJLType: "auto",
          jlOffset: 0.3
        }
      );
      console.log(`[processVideoFromFile] Applied smart transitions with J/L cuts`);
    } else if (clipPaths.length > 1) {
      // Raw slices mode: apply basic fade transitions (0.3s)
      const basicFadeTransition = {
        type: "fade" as TransitionType,
        duration: 0.3,
      };

      await TransitionEngine.applySmartTransitionsToSequence(
        clipPaths,
        concatenatedPath,
        basicFadeTransition,
        {
          enableBeatSync: false,
          enableSceneAware: false,
          enableJLCuts: false,
        }
      );
      console.log(`[processVideoFromFile] Applied basic fade transitions for raw slices`);
    } else {
      // Single clip - no transitions needed
      await VideoProcessor.concatenateClips(clipPaths, concatenatedPath);
    }

    // Clean up temp clip files
    for (const clipPath of clipPaths) {
      try {
        fs.unlinkSync(clipPath);
      } catch (err) {
        // Ignore cleanup errors
      }
    }

    // PHASE 2: Apply aspect ratio cropping if needed
    let finalPath = concatenatedPath;
    if (aspectRatio && aspectRatio !== "16:9") {
      progressMap.set(projectId, {
        stage: "generating",
        progress: 85,
        message: `Cropping to ${aspectRatio}...`,
      });
      finalPath = await VideoProcessor.cropToAspectRatio(concatenatedPath, aspectRatio as "9:16" | "1:1" | "16:9");
    }

    // PHASE 3: Apply color grading if polished mode
    if (outputMode === "polished_reels" && intentConfig.vibe) {
      progressMap.set(projectId, {
        stage: "generating",
        progress: 90,
        message: "Applying color grading...",
      });
      const gradedPath = await VideoProcessor.applyColorGrading(finalPath, intentConfig.vibe);
      if (gradedPath !== finalPath) {
        finalPath = gradedPath;
      }
    }

    // PHASE 4: Apply audio mixing if background music is configured
    // (Note: This is basic auto-music. Full multi-track mixing happens in finalization)
    if (outputMode === "polished_reels") {
      progressMap.set(projectId, {
        stage: "generating",
        progress: 95,
        message: "Adding background music...",
      });
      // Future: Auto-select royalty-free background music based on video category
      console.log(`[processVideoFromFile] Audio mixing available in finalization step`);
    }

    // Get video duration
    const videoMetadata = await VideoProcessor.getVideoMetadata(finalPath);

    // Create generated video record
    const generatedVideo = await storage.createVideo({
      projectId,
      videoPath: VideoProcessor.getPublicPath(finalPath),
      type: videoType,
      status: "ready",
      duration: Math.floor(videoMetadata.duration),
      clipSequence,
      appliedMood: intentConfig.vibe || null,
      appliedStyle: null,
    });

    console.log(`[processVideoFromFile] Created video: ${generatedVideo.id}`);

    // Clean up temp clip files
    for (const clipPath of clipPaths) {
      try {
        fs.unlinkSync(clipPath);
      } catch (err) {
        // Ignore cleanup errors
      }
    }

    // Update final status
    progressMap.set(projectId, {
      stage: "complete",
      progress: 100,
      message: "Processing complete!",
    });
    broadcastEditingProgress(projectId, { stage: "complete", message: "Video generation complete!", progress: 100 });

    await storage.updateProject(projectId, { status: "completed" });

    console.log(`[processVideoFromFile] ✓ Processing complete for ${projectId}`);
    completeEditingLog(projectId, "complete");
  } catch (error: any) {
    console.error(`[processVideoFromFile] Error processing ${projectId}:`, error);

    progressMap.set(projectId, {
      stage: "error",
      progress: 0,
      message: `Failed: ${error.message || "Unknown error"}`,
    });
    broadcastEditingProgress(projectId, { stage: "error", message: `Failed: ${error.message || "Unknown error"}`, progress: 0 });

    await storage.updateProject(projectId, { status: "error" });
    completeEditingLog(projectId, "error");
    throw error;
  }
}

async function processVideoFromUrl(projectId: string, videoUrl: string) {
  console.log(`[processVideoFromUrl] Starting processing for ${projectId} from URL: ${videoUrl}`);

  try {
    // Update project status
    await storage.updateProject(projectId, { status: "downloading" });

    progressMap.set(projectId, {
      stage: "downloading",
      progress: 5,
      message: "Downloading video from URL...",
    });

    // Download video from URL
    const axios = (await import("axios")).default;
    const response = await axios.get(videoUrl, {
      responseType: "arraybuffer",
      maxContentLength: 700 * 1024 * 1024, // 700MB max
    });

    // Save to uploads directory
    const fileName = `url-${nanoid()}.mp4`;
    const videoPath = path.join(UPLOADS_DIR, fileName);
    fs.writeFileSync(videoPath, response.data);

    console.log(`[processVideoFromUrl] Downloaded to: ${videoPath}`);

    // Update project with video path
    await storage.updateProject(projectId, { sourceVideoPath: videoPath });

    // Continue with normal processing
    await processVideoFromFile(projectId, videoPath);
  } catch (error: any) {
    console.error(`[processVideoFromUrl] Error:`, error);

    progressMap.set(projectId, {
      stage: "error",
      progress: 0,
      message: `Failed to download: ${error.message}`,
    });

    await storage.updateProject(projectId, { status: "error" });
    throw error;
  }
}

// Configure multer for video uploads with error handling
const upload = multer({
  dest: UPLOADS_DIR,
  limits: {
    fileSize: 700 * 1024 * 1024, // 700MB - increased limit
  },
  fileFilter: (req: any, file: any, cb: any) => {
    console.log("[upload] File filter check:", file.mimetype);
    if (file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      // This error will be caught by the route handler and returned to the client
      cb(new Error(`Invalid file type: ${file.mimetype}. Only video files are allowed.`));
    }
  },
  onError: (err: any, next: any) => {
    console.error("[upload] Multer error:", err);
    next(err);
  }
});

// Multer for audio uploads
const audioUpload = multer({
  dest: AUDIO_UPLOADS_DIR,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for audio files
  },
  fileFilter: (req: any, file: any, cb: any) => {
    console.log("[upload] Audio file filter check:", file.mimetype);
    if (file.mimetype.startsWith("audio/")) {
      cb(null, true);
    } else {
      cb(new Error("Only audio files are allowed"));
    }
  },
});

// Multer configuration for batch uploads (array of files)
const batchUpload = multer({
  dest: UPLOADS_DIR,
  limits: {
    fileSize: 700 * 1024 * 1024, // 700MB per file
    files: 10, // Max 10 files per batch
  },
  fileFilter: (req: any, file: any, cb: any) => {
    console.log("[batch-upload] File filter check:", file.mimetype);
    if (file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Only video files are allowed"));
    }
  },
});

// Multer configuration for chunk uploads (temporary storage)
const chunkUpload = multer({
  dest: CHUNKS_DIR, // Save chunks to CHUNKS_DIR for assembly later
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB per chunk max
  },
});


export async function registerRoutes(app: Express): Promise<Server> {
  // Rate limiters with trust proxy validation disabled (safe on Replit)
  const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 uploads per 15 min
    message: { error: "Too many uploads, please try again later" },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false }, // Disable trust proxy validation
  });

  const aiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20, // 20 AI requests per minute
    message: { error: "Too many AI requests, please slow down" },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false }, // Disable trust proxy validation
  });

  const finalizationLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 5, // 5 finalizations per 5 min
    message: { error: "Too many finalization requests, please wait" },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false }, // Disable trust proxy validation
  });

  // Serve uploaded files with proper MIME types
  const express = await import("express");

  // Helper function for setting video MIME headers
  const setVideoHeaders = (res: any, filePath: string) => {
    if (filePath.endsWith('.mp4')) {
      res.setHeader('Content-Type', 'video/mp4');
    } else if (filePath.endsWith('.webm')) {
      res.setHeader('Content-Type', 'video/webm');
    } else if (filePath.endsWith('.mov')) {
      res.setHeader('Content-Type', 'video/quicktime');
    } else if (filePath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (filePath.endsWith('.mp3')) {
      res.setHeader('Content-Type', 'audio/mpeg');
    } else if (filePath.endsWith('.wav')) {
      res.setHeader('Content-Type', 'audio/wav');
    } else if (filePath.endsWith('.zip')) {
      res.setHeader('Content-Type', 'application/zip');
    }
    res.setHeader('Accept-Ranges', 'bytes');
  };

  // Serve all uploads from persistent storage
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads"), {
    setHeaders: setVideoHeaders
  }));

  // For backward compatibility, also serve /processing (but it's now same as /uploads)
  app.use("/processing", express.static(path.join(process.cwd(), "uploads"), {
    setHeaders: setVideoHeaders
  }));

  console.log(`[Static] Serving uploads from: ${path.join(process.cwd(), "uploads")}`);
  console.log(`[Static] Processing now uses persistent storage: ${PROCESSING_ROOT}`);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Audio-to-Video Story Generation (V7.1)
  app.post('/api/projects/audio-to-video', async (req, res) => {
    try {
      const { audioUrl, audioFile, options } = req.body;

      console.log('[AudioToVideo] Starting audio-to-video story generation...');

      // Create project
      const project = await storage.createProject({
        name: `Audio Story - ${new Date().toISOString()}`,
        projectType: 'ai-video',
        scriptContent: null, // Will be populated from transcription
        status: 'analyzing',
      });

      // Download audio if URL provided
      let audioPath: string;
      if (audioUrl) {
        console.log('[AudioToVideo] Downloading audio from URL...');
        const { VideoProcessor } = await import('./services/video-processor');
        const downloadResult = await VideoProcessor.downloadFromUrl(audioUrl);
        audioPath = downloadResult.videoPath;
      } else if (audioFile) {
        // Handle uploaded audio file
        audioPath = audioFile;
      } else {
        return res.status(400).json({ error: 'No audio source provided' });
      }

      // Start generation in background
      (async () => {
        try {
          const { generateVideoFromAudio } = await import('./services/audio-to-video-story');
          const slices = await generateVideoFromAudio(project.id, audioPath, options);

          await storage.updateProject(project.id, {
            status: 'ready',
          });

          console.log(`[AudioToVideo] ✓ Generation complete for project ${project.id}`);
        } catch (error: any) {
          console.error('[AudioToVideo] Generation failed:', error);
          await storage.updateProject(project.id, {
            status: 'error',
          });
        }
      })();

      res.json({
        projectId: project.id,
        message: 'Audio-to-video story generation started',
      });
    } catch (error: any) {
      console.error('[AudioToVideo] API error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // =============================================================================
  // PEXELS STOCK MEDIA API ROUTES
  // =============================================================================

  // Search stock videos
  app.get('/api/pexels/videos/search', async (req, res) => {
    try {
      const { query, page = '1', perPage = '15' } = req.query;
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Search query required' });
      }
      const result = await PexelsAPI.searchVideos(query, parseInt(perPage as string), parseInt(page as string));
      res.json(result);
    } catch (error: any) {
      console.error('[Pexels] Video search error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Search stock photos
  app.get('/api/pexels/photos/search', async (req, res) => {
    try {
      const { query, page = '1', perPage = '15' } = req.query;
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Search query required' });
      }
      const result = await PexelsAPI.searchPhotos(query, parseInt(perPage as string), parseInt(page as string));
      res.json(result);
    } catch (error: any) {
      console.error('[Pexels] Photo search error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Get popular videos (default view)
  app.get('/api/pexels/videos/popular', async (req, res) => {
    try {
      const { page = '1', perPage = '15' } = req.query;
      const result = await PexelsAPI.getPopularVideos(parseInt(perPage as string), parseInt(page as string));
      res.json(result);
    } catch (error: any) {
      console.error('[Pexels] Popular videos error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Download stock media to local storage
  app.post('/api/pexels/download', async (req, res) => {
    try {
      const { url, type } = req.body;
      if (!url || !type) {
        return res.status(400).json({ error: 'URL and type required' });
      }
      if (!['video', 'photo'].includes(type)) {
        return res.status(400).json({ error: 'Type must be video or photo' });
      }
      const localPath = await PexelsAPI.downloadMedia(url, type);
      res.json({ localPath, success: true });
    } catch (error: any) {
      console.error('[Pexels] Download error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Get Pexels API status (check if key is configured)
  app.get('/api/pexels/status', (_req, res) => {
    const configured = !!process.env.PEXELS_API_KEY;
    res.json({ 
      configured, 
      message: configured ? 'Pexels API ready' : 'Pexels API key not configured'
    });
  });

  // Fast Preview System - Generate lightweight proxy for scrubbing
  app.post('/api/projects/:projectId/generate-preview', async (req, res) => {
    try {
      const { projectId } = req.params;
      const project = await storage.getProject(projectId);

      if (!project || !project.sourceVideoPath) {
        return res.status(404).json({ error: 'Project or video not found' });
      }

      const { PreviewGenerator } = await import('./services/preview-generator');

      const [proxyUrl, spriteData] = await Promise.all([
        PreviewGenerator.generateFastProxy(project.sourceVideoPath),
        PreviewGenerator.generateSpriteSheet(project.sourceVideoPath, project.duration || 60)
      ]);

      res.json({
        proxyUrl,
        spriteSheet: spriteData
      });
    } catch (error: any) {
      console.error('[preview] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Brand Kit Management
  app.post('/api/brand-kit/upload-logo', upload.single('logo'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No logo file uploaded' });
      }

      const logoPath = `/uploads/videos/${req.file.filename}`;
      res.json({ url: logoPath });
    } catch (error: any) {
      console.error('[brand-kit] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/brand-kit', async (req, res) => {
    try {
      const brandKit = req.body;
      // Store in database or session storage
      // For now, just acknowledge receipt
      res.json({ success: true });
    } catch (error: any) {
      console.error('[brand-kit] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // SSE endpoint for real-time editing progress
  app.get('/api/projects/:projectId/editing-progress', (req, res) => {
    const { projectId } = req.params;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const client = { res, projectId };
    if (!editingLogClients.has(projectId)) {
      editingLogClients.set(projectId, []);
    }
    editingLogClients.get(projectId)!.push(client);

    console.log(`[EditingLog] Client connected for project ${projectId}`);

    // Send initial message
    res.write(`data: ${JSON.stringify({ stage: 'initializing', message: 'Initializing AI editing engine...', progress: 0 })}\n\n`);

    // Clean up on disconnect
    req.on('close', () => {
      const clients = editingLogClients.get(projectId) || [];
      const idx = clients.indexOf(client);
      if (idx >= 0) clients.splice(idx, 1);
      console.log(`[EditingLog] Client disconnected for project ${projectId}`);
      if (clients.length === 0) {
        editingLogClients.delete(projectId);
      }
    });
  });

  // Admin endpoints
  app.get('/api/admin/stats', async (_req, res) => {
    try {
      const allProjects = await storage.getAllProjects();
      const allVideos = await Promise.all(
        allProjects.map(p => storage.getVideosByProject(p.id))
      );

      // Calculate storage used (estimate based on project count)
      const storageUsed = allProjects.length * 50 * 1024 * 1024; // ~50MB per project estimate

      const projectsByType = {
        video: allProjects.filter(p => !p.projectType || p.projectType === 'video').length,
        carousel: allProjects.filter(p => p.projectType === 'carousel').length,
        aiVideo: allProjects.filter(p => p.projectType === 'ai-video').length,
      };

      res.json({
        totalUsers: 1, // Placeholder - implement user counting when auth is fully integrated
        totalProjects: allProjects.length,
        totalVideos: allVideos.flat().length,
        activeProjects: allProjects.filter(p => p.status === 'analyzing' || p.status === 'pending').length,
        storageUsed,
        projectsByType,
      });
    } catch (error) {
      console.error('[admin/stats] Error:', error);
      res.status(500).json({ error: 'Failed to fetch admin stats' });
    }
  });

  app.get('/api/admin/projects', async (_req, res) => {
    try {
      const allProjects = await storage.getAllProjects();

      const projectList = allProjects.map(p => ({
        id: p.id,
        name: p.name,
        projectType: p.projectType || 'video',
        status: p.status,
        duration: p.duration,
        createdAt: p.createdAt,
        userId: null, // Placeholder - integrate with Firebase auth
        userEmail: null, // Placeholder - integrate with Firebase auth
      }));

      res.json(projectList);
    } catch (error) {
      console.error('[admin/projects] Error:', error);
      res.status(500).json({ error: 'Failed to fetch projects' });
    }
  });

  // Image Style Mimicry Endpoint
  app.post("/api/analyze-image-style", async (req, res) => {
    try {
      const { imageUrl } = req.body;

      if (!imageUrl) {
        return res.status(400).json({ error: "Image URL is required" });
      }

      console.log(`[analyze-image-style] Analyzing: ${imageUrl}`);

      const { ImageStyleAnalyzer } = await import("./services/image-style-analyzer");
      const styleAnalysis = await ImageStyleAnalyzer.analyzeImageStyle(imageUrl);

      res.json({ styleAnalysis });
    } catch (error: any) {
      console.error("[analyze-image-style] Error:", error);
      res.status(500).json({
        error: "Failed to analyze image style",
        details: error.message,
      });
    }
  });

  // Debug: Check video file existence
  app.get('/api/debug/video-exists/:filename', (_req, res) => {
    const filename = _req.params.filename;
    const fullPath = path.join(process.cwd(), 'uploads', 'videos', filename);
    const exists = fs.existsSync(fullPath);

    if (exists) {
      const stats = fs.statSync(fullPath);
      res.json({
        exists: true,
        path: fullPath,
        size: stats.size,
        created: stats.birthtime,
        publicUrl: `/uploads/videos/${filename}`
      });
    } else {
      res.json({ exists: false, path: fullPath });
    }
  });

  // Upload audio file for multi-track mixing
  app.post('/api/upload-audio', audioUpload.single('audio'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No audio file uploaded' });
      }

      // Ensure the directory for audio uploads exists
      if (!fs.existsSync(AUDIO_UPLOADS_DIR)) {
        fs.mkdirSync(AUDIO_UPLOADS_DIR, { recursive: true });
      }

      // Move file to audio directory with proper extension
      const ext = path.extname(req.file.originalname) || '.mp3';
      const audioFilename = `${nanoid()}${ext}`;
      const audioPath = path.join(AUDIO_UPLOADS_DIR, audioFilename);

      fs.renameSync(req.file.path, audioPath);

      const publicUrl = `/uploads/audio/${audioFilename}`;

      console.log(`[upload-audio] Saved audio to: ${publicUrl}`);

      res.json({
        success: true,
        url: publicUrl,
      });
    } catch (error: any) {
      console.error('[upload-audio] Error:', error);
      res.status(500).json({
        error: 'Failed to upload audio',
        details: error.message,
      });
    }
  });

  // Resumable upload endpoints (database-backed for server restart survival)
  // Step 1: Initiate upload session
  app.post("/api/upload/initiate", async (req, res) => {
    try {
      const { fileName, fileSize, mimeType, batchId, processingConfig } = req.body;

      if (!fileName || !fileSize) {
        return res.status(400).json({ error: "Missing fileName or fileSize" });
      }

      const sessionId = nanoid();
      const uploadDir = path.join(CHUNKS_DIR, sessionId);
      fs.mkdirSync(uploadDir, { recursive: true });

      const totalChunks = Math.ceil(fileSize / (25 * 1024 * 1024)); // 25MB chunks for faster uploads

      // Log if user requested compression
      if (processingConfig && processingConfig.operation !== 'original') {
        console.log(`[upload-chunk] Compression requested: ${processingConfig.operation} (quality: ${processingConfig.quality || 'medium'})`);
      }

      // Store session in database (survives server restarts)
      await createUploadSession({
        sessionId,
        fileName,
        mimeType,
        totalSize: fileSize,
        totalChunks,
        uploadDir,
        batchId: batchId || null,
        processingConfig: processingConfig || null,
      });

      console.log(`[upload-chunk] Initiated session ${sessionId} for ${fileName} (${totalChunks} chunks)${batchId ? ` [batch: ${batchId}]` : ''}`);

      res.json({ sessionId });
    } catch (error: any) {
      console.error("[upload-chunk] Initiate error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Step 2: Upload individual chunk
  app.post("/api/upload/chunk", chunkUpload.single("chunk"), async (req, res) => {
    try {
      const { sessionId, chunkIndex } = req.body;

      if (!sessionId || chunkIndex === undefined || !req.file) {
        return res.status(400).json({ error: "Missing sessionId, chunkIndex, or chunk file" });
      }

      // Get session from database (survives server restarts)
      const session = await getUploadSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Upload session not found" });
      }

      // Move chunk from temp location to session directory
      const chunkPath = path.join(session.uploadDir, `chunk-${chunkIndex}`);
      fs.renameSync(req.file.path, chunkPath);

      // Update completed chunks in database
      const updatedSession = await addCompletedChunk(sessionId, parseInt(chunkIndex));
      const completedCount = updatedSession ? (updatedSession.completedChunksArray as number[]).length : 0;

      console.log(
        `[upload-chunk] Received chunk ${chunkIndex} for session ${sessionId} (${completedCount}/${session.totalChunks})`
      );

      res.json({
        success: true,
        completedChunks: completedCount,
        totalChunks: session.totalChunks,
      });
    } catch (error: any) {
      console.error("[upload-chunk] Chunk upload error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Helper function to compress video using FFmpeg
  async function compressVideo(
    inputPath: string,
    quality: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<{ outputPath: string; originalSize: number; compressedSize: number }> {
    const originalSize = fs.statSync(inputPath).size;
    const ext = path.extname(inputPath);
    const baseName = path.basename(inputPath, ext);
    const outputPath = path.join(path.dirname(inputPath), `compressed-${baseName}.mp4`);

    // Quality presets - CRF values (lower = better quality, higher file size)
    const crfValues = {
      low: 32,      // Aggressive compression, smaller files
      medium: 26,   // Balanced quality/size
      high: 22,     // High quality, larger files
    };

    const crf = crfValues[quality];

    console.log(`[compress] Starting compression: ${quality} quality (CRF ${crf})`);
    console.log(`[compress] Input: ${inputPath} (${(originalSize / 1024 / 1024).toFixed(1)}MB)`);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-c:v libx264',     // H.264 codec for wide compatibility
          `-crf ${crf}`,      // Constant Rate Factor for quality
          '-preset fast',     // Faster encoding with good compression
          '-c:a aac',         // AAC audio codec
          '-b:a 128k',        // Audio bitrate
          '-movflags +faststart', // Enable streaming
          '-y',               // Overwrite output
        ])
        .output(outputPath)
        .on('start', (cmd) => {
          console.log(`[compress] FFmpeg command: ${cmd.substring(0, 200)}...`);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`[compress] Progress: ${progress.percent.toFixed(1)}%`);
          }
        })
        .on('end', () => {
          const compressedSize = fs.statSync(outputPath).size;
          const reduction = ((1 - compressedSize / originalSize) * 100).toFixed(1);
          console.log(`[compress] Complete: ${(compressedSize / 1024 / 1024).toFixed(1)}MB (${reduction}% reduction)`);
          resolve({ outputPath, originalSize, compressedSize });
        })
        .on('error', (err) => {
          console.error(`[compress] Error: ${err.message}`);
          reject(err);
        })
        .run();
    });
  }

  // Helper function to convert video to MP4 with minimal quality loss
  async function convertToMp4(inputPath: string): Promise<{ outputPath: string; originalSize: number; convertedSize: number }> {
    const originalSize = fs.statSync(inputPath).size;
    const ext = path.extname(inputPath);
    const baseName = path.basename(inputPath, ext);
    const outputPath = path.join(path.dirname(inputPath), `converted-${baseName}.mp4`);

    console.log(`[convert] Starting format conversion to MP4`);
    console.log(`[convert] Input: ${inputPath} (${(originalSize / 1024 / 1024).toFixed(1)}MB)`);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-c:v libx264',     // H.264 codec
          '-crf 18',          // High quality (minimal loss)
          '-preset medium',   // Balanced speed/quality
          '-c:a aac',         // AAC audio
          '-b:a 192k',        // Higher audio bitrate for quality
          '-movflags +faststart',
          '-y',
        ])
        .output(outputPath)
        .on('start', (cmd) => {
          console.log(`[convert] FFmpeg command: ${cmd.substring(0, 200)}...`);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`[convert] Progress: ${progress.percent.toFixed(1)}%`);
          }
        })
        .on('end', () => {
          const convertedSize = fs.statSync(outputPath).size;
          console.log(`[convert] Complete: ${(convertedSize / 1024 / 1024).toFixed(1)}MB`);
          resolve({ outputPath, originalSize, convertedSize });
        })
        .on('error', (err) => {
          console.error(`[convert] Error: ${err.message}`);
          reject(err);
        })
        .run();
    });
  }

  // Step 3: Finalize upload - assemble chunks and create project
  app.post("/api/upload/finalize", async (req, res) => {
    try {
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({ error: "Missing sessionId" });
      }

      // Get session from database (survives server restarts)
      const session = await getUploadSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Upload session not found" });
      }

      // Verify all chunks are received
      const completedChunks = (session.completedChunksArray as number[]) || [];
      if (completedChunks.length !== session.totalChunks) {
        return res.status(400).json({
          error: "Not all chunks received",
          received: completedChunks.length,
          expected: session.totalChunks,
        });
      }

      // Cast processingConfig from jsonb
      const processingConfig = session.processingConfig as ProcessingConfig | null;

      // Ensure videos directory exists
      if (!fs.existsSync(VIDEOS_DIR)) {
        fs.mkdirSync(VIDEOS_DIR, { recursive: true });
      }

      // Assemble chunks into final file in VIDEOS_DIR (permanent location)
      let finalPath = path.join(VIDEOS_DIR, `${nanoid()}-${session.fileName}`);
      const writeStream = fs.createWriteStream(finalPath);

      for (let i = 0; i < session.totalChunks; i++) {
        const chunkPath = path.join(session.uploadDir, `chunk-${i}`);
        const chunkData = fs.readFileSync(chunkPath);
        writeStream.write(chunkData);
      }

      writeStream.end();

      await new Promise((resolve, reject) => {
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
      });

      console.log(`[upload-chunk] Assembled file: ${finalPath}${session.batchId ? ` [batch: ${session.batchId}]` : ''}`);

      // Apply compression/conversion if requested
      let processingApplied = false;
      let processingError: string | null = null;
      let processingStats: { originalSize: number; processedSize: number } | null = null;

      if (processingConfig && processingConfig.operation !== 'original') {
        const operation = processingConfig.operation;

        // Validate target format for conversion operations
        if ((operation === 'convert' || operation === 'both') && 
            processingConfig.targetFormat && 
            processingConfig.targetFormat !== 'mp4') {
          processingError = `Format conversion to ${processingConfig.targetFormat} is not supported. Only MP4 conversion is available.`;
          console.warn(`[upload-chunk] Unsupported target format: ${processingConfig.targetFormat}`);
        }

        if (!processingError) try {
          if (operation === 'compress') {
            // Compression only - reduce file size with quality settings
            console.log(`[upload-chunk] Applying compression (${processingConfig.quality || 'medium'} quality)...`);

            const result = await compressVideo(finalPath, processingConfig.quality || 'medium');
            const savingsRatio = 1 - result.compressedSize / result.originalSize;

            if (savingsRatio > 0.05) {
              fs.unlinkSync(finalPath);
              finalPath = result.outputPath;
              processingApplied = true;
              processingStats = { originalSize: result.originalSize, processedSize: result.compressedSize };
              console.log(`[upload-chunk] Compression complete. Saved ${(savingsRatio * 100).toFixed(1)}%`);
            } else {
              console.log(`[upload-chunk] Compression yielded only ${(savingsRatio * 100).toFixed(1)}% savings, keeping original`);
              try { fs.unlinkSync(result.outputPath); } catch (e) { /* ignore cleanup error */ }
              processingError = 'Compression did not provide significant savings';
            }
          } else if (operation === 'convert') {
            // Convert only - format conversion with minimal quality loss
            console.log(`[upload-chunk] Converting to MP4 format...`);

            const result = await convertToMp4(finalPath);
            fs.unlinkSync(finalPath);
            finalPath = result.outputPath;
            processingApplied = true;
            processingStats = { originalSize: result.originalSize, processedSize: result.convertedSize };
            console.log(`[upload-chunk] Conversion complete.`);
          } else if (operation === 'both') {
            // Compress + Convert - full optimization
            console.log(`[upload-chunk] Applying compression + conversion (${processingConfig.quality || 'medium'} quality)...`);

            const result = await compressVideo(finalPath, processingConfig.quality || 'medium');
            const savingsRatio = 1 - result.compressedSize / result.originalSize;

            // For 'both', always use the result since we're also converting format
            fs.unlinkSync(finalPath);
            finalPath = result.outputPath;
            processingApplied = true;
            processingStats = { originalSize: result.originalSize, processedSize: result.compressedSize };
            console.log(`[upload-chunk] Compress + convert complete. Size change: ${(savingsRatio * 100).toFixed(1)}%`);
          }
        } catch (err: any) {
          console.error(`[upload-chunk] Processing failed, using original:`, err.message);
          processingError = err.message || 'Processing failed';
        }
      }

      // Get video metadata
      const { duration, aspectRatio } = await new Promise<{
        duration: number;
        aspectRatio: "9:16" | "1:1" | "16:9";
      }>((resolve, reject) => {
        ffmpeg.ffprobe(finalPath, (err: any, metadata: any) => {
          if (err) {
            console.warn(`[upload-chunk] ffprobe error:`, err.message);
            resolve({ duration: 30, aspectRatio: "9:16" });
            return;
          }

          const dur = Math.floor(metadata.format.duration || 30);
          const videoStream = metadata.streams?.find((s: any) => s.codec_type === "video");
          let detectedRatio: "9:16" | "1:1" | "16:9" = "9:16";

          if (videoStream?.width && videoStream?.height) {
            const ratio = videoStream.width / videoStream.height;
            if (ratio < 0.75) {
              detectedRatio = "9:16";
            } else if (ratio >= 0.75 && ratio <= 1.25) {
              detectedRatio = "1:1";
            } else {
              detectedRatio = "16:9";
            }
          }

          resolve({ duration: dur, aspectRatio: detectedRatio });
        });
      });

      // Create project with batch info if present
      const project = await storage.createProject({
        name: session.fileName,
        sourceVideoUrl: "", // Empty for file uploads
        sourceVideoPath: finalPath,
        status: "pending",
        duration,
        batchId: session.batchId || undefined,
        intentConfig: {
          aspectRatio,
          originalAspectRatio: aspectRatio,
        } as any,
      });

      console.log(`[upload-chunk] Project created: ${project.id}${session.batchId ? ` [batch: ${session.batchId}]` : ''}`);

      // Clean up chunks directory
      try {
        const files = fs.readdirSync(session.uploadDir);
        files.forEach((file) => {
          fs.unlinkSync(path.join(session.uploadDir, file));
        });
        fs.rmdirSync(session.uploadDir);
      } catch (err) {
        console.warn(`[upload-chunk] Failed to cleanup chunks:`, err);
      }

      // Delete session from database
      await deleteUploadSession(sessionId);

      // Include processing stats in response
      const compressionResponse = processingApplied && processingStats ? {
        applied: true,
        originalSize: processingStats.originalSize,
        compressedSize: processingStats.processedSize,
        savingsPercent: parseFloat(((1 - processingStats.processedSize / processingStats.originalSize) * 100).toFixed(1)),
      } : {
        applied: false,
        error: processingError || undefined,
      };

      res.json({ project, compression: compressionResponse });
    } catch (error: any) {
      console.error("[upload-chunk] Finalize error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create project from file upload
  app.post("/api/projects/upload", uploadLimiter, upload.single("video"), async (req, res) => {
    // Set keep-alive headers to prevent connection drops
    req.socket.setKeepAlive(true);
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Keep-Alive', 'timeout=900');

    console.log("[upload] POST /api/projects/upload received");
    console.log("[upload] Headers:", JSON.stringify(req.headers));
    console.log("[upload] req.file:", req.file ? "present" : "missing");

    try {
      const { file } = req; // Use destructuring for clarity

      if (!file) {
        console.error("[upload] No file in request");
        console.error("[upload] Request body:", req.body);
        console.error("[upload] Content-Type:", req.headers['content-type']);
        return res.status(400).json({
          error: "No video file provided",
          details: "Please select a video file to upload. Ensure the file is attached correctly."
        });
      }

      // Validate file object has required properties
      if (!file.path || !file.size) {
        console.error("[upload] Invalid file object:", file);
        return res.status(400).json({
          error: "Invalid file upload",
          details: "File upload failed. Please try again."
        });
      }

      console.log(`[upload] File received: ${file.originalname} (${file.size} bytes)`);
      console.log(`[upload] MIME type: ${file.mimetype}`);
      console.log(`[upload] Stored at: ${file.path}`);

      // Validate MIME type with helpful error messages
      const validMimeTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm'];
      const mimeType = file.mimetype.toLowerCase();

      if (!validMimeTypes.includes(mimeType)) {
        // Clean up invalid file
        try {
          fs.unlinkSync(file.path);
        } catch (err) {
          console.error("[upload] Failed to cleanup invalid file:", err);
        }

        const supportedFormats = "MP4, MOV, AVI, MKV, WebM";
        console.error(`[upload] ❌ Invalid MIME type: ${file.mimetype}`);
        return res.status(400).json({
          error: `Invalid file type: ${file.mimetype}`,
          details: `Please upload a video file. Supported formats: ${supportedFormats}`,
          received: file.mimetype,
          supported: validMimeTypes
        });
      }

      const name = req.body.name || file.originalname;

      // Create project
      const project = await storage.createProject({
        name,
        sourceVideoUrl: "", // Empty for file uploads
        status: "pending",
      });

      console.log("[upload] Project created:", project.id);

      // Store the uploaded file path
      const videoPath = file.path;

      // Ensure file exists and is fully written to disk (wait with retries)
      let fileExists = false;
      let fileSize = 0;
      let lastFileSize = -1;
      let stableSizeCount = 0;

      for (let i = 0; i < 15; i++) {
        if (fs.existsSync(videoPath)) {
          const stats = fs.statSync(videoPath);
          fileSize = stats.size;

          // Check if file size has stabilized (written completely)
          if (fileSize === lastFileSize) {
            stableSizeCount++;
          } else {
            stableSizeCount = 0;
          }

          // File is considered fully written when size stays same for 2 checks (200ms)
          if (stableSizeCount >= 2) {
            fileExists = true;
            console.log(`[upload] ✅ File verified and fully written: ${videoPath} (${(fileSize / 1024 / 1024).toFixed(2)}MB)`);
            break;
          }

          lastFileSize = fileSize;
          console.log(`[upload] File exists but still writing... size: ${(fileSize / 1024 / 1024).toFixed(2)}MB (attempt ${i + 1}/15)`);
        } else {
          console.warn(`[upload] File not yet available (attempt ${i + 1}/15)`);
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (!fileExists || fileSize === 0) {
        console.error(`[upload] ❌ File not found or empty after upload at: ${videoPath}`);
        // Clean up incomplete file
        try {
          fs.unlinkSync(videoPath);
        } catch (err) {
          console.warn("[upload] Failed to cleanup incomplete file:", err);
        }
        await storage.updateProject(project.id, { status: "error" });
        return res.status(500).json({
          error: "File upload incomplete",
          details: `File was not properly saved to disk. Final size: ${fileSize} bytes. Expected size: ${file.size} bytes`
        });
      }

      // Verify file size matches what was uploaded
      if (fileSize < file.size * 0.95) { // Allow 5% tolerance for streaming variations
        console.error(`[upload] ⚠️ File size mismatch. Uploaded: ${file.size} bytes, Saved: ${fileSize} bytes`);
        // Note: We'll proceed anyway as this might be a transient issue, but log it
        console.log(`[upload] Proceeding with upload despite size variance`);
      }

      // Get video duration and aspect ratio quickly with ffprobe
      const { duration, aspectRatio } = await new Promise<{ duration: number; aspectRatio: "9:16" | "1:1" | "16:9" }>((resolve, reject) => {
        ffmpeg.ffprobe(videoPath, (err: any, metadata: any) => {
          if (err) {
            console.warn(`[upload] ffprobe error (using defaults):`, err.message);
            // Resolve with default values on error
            resolve({ duration: 30, aspectRatio: "9:16" });
            return;
          }

          const dur = Math.floor(metadata.format.duration || 30);
          console.log(`[upload] Video duration: ${dur} seconds`);

          // Detect aspect ratio
          const videoStream = metadata.streams?.find((s: any) => s.codec_type === "video");
          let detectedRatio: "9:16" | "1:1" | "16:9" = "9:16";

          if (videoStream?.width && videoStream?.height) {
            const ratio = videoStream.width / videoStream.height;
            console.log(`[upload] Video dimensions: ${videoStream.width}x${videoStream.height}, ratio: ${ratio.toFixed(2)}`);

            if (ratio < 0.75) {
              detectedRatio = "9:16";
            } else if (ratio >= 0.75 && ratio <= 1.25) {
              detectedRatio = "1:1";
            } else {
              detectedRatio = "16:9";
            }
            console.log(`[upload] Detected aspect ratio: ${detectedRatio}`);
          }

          resolve({ duration: dur, aspectRatio: detectedRatio });
        });
      });

      // Store original aspect ratio in intentConfig
      const defaultIntentConfig = {
        aspectRatio,
        originalAspectRatio: aspectRatio,
      };

      await storage.updateProject(project.id, {
        sourceVideoPath: videoPath,
        duration,
        intentConfig: defaultIntentConfig as any,
      });

      console.log("[upload] Upload complete, project updated with duration ${duration}s");
      console.log("[upload] Sending response...");

      res.json({ ...project, duration });
    } catch (error: any) {
      console.error("[upload] Error uploading video:", error);
      console.error("[upload] Error stack:", error.stack);

      // Handle specific multer errors
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: "File too large",
          details: "Maximum file size is 700MB. Please upload a smaller video."
        });
      }

      if (error.message?.includes("Only video files")) {
        return res.status(400).json({
          error: "Invalid file type",
          details: error.message
        });
      }

      res.status(500).json({
        error: "Error uploading video",
        details: error.message || "An unexpected error occurred during upload. Please try again."
      });
    }
  });

  // Batch upload endpoint - accepts multiple files at once
  app.post("/api/projects/batch-upload", uploadLimiter, batchUpload.array("videos", 10), async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    console.log("[batch-upload] POST /api/projects/batch-upload received");
    console.log("[batch-upload] Files count:", req.files ? (req.files as any[]).length : 0);

    try {
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        console.error("[batch-upload] No files in request");
        res.status(400).json({ error: "No video files provided" });
        return;
      }

      if (files.length > 10) {
        console.error("[batch-upload] Too many files");
        res.status(400).json({ error: "Maximum 10 files per batch" });
        return;
      }

      console.log(`[batch-upload] Processing ${files.length} files`);

      // Ensure videos directory exists
      if (!fs.existsSync(VIDEOS_DIR)) {
        fs.mkdirSync(VIDEOS_DIR, { recursive: true });
      }

      // Generate a unique batch ID
      const batchId = nanoid();
      const projects: Project[] = [];

      // Create a project for each file with video metadata
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const name = file.originalname;

        console.log(`[batch-upload] Processing file ${i + 1}/${files.length}: ${name}`);

        // Move file to permanent location (same as single uploads)
        const finalPath = path.join(VIDEOS_DIR, `${nanoid()}-${name}`);
        fs.renameSync(file.path, finalPath);
        console.log(`[batch-upload] Moved ${name} to ${finalPath}`);

        // Get video duration and aspect ratio
        const { duration, aspectRatio } = await new Promise<{ duration: number; aspectRatio: "9:16" | "1:1" | "16:9" }>((resolve, reject) => {
          ffmpeg.ffprobe(finalPath, (err: any, metadata: any) => {
            if (err) {
              console.warn(`[batch-upload] ffprobe error for ${name}:`, err.message);
              // Resolve with default values on error
              resolve({ duration: 30, aspectRatio: "9:16" });
              return;
            }

            const dur = Math.floor(metadata.format.duration || 30);
            const videoStream = metadata.streams?.find((s: any) => s.codec_type === "video");
            let detectedRatio: "9:16" | "1:1" | "16:9" = "9:16";

            if (videoStream?.width && videoStream?.height) {
              const ratio = videoStream.width / videoStream.height;
              if (ratio < 0.75) {
                detectedRatio = "9:16";
              } else if (ratio >= 0.75 && ratio <= 1.25) {
                detectedRatio = "1:1";
              } else {
                detectedRatio = "16:9";
              }
            }

            resolve({ duration: dur, aspectRatio: detectedRatio });
          });
        });

        // Create project with complete batch info and permanent path
        const project = await storage.createProject({
          name,
          sourceVideoUrl: "",
          sourceVideoPath: finalPath,
          status: "pending",
          duration,
          batchId,
          batchIndex: i,
          intentConfig: {
            aspectRatio,
            originalAspectRatio: aspectRatio,
          } as any,
        });

        // Initialize progress immediately for early tracking
        progressMap.set(project.id, {
          stage: "pending",
          progress: 0,
          message: `Uploaded ${i + 1}/${files.length} - waiting for intent`,
        });

        console.log(`[batch-upload] Project created: ${project.id} with duration ${duration}s`);
        projects.push(project);
      }

      console.log(`[batch-upload] Batch upload complete: ${projects.length} projects created`);
      console.log(`[batch-upload] Batch ID: ${batchId}`);

      res.json({
        batchId,
        projects,
        count: projects.length,
      });
    } catch (error: any) {
      console.error("[batch-upload] Error:", error);
      console.error("[batch-upload] Stack:", error.stack);
      res.status(500).json({
        error: "Error processing batch upload",
        details: error.message,
      });
    }
  });

  // Single file batch upload endpoint - uploads one file at a time for reliability
  app.post("/api/projects/batch-upload-single", uploadLimiter, upload.single("video"), async (req, res) => {
    console.log("[batch-upload-single] POST /api/projects/batch-upload-single received");

    try {
      const file = req.file;
      const { batchId, batchIndex } = req.body;

      if (!file) {
        console.error("[batch-upload-single] No file in request");
        res.status(400).json({ error: "No video file provided" });
        return;
      }

      if (!batchId) {
        console.error("[batch-upload-single] No batchId provided");
        res.status(400).json({ error: "Batch ID is required" });
        return;
      }

      const name = file.originalname;
      const index = parseInt(batchIndex || "0", 10);

      console.log(`[batch-upload-single] Processing file: ${name} (batch: ${batchId}, index: ${index})`);

      // Ensure videos directory exists
      if (!fs.existsSync(VIDEOS_DIR)) {
        fs.mkdirSync(VIDEOS_DIR, { recursive: true });
      }

      // Move file to permanent location
      const finalPath = path.join(VIDEOS_DIR, `${nanoid()}-${name}`);
      fs.renameSync(file.path, finalPath);
      console.log(`[batch-upload-single] Moved ${name} to ${finalPath}`);

      // Get video duration and aspect ratio
      const { duration, aspectRatio } = await new Promise<{ duration: number; aspectRatio: "9:16" | "1:1" | "16:9" }>((resolve) => {
        ffmpeg.ffprobe(finalPath, (err: any, metadata: any) => {
          if (err) {
            console.warn(`[batch-upload-single] ffprobe error for ${name}:`, err.message);
            resolve({ duration: 30, aspectRatio: "9:16" });
            return;
          }

          const dur = Math.floor(metadata.format.duration || 30);
          const videoStream = metadata.streams?.find((s: any) => s.codec_type === "video");
          let detectedRatio: "9:16" | "1:1" | "16:9" = "9:16";

          if (videoStream?.width && videoStream?.height) {
            const ratio = videoStream.width / videoStream.height;
            if (ratio < 0.75) {
              detectedRatio = "9:16";
            } else if (ratio >= 0.75 && ratio <= 1.25) {
              detectedRatio = "1:1";
            } else {
              detectedRatio = "16:9";
            }
          }

          resolve({ duration: dur, aspectRatio: detectedRatio });
        });
      });

      // Create project with batch info and permanent path
      const project = await storage.createProject({
        name,
        sourceVideoUrl: "",
        sourceVideoPath: finalPath,
        status: "pending",
        duration,
        batchId,
        batchIndex: index,
        intentConfig: {
          aspectRatio,
          originalAspectRatio: aspectRatio,
        } as any,
      });

      // Initialize progress immediately
      progressMap.set(project.id, {
        stage: "pending",
        progress: 0,
        message: `Uploaded - waiting for intent`,
      });

      console.log(`[batch-upload-single] Project created: ${project.id} with duration ${duration}s`);

      res.json({
        success: true,
        project,
        batchId,
      });
    } catch (error: any) {
      console.error("[batch-upload-single] Error:", error);
      console.error("[batch-upload-single] Stack:", error.stack);
      res.status(500).json({
        error: "Error processing upload",
        details: error.message,
      });
    }
  });

  // Create project from script (text-to-video/carousel/audio)
  app.post("/api/projects/script", uploadLimiter, async (req, res) => {
    try {
      const { name, scriptContent, outputFormats, intentConfig } = req.body;

      if (!scriptContent || scriptContent.trim().length === 0) {
        res.status(400).json({ error: "Script content is required" });
        return;
      }

      console.log(`[script] Creating script-based project: "${name}"`);
      console.log(`[script] Script length: ${scriptContent.length} characters`);
      console.log(`[script] AI Video Mode:`, intentConfig?.useAIVideo ? 'enabled' : 'disabled');
      console.log(`[script] Output formats:`, outputFormats);

      // Determine project type based on AI video mode
      const useAIVideo = intentConfig?.useAIVideo === true;
      const projectType = useAIVideo ? "ai-video" : "carousel";

      console.log(`[script] ✓ Project type determined: ${projectType}`);

      // Create project with script content
      const project = await storage.createProject({
        name: name || "Untitled Script Project",
        projectType,
        sourceVideoUrl: "", // Not applicable for script projects
        scriptContent,
        status: "pending",
        userIntent: useAIVideo ? "ai-decide" : "carousel",
        intentConfig: {
          ...intentConfig,
          outputFormats,
        } as any,
      });

      console.log(`[script] Project created: ${project.id}`);

      // Initialize progress tracking IMMEDIATELY for frontend polling
      progressMap.set(project.id, {
        stage: "analyzing",
        progress: 5,
        message: useAIVideo ? "Starting AI video generation..." : "Parsing script into scenes...",
      });

      // Start async script processing
      const requestedFormats = Array.isArray(outputFormats) && outputFormats.length > 0
        ? outputFormats
        : ["video"]; // Default to video if no formats specified

      processScriptProject(project.id, scriptContent, requestedFormats, intentConfig).catch((err: any) => {
        console.error(`[script] Script processing failed:`, err);
        storage.updateProject(project.id, { status: "error" });
        progressMap.set(project.id, {
          stage: "error",
          progress: 0,
          message: `Failed: ${err.message || 'Unknown error'}`,
        });
      });

      res.json(project);
    } catch (error) {
      console.error("[script] Error creating script project:", error);
      res.status(500).json({ error: "Error creating script project" });
    }
  });

  // Submit batch intent and start processing all projects in parallel
  app.post("/api/projects/batch/:batchId/submit-intent", async (req, res) => {
    try {
      const { userIntent, intentConfig } = req.body;
      const batchId = req.params.batchId;

      console.log("[batch-submit-intent] Processing batch:", batchId);
      console.log("[batch-submit-intent] Intent:", userIntent);

      // Get all projects in this batch
      const allProjects = await storage.getAllProjects();
      const batchProjects = allProjects.filter(p => p.batchId === batchId);

      if (batchProjects.length === 0) {
        res.status(404).json({ error: "No projects found for this batch" });
        return;
      }

      console.log(`[batch-submit-intent] Found ${batchProjects.length} projects in batch`);

      // Update all projects with intent
      for (const project of batchProjects) {
        const mergedIntentConfig = {
          ...(project.intentConfig || {}),
          ...(intentConfig || {}),
        };

        await storage.updateProject(project.id, {
          userIntent,
          intentConfig: mergedIntentConfig as any,
        });

        // Initialize progress
        progressMap.set(project.id, {
          stage: "analyzing",
          progress: 10,
          message: `Processing video ${(project.batchIndex || 0) + 1}/${batchProjects.length}...`,
        });
      }

      // Start processing all videos in parallel with concurrency limit
      const limit = pLimit(3); // Process max 3 videos simultaneously
      const processingPromises = batchProjects
        .filter(p => p.sourceVideoPath)
        .map(project =>
          limit(async () => {
            try {
              await processVideoFromFile(project.id, project.sourceVideoPath!);
              console.log(`[batch-submit-intent] Successfully processed ${project.id}`);
            } catch (err) {
              console.error(`[batch-submit-intent] Processing failed for ${project.id}:`, err);

              // Update project status to error
              await storage.updateProject(project.id, { status: "error" });

              // Update progress map to show error
              progressMap.set(project.id, {
                stage: "error",
                progress: 0,
                message: `Failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
              });
            }
          })
        );

      // Don't wait for all to complete - process in background
      Promise.all(processingPromises).then(() => {
        console.log(`[batch-submit-intent] Batch ${batchId} processing complete`);
      }).catch(err => {
        console.error(`[batch-submit-intent] Batch ${batchId} had errors:`, err);
      });

      res.json({
        success: true,
        batchId,
        projectCount: batchProjects.length,
      });
    } catch (error) {
      console.error("[batch-submit-intent] Error:", error);
      res.status(500).json({ error: "Error submitting batch intent" });
    }
  });

  // Submit user intent and start processing
  app.post("/api/projects/:id/submit-intent", async (req, res) => {
    try {
      const { userIntent, intentConfig } = req.body;
      const projectId = req.params.id;

      console.log("[submit-intent] Received intent:", userIntent);
      console.log("[submit-intent] Received config:", JSON.stringify(intentConfig));

      // Get current project to merge with existing intentConfig
      const project = await storage.getProject(projectId);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      // Merge intentConfig, preserving existing values
      const mergedIntentConfig = {
        ...(project.intentConfig || {}),
        ...(intentConfig || {}),
      };

      // Update project with intent
      await storage.updateProject(projectId, {
        userIntent,
        intentConfig: mergedIntentConfig as any,
      });

      // Verify project has video path
      if (!project.sourceVideoPath) {
        res.status(404).json({ error: "Project video path not found" });
        return;
      }

      // Check if the video file actually exists on disk
      const fs = await import("fs/promises");
      const path = await import("path");
      // Handle both absolute paths and relative paths
      const videoFullPath = path.isAbsolute(project.sourceVideoPath) 
        ? project.sourceVideoPath 
        : path.join(process.cwd(), project.sourceVideoPath);
      try {
        await fs.access(videoFullPath);
      } catch {
        // File doesn't exist - this is a legacy/broken project
        console.error(`[submit-intent] Video file missing: ${videoFullPath}`);
        await storage.updateProject(projectId, {
          status: "error",
        });
        res.status(410).json({ 
          error: "Video file no longer available",
          message: "This project was created in an older version and the video file is no longer available. Please delete this project and upload the video again.",
          isLegacy: true,
        });
        return;
      }

      // Initialize progress before starting processing
      progressMap.set(projectId, {
        stage: "analyzing",
        progress: 10,
        message: "Starting video analysis...",
      });

      // Start processing based on intent
      processVideoFromFile(projectId, project.sourceVideoPath).catch(err => {
        console.error(`[submit-intent] Processing failed:`, err);
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error submitting intent:", error);
      res.status(500).json({ error: "Error submitting intent" });
    }
  });

  // Create a compilation project from multiple source videos
  app.post("/api/projects/compilation", async (req, res) => {
    try {
      const { sourceProjectIds, name, scheduled } = req.body;

      if (!sourceProjectIds || !Array.isArray(sourceProjectIds) || sourceProjectIds.length < 2) {
        res.status(400).json({ error: "At least 2 source projects are required" });
        return;
      }

      if (sourceProjectIds.length > 10) {
        res.status(400).json({ error: "Maximum 10 source projects allowed" });
        return;
      }

      console.log("[compilation] Creating compilation from projects:", sourceProjectIds);

      // Fetch all source projects with proper null checks
      const sourceProjects: Array<{ id: string; sourceVideoPath: string; name: string; duration: number | null; thumbnailPath: string | null }> = [];
      for (const projectId of sourceProjectIds) {
        const project = await storage.getProject(projectId);
        if (!project) {
          res.status(400).json({ error: `Project ${projectId} not found` });
          return;
        }
        if (!project.sourceVideoPath) {
          res.status(400).json({ error: `Project "${project.name}" has no video file` });
          return;
        }
        // Verify file exists
        const videoPath = path.isAbsolute(project.sourceVideoPath) 
          ? project.sourceVideoPath 
          : path.join(process.cwd(), project.sourceVideoPath);
        if (!fs.existsSync(videoPath)) {
          res.status(400).json({ error: `Video file for "${project.name}" is missing` });
          return;
        }
        sourceProjects.push({
          id: project.id,
          sourceVideoPath: project.sourceVideoPath,
          name: project.name,
          duration: project.duration,
          thumbnailPath: project.thumbnailPath,
        });
      }

      // Calculate total duration
      const totalDuration = sourceProjects.reduce((sum, p) => sum + (p.duration || 0), 0);

      // Create output directory for the concatenated video
      const compilationId = nanoid();
      const outputDir = path.join(process.cwd(), "uploads", "compilations");
      await fs.promises.mkdir(outputDir, { recursive: true });
      const outputPath = path.join(outputDir, `${compilationId}.mp4`);
      const relativeOutputPath = path.relative(process.cwd(), outputPath);

      // Create FFmpeg concat file list
      const concatListPath = path.join(outputDir, `${compilationId}_list.txt`);
      const concatContent = sourceProjects
        .map(p => {
          const absPath = path.isAbsolute(p.sourceVideoPath) 
            ? p.sourceVideoPath 
            : path.join(process.cwd(), p.sourceVideoPath);
          return `file '${absPath.replace(/'/g, "'\\''")}'`;
        })
        .join("\n");
      await fs.promises.writeFile(concatListPath, concatContent);

      console.log("[compilation] Concatenating", sourceProjects.length, "videos...");

      // Concatenate videos using FFmpeg (stream copy for speed)
      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(concatListPath)
          .inputOptions(["-f", "concat", "-safe", "0"])
          .outputOptions(["-c", "copy"])
          .output(outputPath)
          .on("end", () => {
            console.log("[compilation] Concatenation complete:", outputPath);
            resolve();
          })
          .on("error", (err) => {
            console.error("[compilation] FFmpeg error:", err);
            reject(err);
          })
          .run();
      });

      // Clean up the concat list file
      await fs.promises.unlink(concatListPath).catch(() => {});

      // Use first source's thumbnail if available
      const thumbnailPath = sourceProjects[0].thumbnailPath || null;

      // Create the compilation project with actual video path
      const compilationProject = await storage.createProject({
        name: name || `Compilation - ${new Date().toLocaleDateString()}`,
        projectType: "compilation",
        sourceVideoPath: relativeOutputPath,
        thumbnailPath,
        status: scheduled ? "scheduled" : "pending",
        duration: totalDuration,
        isCompilation: true,
      });

      // Create project sources linking each video for reference
      const sourcesToCreate = sourceProjects.map((project, index) => ({
        projectId: compilationProject.id,
        sourceProjectId: project.id,
        sourceVideoPath: project.sourceVideoPath,
        originalFileName: project.name,
        duration: project.duration,
        thumbnailPath: project.thumbnailPath,
        order: index,
      }));

      await storage.createProjectSources(sourcesToCreate);

      console.log("[compilation] Created compilation project:", compilationProject.id, "with", sourcesToCreate.length, "sources");

      res.json({
        success: true,
        project: compilationProject,
        sourceCount: sourcesToCreate.length,
        totalDuration,
        scheduled: scheduled || false,
      });
    } catch (error) {
      console.error("[compilation] Error creating compilation:", error);
      res.status(500).json({ error: "Failed to create compilation project" });
    }
  });

  // Get project sources for a compilation project
  app.get("/api/projects/:id/sources", async (req, res) => {
    try {
      const projectId = req.params.id;
      const sources = await storage.getSourcesByProject(projectId);
      res.json(sources);
    } catch (error) {
      console.error("Error fetching project sources:", error);
      res.status(500).json({ error: "Failed to fetch project sources" });
    }
  });

  // Schedule a project for later processing
  app.post("/api/projects/:id/schedule", async (req, res) => {
    try {
      const projectId = req.params.id;
      const { userIntent, intentConfig } = req.body;

      const project = await storage.getProject(projectId);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      // Update project with intent and set status to scheduled
      await storage.updateProject(projectId, {
        userIntent,
        intentConfig: intentConfig as any,
        status: "scheduled",
      });

      console.log("[schedule] Project scheduled:", projectId, "intent:", userIntent);

      res.json({
        success: true,
        message: "Project scheduled for processing. It will be processed in the background.",
      });
    } catch (error) {
      console.error("[schedule] Error scheduling project:", error);
      res.status(500).json({ error: "Failed to schedule project" });
    }
  });

  // Process all scheduled projects (can be called periodically or manually)
  app.post("/api/projects/process-scheduled", async (req, res) => {
    try {
      const allProjects = await storage.getAllProjects();
      const scheduledProjects = allProjects.filter(p => p.status === "scheduled");

      console.log("[process-scheduled] Found", scheduledProjects.length, "scheduled projects");

      // Process each scheduled project
      for (const project of scheduledProjects) {
        if (project.sourceVideoPath) {
          // Update status to analyzing
          await storage.updateProject(project.id, { status: "analyzing" });

          // Initialize progress
          progressMap.set(project.id, {
            stage: "analyzing",
            progress: 5,
            message: "Starting scheduled processing...",
          });

          // Start processing in background
          processVideoFromFile(project.id, project.sourceVideoPath).catch(err => {
            console.error(`[process-scheduled] Failed to process ${project.id}:`, err);
          });
        }
      }

      res.json({
        success: true,
        processedCount: scheduledProjects.length,
        projectIds: scheduledProjects.map(p => p.id),
      });
    } catch (error) {
      console.error("[process-scheduled] Error:", error);
      res.status(500).json({ error: "Failed to process scheduled projects" });
    }
  });

  // Create a new project from URL and start analysis
  app.post("/api/projects", async (req, res) => {
    try {
      const data = insertProjectSchema.parse(req.body);

      // Create project
      const project = await storage.createProject({
        ...data,
        status: "pending",
      });

      // Start async video processing (from URL) - only if URL is provided
      if (data.sourceVideoUrl) {
        processVideoFromUrl(project.id, data.sourceVideoUrl);
      }

      res.json(project);
    } catch (error) {
      console.error("Error creating project:", error);
      res.status(400).json({ error: "Invalid project data" });
    }
  });

  // Get previous uploads (last 20 projects organized by type)
  // IMPORTANT: This route must come BEFORE /api/projects/:id to avoid route collision
  app.get("/api/projects/previous-uploads", async (req, res) => {
    try {
      const allProjects = await storage.getAllProjects();

      // CRITICAL FIX: Show all projects with source video paths, regardless of status
      // This prevents videos from "disappearing" due to status changes
      const uploadsWithVideos = allProjects
        .filter(p => {
          // PRIMARY FILTER: Show ANY project with a source video path
          if (p.sourceVideoPath) {
            // Verify the file actually exists on disk
            try {
              const videoPath = path.isAbsolute(p.sourceVideoPath) 
                ? p.sourceVideoPath 
                : path.join(process.cwd(), p.sourceVideoPath);

              if (fs.existsSync(videoPath)) {
                return true; // File exists, show this project
              } else {
                console.warn(`[previous-uploads] Video file missing for project ${p.id}: ${videoPath}`);
                return false; // File missing, hide from list
              }
            } catch (err) {
              console.error(`[previous-uploads] Error checking file for project ${p.id}:`, err);
              return false;
            }
          }

          // Also show projects currently being processed (even if no video yet)
          if (["analyzing", "processing", "generating", "downloading"].includes(p.status)) {
            return true;
          }

          // Hide everything else (pending uploads with no video file)
          return false;
        })
        .sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeB - timeA;
        })
        .slice(0, 20) // Last 20 uploads
        .map(p => ({
          id: p.id,
          name: p.name,
          sourceVideoPath: p.sourceVideoPath,
          thumbnailPath: p.thumbnailPath,
          duration: p.duration,
          createdAt: p.createdAt,
          projectType: p.projectType || "video",
          userIntent: p.userIntent,
          status: p.status,
          isLegacy: !p.thumbnailPath && p.status === "ready",
        }));

      console.log(`[previous-uploads] Returning ${uploadsWithVideos.length} projects (filtered from ${allProjects.length} total)`);
      res.json(uploadsWithVideos);
    } catch (error) {
      console.error("[previous-uploads] Error fetching previous uploads:", error);
      res.status(500).json({ error: "Failed to fetch previous uploads" });
    }
  });

  // Cleanup incomplete/orphaned uploads (projects with no video file)
  app.post("/api/cleanup/incomplete-uploads", async (req, res) => {
    try {
      const allProjects = await storage.getAllProjects();

      // Find projects with no source_video_path (failed uploads)
      const incompleteProjects = allProjects.filter(p => !p.sourceVideoPath);

      let cleanedCount = 0;
      const deletedProjects: { id: string; name: string; age: string }[] = [];

      for (const project of incompleteProjects) {
        try {
          // Check if this is an old failed upload (more than 1 hour old)
          const createdTime = project.createdAt ? new Date(project.createdAt).getTime() : 0;
          const ageMs = Date.now() - createdTime;
          const ageHours = ageMs / (1000 * 60 * 60);

          // Only delete if older than 1 hour
          if (ageHours > 1) {
            const projectId = project.id;

            // Delete the project
            const deleted = await storage.deleteProject(projectId);
            if (deleted) {
              console.log(`[cleanup] ✅ Deleted incomplete project ${projectId} (${project.name}) from ${ageHours.toFixed(1)} hours ago`);
              cleanedCount++;
              deletedProjects.push({
                id: projectId,
                name: project.name,
                age: `${ageHours.toFixed(1)} hours`
              });
            }
          }
        } catch (err) {
          console.error(`[cleanup] Error processing project ${project.id}:`, err);
        }
      }

      res.json({
        success: true,
        cleanedCount,
        deletedProjects,
        message: `Cleanup complete: Deleted ${cleanedCount} incomplete uploads older than 1 hour`
      });
    } catch (error: any) {
      console.error("[cleanup] Error:", error);
      res.status(500).json({
        error: "Cleanup failed",
        details: error.message,
      });
    }
  });

  // V6.0: Get AI-powered editing recommendations for a project
  // This provides intelligent suggestions based on content analysis
  app.get("/api/projects/:id/recommendations", async (req, res) => {
    try {
      const { id } = req.params;
      const project = await storage.getProject(id);

      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Get slices for this project to analyze engagement
      const slices = await storage.getSlicesByProject(id);

      // Generate smart recommendations
      const recommendations = AIAnalyzer.generateSmartRecommendations(
        project.videoCategory || "generic",
        project.duration || 60,
        slices.map(s => ({
          engagementScore: s.engagementScore,
          clipType: s.clipType
        }))
      );

      res.json({
        projectId: id,
        videoCategory: project.videoCategory || "generic",
        duration: project.duration,
        sliceCount: slices.length,
        recommendations,
      });
    } catch (error: any) {
      console.error("[Recommendations] Error:", error);
      res.status(500).json({
        error: "Failed to generate recommendations",
        details: error.message,
      });
    }
  });

  // V6.0: Quality scoring and analysis endpoint
  app.get("/api/projects/:id/quality-report", async (req, res) => {
    try {
      const { id } = req.params;
      const project = await storage.getProject(id);

      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const videos = await storage.getVideosByProject(id);
      const slices = await storage.getSlicesByProject(id);

      const { QualityScorer } = await import("./services/quality-scorer");

      const reports = [];

      for (const video of videos) {
        if (video.videoPath && video.status === "ready") {
          try {
            const orderedVideoSlices: Array<{
              engagementScore: number;
              clipType: string;
              startTime: number;
              endTime: number;
            }> = [];

            if (video.clipSequence && video.clipSequence.length > 0) {
              for (const sliceId of video.clipSequence) {
                const slice = slices.find(s => s.id === sliceId);
                if (slice) {
                  orderedVideoSlices.push({
                    engagementScore: slice.engagementScore,
                    clipType: slice.clipType,
                    startTime: slice.startTime,
                    endTime: slice.endTime,
                  });
                }
              }
            }

            const report = await QualityScorer.generateQualityReport(
              id,
              video.id,
              video.type as "short" | "standard" | "comprehensive",
              video.videoPath,
              orderedVideoSlices,
              project.duration || 60
            );

            reports.push(report);
          } catch (err: any) {
            console.warn(`[Quality] Could not analyze video ${video.id}:`, err.message);
          }
        }
      }

      const benchmark = QualityScorer.getPlatformBenchmark();
      const optimizedSettings = QualityScorer.getOptimizedSettings(
        project.videoCategory || "generic",
        project.duration || 60
      );

      res.json({
        projectId: id,
        projectName: project.name,
        videoReports: reports,
        platformBenchmark: benchmark,
        optimizedSettings,
        overallGrade: reports.length > 0
          ? reports.reduce((a, r) => a + r.qualityScores.overall, 0) / reports.length
          : 0,
      });
    } catch (error: any) {
      console.error("[Quality] Error:", error);
      res.status(500).json({
        error: "Failed to generate quality report",
        details: error.message,
      });
    }
  });

  // V6.0: Platform-wide benchmark and improvement tracking
  app.get("/api/quality/benchmark", async (req, res) => {
    try {
      const { QualityScorer } = await import("./services/quality-scorer");
      const benchmark = QualityScorer.getPlatformBenchmark();
      const allReports = QualityScorer.getAllReports();

      const rankDistribution = {
        S: allReports.filter(r => r.competitiveRank === "S").length,
        A: allReports.filter(r => r.competitiveRank === "A").length,
        B: allReports.filter(r => r.competitiveRank === "B").length,
        C: allReports.filter(r => r.competitiveRank === "C").length,
        D: allReports.filter(r => r.competitiveRank === "D").length,
      };

      res.json({
        benchmark,
        totalVideosAnalyzed: allReports.length,
        rankDistribution,
        recentReports: allReports.slice(-10).map(r => ({
          projectId: r.projectId,
          videoType: r.videoType,
          overall: r.qualityScores.overall,
          rank: r.competitiveRank,
          timestamp: r.timestamp,
        })),
      });
    } catch (error: any) {
      console.error("[Benchmark] Error:", error);
      res.status(500).json({
        error: "Failed to get benchmark data",
        details: error.message,
      });
    }
  });

  // Delete project and associated files
  // IMPORTANT: This route must come BEFORE GET /api/projects/:id
  // Duplicate a project (create a copy with same source video)
  app.post("/api/projects/:id/duplicate", async (req, res) => {
    try {
      const { id } = req.params;
      const originalProject = await storage.getProject(id);

      if (!originalProject || !originalProject.sourceVideoPath) {
        return res.status(404).json({ error: "Project or video not found" });
      }

      // Create duplicate with same source video but reset status
      const duplicatedProject = await storage.createProject({
        name: `${originalProject.name} - Copy`,
        sourceVideoUrl: originalProject.sourceVideoUrl,
        sourceVideoPath: originalProject.sourceVideoPath,
        duration: originalProject.duration,
        status: "pending", // Reset to pending for fresh intent selection
        projectType: originalProject.projectType,
      });

      console.log(`[Duplicate] Created copy of project ${id} as ${duplicatedProject.id}`);

      res.json({
        success: true,
        duplicateProjectId: duplicatedProject.id,
        duplicateProject: duplicatedProject,
        message: `Project duplicated as "${duplicatedProject.name}"`,
      });
    } catch (error: any) {
      console.error("[Duplicate] Error:", error);
      res.status(500).json({
        error: "Failed to duplicate project",
        details: error.message,
      });
    }
  });

  // Retry/reset a stuck project - resets status and clears old data
  app.post("/api/projects/:id/retry", async (req, res) => {
    try {
      const projectId = req.params.id;

      const project = await storage.getProject(projectId);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      console.log(`[Retry] Resetting stuck project ${projectId} (current status: ${project.status})`);

      // Delete old slices and videos
      const existingSlices = await storage.getSlicesByProject(projectId);
      const existingVideos = await storage.getVideosByProject(projectId);

      // Delete video files from disk
      for (const video of existingVideos) {
        if (video.videoPath) {
          const fullPath = VideoProcessor.getFullPath(video.videoPath);
          try {
            if (fs.existsSync(fullPath)) {
              fs.unlinkSync(fullPath);
              console.log(`[Retry] Deleted old video file: ${fullPath}`);
            }
          } catch (err) {
            console.warn(`[Retry] Failed to delete video file ${fullPath}:`, err);
          }
        }
        await storage.deleteVideo(video.id);
      }

      // Delete old slices
      for (const slice of existingSlices) {
        await storage.deleteSlice(slice.id);
      }

      // Reset project status to pending
      await storage.updateProject(projectId, {
        status: "pending",
        userIntent: null,
        intentConfig: null,
      });

      // Clear progress map entry completely
      progressMap.delete(projectId);

      // Set a fresh "reset" progress state so clients know to refresh
      progressMap.set(projectId, {
        stage: "pending",
        progress: 0,
        message: "Project has been reset. Select an editing intent to start fresh.",
      });

      // Complete any editing logs for this project
      try {
        completeEditingLog(projectId, "reset");
      } catch (err) {
        console.warn(`[Retry] Could not complete editing log:`, err);
      }

      // Broadcast the reset state to any connected SSE clients
      try {
        broadcastEditingProgress(projectId, {
          stage: "reset",
          progress: 0,
          message: "Project has been reset. Ready for new editing intent.",
        });
      } catch (err) {
        console.warn(`[Retry] Could not broadcast reset:`, err);
      }

      console.log(`[Retry] Project ${projectId} reset successfully. Cleared ${existingSlices.length} slices, ${existingVideos.length} videos`);

      // Get the fresh project state
      const resetProject = await storage.getProject(projectId);

      res.json({
        success: true,
        message: "Project reset successfully. You can now select a new editing intent.",
        projectId: projectId,
        project: resetProject,
        status: "pending",
        deletedSlices: existingSlices.length,
        deletedVideos: existingVideos.length,
      });
    } catch (error: any) {
      console.error("[Retry] Error:", error);
      res.status(500).json({
        error: "Failed to reset project",
        details: error.message,
      });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const projectId = req.params.id;

      // Get project to find associated files
      const project = await storage.getProject(projectId);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      // Get all generated videos to delete their files
      const videos = await storage.getVideosByProject(projectId);

      // Delete video files from disk
      const filesToDelete: string[] = [];

      // Add source video path
      if (project.sourceVideoPath) {
        // sourceVideoPath is already a full filesystem path
        filesToDelete.push(project.sourceVideoPath);
      }

      // Add generated video paths
      videos.forEach(video => {
        if (video.videoPath) {
          // Use VideoProcessor.getFullPath to handle all path formats correctly
          const fullPath = VideoProcessor.getFullPath(video.videoPath);
          filesToDelete.push(fullPath);
        }
      });

      // Delete files
      let deletedCount = 0;
      let skippedCount = 0;
      for (const filePath of filesToDelete) {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            deletedCount++;
            console.log(`[delete] Removed file: ${filePath}`);
          } else {
            skippedCount++;
            console.warn(`[delete] File not found (skipped): ${filePath}`);
          }
        } catch (fileError) {
          skippedCount++;
          console.error(`[delete] Failed to delete file ${filePath}:`, fileError);
          // Continue even if file deletion fails
        }
      }
      console.log(`[delete] File deletion summary: ${deletedCount} deleted, ${skippedCount} skipped`);

      // Delete from database
      const deleted = await storage.deleteProject(projectId);

      if (deleted) {
        console.log(`[delete] Project ${projectId} deleted successfully`);
        res.json({ success: true, filesDeleted: deletedCount, filesSkipped: skippedCount });
      } else {
        res.status(500).json({ error: "Failed to delete project from database" });
      }
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  // Cleanup orphaned videos - delete from database any videos whose files don't exist on disk
  app.delete("/api/cleanup/orphaned-videos", async (req, res) => {
    try {
      console.log(`[cleanup] Starting orphaned video cleanup...`);
      const allProjects = await storage.getAllProjects();
      let deletedCount = 0;
      const orphanedVideos: string[] = [];

      for (const project of allProjects) {
        const videos = await storage.getVideosByProject(project.id);

        for (const video of videos) {
          if (!video.videoPath) continue;

          const fullPath = VideoProcessor.getFullPath(video.videoPath);
          const exists = fs.existsSync(fullPath);

          if (!exists) {
            // Video file doesn't exist on disk - delete from database
            const deleted = await storage.deleteVideo(video.id);
            if (deleted) {
              deletedCount++;
              orphanedVideos.push(`${video.videoPath} (Project: ${project.id})`);
              console.log(`[cleanup] Deleted orphaned video: ${video.videoPath}`);
            }
          }
        }
      }

      console.log(`[cleanup] Cleanup complete. Deleted ${deletedCount} orphaned video(s) from database`);
      res.json({
        success: true,
        deletedCount,
        orphanedVideos,
        message: `Removed ${deletedCount} orphaned video records from database`
      });
    } catch (error) {
      console.error("[cleanup] Error cleaning up orphaned videos:", error);
      res.status(500).json({ error: "Failed to cleanup orphaned videos" });
    }
  });

  // Get project by ID
  app.get("/api/projects/:id", async (req, res) => {
    const project = await storage.getProject(req.params.id);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    res.json(project);
  });

  // Get project progress
  // Get batch progress for all projects in a batch
  app.get("/api/projects/batch/:batchId/progress", async (req, res) => {
    try {
      const batchId = req.params.batchId;
      const allProjects = await storage.getAllProjects();
      const batchProjects = allProjects.filter(p => p.batchId === batchId);

      if (batchProjects.length === 0) {
        res.status(404).json({ error: "Batch not found" });
        return;
      }

      // Get progress for each project in batch
      const batchProgress = batchProjects.map(project => ({
        projectId: project.id,
        name: project.name,
        batchIndex: project.batchIndex || 0,
        status: project.status,
        progress: progressMap.get(project.id) || {
          stage: project.status === "ready" ? "complete" : "pending",
          progress: project.status === "ready" ? 100 : 0,
          message: project.status === "ready" ? "Complete" : "Waiting to start...",
        },
      }));

      // Calculate overall batch progress
      const totalProgress = batchProgress.reduce((sum, p) => sum + p.progress.progress, 0);
      const avgProgress = Math.floor(totalProgress / batchProjects.length);

      res.json({
        batchId,
        projectCount: batchProjects.length,
        overallProgress: avgProgress,
        projects: batchProgress.sort((a, b) => a.batchIndex - b.batchIndex),
      });
    } catch (error) {
      console.error("[batch-progress] Error:", error);
      res.status(500).json({ error: "Error fetching batch progress" });
    }
  });

  app.get("/api/projects/:id/progress", async (req, res) => {
    try {
      const projectId = req.params.id;
      let progress = progressMap.get(projectId);

      // If no active progress in map, check project status and return appropriate state
      if (!progress) {
        const project = await storage.getProject(projectId);
        if (!project) {
          res.status(404).json({ error: "Project not found" });
          return;
        }

        // Return progress based on project status
        if (project.status === "ready" || project.status === "complete") {
          progress = {
            stage: "complete",
            progress: 100,
            message: "Processing complete",
          };
        } else if (project.status === "error") {
          progress = {
            stage: "error",
            progress: 0,
            message: "Processing failed",
          };
        } else {
          // Project exists but no progress tracking yet
          progress = {
            stage: "pending",
            progress: 0,
            message: "Waiting to start processing",
          };
        }
      }

      res.json(progress);
    } catch (error) {
      res.status(500).json({ error: "Error fetching progress" });
    }
  });

  // AI-POWERED TEXT POSITIONING - Analyze frame for optimal text placement
  app.post("/api/projects/:projectId/analyze-text-position", aiLimiter, async (req, res) => {
    try {
      const { projectId } = req.params;
      const { timestamp } = req.body;

      const project = await storage.getProject(projectId);
      if (!project || !project.sourceVideoPath) {
        res.status(404).json({ error: "Project or video not found" });
        return;
      }

      console.log(`[text-position] Analyzing frame at ${timestamp}s for text placement`);

      // Extract frame at specified timestamp
      const framePath = await AIAnalyzer.extractFrameAtTimestamp(
        VideoProcessor.getFullPath(project.sourceVideoPath),
        timestamp
      );

      // Analyze safe zones for text
      const analysis = await AIAnalyzer.analyzeSafeTextZones(framePath);

      res.json(analysis);
    } catch (error: any) {
      console.error("[text-position] Error:", error);
      res.status(500).json({
        error: "Failed to analyze text position",
        details: error.message,
      });
    }
  });

  // Get triptych videos for a project
  app.get("/api/projects/:id/videos", async (req, res) => {
    try {
      const videos = await storage.getVideosByProject(req.params.id);
      const slices = await storage.getSlicesByProject(req.params.id);
      const project = await storage.getProject(req.params.id);

      // Intent-driven: Return empty triptych if no videos generated yet
      if (!videos || videos.length === 0) {
        const emptyTriptych: TriptychVideos = {
          short: null,
          standard: null,
          comprehensive: null,
          multipleClips: [],
        };
        res.json(emptyTriptych);
        return;
      }

      // For multiple-clips intent, return all clips in the 'multipleClips' slot
      if (project?.userIntent === "multiple-clips") {
        const allClips = videos.map(video => ({
          ...video,
          slices: slices.filter((s) =>
            Array.isArray(video.clipSequence) &&
            (video.clipSequence as string[]).includes(s.id)
          ),
        }));

        // Return in triptych format but with all clips in "short" slot (preview) and 'multipleClips'
        const triptych: TriptychVideos = {
          short: allClips[0] || null, // First clip for preview
          standard: null,
          comprehensive: null,
          multipleClips: allClips, // All clips here
        };

        console.log(`[videos] Returning ${allClips.length} clips for multiple-clips intent`);
        res.json(triptych);
        return;
      }

      // For other intents, use the triptych view (first one of each type)
      const shortVideo = videos.find((v) => v.type === "short");
      const standardVideo = videos.find((v) => v.type === "standard");
      const comprehensiveVideo = videos.find((v) => v.type === "comprehensive");

      // Validate video files exist before returning
      const validateVideo = async (video: any, slices: any[]) => {
        if (!video) return null;

        const fullPath = VideoProcessor.getFullPath(video.videoPath);
        const exists = fs.existsSync(fullPath);

        if (!exists) {
          console.warn(`[videos] Video file missing: ${fullPath}`);
          return null;
        }

        return {
          ...video,
          videoPath: VideoProcessor.getPublicPath(video.videoPath),
          slices
        };
      };

      const shortSlices = slices.filter((s) =>
        Array.isArray(shortVideo?.clipSequence) &&
        shortVideo.clipSequence.includes(s.id)
      );
      const standardSlices = slices.filter((s) =>
        Array.isArray(standardVideo?.clipSequence) &&
        standardVideo.clipSequence.includes(s.id)
      );
      const comprehensiveSlices = slices.filter((s) =>
        Array.isArray(comprehensiveVideo?.clipSequence) &&
        comprehensiveVideo.clipSequence.includes(s.id)
      );

      const validatedShort = await validateVideo(shortVideo, shortSlices);
      const validatedStandard = await validateVideo(standardVideo, standardSlices);
      const validatedComprehensive = await validateVideo(comprehensiveVideo, comprehensiveSlices);

      const totalValidVideos = [validatedShort, validatedStandard, validatedComprehensive].filter(Boolean).length;

      // Return triptych with validated videos only
      console.log(`[videos] Returning triptych with ${totalValidVideos} valid videos`);
      res.json({
        short: validatedShort,
        standard: validatedStandard,
        comprehensive: validatedComprehensive,
      });
    } catch (error) {
      console.error("Error fetching videos:", error);
      res.status(500).json({ error: "Error fetching videos" });
    }
  });

  // Unified feedback interpretation endpoint
  app.post('/api/projects/:projectId/interpret-feedback', async (req, res) => {
    try {
      const { projectId } = req.params;
      const { feedback, videoType, originalPrompt, currentParameters } = req.body;

      if (!feedback) {
        return res.status(400).json({ error: 'Feedback is required' });
      }

      console.log(`[Feedback] Interpreting feedback for project ${projectId}:`, feedback);

      const { FeedbackProcessor } = await import('./services/feedback-processor');

      // If there's an original prompt (AI video), refine it too
      if (originalPrompt) {
        const result = await FeedbackProcessor.processFeedbackWithPromptRefinement(feedback, {
          videoType,
          originalPrompt,
          currentParameters,
        });
        return res.json(result);
      }

      // Otherwise, just extract parameters
      const params = await FeedbackProcessor.processFeedback(feedback, {
        videoType,
        currentParameters,
      });

      res.json(params);
    } catch (error: any) {
      console.error('[Feedback] Interpretation error:', error);
      res.status(500).json({ error: error.message || 'Failed to interpret feedback' });
    }
  });

  // Refine video with feedback (unified)
  app.post('/api/projects/:projectId/refine-video', async (req, res) => {
    try {
      const { projectId } = req.params;
      const { feedback, videoType, params } = req.body;

      console.log(`[RefineVideo] Refining ${videoType} for project ${projectId}`);
      console.log(`[RefineVideo] Feedback: ${feedback}`);

      // Extract original prompt from appliedStyle if available, or create a default
      const appliedStyle = video.appliedStyle || {};
      const originalPrompt = (appliedStyle as any)?.originalPrompt || 
                            `Generate a ${videoType} duration video with ${project.videoCategory || 'standard'} style editing`;

      console.log(`[RefineVideo] Original prompt:`, originalPrompt);

      const { FeedbackProcessor } = await import('./services/feedback-processor');

      // Process feedback using unified processor
      let refinedParams = { ...params };
      let refinedPrompt = originalPrompt;

      if (feedback) {
        if (originalPrompt) {
          // AI video: refine prompt AND extract parameters
          const result = await FeedbackProcessor.processFeedbackWithPromptRefinement(feedback, {
            videoType,
            originalPrompt,
            currentParameters: params,
          });

          refinedPrompt = result.refinedPrompt;
          refinedParams = FeedbackProcessor.mergeParameters(params, result.extractedParameters);

          console.log(`[RefineVideo] Refined prompt:`, refinedPrompt);
          console.log(`[RefineVideo] Extracted parameters:`, result.extractedParameters);
        } else {
          // Regular video: just extract parameters
          const extractedParams = await FeedbackProcessor.processFeedback(feedback, {
            videoType,
            currentParameters: params,
          });

          refinedParams = FeedbackProcessor.mergeParameters(params, extractedParams);
          console.log(`[RefineVideo] Extracted parameters:`, extractedParams);
        }
      }

      // Apply refined parameters to modify clip selection
      const targetDuration = videoType === 'short' ? 30 : videoType === 'standard' ? 60 : 180;
      const engagementThreshold = refinedParams.engagementThreshold || params.engagementThreshold || 50;

      // Select clips based on refined parameters
      const slices = await storage.getSlicesByProject(projectId);
      const eligibleSlices = slices
        .filter(s => (s.engagementScore || 0) >= engagementThreshold)
        .sort((a, b) => (b.engagementScore || 0) - (a.engagementScore || 0));

      if (eligibleSlices.length === 0) {
        return res.status(400).json({ error: "No clips met the refined criteria" });
      }

      const newClipSequence: string[] = [];
      let currentDuration = 0;

      for (const slice of eligibleSlices) {
        const sliceDuration = slice.endTime - slice.startTime;
        if (currentDuration + sliceDuration <= targetDuration) {
          newClipSequence.push(slice.id);
          currentDuration += sliceDuration;
        }
        if (currentDuration >= targetDuration * 0.9) break;
      }

      if (newClipSequence.length === 0) {
        return res.status(400).json({ error: "No clips selected after applying refinements" });
      }

      // Get project to check outputMode
      const project = await storage.getProject(projectId);
      const intentConfig = project?.intentConfig as { outputMode?: string } | null;
      const outputMode = intentConfig?.outputMode || "polished_reels";

      const sourceVideoPath = VideoProcessor.getFullPath(project?.sourceVideoPath || "");

      // NEW: Pass refined parameters to VideoProcessor
      let videoPath = await VideoProcessor.regenerateVideoFromClips(
        sourceVideoPath,
        slices, // Pass all slices for context
        newClipSequence,
        videoType as "short" | "standard" | "comprehensive",
        "9:16", // Default to vertical reel format
        {
          transitionStyle: refinedParams.transitionType || refinedParams.transitionStyle,
          pacing: refinedParams.pacing,
          colorGrade: refinedParams.colorGrade,
          enableJLCuts: refinedParams.enableJLCuts,
          jlCutType: refinedParams.jlCutType,
        }
      );

      // Apply transitions if specified (skip in raw_slices mode)
      let finalVideoPath = videoPath;
      const transitionType = refinedParams.transitionType;
      const transitionDuration = refinedParams.transitionDuration || 0.8;

      if (transitionType && outputMode !== "raw_slices") {
        console.log(`[RefineVideo] Applying ${transitionType} transitions...`);

        // Extract individual clips
        const clipPaths: string[] = [];
        if (!fs.existsSync(TEMP_CLIPS_DIR)) {
          fs.mkdirSync(TEMP_CLIPS_DIR, { recursive: true });
        }

        for (let i = 0; i < newClipSequence.length; i++) {
          const sliceId = newClipSequence[i];
          const slice = slices.find(s => s.id === sliceId);
          if (slice) {
            const clipPath = path.join(TEMP_CLIPS_DIR, `clip-${i}.mp4`);
            await new Promise<void>((resolve, reject) => {
              ffmpeg(sourceVideoPath)
                .setStartTime(slice.startTime)
                .setDuration(slice.endTime - slice.startTime)
                .output(clipPath)
                .videoCodec("libx264")
                .audioCodec("aac")
                .outputOptions(["-preset", "fast", "-crf", "23"])
                .on("end", () => resolve())
                .on("error", reject)
                .run();
            });
            clipPaths.push(clipPath);
          }
        }

        // Apply smart transitions with J/L cuts for smoother flow
        const transitionOutputPath = path.join(VIDEOS_DIR, `transitions-${nanoid()}.mp4`);
        const baseTransition = {
          type: transitionType,
          duration: transitionDuration,
        };

        // Get video context for content-aware transitions
        const videoContext = (intentConfig as any)?.context || "generic";

        await TransitionEngine.applySmartTransitionsToSequence(
          clipPaths,
          transitionOutputPath,
          baseTransition,
          {
            enableBeatSync: videoContext === "music_video" || videoContext === "hype",
            enableSceneAware: true,
            enableJLCuts: true,
            preferredJLType: "auto",
            jlOffset: 0.3
          }
        );
        videoPath = transitionOutputPath;
        console.log(`[RefineVideo] Smart transitions applied: ${transitionOutputPath}`);
      }

      // Apply color grading if specified (skip in raw_slices mode)
      const colorGrade = refinedParams.colorGrade || params.colorGrade;
      if (colorGrade && colorGrade !== 'none' && outputMode !== "raw_slices") {
        console.log(`[RefineVideo] Applying color grade: ${colorGrade}`);
        const gradedPath = await VideoProcessor.applyColorGrading(videoPath, colorGrade);
        if (gradedPath) videoPath = gradedPath;
      }

      // Update or create video record
      const videos = await storage.getVideosByProject(projectId);
      const video = videos.find(v => v.type === videoType);

      if (video) {
        await storage.updateVideo(video.id, {
          videoPath: VideoProcessor.getPublicPath(videoPath),
          clipSequence: newClipSequence,
          status: "ready",
          appliedStyle: refinedParams,
        });
        res.json({
          success: true,
          video: {
            ...video,
            videoPath: VideoProcessor.getPublicPath(videoPath),
          },
          appliedParams: refinedParams,
          refinedPrompt
        });
      } else {
        const newVideo = await storage.createVideo({
          projectId,
          type: videoType as "short" | "standard" | "comprehensive",
          duration: currentDuration,
          videoPath: VideoProcessor.getPublicPath(videoPath),
          clipSequence: newClipSequence,
          status: "ready",
          appliedStyle: refinedParams,
        });
        res.json({
          success: true,
          video: newVideo,
          appliedParams: refinedParams,
          refinedPrompt
        });
      }
    } catch (error: any) {
      console.error(`[RefineVideo] Error: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  // Apply AI refinement (called from editor page)
  // This is an alias/adapter for the refine-video endpoint
  app.post('/api/projects/:projectId/apply-refinement', async (req, res) => {
    try {
      const { projectId } = req.params;
      const { videoId, feedback } = req.body;

      if (!feedback || (Array.isArray(feedback) && feedback.length === 0)) {
        return res.status(400).json({ error: 'Feedback is required' });
      }

      const feedbackText = Array.isArray(feedback) ? feedback.join('. ') : feedback;
      console.log(`[ApplyRefinement] Project ${projectId}, Video ${videoId}`);
      console.log(`[ApplyRefinement] Feedback: ${feedbackText}`);

      // Get current video to determine type and current params
      const video = videoId ? await storage.getVideoById(videoId) : null;
      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }

      // Get project
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Forward to the refine-video logic by importing and calling directly
      const { FeedbackProcessor } = await import('./services/feedback-processor');

      // Process feedback using unified processor (same as refine-video)
      const currentParams = (video.appliedStyle || {}) as Record<string, unknown>;
      let refinedParams = { ...currentParams };
      let refinedPrompt = (currentParams as any).originalPrompt || '';

      // Check if this is an AI video with an original prompt
      if ((currentParams as any).originalPrompt) {
        // AI video: refine prompt AND extract parameters (same as refine-video)
        const result = await FeedbackProcessor.processFeedbackWithPromptRefinement(feedbackText, {
          videoType: video.type || 'standard',
          originalPrompt: (currentParams as any).originalPrompt,
          currentParameters: currentParams,
        });

        refinedPrompt = result.refinedPrompt;
        refinedParams = FeedbackProcessor.mergeParameters(currentParams, result.extractedParameters);

        console.log(`[ApplyRefinement] Refined prompt:`, refinedPrompt);
        console.log(`[ApplyRefinement] Extracted parameters:`, result.extractedParameters);
      } else {
        // Regular video: just extract parameters
        const extractedParams = await FeedbackProcessor.processFeedback(feedbackText, {
          videoType: video.type || 'standard',
          currentParameters: currentParams,
        });

        refinedParams = FeedbackProcessor.mergeParameters(currentParams, extractedParams);
        console.log(`[ApplyRefinement] Extracted parameters:`, extractedParams);
      }

      console.log(`[ApplyRefinement] Merged parameters:`, refinedParams);

      // Get slices and determine target duration
      const slices = await storage.getSlicesByProject(projectId);

      // Check for duration change in feedback
      let targetDuration = video.duration || 60;
      if ((refinedParams as any).targetDuration) {
        targetDuration = (refinedParams as any).targetDuration;
        console.log(`[ApplyRefinement] Adjusting target duration to ${targetDuration}s`);
      }

      const engagementThreshold = (refinedParams as any).engagementThreshold || 50;

      // Re-select clips based on refined parameters
      const eligibleSlices = slices
        .filter(s => (s.engagementScore || 0) >= engagementThreshold)
        .sort((a, b) => (b.engagementScore || 0) - (a.engagementScore || 0));

      const newClipSequence: string[] = [];
      let currentDuration = 0;

      for (const slice of eligibleSlices) {
        const sliceDuration = slice.endTime - slice.startTime;
        if (currentDuration + sliceDuration <= targetDuration) {
          newClipSequence.push(slice.id);
          currentDuration += sliceDuration;
        }
        if (currentDuration >= targetDuration * 0.9) break;
      }

      if (newClipSequence.length === 0) {
        return res.status(400).json({ error: 'No clips matched the refined criteria' });
      }

      console.log(`[ApplyRefinement] New clip sequence: ${newClipSequence.length} clips, ${currentDuration.toFixed(1)}s`);

      // Get source video path and output mode
      const sourceVideoPath = VideoProcessor.getFullPath(project.sourceVideoPath || '');
      const intentConfig = project.intentConfig as { outputMode?: string } | null;
      const outputMode = intentConfig?.outputMode || 'polished_reels';

      // Regenerate video with new clips (same logic as refine-video)
      let videoPath = await VideoProcessor.regenerateVideoFromClips(
        sourceVideoPath,
        slices,
        newClipSequence,
        video.type as 'short' | 'standard' | 'comprehensive',
        '9:16',
        {
          transitionStyle: (refinedParams as any).transitionType || (refinedParams as any).transitionStyle,
          pacing: (refinedParams as any).pacing,
          colorGrade: (refinedParams as any).colorGrade,
          enableJLCuts: (refinedParams as any).enableJLCuts,
          jlCutType: (refinedParams as any).jlCutType,
        }
      );

      // Apply transitions if specified (skip in raw_slices mode)
      let finalVideoPath = videoPath;
      const transitionType = (refinedParams as any).transitionType;
      const transitionDuration = (refinedParams as any).transitionDuration || 0.8;

      if (transitionType && outputMode !== 'raw_slices') {
        console.log(`[ApplyRefinement] Applying ${transitionType} transitions...`);

        // Extract clips for transitions
        const extractedClipPaths: string[] = [];
        for (const sliceId of newClipSequence) {
          const slice = slices.find(s => s.id === sliceId);
          if (!slice) continue;
          const clipPath = await VideoProcessor.extractClip(
            sourceVideoPath,
            slice.startTime,
            slice.endTime,
            false
          );
          extractedClipPaths.push(clipPath);
        }

        if (extractedClipPaths.length > 1) {
          const TransitionEngine = (await import('./services/transition-engine')).TransitionEngine;
          const transitionedPath = await TransitionEngine.applySmartTransitionsToSequence(
            extractedClipPaths,
            { type: transitionType, duration: transitionDuration, vibe: (refinedParams as any).colorGrade || 'vibrant' }
          );
          finalVideoPath = transitionedPath;
        }
      }

      // Apply color grading if specified
      const colorGrade = (refinedParams as any).colorGrade;
      if (colorGrade && colorGrade !== 'none' && outputMode !== 'raw_slices') {
        console.log(`[ApplyRefinement] Applying color grade: ${colorGrade}`);
        const gradedPath = await VideoProcessor.applyColorGrading(finalVideoPath, colorGrade);
        if (gradedPath) finalVideoPath = gradedPath;
      }

      // Update video record with all refined data (including refined prompt for AI videos)
      const updatedStyle = {
        ...refinedParams,
        ...(refinedPrompt ? { originalPrompt: refinedPrompt } : {}),
      };

      await storage.updateVideo(video.id, {
        videoPath: VideoProcessor.getPublicPath(finalVideoPath),
        clipSequence: newClipSequence,
        duration: Math.round(currentDuration), // Round to integer for database
        appliedStyle: updatedStyle,
        status: 'ready',
      });

      console.log(`[ApplyRefinement] ✓ Video regenerated and updated successfully`);

      res.json({
        success: true,
        message: 'AI refinement applied successfully',
        video: {
          ...video,
          videoPath: VideoProcessor.getPublicPath(finalVideoPath),
          duration: currentDuration,
          clipSequence: newClipSequence,
          appliedStyle: updatedStyle,
        },
        appliedParams: refinedParams,
        refinedPrompt,
        newDuration: currentDuration,
        clipCount: newClipSequence.length,
      });

    } catch (error: any) {
      console.error(`[ApplyRefinement] Error:`, error);
      res.status(500).json({ error: error.message || 'Failed to apply refinement' });
    }
  });

  // Get smart slices for a project
  app.get("/api/projects/:id/slices", async (req, res) => {
    try {
      const slices = await storage.getSlicesByProject(req.params.id);
      res.json(slices);
    } catch (error) {
      res.status(500).json({ error: "Error fetching slices" });
    }
  });

  // Refit video with new clip sequence (AI auto-refit)
  app.post("/api/projects/:projectId/videos/:videoId/refit", async (req, res) => {
    try {
      const { projectId, videoId } = req.params;
      const { clipSequence } = req.body;

      if (!Array.isArray(clipSequence)) {
        res.status(400).json({ error: "clipSequence must be an array" });
        return;
      }

      console.log(`[refit] Refitting video ${videoId} with ${clipSequence.length} clips`);

      const video = await storage.getVideoById(videoId);
      if (!video) {
        res.status(404).json({ error: "Video not found" });
        return;
      }

      const project = await storage.getProject(projectId);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const slices = await storage.getSlicesByProject(projectId);
      if (slices.length === 0) {
        res.status(400).json({ error: "No slices found for project" });
        return;
      }

      // AI Refit Logic: Adjust clips to maintain target duration
      const targetDuration = video.duration;
      let refittedSequence = [...clipSequence];

      // Calculate current total duration
      let currentDuration = clipSequence.reduce((sum: number, sliceId: string) => {
        const slice = slices.find(s => s.id === sliceId);
        return sum + (slice ? (slice.endTime - slice.startTime) : 0);
      }, 0);

      console.log(`[refit] Current: ${currentDuration}s, Target: ${targetDuration}s`);

      // If too long, remove lowest engagement clips
      while (currentDuration > targetDuration && refittedSequence.length > 1) {
        const lowestEngagementSlice = refittedSequence
          .map(id => slices.find(s => s.id === id))
          .filter(s => s !== undefined)
          .sort((a, b) => (a!.engagementScore || 0) - (b!.engagementScore || 0))[0];

        if (lowestEngagementSlice) {
          refittedSequence = refittedSequence.filter(id => id !== lowestEngagementSlice.id);
          currentDuration -= (lowestEngagementSlice.endTime - lowestEngagementSlice.startTime);
          console.log(`[refit] Removed clip ${lowestEngagementSlice.id} (${lowestEngagementSlice.engagementScore} engagement)`);
        } else {
          break;
        }
      }

      // If too short, add highest engagement unused clips
      const usedIds = new Set(refittedSequence);
      const unusedSlices = slices
        .filter(s => !usedIds.has(s.id))
        .sort((a, b) => (b.engagementScore || 0) - (a.engagementScore || 0));

      while (currentDuration < targetDuration && unusedSlices.length > 0) {
        const nextSlice = unusedSlices.shift();
        if (nextSlice) {
          const sliceDuration = nextSlice.endTime - nextSlice.startTime;
          if (currentDuration + sliceDuration <= targetDuration + 5) { // 5s tolerance
            refittedSequence.push(nextSlice.id);
            currentDuration += sliceDuration;
            console.log(`[refit] Added clip ${nextSlice.id} (${nextSlice.engagementScore} engagement)`);
          }
        }
      }

      console.log(`[refit] Final duration: ${currentDuration}s (target: ${targetDuration}s)`);

      // Update video with new sequence (array type, not JSON string)
      await storage.updateVideo(videoId, {
        clipSequence: refittedSequence as any, // Storage layer handles array serialization
        duration: currentDuration,
        status: "pending", // Mark for re-rendering
      });

      // Regenerate video using global MOCK_MODE flag
      if (MOCK_MODE) {
        console.log("[refit] Mock mode: Video marked as ready without regeneration");
        await storage.updateVideo(videoId, { status: "ready" });
        res.json({ success: true, newDuration: currentDuration });
      } else {
        // Trigger real FFmpeg regeneration
        res.json({ success: true, newDuration: currentDuration, status: "regenerating" });

        // Regenerate video in background
        (async () => {
          try {
            console.log("[refit] Starting video regeneration with FFmpeg");

            // Validate video type
            const validTypes = ["short", "standard", "comprehensive"] as const;
            if (!validTypes.includes(video.type as any)) {
              throw new Error(`Invalid video type: ${video.type}. Expected one of: ${validTypes.join(', ')}`);
            }

            const sourceVideoPath = VideoProcessor.getFullPath(project.sourceVideoPath || "");

            if (!fs.existsSync(sourceVideoPath)) {
              throw new Error(`Source video not found: ${sourceVideoPath}`);
            }

            const newVideoPath = await VideoProcessor.regenerateVideoFromClips(
              sourceVideoPath,
              slices,
              refittedSequence,
              video.type as "short" | "standard" | "comprehensive",
              "9:16" // Default to vertical reel format
            );

            await storage.updateVideo(videoId, {
              videoPath: newVideoPath,
              duration: currentDuration,
              status: "ready",
            });

            console.log(`[refit] Video ${videoId} regenerated successfully at ${newVideoPath}`);
          } catch (error: any) {
            console.error(`[refit] Background regeneration failed:`, error);
            await storage.updateVideo(videoId, { status: "error" });
          }
        })();
      }
    } catch (error: any) {
      console.error("[refit] Error:", error);
      res.status(500).json({ error: "Failed to refit video", details: error.message });
    }
  });

  // Regenerate video with new clip sequence
  app.post("/api/projects/:projectId/videos/:videoId/regenerate", async (req, res) => {
    const { projectId, videoId } = req.params;
    try {
      const { clipSequence } = req.body;

      console.log(`[regenerate] Request for video ${videoId} with ${clipSequence.length} clips`);

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const video = await storage.getVideoById(videoId);
      if (!video) {
        return res.status(404).json({ error: "Video not found" });
      }

      const allSlices = await storage.getSlicesByProject(projectId);

      // Handle AI-generated videos differently (use AI video paths instead of source)
      if (project.projectType === 'ai-video') {
        console.log(`[regenerate] AI video project - using AI-generated clips`);
        const clipPaths: string[] = [];

        for (const sliceId of clipSequence) {
          const slice = allSlices.find(s => s.id === sliceId);
          if (slice?.aiVideoPath) {
            clipPaths.push(VideoProcessor.getFullPath(slice.aiVideoPath));
          }
        }

        if (clipPaths.length === 0) {
          return res.status(400).json({ error: "No AI video clips found for regeneration" });
        }

        const outputId = nanoid();
        const outputPath = path.join(VIDEOS_DIR, `regenerated-ai-${outputId}.mp4`);

        await VideoProcessor.concatenateClips(clipPaths, outputPath);
        const publicPath = VideoProcessor.getPublicPath(outputPath);

        await storage.updateVideo(videoId, {
          videoPath: publicPath,
          clipSequence,
          status: "ready",
        });

        console.log(`[regenerate] AI video regenerated: ${publicPath}`);
        return res.json({ videoPath: publicPath });
      }

      // Standard video regeneration
      const sourceVideoPath = VideoProcessor.getFullPath(project.sourceVideoPath || "");

      if (!fs.existsSync(sourceVideoPath)) {
        console.error(`[regenerate] Source video not found: ${sourceVideoPath}`);
        return res.status(404).json({ error: "Source video not found" });
      }

      // Update video status to indicate regeneration is in progress
      await storage.updateVideo(videoId, { status: "processing" });

      const newVideoPath = await VideoProcessor.regenerateVideoFromClips(
        sourceVideoPath,
        allSlices,
        clipSequence,
        video.type as "short" | "standard" | "comprehensive",
        "9:16" // Default to vertical reel format
      );

      const newDuration = await new Promise<number>((resolve, reject) => {
        ffmpeg.ffprobe(newVideoPath, (err: any, metadata: any) => {
          if (err) return reject(err);
          resolve(Math.floor(metadata.format.duration));
        });
      });

      await storage.updateVideo(videoId, {
        videoPath: newVideoPath,
        duration: newDuration,
        clipSequence,
        status: "ready",
      });

      // V6.3: Record regeneration for learning (user was not satisfied with previous version)
      try {
        const { FeedbackLearningService } = await import("./services/feedback-learning");
        await FeedbackLearningService.recordRegeneration(
          projectId,
          videoId,
          project.videoCategory || null,
          video.clipSequence as string[] || [],
          undefined // No feedback text from this path
        );
      } catch (feedbackErr: any) {
        console.warn("[regenerate] Feedback recording failed:", feedbackErr.message);
      }

      res.json({ videoPath: VideoProcessor.getPublicPath(newVideoPath), duration: newDuration });
    } catch (error: any) {
      console.error("[regenerate] Error regenerating video:", error);
      await storage.updateVideo(videoId, { status: "error" }); // Mark as error
      res.status(500).json({ error: "Failed to regenerate video", details: error.message });
    }
  });

  // Transcribe video audio using OpenAI Whisper with SMART ENHANCEMENTS
  app.post("/api/projects/:projectId/transcribe", aiLimiter, async (req, res) => {
    try {
      const { projectId } = req.params;
      const project = await storage.getProject(projectId);

      if (!project || !project.sourceVideoPath) {
        res.status(404).json({ error: "Project or video not found" });
        return;
      }

      const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        console.error("[transcribe] OpenAI API key not configured");
        res.status(500).json({ error: "OpenAI API key not configured in secrets" });
        return;
      }

      console.log("[transcribe] Starting SMART transcription for project:", projectId);

      // Extract audio from video
      const audioPath = await VideoProcessor.extractAudioForTranscription(project.sourceVideoPath);

      // Send to OpenAI Whisper API
      const FormData = (await import('form-data')).default;
      const formData = new FormData();
      formData.append('file', fs.createReadStream(audioPath));
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'verbose_json'); // Get word-level timestamps
      formData.append('timestamp_granularities', 'word'); // Enable word timestamps

      const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          ...formData.getHeaders(),
        },
        body: formData as any,
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("[transcribe] Whisper API error:", errorData);
        throw new Error(errorData.error?.message || "Transcription failed");
      }

      const transcription = await response.json();

      // Clean up audio file
      fs.unlinkSync(audioPath);

      // SMART SUBTITLE PROCESSING
      const rawSegments = transcription.segments || [];
      const words = transcription.words || [];

      // 1. SPLIT AT NATURAL PAUSES (detect silence > 0.5s between words)
      const smartSegments: Array<{ start: number; end: number; text: string; keywords?: string[] }> = [];
      let currentSegment: { start: number; end: number; words: string[] } | null = null;
      const PAUSE_THRESHOLD = 0.5; // 500ms pause = new segment
      const MAX_WORDS_PER_SEGMENT = 8; // Max words for readability

      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const nextWord = words[i + 1];
        const pause = nextWord ? nextWord.start - word.end : 0;

        if (!currentSegment) {
          currentSegment = { start: word.start, end: word.end, words: [word.word] };
        } else {
          currentSegment.words.push(word.word);
          currentSegment.end = word.end;
        }

        // Split conditions: natural pause OR max words reached
        if (pause > PAUSE_THRESHOLD || currentSegment.words.length >= MAX_WORDS_PER_SEGMENT || !nextWord) {
          smartSegments.push({
            start: currentSegment.start,
            end: currentSegment.end,
            text: currentSegment.words.join(' ').trim(),
          });
          currentSegment = null;
        }
      }

      // Fallback if word-level timestamps unavailable
      if (smartSegments.length === 0) {
        rawSegments.forEach((seg: any) => {
          smartSegments.push({
            start: seg.start,
            end: seg.end,
            text: seg.text.trim(),
          });
        });
      }

      // 2. KEYWORD DETECTION (for future highlighting)
      const fullText = transcription.text || "";
      const keywords = AIAnalyzer.detectKeywords(fullText);

      // Attach keywords to relevant segments
      smartSegments.forEach(seg => {
        seg.keywords = keywords.filter(kw => seg.text.toLowerCase().includes(kw.toLowerCase()));
      });

      console.log(`[transcribe] Generated ${smartSegments.length} SMART subtitle segments with ${keywords.length} keywords`);
      res.json({
        segments: smartSegments,
        fullText,
        keywords,
        analytics: {
          totalSegments: smartSegments.length,
          avgWordsPerSegment: (smartSegments.reduce((sum, seg) => sum + seg.text.split(' ').length, 0) / smartSegments.length).toFixed(1),
          detectedKeywords: keywords.length,
        }
      });
    } catch (error: any) {
      console.error("[transcribe] Error:", error);
      res.status(500).json({
        error: "Failed to transcribe audio",
        details: error.message,
      });
    }
  });

  // Generate script from caption using OpenAI
  app.post("/api/scripts/generate", aiLimiter, async (req, res) => {
    try {
      const { caption } = req.body;
      console.log("[scripts/generate] Received caption:", caption);

      if (!caption || typeof caption !== "string") {
        res.status(400).json({ error: "Caption is required" });
        return;
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        console.error("[scripts/generate] OpenAI API key not configured");
        res.status(500).json({ error: "OpenAI API key not configured in secrets" });
        return;
      }

      console.log("[scripts/generate] Calling OpenAI API...");
      // Call OpenAI API
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content:
                "You are a professional script writer for viral social media content. Create engaging, concise scripts optimized for short-form video content (TikTok, Instagram Reels, YouTube Shorts). Include scene directions, narration, and pacing suggestions.",
            },
            {
              role: "user",
              content: `Create a professional video script based on this caption or topic: "${caption}"`,
            },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("[scripts/generate] OpenAI API error:", errorData);
        throw new Error(errorData.error?.message || "OpenAI API request failed");
      }

      const data = await response.json();
      const script = data.choices[0]?.message?.content || "";
      console.log("[scripts/generate] Generated script length:", script.length);

      res.json({ script });
    } catch (error: any) {
      console.error("[scripts/generate] Error:", error);
      res.status(500).json({
        error: "Failed to generate script",
        details: error.message,
      });
    }
  });

  // Mix multi-track audio for video
  app.post("/api/projects/:projectId/videos/:videoId/mix-audio", async (req, res) => {
    try {
      const { projectId, videoId } = req.params;
      const { tracks } = req.body;

      if (!Array.isArray(tracks) || tracks.length === 0) {
        res.status(400).json({ error: "At least one audio track is required" });
        return;
      }

      console.log(`[audio-mix] Mixing ${tracks.length} tracks for video ${videoId}`);

      const video = await storage.getVideoById(videoId);
      if (!video || !video.videoPath) {
        res.status(404).json({ error: "Video not found" });
        return;
      }

      const videoPath = VideoProcessor.getFullPath(video.videoPath);

      // Extract audio track paths with full AudioTrack properties (use 'url' field as mixer expects)
      const audioTracks = tracks.map((t: any, index: number) => ({
        id: t.id || `track-${index}`,
        type: t.type,
        url: path.join(process.cwd(), t.url.replace(/^\//, '')),
        volume: t.volume || 100,
        startTime: t.startTime || 0,
        duration: t.duration,
        fadeIn: t.fadeIn,
        fadeOut: t.fadeOut,
      }));

      // Create temporary output path (mixer will create final video with mixed audio)
      const outputPath = path.join(process.cwd(), "uploads", "videos", `audio-mixed-${nanoid()}.mp4`);

      // Use AudioMixer service (correct parameter order: videoPath, tracks, ducking, masterVolume, outputPath)
      await AudioMixer.mixAudioTracks(
        videoPath,
        audioTracks,
        { enabled: false, threshold: -24, ratio: 50, attack: 0.1, release: 0.5 },
        100,
        outputPath
      );

      res.json({
        success: true,
        mixedAudioUrl: VideoProcessor.getPublicPath(outputPath),
      });
    } catch (error: any) {
      console.error("[audio-mix] Error:", error);
      res.status(500).json({
        error: "Failed to mix audio tracks",
        details: error.message,
      });
    }
  });

  // Apply video finalization (subtitles, overlays, branding)
  app.post("/api/projects/:projectId/videos/:videoId/finalize", finalizationLimiter, upload.single('musicFile'), async (req, res) => {
    try {
      const { projectId, videoId } = req.params;

      // Parse config from form data if music file is present
      const configData = req.file ? JSON.parse(req.body.config) : req.body;
      const config = finalizationConfigSchema.parse(configData);

      const musicFile = req.file;
      const musicVolume = configData.musicVolume ? parseInt(configData.musicVolume) : 60;
      const enableBeatSync = configData.enableBeatSync === 'true' || configData.enableBeatSync === true;
      const enableAutoDuck = configData.enableAutoDuck === 'true' || configData.enableAutoDuck === true;

      console.log(`[finalize] Processing video ${videoId} with config:`, JSON.stringify(config));

      const video = await storage.getVideoById(videoId);
      if (!video || !video.videoPath) {
        res.status(404).json({ error: "Video not found" });
        return;
      }

      let currentVideoPath = VideoProcessor.getFullPath(video.videoPath);
      let transitionOutputPath: string | null = null;
      let motionEffectPath: string | null = null;
      let audioPolishPath: string | null = null;

      // Get project to check outputMode
      const project = await storage.getProject(projectId);
      const intentConfig = project?.intentConfig as { outputMode?: string } | null;
      const outputMode = intentConfig?.outputMode || "polished_reels";

      // PHASE 1.5: Apply audio mixing if tracks provided
      if (config.audio?.tracks && config.audio.tracks.length > 0) {
        const audioMixedPath = path.join(process.cwd(), "uploads", "videos", `audio-mixed-${nanoid()}.mp4`);

        console.log(`[finalize] 🎵 Mixing ${config.audio.tracks.length} audio tracks`);

        // Convert relative URLs to absolute paths
        const audioTracksWithPaths = config.audio.tracks.map((track: any) => ({
          ...track,
          url: track.url.startsWith('/') 
            ? path.join(process.cwd(), track.url.replace(/^\//, ''))
            : track.url
        }));

        await AudioMixer.mixAudioTracks(
          currentVideoPath,
          audioTracksWithPaths,
          config.audio.ducking || { enabled: false, threshold: -24, ratio: 50, attack: 0.1, release: 0.5 },
          config.audio.masterVolume || 100,
          audioMixedPath
        );

        // Cleanup previous temp file
        if (currentVideoPath !== VideoProcessor.getFullPath(video.videoPath) && transitionOutputPath !== currentVideoPath) {
          if (fs.existsSync(currentVideoPath)) fs.unlinkSync(currentVideoPath);
        }

        currentVideoPath = audioMixedPath;
        console.log(`[finalize] ✅ Audio mixing complete: ${audioMixedPath}`);
      } else {
        console.log(`[finalize] No background music to add`);
      }

      // PHASE 2: Apply subtitles, overlays, and branding
      if (
        config.subtitles?.enabled ||
        config.overlays?.length > 0 ||
        config.branding?.watermark
      ) {
        const visualOutputPath = path.join(process.cwd(), "uploads", "videos", `visual-${nanoid()}.mp4`);

        console.log(`[finalize] 📝 Applying visual effects (subtitles, overlays, branding)`);

        await VideoProcessor.applyVisualEffects(
          currentVideoPath,
          config.subtitles || { enabled: false },
          config.overlays || [],
          config.branding || {},
          visualOutputPath
        );

        // Cleanup previous temp file
        if (currentVideoPath !== VideoProcessor.getFullPath(video.videoPath) && transitionOutputPath !== currentVideoPath && !currentVideoPath.includes('audio-mixed')) {
          if (fs.existsSync(currentVideoPath)) fs.unlinkSync(currentVideoPath);
        }

        currentVideoPath = visualOutputPath;
        console.log(`[finalize] Visual effects applied: ${visualOutputPath}`);
      }

      // PHASE 3: Apply music mixing (if music file provided)
      let finalPath = currentVideoPath;
      if (musicFile) {
        console.log(`[finalize] Mixing background music: ${musicFile.originalname}`);
        const musicPath = musicFile.path;
        const musicMixedPath = path.join(VIDEOS_DIR, `music-mixed-${nanoid()}.mp4`);

        // Prepare audio track config
        const musicTrack = {
          id: nanoid(),
          type: 'background' as const,
          url: musicPath,
          volume: musicVolume,
          startTime: 0,
          fadeIn: 0.5,
          fadeOut: 1.0,
        };

        // Auto-ducking config
        const duckingConfig = {
          enabled: enableAutoDuck,
          threshold: -24,
          ratio: 50, // Reduce background music by 50% during speech
          attack: 0.1,
          release: 0.5,
        };

        try {
          // Mix music into video
          await AudioMixer.mixAudioTracks(
            currentVideoPath,
            [musicTrack],
            duckingConfig,
            100, // Master volume
            musicMixedPath
          );

          // Cleanup temp music file
          try { fs.unlinkSync(musicPath); } catch (e) {}

          finalPath = musicMixedPath;
          currentVideoPath = musicMixedPath;
          console.log(`[finalize] ✓ Music mixed with ${enableAutoDuck ? 'auto-ducking' : 'fixed volume'}`);
        } catch (musicError: any) {
          console.warn(`[finalize] Music mixing failed, continuing without music:`, musicError.message);
        }
      }


      // PHASE 4: Apply subtitles, overlays, branding
      const outputPath = path.join(process.cwd(), "uploads", "videos", `finalized-${nanoid()}.mp4`);

      // Build FFmpeg filter complex for overlays
      const filterParts: string[] = [];
      let subtitleCleanup: (() => void) | null = null;

      // Apply subtitles if configured
      if (config.subtitles?.enabled && config.subtitles?.segments) {
        console.log(`[finalize] Applying ${config.subtitles.segments.length} subtitle segments`);

        // Get video dimensions for dynamic font sizing
        const { height: videoHeight } = await VideoProcessor.getVideoMetadata(currentVideoPath);
        console.log(`[finalize] Video height: ${videoHeight}px - calculating optimal subtitle size`);

        const { srtPath, assStyle, cleanup } = VideoProcessor.writeSubtitlesFile(
          config.subtitles.segments,
          {
            fontSize: config.subtitles.fontSize || 48,
            fontColor: config.subtitles.fontColor || '#FFFFFF',
            backgroundColor: config.subtitles.backgroundColor || '#000000',
            backgroundOpacity: config.subtitles.backgroundOpacity || 85,
            position: config.subtitles.position || 'bottom',
            videoHeight, // NEW: Pass video height for dynamic sizing
            preset: config.subtitles.preset || 'tiktok',
            outlineWidth: config.subtitles.outlineWidth || 4,
            shadowStrength: config.subtitles.shadowStrength || 2,
            enableKinetics: config.subtitles.enableKinetics !== false,
            kineticIntensity: config.subtitles.kineticIntensity || 'normal',
          }
        );
        subtitleCleanup = cleanup;
        // Escape path for Windows compatibility
        const escapedPath = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:');
        filterParts.push(
          `subtitles='${escapedPath}':force_style='${assStyle}'`
        );
      }

      // Add text overlay (single overlay supported) - skip in raw_slices mode
      if (config.textOverlay && outputMode !== "raw_slices") {
        const overlay = config.textOverlay;
        // Strict server-side validation for security
        if (overlay.text && typeof overlay.text === 'string' && overlay.text.length <= 200) {
          // Validate and sanitize font color
          const colorWithoutHash = overlay.fontColor.replace(/^#/, '');
          if (/^[0-9A-Fa-f]{6}$/.test(colorWithoutHash)) {
            // Use 0x prefix for FFmpeg (also accepts # but 0x is safer)
            const sanitizedColor = `0x${colorWithoutHash}`;

            // Escape text for FFmpeg (comprehensive sanitization)
            const escapedText = overlay.text
              .replace(/\\/g, '\\\\')   // Backslash
              .replace(/'/g, "\\'")     // Single quote
              .replace(/:/g, '\\:')     // Colon
              .replace(/\n/g, '\\n')    // Newline
              .replace(/\r/g, '')       // Remove carriage return
              .replace(/=/g, '\\=')     // Equals
              .replace(/,/g, '\\,');    // Comma

            const yPos = overlay.position === "top" ? 50 : overlay.position === "center" ? "(h-text_h)/2" : "h-text_h-50";
            filterParts.push(
              `drawtext=text='${escapedText}':fontsize=${overlay.fontSize}:fontcolor=${sanitizedColor}:x=(w-text_w)/2:y=${yPos}:enable='between(t\\,${overlay.timestamp}\\,${overlay.timestamp + overlay.duration})'`
            );
          }
        }
      }

      // Add watermark - skip in raw_slices mode
      if (config.watermark?.enabled && config.watermark.watermarkText && outputMode !== "raw_slices") {
        // Validate watermark text length
        if (config.watermark.watermarkText.length > 100) {
          console.warn(`[finalize] Watermark text too long, skipping`);
        } else {
          // Escape watermark text for FFmpeg (comprehensive)
          const escapedWatermark = config.watermark.watermarkText
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/:/g, '\\:')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '')
            .replace(/=/g, '\\=')
            .replace(/,/g, '\\,');

          const positions: Record<string, { x: string; y: string }> = {
            "top-left": { x: "10", y: "10" },
            "top-right": { x: "w-text_w-10", y: "10" },
            "bottom-left": { x: "10", y: "h-text_h-10" },
            "bottom-right": { x: "w-text_w-10", y: "h-text_h-10" },
          };
          const pos = positions[config.watermark.logoPosition] || positions["bottom-right"];
          const alpha = (config.watermark.logoOpacity / 100).toFixed(2);
          filterParts.push(
            `drawtext=text='${escapedWatermark}':fontsize=16:fontcolor=white@${alpha}:x=${pos.x}:y=${pos.y}`
          );
        }
      }

      const videoFilter = filterParts.join(",");
      console.log(`[finalize] Video filter:`, videoFilter);

      // Apply filters using FFmpeg
      try {
        await new Promise<void>((resolve, reject) => {
          const command = ffmpeg(currentVideoPath)
            .output(outputPath)
            .videoCodec("libx264")
            .audioCodec("aac")
            .outputOptions(["-preset", "veryfast", "-crf", "20"]);

          if (videoFilter) {
            command.videoFilters(videoFilter);
          }

          command
            .on("end", () => {
              console.log(`[finalize] Video finalized successfully`);
              resolve();
            })
            .on("error", (err) => {
              console.error(`[finalize] Error:`, err.message);
              reject(err);
            })
            .run();
        });
      } finally {
        // Cleanup temp files
        if (transitionOutputPath && fs.existsSync(transitionOutputPath)) {
          fs.unlinkSync(transitionOutputPath);
        }
        // Cleanup audio-mixed temp file
        if (currentVideoPath && currentVideoPath.includes('audio-mixed') && fs.existsSync(currentVideoPath)) {
          fs.unlinkSync(currentVideoPath);
        }
        // Cleanup visual effect temp file
        if (currentVideoPath && currentVideoPath.includes('visual-') && fs.existsSync(currentVideoPath)) {
          fs.unlinkSync(currentVideoPath);
        }
        // Cleanup motion effect temp file
        if (motionEffectPath && fs.existsSync(motionEffectPath)) {
          fs.unlinkSync(motionEffectPath);
        }
        // Cleanup audio polish temp file
        if (audioPolishPath && fs.existsSync(audioPolishPath)) {
          fs.unlinkSync(audioPolishPath);
        }
        // Always cleanup subtitle file
        if (subtitleCleanup) {
          subtitleCleanup();
        }
      }

      // Update video record
      await storage.updateVideo(videoId, {
        videoPath: VideoProcessor.getPublicPath(outputPath),
      });

      // V6.3: Record acceptance for learning (user finalized = user is happy)
      try {
        const { FeedbackLearningService } = await import("./services/feedback-learning");
        const feedbackProject = await storage.getProject(projectId);
        await FeedbackLearningService.recordAcceptance(
          projectId,
          videoId,
          feedbackProject?.videoCategory || null,
          video.clipSequence as string[] || [],
          video.duration || 0,
          0 // regenerationCount - could track this per video in future
        );
      } catch (feedbackErr: any) {
        console.warn("[finalize] Feedback recording failed:", feedbackErr.message);
      }

      res.json({
        success: true,
        downloadUrl: VideoProcessor.getPublicPath(outputPath),
      });
    } catch (error: any) {
      console.error("[finalize] Error:", error);
      res.status(500).json({
        error: "Failed to finalize video",
        details: error.message,
      });
    }
  });

  // Story Remix - Generate new narrative from existing video
  app.post("/api/projects/:projectId/remix-story", async (req, res) => {
    try {
      const { projectId } = req.params;
      const { storyStyle, preserveOrder, targetDuration } = req.body;

      const project = await storage.getProject(projectId);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const slices = await storage.getSlicesByProject(projectId);
      if (slices.length === 0) {
        res.status(400).json({ error: "No video clips found for remixing" });
        return;
      }

      console.log(`[remix-story] Generating ${storyStyle} story from ${slices.length} clips`);

      const { remixStory } = await import('./services/story-remixer');
      const story = await remixStory(slices, {
        storyStyle: storyStyle || 'dramatic',
        preserveOrder: preserveOrder !== false,
        targetDuration,
      });

      res.json({ success: true, story });
    } catch (error: any) {
      console.error("[remix-story] Error:", error);
      res.status(500).json({
        error: "Failed to remix story",
        details: error.message,
      });
    }
  });

  // Generate multiple story variations
  app.post("/api/projects/:projectId/remix-variations", async (req, res) => {
    try {
      const { projectId } = req.params;
      const { count } = req.body;

      const project = await storage.getProject(projectId);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const slices = await storage.getSlicesByProject(projectId);
      if (slices.length === 0) {
        res.status(400).json({ error: "No video clips found for remixing" });
        return;
      }

      console.log(`[remix-variations] Generating ${count || 3} story variations`);

      const { generateStoryVariations } = await import('./services/story-remixer');
      const stories = await generateStoryVariations(slices, count || 3);

      res.json({ success: true, stories });
    } catch (error: any) {
      console.error("[remix-variations] Error:", error);
      res.status(500).json({
        error: "Failed to generate story variations",
        details: error.message,
      });
    }
  });

  // Refine existing script - V3.0: Now uses PromptRefiner for consistency
  app.post("/api/scripts/refine", async (req, res) => {
    try {
      const { script, instruction } = req.body;
      console.log("[scripts/refine] Refining script (length:", script?.length, ") with instruction:", instruction);

      if (!script || typeof script !== "string") {
        res.status(400).json({ error: "Script is required" });
        return;
      }

      // Check API key availability before attempting refinement
      const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        console.error("[scripts/refine] OpenAI API key not configured");
        res.status(500).json({
          error: "OpenAI API key not configured",
          message: "AI refinement requires an OpenAI API key in environment variables"
        });
        return;
      }

      // V3.0: Use PromptRefiner.refinePromptWithFeedback() with explicit error handling
      const feedback = instruction || "Improve and refine this script to make it more engaging and viral-ready";

      console.log("[scripts/refine] 🤖 Using PromptRefiner (GPT-4o) to refine script...");

      // V3.0 FIX: Use throwOnError to surface OpenAI failures as 500 instead of silent fallback
      const refinedScript = await PromptRefiner.refinePromptWithFeedback(
        script,
        feedback,
        { throwOnError: true } // Throw explicit errors on API failures
      );

      console.log("[scripts/refine] ✅ Refined script length:", refinedScript.length);

      res.json({ script: refinedScript });
    } catch (error: any) {
      console.error("[scripts/refine] Error:", error);
      res.status(500).json({
        error: "Failed to refine script",
        details: error.message,
      });
    }
  });

  // Export all videos as ZIP file
  app.post("/api/projects/:id/export-all", async (req, res) => {
    const { id } = req.params;
    const { format = "mp4", quality = "high" } = req.body;

    const project = await storage.getProject(id);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const videos = await storage.getVideosByProject(id);
    if (!videos || videos.length === 0) {
      return res.status(404).json({ error: "No videos found" });
    }

    const tempFiles: string[] = [];

    try {
      // Create ZIP file with all videos
      const archiver = require("archiver");
      const zipId = nanoid();
      const zipPath = path.join(process.cwd(), "uploads", "videos", `export-${zipId}.zip`);
      const output = fs.createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });

      archive.pipe(output);

      // Convert each video to requested format/quality and add to ZIP
      for (const video of videos) {
        if (video.videoPath) {
          const fullPath = VideoProcessor.getFullPath(video.videoPath);
          const exportedPath = await VideoProcessor.exportWithFormatAndQuality(
            fullPath,
            format,
            quality
          );
          tempFiles.push(exportedPath);
          const fileExtension = format === "mov" ? "mov" : format === "webm" ? "webm" : "mp4";
          const fileName = `${video.type}-${video.id}.${fileExtension}`;
          archive.file(exportedPath, { name: fileName });
        }
      }

      await new Promise((resolve, reject) => {
        output.on('close', resolve);
        output.on('error', reject);
        archive.finalize();
      });

      // Clean up temp exported files after ZIP is created
      for (const tempFile of tempFiles) {
        try {
          fs.unlinkSync(tempFile);
          console.log(`[export-all] Cleaned up temp file: ${tempFile}`);
        } catch (err) {
          console.warn(`[export-all] Failed to delete temp file ${tempFile}:`, err);
        }
      }

      res.json({
        zipPath: `/processing/videos/export-${zipId}.zip`,
      });
    } catch (error) {
      console.error("Error exporting all videos:", error);

      // Clean up temp files on error
      for (const tempFile of tempFiles) {
        try {
          fs.unlinkSync(tempFile);
        } catch (err) {
          // Ignore cleanup errors
        }
      }

      res.status(500).json({ error: "Failed to export videos" });
    }
  });

  // Save project endpoint (requires paid subscription)
  app.post("/api/projects/:id/save", async (req, res) => {
    const { id } = req.params;
    const { title, userId } = req.body;

    // TODO: Check user subscription tier
    // For now, we'll allow saves but this is where you'd check:
    // if (userSubscription.tier === 'FREE_TRIAL') {
    //   return res.status(403).json({
    //     error: "Saving projects requires a paid subscription. Upgrade to save your work!"
    //   });
    // }

    try {
      if (!title || title.trim().length === 0) {
        return res.status(400).json({ error: "Project title is required" });
      }

      // Update project title - other fields can be saved via other endpoints
      const updatedProject = await storage.updateProject(id, { name: title });

      if (!updatedProject) {
        return res.status(404).json({ error: "Project not found" });
      }

      console.log(`[save] Project ${id} saved with title "${title}"`);
      res.json({ success: true, project: updatedProject });

    } catch (error: any) {
      console.error("[save] Error saving project:", error);
      res.status(500).json({ error: "Failed to save project", details: error.message });
    }
  });

  // ============================================
  // V6.3: Feedback Learning System Endpoints
  // ============================================

  // Record that a video was accepted/exported (triggers learning)
  app.post("/api/feedback/accepted", async (req, res) => {
    try {
      const { projectId, generatedVideoId, videoCategory, clipSequence, duration, regenerationCount } = req.body;

      if (!projectId || !generatedVideoId) {
        return res.status(400).json({ error: "Missing projectId or generatedVideoId" });
      }

      const { FeedbackLearningService } = await import("./services/feedback-learning");

      await FeedbackLearningService.recordAcceptance(
        projectId,
        generatedVideoId,
        videoCategory || null,
        clipSequence || [],
        duration || 0,
        regenerationCount || 0
      );

      res.json({ success: true, message: "Acceptance recorded for learning" });
    } catch (error: any) {
      console.error("[Feedback] Error recording acceptance:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Record that a video was regenerated (negative signal)
  app.post("/api/feedback/regenerated", async (req, res) => {
    try {
      const { projectId, generatedVideoId, videoCategory, clipSequence, feedbackText } = req.body;

      if (!projectId || !generatedVideoId) {
        return res.status(400).json({ error: "Missing projectId or generatedVideoId" });
      }

      const { FeedbackLearningService } = await import("./services/feedback-learning");

      await FeedbackLearningService.recordRegeneration(
        projectId,
        generatedVideoId,
        videoCategory || null,
        clipSequence || [],
        feedbackText
      );

      res.json({ success: true, message: "Regeneration recorded for learning" });
    } catch (error: any) {
      console.error("[Feedback] Error recording regeneration:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Record explicit rating (1-5 stars)
  app.post("/api/feedback/rate", async (req, res) => {
    try {
      const { projectId, generatedVideoId, rating, videoCategory, feedbackText } = req.body;

      if (!projectId || !generatedVideoId || !rating) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Rating must be 1-5" });
      }

      const { FeedbackLearningService } = await import("./services/feedback-learning");

      await FeedbackLearningService.recordRating(
        projectId,
        generatedVideoId,
        rating,
        videoCategory || null,
        feedbackText
      );

      res.json({ success: true, message: "Rating recorded for learning" });
    } catch (error: any) {
      console.error("[Feedback] Error recording rating:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get learning metrics for dashboard
  app.get("/api/feedback/metrics", async (req, res) => {
    try {
      const { FeedbackLearningService } = await import("./services/feedback-learning");
      const metrics = await FeedbackLearningService.getMetrics();
      res.json(metrics);
    } catch (error: any) {
      console.error("[Feedback] Error getting metrics:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get learned weights for a specific category
  app.get("/api/feedback/weights/:category", async (req, res) => {
    try {
      const { category } = req.params;
      const { FeedbackLearningService } = await import("./services/feedback-learning");
      const weights = await FeedbackLearningService.getWeights(category);
      res.json({ category, weights });
    } catch (error: any) {
      console.error("[Feedback] Error getting weights:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Force recompute weights for a category
  app.post("/api/feedback/recompute/:category", async (req, res) => {
    try {
      const { category } = req.params;
      const { FeedbackLearningService } = await import("./services/feedback-learning");
      await FeedbackLearningService.recomputeWeights(category);
      const weights = await FeedbackLearningService.getWeights(category);
      res.json({ success: true, category, weights });
    } catch (error: any) {
      console.error("[Feedback] Error recomputing weights:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Export all feedback data for analysis
  app.get("/api/feedback/export", async (req, res) => {
    try {
      const { FeedbackLearningService } = await import("./services/feedback-learning");
      const data = await FeedbackLearningService.exportFeedbackData();
      res.json(data);
    } catch (error: any) {
      console.error("[Feedback] Error exporting data:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // BRAND REFERENCE LIBRARY API
  // ═══════════════════════════════════════════════════════════════

  // Get all brand references
  app.get("/api/brand-references", async (req, res) => {
    try {
      const { BRAND_REFERENCE_LIBRARY, getAllCategories } = await import("./data/brand-reference-library");
      res.json({
        references: BRAND_REFERENCE_LIBRARY,
        categories: getAllCategories()
      });
    } catch (error: any) {
      console.error("[BrandReferences] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get references by category
  app.get("/api/brand-references/category/:category", async (req, res) => {
    try {
      const { category } = req.params;
      const { getReferencesByCategory } = await import("./data/brand-reference-library");
      const references = getReferencesByCategory(category);
      res.json({ category, references });
    } catch (error: any) {
      console.error("[BrandReferences] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get single reference by ID
  app.get("/api/brand-references/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { getReferenceById, extractEditingParams } = await import("./data/brand-reference-library");
      const reference = getReferenceById(id);

      if (!reference) {
        return res.status(404).json({ error: "Reference not found" });
      }

      res.json({
        reference,
        editingParams: extractEditingParams(reference)
      });
    } catch (error: any) {
      console.error("[BrandReferences] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Apply brand reference style to a project
  app.post("/api/projects/:projectId/apply-brand-style", async (req, res) => {
    try {
      const { projectId } = req.params;
      const { referenceId, regenerate = false } = req.body;

      const { getReferenceById, extractEditingParams } = await import("./data/brand-reference-library");
      const reference = getReferenceById(referenceId);

      if (!reference) {
        return res.status(404).json({ error: "Brand reference not found" });
      }

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const editingParams = extractEditingParams(reference);

      // Update project with brand style configuration
      const currentConfig = (project.intentConfig as any) || {};
      const brandStyleConfig = {
        brandReference: referenceId,
        brandName: reference.brand,
        appliedBrandStyle: {
          brand: reference.brand,
          category: reference.category,
          pacing: editingParams.pacing,
          colorGrade: editingParams.colorGrade,
          transitionStyle: editingParams.transitionStyle,
          hookDuration: editingParams.hookDuration,
          cutTempo: reference.editingStyle.cutTempo,
          energyCurve: reference.editingStyle.energyCurve,
          signatureElements: reference.signatureElements
        }
      };

      await storage.updateProject(projectId, {
        intentConfig: {
          ...currentConfig,
          ...brandStyleConfig
        }
      });

      // Also update any existing videos with the new applied style
      const videos = await storage.getVideosByProject(projectId);
      for (const video of videos) {
        await storage.updateGeneratedVideo(video.id, {
          appliedStyle: brandStyleConfig.appliedBrandStyle,
          appliedMood: editingParams.colorGrade
        });
      }

      console.log(`[BrandReferences] Applied ${reference.brand} style to project ${projectId}`);
      console.log(`[BrandReferences] Updated ${videos.length} videos with brand style`);
      console.log(`[BrandReferences] Style params:`, editingParams);

      res.json({
        success: true,
        appliedStyle: {
          brand: reference.brand,
          category: reference.category,
          editingParams,
          videosUpdated: videos.length
        },
        message: `Applied ${reference.brand} editing style. ${videos.length > 0 ? 'Re-export to see changes.' : ''}`
      });
    } catch (error: any) {
      console.error("[BrandReferences] Error applying style:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Add multi-video compilation endpoint
  app.post("/api/projects/compile-multi-video", async (req, res) => {
    try {
      const { clipSequence } = req.body as {
        clipSequence: Array<{ projectId: string; sliceId: string }>;
      };

      console.log(`[compile-multi-video] Compiling ${clipSequence.length} clips from multiple videos`);

      // Extract all clips from their source videos
      const tempClipPaths: string[] = [];

      for (const { projectId, sliceId } of clipSequence) {
        const project = await storage.getProject(projectId);
        if (!project?.sourceVideoPath) {
          throw new Error(`Project ${projectId} not found or missing source video`);
        }

        const slice = await storage.getSliceById(sliceId);
        if (!slice) {
          throw new Error(`Slice ${sliceId} not found`);
        }

        console.log(`[compile-multi-video] Extracting clip from ${project.name}: ${slice.startTime}s - ${slice.endTime}s`);
        const clipPath = await VideoProcessor.extractClip(
          project.sourceVideoPath,
          slice.startTime,
          slice.endTime
        );
        tempClipPaths.push(clipPath);
      }

      // Concatenate all clips into one video
      const compilationId = nanoid();
      const compilationPath = path.join(process.cwd(), "uploads", "videos", `compilation-${compilationId}.mp4`);

      await VideoProcessor.concatenateClips(tempClipPaths, compilationPath);

      // Clean up temp clips
      for (const tempPath of tempClipPaths) {
        try {
          fs.unlinkSync(tempPath);
        } catch (err) {
          console.warn(`Failed to delete temp clip: ${tempPath}`);
        }
      }

      const publicPath = VideoProcessor.getPublicPath(compilationPath);
      console.log(`[compile-multi-video] Compilation complete: ${publicPath}`);

      res.json({
        videoPath: publicPath,
        clipCount: clipSequence.length,
      });
    } catch (error: any) {
      console.error("[compile-multi-video] Error:", error);
      res.status(500).json({ error: error.message || "Failed to compile videos" });
    }
  });

  // Export all videos as ZIP
  app.post("/api/projects/:id/export-all", async (req, res) => {
    const { id } = req.params;
    const { format = "mp4", quality = "high" } = req.body;

    const project = await storage.getProject(id);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const videos = await storage.getVideosByProject(id);
    if (!videos || videos.length === 0) {
      return res.status(404).json({ error: "No videos found" });
    }

    const tempFiles: string[] = [];

    try {
      // Create ZIP file with all videos
      const archiver = require("archiver");
      const zipId = nanoid();
      const zipPath = path.join(process.cwd(), "uploads", "videos", `export-${zipId}.zip`);
      const output = fs.createWriteStream(zipPath);
      const archive = archiver("zip",{ zlib: { level: 9 } });

      archive.pipe(output);

      // Convert each video to requested format/quality and add to ZIP
      for (const video of videos) {
        if (video.videoPath) {
          const fullPath = VideoProcessor.getFullPath(video.videoPath);
          const exportedPath = await VideoProcessor.exportWithFormatAndQuality(
            fullPath,
            format,
            quality
          );
          tempFiles.push(exportedPath);
          const fileExtension = format === "mov" ? "mov" : format === "webm" ? "webm" : "mp4";
          const fileName = `${video.type}-${video.id}.${fileExtension}`;
          archive.file(exportedPath, { name: fileName });
        }
      }

      await new Promise((resolve, reject) => {
        output.on('close', resolve);
        output.on('error', reject);
        archive.finalize();
      });

      // Clean up temp exported files after ZIP is created
      for (const tempFile of tempFiles) {
        try {
          fs.unlinkSync(tempFile);
          console.log(`[export-all] Cleaned up temp file: ${tempFile}`);
        } catch (err) {
          console.warn(`[export-all] Failed to delete temp file ${tempFile}:`, err);
        }
      }

      res.json({
        zipPath: `/processing/videos/export-${zipId}.zip`,
      });
    } catch (error) {
      console.error("Error exporting all videos:", error);

      // Clean up temp files on error
      for (const tempFile of tempFiles) {
        try {
          fs.unlinkSync(tempFile);
        } catch (err) {
          // Ignore cleanup errors
        }
      }

      res.status(500).json({ error: "Failed to export videos" });
    }
  });

  // Save project endpoint (requires paid subscription)
  app.post("/api/projects/:id/save", async (req, res) => {
    const { id } = req.params;
    const { title, userId } = req.body;

    // TODO: Check user subscription tier
    // For now, we'll allow saves but this is where you'd check:
    // if (userSubscription.tier === 'FREE_TRIAL') {
    //   return res.status(403).json({
    //     error: "Saving projects requires a paid subscription. Upgrade to save your work!"
    //   });
    // }

    try {
      if (!title || title.trim().length === 0) {
        return res.status(400).json({ error: "Project title is required" });
      }

      // Update project title - other fields can be saved via other endpoints
      const updatedProject = await storage.updateProject(id, { name: title });

      if (!updatedProject) {
        return res.status(404).json({ error: "Project not found" });
      }

      console.log(`[save] Project ${id} saved with title "${title}"`);
      res.json({ success: true, project: updatedProject });

    } catch (error: any) {
      console.error("[save] Error saving project:", error);
      res.status(500).json({ error: "Failed to save project", details: error.message });
    }
  });

  // ============================================
  // V6.3: Feedback Learning System Endpoints
  // ============================================

  // Record that a video was accepted/exported (triggers learning)
  app.post("/api/feedback/accepted", async (req, res) => {
    try {
      const { projectId, generatedVideoId, videoCategory, clipSequence, duration, regenerationCount } = req.body;

      if (!projectId || !generatedVideoId) {
        return res.status(400).json({ error: "Missing projectId or generatedVideoId" });
      }

      const { FeedbackLearningService } = await import("./services/feedback-learning");

      await FeedbackLearningService.recordAcceptance(
        projectId,
        generatedVideoId,
        videoCategory || null,
        clipSequence || [],
        duration || 0,
        regenerationCount || 0
      );

      res.json({ success: true, message: "Acceptance recorded for learning" });
    } catch (error: any) {
      console.error("[Feedback] Error recording acceptance:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Record that a video was regenerated (negative signal)
  app.post("/api/feedback/regenerated", async (req, res) => {
    try {
      const { projectId, generatedVideoId, videoCategory, clipSequence, feedbackText } = req.body;

      if (!projectId || !generatedVideoId) {
        return res.status(400).json({ error: "Missing projectId or generatedVideoId" });
      }

      const { FeedbackLearningService } = await import("./services/feedback-learning");

      await FeedbackLearningService.recordRegeneration(
        projectId,
        generatedVideoId,
        videoCategory || null,
        clipSequence || [],
        feedbackText
      );

      res.json({ success: true, message: "Regeneration recorded for learning" });
    } catch (error: any) {
      console.error("[Feedback] Error recording regeneration:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Record explicit rating (1-5 stars)
  app.post("/api/feedback/rate", async (req, res) => {
    try {
      const { projectId, generatedVideoId, rating, videoCategory, feedbackText } = req.body;

      if (!projectId || !generatedVideoId || !rating) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Rating must be 1-5" });
      }

      const { FeedbackLearningService } = await import("./services/feedback-learning");

      await FeedbackLearningService.recordRating(
        projectId,
        generatedVideoId,
        rating,
        videoCategory || null,
        feedbackText
      );

      res.json({ success: true, message: "Rating recorded for learning" });
    } catch (error: any) {
      console.error("[Feedback] Error recording rating:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get learning metrics for dashboard
  app.get("/api/feedback/metrics", async (req, res) => {
    try {
      const { FeedbackLearningService } = await import("./services/feedback-learning");
      const metrics = await FeedbackLearningService.getMetrics();
      res.json(metrics);
    } catch (error: any) {
      console.error("[Feedback] Error getting metrics:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get learned weights for a specific category
  app.get("/api/feedback/weights/:category", async (req, res) => {
    try {
      const { category } = req.params;
      const { FeedbackLearningService } = await import("./services/feedback-learning");
      const weights = await FeedbackLearningService.getWeights(category);
      res.json({ category, weights });
    } catch (error: any) {
      console.error("[Feedback] Error getting weights:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Force recompute weights for a category
  app.post("/api/feedback/recompute/:category", async (req, res) => {
    try {
      const { category } = req.params;
      const { FeedbackLearningService } = await import("./services/feedback-learning");
      await FeedbackLearningService.recomputeWeights(category);
      const weights = await FeedbackLearningService.getWeights(category);
      res.json({ success: true, category, weights });
    } catch (error: any) {
      console.error("[Feedback] Error recomputing weights:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Export all feedback data for analysis
  app.get("/api/feedback/export", async (req, res) => {
    try {
      const { FeedbackLearningService } = await import("./services/feedback-learning");
      const data = await FeedbackLearningService.exportFeedbackData();
      res.json(data);
    } catch (error: any) {
      console.error("[Feedback] Error exporting data:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // BRAND REFERENCE LIBRARY API
  // ═══════════════════════════════════════════════════════════════

  // Get all brand references
  app.get("/api/brand-references", async (req, res) => {
    try {
      const { BRAND_REFERENCE_LIBRARY, getAllCategories } = await import("./data/brand-reference-library");
      res.json({
        references: BRAND_REFERENCE_LIBRARY,
        categories: getAllCategories()
      });
    } catch (error: any) {
      console.error("[BrandReferences] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get references by category
  app.get("/api/brand-references/category/:category", async (req, res) => {
    try {
      const { category } = req.params;
      const { getReferencesByCategory } = await import("./data/brand-reference-library");
      const references = getReferencesByCategory(category);
      res.json({ category, references });
    } catch (error: any) {
      console.error("[BrandReferences] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get single reference by ID
  app.get("/api/brand-references/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { getReferenceById, extractEditingParams } = await import("./data/brand-reference-library");
      const reference = getReferenceById(id);

      if (!reference) {
        return res.status(404).json({ error: "Reference not found" });
      }

      res.json({
        reference,
        editingParams: extractEditingParams(reference)
      });
    } catch (error: any) {
      console.error("[BrandReferences] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Apply brand reference style to a project
  app.post("/api/projects/:projectId/apply-brand-style", async (req, res) => {
    try {
      const { projectId } = req.params;
      const { referenceId, regenerate = false } = req.body;

      const { getReferenceById, extractEditingParams } = await import("./data/brand-reference-library");
      const reference = getReferenceById(referenceId);

      if (!reference) {
        return res.status(404).json({ error: "Brand reference not found" });
      }

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const editingParams = extractEditingParams(reference);

      // Update project with brand style configuration
      const currentConfig = (project.intentConfig as any) || {};
      const brandStyleConfig = {
        brandReference: referenceId,
        brandName: reference.brand,
        appliedBrandStyle: {
          brand: reference.brand,
          category: reference.category,
          pacing: editingParams.pacing,
          colorGrade: editingParams.colorGrade,
          transitionStyle: editingParams.transitionStyle,
          hookDuration: editingParams.hookDuration,
          cutTempo: reference.editingStyle.cutTempo,
          energyCurve: reference.editingStyle.energyCurve,
          signatureElements: reference.signatureElements
        }
      };

      await storage.updateProject(projectId, {
        intentConfig: {
          ...currentConfig,
          ...brandStyleConfig
        }
      });

      // Also update any existing videos with the new applied style
      const videos = await storage.getVideosByProject(projectId);
      for (const video of videos) {
        await storage.updateGeneratedVideo(video.id, {
          appliedStyle: brandStyleConfig.appliedBrandStyle,
          appliedMood: editingParams.colorGrade
        });
      }

      console.log(`[BrandReferences] Applied ${reference.brand} style to project ${projectId}`);
      console.log(`[BrandReferences] Updated ${videos.length} videos with brand style`);
      console.log(`[BrandReferences] Style params:`, editingParams);

      res.json({
        success: true,
        appliedStyle: {
          brand: reference.brand,
          category: reference.category,
          editingParams,
          videosUpdated: videos.length
        },
        message: `Applied ${reference.brand} editing style. ${videos.length > 0 ? 'Re-export to see changes.' : ''}`
      });
    } catch (error: any) {
      console.error("[BrandReferences] Error applying style:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Add multi-video compilation endpoint
  app.post("/api/projects/compile-multi-video", async (req, res) => {
    try {
      const { clipSequence } = req.body as {
        clipSequence: Array<{ projectId: string; sliceId: string }>;
      };

      console.log(`[compile-multi-video] Compiling ${clipSequence.length} clips from multiple videos`);

      // Extract all clips from their source videos
      const tempClipPaths: string[] = [];

      for (const { projectId, sliceId } of clipSequence) {
        const project = await storage.getProject(projectId);
        if (!project?.sourceVideoPath) {
          throw new Error(`Project ${projectId} not found or missing source video`);
        }

        const slice = await storage.getSliceById(sliceId);
        if (!slice) {
          throw new Error(`Slice ${sliceId} not found`);
        }

        console.log(`[compile-multi-video] Extracting clip from ${project.name}: ${slice.startTime}s - ${slice.endTime}s`);
        const clipPath = await VideoProcessor.extractClip(
          project.sourceVideoPath,
          slice.startTime,
          slice.endTime
        );
        tempClipPaths.push(clipPath);
      }

      // Concatenate all clips into one video
      const compilationId = nanoid();
      const compilationPath = path.join(process.cwd(), "uploads", "videos", `compilation-${compilationId}.mp4`);

      await VideoProcessor.concatenateClips(tempClipPaths, compilationPath);

      // Clean up temp clips
      for (const tempPath of tempClipPaths) {
        try {
          fs.unlinkSync(tempPath);
        } catch (err) {
          console.warn(`Failed to delete temp clip: ${tempPath}`);
        }
      }

      const publicPath = VideoProcessor.getPublicPath(compilationPath);
      console.log(`[compile-multi-video] Compilation complete: ${publicPath}`);

      res.json({
        videoPath: publicPath,
        clipCount: clipSequence.length,
      });
    } catch (error: any) {
      console.error("[compile-multi-video] Error:", error);
      res.status(500).json({ error: error.message || "Failed to compile videos" });
    }
  });

  // Compilation routes
  app.use("/api/projects/compilation", compilationRoutes);

  // Content Studio routes
  app.use("/api/content-studio", contentStudioRoutes);

  // Catch-all 404 handler for API routes
  app.use("/api/*", (_req, res) => {
    res.status(404).json({ error: "API endpoint not found" });
  });

  // Note: In development, Vite middleware handles frontend routing
  // In production, the build process handles static file serving

  const httpServer = createServer(app);
  return httpServer;
}