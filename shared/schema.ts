import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, jsonb, timestamp, boolean, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Upload Session schema - tracks resumable uploads (persisted for server restart survival)
// Note: totalSize and uploadedSize use bigint to support files >2GB (up to 9 petabytes)
export const uploadSessions = pgTable("upload_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().unique(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type"),
  totalSize: bigint("total_size", { mode: "number" }).notNull(),
  uploadedSize: bigint("uploaded_size", { mode: "number" }).notNull().default(0),
  totalChunks: integer("total_chunks").notNull(),
  completedChunksArray: jsonb("completed_chunks_array").notNull().default([]), // Array of chunk indices that are done
  status: text("status").notNull().default("pending"), // pending, uploading, complete, error
  uploadDir: text("upload_dir").notNull(), // Directory to store chunks
  batchId: varchar("batch_id"), // For batch uploads
  processingConfig: jsonb("processing_config"), // { operation, quality, targetFormat }
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(), // Auto-cleanup old uploads
});

// Project schema - represents a video editing project OR carousel project
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  projectType: text("project_type").notNull().default("video"), // "video", "carousel", "ai-video", or "compilation"
  sourceVideoUrl: text("source_video_url"), // Required for video projects
  sourceVideoPath: text("source_video_path"),
  thumbnailPath: text("thumbnail_path"), // Video thumbnail for previews
  scriptContent: text("script_content"), // Required for carousel projects
  status: text("status").notNull().default("pending"), // pending, analyzing, scheduled, ready, error
  duration: integer("duration"), // in seconds
  userIntent: text("user_intent"), // "single-video", "multiple-clips", "comprehensive", "ai-decide", "carousel"
  intentConfig: jsonb("intent_config"), // { targetDuration: 60, clipCount: 5, clipDuration: 15 }
  videoCategory: text("video_category"), // Intelligent category detection: music_video, talking_head, marketing, movie_scene, tutorial, product_demo, vlog, news, sports, documentary, etc.
  batchId: varchar("batch_id"), // Groups multiple uploads processed together
  batchIndex: integer("batch_index"), // Order within batch (0-based)
  // V6.0: Series & Character Consistency
  seriesId: varchar("series_id"), // Links episodes in a multi-episode series
  episodeNumber: integer("episode_number"), // Episode number within series
  characterData: jsonb("character_data"), // Character definitions for this episode
  // V7.0: Multi-source compilation projects
  isCompilation: boolean("is_compilation").default(false), // True for projects with multiple source videos
  createdAt: timestamp("created_at").defaultNow(),
});

// V7.0: Project Sources - tracks multiple source videos for compilation projects
export const projectSources = pgTable("project_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(), // The compilation project this source belongs to
  sourceProjectId: varchar("source_project_id"), // Original project ID if copied from existing project
  sourceVideoPath: text("source_video_path").notNull(), // Path to the video file
  originalFileName: text("original_file_name"), // Original file name for display
  duration: integer("duration"), // Duration in seconds
  order: integer("order").notNull().default(0), // Order in the source list
  thumbnailPath: text("thumbnail_path"), // Thumbnail for UI display
  createdAt: timestamp("created_at").defaultNow(),
});

// Smart Slice schema - individual analyzed clips OR carousel slides
// Flexible schema works for both video clips and script-generated scenes
export const smartSlices = pgTable("smart_slices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  sourceId: varchar("source_id"), // V7.0: For compilation projects - links to projectSources.id
  order: integer("order").notNull().default(0), // Sequence order
  startTime: real("start_time").notNull().default(0), // in seconds (for video) or duration (for carousel) - supports fractional seconds
  endTime: real("end_time").notNull().default(3), // in seconds - supports fractional seconds
  transcription: text("transcription"), // For video: speech transcript. For carousel: voiceover text
  textContent: text("text_content"), // For carousel: displayed text
  engagementScore: integer("engagement_score"), // 0-100
  thumbnailPath: text("thumbnail_path"), // For video: frame. For carousel: background image
  clipType: text("clip_type"), // speech, broll, action (video) OR scene, title, conclusion (carousel)
  // V5.0: AI Video Generation fields
  cinematicPrompt: text("cinematic_prompt"), // AI-generated prompt for video generation (e.g., "Desert landscape at sunset, dramatic cliffs")
  aiVideoUrl: text("ai_video_url"), // URL of AI-generated video from Runway/Pika/Luma
  aiVideoPath: text("ai_video_path"), // Local path to downloaded AI video
  aiGenerationStatus: text("ai_generation_status"), // pending, generating, ready, failed
});

