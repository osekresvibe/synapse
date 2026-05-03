
import ffmpeg from "fluent-ffmpeg";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined,
});

const FRAMES_DIR = path.join(process.cwd(), "uploads", "frames");

export interface HookAnalysis {
  overallScore: number; // 0-100
  factors: {
    visualMovement: number;
    audioHook: number;
    facePresence: number;
    textOverlay: number;
    patternBreak: number;
    pacing: number;
  };
  recommendation: string;
  predictedRetention: "high" | "medium" | "low";
  improvementSuggestions: string[];
}

export class HookAnalyzer {
  /**
   * Analyze the first 3-5 seconds of a video for hook strength
   */
  static async analyzeHook(videoPath: string, duration: number = 3): Promise<HookAnalysis> {
    console.log(`[HookAnalyzer] Analyzing hook for first ${duration}s of video`);

    // Extract frames from the first few seconds
    const framePaths = await this.extractHookFrames(videoPath, duration);
    
    // Analyze frames with GPT-4 Vision
    const visionAnalysis = await this.analyzeFramesWithVision(framePaths);
    
    // Analyze audio energy
    const audioHook = await this.analyzeAudioHook(videoPath, duration);
    
    // Calculate factor scores
    const factors = {
      visualMovement: visionAnalysis.movementScore,
      audioHook: audioHook,
      facePresence: visionAnalysis.faceScore,
      textOverlay: visionAnalysis.textScore,
      patternBreak: visionAnalysis.patternBreakScore,
      pacing: visionAnalysis.pacingScore
    };

    // Calculate weighted overall score
    const overallScore = Math.round(
      factors.visualMovement * 0.20 +
      factors.audioHook * 0.25 +
      factors.facePresence * 0.15 +
      factors.textOverlay * 0.10 +
      factors.patternBreak * 0.15 +
      factors.pacing * 0.15
    );

    // Generate recommendations
    const { recommendation, improvementSuggestions } = await this.generateRecommendations(factors, overallScore);
    
    // Predict retention
    const predictedRetention = overallScore >= 85 ? "high" : overallScore >= 70 ? "medium" : "low";

    // Cleanup frames
    for (const framePath of framePaths) {
      try {
        if (fs.existsSync(framePath)) {
          fs.unlinkSync(framePath);
        }
      } catch (err) {
        console.warn(`[HookAnalyzer] Failed to cleanup frame: ${framePath}`);
      }
    }

    return {
      overallScore,
      factors,
      recommendation,
      predictedRetention,
      improvementSuggestions
    };
  }

