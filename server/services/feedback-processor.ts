
/**
 * Unified Feedback Processing Service
 * Centralizes all video refinement feedback logic
 */

import OpenAI from "openai";
import { PromptRefiner } from "./prompt-refiner";

// Use AI_INTEGRATIONS_OPENAI_API_KEY (Replit integration) or fallback to OPENAI_API_KEY
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined,
});

export interface ExtractedParameters {
  engagementThreshold?: number;
  colorGrade?: string;
  transitionStyle?: string;
  pacing?: "slow" | "normal" | "fast";
  enableJLCuts?: boolean;
  jlCutType?: "j-cut" | "l-cut" | "auto";
  audioMixing?: {
    duckingEnabled?: boolean;
    masterVolume?: number;
  };
  subtitleStyle?: {
    preset?: string;
    position?: "top" | "center" | "bottom";
  };
  cutTempo?: number;
  clipDurationMultiplier?: number;
  focusRegion?: string;
  reasoning?: string;
  targetDuration?: number; // Target video duration in seconds
  transitionType?: string; // Transition type (dissolve, fade, wipe, etc.)
  transitionDuration?: number; // Duration of transitions in seconds
}

export interface RefinedPrompt {
  originalPrompt: string;
  refinedPrompt: string;
  extractedParameters: ExtractedParameters;
}

/**
 * Centralized Feedback Processor
 * Handles all feedback interpretation and parameter extraction
 */
