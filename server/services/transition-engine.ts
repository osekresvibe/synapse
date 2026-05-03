import { execSync, exec, spawnSync } from "child_process";
import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";
// Import ffmpeg command builder for more control over complex filters
import ffmpeg from 'fluent-ffmpeg';

// Configure ffmpeg path if not in system PATH
// ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');

// Available transition types
type TransitionType = "cut" | "fade" | "dissolve" | "zoom" | "whiteflash" | "wipe_left" | "wipe_right" | "wipe_up" | "wipe_down" | "slide_left" | "slide_right" | "slide_up" | "slide_down";

export interface TransitionConfig {
  type: TransitionType;
  duration: number; // in seconds (default 0.5s)
  offset?: number; // overlap offset (default 0s)
  jlCut?: "j-cut" | "l-cut" | "none"; // J-cut: audio leads video, L-cut: audio lags
  jlOffset?: number; // Audio offset in seconds for J/L cuts
}

export interface BeatInfo {
  timestamp: number;
  strength: number;
}

export interface SceneChange {
  timestamp: number;
  score: number;
}

export interface SmartTransitionOptions {
  enableBeatSync?: boolean;
  enableSceneAware?: boolean;
  enableJLCuts?: boolean;
  preferredJLType?: "j-cut" | "l-cut" | "auto";
  jlOffset?: number; // Default 0.3s
}

export class TransitionEngine {
  private static readonly DEFAULT_DURATION = 0.8;
  private static readonly DEFAULT_OFFSET = 0;

