import type { InsertSmartSlice } from "@shared/schema";
import ffmpeg from "fluent-ffmpeg";
import { AudioAnalyzer } from "./audio-analyzer";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import OpenAI from "openai";
import { VideoProcessor } from "./video-processor";
import { FeedbackLearningService } from "./feedback-learning";
import { broadcastEditingProgress, completeEditingLog } from "../routes";

// Use AI_INTEGRATIONS_OPENAI_API_KEY (Replit integration) or fallback to OPENAI_API_KEY
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined,
});

const FRAMES_DIR = path.join(process.cwd(), "uploads", "frames");
if (!fs.existsSync(FRAMES_DIR)) {
  fs.mkdirSync(FRAMES_DIR, { recursive: true });
}

// Interface for the detailed analysis of a reference video
interface ReferenceAnalysis {
  cutTempo: number;
  colorProfile: string[];
  transitionTypes: string[];
  pacingPattern: string;
  visualStyle: string;
  audioSync: string;
}

// Interface for speech segments
interface SpeechSegment {
  start: number;
  end: number;
  text: string;
}

// Interface for semantic segments (verses, choruses, bridges, sections, etc.)
interface SemanticSegment {
  startTime: number;
  endTime: number;
  type: "intro" | "verse" | "chorus" | "bridge" | "pre-chorus" | "outro" | "breakdown" | "hook" | "section" | "speech" | "pause";
  description: string;
  importance: number; // 0-100, higher = more important
}

// Interface for video metadata
interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  fps: number;
}

// V6.4: FORMAT-SPECIFIC EDITING STRATEGIES
// Each content type gets tailored editing behavior based on editing-principles.md
interface FormatEditingStrategy {
  name: string;
  description: string;
  energyCurve: { position: number; energy: number }[];
  minEngagement: number;
  preferredClipTypes: string[];
  avoidClipTypes: string[];
  minClipDuration: number;
  maxClipDuration: number;
  targetClipDuration: number;
  hookPriority: {
    preferHighEnergy: boolean;
    preferSpeech: boolean;
    maxHookDuration: number;
  };
  pacingStyle: "aggressive" | "steady" | "dynamic" | "gentle";
  preserveChronology: boolean;
  specialBehaviors: string[];
  clipScoreModifiers: (clip: {
    engagementScore: number;
    clipType: string;
    duration: number;
    hasReaction?: boolean;
    hasSpeech?: boolean;
    position: number;
  }) => number;
}

const FORMAT_STRATEGIES: Record<string, FormatEditingStrategy> = {
  gaming: {
    name: "Gaming/Streaming",
    description: "Reaction focus, aggressive jump-cutting, highlight synthesis",
    energyCurve: [
      { position: 0, energy: 95 },
      { position: 0.2, energy: 100 },
      { position: 0.5, energy: 90 },
      { position: 0.8, energy: 100 },
      { position: 1, energy: 95 }
    ],
    minEngagement: 75,
    preferredClipTypes: ["reaction", "action", "highlight", "peak", "hook", "climax", "funny"],
    avoidClipTypes: ["pause", "loading", "menu", "idle"],
    minClipDuration: 0.5,
    maxClipDuration: 4.0,
    targetClipDuration: 2.0,
    hookPriority: { preferHighEnergy: true, preferSpeech: false, maxHookDuration: 2.0 },
    pacingStyle: "aggressive",
    preserveChronology: false,
    specialBehaviors: ["reaction_focus", "jump_cutting", "highlight_synthesis"],
    clipScoreModifiers: (clip) => {
      let bonus = 0;
      if (clip.hasReaction) bonus += 25;
      if (clip.clipType.includes("action") || clip.clipType.includes("highlight")) bonus += 15;
      if (clip.clipType.includes("reaction")) bonus += 20;
      if (clip.duration < 2.0) bonus += 10;
      if (clip.engagementScore > 90) bonus += 15;
      return bonus;
    }
  },

  comedy: {
    name: "Comedy Sketches",
    description: "Punchline timing, setup/payoff structure, tight cutting",
    energyCurve: [
      { position: 0, energy: 70 },
      { position: 0.3, energy: 75 },
      { position: 0.6, energy: 80 },
      { position: 0.85, energy: 60 },
      { position: 0.9, energy: 100 },
      { position: 1, energy: 95 }
    ],
    minEngagement: 65,
    preferredClipTypes: ["punchline", "reaction", "setup", "payoff", "funny", "climax", "hook"],
    avoidClipTypes: ["pause", "dead_air", "filler"],
    minClipDuration: 0.3,
    maxClipDuration: 5.0,
    targetClipDuration: 2.5,
    hookPriority: { preferHighEnergy: false, preferSpeech: true, maxHookDuration: 3.0 },
    pacingStyle: "dynamic",
    preserveChronology: true,
    specialBehaviors: ["punchline_isolation", "tight_cutting", "reaction_cutaways"],
    clipScoreModifiers: (clip) => {
      let bonus = 0;
      if (clip.clipType.includes("punchline") || clip.clipType.includes("payoff")) bonus += 30;
      if (clip.clipType.includes("reaction")) bonus += 15;
      if (clip.position > 0.8 && clip.engagementScore > 85) bonus += 25;
      if (clip.hasSpeech) bonus += 10;
      return bonus;
    }
  },

  cooking: {
    name: "Cooking/How-To",
    description: "Process sequencing, chronological preservation, aesthetic enhancement",
    energyCurve: [
      { position: 0, energy: 75 },
      { position: 0.25, energy: 70 },
      { position: 0.5, energy: 75 },
      { position: 0.75, energy: 80 },
      { position: 1, energy: 90 }
    ],
    minEngagement: 55,
    preferredClipTypes: ["preparation", "technique", "result", "plating", "action", "demonstration"],
    avoidClipTypes: ["waiting", "idle", "pause"],
    minClipDuration: 1.0,
    maxClipDuration: 8.0,
    targetClipDuration: 3.5,
    hookPriority: { preferHighEnergy: false, preferSpeech: false, maxHookDuration: 3.0 },
    pacingStyle: "steady",
    preserveChronology: true,
    specialBehaviors: ["process_sequencing", "speed_ramping_candidates", "aesthetic_priority"],
    clipScoreModifiers: (clip) => {
      let bonus = 0;
      if (clip.clipType.includes("result") || clip.clipType.includes("plating")) bonus += 25;
      if (clip.clipType.includes("technique")) bonus += 15;
      if (clip.position > 0.9) bonus += 20;
      if (clip.position < 0.1 && clip.engagementScore > 80) bonus += 15;
      return bonus;
    }
  },

  educational: {
    name: "Educational/Long-form",
    description: "Concept retention, visual reinforcement, steady pacing",
    energyCurve: [
      { position: 0, energy: 70 },
      { position: 0.2, energy: 75 },
      { position: 0.5, energy: 70 },
      { position: 0.8, energy: 75 },
      { position: 1, energy: 65 }
    ],
    minEngagement: 50,
    preferredClipTypes: ["explanation", "demonstration", "summary", "key_point", "visual_aid", "talking_head"],
    avoidClipTypes: ["tangent", "filler", "repetition"],
    minClipDuration: 2.0,
    maxClipDuration: 15.0,
    targetClipDuration: 6.0,
    hookPriority: { preferHighEnergy: false, preferSpeech: true, maxHookDuration: 5.0 },
    pacingStyle: "gentle",
    preserveChronology: true,
    specialBehaviors: ["concept_triggered_visuals", "chapter_segmentation", "judicious_cleanup"],
    clipScoreModifiers: (clip) => {
      let bonus = 0;
      if (clip.hasSpeech) bonus += 20;
      if (clip.clipType.includes("explanation") || clip.clipType.includes("key_point")) bonus += 15;
      if (clip.clipType.includes("demonstration")) bonus += 10;
      if (clip.duration > 3.0 && clip.duration < 10.0) bonus += 10;
      return bonus;
    }
  },

  podcast: {
    name: "Podcast Clips",
    description: "Dialogue cleanup, filler removal, dynamic framing",
    energyCurve: [
      { position: 0, energy: 80 },
      { position: 0.3, energy: 85 },
      { position: 0.6, energy: 90 },
      { position: 0.9, energy: 85 },
      { position: 1, energy: 80 }
    ],
    minEngagement: 60,
    preferredClipTypes: ["key_moment", "insight", "debate", "reaction", "speech", "talking_head"],
    avoidClipTypes: ["filler", "um", "pause", "dead_air", "tangent"],
    minClipDuration: 1.5,
    maxClipDuration: 12.0,
    targetClipDuration: 5.0,
    hookPriority: { preferHighEnergy: true, preferSpeech: true, maxHookDuration: 4.0 },
    pacingStyle: "dynamic",
    preserveChronology: true,
    specialBehaviors: ["filler_removal", "dynamic_zoom_hints", "animated_captions"],
    clipScoreModifiers: (clip) => {
      let bonus = 0;
      if (clip.hasSpeech) bonus += 25;
      if (clip.clipType.includes("insight") || clip.clipType.includes("key_moment")) bonus += 20;
      if (clip.clipType.includes("debate") || clip.clipType.includes("reaction")) bonus += 15;
      if (clip.engagementScore > 80) bonus += 10;
      return bonus;
    }
  },

  talking_head: {
    name: "Talking Head",
    description: "Speech integrity, retention focus, auto-framing cues",
    energyCurve: [
      { position: 0, energy: 75 },
      { position: 0.25, energy: 80 },
      { position: 0.5, energy: 85 },
      { position: 0.75, energy: 80 },
      { position: 1, energy: 75 }
    ],
    minEngagement: 55,
    preferredClipTypes: ["speech", "talking_head", "key_point", "explanation", "emphasis"],
    avoidClipTypes: ["filler", "pause", "um", "dead_air"],
    minClipDuration: 2.0,
    maxClipDuration: 10.0,
    targetClipDuration: 4.0,
    hookPriority: { preferHighEnergy: false, preferSpeech: true, maxHookDuration: 3.0 },
    pacingStyle: "steady",
    preserveChronology: true,
    specialBehaviors: ["speech_integrity", "punch_in_hints", "jl_cut_suggestions"],
    clipScoreModifiers: (clip) => {
      let bonus = 0;
      if (clip.hasSpeech) bonus += 30;
      if (clip.clipType.includes("talking_head") || clip.clipType.includes("speech")) bonus += 15;
      if (clip.clipType.includes("key_point") || clip.clipType.includes("emphasis")) bonus += 20;
      return bonus;
    }
  },

  music_video: {
    name: "Music Videos",
    description: "Rhythm sync, proportional narrative sampling, beat matching",
    energyCurve: [
      { position: 0, energy: 85 },
      { position: 0.25, energy: 90 },
      { position: 0.5, energy: 95 },
      { position: 0.75, energy: 100 },
      { position: 1, energy: 90 }
    ],
    minEngagement: 70,
    preferredClipTypes: ["chorus", "hook", "verse", "bridge", "intro", "outro", "peak", "action"],
    avoidClipTypes: ["pause", "silence", "filler"],
    minClipDuration: 0.5,
    maxClipDuration: 6.0,
    targetClipDuration: 3.0,
    hookPriority: { preferHighEnergy: true, preferSpeech: false, maxHookDuration: 3.0 },
    pacingStyle: "dynamic",
    preserveChronology: true,
    specialBehaviors: ["beat_sync", "proportional_narrative", "rhythmic_transitions"],
    clipScoreModifiers: (clip) => {
      let bonus = 0;
      if (clip.clipType.includes("chorus") || clip.clipType.includes("hook")) bonus += 25;
      if (clip.clipType.includes("peak") || clip.clipType.includes("action")) bonus += 15;
      if (clip.engagementScore > 85) bonus += 10;
      return bonus;
    }
  },

  trailer: {
    name: "Trailers/Hype",
    description: "Tension building, pacing acceleration, dramatic moment selection",
    energyCurve: [
      { position: 0, energy: 90 },
      { position: 0.2, energy: 95 },
      { position: 0.4, energy: 92 },
      { position: 0.6, energy: 97 },
      { position: 0.8, energy: 100 },
      { position: 1, energy: 100 }
    ],
    minEngagement: 80,
    preferredClipTypes: ["action", "climax", "peak", "hook", "dramatic", "reveal", "explosion"],
    avoidClipTypes: ["setup", "explanation", "dialogue", "pause"],
    minClipDuration: 0.3,
    maxClipDuration: 3.0,
    targetClipDuration: 1.5,
    hookPriority: { preferHighEnergy: true, preferSpeech: false, maxHookDuration: 2.0 },
    pacingStyle: "aggressive",
    preserveChronology: false,
    specialBehaviors: ["tension_building", "pacing_acceleration", "tempo_mapping"],
    clipScoreModifiers: (clip) => {
      let bonus = 0;
      if (clip.clipType.includes("action") || clip.clipType.includes("climax")) bonus += 30;
      if (clip.clipType.includes("peak") || clip.clipType.includes("dramatic")) bonus += 25;
      if (clip.duration < 2.0) bonus += 15;
      if (clip.engagementScore > 90) bonus += 20;
      if (clip.position > 0.7) bonus += 10;
      return bonus;
    }
  },

  vlog: {
    name: "Vlogs",
    description: "Authenticity, scene-based pacing, emotion detection",
    energyCurve: [
      { position: 0, energy: 80 },
      { position: 0.3, energy: 75 },
      { position: 0.5, energy: 85 },
      { position: 0.8, energy: 80 },
      { position: 1, energy: 75 }
    ],
    minEngagement: 55,
    preferredClipTypes: ["personal_moment", "talking_head", "broll", "reaction", "highlight", "scenic"],
    avoidClipTypes: ["filler", "dead_air", "repetition"],
    minClipDuration: 1.0,
    maxClipDuration: 8.0,
    targetClipDuration: 3.5,
    hookPriority: { preferHighEnergy: false, preferSpeech: true, maxHookDuration: 4.0 },
    pacingStyle: "dynamic",
    preserveChronology: true,
    specialBehaviors: ["scene_based_pacing", "emotion_detection", "authentic_moments"],
    clipScoreModifiers: (clip) => {
      let bonus = 0;
      if (clip.clipType.includes("personal_moment") || clip.clipType.includes("reaction")) bonus += 20;
      if (clip.hasSpeech) bonus += 15;
      if (clip.clipType.includes("scenic") || clip.clipType.includes("broll")) bonus += 10;
      return bonus;
    }
  },

  marketing: {
    name: "Marketing/Demos",
    description: "Value & conversion focus, problem-solution structure, CTA insertion",
    energyCurve: [
      { position: 0, energy: 90 },
      { position: 0.3, energy: 85 },
      { position: 0.5, energy: 90 },
      { position: 0.8, energy: 95 },
      { position: 1, energy: 100 }
    ],
    minEngagement: 70,
    preferredClipTypes: ["hook", "benefit", "demonstration", "result", "testimonial", "cta"],
    avoidClipTypes: ["filler", "tangent", "technical_detail"],
    minClipDuration: 0.5,
    maxClipDuration: 5.0,
    targetClipDuration: 2.5,
    hookPriority: { preferHighEnergy: true, preferSpeech: true, maxHookDuration: 3.0 },
    pacingStyle: "dynamic",
    preserveChronology: true,
    specialBehaviors: ["problem_solution", "cta_placement", "benefit_highlight"],
    clipScoreModifiers: (clip) => {
      let bonus = 0;
      if (clip.clipType.includes("benefit") || clip.clipType.includes("result")) bonus += 25;
      if (clip.clipType.includes("demonstration")) bonus += 15;
      if (clip.position > 0.9) bonus += 20;
      if (clip.position < 0.1 && clip.engagementScore > 85) bonus += 15;
      return bonus;
    }
  },

  generic: {
    name: "Generic/Default",
    description: "Engagement-based selection with balanced pacing",
    energyCurve: [
      { position: 0, energy: 80 },
      { position: 0.3, energy: 85 },
      { position: 0.6, energy: 90 },
      { position: 0.85, energy: 85 },
      { position: 1, energy: 80 }
    ],
    minEngagement: 60,
    preferredClipTypes: ["hook", "action", "peak", "talking_head", "broll"],
    avoidClipTypes: ["filler", "pause", "dead_air"],
    minClipDuration: 1.0,
    maxClipDuration: 8.0,
    targetClipDuration: 3.0,
    hookPriority: { preferHighEnergy: true, preferSpeech: false, maxHookDuration: 3.0 },
    pacingStyle: "dynamic",
    preserveChronology: true,
    specialBehaviors: [],
    clipScoreModifiers: (clip) => {
      let bonus = 0;
      if (clip.engagementScore > 85) bonus += 15;
      if (clip.clipType.includes("hook") || clip.clipType.includes("peak")) bonus += 10;
      return bonus;
    }
  }
};

