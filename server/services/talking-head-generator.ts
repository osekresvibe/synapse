
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';
import { TTSGenerator } from './tts-generator';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * AI TALKING HEAD GENERATOR
 * Generates AI avatar videos from scripts (for agencies, app intros, sales videos)
 * V5.1: Multi-provider support (HeyGen + D-ID) with automatic fallback
 */

export interface TalkingHeadOptions {
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  avatarStyle?: 'professional' | 'casual' | 'friendly' | 'authoritative';
  aspectRatio?: '16:9' | '9:16' | '1:1';
  provider?: 'heygen' | 'did' | 'auto'; // Provider selection
}

export interface TalkingHeadResult {
  videoPath: string;
  audioPath: string;
  duration: number;
  provider: string; // Which provider was used
}

/**
 * Generate AI talking head video from script
 * Uses HeyGen or D-ID API with automatic fallback
 */
export async function generateTalkingHeadVideo(
  scriptContent: string,
  options: TalkingHeadOptions = {}
): Promise<TalkingHeadResult> {
  console.log(`[TalkingHead] Generating AI avatar for script (${scriptContent.length} chars)...`);

  const {
    voice = 'nova',
    avatarStyle = 'professional',
    aspectRatio = '9:16',
    provider = 'auto',
  } = options;

  // Step 1: Generate voiceover audio
  console.log(`[TalkingHead] Step 1: Generating voiceover with ${voice} voice...`);
  const audioPath = await TTSGenerator.generateVoiceover(scriptContent, voice);
  
  // Get audio duration (approximate: 2.5 words per second)
  const wordCount = scriptContent.split(/\s+/).length;
  const estimatedDuration = Math.ceil(wordCount / 2.5);

  console.log(`[TalkingHead] Audio generated: ${audioPath} (~${estimatedDuration}s)`);

  // Step 2: Generate talking head video with selected provider
  let videoPath: string;
  let usedProvider: string;

  try {
    if (provider === 'heygen' || (provider === 'auto' && process.env.HEYGEN_API_KEY)) {
      console.log(`[TalkingHead] Attempting HeyGen generation...`);
      videoPath = await generateHeyGenVideo(scriptContent, audioPath, avatarStyle, aspectRatio);
      usedProvider = 'heygen';
    } else if (provider === 'did' || (provider === 'auto' && process.env.DID_API_KEY)) {
      console.log(`[TalkingHead] Attempting D-ID generation...`);
      videoPath = await generateDIDVideo(scriptContent, audioPath, avatarStyle, aspectRatio);
      usedProvider = 'did';
    } else {
      // Fallback to placeholder if no API keys available
      console.log(`[TalkingHead] No API keys found, using placeholder...`);
      videoPath = await generatePlaceholderTalkingHead(
        scriptContent,
        audioPath,
        estimatedDuration,
        avatarStyle,
        aspectRatio,
        nanoid()
      );
      usedProvider = 'placeholder';
    }
  } catch (error: any) {
    console.error(`[TalkingHead] Primary provider failed, trying fallback:`, error.message);
    
    // Auto-fallback logic
    if (provider === 'heygen' && process.env.DID_API_KEY) {
      videoPath = await generateDIDVideo(scriptContent, audioPath, avatarStyle, aspectRatio);
      usedProvider = 'did (fallback)';
    } else if (provider === 'did' && process.env.HEYGEN_API_KEY) {
      videoPath = await generateHeyGenVideo(scriptContent, audioPath, avatarStyle, aspectRatio);
      usedProvider = 'heygen (fallback)';
    } else {
      videoPath = await generatePlaceholderTalkingHead(
        scriptContent,
        audioPath,
        estimatedDuration,
        avatarStyle,
        aspectRatio,
        nanoid()
      );
      usedProvider = 'placeholder (fallback)';
    }
  }

  console.log(`[TalkingHead] ✓ Video generated using ${usedProvider}: ${videoPath}`);

  return {
    videoPath,
    audioPath,
    duration: estimatedDuration,
    provider: usedProvider,
  };
}