export class FeedbackProcessor {
  /**
   * Extract structured parameters from natural language feedback using GPT JSON mode
   */
  static async extractParametersFromFeedback(
    feedback: string,
    currentParams: any = {}
  ): Promise<ExtractedParameters> {
    console.log(`[FeedbackProcessor] Extracting parameters from: "${feedback}"`);

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are an expert at extracting video editing parameters from natural language feedback.

Extract these parameters from user feedback:
- targetDuration (number, 5-300): Target video duration in seconds. Extract from "make it 15 seconds", "reduce to 30s", "shorter video about 20 seconds"
- transitionType (string): dissolve, fade, wipeleft, wiperight, smoothleft, none - type of transitions between clips
- transitionDuration (number, 0.3-2.0): Duration of transitions in seconds. "smoother" = longer (1.0-1.5), "snappier" = shorter (0.3-0.5)
- engagementThreshold (number, 0-100): Clip selection threshold
- colorGrade (string): vibrant, cinematic, dramatic, instagram, tiktok, youtube, etc.
- pacing (string): slow, normal, fast
- enableJLCuts (boolean): Enable smooth audio transitions
- jlCutType (string): j-cut, l-cut, auto
- audioMixing.duckingEnabled (boolean): Auto-duck background music
- audioMixing.masterVolume (number, 0-100): Overall volume
- subtitleStyle.preset (string): tiktok, instagram, youtube, professional
- subtitleStyle.position (string): top, center, bottom
- cutTempo (number, 500-3000): Cut speed in milliseconds, lower = faster
- clipDurationMultiplier (number, 0.5-2.0): Multiplier for clip length
- focusRegion (string): first-half, second-half, middle, entire

DURATION keywords:
- "15 seconds/15s/15 sec" → targetDuration: 15
- "shorter/brief/quick" → targetDuration: 15-30 depending on context
- "longer/extended" → targetDuration: 60-90 depending on context
- "reel format" → targetDuration: 15-30 (short vertical video format)

TRANSITION keywords:
- "smoother/smooth transitions" → transitionType: "dissolve", transitionDuration: 1.0
- "snappy/quick cuts" → transitionType: "none" or transitionDuration: 0.3
- "fade between clips" → transitionType: "fade"

PACE & SPEED keywords:
- "faster/quick/energetic" → pacing: "fast", cutTempo: 800-1000, clipDurationMultiplier: 0.7-0.8
- "slower/calm/breathe" → pacing: "slow", cutTempo: 2000-2500, clipDurationMultiplier: 1.2-1.5
- "dynamic/punchy" → pacing: "fast", cutTempo: 1000-1200

VISUAL STYLE keywords:
- "vibrant/colorful/saturated" → colorGrade: "vibrant"
- "cinematic/moody/film" → colorGrade: "cinematic"
- "warm/golden/sunset" → colorGrade: "warm"
- "dramatic/intense/contrast" → colorGrade: "dramatic"

CONTENT FOCUS keywords:
- "focus on beginning/start/hook" → focusRegion: "first-half"
- "focus on ending/conclusion" → focusRegion: "second-half"
- "middle/core content" → focusRegion: "middle"

Return ONLY valid JSON with the parameters you can extract. Omit parameters not mentioned in feedback.

Examples:
"Make it faster and more energetic" → {"engagementThreshold": 85, "pacing": "fast", "cutTempo": 900}
"Add more vibrant colors" → {"colorGrade": "vibrant"}
"Smooth out the audio transitions" → {"enableJLCuts": true, "jlCutType": "auto"}
"Make subtitles more professional" → {"subtitleStyle": {"preset": "professional"}}
"Make it 15 seconds" → {"targetDuration": 15}
"Smoother transitions, reel format" → {"transitionType": "dissolve", "transitionDuration": 1.0, "targetDuration": 20}
"Change to reel format, 15 seconds" → {"targetDuration": 15}
"Reduce to 25 seconds with fade transitions" → {"targetDuration": 25, "transitionType": "fade"}`
          },
          {
            role: "user",
            content: `User feedback: "${feedback}"\n\nCurrent parameters: ${JSON.stringify(currentParams)}\n\nExtract parameters as JSON:`
          }
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      const extracted = JSON.parse(response.choices[0]?.message?.content || "{}");
      console.log(`[FeedbackProcessor] Extracted parameters:`, extracted);

      return extracted as ExtractedParameters;
    } catch (error: any) {
      console.error(`[FeedbackProcessor] Parameter extraction failed:`, error.message);
      return {};
    }
  }

  /**
   * Process feedback (regular videos - no prompt)
   */
  static async processFeedback(
    feedback: string,
    context: {
      videoType?: string;
      currentParameters?: any;
    }
  ): Promise<ExtractedParameters> {
    return this.extractParametersFromFeedback(feedback, context.currentParameters);
  }

  /**
   * Process feedback with prompt refinement (for AI videos)
   */
  static async processFeedbackWithPromptRefinement(
    feedback: string,
    context: {
      videoType?: string;
      originalPrompt?: string;
      currentParameters?: any;
    }
  ): Promise<{
    refinedPrompt: string;
    extractedParameters: ExtractedParameters;
  }> {
    console.log(`[FeedbackProcessor] Processing feedback with prompt refinement`);

    // Refine the prompt
    const refinedPrompt = await PromptRefiner.refinePromptWithFeedback(
      context.originalPrompt || "",
      feedback,
      { throwOnError: false }
    );

    // Extract structured parameters
    const extractedParameters = await this.extractParametersFromFeedback(
      feedback,
      context.currentParameters
    );

    return {
      refinedPrompt,
      extractedParameters
    };
  }

  /**
   * Merge extracted parameters with current parameters
   */
  static mergeParameters(current: any, extracted: ExtractedParameters): any {
    const merged = { ...current };

    // Apply extracted parameters, overwriting current ones
    if (extracted.engagementThreshold !== undefined) {
      merged.engagementThreshold = extracted.engagementThreshold;
    }
    if (extracted.colorGrade) {
      merged.colorGrade = extracted.colorGrade;
    }
    if (extracted.transitionStyle) {
      merged.transitionStyle = extracted.transitionStyle;
    }
    if (extracted.pacing) {
      merged.pacing = extracted.pacing;
    }
    if (extracted.enableJLCuts !== undefined) {
      merged.enableJLCuts = extracted.enableJLCuts;
    }
    if (extracted.jlCutType) {
      merged.jlCutType = extracted.jlCutType;
    }
    if (extracted.audioMixing) {
      merged.audioMixing = { ...merged.audioMixing, ...extracted.audioMixing };
    }
    if (extracted.subtitleStyle) {
      merged.subtitleStyle = { ...merged.subtitleStyle, ...extracted.subtitleStyle };
    }
    if (extracted.cutTempo !== undefined) {
      merged.cutTempo = extracted.cutTempo;
    }
    if (extracted.clipDurationMultiplier !== undefined) {
      merged.clipDurationMultiplier = extracted.clipDurationMultiplier;
    }
    if (extracted.focusRegion) {
      merged.focusRegion = extracted.focusRegion;
    }

    console.log(`[FeedbackProcessor] Merged parameters:`, merged);
    return merged;
  }
}

// Legacy export for backward compatibility
export type FeedbackParameters = ExtractedParameters;