// Generated Video schema - the three output versions
export const generatedVideos = pgTable("generated_videos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  type: text("type").notNull(), // short, standard, comprehensive
  duration: integer("duration").notNull(),
  videoPath: text("video_path"),
  clipSequence: jsonb("clip_sequence").notNull(), // array of slice IDs in order
  clipLabels: jsonb("clip_labels"), // array of {id, label, actualDuration} for each clip - shows semantic type (intro, verse 1, verse 2, chorus, etc.)
  appliedMood: text("applied_mood"), // vibrant, corporate, cinematic
  appliedStyle: jsonb("applied_style"), // reference style data
  status: text("status").notNull().default("pending"), // pending, rendering, ready
  previousVideoPath: text("previous_video_path"), // For revert - stores previous video path before improvements
  previousClipSequence: jsonb("previous_clip_sequence"), // For revert - stores previous clip sequence
  previousDuration: integer("previous_duration"), // For revert - stores previous duration
});

// Reference Video schema - for style mimicry
export const referenceVideos = pgTable("reference_videos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  url: text("url").notNull(),
  videoPath: text("video_path"),
  analyzedStyle: jsonb("analyzed_style"), // extracted style parameters
  cutTempo: real("cut_tempo"), // average seconds per cut (can be decimal like 2.5)
  colorProfile: text("color_profile"),
  transitionTypes: jsonb("transition_types"),
  visualStyle: text("visual_style"), // Visual style description
  pacingPattern: text("pacing_pattern"), // Pacing pattern description
});

// V6.3: Editing Feedback - stores user feedback on generated videos for learning
export const editingFeedback = pgTable("editing_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  generatedVideoId: varchar("generated_video_id").notNull(),
  videoCategory: text("video_category"), // music_video, talking_head, podcast, etc.
  userIntent: text("user_intent"), // single-video, multiple-clips, etc.
  targetDuration: integer("target_duration"), // What duration was requested
  actualDuration: integer("actual_duration"), // What was delivered
  overallRating: integer("overall_rating"), // 1-5 stars
  action: text("action").notNull(), // "accepted", "regenerated", "reverted", "abandoned"
  feedbackText: text("feedback_text"), // Free-form user feedback
  regenerationCount: integer("regeneration_count").default(0), // How many times user regenerated
  timeToAccept: integer("time_to_accept"), // Seconds from creation to acceptance
  clipSequence: jsonb("clip_sequence"), // The clip IDs used in this video
  createdAt: timestamp("created_at").defaultNow(),
});

// V6.3: Clip Feedback - per-clip ratings for granular learning
export const clipFeedback = pgTable("clip_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  editingFeedbackId: varchar("editing_feedback_id").notNull(), // Links to parent feedback
  sliceId: varchar("slice_id").notNull(), // The smart slice being rated
  clipType: text("clip_type"), // intro, verse, chorus, talking_head, etc.
  position: text("position"), // "hook", "middle", "closer" - where in video
  action: text("action").notNull(), // "kept", "removed", "boosted", "penalized", "moved"
  rating: integer("rating"), // 1-5 or null
  engagementScore: integer("engagement_score"), // Original score from AI
  clipDuration: real("clip_duration"), // How long was this clip
  createdAt: timestamp("created_at").defaultNow(),
});

// V6.3: Learned Weights - adaptive preferences by category
export const learnedWeights = pgTable("learned_weights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  videoCategory: text("video_category").notNull(), // music_video, talking_head, etc.
  clipType: text("clip_type"), // intro, verse, chorus, or null for category-wide
  weightType: text("weight_type").notNull(), // "engagement_boost", "duration_preference", "hook_priority"
  weightValue: real("weight_value").notNull().default(1.0), // Multiplier (1.0 = neutral)
  sampleCount: integer("sample_count").notNull().default(0), // How many feedback samples
  successRate: real("success_rate"), // % of clips with this type that were "kept"
  avgRating: real("avg_rating"), // Average user rating for this type
  avgDuration: real("avg_duration"), // Preferred duration for this clip type
  lastUpdated: timestamp("last_updated").defaultNow(),
});