  /**
   * Apply transition between two video clips
   */
  static async applyTransition(
    clip1Path: string,
    clip2Path: string,
    outputPath: string,
    config: TransitionConfig
  ): Promise<void> {
    const duration = config.duration || this.DEFAULT_DURATION;
    const offset = config.offset || this.DEFAULT_OFFSET;
    const transitionDuration = config.duration || 0.5; // Default for specific transitions

    console.log(`[TransitionEngine] Applying ${config.type} transition (${duration}s) between clips`);

    // Get durations of both clips
    const duration1 = this.getVideoDuration(clip1Path);
    const duration2 = this.getVideoDuration(clip2Path);

    // Calculate transition offset (when transition starts in clip1)
    const transitionOffset = Math.max(0, duration1 - duration + offset);

    let filterComplex: string;

    // FFmpeg xfade filter for various transitions
    switch (config.type) {
      case "dissolve":
      case "fade":
        filterComplex = `[0:v][1:v]xfade=transition=dissolve:duration=${duration}:offset=${transitionOffset}[v];[0:a][1:a]acrossfade=d=${duration}[a]`;
        break;
      case "fadeblack":
        filterComplex = `[0:v][1:v]xfade=transition=fadeblack:duration=${duration}:offset=${transitionOffset}[v];[0:a][1:a]acrossfade=d=${duration}[a]`;
        break;
      case "fadewhite":
        filterComplex = `[0:v][1:v]xfade=transition=fadewhite:duration=${duration}:offset=${transitionOffset}[v];[0:a][1:a]acrossfade=d=${duration}[a]`;
        break;
      case "wipeleft":
        filterComplex = `[0:v][1:v]xfade=transition=wipeleft:duration=${duration}:offset=${transitionOffset}[v];[0:a][1:a]acrossfade=d=${duration}[a]`;
        break;
      case "wiperight":
        filterComplex = `[0:v][1:v]xfade=transition=wiperight:duration=${duration}:offset=${transitionOffset}[v];[0:a][1:a]acrossfade=d=${duration}[a]`;
        break;
      case "wipeup":
        filterComplex = `[0:v][1:v]xfade=transition=wipeup:duration=${duration}:offset=${transitionOffset}[v];[0:a][1:a]acrossfade=d=${duration}[a]`;
        break;
      case "wipedown":
        filterComplex = `[0:v][1:v]xfade=transition=wipedown:duration=${duration}:offset=${transitionOffset}[v];[0:a][1:a]acrossfade=d=${duration}[a]`;
        break;
      case "slideleft":
        filterComplex = `[0:v][1:v]xfade=transition=slideleft:duration=${duration}:offset=${transitionOffset}[v];[0:a][1:a]acrossfade=d=${duration}[a]`;
        break;
      case "slideright":
        filterComplex = `[0:v][1:v]xfade=transition=slideright:duration=${duration}:offset=${transitionOffset}[v];[0:a][1:a]acrossfade=d=${duration}[a]`;
        break;
      case "slideup":
        filterComplex = `[0:v][1:v]xfade=transition=slideup:duration=${duration}:offset=${transitionOffset}[v];[0:a][1:a]acrossfade=d=${duration}[a]`;
        break;
      case "slidedown":
        filterComplex = `[0:v][1:v]xfade=transition=slidedown:duration=${duration}:offset=${transitionOffset}[v];[0:a][1:a]acrossfade=d=${duration}[a]`;
        break;
      case "circlecrop":
        filterComplex = `[0:v][1:v]xfade=transition=circlecrop:duration=${duration}:offset=${transitionOffset}[v];[0:a][1:a]acrossfade=d=${duration}[a]`;
        break;
      case "circleopen":
        filterComplex = `[0:v][1:v]xfade=transition=circleopen:duration=${duration}:offset=${transitionOffset}[v];[0:a][1:a]acrossfade=d=${duration}[a]`;
        break;
      case "circleclose":
        filterComplex = `[0:v][1:v]xfade=transition=circleclose:duration=${duration}:offset=${transitionOffset}[v];[0:a][1:a]acrossfade=d=${duration}[a]`;
        break;
      case "smoothleft":
        filterComplex = `[0:v][1:v]xfade=transition=smoothleft:duration=${duration}:offset=${transitionOffset}[v];[0:a][1:a]acrossfade=d=${duration}[a]`;
        break;
      case "smoothright":
        filterComplex = `[0:v][1:v]xfade=transition=smoothright:duration=${duration}:offset=${transitionOffset}[v];[0:a][1:a]acrossfade=d=${duration}[a]`;
        break;
      case "smoothup":
        filterComplex = `[0:v][1:v]xfade=transition=smoothup:duration=${duration}:offset=${transitionOffset}[v];[0:a][1:a]acrossfade=d=${duration}[a]`;
        break;
      case "smoothdown":
        filterComplex = `[0:v][1:v]xfade=transition=smoothdown:duration=${duration}:offset=${transitionOffset}[v];[0:a][1:a]acrossfade=d=${duration}[a]`;
        break;
      case "zoom":
        filterComplex = `[0:v][1:v]xfade=transition=zoom:duration=${duration}:offset=${transitionOffset}[v];[0:a][1:a]acrossfade=d=${duration}[a]`;
        break;
      case "whiteflash":
        filterComplex = `[0:v][1:v]xfade=transition=whiteflash:duration=${duration}:offset=${transitionOffset}[v];[0:a][1:a]acrossfade=d=${duration}[a]`;
        break;

      // New wipe and slide transitions
      case "wipe_left":
        filterComplex = `[0:v][1:v]xfade=transition=wipeleft:duration=${transitionDuration}:offset=${transitionOffset}[v];[0:a][1:a]acrossfade=d=${transitionDuration}[a]`;
        break;
      case "wipe_right":
        filterComplex = `[0:v][1:v]xfade=transition=wiperight:duration=${transitionDuration}:offset=${transitionOffset}[v];[0:a][1:a]acrossfade=d=${transitionDuration}[a]`;
        break;
      case "wipe_up":
        filterComplex = `[0:v][1:v]xfade=transition=wipeup:duration=${transitionDuration}:offset=${transitionOffset}[v];[0:a][1:a]acrossfade=d=${transitionDuration}[a]`;
        break;
      case "wipe_down":
        filterComplex = `[0:v][1:v]xfade=transition=wipedown:duration=${transitionDuration}:offset=${transitionOffset}[v];[0:a][1:a]acrossfade=d=${transitionDuration}[a]`;
        break;
      case "slide_left":
        filterComplex = `[0:v][1:v]xfade=transition=slideleft:duration=${transitionDuration}:offset=${transitionOffset}[v];[0:a][1:a]acrossfade=d=${transitionDuration}[a]`;
        break;
      case "slide_right":
        filterComplex = `[0:v][1:v]xfade=transition=slideright:duration=${transitionDuration}:offset=${transitionOffset}[v];[0:a][1:a]acrossfade=d=${transitionDuration}[a]`;
        break;
      case "slide_up":
        filterComplex = `[0:v][1:v]xfade=transition=slideup:duration=${transitionDuration}:offset=${transitionOffset}[v];[0:a][1:a]acrossfade=d=${transitionDuration}[a]`;
        break;
      case "slide_down":
        filterComplex = `[0:v][1:v]xfade=transition=slidedown:duration=${transitionDuration}:offset=${transitionOffset}[v];[0:a][1:a]acrossfade=d=${transitionDuration}[a]`;
        break;

      default:
        // Fallback to dissolve for unknown types
        console.warn(`[TransitionEngine] Unknown transition type "${config.type}", falling back to dissolve.`);
        filterComplex = `[0:v][1:v]xfade=transition=dissolve:duration=${duration}:offset=${transitionOffset}[v];[0:a][1:a]acrossfade=d=${duration}[a]`;
        break;
    }

    const ffmpegArgs = [
      "-i", clip1Path,
      "-i", clip2Path,
      "-filter_complex", filterComplex,
      "-map", "[v]",
      "-map", "[a]",
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "23",
      "-c:a", "aac",
      "-b:a", "192k",
      "-movflags", "+faststart",
      "-y",
      outputPath
    ];

    try {
      const result = spawnSync("ffmpeg", ffmpegArgs, { stdio: "pipe", timeout: 120000 });
      if (result.status !== 0) {
        const stderr = result.stderr?.toString() || "";
        throw new Error(`FFmpeg failed: ${stderr.slice(-500)}`);
      }
      console.log(`[TransitionEngine] Transition applied successfully: ${outputPath}`);
    } catch (error) {
      console.error(`[TransitionEngine] Transition failed:`, error);
      throw new Error(`Failed to apply ${config.type} transition`);
    }
  }