/**
 * Generate talking head using HeyGen API
 */
async function generateHeyGenVideo(
  script: string,
  audioPath: string,
  avatarStyle: string,
  aspectRatio: string
): Promise<string> {
  const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
  if (!HEYGEN_API_KEY) {
    throw new Error('HeyGen API key not configured');
  }

  // Avatar mapping based on style
  const avatarMap: Record<string, string> = {
    professional: 'Kristin_public_3_20240108', // Professional female
    casual: 'josh_lite3_20230714', // Casual male
    friendly: 'Angela-inblackskirt-20220820', // Friendly female
    authoritative: 'Wayne_20240711', // Authoritative male
  };

  const avatarId = avatarMap[avatarStyle] || avatarMap.professional;

  console.log(`[HeyGen] Creating video with avatar: ${avatarId}`);

  // Step 1: Create video generation request
  const response = await fetch('https://api.heygen.com/v2/video/generate', {
    method: 'POST',
    headers: {
      'X-Api-Key': HEYGEN_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      video_inputs: [{
        character: {
          type: 'avatar',
          avatar_id: avatarId,
          avatar_style: 'normal',
        },
        voice: {
          type: 'text',
          input_text: script,
          voice_id: '1bd001e7e50f421d891986aad5158bc8', // Default English voice
        },
        background: {
          type: 'color',
          value: '#ffffff',
        },
      }],
      dimension: {
        width: aspectRatio === '16:9' ? 1920 : aspectRatio === '1:1' ? 1080 : 1080,
        height: aspectRatio === '16:9' ? 1080 : aspectRatio === '1:1' ? 1080 : 1920,
      },
      test: false,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HeyGen API error: ${error}`);
  }

  const { data } = await response.json();
  const videoId = data.video_id;

  console.log(`[HeyGen] Video generation started: ${videoId}`);

  // Step 2: Poll for completion (HeyGen can take 1-3 minutes)
  let videoUrl: string | null = null;
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes max

  while (!videoUrl && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    attempts++;

    const statusResponse = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
      headers: { 'X-Api-Key': HEYGEN_API_KEY },
    });

    const statusData = await statusResponse.json();
    
    if (statusData.data.status === 'completed') {
      videoUrl = statusData.data.video_url;
      console.log(`[HeyGen] ✓ Video ready: ${videoUrl}`);
    } else if (statusData.data.status === 'failed') {
      throw new Error(`HeyGen generation failed: ${statusData.data.error}`);
    } else {
      console.log(`[HeyGen] Status: ${statusData.data.status} (attempt ${attempts}/${maxAttempts})`);
    }
  }

  if (!videoUrl) {
    throw new Error('HeyGen video generation timed out');
  }

  // Step 3: Download video
  const videoResponse = await fetch(videoUrl);
  const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
  
  const VIDEOS_DIR = path.join(process.cwd(), 'uploads', 'videos');
  const videoPath = path.join(VIDEOS_DIR, `heygen-${nanoid()}.mp4`);
  
  fs.writeFileSync(videoPath, videoBuffer);
  console.log(`[HeyGen] ✓ Video downloaded: ${videoPath}`);

  return videoPath;
}

/**
 * Generate talking head using D-ID API
 */
async function generateDIDVideo(
  script: string,
  audioPath: string,
  avatarStyle: string,
  aspectRatio: string
): Promise<string> {
  const DID_API_KEY = process.env.DID_API_KEY;
  if (!DID_API_KEY) {
    throw new Error('D-ID API key not configured');
  }

  // Presenter mapping based on style
  const presenterMap: Record<string, string> = {
    professional: 'amy-jcwCkr1grs', // Professional female
    casual: 'jacob-j4tOmcbfg1', // Casual male
    friendly: 'anna-Qj8ZWXp5gg', // Friendly female
    authoritative: 'john-_h_n7WPPnK', // Authoritative male
  };

  const presenterId = presenterMap[avatarStyle] || presenterMap.professional;

  console.log(`[D-ID] Creating video with presenter: ${presenterId}`);

  // Step 1: Upload audio to D-ID (if using custom audio)
  // For now, we'll use D-ID's TTS instead
  const response = await fetch('https://api.d-id.com/talks', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${DID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      script: {
        type: 'text',
        input: script,
        provider: {
          type: 'microsoft',
          voice_id: 'en-US-JennyNeural', // Default voice
        },
      },
      source_url: `https://create-images-results.d-id.com/default-presenters/${presenterId}/image.jpeg`,
      config: {
        stitch: true,
        result_format: 'mp4',
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`D-ID API error: ${error}`);
  }

  const { id: talkId } = await response.json();
  console.log(`[D-ID] Video generation started: ${talkId}`);

  // Step 2: Poll for completion (D-ID is usually faster: 30-60 seconds)
  let videoUrl: string | null = null;
  let attempts = 0;
  const maxAttempts = 30; // 2.5 minutes max

  while (!videoUrl && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    attempts++;

    const statusResponse = await fetch(`https://api.d-id.com/talks/${talkId}`, {
      headers: { 'Authorization': `Basic ${DID_API_KEY}` },
    });

    const statusData = await statusResponse.json();
    
    if (statusData.status === 'done') {
      videoUrl = statusData.result_url;
      console.log(`[D-ID] ✓ Video ready: ${videoUrl}`);
    } else if (statusData.status === 'error') {
      throw new Error(`D-ID generation failed: ${statusData.error}`);
    } else {
      console.log(`[D-ID] Status: ${statusData.status} (attempt ${attempts}/${maxAttempts})`);
    }
  }

  if (!videoUrl) {
    throw new Error('D-ID video generation timed out');
  }

  // Step 3: Download video
  const videoResponse = await fetch(videoUrl);
  const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
  
  const VIDEOS_DIR = path.join(process.cwd(), 'uploads', 'videos');
  const videoPath = path.join(VIDEOS_DIR, `did-${nanoid()}.mp4`);
  
  fs.writeFileSync(videoPath, videoBuffer);
  console.log(`[D-ID] ✓ Video downloaded: ${videoPath}`);

  return videoPath;
}

/**
 * PLACEHOLDER: Generate talking head video using FFmpeg (fallback)
 */
async function generatePlaceholderTalkingHead(
  scriptContent: string,
  audioPath: string,
  duration: number,
  avatarStyle: string,
  aspectRatio: string,
  videoId: string
): Promise<string> {
  const ffmpeg = (await import('fluent-ffmpeg')).default;
  const VIDEOS_DIR = path.join(process.cwd(), 'uploads', 'videos');
  const outputPath = path.join(VIDEOS_DIR, `talking-head-${videoId}.mp4`);

  const dimensions: Record<string, { width: number; height: number }> = {
    '16:9': { width: 1920, height: 1080 },
    '9:16': { width: 1080, height: 1920 },
    '1:1': { width: 1080, height: 1080 },
  };

  const { width, height } = dimensions[aspectRatio];

  const avatarColors: Record<string, string> = {
    professional: '#1e40af',
    casual: '#10b981',
    friendly: '#f59e0b',
    authoritative: '#6b21a8',
  };

  const bgColor = avatarColors[avatarStyle];

  console.log(`[TalkingHead] Creating placeholder video with ${avatarStyle} style...`);

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(`color=c=${bgColor}:s=${width}x${height}:d=${duration}`)
      .inputFormat('lavfi')
      .input(audioPath)
      .complexFilter([
        `color=c=black@0.4:s=${width}x${height}[overlay]`,
        `[0:v][overlay]overlay=0:0[bg]`,
        `[bg]drawtext=text='AI TALKING HEAD':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=h/3:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf[text1]`,
        `[text1]drawtext=text='${scriptContent.substring(0, 100).replace(/'/g, "\\'")}...':fontcolor=white:fontsize=32:x=(w-text_w)/2:y=h/2:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf[final]`,
      ])
      .outputOptions([
        '-map', '[final]',
        '-map', '1:a',
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-preset', 'veryfast',
        '-crf', '23',
        '-shortest',
      ])
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run();
  });
}