  /**
   * Extract frames from the first N seconds of video
   */
  private static async extractHookFrames(videoPath: string, duration: number): Promise<string[]> {
    if (!fs.existsSync(FRAMES_DIR)) {
      fs.mkdirSync(FRAMES_DIR, { recursive: true });
    }

    const framePaths: string[] = [];
    const frameBaseName = `hook-${nanoid()}`;
    const fps = 2; // 2 frames per second for hook analysis
    const maxFrames = Math.ceil(duration * fps);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoPath)
        .setStartTime(0)
        .duration(duration)
        .fps(fps)
        .frames(maxFrames)
        .on('end', () => {
          const files = fs.readdirSync(FRAMES_DIR)
            .filter(f => f.startsWith(frameBaseName) && f.endsWith('.jpg'))
            .sort();
          for (const file of files) {
            framePaths.push(path.join(FRAMES_DIR, file));
          }
          resolve();
        })
        .on('error', reject)
        .save(path.join(FRAMES_DIR, `${frameBaseName}-%d.jpg`));
    });

    return framePaths;
  }

  /**
   * Analyze frames using GPT-4 Vision for hook factors
   */
  private static async analyzeFramesWithVision(framePaths: string[]): Promise<{
    movementScore: number;
    faceScore: number;
    textScore: number;
    patternBreakScore: number;
    pacingScore: number;
  }> {
    const frameData = framePaths.map(filePath => {
      const buffer = fs.readFileSync(filePath);
      return buffer.toString('base64');
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Analyze these frames from the first 3 seconds of a video for hook strength. Score each factor 0-100:
- visualMovement: Motion in first 2s (static = bad, dynamic = good)
- facePresence: Human face in frame (present = good)
- textOverlay: Curiosity-driving text present (yes = good)
- patternBreak: Unexpected visual in first 1s (surprise = good)
- pacing: Number of cuts/scene changes (more = good)

Return JSON: {"movementScore": 0-100, "faceScore": 0-100, "textScore": 0-100, "patternBreakScore": 0-100, "pacingScore": 0-100}`
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze hook strength:' },
            ...frameData.map(base64 => ({
              type: 'image_url' as const,
              image_url: {
                url: `data:image/jpeg;base64,${base64}`,
                detail: 'low' as const
              }
            }))
          ]
        }
      ],
      max_tokens: 300,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content || '{}';
    const analysis = JSON.parse(content);

    return {
      movementScore: analysis.movementScore || 50,
      faceScore: analysis.faceScore || 50,
      textScore: analysis.textScore || 50,
      patternBreakScore: analysis.patternBreakScore || 50,
      pacingScore: analysis.pacingScore || 50
    };
  }

  /**
   * Analyze audio energy in the hook
   */
  private static async analyzeAudioHook(videoPath: string, duration: number): Promise<number> {
    // Use FFmpeg to detect if audio starts immediately and has energy
    return new Promise((resolve) => {
      let hasEarlyAudio = false;
      let peakDetected = false;

      ffmpeg(videoPath)
        .setStartTime(0)
        .duration(duration)
        .audioFilters('astats=metadata=1:reset=1')
        .format('null')
        .on('stderr', (line: string) => {
          // Check if RMS level is above threshold in first 0.5s
          const timeMatch = line.match(/time=(\d+):(\d+):(\d+\.\d+)/);
          const rmsMatch = line.match(/RMS level dB: ([-\d.]+)/);

          if (timeMatch && rmsMatch) {
            const seconds = parseFloat(timeMatch[3]);
            const rmsLevel = parseFloat(rmsMatch[1]);

            if (seconds < 0.5 && rmsLevel > -30) {
              hasEarlyAudio = true;
            }
            if (rmsLevel > -15) {
              peakDetected = true;
            }
          }
        })
        .on('end', () => {
          let score = 50;
          if (hasEarlyAudio) score += 30;
          if (peakDetected) score += 20;
          resolve(Math.min(100, score));
        })
        .on('error', () => {
          resolve(50); // Default score on error
        })
        .save('-');
    });
  }

  /**
   * Generate recommendations based on factor scores
   */
  private static async generateRecommendations(factors: any, overallScore: number): Promise<{
    recommendation: string;
    improvementSuggestions: string[];
  }> {
    const suggestions: string[] = [];

    if (factors.visualMovement < 60) {
      suggestions.push("Add more motion in the first 2 seconds (camera movement, action, or transitions)");
    }
    if (factors.audioHook < 60) {
      suggestions.push("Start with immediate audio (music, speech, or sound effect)");
    }
    if (factors.facePresence < 40) {
      suggestions.push("Consider showing a human face in the first frame for connection");
    }
    if (factors.textOverlay < 50) {
      suggestions.push("Add text hook in first 1-2 seconds to drive curiosity");
    }
    if (factors.patternBreak < 60) {
      suggestions.push("Include an unexpected visual element to grab attention");
    }
    if (factors.pacing < 60) {
      suggestions.push("Add at least one cut within the first 3 seconds");
    }

    let recommendation = "";
    if (overallScore >= 85) {
      recommendation = "Strong hook! High retention predicted";
    } else if (overallScore >= 70) {
      recommendation = "Good hook with minor improvements suggested";
    } else if (overallScore >= 50) {
      recommendation = "Weak hook - specific improvements required";
    } else {
      recommendation = "Poor hook - consider re-editing first 3 seconds";
    }

    return { recommendation, improvementSuggestions: suggestions };
  }
}