export class AIAnalyzer {
  /**
   * V6.4: Get the format-specific editing strategy for a content category.
   * Falls back to generic strategy if category not found.
   */
  static getFormatStrategy(category: string): FormatEditingStrategy {
    const normalizedCategory = category?.toLowerCase() || "generic";
    const strategy = FORMAT_STRATEGIES[normalizedCategory] || FORMAT_STRATEGIES.generic;
    console.log(`[FormatStrategy] Using "${strategy.name}" strategy for category "${category}"`);
    return strategy;
  }

  /**
   * V6.4: Apply format-specific scoring to a clip based on the category strategy.
   * Returns bonus points to add to the clip's base score.
   */
  static applyFormatScoring(
    clip: {
      id: string;
      engagementScore: number;
      clipType: string;
      startTime: number;
      endTime: number;
      transcription?: string | null;
    },
    strategy: FormatEditingStrategy,
    totalDuration: number
  ): { bonus: number; penalties: number; reasons: string[] } {
    const duration = (clip.endTime || 0) - (clip.startTime || 0);
    const position = totalDuration > 0 ? (clip.startTime || 0) / totalDuration : 0;
    const hasSpeech = !!(clip.transcription && clip.transcription.length > 10);
    const clipTypeLower = (clip.clipType || "").toLowerCase();

    let bonus = 0;
    let penalties = 0;
    const reasons: string[] = [];

    const clipData = {
      engagementScore: clip.engagementScore || 0,
      clipType: clipTypeLower,
      duration,
      hasSpeech,
      hasReaction: clipTypeLower.includes("reaction"),
      position
    };
    bonus += strategy.clipScoreModifiers(clipData);

    if (strategy.preferredClipTypes.some(t => clipTypeLower.includes(t.toLowerCase()))) {
      bonus += 15;
      reasons.push(`preferred_type:${clipTypeLower}`);
    }

    if (strategy.avoidClipTypes.some(t => clipTypeLower.includes(t.toLowerCase()))) {
      penalties += 25;
      reasons.push(`avoided_type:${clipTypeLower}`);
    }

    if (duration < strategy.minClipDuration) {
      penalties += 10;
      reasons.push(`too_short:${duration.toFixed(1)}s`);
    }
    if (duration > strategy.maxClipDuration) {
      penalties += 10;
      reasons.push(`too_long:${duration.toFixed(1)}s`);
    }

    if (strategy.hookPriority.preferSpeech && hasSpeech) {
      bonus += 10;
      reasons.push("has_speech");
    }
    if (strategy.hookPriority.preferHighEnergy && (clip.engagementScore || 0) > 85) {
      bonus += 10;
      reasons.push("high_energy");
    }

    return { bonus, penalties, reasons };
  }

