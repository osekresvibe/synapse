/**
 * Runway Gen-3 API Integration Service
 * Handles text-to-video generation using Runway's Gen-3 Turbo model
 * V5.0: AI Cinematic Video Generation
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { nanoid } from 'nanoid';

const RUNWAY_API_BASE = 'https://api.dev.runwayml.com/v1';
const POLL_INTERVAL = 5000; // 5 seconds
const MAX_POLL_ATTEMPTS = 120; // 10 minutes max (120 * 5s)

export interface RunwayGenerationParams {
  prompt: string;
  duration?: number; // seconds (veo3.1 accepts: 4, 6, or 8)
  ratio?: '16:9' | '9:16' | '1:1';
  model?: 'gen3a_turbo' | 'gen3a';
  style?: 'cinematic' | 'documentary' | 'dramatic' | 'realistic';
}

export interface RunwayGenerationResult {
  videoUrl: string;
  localPath: string;
  duration: number;
  status: 'ready' | 'failed';
}

/**
 * Generate AI video using Runway Gen-3 API
 */
export async function generateRunwayVideo(
  params: RunwayGenerationParams
): Promise<RunwayGenerationResult> {
  const apiKey = process.env.RUNWAY_API_KEY;
  
  if (!apiKey) {
    throw new Error('RUNWAY_API_KEY environment variable is not set');
  }

  // Validate API key exists and has reasonable length
  if (apiKey.length < 20) {
    console.error(`[Runway] Invalid API key format. Key is too short (length: ${apiKey.length})`);
    throw new Error('RUNWAY_API_KEY appears to be invalid. Please check your Runway API key.');
  }
  
  console.log(`[Runway] Using API key: ${apiKey.substring(0, 8)}... (length: ${apiKey.length})`);

  console.log(`[Runway] Starting video generation for prompt: "${params.prompt.substring(0, 50)}..."`);

  // Step 1: Initiate generation (Official Runway API format)
  // Use text_to_video endpoint with veo3.1 model (Google Veo 3.1)
  // Note: gen3a_turbo is only available for image_to_video, not text_to_video
  const ratioMap: Record<string, string> = {
    '16:9': '1280:720',
    '9:16': '720:1280',
    '1:1': '1920:1080', // veo3.1 doesn't support 1:1, using 16:9 instead
  };
  
  const generationRequest = {
    model: 'veo3.1',  // Google Veo 3.1 - supports text-to-video
    promptText: enhancePromptWithStyle(params.prompt, params.style),
    ratio: ratioMap[params.ratio || '16:9'] || '1280:720',
    duration: params.duration || 4,  // veo3.1 supports 4, 6, or 8 seconds
  };

  console.log(`[Runway] Request params:`, JSON.stringify(generationRequest, null, 2));

  try {
    const response = await axios.post(
      `${RUNWAY_API_BASE}/text_to_video`,
      generationRequest,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-Runway-Version': '2024-11-06',
        },
        timeout: 30000, // 30 second timeout
      }
    );

    const taskId = response.data.id;
    
    if (!taskId) {
      console.error('[Runway] No task ID in response:', response.data);
      throw new Error('Failed to get task ID from Runway API');
    }

    console.log(`[Runway] Generation started. Task ID: ${taskId}`);

    // Step 2: Poll for completion
    const result = await pollForCompletion(taskId, apiKey);

    // Step 3: Download video locally
    const localPath = await downloadVideo(result.videoUrl);

    console.log(`[Runway] ✓ Video generation complete: ${localPath}`);

    return {
      videoUrl: result.videoUrl,
      localPath,
      duration: params.duration || 5,
      status: 'ready',
    };
  } catch (error: any) {
    console.error('[Runway] Generation failed:', error.message);
    if (error.response) {
      console.error('[Runway] API Error Status:', error.response.status);
      console.error('[Runway] API Error Response:', JSON.stringify(error.response.data).substring(0, 500));
    }
    
    // Provide user-friendly error messages
    if (error.response?.status === 401) {
      throw new Error('Runway API key is invalid or expired. Please check your RUNWAY_API_KEY in environment secrets.');
    } else if (error.response?.status === 402 || error.response?.status === 429) {
      throw new Error('Runway API quota exceeded or rate limited. Please check your Runway account billing.');
    }
    
    throw new Error(`Runway video generation failed: ${error.message}`);
  }
}