// Insert schemas
export const insertUploadSessionSchema = createInsertSchema(uploadSessions).omit({
  id: true,
  createdAt: true,
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
});

export const insertProjectSourceSchema = createInsertSchema(projectSources).omit({
  id: true,
  createdAt: true,
});

export const insertSmartSliceSchema = createInsertSchema(smartSlices).omit({
  id: true,
});

export const insertGeneratedVideoSchema = createInsertSchema(generatedVideos).omit({
  id: true,
});

export const insertReferenceVideoSchema = createInsertSchema(referenceVideos).omit({
  id: true,
});

export const insertEditingFeedbackSchema = createInsertSchema(editingFeedback).omit({
  id: true,
  createdAt: true,
});

export const insertClipFeedbackSchema = createInsertSchema(clipFeedback).omit({
  id: true,
  createdAt: true,
});

export const insertLearnedWeightsSchema = createInsertSchema(learnedWeights).omit({
  id: true,
  lastUpdated: true,
});

// Types
export type InsertUploadSession = z.infer<typeof insertUploadSessionSchema>;
export type UploadSession = typeof uploadSessions.$inferSelect;

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

export type InsertProjectSource = z.infer<typeof insertProjectSourceSchema>;
export type ProjectSource = typeof projectSources.$inferSelect;

export type InsertSmartSlice = z.infer<typeof insertSmartSliceSchema>;
export type SmartSlice = typeof smartSlices.$inferSelect;

export type InsertGeneratedVideo = z.infer<typeof insertGeneratedVideoSchema>;
export type GeneratedVideo = typeof generatedVideos.$inferSelect;

export type InsertReferenceVideo = z.infer<typeof insertReferenceVideoSchema>;
export type ReferenceVideo = typeof referenceVideos.$inferSelect;

export type InsertEditingFeedback = z.infer<typeof insertEditingFeedbackSchema>;
export type EditingFeedback = typeof editingFeedback.$inferSelect;

export type InsertClipFeedback = z.infer<typeof insertClipFeedbackSchema>;
export type ClipFeedback = typeof clipFeedback.$inferSelect;

export type InsertLearnedWeights = z.infer<typeof insertLearnedWeightsSchema>;
export type LearnedWeights = typeof learnedWeights.$inferSelect;

// API response types
export type VideoAnalysisProgress = {
  stage: "pending" | "downloading" | "analyzing" | "slicing" | "generating" | "complete" | "error";
  progress: number; // 0-100
  message: string;
};

// Renamed from TriptychVideos - we no longer always create 3 videos
export type VideoResults = {
  short: (GeneratedVideo & { slices: SmartSlice[] }) | null;
  standard: (GeneratedVideo & { slices: SmartSlice[] }) | null;
  comprehensive: (GeneratedVideo & { slices: SmartSlice[] }) | null;
  multipleClips?: Array<GeneratedVideo & { slices: SmartSlice[] }>; // For multiple-clips intent
};

// Legacy export for backwards compatibility during transition
export type TriptychVideos = VideoResults;

// User intent types
export type UserIntent =
  | "single-video"      // One polished video
  | "multiple-clips"    // Multiple short clips
  | "comprehensive"     // Longer comprehensive edit
  | "ai-decide"         // Let AI decide
  | "clean-slices"      // V6.5: Export clean, usable slices without editing (like Canva)
  | "custom";           // Custom configuration

// V6.0: Video context for purpose-driven clip selection
export type VideoContext =
  | "tutorial"          // Educational content - prioritize clear explanations
  | "hype"              // High-energy promotional content - prioritize exciting moments
  | "demo"              // Product/feature showcases - prioritize demonstrations
  | "vlog"              // Personal vlogs - balanced pacing with personality
  | "review"            // Review/analysis content - structured, informative
  | "interview"         // Interview/conversation - dialogue-focused
  | "storytelling"      // Narrative storytelling - dramatic arc
  | "generic";          // No specific context - engagement-based only

// V6.5: Output mode - Raw slices (fast, no effects) vs Polished reels (full editing)
export type OutputMode = "raw_slices" | "polished_reels";