  /**
   * Apply transitions to multiple clips in sequence
   */
  static async applyTransitionsToSequence(
    clipPaths: string[],
    outputPath: string,
    transitions: TransitionConfig[]
  ): Promise<void> {
    if (clipPaths.length < 2) {
      throw new Error("Need at least 2 clips to apply transitions");
    }

    console.log(`[TransitionEngine] Applying ${transitions.length} transitions to ${clipPaths.length} clips`);

    const tempDir = path.join(process.cwd(), "uploads", "temp-transitions");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    let currentClip = clipPaths[0];

    // Apply transitions sequentially
    for (let i = 0; i < clipPaths.length - 1; i++) {
      const nextClip = clipPaths[i + 1];
      const transition = transitions[i] || transitions[transitions.length - 1]; // Use last transition as default
      const tempOutput = path.join(tempDir, `transition-${i}.mp4`);

      await this.applyTransition(currentClip, nextClip, tempOutput, transition);

      // Clean up previous temp file (except the first original clip)
      if (i > 0 && fs.existsSync(currentClip)) {
        fs.unlinkSync(currentClip);
      }

      currentClip = tempOutput;
    }

    // Move final result to output path
    fs.renameSync(currentClip, outputPath);

    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    console.log(`[TransitionEngine] Sequence complete: ${outputPath}`);
  }