  /**
   * Analyze a reference video to extract editing patterns using GPT-4o Vision.
   * This method downloads frames, analyzes them, and returns structured editing metadata.
   */
  static async analyzeReferenceVideo(url: string): Promise<ReferenceAnalysis> {
    console.log('[AIAnalyzer] Starting reference video analysis:', url);

    const frameDir = path.join(process.cwd(), 'uploads', 'frames');
    // Ensure the frames directory exists
    if (!fs.existsSync(frameDir)) {
      fs.mkdirSync(frameDir, { recursive: true });
    }
    const framePaths: string[] = [];
    let downloadedVideoPath: string | null = null;

    try {
      // Step 1: Download the video if it's a YouTube/streaming URL
      console.log('[AIAnalyzer] Downloading reference video...');
      const downloadResult = await VideoProcessor.downloadFromUrl(url);
      downloadedVideoPath = downloadResult.videoPath;
      console.log(`[AIAnalyzer] Video downloaded to: ${downloadedVideoPath}`);

      // Step 2: Extract frames from the downloaded video
      // We aim for about 1 frame per second for a reasonable analysis window, capped at 30 seconds.
      console.log('[AIAnalyzer] Extracting frames from reference video...');

      if (!downloadedVideoPath) {
        throw new Error('Failed to download reference video - no video path returned');
      }

      const frameBaseName = `frame-${nanoid()}`;
      const videoPathString: string = downloadedVideoPath; // Type assertion after null check
      await new Promise<void>((resolve, reject) => {
        ffmpeg(videoPathString)
          .fps(1) // Extract 1 frame per second
          .frames(20) // Limit to 20 frames (optimized from 30 - GPT-4o needs only 3-6 for accurate analysis)
          .on('end', () => {
            console.log('[AIAnalyzer] Frame extraction complete');
            resolve();
          })
          .on('error', (err) => {
            console.error('[AIAnalyzer] FFmpeg error during frame extraction:', err);
            reject(err);
          })
          // Save frames to the designated directory with unique names
          .save(path.join(frameDir, `${frameBaseName}-%d.jpg`));
      });

      // Step 3: Collect the paths of all extracted frames.
      // Read directory and filter for the frames we just created.
      const files = fs.readdirSync(frameDir)
        .filter((f: string) => f.startsWith('frame-') && f.endsWith('.jpg'))
        .sort();

      for (const file of files) {
        framePaths.push(path.join(frameDir, file));
      }

      if (framePaths.length === 0) {
        throw new Error('No frames were extracted from the reference video.');
      }

      console.log(`[AIAnalyzer] Successfully extracted ${framePaths.length} frames for analysis.`);

      // Step 4: Convert frames to base64 for GPT-4o Vision API.
      const frameData = framePaths.map(path => {
        const buffer = fs.readFileSync(path);
        return buffer.toString('base64');
      });

      // Step 5: Analyze the frames using GPT-4o Vision.
      console.log('[AIAnalyzer] Analyzing frames with GPT-4o Vision...');

      // Construct the messages for the OpenAI API.
      const messages: any[] = [
        {
          role: 'system',
          content: `You are a professional video editing analyst. Analyze the provided video frames and extract detailed editing patterns. Focus on:
1. Cut tempo (average seconds between scene changes)
2. Color palette (dominant colors used)
3. Transition types (cuts, fades, dissolves, wipes, etc.)
4. Pacing pattern (fast cuts vs slow builds)
5. Visual style (cinematic, documentary, vlog, commercial, etc.)
6. Audio sync patterns (if detectable from visual cues)

Return your analysis as JSON with this exact structure:
{
  "cutTempo": number (average seconds between scene changes),
  "colorProfile": ["color1", "color2", "color3", "color4"],
  "transitionTypes": ["type1", "type2", "type3"],
  "pacingPattern": "description",
  "visualStyle": "style description",
  "audioSync": "sync pattern description"
}`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analyze these frames from a reference video and extract the editing patterns:'
            },
            // Limit the number of frames sent to the API to avoid token limits.
            // Using 6 strategically sampled frames for efficient analysis (start, end, and 4 middle frames)
            ...frameData.length > 6
              ? [frameData[0], frameData[Math.floor(frameData.length * 0.25)], frameData[Math.floor(frameData.length * 0.5)], frameData[Math.floor(frameData.length * 0.75)], frameData[frameData.length - 1], frameData[Math.floor(frameData.length * 0.33)]].map(base64 => ({
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${base64}`,
                    detail: 'low' // Use low detail for faster processing
                  }
                }))
              : frameData.map(base64 => ({
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${base64}`,
                    detail: 'low' // Use low detail for faster processing
                  }
                }))
          ]
        }
      ];

      // Make the API call to OpenAI.
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: messages as any,
        max_tokens: 600, // Optimized from 1000 - sufficient for structured JSON response (30% token reduction)
        response_format: { type: 'json_object' } // Ensure response is JSON
      });

      // Parse the JSON response from the API.
      const analysis = JSON.parse(response.choices[0].message.content || '{}');

      console.log('[AIAnalyzer] Analysis complete:', analysis);

      // Step 6: Clean up the extracted frames and downloaded video from the file system.
      for (const framePath of framePaths) {
        try {
          if (fs.existsSync(framePath)) {
            fs.unlinkSync(framePath);
          }
        } catch (err) {
          console.error('[AIAnalyzer] Error cleaning up temporary frame file:', err);
        }
      }

      // Clean up downloaded video
      if (downloadedVideoPath && fs.existsSync(downloadedVideoPath)) {
        try {
          fs.unlinkSync(downloadedVideoPath);
          console.log('[AIAnalyzer] Cleaned up downloaded video');
        } catch (err) {
          console.error('[AIAnalyzer] Error cleaning up downloaded video:', err);
        }
      }

      // Return the structured analysis, providing defaults if any fields are missing.
      return {
        cutTempo: analysis.cutTempo || 3, // Default cut tempo
        colorProfile: analysis.colorProfile || ['warm', 'neutral'], // Default color profile
        transitionTypes: analysis.transitionTypes || ['cut', 'fade'], // Default transitions
        pacingPattern: analysis.pacingPattern || 'moderate', // Default pacing
        visualStyle: analysis.visualStyle || 'modern', // Default visual style
        audioSync: analysis.audioSync || 'standard' // Default audio sync
      };

    } catch (error) {
      console.error('[AIAnalyzer] Failed to analyze reference video:', error);

      // Clean up any frames that might have been extracted before the error occurred.
      for (const framePath of framePaths) {
        try {
          if (fs.existsSync(framePath)) {
            fs.unlinkSync(framePath);
          }
        } catch (err) {
          // Ignore cleanup errors during error handling.
        }
      }

      // Clean up downloaded video on error
      if (downloadedVideoPath && fs.existsSync(downloadedVideoPath)) {
        try {
          fs.unlinkSync(downloadedVideoPath);
        } catch (err) {
          // Ignore cleanup errors during error handling.
        }
      }

      // Return default values to maintain functionality in case of analysis failure.
      return {
        cutTempo: 3,
        colorProfile: ['neutral', 'warm'],
        transitionTypes: ['cut', 'fade'],
        pacingPattern: 'moderate',
        visualStyle: 'standard',
        audioSync: 'standard'
      };
    }
  }

  /**
   * Analyze scene changes in a video to determine cut tempo.
   * This method uses FFmpeg's scene change detection.
   */
  static async analyzeSceneChanges(videoPath: string): Promise<number[]> {
    return new Promise((resolve, reject) => {
      const sceneChanges: number[] = [];

      // Configure FFmpeg to detect scene changes (scene threshold > 0.3)
      // and output timestamp information to stderr.
      ffmpeg(videoPath)
        .outputOptions([
          '-vf', 'select=gt(scene\\,0.3),showinfo', // Select frames with scene change > 0.3
          '-f', 'null' // Output to null device
        ])
        .on('stderr', (line: string) => {
          // Parse the timestamp from FFmpeg's output lines.
          const match = line.match(/pts_time:(\d+\.?\d*)/);
          if (match) {
            sceneChanges.push(parseFloat(match[1]));
          }
        })
        .on('end', () => resolve(sceneChanges)) // Resolve with detected scene change timestamps
        .on('error', reject) // Reject the promise on FFmpeg error
        .save('-'); // Process the input file
    });
  }

  /**
   * Extract dominant colors from a set of video frames using GPT-4o Vision.
   * This is useful for understanding the overall color grading and aesthetic of a video.
   */
  static async extractColorPalette(framePaths: string[]): Promise<string[]> {
    const fs = require('fs'); // Dynamic import for fs module

    // Select a subset of frames for analysis to manage API token limits.
    const sampleFrames = framePaths.slice(0, 5); // Analyze up to 5 frames

    // Convert sampled frames to base64 for the API request.
    const frameData = sampleFrames.map(path => {
      const buffer = fs.readFileSync(path);
      return buffer.toString('base64');
    });

    // Call the OpenAI API with image data and a prompt for color analysis.
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Identify the 4-6 dominant colors in these video frames. Return only a JSON array of color names like ["warm orange", "deep blue", "soft yellow"]'
            },
            ...frameData.map(base64 => ({
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64}`,
                detail: 'low' // Use low detail for faster analysis
              }
            }))
          ]
        }
      ] as any,
      max_tokens: 200, // Maximum tokens for the response
      response_format: { type: 'json_object' } // Ensure JSON output
    });

    // Parse the JSON response and extract the color list.
    const result = JSON.parse(response.choices[0].message.content || '{"colors":[]}');
    return result.colors || ['neutral', 'warm']; // Return extracted colors or defaults
  }

  /**
   * Analyze a video file to extract editing patterns and metadata.
   * This is the main entry point for video analysis.
   */
  static async analyzeVideo(
    videoPath: string,
    intent: string, // Simplified intent for this example
    projectId?: string // Add projectId for progress tracking
  ): Promise<{
    slices: InsertSmartSlice[];
    speechSegments: SpeechSegment[];
    metadata: VideoMetadata;
    videoCategory: string;
  }> {
    console.log(`\n========================================`);
    console.log(`[AIAnalyzer] 🎬 Starting AI Video Analysis`);
    console.log(`========================================`);
    console.log(`Video: ${videoPath}`);

    const pid = projectId || 'unknown';

    // Get video metadata
    if (projectId) broadcastEditingProgress(projectId, { stage: 'analyzing', message: 'Loading video metadata...', progress: 5 });
    const metadata = await this.getVideoMetadata(videoPath);
    console.log(`Duration: ${metadata.duration}s`);
    console.log(`Intent: ${intent}`);
    console.log(`Resolution: ${metadata.width}x${metadata.height}`);

    // Extract frames for vision analysis (1 frame per second)
    if (projectId) broadcastEditingProgress(projectId, { stage: 'analyzing', message: `Extracting frames from video...`, progress: 10 });
    const framePaths = await this.extractFrames(videoPath, metadata.duration);
    console.log(`\n[AIAnalyzer] 📸 Extracted ${framePaths.length} frames for OpenAI Vision analysis`);

    // Analyze frames with OpenAI Vision API
    if (projectId) broadcastEditingProgress(projectId, { stage: 'engagement', message: `Analyzing video frames with AI (${framePaths.length} frames)...`, progress: 15 });
    console.log(`\n[AIAnalyzer] 🤖 Calling OpenAI Vision API with ${framePaths.length} frames...`);
    const startTime = Date.now();
    const visionAnalysis = await this.analyzeFramesWithVision(framePaths);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[AIAnalyzer] ✅ OpenAI Vision analysis complete in ${elapsed}s`);
    console.log(`[AIAnalyzer] Found ${visionAnalysis.scenes.length} distinct scenes`);

    // Transcribe audio if available
    if (projectId) broadcastEditingProgress(projectId, { stage: 'audio', message: 'Extracting audio for transcription...', progress: 25 });
    console.log(`\n[AIAnalyzer] 🎙️ Extracting audio for speech transcription...`);
    let speechSegments: SpeechSegment[] = [];
    try {
      const audioPath = await VideoProcessor.extractAudioForTranscription(videoPath);
      if (audioPath) {
        if (projectId) broadcastEditingProgress(projectId, { stage: 'audio', message: 'Transcribing audio with AI...', progress: 35 });
        console.log(`[AIAnalyzer] 🤖 Calling OpenAI Whisper API for transcription...`);
        const transcriptionStart = Date.now();
        speechSegments = await this.transcribeAudio(audioPath);
        const transcriptionElapsed = ((Date.now() - transcriptionStart) / 1000).toFixed(1);
        console.log(`[AIAnalyzer] ✅ Transcription complete in ${transcriptionElapsed}s: ${speechSegments.length} speech segments`);
        fs.unlinkSync(audioPath); // Clean up temp audio file
      } else {
        console.log(`[AIAnalyzer] ⚠️ No audio track found - skipping transcription`);
      }
    } catch (transcriptionError: any) {
      // Handle Whisper API errors gracefully (e.g., endpoint not available in custom baseURL)
      console.error('[AIAnalyzer] ⚠️ Transcription failed (endpoint unavailable or error):', transcriptionError.message);
      console.log('[AIAnalyzer] Continuing without speech segments...');
      speechSegments = [];
    }

    // NEW V6: Detect semantic structure (verses, choruses, bridges, sections, etc.)
    if (projectId) broadcastEditingProgress(projectId, { stage: 'slicing', message: 'Detecting content structure...', progress: 45 });
    console.log(`\n[AIAnalyzer] 🧠 Detecting semantic content structure...`);
    const structureStart = Date.now();
    const semanticStructure = await this.detectSemanticStructure(speechSegments, metadata.duration);
    const structureElapsed = ((Date.now() - structureStart) / 1000).toFixed(1);
    console.log(`[AIAnalyzer] ✅ Structure detection complete in ${structureElapsed}s: ${semanticStructure.length} meaningful segments`);
    semanticStructure.forEach(s => {
      console.log(`[AIAnalyzer]   - ${s.type}: "${s.description}" (${s.startTime.toFixed(1)}s-${s.endTime.toFixed(1)}s, importance: ${s.importance})`);
    });

    // Create slices based on SEMANTIC STRUCTURE (smarter than just scene detection)
    // This creates clips that match natural content breaks (verses, choruses, sections, etc.)
    if (projectId) broadcastEditingProgress(projectId, { stage: 'slicing', message: `Creating ${semanticStructure.length} intelligent clips...`, progress: 55 });
    console.log(`\n[AIAnalyzer] ✂️ Creating ${semanticStructure.length} intelligent slices based on content structure...`);
    const slices = this.createSlicesFromSemanticStructure(semanticStructure);

    // Score engagement for each slice
    if (projectId) broadcastEditingProgress(projectId, { stage: 'engagement', message: `Scoring engagement for ${slices.length} clips...`, progress: 65 });
    console.log(`\n[AIAnalyzer] 📊 Scoring engagement for ${slices.length} video slices...`);
    const scoredSlices = await this.scoreEngagement(slices, visionAnalysis, speechSegments);

    const avgEngagement = scoredSlices.reduce((sum, s) => sum + s.engagementScore, 0) / scoredSlices.length;
    console.log(`[AIAnalyzer] ✅ Engagement scoring complete - Average score: ${avgEngagement.toFixed(1)}/100`);

    // NEW V6: Intelligently detect video category (music video, talking head, marketing, movie scene, etc.)
    if (projectId) broadcastEditingProgress(projectId, { stage: 'grading', message: 'Detecting video category...', progress: 75 });
    console.log(`\n[AIAnalyzer] 🎯 Detecting video category for smarter clip selection...`);
    const videoCategory = await this.detectVideoCategory(visionAnalysis, speechSegments, metadata.duration);
    console.log(`[AIAnalyzer] ✅ Video category detected: ${videoCategory}`);

    console.log(`\n========================================`);
    console.log(`[AIAnalyzer] ✅ ANALYSIS COMPLETE`);
    console.log(`========================================`);
    console.log(`Total slices: ${scoredSlices.length}`);
    console.log(`Speech segments: ${speechSegments.length}`);
    console.log(`Average engagement: ${avgEngagement.toFixed(1)}/100`);
    console.log(`Video category: ${videoCategory}`);
    console.log(`========================================\n`);

    return {
      slices: scoredSlices,
      speechSegments,
      metadata,
      videoCategory,
    };
  }

  /**
   * Intelligently detect video category to inform clip selection strategy
   * Returns: gaming, educational, cooking, comedy, music_video, talking_head, marketing, movie_scene, tutorial, product_demo, vlog, news, sports, documentary, slideshow
   */
  private static async detectVideoCategory(
    visionAnalysis: any,
    speechSegments: SpeechSegment[],
    duration: number
  ): Promise<string> {
    try {
      // Analyze vision data to detect content type
      const scenes = visionAnalysis.scenes || [];
      const sceneDescriptions = scenes.map((s: any) => s.description || '').join(' | ');
      const fullTranscript = speechSegments.map(s => s.text).join(' ').toLowerCase();

      // Gaming/Streaming Detection
      const hasGameplay = scenes.some((s: any) =>
        s.description?.toLowerCase().includes('game') ||
        s.description?.toLowerCase().includes('gameplay') ||
        s.description?.toLowerCase().includes('player') ||
        s.description?.toLowerCase().includes('screen') ||
        s.description?.toLowerCase().includes('controller')
      );
      const hasReactions = scenes.some((s: any) =>
        s.description?.toLowerCase().includes('reaction') ||
        s.description?.toLowerCase().includes('excited') ||
        s.description?.toLowerCase().includes('shouting')
      );
      const hasGamingKeywords = fullTranscript.includes('gg') ||
        fullTranscript.includes('let\'s go') ||
        fullTranscript.includes('no way') ||
        fullTranscript.includes('oh my god');

      if (hasGameplay || (hasReactions && hasGamingKeywords)) {
        return 'gaming';
      }

      // Educational Content Detection
      const hasExplanations = speechSegments.length > duration * 0.6; // Heavy speech
      const hasEducationalKeywords = fullTranscript.includes('explain') ||
        fullTranscript.includes('because') ||
        fullTranscript.includes('therefore') ||
        fullTranscript.includes('first') ||
        fullTranscript.includes('second') ||
        fullTranscript.includes('however') ||
        fullTranscript.includes('understand');
      const hasConceptVisuals = scenes.some((s: any) =>
        s.description?.toLowerCase().includes('diagram') ||
        s.description?.toLowerCase().includes('chart') ||
        s.description?.toLowerCase().includes('graph')
      );

      if (duration > 180 && hasExplanations && (hasEducationalKeywords || hasConceptVisuals)) {
        return 'educational';
      }

      // Cooking/How-To Detection
      const hasCookingVisuals = scenes.some((s: any) =>
        s.description?.toLowerCase().includes('food') ||
        s.description?.toLowerCase().includes('cooking') ||
        s.description?.toLowerCase().includes('kitchen') ||
        s.description?.toLowerCase().includes('chopping') ||
        s.description?.toLowerCase().includes('stirring') ||
        s.description?.toLowerCase().includes('plating')
      );
      const hasCookingKeywords = fullTranscript.includes('chop') ||
        fullTranscript.includes('stir') ||
        fullTranscript.includes('season') ||
        fullTranscript.includes('cook') ||
        fullTranscript.includes('bake') ||
        fullTranscript.includes('ingredients');

      if (hasCookingVisuals || hasCookingKeywords) {
        return 'cooking';
      }

      // Comedy Detection
      const hasComedyStructure = speechSegments.some(s =>
        s.text.toLowerCase().includes('but') ||
        s.text.toLowerCase().includes('wait') ||
        s.text.toLowerCase().includes('actually')
      );
      const hasLaughter = scenes.some((s: any) =>
        s.description?.toLowerCase().includes('laugh') ||
        s.description?.toLowerCase().includes('smile') ||
        s.description?.toLowerCase().includes('funny')
      );
      const hasComedyKeywords = fullTranscript.includes('haha') ||
        fullTranscript.includes('lol') ||
        fullTranscript.includes('joke');

      if ((hasComedyStructure && hasLaughter) || hasComedyKeywords) {
        return 'comedy';
      }

      // Count characteristics
      const hasMusicBeats = scenes.some((s: any) =>
        s.description?.toLowerCase().includes('music') ||
        s.description?.toLowerCase().includes('beat') ||
        s.description?.toLowerCase().includes('concert') ||
        s.description?.toLowerCase().includes('performance')
      );

      const hasPersonTalking = speechSegments.length > duration * 0.3; // More than 30% speech
      const hasActionSequences = scenes.some((s: any) =>
        s.description?.toLowerCase().includes('action') ||
        s.description?.toLowerCase().includes('dynamic') ||
        s.description?.toLowerCase().includes('fast-paced') ||
        s.description?.toLowerCase().includes('movement')
      );

      const hasProductShot = scenes.some((s: any) =>
        s.description?.toLowerCase().includes('product') ||
        s.description?.toLowerCase().includes('demo') ||
        s.description?.toLowerCase().includes('showcase')
      );

      const hasInterview = speechSegments.length > 0 &&
        scenes.some((s: any) =>
          s.description?.toLowerCase().includes('person') ||
          s.description?.toLowerCase().includes('interview') ||
          s.description?.toLowerCase().includes('talking')
        );

      const hasCinematic = scenes.some((s: any) =>
        s.description?.toLowerCase().includes('cinematic') ||
        s.description?.toLowerCase().includes('dramatic') ||
        s.description?.toLowerCase().includes('scene') ||
        s.description?.toLowerCase().includes('film')
      );

      const hasSlides = scenes.some((s: any) =>
        s.description?.toLowerCase().includes('slide') ||
        s.description?.toLowerCase().includes('text') ||
        s.description?.toLowerCase().includes('graphic') ||
        s.description?.toLowerCase().includes('infographic')
      );

      // Determine category using heuristics
      if (hasMusicBeats && !hasPersonTalking) {
        return 'music_video';
      }

      if (hasProductShot && scenes.length < 8) {
        return 'product_demo';
      }

      if (hasInterview || (hasPersonTalking && scenes.length < 5)) {
        return 'talking_head';
      }

      if (hasCinematic && hasActionSequences) {
        return 'movie_scene';
      }

      if (hasSlides && hasPersonTalking) {
        return 'tutorial';
      }

      if (hasSlides && !hasPersonTalking) {
        return 'slideshow';
      }

      if (hasActionSequences && scenes.length > 10) {
        return 'sports';
      }

      if (hasPersonTalking && scenes.length > 15) {
        return 'vlog';
      }

      if (hasPersonTalking && hasCinematic) {
        return 'news';
      }

      if (hasActionSequences && hasCinematic) {
        return 'documentary';
      }

      // Default based on predominant characteristic
      if (hasPersonTalking) return 'talking_head';
      if (hasActionSequences) return 'marketing';
      if (hasMusicBeats) return 'music_video';

      return 'generic';
    } catch (error) {
      console.error('[detectVideoCategory] Error detecting category:', error);
      return 'generic';
    }
  }

  /**
   * Extracts video metadata like duration, resolution, and FPS.
   */
  private static async getVideoMetadata(videoPath: string): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err || !metadata.streams) {
          console.error("[AIAnalyzer] Error getting video metadata:", err);
          return reject(err);
        }

        const videoStream = metadata.streams.find((s: any) => s.codec_type === "video");
        if (!videoStream) {
          return reject(new Error("No video stream found in metadata"));
        }

        resolve({
          duration: parseFloat(metadata.format.duration || "0"),
          width: videoStream.width,
          height: videoStream.height,
          fps: parseFloat(videoStream.avg_frame_rate || "0"),
        });
      });
    });
  }

  /**
   * Extracts frames from a video at a specified interval.
   */
  private static async extractFrames(videoPath: string, duration: number): Promise<string[]> {
    const framePaths: string[] = [];
    const frameDir = path.join(process.cwd(), 'uploads', 'frames');
    if (!fs.existsSync(frameDir)) {
      fs.mkdirSync(frameDir, { recursive: true });
    }
    const frameBaseName = `frame-${nanoid()}`;
    const framesPerSecond = 2; // Increased from 1 to 2 fps for better analysis
    const maxFrames = Math.min(Math.ceil(duration * framesPerSecond), 120); // Increased from 60 to 120 frames

    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoPath)
        .fps(framesPerSecond)
        .frames(maxFrames)
        .on('end', () => {
          // Collect all extracted frame paths
          const files = fs.readdirSync(frameDir)
            .filter(f => f.startsWith(frameBaseName) && f.endsWith('.jpg'))
            .sort();
          for (const file of files) {
            framePaths.push(path.join(frameDir, file));
          }
          resolve();
        })
        .on('error', (err) => {
          console.error('[AIAnalyzer] FFmpeg error during frame extraction:', err);
          reject(err);
        })
        .save(path.join(frameDir, `${frameBaseName}-%d.jpg`));
    });

    return framePaths;
  }

  /**
   * Analyzes video frames using OpenAI Vision API to detect scenes and key elements.
   */
  private static async analyzeFramesWithVision(framePaths: string[]): Promise<{
    scenes: Array<{ startTime: number; endTime: number; description: string; keyElements: string[] }>;
    dominantColors: string[];
    visualStyle: string;
  }> {
    // Limit frames for vision analysis to manage API costs and token limits
    const MAX_FRAMES_FOR_VISION = 15;
    const sampledFramePaths = framePaths.slice(0, MAX_FRAMES_FOR_VISION);

    const frameData = sampledFramePaths.map(filePath => {
      const buffer = fs.readFileSync(filePath);
      return buffer.toString('base64');
    });

    const messages: any[] = [
      {
        role: 'system',
        content: `You are an expert video analysis AI. Analyze the provided video frames to identify distinct scenes, dominant colors, and the overall visual style.

        For each scene, provide:
        - startTime (in seconds)
        - endTime (in seconds)
        - description (a brief summary of the scene's content and action)
        - keyElements (a list of important objects, people, or actions in the scene)

        Also identify:
        - dominantColors (an array of 3-5 dominant colors in the video)
        - visualStyle (e.g., cinematic, documentary, vlog, corporate, abstract)

        Return the analysis as a JSON object. Example:
        {
          "scenes": [
            {"startTime": 0, "endTime": 5.2, "description": "Opening shot of a city skyline at sunset", "keyElements": ["skyline", "sunset", "buildings"]},
            {"startTime": 5.2, "endTime": 10.5, "description": "Quick cuts of people walking in a busy street", "keyElements": ["people", "street", "motion"]}
          ],
          "dominantColors": ["deep blue", "warm orange", "neutral grey"],
          "visualStyle": "cinematic"
        }`
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Analyze these video frames:' },
          ...frameData.map(base64 => ({
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${base64}`,
              detail: 'low' // Use low detail for faster processing
            }
          }))
        ]
      }
    ];

    // Wrap with Promise.race for 2-minute timeout
    const analysis = await Promise.race([
      openai.chat.completions.create({
        model: 'gpt-4o',
        messages: messages,
        max_tokens: 1500,
        response_format: { type: 'json_object' }
      }).then(response => {
        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('OpenAI Vision API returned empty content');
        }
        return JSON.parse(content);
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Vision API timeout after 2 minutes')), 120000)
      )
    ]).catch(error => {
      console.error('[analyzeFramesWithVision] Vision API timed out or failed:', error);
      // Return fallback analysis with basic scene detection
      return {
        scenes: [{ startTime: 0, endTime: 10, description: "Analysis timed out", keyElements: [] }],
        dominantColors: ['neutral'],
        visualStyle: 'standard'
      };
    });

    // Basic validation of the response structure
    if (!analysis.scenes || !Array.isArray(analysis.scenes)) {
      analysis.scenes = []; // Ensure scenes is always an array
    }
    if (!analysis.dominantColors || !Array.isArray(analysis.dominantColors)) {
      analysis.dominantColors = ['neutral']; // Default color
    }
    if (!analysis.visualStyle) {
      analysis.visualStyle = 'standard'; // Default style
    }

    // Cleanup frames after analysis
    for (const framePath of sampledFramePaths) {
      try {
        if (fs.existsSync(framePath)) {
          fs.unlinkSync(framePath);
        }
      } catch (err) {
        console.warn(`[AIAnalyzer] Failed to clean up analyzed frame: ${framePath}`, err);
      }
    }

    return {
      scenes: analysis.scenes,
      dominantColors: analysis.dominantColors,
      visualStyle: analysis.visualStyle,
    };
  }

  /**
   * Transcribes audio using OpenAI Whisper API.
   */
  private static async transcribeAudio(audioPath: string): Promise<SpeechSegment[]> {
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: "whisper-1",
      response_format: "verbose_json", // Get timestamps
      timestamp_granularities: ["segment"],
    });

    // Convert Whisper's response format to our SpeechSegment interface
    const segments: SpeechSegment[] = transcription.segments.map(segment => ({
      start: segment.start,
      end: segment.end,
      text: segment.text.trim(),
    }));

    return segments;
  }

  /**
   * Detects semantic structure in content (verses, choruses, bridges, sections, etc.)
   * Uses speech patterns, repetition, and GPT analysis to identify meaningful segments.
   */
  private static async detectSemanticStructure(
    speechSegments: SpeechSegment[],
    videoDuration: number
  ): Promise<SemanticSegment[]> {
    if (speechSegments.length === 0) {
      // No speech detected - use time-based sections
      return this.createTimedSections(videoDuration);
    }

    const fullText = speechSegments.map(s => s.text).join(" ");
    const structurePrompt = `Analyze this content and identify semantic structure (verses, choruses, bridges, sections, etc.).
For music: Detect verses, choruses, bridges, pre-chorus, intro, outro, breakdowns, hooks.
For speech: Detect intro, main points, supporting details, conclusion.
For other: Identify natural breaks, topic changes, sections.

Content:
"${fullText.substring(0, 2000)}"

Return JSON array of segments with: startTime (seconds), endTime (seconds), type (verse|chorus|bridge|intro|outro|breakdown|hook|section|speech|pre-chorus), description, importance (0-100).
Focus on natural content breaks that would work well as clips.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: structurePrompt
          }
        ],
        max_tokens: 1000,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(content);
      const segments: SemanticSegment[] = (parsed.segments || parsed || [])
        .filter((s: any) => s.startTime !== undefined && s.endTime !== undefined)
        .map((s: any) => ({
          startTime: Math.max(0, s.startTime),
          endTime: Math.min(videoDuration, s.endTime),
          type: s.type || "section",
          description: s.description || "Content segment",
          importance: Math.min(100, Math.max(0, s.importance || 70))
        }))
        .filter((s: SemanticSegment) => (s.endTime - s.startTime) >= 0.5); // Min 0.5s

      return segments.length > 0 ? segments : this.createTimedSections(videoDuration);
    } catch (error) {
      console.warn("[AIAnalyzer] Structure detection failed, using timed sections:", error);
      return this.createTimedSections(videoDuration);
    }
  }

  /**
   * Creates basic time-based sections as fallback.
   * V6.1 FIX: Creates shorter clips (5-10s) that can be selected to fit target duration.
   */
  private static createTimedSections(duration: number): SemanticSegment[] {
    const sections: SemanticSegment[] = [];

    // Create shorter clips (5-8 seconds each) for better selection and trimming
    // This ensures clips are small enough to fit within any target duration (30s, 60s, etc.)
    const targetClipDuration = duration > 120 ? 8 : duration > 60 ? 6 : 5; // Shorter clips for shorter videos
    const sliceCount = Math.max(5, Math.min(30, Math.ceil(duration / targetClipDuration))); // 5-30 slices
    const actualClipDuration = duration / sliceCount;

    console.log(`[createTimedSections] Creating ${sliceCount} clips of ~${actualClipDuration.toFixed(1)}s each for ${duration}s video`);

    for (let i = 0; i < sliceCount; i++) {
      const startTime = i * actualClipDuration;
      const endTime = Math.min(duration, (i + 1) * actualClipDuration);

      // Vary importance based on position (hook/intro and outro get higher scores)
      const position = i / sliceCount;
      let importance = 70;
      if (position < 0.15) importance = 85; // Hook/intro - first 15%
      else if (position > 0.85) importance = 80; // Outro - last 15%
      else if (position > 0.4 && position < 0.6) importance = 75; // Middle peak

      // Add some randomness to create variety in selection
      importance += Math.floor(Math.random() * 10) - 5;
      importance = Math.max(60, Math.min(95, importance));

      sections.push({
        startTime: Math.round(startTime * 100) / 100, // Round to 2 decimal places
        endTime: Math.round(endTime * 100) / 100,
        type: i === 0 ? "intro" : i === sliceCount - 1 ? "outro" : "section",
        description: `Content section ${i + 1}`,
        importance
      });
    }

    return sections;
  }

  /**
   * Creates slices from semantic structure (verses, choruses, bridges, sections, etc.)
   * This is the primary method for V6.0 - creates clips based on content meaning, not just scenes.
   */
  private static createSlicesFromSemanticStructure(
    semanticSegments: SemanticSegment[]
  ): Omit<InsertSmartSlice, "projectId" | "id" | "thumbnailPath">[] {
    const slices: Omit<InsertSmartSlice, "projectId" | "id" | "thumbnailPath">[] = [];

    for (const segment of semanticSegments) {
      slices.push({
        startTime: segment.startTime,
        endTime: segment.endTime,
        transcription: segment.description, // Use semantic description as initial transcription
        engagementScore: segment.importance, // Use semantic importance as initial engagement score
        clipType: segment.type, // Use semantic type (verse, chorus, bridge, etc.)
      });
    }

    return slices;
  }

  /**
   * Creates initial slice objects based on detected scenes.
   * Kept for backward compatibility but not used in V6.0 which uses semantic structure.
   */
  private static createSlicesFromScenes(
    scenes: Array<{ startTime: number; endTime: number; description: string; keyElements: string[] }>,
    totalDuration: number
  ): Omit<InsertSmartSlice, "projectId" | "id" | "thumbnailPath">[] {
    const slices: Omit<InsertSmartSlice, "projectId" | "id" | "thumbnailPath">[] = [];

    for (const scene of scenes) {
      // Ensure scenes do not overlap and are within video duration
      const startTime = Math.max(0, scene.startTime);
      const endTime = Math.min(totalDuration, scene.endTime);

      // Ignore scenes that are too short or invalid
      if (endTime - startTime < 0.5) continue;

      slices.push({
        startTime: startTime,
        endTime: endTime,
        transcription: scene.description, // Use scene description as initial transcription
        engagementScore: 70, // Default score, will be refined later
        clipType: "scene", // Default type, will be refined later
      });
    }

    // Merge overlapping or very short slices
    const mergedSlices = this.mergeSlices(slices);

    return mergedSlices;
  }

  /**
   * Merges overlapping or adjacent slices to create more meaningful segments.
   */
  private mergeSlices(
    slices: Array<Omit<InsertSmartSlice, "projectId" | "id" | "thumbnailPath">>
  ): Array<Omit<InsertSmartSlice, "projectId" | "id" | "thumbnailPath">> {
    if (slices.length <= 1) {
      return slices;
    }

    // Sort slices by start time
    slices.sort((a, b) => a.startTime - b.startTime);

    const merged: Array<Omit<InsertSmartSlice, "projectId" | "id" | "thumbnailPath">> = [];
    let currentSlice = { ...slices[0] };

    for (let i = 1; i < slices.length; i++) {
      const nextSlice = slices[i];

      // If slices overlap or are adjacent, merge them
      if (nextSlice.startTime <= currentSlice.endTime + 0.5) { // Allow small gap merging
        currentSlice.endTime = Math.max(currentSlice.endTime, nextSlice.endTime);
        // Append descriptions and key elements if available (optional)
        currentSlice.transcription += ` | ${nextSlice.transcription}`;
        currentSlice.engagementScore = Math.max(currentSlice.engagementScore, nextSlice.engagementScore); // Take max engagement
      } else {
        // No overlap, push the current merged slice and start a new one
        merged.push(currentSlice);
        currentSlice = { ...nextSlice };
      }
    }
    merged.push(currentSlice); // Push the last merged slice

    return merged;
  }

  /**
   * Scores engagement for each slice based on vision analysis and speech segments.
   */
  private static async scoreEngagement(
    slices: Omit<InsertSmartSlice, "projectId" | "id" | "thumbnailPath">[],
    visionAnalysis: {
      scenes: Array<{ startTime: number; endTime: number; description: string; keyElements: string[] }>;
      dominantColors: string[];
      visualStyle: string;
    },
    speechSegments: SpeechSegment[]
  ): Promise<InsertSmartSlice[]> {
    const scoredSlices: InsertSmartSlice[] = [];
    const totalDuration = visionAnalysis.scenes[visionAnalysis.scenes.length - 1]?.endTime || 0; // Approximate total duration

    for (const slice of slices) {
      let engagementScore = slice.engagementScore ?? 70; // Start with existing score or default

      // --- Refine score based on Vision Analysis ---
      const relevantVisionScene = visionAnalysis.scenes.find(
        s => s.startTime <= slice.endTime && s.endTime >= slice.startTime
      );

      if (relevantVisionScene) {
        // Bonus for interesting descriptions/key elements
        const descriptionScore = this.scoreTextForEngagement(relevantVisionScene.description || "");
        engagementScore += descriptionScore * 0.2; // Weight description analysis

        const elementsScore = relevantVisionScene.keyElements.length * 5; // Bonus for more key elements
        engagementScore += elementsScore * 0.1; // Weight key elements analysis
      }

      // Consider dominant colors and visual style
      engagementScore += this.scoreColorsAndStyle(visionAnalysis.dominantColors, visionAnalysis.visualStyle);

      // --- Refine score based on Speech Analysis ---
      const relevantSpeech = speechSegments.filter(
        s => s.start < slice.endTime && s.end > slice.startTime
      );

      if (relevantSpeech.length > 0) {
        const speechText = relevantSpeech.map(s => s.text).join(" ");
        const speechScore = this.scoreTextForEngagement(speechText);
        engagementScore += speechScore * 0.3; // Weight speech analysis

        // Bonus for longer speech segments (more informative content)
        const totalSpeechDuration = relevantSpeech.reduce((sum, s) => sum + (s.end - s.start), 0);
        engagementScore += Math.min(totalSpeechDuration / 5, 15); // Max 15 points bonus
      }

      // --- Final adjustments ---
      // Clip type influencing score (e.g., "action" might be higher than "broll")
      // This could be a mapping: engagementScore += clipTypeBonus[slice.clipType]

      // Clamp the score between 0 and 100
      engagementScore = Math.max(0, Math.min(100, engagementScore));

      // Assign a clip type based on content (simplified for now)
      let clipType = "general";
      if (relevantSpeech && relevantSpeech.length > 0 && relevantVisionScene?.keyElements.includes("action")) {
        clipType = "action";
      } else if (relevantSpeech && relevantSpeech.length > 0) {
        clipType = "speech";
      } else if (visionAnalysis.visualStyle === "cinematic") {
        clipType = "cinematic";
      }

      scoredSlices.push({
        projectId: "temp-project-id", // Placeholder
        id: nanoid(), // Generate a unique ID
        startTime: slice.startTime,
        endTime: slice.endTime,
        transcription: slice.transcription,
        engagementScore: Math.round(engagementScore),
        thumbnailPath: null, // To be generated later
        clipType: clipType,
      });
    }

    return scoredSlices;
  }

  /**
   * Scores text content for engagement potential.
   * Higher score for more dynamic, descriptive, or emotionally charged language.
   */
  private static scoreTextForEngagement(text: string): number {
    let score = 0;
    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);

    // Bonus for keywords related to action, emotion, questions
    const engagingKeywords = ["exciting", "amazing", "wow", "discover", "learn", "secret", "challenge", "problem", "solution", "question", "how", "why", "what if", "powerful", "intense", "beautiful", "stunning", "incredible"];
    for (const word of words) {
      if (engagingKeywords.includes(word)) {
        score += 5;
      }
    }

    // Bonus for sentence length variation (more dynamic)
    const sentences = text.split(/[.!?]/).filter(s => s.trim().length > 0);
    if (sentences.length > 1) {
      const lengths = sentences.map(s => s.split(/\s+/).length);
      const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
      const variance = lengths.reduce((a, b) => a + Math.abs(b - avgLength), 0) / lengths.length;
      score += Math.min(variance * 0.5, 10); // Max 10 points for variance
    }

    return Math.min(score, 30); // Cap score
  }

  /**
   * Detects beat timestamps in audio for rhythm-aware editing using FFmpeg energy analysis
   */
  private static async detectBeats(audioPath: string): Promise<number[]> {
    const beats: number[] = [];

    return new Promise((resolve, reject) => {
      // Use FFmpeg's astats filter to detect energy peaks (beats)
      let currentTime = 0;
      let lastPeak = 0;
      const minBeatInterval = 0.3; // Minimum 300ms between beats

      ffmpeg(audioPath)
        .audioFilters('astats=metadata=1:reset=1')
        .format('null')
        .on('stderr', (line: string) => {
          // Parse RMS level changes to detect beats
          const timeMatch = line.match(/time=(\d+):(\d+):(\d+\.\d+)/);
          const rmsMatch = line.match(/RMS level dB: ([-\d.]+)/);

          if (timeMatch && rmsMatch) {
            const hours = parseInt(timeMatch[1]);
            const minutes = parseInt(timeMatch[2]);
            const seconds = parseFloat(timeMatch[3]);
            currentTime = hours * 3600 + minutes * 60 + seconds;
            const rmsLevel = parseFloat(rmsMatch[1]);

            // Detect energy spike (beat) - threshold at -20dB
            if (rmsLevel > -20 && currentTime - lastPeak > minBeatInterval) {
              beats.push(currentTime);
              lastPeak = currentTime;
            }
          }
        })
        .on('end', () => {
          console.log(`[detectBeats] Found ${beats.length} beat timestamps`);
          resolve(beats);
        })
        .on('error', (err) => {
          console.warn('[detectBeats] FFmpeg error, using fallback BPM grid:', err.message);
          // Fallback: 120 BPM grid
          const fallbackBeats: number[] = [];
          for (let t = 0; t < 300; t += 0.5) {
            fallbackBeats.push(t);
          }
          resolve(fallbackBeats);
        })
        .save('-');
    });
  }

  /**
   * Aligns clip timestamps to nearest beat for punchy editing
   */
  private static alignToBeats(timestamp: number, beats: number[]): number {
    if (beats.length === 0) return timestamp;

    // Find nearest beat
    let nearestBeat = beats[0];
    let minDiff = Math.abs(timestamp - nearestBeat);

    for (const beat of beats) {
      const diff = Math.abs(timestamp - beat);
      if (diff < minDiff) {
        minDiff = diff;
        nearestBeat = beat;
      }
    }

    // Only snap if within 0.3s of a beat (preserve natural cuts otherwise)
    return minDiff < 0.3 ? nearestBeat : timestamp;
  }

  /**
   * Apply beat-aware alignment to slice boundaries for rhythmic cutting
   */
  static async applyBeatSync(
    slices: Array<{ id: string; startTime: number; endTime: number }>,
    audioPath: string
  ): Promise<Array<{ id: string; startTime: number; endTime: number }>> {
    console.log('[applyBeatSync] Detecting beats for rhythm-aware cutting...');
    const beats = await this.detectBeats(audioPath);

    const syncedSlices = slices.map(slice => ({
      ...slice,
      startTime: this.alignToBeats(slice.startTime, beats),
      endTime: this.alignToBeats(slice.endTime, beats)
    }));

    console.log('[applyBeatSync] Aligned clips to musical beats');
    return syncedSlices;
  }

  /**
   * Determines the best video type and duration based on content analysis
   * Used when user selects "Let AI Decide"
   */
  static async determineBestVideoTypeAndDuration(
    slices: Array<{ id: string; startTime: number; endTime: number; engagementScore?: number | null; narrativeRole?: string }>,
    videoCategory: string,
    totalDuration: number
  ): Promise<{ bestVideoType: string; targetDuration: number; clipSequence: string[] }> {
    console.log(`[determineBestVideoTypeAndDuration] Analyzing ${slices.length} slices for category: ${videoCategory}`);

    // Calculate average engagement
    const avgEngagement = slices.reduce((sum, s) => sum + (s.engagementScore || 70), 0) / slices.length;
    console.log(`[determineBestVideoTypeAndDuration] Average engagement: ${avgEngagement.toFixed(1)}`);

    // Sort slices by engagement score (highest first)
    const sortedSlices = [...slices].sort((a, b) => (b.engagementScore || 70) - (a.engagementScore || 70));

    // Determine best video type based on total duration and category
    let bestVideoType: string;
    let targetDuration: number;
    let clipCount: number;

    // Decision logic based on total duration and category
    if (totalDuration <= 30) {
      // Very short source: create a SHORT
      bestVideoType = "short";
      targetDuration = Math.min(totalDuration, 15);
      clipCount = Math.min(3, slices.length);
    } else if (totalDuration <= 90) {
      // Medium source: create a STANDARD video
      bestVideoType = "standard";
      targetDuration = Math.min(totalDuration * 0.6, 45);
      clipCount = Math.min(5, slices.length);
    } else if (totalDuration <= 180) {
      // Longer source: pick based on engagement
      if (avgEngagement >= 75) {
        bestVideoType = "standard";
        targetDuration = 60;
        clipCount = Math.min(6, slices.length);
      } else {
        bestVideoType = "short";
        targetDuration = 30;
        clipCount = Math.min(4, slices.length);
      }
    } else {
      // Very long source: comprehensive edit or multiple shorts
      if (videoCategory === "tutorial" || videoCategory === "documentary") {
        bestVideoType = "comprehensive";
        targetDuration = Math.min(totalDuration * 0.5, 120);
        clipCount = Math.min(8, slices.length);
      } else {
        bestVideoType = "standard";
        targetDuration = 60;
        clipCount = Math.min(6, slices.length);
      }
    }

    // Adjust based on video category
    switch (videoCategory) {
      case "sports":
      case "action":
        // Sports/action: prefer shorter, punchier edits
        if (bestVideoType === "comprehensive") {
          bestVideoType = "standard";
          targetDuration = Math.min(targetDuration, 60);
        }
        break;
      case "music":
        // Music: match common music video lengths
        targetDuration = Math.min(targetDuration, 90);
        break;
      case "vlog":
      case "lifestyle":
        // Vlogs: keep engaging highlights
        targetDuration = Math.min(targetDuration, 60);
        break;
    }

    // Select top clips by engagement, ensuring we meet target duration
    let selectedSlices: typeof slices = [];
    let accumulatedDuration = 0;

    for (const slice of sortedSlices) {
      const sliceDuration = slice.endTime - slice.startTime;
      if (accumulatedDuration + sliceDuration <= targetDuration * 1.2 && selectedSlices.length < clipCount) {
        selectedSlices.push(slice);
        accumulatedDuration += sliceDuration;
      }
      if (accumulatedDuration >= targetDuration) break;
    }

    // Ensure at least 2-3 clips are selected
    if (selectedSlices.length < 2 && slices.length >= 2) {
      selectedSlices = sortedSlices.slice(0, Math.min(3, slices.length));
    }

    // Sort selected clips by their original time order for natural flow
    selectedSlices.sort((a, b) => a.startTime - b.startTime);

    const clipSequence = selectedSlices.map(s => s.id);
    const actualDuration = selectedSlices.reduce((sum, s) => sum + (s.endTime - s.startTime), 0);

    console.log(`[determineBestVideoTypeAndDuration] Decision: ${bestVideoType} video, ${actualDuration.toFixed(1)}s from ${clipSequence.length} clips`);

    return {
      bestVideoType,
      targetDuration: Math.round(actualDuration),
      clipSequence
    };
  }

  /**
   * Scores engagement based on dominant colors and visual style.
   */
  private static scoreColorsAndStyle(colors: string[], style: string): number {
    let score = 0;

    // Bonus for vibrant or contrasting colors
    const vibrantColors = ["red", "orange", "yellow", "vibrant blue", "hot pink"];
    for (const color of colors) {
      if (vibrantColors.some(vc => color.toLowerCase().includes(vc))) {
        score += 5;
      }
    }

    // Bonus for specific visual styles often associated with high engagement
    if (style === "cinematic" || style === "action" || style === "dynamic") {
      score += 10;
    } else if (style === "documentary" || style === "corporate") {
      score -= 5; // Slightly lower for less dynamic styles
    }

    return Math.min(score, 20); // Cap score
  }

  /**
   * V6.3: PROPORTIONAL NARRATIVE SAMPLING for music videos
   * Preserves chronological order (intro → verse → chorus → outro) while compressing to target duration.
   * Each section gets time proportional to its duration and importance.
   */
  static selectClipsProportionalNarrative(
    slices: Array<{ id: string; startTime: number; endTime: number; engagementScore?: number | null; clipType?: string | null }>,
    semanticStructure: SemanticSegment[],
    targetDuration: number,
    videoDuration: number
  ): string[] {
    console.log(`\n[ProportionalNarrative] 🎵 Starting narrative-preserving selection`);
    console.log(`[ProportionalNarrative] Target: ${targetDuration}s from ${videoDuration}s source`);
    console.log(`[ProportionalNarrative] Sections: ${semanticStructure.length}, Slices: ${slices.length}`);

    const MIN_CLIP_DURATION = 0.9;
    const MAX_CLIP_DURATION = 6.0;
    const MUSIC_SECTION_TYPES = ["intro", "verse", "pre-chorus", "chorus", "bridge", "breakdown", "hook", "outro", "section"];

    // Step 1: Filter and sort sections by start time (chronological order)
    const orderedSections = semanticStructure
      .filter(s => MUSIC_SECTION_TYPES.includes(s.type))
      .sort((a, b) => a.startTime - b.startTime);

    if (orderedSections.length === 0) {
      console.log(`[ProportionalNarrative] No music sections found, falling back to time-based sampling`);
      return this.selectClipsChronological(slices, targetDuration, videoDuration);
    }

    console.log(`[ProportionalNarrative] Ordered sections:`);
    orderedSections.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.type}: ${s.startTime.toFixed(1)}s - ${s.endTime.toFixed(1)}s (importance: ${s.importance})`);
    });

    // Step 2: Calculate weights for each section (duration * 0.6 + importance * 0.4)
    const sectionWeights = orderedSections.map(section => {
      const sectionDuration = section.endTime - section.startTime;
      const durationWeight = sectionDuration / videoDuration;
      const importanceWeight = section.importance / 100;

      // Boost choruses and hooks (+20%), reduce intros/outros slightly
      let typeMultiplier = 1.0;
      if (section.type === "chorus" || section.type === "hook") {
        typeMultiplier = 1.2;
      } else if (section.type === "intro") {
        typeMultiplier = 0.9;
      } else if (section.type === "outro") {
        typeMultiplier = 0.85;
      }

      return {
        section,
        rawWeight: (durationWeight * 0.6 + importanceWeight * 0.4) * typeMultiplier
      };
    });

    // Normalize weights to sum to 1
    const totalWeight = sectionWeights.reduce((sum, sw) => sum + sw.rawWeight, 0);
    const normalizedSections = sectionWeights.map(sw => ({
      ...sw,
      weight: sw.rawWeight / totalWeight,
      budget: (sw.rawWeight / totalWeight) * targetDuration
    }));

    console.log(`[ProportionalNarrative] Section budgets:`);
    normalizedSections.forEach(ns => {
      console.log(`  ${ns.section.type}: ${ns.budget.toFixed(1)}s (${(ns.weight * 100).toFixed(1)}%)`);
    });

    // Step 3: Select clips for each section chronologically
    const selectedClips: Array<{ id: string; startTime: number; endTime: number; sectionType: string }> = [];
    let totalUsed = 0;

    for (const { section, budget } of normalizedSections) {
      // Find slices whose midpoint falls within this section
      const sectionSlices = slices.filter(slice => {
        const midpoint = (slice.startTime + slice.endTime) / 2;
        return midpoint >= section.startTime && midpoint <= section.endTime;
      });

      if (sectionSlices.length === 0) {
        console.log(`[ProportionalNarrative] No slices for ${section.type}, skipping`);
        continue;
      }

      // Sort by engagement (descending) then by startTime (ascending) for stability
      const rankedSlices = [...sectionSlices].sort((a, b) => {
        const engageDiff = (b.engagementScore || 0) - (a.engagementScore || 0);
        return engageDiff !== 0 ? engageDiff : a.startTime - b.startTime;
      });

      // Select clips until budget is filled, maintaining chronological order
      let sectionUsed = 0;
      const sectionSelected: typeof rankedSlices = [];

      for (const slice of rankedSlices) {
        const clipDuration = Math.min(
          Math.max(slice.endTime - slice.startTime, MIN_CLIP_DURATION),
          MAX_CLIP_DURATION
        );

        // Allow slight overage (10%) to ensure we get meaningful content
        if (sectionUsed + clipDuration <= budget * 1.1) {
          sectionSelected.push(slice);
          sectionUsed += clipDuration;
        }

        // Stop if we've exceeded budget
        if (sectionUsed >= budget) break;
      }

      // Sort selected clips by startTime (chronological within section)
      sectionSelected.sort((a, b) => a.startTime - b.startTime);

      // Add to final selection
      for (const clip of sectionSelected) {
        selectedClips.push({
          id: clip.id,
          startTime: clip.startTime,
          endTime: clip.endTime,
          sectionType: section.type
        });
        totalUsed += Math.min(
          Math.max(clip.endTime - clip.startTime, MIN_CLIP_DURATION),
          MAX_CLIP_DURATION
        );
      }

      console.log(`[ProportionalNarrative] ${section.type}: selected ${sectionSelected.length} clips, ${sectionUsed.toFixed(1)}s / ${budget.toFixed(1)}s budget`);
    }

    // Step 4: Final chronological sort (sections already ordered, clips within sections ordered)
    selectedClips.sort((a, b) => a.startTime - b.startTime);

    // Step 5: Handle under/over target
    if (totalUsed < targetDuration * 0.85) {
      console.log(`[ProportionalNarrative] Under target (${totalUsed.toFixed(1)}s < ${targetDuration}s), adding more clips...`);
      // Add highest-engagement unused clips chronologically
      const usedIds = new Set(selectedClips.map(c => c.id));
      const unused = slices
        .filter(s => !usedIds.has(s.id))
        .sort((a, b) => (b.engagementScore || 0) - (a.engagementScore || 0));

      for (const clip of unused) {
        if (totalUsed >= targetDuration) break;
        const clipDuration = Math.min(
          Math.max(clip.endTime - clip.startTime, MIN_CLIP_DURATION),
          MAX_CLIP_DURATION
        );
        selectedClips.push({
          id: clip.id,
          startTime: clip.startTime,
          endTime: clip.endTime,
          sectionType: "filler"
        });
        totalUsed += clipDuration;
      }
      // Re-sort chronologically after adding
      selectedClips.sort((a, b) => a.startTime - b.startTime);
    }

    console.log(`[ProportionalNarrative] ✅ Final selection: ${selectedClips.length} clips, ${totalUsed.toFixed(1)}s total`);
    console.log(`[ProportionalNarrative] Order: ${selectedClips.map(c => c.sectionType).join(" → ")}`);

    return selectedClips.map(c => c.id);
  }

  /**
   * Fallback: Select clips in chronological order when no semantic structure available
   */
  private static selectClipsChronological(
    slices: Array<{ id: string; startTime: number; endTime: number; engagementScore?: number | null }>,
    targetDuration: number,
    videoDuration: number
  ): string[] {
    const MIN_CLIP_DURATION = 0.9;
    const MAX_CLIP_DURATION = 6.0;

    // Calculate how many evenly-spaced samples we need
    const numSamples = Math.ceil(targetDuration / 3); // ~3s per sample on average
    const sampleInterval = videoDuration / numSamples;

    const selectedClips: string[] = [];
    let totalUsed = 0;

    // Take best clip from each time region
    for (let i = 0; i < numSamples && totalUsed < targetDuration; i++) {
      const regionStart = i * sampleInterval;
      const regionEnd = (i + 1) * sampleInterval;

      // Find slices in this region
      const regionSlices = slices.filter(s => {
        const midpoint = (s.startTime + s.endTime) / 2;
        return midpoint >= regionStart && midpoint < regionEnd;
      });

      if (regionSlices.length > 0) {
        // Pick highest engagement in region
        const best = regionSlices.reduce((a, b) =>
          (b.engagementScore || 0) > (a.engagementScore || 0) ? b : a
        );

        const clipDuration = Math.min(
          Math.max(best.endTime - best.startTime, MIN_CLIP_DURATION),
          MAX_CLIP_DURATION
        );

        if (totalUsed + clipDuration <= targetDuration * 1.1) {
          selectedClips.push(best.id);
          totalUsed += clipDuration;
        }
      }
    }

    console.log(`[ChronologicalFallback] Selected ${selectedClips.length} clips, ${totalUsed.toFixed(1)}s`);
    return selectedClips;
  }

  // Helper to get adjustments based on video context
  private static getContextAdjustments(videoContext?: string): {
    energyModifier: number;
    minEngagementModifier: number;
    preferredClipTypes: string[];
  } {
    let energyModifier = 0;
    let minEngagementModifier = 0;
    let preferredClipTypes: string[] = [];

    switch (videoContext) {
      case "hype":
        energyModifier = 5;
        minEngagementModifier = 5;
        preferredClipTypes = ["action", "hook", "chorus"];
        break;
      case "tutorial":
        energyModifier = -5;
        minEngagementModifier = -10;
        preferredClipTypes = ["explanation", "demonstration", "summary"];
        break;
      case "trailer":
        energyModifier = 10;
        minEngagementModifier = 10;
        preferredClipTypes = ["action", "hook", "climax", "peak"];
        break;
      case "vlog":
        preferredClipTypes = ["talking_head", "broll", "personal_moment"];
        break;
      default:
        // Default or fallback
        preferredClipTypes = ["hook", "chorus", "verse", "talking_head", "broll"];
        break;
    }

    return { energyModifier, minEngagementModifier, preferredClipTypes };
  }

  /**
   * Calculate optimal clip duration based on engagement score and context.
   * V6.1: Smart duration scaling for better pacing.
   * V6.3/V6.4: Accepts effective duration preferences (merged from learned + format strategy).
   */
  static calculateOptimalClipDuration(
    engagementScore: number | null | undefined,
    context: string | undefined,
    videoType: "short" | "standard" | "comprehensive",
    durationPrefs?: { min: number; max: number; target: number } | null
  ): { minDuration: number; maxDuration: number } {
    // V6.4: Use effective preferences (from learned weights or format strategy), otherwise use defaults
    const MIN_CLIP_DURATION = durationPrefs?.min ?? 0.75; // Industry standard minimum for viewer comprehension
    const MAX_CLIP_DURATION_STANDARD = durationPrefs?.max ?? 8.0; // Max duration for standard clips
    const MAX_CLIP_DURATION_SHORT = durationPrefs?.max ?? 4.0; // Max duration for short clips

    // V6.4: Use effective target duration as base if available
    let baseDuration = durationPrefs?.target ?? 2.0; // Default duration

    // Adjust base duration for context (only if no preference provided)
    if (!durationPrefs) {
      if (context === "hype" || context === "trailer") {
        baseDuration = 1.5;
      } else if (context === "tutorial" || context === "talking_head") {
        baseDuration = 3.0;
      }
    }

    const engagementMultiplier = (engagementScore ?? 70) / 100;
    let calculatedDuration = baseDuration * (0.7 + engagementMultiplier * 0.6);

    // Ensure minimum duration
    calculatedDuration = Math.max(MIN_CLIP_DURATION, calculatedDuration);

    // Determine max duration based on video type and context
    let maxDuration;
    if (videoType === "short" || context === "hype" || context === "trailer") {
      maxDuration = Math.min(MAX_CLIP_DURATION_SHORT, calculatedDuration * 1.5);
    } else {
      maxDuration = Math.min(MAX_CLIP_DURATION_STANDARD, calculatedDuration * 1.8);
    }

    // Ensure max duration is at least min duration
    maxDuration = Math.max(MIN_CLIP_DURATION, maxDuration);

    return {
      minDuration: MIN_CLIP_DURATION,
      maxDuration: maxDuration
    };
  }

  /**
   * Selects slices based on an energy curve, min engagement, and preferred types.
   * This is the core logic for choosing the best clips for a video.
   * V6.3: Enhanced with optional clipIndex/totalClips for multi-clip diversity.
   * V6.3: Integrates FeedbackLearningService for adaptive clip selection.
   */
  static async selectClipsForVideo(
    slices: Array<{ id: string; startTime: number; endTime: number; engagementScore?: number | null; clipType?: string | null }>,
    targetDuration: number,
    videoType: "short" | "standard" | "comprehensive",
    videoContext?: string, // V6.0: Context for purpose-driven clip selection
    videoDuration?: number, // Total source video duration
    requestedClipDuration?: number, // User-requested clip duration for multiple clips intent
    clipIndex?: number, // V6.3: Index of current clip in multi-clip generation
    totalClips?: number, // V6.3: Total number of clips being generated
    videoCategory?: string // V6.3: Video category for feedback-based learning
  ): Promise<string[]> {
    // V6.3: Detect music/narrative content and use proportional narrative sampling
    const MUSIC_CLIP_TYPES = ["intro", "verse", "pre-chorus", "chorus", "bridge", "breakdown", "hook", "outro"];
    const musicClipsCount = slices.filter(s =>
      s.clipType && MUSIC_CLIP_TYPES.includes(s.clipType.toLowerCase())
    ).length;
    const isMusicContent = musicClipsCount >= slices.length * 0.5; // At least 50% are music sections

    // Calculate actual video duration from slices if not provided
    const actualVideoDuration = videoDuration || (slices.length > 0
      ? Math.max(...slices.map(s => s.endTime))
      : 60);

    // Use proportional narrative sampling for music content
    if (isMusicContent && slices.length >= 3) {
      console.log(`[selectClipsForVideo] 🎵 Detected music content (${musicClipsCount}/${slices.length} music clips)`);
      console.log(`[selectClipsForVideo] Using PROPORTIONAL NARRATIVE SAMPLING to preserve song structure`);

      // Reconstruct semantic structure from slices
      const semanticStructure: SemanticSegment[] = slices
        .filter(s => s.clipType && MUSIC_CLIP_TYPES.includes(s.clipType.toLowerCase()))
        .map(s => ({
          startTime: s.startTime,
          endTime: s.endTime,
          type: s.clipType!.toLowerCase() as SemanticSegment["type"],
          description: `${s.clipType} section`,
          importance: s.engagementScore || 70
        }));

      return this.selectClipsProportionalNarrative(
        slices,
        semanticStructure,
        targetDuration,
        actualVideoDuration
      );
    }

    console.log(`[selectClipsForVideo] Using standard engagement-based selection (music clips: ${musicClipsCount}/${slices.length})`);

    // V6.4: Get format-specific editing strategy for this content type
    const category = videoCategory || "generic";
    const formatStrategy = this.getFormatStrategy(category);
    console.log(`[selectClipsForVideo] 🎬 Format strategy: ${formatStrategy.name}`);
    console.log(`[selectClipsForVideo] Strategy behaviors: ${formatStrategy.specialBehaviors.join(", ") || "standard"}`);

    // V6.3: Fetch learned weights for adaptive clip selection
    let learnedEngagementMultiplier = 1.0;
    let learnedDurationPrefs: { min: number; max: number; target: number } | null = null;
    let learnedHookPriority = { preferHighEnergy: true, preferSpeech: false, minEngagement: 70 };

    try {
      // Fetch learned weights from feedback history
      const [engagementMult, durationPrefs, hookPriority] = await Promise.all([
        FeedbackLearningService.getEngagementMultiplier(category, null),
        FeedbackLearningService.getPreferredDuration(category, null),
        FeedbackLearningService.getHookPriority(category)
      ]);

      learnedEngagementMultiplier = engagementMult;
      learnedDurationPrefs = durationPrefs;
      learnedHookPriority = hookPriority;

      console.log(`[selectClipsForVideo] 📊 Applied learned weights for "${category}":`, {
        engagementMultiplier: learnedEngagementMultiplier.toFixed(2),
        durationPrefs: learnedDurationPrefs ? `${learnedDurationPrefs.min.toFixed(1)}-${learnedDurationPrefs.max.toFixed(1)}s (target: ${learnedDurationPrefs.target.toFixed(1)}s)` : "none",
        hookPriority: learnedHookPriority
      });
    } catch (error: any) {
      console.log(`[selectClipsForVideo] Using default weights (no learned data): ${error.message}`);
    }

    // V6.4: Merge format strategy with learned preferences (learned takes priority)
    const effectiveDurationPrefs = learnedDurationPrefs || {
      min: formatStrategy.minClipDuration,
      max: formatStrategy.maxClipDuration,
      target: formatStrategy.targetClipDuration
    };
    const effectiveHookPriority = {
      preferHighEnergy: learnedHookPriority.preferHighEnergy || formatStrategy.hookPriority.preferHighEnergy,
      preferSpeech: learnedHookPriority.preferSpeech || formatStrategy.hookPriority.preferSpeech,
      minEngagement: Math.max(learnedHookPriority.minEngagement, formatStrategy.minEngagement)
    };

    // V6.4: Apply learned engagement multiplier AND format-specific scoring to all slices
    const adjustedSlices = slices.map(s => {
      const baseScore = (s.engagementScore ?? 70) * learnedEngagementMultiplier;

      // Apply format-specific scoring
      const formatScoring = this.applyFormatScoring(
        {
          id: s.id,
          engagementScore: baseScore,
          clipType: s.clipType || "",
          startTime: s.startTime || 0,
          endTime: s.endTime || 0,
          transcription: null
        },
        formatStrategy,
        actualVideoDuration
      );

      // Combine base score with format bonuses/penalties
      const adjustedScore = Math.min(100, Math.max(0, baseScore + formatScoring.bonus - formatScoring.penalties));

      if (formatScoring.bonus > 0 || formatScoring.penalties > 0) {
        console.log(`[FormatScoring] Slice ${s.id}: ${baseScore.toFixed(0)} → ${adjustedScore.toFixed(0)} (${formatScoring.reasons.join(", ")})`);
      }

      return {
        ...s,
        engagementScore: adjustedScore,
        formatBonus: formatScoring.bonus,
        formatPenalties: formatScoring.penalties
      };
    });

    const selectedClipIds: string[] = [];
    let currentDuration = 0;

    // Semantic structure types that are always allowed (from AI analysis)
    const semanticTypes = ["intro", "verse", "chorus", "bridge", "pre-chorus", "outro", "breakdown", "hook", "section", "speech", "pause"];

    // V6.0: Apply context-specific adjustments to energy curve and thresholds
    const contextAdjustments = videoContext
      ? this.getContextAdjustments(videoContext)
      : { energyModifier: 0, minEngagementModifier: 0, preferredClipTypes: ["hook", "chorus", "verse", "talking_head", "broll"] };

    // V6.4: Use effective hook priority (merged from learned + format strategy)
    const baseMinEngagement = effectiveHookPriority.minEngagement;

    // V6.4: Use format strategy's energy curve as base (can be overridden by context)
    const formatEnergyCurve = formatStrategy.energyCurve;
    console.log(`[selectClipsForVideo] Using ${formatStrategy.name} energy curve: ${formatEnergyCurve.map(p => `${(p.position*100).toFixed(0)}%:${p.energy}`).join(" → ")}`);

    // SMART CLIP COUNT: Calculate maximum possible clips based on video duration and requested clip duration
    if (videoDuration && requestedClipDuration && videoType === "short") {
      const maxPossibleClips = Math.floor(videoDuration / requestedClipDuration);
      console.log(`[selectClips] Video: ${videoDuration}s, Requested clip duration: ${requestedClipDuration}s`);
      console.log(`[selectClips] Maximum possible clips: ${maxPossibleClips}`);

      if (maxPossibleClips < 3) {
        // Not enough content for multiple clips - adjust targetDuration to use full video
        targetDuration = Math.min(videoDuration, 60); // Cap at 60s for "short" videos
        console.log(`[selectClips] Adjusted target duration to ${targetDuration}s (not enough content for ${requestedClipDuration}s clips)`);
      } else if (maxPossibleClips < 5) {
        // Adjust clip selection to match what's actually possible
        console.log(`[selectClips] Will select up to ${maxPossibleClips} clips instead of default 5`);
      }
    }

    if (videoType === "short") {
      // TRAILER OPTIMIZATION: Detect non-speech high-energy content
      const isTrailer = videoContext === "hype" ||
                       adjustedSlices.every(s => !s.clipType?.includes("talking_head") && !s.clipType?.includes("speech"));

      if (isTrailer) {
        // V6.4: Use format strategy for trailers (aggressive pacing)
        const trailerStrategy = FORMAT_STRATEGIES.trailer;
        const baseOffset = clipIndex !== undefined && totalClips ? (clipIndex / totalClips) * 20 : 0;

        // V6.4: Use format strategy's energy curve with offset
        const hookEnergyBoost = effectiveHookPriority.preferHighEnergy ? 5 : 0;
        const energyCurve = trailerStrategy.energyCurve.map(p => ({
          position: p.position,
          energy: Math.min(100, p.energy + baseOffset + (p.position === 0 ? hookEnergyBoost : 0))
        }));

        // V6.4: Use format strategy's preferred types
        const preferredTypes = trailerStrategy.preferredClipTypes;

        // V6.4: Use effective duration preferences (merged from learned + format strategy)
        const MIN_CLIP_DURATION = effectiveDurationPrefs.min;

        // V6.4: Use adjusted slices with format-specific scoring applied
        let candidates = adjustedSlices.filter(
          (s) => (s.engagementScore ?? 0) >= effectiveHookPriority.minEngagement && (s.endTime - s.startTime) >= MIN_CLIP_DURATION
        );

        if (candidates.length === 0) {
          console.warn(
            `[selectClipsForVideo] No slices above engagement ${effectiveHookPriority.minEngagement} with min duration ${MIN_CLIP_DURATION}s, lowering threshold`
          );
          candidates = adjustedSlices.filter(
            (s) => (s.engagementScore ?? 0) >= 70 && (s.endTime - s.startTime) >= MIN_CLIP_DURATION
          );
        }

        // V6.4: Apply smart duration scaling with effective preferences
        console.log(`[selectClipsForVideo] Applying engagement-based duration scaling to ${candidates.length} candidates`);
        candidates = candidates.map(slice => {
          const currentDuration = slice.endTime - slice.startTime;
          const { minDuration, maxDuration } = this.calculateOptimalClipDuration(
            slice.engagementScore,
            videoContext,
            videoType,
            effectiveDurationPrefs // V6.4: Use effective duration preferences
          );

          // If current duration is too short, extend it (if possible)
          if (currentDuration < minDuration) {
            const extension = minDuration - currentDuration;
            const newEndTime = Math.min(slice.endTime + extension, slice.endTime + 2); // Max 2s extension
            console.log(
              `[Duration] Slice ${slice.id}: ${currentDuration.toFixed(2)}s → ${(newEndTime - slice.startTime).toFixed(2)}s (engagement: ${slice.engagementScore})`
            );
            return { ...slice, endTime: newEndTime };
          }

          // If current duration is too long, trim it
          if (currentDuration > maxDuration) {
            const newEndTime = slice.startTime + maxDuration;
            console.log(
              `[Duration] Slice ${slice.id}: ${currentDuration.toFixed(2)}s → ${maxDuration.toFixed(2)}s (trimmed for pacing)`
            );
            return { ...slice, endTime: newEndTime };
          }

          return slice;
        });

        // Score each slice based on energy curve matching
        const scoredSlices = candidates.map((slice, index) => {
          // Apply diversity offset for multiple clips
          const diversityOffset = clipIndex !== undefined && totalClips ?
            (clipIndex / totalClips) * candidates.length : 0;
          const adjustedIndex = (index + Math.floor(diversityOffset)) % candidates.length;
          const relativePosition = adjustedIndex / Math.max(candidates.length - 1, 1);

          const sliceSourcePosition = slice.startTime / Math.max(adjustedSlices[adjustedSlices.length - 1]?.endTime || 60, 1);
          const getNarrativeRole = (slicePos: number, clipIdx?: number, totalClipsInVideo?: number): { role: "hook" | "buildup" | "payoff" | "closer"; bonus: number; } => {
            if (clipIdx === undefined || !totalClipsInVideo) {
              if (slicePos < 0.15) return { role: "hook", bonus: 15 };
              if (slicePos < 0.5) return { role: "buildup", bonus: 10 };
              if (slicePos < 0.85) return { role: "payoff", bonus: 12 };
              return { role: "closer", bonus: 15 };
            }
            const clipPosition = clipIdx / Math.max(totalClipsInVideo - 1, 1);
            if (clipPosition < 0.15) return { role: "hook", bonus: 15 };
            if (clipPosition < 0.5) return { role: "buildup", bonus: 10 };
            if (clipPosition < 0.85) return { role: "payoff", bonus: 12 };
            return { role: "closer", bonus: 15 };
          };
          const narrativeInfo = getNarrativeRole(sliceSourcePosition, clipIndex, totalClips);

          // Find closest energy curve point
          let targetEnergy = energyCurve[0].energy;
          for (let i = 0; i < energyCurve.length - 1; i++) {
            const curr = energyCurve[i];
            const next = energyCurve[i + 1];
            if (relativePosition >= curr.position && relativePosition <= next.position) {
              const ratio = (relativePosition - curr.position) / (next.position - curr.position);
              targetEnergy = curr.energy + ratio * (next.energy - curr.energy);
              break;
            }
          }

          const engagementDifference = (slice.engagementScore ?? 0) - targetEnergy;
          let score = Math.max(0, engagementDifference) + Math.max(0, (slice.engagementScore ?? 0) - 95) * 0.5;

          const narrativeTypePreferences: Record<string, string[]> = {
            hook: ["hook", "intro", "action", "peak", "chorus", "climax"],
            buildup: ["verse", "section", "speech", "broll", "bridge", "pre-chorus"],
            payoff: ["chorus", "peak", "action", "climax", "breakdown"],
            closer: ["outro", "resolution", "bridge", "section", "speech", "hook"],
          };
          const rolePreferences = narrativeTypePreferences[narrativeInfo.role] || [];
          const matchesRole = rolePreferences.some(type => slice.clipType?.toLowerCase().includes(type.toLowerCase()));
          if (matchesRole) score += narrativeInfo.bonus;

          const diversityScores = new Map<string, number>();
          selectedClipIds.forEach(id => diversityScores.set(id, (diversityScores.get(id) || 0) + 1));
          const diversityPenalty = clipIndex !== undefined && totalClips ? 0.7 : 0.3;
          let finalScore = score * Math.pow(1 - diversityPenalty, diversityScores.get(slice.id) || 0);

          if (clipIndex !== undefined && totalClips) {
            const slicePosition = candidates.findIndex(s => s.id === slice.id) / candidates.length;
            const targetSection = clipIndex / totalClips;
            const sectionMatch = 1 - Math.abs(slicePosition - targetSection);
            finalScore *= (1 + sectionMatch * 0.5);
          }

          return {
            ...slice,
            score: finalScore,
            narrativeRole: narrativeInfo.role,
          };
        });

        scoredSlices.sort((a, b) => b.score - a.score);

        for (const item of scoredSlices) {
          const clipDuration = Math.max(item.endTime - item.startTime, this.calculateOptimalClipDuration(item.engagementScore, videoContext, videoType, effectiveDurationPrefs).minDuration); // V6.4: Use effective duration
          if (currentDuration + clipDuration <= targetDuration) {
            selectedClipIds.push(item.id);
            currentDuration += clipDuration;
          } else if (selectedClipIds.length === 0 && clipDuration <= targetDuration) {
            selectedClipIds.push(item.id);
            currentDuration += clipDuration;
            break;
          } else {
            break;
          }
        }

      } else {
        // Standard short video logic
        // V6.3: Apply learned hook priority to energy curve
        // V6.4: Use format strategy's energy curve for short videos
        const hookEnergyBoost = effectiveHookPriority.preferHighEnergy ? 3 : 0;
        const energyCurve = [
          { position: 0, energy: Math.min(100, 90 + contextAdjustments.energyModifier + hookEnergyBoost) },
          { position: 0.5, energy: Math.min(100, 95 + contextAdjustments.energyModifier) },
          { position: 1, energy: Math.min(100, 100 + contextAdjustments.energyModifier) }
        ];

        const preferredTypes = contextAdjustments.preferredClipTypes || ["hook", "chorus", "verse", "talking_head", "broll"];
        // V6.3: Use learned minimum engagement threshold
        const minEngagement = Math.max(60, effectiveHookPriority.minEngagement + contextAdjustments.minEngagementModifier);

        // V6.3: Use learned min duration or default
        const MIN_CLIP_DURATION = effectiveDurationPrefs.min; // V6.4
        let candidates = adjustedSlices.filter(s => {
          const duration = s.endTime - s.startTime;
          const meetsEngagement = (s.engagementScore || 0) >= minEngagement;
          const meetsMinDuration = duration >= MIN_CLIP_DURATION;

          if (!meetsMinDuration) {
            console.log(`[selectClips] Skipping clip ${s.id}: too short (${duration.toFixed(2)}s < ${MIN_CLIP_DURATION}s)`);
          }
          return meetsEngagement && meetsMinDuration;
        });

        // V6.3: Apply smart duration scaling with learned preferences
        console.log(`[selectClipsForVideo] Short video: Applying engagement-based duration scaling to ${candidates.length} candidates`);
        candidates = candidates.map(slice => {
          const currentDuration = slice.endTime - slice.startTime;
          const { minDuration, maxDuration } = this.calculateOptimalClipDuration(
            slice.engagementScore,
            videoContext,
            videoType,
            effectiveDurationPrefs // V6.4: Pass effective duration preferences
          );

          // If current duration is too short, extend it (if possible)
          if (currentDuration < minDuration) {
            const extension = minDuration - currentDuration;
            const newEndTime = Math.min(slice.endTime + extension, slice.endTime + 2); // Max 2s extension
            console.log(
              `[Duration] Slice ${slice.id}: ${currentDuration.toFixed(2)}s → ${(newEndTime - slice.startTime).toFixed(2)}s (engagement: ${slice.engagementScore})`
            );
            return { ...slice, endTime: newEndTime };
          }

          // If current duration is too long, trim it
          if (currentDuration > maxDuration) {
            const newEndTime = slice.startTime + maxDuration;
            console.log(
              `[Duration] Slice ${slice.id}: ${currentDuration.toFixed(2)}s → ${maxDuration.toFixed(2)}s (trimmed for pacing)`
            );
            return { ...slice, endTime: newEndTime };
          }

          return slice;
        });

        const scoredSlices = candidates.map((slice, index) => {
          const diversityOffset = clipIndex !== undefined && totalClips ?
            (clipIndex / totalClips) * candidates.length : 0;
          const adjustedIndex = (index + Math.floor(diversityOffset)) % candidates.length;
          const relativePosition = adjustedIndex / Math.max(candidates.length - 1, 1);

          const sliceSourcePosition = slice.startTime / Math.max(adjustedSlices[adjustedSlices.length - 1]?.endTime || 60, 1);
          const getNarrativeRole = (slicePos: number, clipIdx?: number, totalClipsInVideo?: number): { role: "hook" | "buildup" | "payoff" | "closer"; bonus: number; } => {
            if (clipIdx === undefined || !totalClipsInVideo) {
              if (slicePos < 0.15) return { role: "hook", bonus: 15 };
              if (slicePos < 0.5) return { role: "buildup", bonus: 10 };
              if (slicePos < 0.85) return { role: "payoff", bonus: 12 };
              return { role: "closer", bonus: 15 };
            }
            const clipPosition = clipIdx / Math.max(totalClipsInVideo - 1, 1);
            if (clipPosition < 0.15) return { role: "hook", bonus: 15 };
            if (clipPosition < 0.5) return { role: "buildup", bonus: 10 };
            if (clipPosition < 0.85) return { role: "payoff", bonus: 12 };
            return { role: "closer", bonus: 15 };
          };
          const narrativeInfo = getNarrativeRole(sliceSourcePosition, clipIndex, totalClips);

          let targetEnergy = energyCurve[0].energy;
          for (let i = 0; i < energyCurve.length - 1; i++) {
            const curr = energyCurve[i];
            const next = energyCurve[i + 1];
            if (relativePosition >= curr.position && relativePosition <= next.position) {
              const ratio = (relativePosition - curr.position) / (next.position - curr.position);
              targetEnergy = curr.energy + ratio * (next.energy - curr.energy);
              break;
            }
          }

          const engagementDifference = (slice.engagementScore ?? 0) - targetEnergy;
          let score = Math.max(0, engagementDifference) + Math.max(0, (slice.engagementScore ?? 0) - minEngagement) * 0.5;

          const narrativeTypePreferences: Record<string, string[]> = {
            hook: ["hook", "intro", "action", "peak", "chorus", "climax"],
            buildup: ["verse", "section", "speech", "broll", "bridge", "pre-chorus"],
            payoff: ["chorus", "peak", "action", "climax", "breakdown"],
            closer: ["outro", "resolution", "bridge", "section", "speech", "hook"],
          };
          const rolePreferences = narrativeTypePreferences[narrativeInfo.role] || [];
          const matchesRole = rolePreferences.some(type => slice.clipType?.toLowerCase().includes(type.toLowerCase()));
          if (matchesRole) score += narrativeInfo.bonus;

          const diversityScores = new Map<string, number>();
          selectedClipIds.forEach(id => diversityScores.set(id, (diversityScores.get(id) || 0) + 1));
          const diversityPenalty = clipIndex !== undefined && totalClips ? 0.7 : 0.3;
          let finalScore = score * Math.pow(1 - diversityPenalty, diversityScores.get(slice.id) || 0);

          if (clipIndex !== undefined && totalClips) {
            const slicePosition = candidates.findIndex(s => s.id === slice.id) / candidates.length;
            const targetSection = clipIndex / totalClips;
            const sectionMatch = 1 - Math.abs(slicePosition - targetSection);
            finalScore *= (1 + sectionMatch * 0.5);
          }

          return {
            ...slice,
            score: finalScore,
            narrativeRole: narrativeInfo.role,
          };
        });

        scoredSlices.sort((a, b) => b.score - a.score);

        for (const item of scoredSlices) {
          const clipDuration = Math.max(item.endTime - item.startTime, this.calculateOptimalClipDuration(item.engagementScore, videoContext, videoType, effectiveDurationPrefs).minDuration); // V6.4: Use effective duration
          if (currentDuration + clipDuration <= targetDuration) {
            selectedClipIds.push(item.id);
            currentDuration += clipDuration;
          } else if (selectedClipIds.length === 0 && clipDuration <= targetDuration) {
            selectedClipIds.push(item.id);
            currentDuration += clipDuration;
            break;
          } else {
            break;
          }
        }
      }
    }

    // Comprehensive video: Deep dive, varied pacing, focus on storytelling
    else if (videoType === "comprehensive") {
      // V6.3: Apply learned hook priority to energy curve
      // V6.4: Use format strategy for comprehensive/standard videos
      const hookEnergyBoost = effectiveHookPriority.preferHighEnergy ? 2 : 0;
      const energyCurve = [
        { position: 0, energy: Math.min(100, 60 + contextAdjustments.energyModifier + hookEnergyBoost) },
        { position: 0.3, energy: Math.min(100, 75 + contextAdjustments.energyModifier) },
        { position: 0.6, energy: Math.min(100, 85 + contextAdjustments.energyModifier) },
        { position: 0.9, energy: Math.min(100, 70 + contextAdjustments.energyModifier) },
        { position: 1, energy: Math.min(100, 65 + contextAdjustments.energyModifier) }
      ];

      const preferredTypes = contextAdjustments.preferredClipTypes;
      // V6.3: Use learned minimum engagement threshold with lower base for comprehensive
      const minEngagement = Math.max(50, Math.min(effectiveHookPriority.minEngagement - 5, 65) + contextAdjustments.minEngagementModifier);

      // V6.3: Use learned min duration or default
      const MIN_CLIP_DURATION = effectiveDurationPrefs.min; // V6.4
      let candidates = adjustedSlices.filter(s => {
        const duration = s.endTime - s.startTime;
        const meetsEngagement = (s.engagementScore || 0) >= minEngagement;
        const meetsMinDuration = duration >= MIN_CLIP_DURATION;
        if (!meetsMinDuration) console.log(`[selectClips] Skipping clip ${s.id}: too short (${duration.toFixed(2)}s < ${MIN_CLIP_DURATION}s)`);
        return meetsEngagement && meetsMinDuration;
      });

      // V6.3: Apply smart duration scaling with learned preferences
      console.log(`[selectClipsForVideo] Comprehensive video: Applying engagement-based duration scaling to ${candidates.length} candidates`);
      candidates = candidates.map(slice => {
        const currentDuration = slice.endTime - slice.startTime;
        const { minDuration, maxDuration } = this.calculateOptimalClipDuration(
          slice.engagementScore,
          videoContext,
          videoType,
          effectiveDurationPrefs // V6.4: Pass effective duration preferences
        );

        // If current duration is too short, extend it (if possible)
        if (currentDuration < minDuration) {
          const extension = minDuration - currentDuration;
          const newEndTime = Math.min(slice.endTime + extension, slice.endTime + 2); // Max 2s extension
          console.log(
            `[Duration] Slice ${slice.id}: ${currentDuration.toFixed(2)}s → ${(newEndTime - slice.startTime).toFixed(2)}s (engagement: ${slice.engagementScore})`
          );
          return { ...slice, endTime: newEndTime };
        }

        // If current duration is too long, trim it
        if (currentDuration > maxDuration) {
          const newEndTime = slice.startTime + maxDuration;
          console.log(
            `[Duration] Slice ${slice.id}: ${currentDuration.toFixed(2)}s → ${maxDuration.toFixed(2)}s (trimmed for pacing)`
          );
          return { ...slice, endTime: newEndTime };
        }

        return slice;
      });

      const scoredSlices = candidates.map((slice, index) => {
        const diversityOffset = clipIndex !== undefined && totalClips ? (clipIndex / totalClips) * candidates.length : 0;
        const adjustedIndex = (index + Math.floor(diversityOffset)) % candidates.length;
        const relativePosition = adjustedIndex / Math.max(candidates.length - 1, 1);

        const sliceSourcePosition = slice.startTime / Math.max(adjustedSlices[adjustedSlices.length - 1]?.endTime || 60, 1);
        const getNarrativeRole = (slicePos: number, clipIdx?: number, totalClipsInVideo?: number): { role: "hook" | "buildup" | "payoff" | "closer"; bonus: number; } => {
          if (clipIdx === undefined || !totalClipsInVideo) {
            if (slicePos < 0.15) return { role: "hook", bonus: 15 };
            if (slicePos < 0.5) return { role: "buildup", bonus: 10 };
            if (slicePos < 0.85) return { role: "payoff", bonus: 12 };
            return { role: "closer", bonus: 15 };
          }
          const clipPosition = clipIdx / Math.max(totalClipsInVideo - 1, 1);
          if (clipPosition < 0.15) return { role: "hook", bonus: 15 };
          if (clipPosition < 0.5) return { role: "buildup", bonus: 10 };
          if (clipPosition < 0.85) return { role: "payoff", bonus: 12 };
          return { role: "closer", bonus: 15 };
        };
        const narrativeInfo = getNarrativeRole(sliceSourcePosition, clipIndex, totalClips);

        let targetEnergy = energyCurve[0].energy;
        for (let i = 0; i < energyCurve.length - 1; i++) {
          const curr = energyCurve[i];
          const next = energyCurve[i + 1];
          if (relativePosition >= curr.position && relativePosition <= next.position) {
            const ratio = (relativePosition - curr.position) / (next.position - curr.position);
            targetEnergy = curr.energy + ratio * (next.energy - curr.energy);
            break;
          }
        }

        const engagementDifference = (slice.engagementScore ?? 0) - targetEnergy;
        let score = Math.max(0, engagementDifference) + Math.max(0, (slice.engagementScore ?? 0) - minEngagement) * 0.5;

        const narrativeTypePreferences: Record<string, string[]> = {
          hook: ["hook", "intro", "action", "peak", "chorus", "climax"],
          buildup: ["verse", "section", "speech", "broll", "bridge", "pre-chorus"],
          payoff: ["chorus", "peak", "action", "climax", "breakdown"],
          closer: ["outro", "resolution", "bridge", "section", "speech", "hook"],
        };
        const rolePreferences = narrativeTypePreferences[narrativeInfo.role] || [];
        const matchesRole = rolePreferences.some(type => slice.clipType?.toLowerCase().includes(type.toLowerCase()));
        if (matchesRole) score += narrativeInfo.bonus;

        const diversityScores = new Map<string, number>();
        selectedClipIds.forEach(id => diversityScores.set(id, (diversityScores.get(id) || 0) + 1));
        const diversityPenalty = clipIndex !== undefined && totalClips ? 0.7 : 0.3;
        let finalScore = score * Math.pow(1 - diversityPenalty, diversityScores.get(slice.id) || 0);

        if (clipIndex !== undefined && totalClips) {
          const slicePosition = candidates.findIndex(s => s.id === slice.id) / candidates.length;
          const targetSection = clipIndex / totalClips;
          const sectionMatch = 1 - Math.abs(slicePosition - targetSection);
          finalScore *= (1 + sectionMatch * 0.5);
        }

        return {
          ...slice,
          score: finalScore,
          narrativeRole: narrativeInfo.role,
        };
      });

      scoredSlices.sort((a, b) => b.score - a.score);

      for (const item of scoredSlices) {
        const clipDuration = Math.max(item.endTime - item.startTime, this.calculateOptimalClipDuration(item.engagementScore, videoContext, videoType, effectiveDurationPrefs).minDuration); // V6.4: Use effective duration
        if (currentDuration + clipDuration <= targetDuration) {
          selectedClipIds.push(item.id);
          currentDuration += clipDuration;
        } else if (selectedClipIds.length === 0 && clipDuration <= targetDuration) {
          selectedClipIds.push(item.id);
          currentDuration += clipDuration;
          break;
        } else {
          break;
        }
      }
    }

    // Standard video: Balanced pacing, moderate energy (also handles any unknown videoType)
    else {
      // This handles "standard" type AND any unknown videoType - NO recursive call
      // V6.3: Apply learned hook priority to energy curve
      // V6.4: Use format strategy for comprehensive/standard videos
      const hookEnergyBoost = effectiveHookPriority.preferHighEnergy ? 2 : 0;
      const energyCurve = [
        { position: 0, energy: Math.min(100, 75 + contextAdjustments.energyModifier + hookEnergyBoost) },
        { position: 0.3, energy: Math.min(100, 85 + contextAdjustments.energyModifier) },
        { position: 0.6, energy: Math.min(100, 90 + contextAdjustments.energyModifier) },
        { position: 0.85, energy: Math.min(100, 80 + contextAdjustments.energyModifier) },
        { position: 1, energy: Math.min(100, 75 + contextAdjustments.energyModifier) }
      ];

      // V6.3: Use learned minimum engagement threshold
      const minEngagement = Math.max(55, effectiveHookPriority.minEngagement - 5 + contextAdjustments.minEngagementModifier);

      // V6.3: Use learned min duration or default
      const MIN_CLIP_DURATION = effectiveDurationPrefs.min; // V6.4
      let candidates = adjustedSlices.filter(s => {
        const duration = s.endTime - s.startTime;
        const meetsEngagement = (s.engagementScore || 0) >= minEngagement;
        const meetsMinDuration = duration >= MIN_CLIP_DURATION;
        if (!meetsMinDuration) console.log(`[selectClips] Skipping clip ${s.id}: too short (${duration.toFixed(2)}s < ${MIN_CLIP_DURATION}s)`);
        return meetsEngagement && meetsMinDuration;
      });

      // If no candidates meet thresholds, lower the bar
      if (candidates.length === 0) {
        console.log(`[selectClips] No candidates met threshold, lowering to 50 engagement`);
        candidates = adjustedSlices.filter(s => (s.endTime - s.startTime) >= MIN_CLIP_DURATION);
      }

      // V6.3: Apply smart duration scaling with learned preferences
      console.log(`[selectClipsForVideo] Standard video: Applying engagement-based duration scaling to ${candidates.length} candidates`);
      candidates = candidates.map(slice => {
        const sliceDuration = slice.endTime - slice.startTime;
        const { minDuration, maxDuration } = this.calculateOptimalClipDuration(
          slice.engagementScore,
          videoContext,
          videoType,
          effectiveDurationPrefs // V6.4: Pass effective duration preferences
        );

        if (sliceDuration < minDuration) {
          const extension = minDuration - sliceDuration;
          const newEndTime = Math.min(slice.endTime + extension, slice.endTime + 2);
          return { ...slice, endTime: newEndTime };
        }
        if (sliceDuration > maxDuration) {
          return { ...slice, endTime: slice.startTime + maxDuration };
        }
        return slice;
      });

      const scoredSlices = candidates.map((slice, index) => {
        const relativePosition = index / Math.max(candidates.length - 1, 1);

        let targetEnergy = energyCurve[0].energy;
        for (let i = 0; i < energyCurve.length - 1; i++) {
          const curr = energyCurve[i];
          const next = energyCurve[i + 1];
          if (relativePosition >= curr.position && relativePosition <= next.position) {
            const ratio = (relativePosition - curr.position) / (next.position - curr.position);
            targetEnergy = curr.energy + ratio * (next.energy - curr.energy);
            break;
          }
        }

        const engagementDifference = (slice.engagementScore ?? 0) - targetEnergy;
        let score = Math.max(0, engagementDifference) + Math.max(0, (slice.engagementScore ?? 0) - minEngagement) * 0.5;

        return { ...slice, score };
      });

      scoredSlices.sort((a, b) => b.score - a.score);

      for (const item of scoredSlices) {
        const clipDuration = Math.max(item.endTime - item.startTime, this.calculateOptimalClipDuration(item.engagementScore, videoContext, videoType, effectiveDurationPrefs).minDuration); // V6.4: Use effective duration
        if (currentDuration + clipDuration <= targetDuration) {
          selectedClipIds.push(item.id);
          currentDuration += clipDuration;
        } else if (selectedClipIds.length === 0 && clipDuration <= targetDuration) {
          selectedClipIds.push(item.id);
          currentDuration += clipDuration;
          break;
        } else {
          break;
        }
      }
    }

    // Fallback: If no clips were selected, ensure we get at least 1-3 clips
    if (selectedClipIds.length === 0 && adjustedSlices.length > 0) {
      const minClipsForShort = videoType === "short" ? 2 : 1;
      const maxAttempts = Math.min(3, adjustedSlices.length);
      const sortedByEngagement = [...adjustedSlices].sort((a, b) => (b.engagementScore ?? 0) - (a.engagementScore ?? 0));

      for (let i = 0; i < maxAttempts && selectedClipIds.length < minClipsForShort; i++) {
        const slice = sortedByEngagement[i];
        if (slice) {
          selectedClipIds.push(slice.id);
        }
      }
    }

    // If still no clips (shouldn't happen but just in case), use best available slice
    if (selectedClipIds.length === 0 && adjustedSlices.length > 0) {
      const bestSlice = adjustedSlices.reduce((prev, current) =>
        ((current.engagementScore ?? 0) > (prev.engagementScore ?? 0)) ? current : prev
      );
      if (bestSlice) {
        selectedClipIds.push(bestSlice.id);
      }
    }

    // V6.2: HOOK-FIRST ENFORCEMENT
    // Ensure the highest-engagement clip suitable for a hook is at position 0
    // Guarantees strong viewer retention in the first 3 seconds
    const HOOK_MAX_DURATION = 3.0; // Max 3 seconds for opening hook
    const HOOK_ELIGIBLE_TYPES = ["hook", "intro", "action", "peak", "chorus", "climax", "highlight"];
    const CLOSER_TYPES = ["outro", "closer", "resolution"]; // Types that shouldn't be hooks

    if (selectedClipIds.length > 1) {
      // Build clip data with engagement, duration, and type (using adjusted slices)
      const clipData = selectedClipIds.map((id, index) => {
        const slice = adjustedSlices.find(s => s.id === id);
        return {
          id,
          index,
          engagement: slice?.engagementScore ?? 0,
          duration: slice ? (slice.endTime - slice.startTime) : 0,
          clipType: slice?.clipType?.toLowerCase() || "general",
          startTime: slice?.startTime ?? 0
        };
      });

      // Find the best hook candidate:
      // 1. Must have valid engagement score and duration
      // 2. Prefer clips with hook-eligible types
      // 3. Exclude closer types
      // 4. Prefer clips ≤3 seconds (but don't require it)
      // 5. Use highest engagement as tiebreaker, then earliest startTime
      const MIN_HOOK_DURATION = 0.5; // Minimum 0.5s for valid hook
      const hookCandidates = clipData
        .filter(c => c.engagement > 0 && c.duration >= MIN_HOOK_DURATION)
        .filter(c => !CLOSER_TYPES.some(t => c.clipType.includes(t))) // Exclude closers
        .map(c => {
          let hookScore = c.engagement;

          // Bonus for hook-eligible types
          if (HOOK_ELIGIBLE_TYPES.some(t => c.clipType.includes(t))) {
            hookScore += 15;
          }

          // Bonus for clips that fit in 3 second window
          if (c.duration <= HOOK_MAX_DURATION) {
            hookScore += 10;
          } else if (c.duration <= 5) {
            hookScore += 5; // Partial bonus for clips up to 5s
          }

          return { ...c, hookScore };
        })
        .sort((a, b) => {
          // Sort by hookScore descending, then by startTime ascending for stability
          if (b.hookScore !== a.hookScore) return b.hookScore - a.hookScore;
          return a.startTime - b.startTime;
        });

      if (hookCandidates.length > 0) {
        const bestHook = hookCandidates[0];

        if (bestHook.index !== 0) {
          console.log(`[Hook-First] Enforcing hook-first: Moving clip ${bestHook.id} (engagement: ${bestHook.engagement}, type: ${bestHook.clipType}, duration: ${bestHook.duration.toFixed(1)}s) from position ${bestHook.index} to position 0`);
          selectedClipIds.splice(bestHook.index, 1);
          selectedClipIds.unshift(bestHook.id);
        } else {
          console.log(`[Hook-First] Position 0 already optimal: ${bestHook.id} (engagement: ${bestHook.engagement}, hookScore: ${bestHook.hookScore})`);
        }
      } else {
        console.log(`[Hook-First] No suitable hook candidates found, keeping original order`);
      }
    }

    return selectedClipIds;
  }


  /**
   * Generate label descriptions for clips based on their semantic type
   * Makes clips more understandable for users
   */
  static generateClipLabels(
    sliceIds: string[],
    allSlices: Array<{ id: string; startTime: number; endTime: number; clipType?: string | null; transcription?: string | null }>
  ): Record<string, string> {
    const labels: Record<string, string> = {};

    for (const clipId of sliceIds) {
      const slice = allSlices.find(s => s.id === clipId);
      if (slice) {
        const duration = Math.round(slice.endTime - slice.startTime);
        const timestamp = `${Math.floor(slice.startTime / 60)}:${String(Math.round(slice.startTime % 60)).padStart(2, '0')}`;

        // Create a human-readable label
        let label = `${timestamp}`;
        if (slice.clipType && slice.clipType !== 'generic' && slice.clipType !== 'general') {
          const typeLabels: Record<string, string> = {
            'intro': 'Intro',
            'verse': 'Verse',
            'chorus': 'Chorus',
            'bridge': 'Bridge',
            'pre-chorus': 'Pre-Chorus',
            'outro': 'Outro',
            'hook': 'Hook',
            'action': 'Action',
            'peak': 'Peak Moment',
            'climax': 'Climax',
            'broll': 'B-Roll',
            'talking_head': 'Speaking',
            'speech': 'Key Speech',
            'explanation': 'Explanation',
            'demonstration': 'Demo',
            'highlight': 'Highlight',
            'section': 'Section',
            'breakdown': 'Breakdown',
            'pause': 'Pause',
          };
          label = typeLabels[slice.clipType] || slice.clipType.replace(/_/g, ' ');
        }

        labels[clipId] = `${label} (${duration}s)`;
      } else if (clipId.startsWith('direct-')) {
        // Synthetic direct cut
        labels[clipId] = 'Direct Cut';
      } else {
        labels[clipId] = 'Segment';
      }
    }

    return labels;
  }

  /**
   * V6.0 ENHANCEMENT: Generate smart editing recommendations based on content analysis
   * This provides intelligent suggestions that help users make better editing decisions
   * without overwhelming them with choices - a key differentiator from competitors like VEED
   */
  static generateSmartRecommendations(
    videoCategory: string,
    duration: number,
    slices: Array<{ engagementScore?: number | null; clipType?: string | null }>,
    speechDensity?: number // Percentage of video that has speech (0-1)
  ): {
    recommendedIntent: "single-video" | "multiple-clips" | "comprehensive" | "ai-decide";
    recommendedDuration: number;
    recommendedClipCount?: number;
    recommendedClipDuration?: number;
    recommendedContext: string;
    reasoning: string;
    confidenceScore: number; // 0-100
    insights: string[];
  } {
    const avgEngagement = slices.length > 0
      ? slices.reduce((sum, s) => sum + (s.engagementScore || 70), 0) / slices.length
      : 70;

    const highEngagementSlices = slices.filter(s => (s.engagementScore || 0) >= 80).length;
    const engagementDistribution = highEngagementSlices / Math.max(slices.length, 1);

    const insights: string[] = [];
    let recommendedIntent: "single-video" | "multiple-clips" | "comprehensive" | "ai-decide" = "single-video";
    let recommendedDuration = 60;
    let recommendedClipCount: number | undefined;
    let recommendedClipDuration: number | undefined;
    let recommendedContext = "generic";
    let reasoning = "";
    let confidenceScore = 75;

    // Analyze based on video category
    switch (videoCategory) {
      case "music_video":
        insights.push("Detected music content - prioritizing beat-aligned cuts");
        if (duration > 60 && engagementDistribution > 0.3) {
          recommendedIntent = "multiple-clips";
          recommendedClipCount = Math.min(5, Math.floor(duration / 15));
          recommendedClipDuration = 15;
          reasoning = "Music videos work great as multiple short clips for social media";
          recommendedContext = "hype";
        } else {
          recommendedIntent = "single-video";
          recommendedDuration = Math.min(duration, 60);
          reasoning = "Perfect for a single polished music highlight reel";
          recommendedContext = "hype";
        }
        confidenceScore = 85;
        break;

      case "talking_head":
        insights.push("Detected person speaking - preserving speech continuity");
        recommendedContext = speechDensity && speechDensity > 0.7 ? "tutorial" : "vlog";
        if (duration > 120) {
          recommendedIntent = "comprehensive";
          recommendedDuration = Math.min(duration, 180);
          reasoning = "Long-form talking content benefits from comprehensive editing to maintain context";
        } else {
          recommendedIntent = "single-video";
          recommendedDuration = Math.min(duration, 90);
          reasoning = "Concise talking head content works best as a single focused video";
        }
        confidenceScore = 80;
        break;

      case "marketing":
        insights.push("Detected promotional/marketing content - optimizing for engagement hooks");
        recommendedContext = "hype";
        if (avgEngagement > 75) {
          recommendedIntent = "multiple-clips";
          recommendedClipCount = Math.min(8, Math.floor(duration / 10));
          recommendedClipDuration = 10;
          reasoning = "High-engagement marketing content is perfect for multiple punchy clips";
          confidenceScore = 90;
        } else {
          recommendedIntent = "single-video";
          recommendedDuration = Math.min(duration, 30);
          reasoning = "Focus on the strongest moments for maximum impact";
          confidenceScore = 75;
        }
        break;

      case "tutorial":
        insights.push("Detected educational content - preserving instructional clarity");
        recommendedContext = "tutorial";
        recommendedIntent = duration > 180 ? "comprehensive" : "single-video";
        recommendedDuration = Math.min(duration, 180);
        reasoning = "Educational content needs context preserved for clarity";
        confidenceScore = 85;
        break;

      case "vlog":
        insights.push("Detected vlog-style content - balancing personality with pacing");
        recommendedContext = "vlog";
        if (duration > 90 && highEngagementSlices >= 3) {
          recommendedIntent = "multiple-clips";
          recommendedClipCount = Math.min(5, highEngagementSlices);
          recommendedClipDuration = 20;
          reasoning = "Your vlog has great highlight moments - perfect for multiple clips";
        } else {
          recommendedIntent = "single-video";
          recommendedDuration = Math.min(duration, 60);
          reasoning = "A focused single video captures your best vlog moments";
        }
        confidenceScore = 75;
        break;

      case "product_demo":
        insights.push("Detected product demonstration - highlighting key features");
        recommendedContext = "demo";
        recommendedIntent = "single-video";
        recommendedDuration = Math.min(duration, 45);
        reasoning = "Product demos work best as concise, focused showcases";
        confidenceScore = 80;
        break;

      case "sports":
      case "movie_scene":
        insights.push("Detected action content - maximizing dynamic moments");
        recommendedContext = "hype";
        recommendedIntent = "multiple-clips";
        recommendedClipCount = Math.min(6, Math.floor(duration / 10));
        recommendedClipDuration = 10;
        reasoning = "Action content shines as multiple high-energy clips";
        confidenceScore = 85;
        break;

      default:
        // Smart defaults based on duration and engagement
        if (duration < 20) {
          recommendedIntent = "single-video";
          recommendedDuration = duration;
          reasoning = "Short videos work best as single polished edits";
        } else if (duration > 120 && avgEngagement > 70) {
          recommendedIntent = "multiple-clips";
          recommendedClipCount = Math.min(5, Math.floor(duration / 20));
          recommendedClipDuration = 20;
          reasoning = "Your video has great engagement throughout - multiple clips maximize reach";
        } else {
          recommendedIntent = "ai-decide";
          reasoning = "Let AI analyze your content to find the optimal format";
        }
        confidenceScore = 65;
    }

    // Add duration-based insights
    if (duration < 20) {
      insights.push("Video is already short - minimal editing recommended");
    } else if (duration > 180) {
      insights.push("Long-form content detected - multiple outputs may perform better");
    }

    // Add engagement insights
    if (avgEngagement >= 80) {
      insights.push("High engagement throughout - all sections are strong");
    } else if (engagementDistribution < 0.2) {
      insights.push("Concentrated highlights - focusing on peak moments");
    }

    return {
      recommendedIntent,
      recommendedDuration,
      recommendedClipCount,
      recommendedClipDuration,
      recommendedContext,
      reasoning,
      confidenceScore,
      insights,
    };
  }

  /**
   * Original analyzeReferenceVideo_OLD removed as analyzeReferenceVideo is now the primary method.
   * Original analyzeVideo method is replaced by the new analyzeVideo which uses frames and speech.
   * Original extractFrameAtTimestamp is used by other methods, but not directly called by analyzeVideo.
   * Original selectBestThumbnail is not directly used in the new analyzeVideo flow but could be useful for thumbnail generation.
   * Original analyzeFrameEngagement is used within the new analyzeVideo flow.
   * Original analyzeSafeTextZones is not directly used in the new analyzeVideo flow.
   * Original detectSpeechBoundaries is replaced by transcribeAudio which provides segments.
   * Original selectClipsForVideo is replaced by slice creation and scoring logic within analyzeVideo.
   * Original detectAspectRatio is potentially useful but not used in the current analyzeVideo flow.
   * Original detectContentType is simplified within analyzeVideo.
   * Original createSmartSlices is largely replaced by the scene-based slice creation and scoring in analyzeVideo.
   * Original getMusicClipType is not directly used in the current analyzeVideo flow.
   * Original detectKeywords is not directly used in the current analyzeVideo flow.
   * Original analyzeVideoPacing and calculateAdvancedEngagement are conceptual replacements for the new scoring logic.
   * Original classifyClipType is replaced by the new clip type assignment in scoreEngagement.
   */

  /**
   * Creates smart slices from basic analysis data (fallback method)
   */
  static createSmartSlices(
    projectId: string,
    beats: any[],
    frameAnalyses: any[],
    duration: number
  ): InsertSmartSlice[] {
    console.log('[createSmartSlices] Creating slices from fallback analysis');

    const slices: InsertSmartSlice[] = [];
    const targetSliceCount = Math.min(Math.ceil(duration / 5), 20); // Max 20 slices, ~5s each
    const sliceDuration = duration / targetSliceCount;

    for (let i = 0; i < targetSliceCount; i++) {
      const startTime = i * sliceDuration;
      const endTime = Math.min((i + 1) * sliceDuration, duration);

      // Calculate engagement score based on position (higher at start/end)
      const position = i / targetSliceCount;
      const engagementBoost = position < 0.2 || position > 0.8 ? 15 : 0;
      const baseScore = 60 + Math.random() * 20 + engagementBoost;

      slices.push({
        projectId, // Use the actual projectId passed in
        order: i,
        startTime,
        endTime,
        transcription: `Scene ${i + 1}`,
        engagementScore: Math.round(baseScore),
        thumbnailPath: null,
        clipType: position < 0.3 ? 'hook' : position > 0.7 ? 'outro' : 'content',
      });
    }

    console.log(`[createSmartSlices] Created ${slices.length} fallback slices`);
    return slices;
  }
}