export type IntentConfig = {
  targetDuration?: number;  // Target duration in seconds for single video
  clipCount?: number;       // Number of clips for multiple-clips intent
  clipDuration?: number;    // Duration per clip for multiple-clips intent
  aspectRatio?: "9:16" | "1:1" | "16:9"; // Aspect ratio for the generated video
  vibe?: string;            // Color grading preset (vibrant, cinematic, etc.)
  videoContext?: VideoContext; // V6.0: Purpose-driven context for smarter clip selection
  enableBeatSync?: boolean; // Align cuts to musical beats for rhythm (default: true)
  outputMode?: OutputMode;  // V6.5: Raw slices (fast) vs Polished reels (full editing)
  referenceVideoId?: string; // V6.0: Reference video for style mimicry
  isOneClick?: boolean;     // V7.0: One-click best edit mode - prioritize speed
};

// Video Finalization schemas (subtitles, overlays, branding)

// Enum for transition types
export type TransitionType =
  | "fade"
  | "fadeblack"
  | "fadewhite"
  | "dissolve"
  | "wipeleft"
  | "wiperight"
  | "wipeup"
  | "wipedown"
  | "slideleft"
  | "slideright"
  | "slideup"
  | "slidedown"
  | "circlecrop"
  | "circleopen"
  | "circleclose"
  | "smoothleft"
  | "smoothright"
  | "smoothup"
  | "smoothdown";

// Schema for individual subtitle segments
export const subtitleSegmentSchema = z.object({
  start: z.number().min(0),
  end: z.number().min(0),
  text: z.string().min(1).max(500),
  keywords: z.array(z.string()).optional(), // For future keyword highlighting
});

// Caption style presets - popular creator styles
export const captionPresets = [
  "tiktok",        // Bold, high contrast for TikTok
  "instagram",     // Clean, modern for Reels
  "youtube",       // Classic YouTube style
  "professional",  // Minimal, clean for business
  "mr-beast",      // Giant impact font, color flashes
  "alex-hormozi",  // Uppercase, yellow/red highlights
  "karaoke",       // Word-by-word highlight animation
  "minimal",       // Subtle, understated
  "bold-impact",   // Maximum readability, huge text
  "neon-glow",     // Glowing neon effect
  "custom",        // User-defined settings
] as const;

export type CaptionPreset = typeof captionPresets[number];

// Schema for subtitle configuration
export const subtitleConfigSchema = z.object({
  enabled: z.boolean().default(false),
  position: z.enum(["top", "center", "bottom"]).default("bottom"),
  fontSize: z.number().min(12).max(72).default(32),
  fontColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#FFFFFF"),
  backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#000000"),
  backgroundOpacity: z.number().min(0).max(100).default(50),
  segments: z.array(subtitleSegmentSchema).optional(),
  // V2 QUALITY ENHANCEMENTS - Enhanced caption presets
  preset: z.enum(captionPresets).default("tiktok"),
  outlineWidth: z.number().min(0).max(10).default(2),
  shadowStrength: z.number().min(0).max(5).default(1),
  enableKinetics: z.boolean().default(true), // Enable word zoom/bounce animations
  kineticIntensity: z.enum(["subtle", "normal", "extreme"]).default("normal"),
  kineticType: z.enum(["bounce", "scale", "wave", "pop", "spring", "karaoke"]).default("bounce").optional(), // Animation style
  autoTrimFillers: z.boolean().default(false).optional(), // Remove filler words
});

// Schema for text overlay configuration
export const textOverlaySchema = z.object({
  text: z.string().min(1).max(200),
  timestamp: z.number().min(0),
  duration: z.number().min(0.5).max(60),
  position: z.enum(["top", "center", "bottom", "top-left", "top-right", "bottom-left", "bottom-right"]),
  fontSize: z.number().min(12).max(120),
  fontColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  fontFamily: z.enum(["Arial", "Helvetica", "Times New Roman", "Courier New", "Verdana", "Impact", "Comic Sans MS"]),
  backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  backgroundOpacity: z.number().min(0).max(1),
  animationStyle: z.enum(["none", "fade-in", "slide-in", "typewriter", "bounce"]),
  borderWidth: z.number().min(0).max(10),
  borderColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  shadowEnabled: z.boolean(),
  shadowColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  shadowBlur: z.number().min(0).max(20),
  startTime: z.number().min(0),
});