  /**
   * Get video duration in seconds
   */
  private static getVideoDuration(videoPath: string): number {
    const cmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`;
    const output = execSync(cmd, { encoding: "utf-8" });
    return parseFloat(output.trim());
  }

  /**
   * Get all available transition types
   */
  static getAvailableTransitions(): TransitionType[] {
    return [
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
      "zoom",
      "whiteflash",
      "wipe_left",
      "wipe_right",
      "wipe_up",
      "wipe_down",
      "slide_left",
      "slide_right",
      "slide_up",
      "slide_down",
    ];
  }

  /**
   * Get recommended transition based on mood/style
   */
  static getRecommendedTransition(style: string): TransitionType {
    const styleTransitions: Record<string, TransitionType> = {
      cinematic: "fade",
      energetic: "wipe_right", // Changed to one of the new wipe types
      smooth: "dissolve",
      dramatic: "fadeblack",
      modern: "slide_left", // Changed to one of the new slide types
      elegant: "smoothleft",
      playful: "circleopen",
      professional: "fade",
    };

    return styleTransitions[style.toLowerCase()] || "fade";
  }

  /**
   * V6.5: Detect audio beats in a video/audio file
   * Uses FFmpeg's astats filter to analyze audio energy
   */
  static async detectBeats(videoPath: string): Promise<BeatInfo[]> {
    console.log(`[TransitionEngine] Detecting beats in ${path.basename(videoPath)}`);

    const beats: BeatInfo[] = [];

    try {
      // Use FFmpeg to extract audio energy levels
      // We analyze audio in 0.1s windows to find sudden energy increases (beats)
      const cmd = `ffprobe -v error -f lavfi -i "amovie='${videoPath.replace(/'/g, "\\'")}',astats=metadata=1:reset=1" -show_entries frame_tags=lavfi.astats.Overall.RMS_level -of csv=p=0 2>/dev/null | head -500`;

      const output = execSync(cmd, { encoding: "utf-8", timeout: 30000 });
      const lines = output.trim().split('\n').filter(l => l.trim());

      let prevEnergy = -60;
      const windowSize = 0.1; // 100ms windows

      for (let i = 0; i < lines.length; i++) {
        const energy = parseFloat(lines[i]);
        if (!isNaN(energy)) {
          // Detect beat as sudden energy increase (>6dB jump)
          const energyJump = energy - prevEnergy;
          if (energyJump > 6 && energy > -30) {
            beats.push({
              timestamp: i * windowSize,
              strength: Math.min(1, (energyJump - 6) / 12) // Normalize to 0-1
            });
          }
          prevEnergy = energy;
        }
      }

      console.log(`[TransitionEngine] Detected ${beats.length} beats`);
      return beats;
    } catch (error) {
      console.warn(`[TransitionEngine] Beat detection failed, using fallback:`, error);
      // Fallback: return estimated beats every 0.5s based on typical music tempo
      const duration = this.getVideoDuration(videoPath);
      for (let t = 0.5; t < duration; t += 0.5) {
        beats.push({ timestamp: t, strength: 0.5 });
      }
      return beats;
    }
  }

  /**
   * V6.5: Detect scene changes in a video
   * Uses FFmpeg's scene detection filter with correct lavfi syntax
   */
  static async detectSceneChanges(videoPath: string, threshold: number = 0.3): Promise<SceneChange[]> {
    console.log(`[TransitionEngine] Detecting scene changes in ${path.basename(videoPath)}`);

    const scenes: SceneChange[] = [];

    try {
      // Use FFmpeg with select filter and print scene detection timestamps
      // This correctly captures scene change timestamps via ffmpeg stderr
      const escapedPath = videoPath.replace(/'/g, "'\\''");
      const cmd = `ffmpeg -i '${escapedPath}' -vf "select='gt(scene,${threshold})',showinfo" -f null - 2>&1 | grep "pts_time" | head -100`;

      const output = execSync(cmd, { encoding: "utf-8", timeout: 30000 });
      const lines = output.trim().split('\n').filter(l => l.includes('pts_time'));

      for (const line of lines) {
        // Parse showinfo output format: pts_time:1.234
        const match = line.match(/pts_time:(\d+\.?\d*)/);
        if (match) {
          scenes.push({
            timestamp: parseFloat(match[1]),
            score: threshold
          });
        }
      }

      console.log(`[TransitionEngine] Detected ${scenes.length} scene changes`);
      return scenes;
    } catch (error) {
      console.warn(`[TransitionEngine] Scene detection failed:`, error);
      return [];
    }
  }

  /**
   * V6.5: Find the nearest beat to a given timestamp
   */
  static findNearestBeat(beats: BeatInfo[], timestamp: number, maxOffset: number = 0.2): BeatInfo | null {
    let nearest: BeatInfo | null = null;
    let minDistance = Infinity;

    for (const beat of beats) {
      const distance = Math.abs(beat.timestamp - timestamp);
      if (distance < minDistance && distance <= maxOffset) {
        minDistance = distance;
        nearest = beat;
      }
    }

    return nearest;
  }

  /**
   * V6.5: Apply J-cut (audio from next clip starts before video transition)
   * or L-cut (audio from current clip extends into next video)
   * Fixed: Proper PTS reset and multi-channel adelay handling
   */
  static async applyJLCutTransition(
    clip1Path: string,
    clip2Path: string,
    outputPath: string,
    config: TransitionConfig
  ): Promise<void> {
    const duration = config.duration || this.DEFAULT_DURATION;
    const jlOffset = config.jlOffset || 0.3; // Default 300ms audio offset
    const jlType = config.jlCut || "none";

    if (jlType === "none") {
      // Fall back to regular transition
      return this.applyTransition(clip1Path, clip2Path, outputPath, config);
    }

    console.log(`[TransitionEngine] Applying ${jlType} with ${config.type} transition`);

    const duration1 = this.getVideoDuration(clip1Path);
    const duration2 = this.getVideoDuration(clip2Path);
    const transitionOffset = Math.max(0, duration1 - duration);

    // For J-cut: audio from next clip starts early (builds anticipation)
    // For L-cut: audio from current clip extends into next video (maintains connection)
    let filterComplex: string;

    // Calculate delay in milliseconds for all channels (stereo = 2 channels)
    const delayMs = Math.round(jlOffset * 1000);
    const transitionDelayMs = Math.round(transitionOffset * 1000);

    if (jlType === "j-cut") {
      // J-cut: Audio from next clip fades in before video transition
      // Simpler and more robust approach: crossfade audio with offset
      const audioTransitionStart = Math.max(0, transitionOffset - jlOffset);
      filterComplex =
        `[0:v][1:v]xfade=transition=${config.type}:duration=${duration}:offset=${transitionOffset}[v];` +
        `[0:a]asetpts=PTS-STARTPTS[a0];` +
        `[1:a]adelay=${transitionDelayMs}:all=1,asetpts=PTS-STARTPTS[a1delayed];` +
        `[a0][a1delayed]acrossfade=d=${jlOffset + duration}:o=1:c1=tri:c2=tri[a]`;
    } else {
      // L-cut: Audio from current clip extends past video transition
      // Keep audio from clip1 running briefly after video switches
      const fadeOutStart = transitionOffset + jlOffset;
      filterComplex =
        `[0:v][1:v]xfade=transition=${config.type}:duration=${duration}:offset=${transitionOffset}[v];` +
        `[0:a]afade=t=out:st=${fadeOutStart}:d=${duration},asetpts=PTS-STARTPTS[a0fade];` +
        `[1:a]adelay=${transitionDelayMs}:all=1,afade=t=in:st=0:d=${jlOffset},asetpts=PTS-STARTPTS[a1delayed];` +
        `[a0fade][a1delayed]amix=inputs=2:duration=longest:normalize=0,asetpts=PTS-STARTPTS[a]`;
    }

    const ffmpegArgs = [
      "-i", clip1Path,
      "-i", clip2Path,
      "-filter_complex", filterComplex,
      "-map", "[v]",
      "-map", "[a]",
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "23",
      "-c:a", "aac",
      "-b:a", "192k",
      "-movflags", "+faststart",
      "-y",
      outputPath
    ];

    try {
      const result = spawnSync("ffmpeg", ffmpegArgs, { stdio: "pipe", timeout: 60000 });
      if (result.status !== 0) {
        const stderr = result.stderr?.toString() || "";
        throw new Error(`FFmpeg failed: ${stderr.slice(-300)}`);
      }
      console.log(`[TransitionEngine] ${jlType} applied successfully: ${outputPath}`);
    } catch (error: any) {
      console.warn(`[TransitionEngine] ${jlType} failed, falling back to regular transition:`, error.message);
      // Fall back to regular transition if J/L cut fails
      await this.applyTransition(clip1Path, clip2Path, outputPath, config);
    }
  }

  /**
   * V6.5: Apply smart transitions with xfade dissolves between clips
   * Single-pass implementation - all clips processed in one FFmpeg command
   * Optimized for HEVC 10-bit footage with proper format conversion
   */
  static async applySmartTransitionsToSequence(
    clipPaths: string[],
    outputPath: string,
    baseTransition: TransitionConfig,
    options: SmartTransitionOptions = {}
  ): Promise<void> {
    if (clipPaths.length < 2) {
      throw new Error("Need at least 2 clips to apply transitions");
    }

    const transitionDuration = baseTransition.duration || 0.5;
    const transitionType = baseTransition.type || "fade";

    console.log(`[TransitionEngine] Processing ${clipPaths.length} clips with ${transitionType} transitions (${transitionDuration}s each)`);

    // Get durations for all clips upfront
    const durations: number[] = [];
    for (const clipPath of clipPaths) {
      try {
        durations.push(this.getVideoDuration(clipPath));
      } catch (e) {
        durations.push(10); // Default fallback
      }
    }

    // Check if any clip is too short for transitions - use shorter transition if needed
    const minClipDuration = Math.min(...durations);
    const effectiveTransitionDuration = Math.min(transitionDuration, minClipDuration * 0.4); // Max 40% of shortest clip

    if (effectiveTransitionDuration < 0.2) {
      console.log(`[TransitionEngine] Clips too short for xfade (min: ${minClipDuration.toFixed(2)}s), using fallback`);
      await this.fallbackSimpleConcat(clipPaths, outputPath);
      return;
    }

    // Build single-pass filter_complex with xfade chain
    // This processes all clips in one FFmpeg command - no repeated re-encoding!
    let filterComplex = "";

    // Step 1: Normalize all input clips to same format with PTS reset (required for xfade)
    for (let i = 0; i < clipPaths.length; i++) {
      filterComplex += `[${i}:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p,setpts=PTS-STARTPTS[v${i}];`;
      filterComplex += `[${i}:a]aformat=sample_rates=48000:channel_layouts=stereo,asetpts=PTS-STARTPTS[a${i}];`;
    }

    // Step 2: Build xfade chain for video with proper dissolve transitions
    // Each xfade takes two inputs and produces one output, chained together
    // OFFSET CALCULATION: For chained xfades, offset is measured from the START of the output stream
    // After xfade(A,B), output duration = dur(A) + dur(B) - transitionDuration
    // Next xfade offset = output_duration - transitionDuration
    const td = effectiveTransitionDuration; // Short alias

    if (clipPaths.length === 2) {
      // Simple case: just 2 clips
      const offset = Math.max(0, durations[0] - td);
      filterComplex += `[v0][v1]xfade=transition=${transitionType}:duration=${td}:offset=${offset.toFixed(3)}[vout];`;
      filterComplex += `[a0][a1]acrossfade=d=${td}:c1=tri:c2=tri[aout]`;
    } else {
      // Multi-clip chain: build progressive xfade sequence
      // outputDuration tracks the duration of the combined stream after each xfade
      let outputDuration = durations[0];

      // First transition: offset = when in clip0 the transition starts
      const firstOffset = Math.max(0, durations[0] - td);
      filterComplex += `[v0][v1]xfade=transition=${transitionType}:duration=${td}:offset=${firstOffset.toFixed(3)}[xv1];`;
      // After first xfade, output = dur[0] + dur[1] - td
      outputDuration = durations[0] + durations[1] - td;

      // Chain remaining transitions
      for (let i = 2; i < clipPaths.length; i++) {
        // Offset = when in the current combined stream the next transition starts
        // = current output duration - transition duration
        const nextOffset = Math.max(0, outputDuration - td);
        const outLabel = i === clipPaths.length - 1 ? "vout" : `xv${i}`;
        filterComplex += `[xv${i-1}][v${i}]xfade=transition=${transitionType}:duration=${td}:offset=${nextOffset.toFixed(3)}[${outLabel}];`;
        // Update output duration
        outputDuration = outputDuration + durations[i] - td;
      }

      // Build audio crossfade chain (same structure, matching durations)
      filterComplex += `[a0][a1]acrossfade=d=${td}:c1=tri:c2=tri[xa1];`;
      for (let i = 2; i < clipPaths.length; i++) {
        const outLabel = i === clipPaths.length - 1 ? "aout" : `xa${i}`;
        filterComplex += `[xa${i-1}][a${i}]acrossfade=d=${td}:c1=tri:c2=tri[${outLabel}];`;
      }
    }

    console.log(`[TransitionEngine] Building xfade chain: ${clipPaths.length} clips, ${td.toFixed(2)}s transitions`);

    const ffmpegArgs = clipPaths.flatMap(p => ["-i", p]);
    ffmpegArgs.push(
      "-filter_complex", filterComplex,
      "-map", "[vout]",
      "-map", "[aout]",
      "-c:v", "libx264",
      "-preset", "fast",        // Fast preset for reasonable speed
      "-crf", "20",             // Better quality (lower = better)
      "-pix_fmt", "yuv420p",    // Ensure compatibility
      "-c:a", "aac",
      "-b:a", "192k",
      "-movflags", "+faststart",
      "-y",
      outputPath
    );

    try {
      // Generous timeout for multi-clip processing (5 minutes)
      const result = spawnSync("ffmpeg", ffmpegArgs, { stdio: "pipe", timeout: 300000 });
      if (result.status !== 0) {
        const stderr = result.stderr?.toString() || "";
        console.warn(`[TransitionEngine] XFADE_FALLBACK: Xfade chain failed, falling back to fade concat. Error: ${stderr.slice(-300)}`);
        await this.fallbackSimpleConcat(clipPaths, outputPath);
        return;
      }
      console.log(`[TransitionEngine] SUCCESS: Applied ${transitionType} dissolve transitions to ${clipPaths.length} clips`);
    } catch (error: any) {
      console.warn(`[TransitionEngine] XFADE_FALLBACK: ${error.message}`);
      await this.fallbackSimpleConcat(clipPaths, outputPath);
    }
  }

  /**
   * Fallback: Simple concat with fade in/out on each clip (more compatible)
   */
  private static async fallbackSimpleConcat(clipPaths: string[], outputPath: string): Promise<void> {
    console.log(`[TransitionEngine] Using simple concat with fade transitions...`);

    let filterComplex = "";

    // Normalize and add fade in/out to each clip
    for (let i = 0; i < clipPaths.length; i++) {
      const duration = this.getVideoDuration(clipPaths[i]);
      const fadeOutStart = Math.max(0, duration - 0.3);
      filterComplex += `[${i}:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p,fade=t=in:st=0:d=0.3,fade=t=out:st=${fadeOutStart}:d=0.3[v${i}];`;
      filterComplex += `[${i}:a]aformat=sample_rates=48000:channel_layouts=stereo,afade=t=in:st=0:d=0.3,afade=t=out:st=${fadeOutStart}:d=0.3[a${i}];`;
    }

    // Concat all
    filterComplex += clipPaths.map((_, i) => `[v${i}][a${i}]`).join("") +
      `concat=n=${clipPaths.length}:v=1:a=1[vout][aout]`;

    const ffmpegArgs = clipPaths.flatMap(p => ["-i", p]);
    ffmpegArgs.push(
      "-filter_complex", filterComplex,
      "-map", "[vout]",
      "-map", "[aout]",
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "20",
      "-c:a", "aac",
      "-b:a", "192k",
      "-movflags", "+faststart",
      "-y",
      outputPath
    );

    const result = spawnSync("ffmpeg", ffmpegArgs, { stdio: "pipe", timeout: 300000 });
    if (result.status !== 0) {
      const stderr = result.stderr?.toString() || "";
      throw new Error(`Fallback concat also failed: ${stderr.slice(-200)}`);
    }
    console.log(`[TransitionEngine] Fallback concat succeeded`);
  }

  /**
   * V6.5: Choose optimal transition type based on clip content
   */
  static async getContentAwareTransition(
    clipPath: string,
    videoContext: string = "generic"
  ): Promise<TransitionType> {
    // Context-based recommendations
    const contextTransitions: Record<string, TransitionType[]> = {
      tutorial: ["dissolve", "fade", "smoothleft"],
      hype: ["wipe_right", "slide_left", "circleopen"], // Updated for new types
      demo: ["fade", "dissolve", "smoothright"],
      vlog: ["fade", "dissolve", "smoothleft"],
      gaming: ["wipe_left", "wipe_right", "circleopen", "slide_left"], // Updated for new types
      interview: ["fade", "dissolve"],
      storytelling: ["fadeblack", "fade", "dissolve"],
      cooking: ["fade", "dissolve", "smooth_down"],
      comedy: ["circleopen", "circleclose", "wipe_left"], // Updated for new types
      podcast: ["fade", "dissolve"],
      trailer: ["fadeblack", "wipe_left", "circleopen"], // Updated for new types
      marketing: ["slide_left", "slide_right", "wipe_left"], // Updated for new types
      generic: ["fade", "dissolve"]
    };

    const options = contextTransitions[videoContext] || contextTransitions.generic;

    // Randomly select from appropriate options for variety
    return options[Math.floor(Math.random() * options.length)];
  }

  /**
   * Apply a smart transition between two clips based on engagement and content
   * Note: This method needs engagement data for clips, which is not provided here.
   * Placeholder logic is used for demonstration.
   */
  static async applySmartTransition(
    clip1Path: string,
    clip2Path: string,
    outputPath: string,
    options: SmartTransitionOptions = {}
  ): Promise<void> {
    // Placeholder engagement data (replace with actual data if available)
    const clip1Engagement = Math.random() * 100;
    const clip2Engagement = Math.random() * 100;

    let transitionType: TransitionType = options.preferredJLType === "auto" ? "fade" : options.preferredJLType || "fade"; // Default to fade
    let transitionDuration = 0.5;
    let jlCut: "j-cut" | "l-cut" | "none" = "none";
    let jlOffset = options.jlOffset || 0.3;

    console.log(`[TransitionEngine] Applying smart transition between ${path.basename(clip1Path)} and ${path.basename(clip2Path)}`);

    // Beat Sync: If enabled, try to align transitions with beats
    if (options.enableBeatSync) {
      try {
        const beats1 = await this.detectBeats(clip1Path);
        const beats2 = await this.detectBeats(clip2Path);

        // Find beat closest to the end of clip1
        const beat1 = this.findNearestBeat(beats1, this.getVideoDuration(clip1Path) - transitionDuration);
        // Find beat closest to the start of clip2
        const beat2 = this.findNearestBeat(beats2, 0);

        if (beat1 && beat2) {
          // Align transition start to beat1, and audio start of clip2 to beat2
          const beatAlignmentOffset = beat1.timestamp - beat2.timestamp;
          transitionDuration = Math.min(0.8, Math.max(0.2, beat1.strength * 0.5 + beat2.strength * 0.5)); // Adjust duration based on beat strength
          transitionDuration = Math.max(0.3, transitionDuration); // Ensure minimum duration

          // J/L cut logic based on beat alignment
          if (options.enableJLCuts && (options.preferredJLType === "auto" || options.preferredJLType === "j-cut")) {
            if (beatAlignmentOffset < 0) { // Audio from clip2 leads video
              jlCut = "j-cut";
              jlOffset = Math.abs(beatAlignmentOffset);
            } else { // Audio from clip1 leads video
              jlCut = "l-cut";
              jlOffset = beatAlignmentOffset;
            }
          }

          console.log(`[TransitionEngine] Beat sync applied: Duration=${transitionDuration.toFixed(2)}s, JL Cut=${jlCut}, JL Offset=${jlOffset.toFixed(2)}s`);
        }
      } catch (error) {
        console.warn("[TransitionEngine] Beat sync failed, proceeding without it:", error);
      }
    }

    // Scene-aware: Use appropriate transition based on content similarity
    if (options.enableSceneAware && clip1Engagement && clip2Engagement) {
      // High engagement to high engagement: Quick cut, zoom, or wipe
      if (clip1Engagement > 80 && clip2Engagement > 80) {
        const energeticTransitions: TransitionType[] = ["zoom", "wipe_left", "wipe_right"];
        transitionType = energeticTransitions[Math.floor(Math.random() * energeticTransitions.length)];
        transitionDuration = 0.3;
      }
      // Low to high energy: White flash or slide for impact
      else if (clip1Engagement < 60 && clip2Engagement > 80) {
        const impactTransitions: TransitionType[] = ["whiteflash", "slide_up"];
        transitionType = impactTransitions[Math.floor(Math.random() * impactTransitions.length)];
        transitionDuration = 0.2;
      }
      // Similar engagement: Smooth dissolve or slide
      else if (Math.abs(clip1Engagement - clip2Engagement) < 20) {
        const smoothTransitions: TransitionType[] = ["dissolve", "slide_left", "slide_right"];
        transitionType = smoothTransitions[Math.floor(Math.random() * smoothTransitions.length)];
        transitionDuration = 0.8;
      }
    }

    // Apply J/L cut if enabled and chosen
    if (jlCut !== "none" && options.enableJLCuts) {
      await this.applyJLCutTransition(clip1Path, clip2Path, outputPath, {
        type: transitionType, // The base transition type might still influence audio mixing
        duration: transitionDuration, // Base duration for xfade video part
        jlCut: jlCut,
        jlOffset: jlOffset
      });
    } else {
      // Otherwise, apply regular transition
      await this.applyTransition(clip1Path, clip2Path, outputPath, {
        type: transitionType,
        duration: transitionDuration,
        offset: 0 // Smart transitions usually don't need explicit offset here
      });
    }
  }


  /**
   * Apply wipe transition (reveal next clip by wiping across screen)
   */
  static async applyWipeTransition(
    clip1Path: string,
    clip2Path: string,
    direction: "left" | "right" | "up" | "down",
    duration: number = 0.5
  ): Promise<string> {
    const outputId = nanoid();
    const outputPath = path.join(process.cwd(), "uploads", "temp-transitions", `transition-${outputId}.mp4`);

    // Ensure temp directory exists
    const tempDir = path.dirname(outputPath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Wipe transition using xfade filter with wipe modes
    const wipeDirections: Record<string, string> = {
      left: "wipeleft",
      right: "wiperight",
      up: "wipeup",
      down: "wipedown"
    };

    return new Promise((resolve, reject) => {
      ffmpeg(clip1Path)
        .input(clip2Path)
        .complexFilter([
          `[0:v][1:v]xfade=transition=${wipeDirections[direction]}:duration=${duration}:offset=0[v]`,
          `[0:a][1:a]acrossfade=d=${duration}[a]`,
        ])
        .map("[v]")
        .map("[a]")
        .output(outputPath)
        .on("end", () => {
          console.log(`[TransitionEngine] Wipe ${direction} transition complete`);
          resolve(outputPath);
        })
        .on("error", (err) => {
          console.error(`[TransitionEngine] Error applying wipe transition: ${err.message}`);
          reject(err);
        })
        .run();
    });
  }

  /**
   * Apply slide transition (slide next clip in from edge)
   */
  static async applySlideTransition(
    clip1Path: string,
    clip2Path: string,
    direction: "left" | "right" | "up" | "down",
    duration: number = 0.5
  ): Promise<string> {
    const outputId = nanoid();
    const outputPath = path.join(process.cwd(), "uploads", "temp-transitions", `transition-${outputId}.mp4`);

    // Ensure temp directory exists
    const tempDir = path.dirname(outputPath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Slide transition using xfade filter with slide modes
    const slideDirections: Record<string, string> = {
      left: "slideleft",
      right: "slideright",
      up: "slideup",
      down: "slidedown"
    };

    return new Promise((resolve, reject) => {
      ffmpeg(clip1Path)
        .input(clip2Path)
        .complexFilter([
          `[0:v][1:v]xfade=transition=${slideDirections[direction]}:duration=${duration}:offset=0[v]`,
          `[0:a][1:a]acrossfade=d=${duration}[a]`,
        ])
        .map("[v]")
        .map("[a]")
        .output(outputPath)
        .on("end", () => {
          console.log(`[TransitionEngine] Slide ${direction} transition complete`);
          resolve(outputPath);
        })
        .on("error", (err) => {
          console.error(`[TransitionEngine] Error applying slide transition: ${err.message}`);
          reject(err);
        })
        .run();
    });
  }

  // --- Placeholder methods for transitions not yet implemented ---

  /**
   * Apply dissolve transition
   */
  static async applyDissolveTransition(clip1Path: string, clip2Path: string, duration: number): Promise<string> {
    console.log(`[TransitionEngine] Applying dissolve transition (${duration}s)`);
    // Actual implementation would use ffmpeg with dissolve filter
    return this.applyTransition(clip1Path, clip2Path, "", { type: "dissolve", duration });
  }

  /**
   * Apply white flash transition
   */
  static async applyWhiteFlashTransition(clip1Path: string, clip2Path: string, duration: number): Promise<string> {
    console.log(`[TransitionEngine] Applying white flash transition (${duration}s)`);
    // Actual implementation would use ffmpeg with whiteflash filter
    return this.applyTransition(clip1Path, clip2Path, "", { type: "whiteflash", duration });
  }

  // --- End Placeholder methods ---


  /**
   * Apply a smart transition between two clips based on engagement and content
   */
  static async applySmartTransition(
    clip1Path: string,
    clip2Path: string,
    outputPath: string,
    options: SmartTransitionOptions = {}
  ): Promise<void> {
    // Placeholder engagement data (replace with actual data if available)
    const clip1Engagement = Math.random() * 100;
    const clip2Engagement = Math.random() * 100;

    let transitionType: TransitionType = options.preferredJLType === "auto" ? "fade" : options.preferredJLType || "fade"; // Default to fade
    let transitionDuration = 0.5;
    let jlCut: "j-cut" | "l-cut" | "none" = "none";
    let jlOffset = options.jlOffset || 0.3;

    console.log(`[TransitionEngine] Applying smart transition between ${path.basename(clip1Path)} and ${path.basename(clip2Path)}`);

    // Beat Sync: If enabled, try to align transitions with beats
    if (options.enableBeatSync) {
      try {
        const beats1 = await this.detectBeats(clip1Path);
        const beats2 = await this.detectBeats(clip2Path);

        // Find beat closest to the end of clip1
        const beat1 = this.findNearestBeat(beats1, this.getVideoDuration(clip1Path) - transitionDuration);
        // Find beat closest to the start of clip2
        const beat2 = this.findNearestBeat(beats2, 0);

        if (beat1 && beat2) {
          // Align transition start to beat1, and audio start of clip2 to beat2
          const beatAlignmentOffset = beat1.timestamp - beat2.timestamp;
          transitionDuration = Math.min(0.8, Math.max(0.2, beat1.strength * 0.5 + beat2.strength * 0.5)); // Adjust duration based on beat strength
          transitionDuration = Math.max(0.3, transitionDuration); // Ensure minimum duration

          // J/L cut logic based on beat alignment
          if (options.enableJLCuts && (options.preferredJLType === "auto" || options.preferredJLType === "j-cut")) {
            if (beatAlignmentOffset < 0) { // Audio from clip2 leads video
              jlCut = "j-cut";
              jlOffset = Math.abs(beatAlignmentOffset);
            } else { // Audio from clip1 leads video
              jlCut = "l-cut";
              jlOffset = beatAlignmentOffset;
            }
          }

          console.log(`[TransitionEngine] Beat sync applied: Duration=${transitionDuration.toFixed(2)}s, JL Cut=${jlCut}, JL Offset=${jlOffset.toFixed(2)}s`);
        }
      } catch (error) {
        console.warn("[TransitionEngine] Beat sync failed, proceeding without it:", error);
      }
    }

    // Scene-aware: Use appropriate transition based on content similarity
    if (options.enableSceneAware && clip1Engagement && clip2Engagement) {
      // High engagement to high engagement: Quick cut, zoom, or wipe
      if (clip1Engagement > 80 && clip2Engagement > 80) {
        const energeticTransitions: TransitionType[] = ["zoom", "wipe_left", "wipe_right"];
        transitionType = energeticTransitions[Math.floor(Math.random() * energeticTransitions.length)];
        transitionDuration = 0.3;
      }
      // Low to high energy: White flash or slide for impact
      else if (clip1Engagement < 60 && clip2Engagement > 80) {
        const impactTransitions: TransitionType[] = ["whiteflash", "slide_up"];
        transitionType = impactTransitions[Math.floor(Math.random() * impactTransitions.length)];
        transitionDuration = 0.2;
      }
      // Similar engagement: Smooth dissolve or slide
      else if (Math.abs(clip1Engagement - clip2Engagement) < 20) {
        const smoothTransitions: TransitionType[] = ["dissolve", "slide_left", "slide_right"];
        transitionType = smoothTransitions[Math.floor(Math.random() * smoothTransitions.length)];
        transitionDuration = 0.8;
      }
    }

    // Apply J/L cut if enabled and chosen
    if (jlCut !== "none" && options.enableJLCuts) {
      await this.applyJLCutTransition(clip1Path, clip2Path, outputPath, {
        type: transitionType, // The base transition type might still influence audio mixing
        duration: transitionDuration, // Base duration for xfade video part
        jlCut: jlCut,
        jlOffset: jlOffset
      });
    } else {
      // Otherwise, apply regular transition
      await this.applyTransition(clip1Path, clip2Path, outputPath, {
        type: transitionType,
        duration: transitionDuration,
        offset: 0 // Smart transitions usually don't need explicit offset here
      });
    }
  }
}