/**
 * Enhance prompt with cinematic style keywords
 */
function enhancePromptWithStyle(prompt: string, style?: string): string {
  const styleEnhancements: Record<string, string> = {
    cinematic: 'cinematic lighting, professional cinematography, 4K quality, film grain',
    documentary: 'documentary style, realistic footage, news broadcast quality, professional',
    dramatic: 'dramatic lighting, intense atmosphere, high contrast, moody cinematography',
    realistic: 'photorealistic, natural lighting, real-world footage, authentic',
  };

  const enhancement = style ? styleEnhancements[style] : styleEnhancements.cinematic;
  return `${prompt}, ${enhancement}`;
}

/**
 * Poll Runway API for task completion
 */
async function pollForCompletion(
  taskId: string,
  apiKey: string
): Promise<{ videoUrl: string }> {
  console.log(`[Runway] Polling for task ${taskId}...`);

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    try {
      const response = await axios.get(
        `${RUNWAY_API_BASE}/tasks/${taskId}`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'X-Runway-Version': '2024-11-06',
          },
          timeout: 15000, // 15 second timeout for polling
        }
      );

      const status = response.data.status;
      const progress = response.data.progress || 0;
      console.log(`[Runway] Attempt ${attempt + 1}/${MAX_POLL_ATTEMPTS} - Status: ${status}, Progress: ${Math.round(progress * 100)}%`);

      if (status === 'SUCCEEDED') {
        const videoUrl = response.data.output?.[0];
        
        if (!videoUrl) {
          console.error('[Runway] No video URL in completed response:', response.data);
          throw new Error('Video generation completed but no URL returned');
        }

        console.log(`[Runway] ✓ Generation complete! Video URL: ${videoUrl}`);
        return { videoUrl };
      }

      if (status === 'FAILED') {
        const errorMsg = response.data.failure || response.data.failureCode || 'Unknown error';
        throw new Error(`Runway generation failed: ${errorMsg}`);
      }

      // Still processing (PENDING or RUNNING), wait before next poll
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));

    } catch (error: any) {
      if (error.message.includes('failed')) {
        throw error; // Propagate generation failures
      }
      // Retry on network errors
      console.warn(`[Runway] Poll attempt ${attempt + 1} failed:`, error.message);
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    }
  }

  throw new Error(`Runway video generation timed out after ${MAX_POLL_ATTEMPTS * POLL_INTERVAL / 1000} seconds`);
}

/**
 * Download video from URL to local storage
 */
async function downloadVideo(videoUrl: string): Promise<string> {
  const uploadDir = path.join(process.cwd(), 'uploads', 'ai-videos');
  
  // Ensure directory exists
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const filename = `runway-${nanoid()}.mp4`;
  const filePath = path.join(uploadDir, filename);

  console.log(`[Runway] Downloading video from: ${videoUrl}`);

  try {
    const response = await axios.get(videoUrl, {
      responseType: 'stream',
      timeout: 60000, // 60 second timeout
    });

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    const stats = fs.statSync(filePath);
    console.log(`[Runway] ✓ Video downloaded: ${filename} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

    return `/uploads/ai-videos/${filename}`;
  } catch (error: any) {
    console.error('[Runway] Download failed:', error.message);
    throw new Error(`Failed to download video: ${error.message}`);
  }
}

/**
 * Batch generate multiple videos in parallel (with concurrency limit)
 */
export async function batchGenerateVideos(
  prompts: RunwayGenerationParams[],
  concurrency: number = 3
): Promise<RunwayGenerationResult[]> {
  console.log(`[Runway] Batch generating ${prompts.length} videos with concurrency ${concurrency}`);

  const results: RunwayGenerationResult[] = [];
  const chunks: RunwayGenerationParams[][] = [];

  // Split into chunks based on concurrency
  for (let i = 0; i < prompts.length; i += concurrency) {
    chunks.push(prompts.slice(i, i + concurrency));
  }

  // Process ALL chunks in parallel (no serial batching)
  console.log(`[Runway] Processing all ${videoParams.length} videos in parallel`);
  const allResults = await Promise.all(
    videoParams.map(params => generateRunwayVideo(params))
  );

  results.push(...allResults);

  console.log(`[Runway] ✓ Batch generation complete: ${results.length} videos`);
  return results;
}