// Schema for branding configuration - Enhanced with full customization
export const brandingConfigSchema = z.object({
  enabled: z.boolean(),
  // Logo/image watermark
  logoPosition: z.enum(["top-left", "top-right", "bottom-left", "bottom-right", "center"]),
  logoOpacity: z.number().min(0).max(100),
  logoScale: z.number().min(10).max(50).default(20), // % of video width
  // Text watermark
  watermarkText: z.string().max(100).optional(),
  watermarkPosition: z.enum(["top-left", "top-right", "bottom-left", "bottom-right", "center"]).optional(),
  watermarkFontSize: z.number().min(12).max(72).default(24),
  watermarkFontColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#FFFFFF"),
  watermarkOpacity: z.number().min(0).max(100).default(50),
  watermarkFont: z.enum(["Arial", "Helvetica", "Impact", "Times New Roman", "Verdana"]).default("Arial"),
});

// Schema for audio configuration - Auto-leveling and enhancement
export const audioConfigSchema = z.object({
  normalizeAudio: z.boolean().default(true), // Auto-normalize loudness
  targetLoudness: z.number().min(-24).max(-6).default(-14), // LUFS target (-14 is YouTube standard)
  compressAudio: z.boolean().default(false), // Dynamic range compression
  removeBackground: z.boolean().default(false), // Basic noise reduction
  boostVocals: z.boolean().default(false), // Enhance speech clarity
});

// Schema for transition configuration
export const transitionConfigSchema = z.object({
  enabled: z.boolean(),
  type: z.enum([
    "fade",
    "fadeblack",
    "fadewhite",
    "dissolve",
    "wipeleft",
    "wiperight",
    "wipeup",
    "wipedown",
    "slideleft",
    "slideright",
    "slideup",
    "slidedown",
    "circlecrop",
    "circleopen",
    "circleclose",
    "smoothleft",
    "smoothright",
    "smoothup",
    "smoothdown",
  ]),
  duration: z.number().min(0.1).max(3).default(0.5),
  applyBetweenClips: z.boolean().default(true),
});

// Schema for audio track configuration
export interface AudioTrack {
  id: string;
  type: "background" | "voiceover" | "sfx";
  url?: string;
  file?: File;
  volume: number; // 0-100
  startTime: number; // seconds
  duration?: number; // seconds, optional for trimming
  fadeIn?: number; // seconds
  fadeOut?: number; // seconds
}

// Schema for audio ducking configuration
export interface AudioDuckingConfig {
  enabled: boolean;
  threshold: number; // dB level to trigger ducking
  ratio: number; // 0-100, percentage to reduce background volume
  attack: number; // seconds
  release: number; // seconds
}

// Audio tracks schema for custom audio mixing
export const audioTracksSchema = z.object({
  tracks: z.array(z.object({
    id: z.string(),
    type: z.enum(["background", "voiceover", "sfx"]),
    url: z.string().optional(),
    volume: z.number().min(0).max(100),
    startTime: z.number().min(0),
    duration: z.number().min(0).optional(),
    fadeIn: z.number().min(0).optional(),
    fadeOut: z.number().min(0).optional(),
  })).default([]),
  ducking: z.object({
    enabled: z.boolean(),
    threshold: z.number(), // dB level to trigger ducking
    ratio: z.number().min(0).max(100), // 0-100, percentage to reduce background volume
    attack: z.number().min(0), // seconds
    release: z.number().min(0), // seconds
  }).optional(),
  masterVolume: z.number().min(0).max(100).default(100),
});

// Schema for music configuration
export const musicConfigSchema = z.object({
  musicUrl: z.string(),
  volume: z.number().min(0).max(100).default(60),
  enableBeatSync: z.boolean().default(false),
  enableAutoDuck: z.boolean().default(true),
});

// Schema for the overall finalization configuration - matches component expectations
export const finalizationConfigSchema = z.object({
  subtitles: subtitleConfigSchema.partial().optional(),
  textOverlays: z.array(textOverlaySchema).optional(),
  transitions: transitionConfigSchema.partial().optional(),
  branding: brandingConfigSchema.partial().optional(),
  audio: audioTracksSchema.partial().optional(),
  musicConfig: musicConfigSchema.optional(),
});

// Type for the finalization configuration based on the schema
export type FinalizationConfig = z.infer<typeof finalizationConfigSchema>;