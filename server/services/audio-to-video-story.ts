
/**
 * Audio-to-Video Story Generator
 * V7.1: Converts podcast/voiceover audio into AI-generated video stories
 * 
 * Workflow:
 * 1. Upload audio file (podcast, voiceover, narration)
 * 2. Transcribe with OpenAI Whisper
 * 3. Analyze script to identify key scenes
 * 4. Generate AI videos with Runway Gen-3
 * 5. Sync videos with original audio timestamps
 */

import { storage } from '../storage';
import { InsertSmartSlice } from '@shared/schema';
import { generateCinematicPrompts, ScriptScene } from './ai-scene-analyzer';
import { generateRunwayVideo, RunwayGenerationParams } from './runway-api';
import { VideoProcessor } from './video-processor';
import OpenAI from 'openai';
import pLimit from 'p-limit';
import fs from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined,
});

export interface AudioToVideoOptions {
  videoStyle?: 'cinematic' | 'documentary' | 'dramatic' | 'realistic';
  sceneVideoDuration?: 4 | 6 | 8;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  userContext?: string;
  preserveAudioPacing?: boolean; // Sync cuts with audio pauses
}

export interface AudioTranscriptSegment {
  start: number;
  end: number;
  text: string;
}

/**
 * Main orchestration: Audio → Transcription → AI Videos → Final Story
 */
export async function generateVideoFromAudio(
  projectId: string,
  audioPath: string,
  options: AudioToVideoOptions = {}
): Promise<InsertSmartSlice[]> {
  console.log(`\n===== AUDIO-TO-VIDEO STORY GENERATION: ${projectId} =====`);
  console.log(`[AudioStory] Audio file: ${audioPath}`);

  const { progressMap } = await import('../routes');

  const {
    videoStyle = 'cinematic',
    sceneVideoDuration = 6,
    aspectRatio = '16:9',
    preserveAudioPacing = true,
  } = options;

  try {
    // Step 1: Transcribe audio with Whisper
    progressMap.set(projectId, {
      stage: 'analyzing',
      progress: 10,
      message: 'Transcribing audio with AI...',
    });

    console.log(`[AudioStory] Step 1: Transcribing audio...`);
    const transcript = await transcribeAudioFile(audioPath);
    console.log(`[AudioStory] ✓ Transcribed ${transcript.segments.length} segments`);

    // Step 2: Generate full script text
    const scriptContent = transcript.segments.map(s => s.text).join(' ');
    const totalDuration = transcript.duration;

    console.log(`[AudioStory] Audio duration: ${totalDuration}s`);
    console.log(`[AudioStory] Script: ${scriptContent.substring(0, 100)}...`);

    // Step 3: Calculate target scene count based on audio duration
    progressMap.set(projectId, {
      stage: 'analyzing',
      progress: 25,
      message: 'Analyzing audio content and planning scenes...',
    });

    const targetSceneCount = preserveAudioPacing
      ? Math.ceil(totalDuration / sceneVideoDuration)
      : Math.max(5, Math.min(15, Math.ceil(totalDuration / sceneVideoDuration)));

    console.log(`[AudioStory] Step 2: Generating ${targetSceneCount} cinematic prompts...`);
    if (options.userContext) {
      console.log(`[AudioStory] 💡 User context: "${options.userContext.substring(0, 80)}..."`);
    }

    // Step 4: Generate cinematic prompts from script
    progressMap.set(projectId, {
      stage: 'generating_prompts',
      progress: 35,
      message: `Creating ${targetSceneCount} visual scene prompts...`,
    });

    const scenes: ScriptScene[] = await generateCinematicPrompts(scriptContent, {
      style: videoStyle,
      sceneCount: targetSceneCount,
      userContext: options.userContext,
    });

    console.log(`[AudioStory] ✓ Generated ${scenes.length} cinematic prompts`);

    // Step 5: Map scenes to audio timestamps if preserving pacing
    if (preserveAudioPacing) {
      scenes.forEach((scene, i) => {
        const segmentStart = (i / scenes.length) * totalDuration;
        const segmentEnd = ((i + 1) / scenes.length) * totalDuration;
        scene.timestamp = segmentStart;
        console.log(`[AudioStory] Scene ${i + 1} synced to ${segmentStart.toFixed(1)}s - ${segmentEnd.toFixed(1)}s`);
      });
    }

    // Step 6: Generate AI videos with Runway Gen-3
    progressMap.set(projectId, {
      stage: 'generating_videos',
      progress: 45,
      message: `Generating ${scenes.length} AI video scenes...`,
    });

    console.log(`[AudioStory] Step 3: Generating ${scenes.length} AI videos with Runway...`);
    const limit = pLimit(2);

    let completedCount = 0;
    const videoPromises = scenes.map((scene, index) =>
      limit(async () => {
        console.log(`[AudioStory] [${index + 1}/${scenes.length}] Starting Runway generation...`);

        progressMap.set(projectId, {
          stage: 'generating_videos',
          progress: 45 + Math.floor((completedCount / scenes.length) * 45),
          message: `Generating scene ${completedCount + 1} of ${scenes.length}...`,
        });

        const runwayParams: RunwayGenerationParams = {
          prompt: scene.visualPrompt,
          duration: sceneVideoDuration,
          ratio: aspectRatio,
          style: videoStyle,
        };

        try {
          const result = await generateRunwayVideo(runwayParams);
          completedCount++;
          console.log(`[AudioStory] [${index + 1}/${scenes.length}] ✓ Video generated: ${result.localPath}`);
          
          return {
            scene,
            videoResult: result,
            success: true,
          };
        } catch (error: any) {
          completedCount++;
          console.error(`[AudioStory] [${index + 1}/${scenes.length}] ✗ Generation failed:`, error.message);
          return {
            scene,
            videoResult: null,
            success: false,
            error: error.message,
          };
        }
      })
    );

    const generatedVideos = await Promise.all(videoPromises);

    const successCount = generatedVideos.filter(v => v.success).length;
    console.log(`[AudioStory] Video generation complete: ${successCount}/${scenes.length} succeeded`);

    if (successCount === 0) {
      throw new Error('All AI video generations failed. Please check Runway API key and quota.');
    }

    // Step 7: Create SmartSlices with audio sync
    progressMap.set(projectId, {
      stage: 'generating_videos',
      progress: 90,
      message: 'Creating final video with synced audio...',
    });

    console.log(`[AudioStory] Step 4: Creating SmartSlices with audio sync...`);
    const slices: InsertSmartSlice[] = [];

    let currentTime = 0;
    for (let i = 0; i < generatedVideos.length; i++) {
      const { scene, videoResult, success } = generatedVideos[i];

      if (!success || !videoResult) {
        console.warn(`[AudioStory] Skipping failed scene ${i + 1}`);
        continue;
      }

      // Extract thumbnail
      let thumbnailPath: string | null = null;
      try {
        thumbnailPath = await VideoProcessor.extractThumbnail(videoResult.localPath, 0.5);
        console.log(`[AudioStory] Thumbnail extracted for scene ${i + 1}`);
      } catch (thumbErr) {
        console.warn(`[AudioStory] Failed to extract thumbnail for scene ${i + 1}:`, thumbErr);
      }

      // Get corresponding audio segment
      const audioSegment = transcript.segments.find(s => 
        s.start >= currentTime && s.start < currentTime + videoResult.duration
      );

      const slice: InsertSmartSlice = {
        projectId,
        order: i,
        startTime: currentTime,
        endTime: currentTime + videoResult.duration,
        transcription: audioSegment?.text || scene.narration || scene.visualPrompt,
        textContent: scene.narration,
        engagementScore: 90,
        thumbnailPath,
        clipType: 'ai-generated',
        cinematicPrompt: scene.visualPrompt,
        aiVideoPath: videoResult.localPath,
        aiVideoUrl: videoResult.videoUrl || null,
        aiGenerationStatus: 'ready',
      };

      slices.push(slice);
      currentTime += videoResult.duration;
    }

    // Step 8: Store slices in database
    console.log(`[AudioStory] Step 5: Storing ${slices.length} slices in database...`);
    const storedSlices = await storage.createSlices(slices);

    // Step 9: Merge videos with original audio
    progressMap.set(projectId, {
      stage: 'complete',
      progress: 100,
      message: 'Audio-to-video story complete!',
    });

    console.log(`[AudioStory] ✓ Audio-to-video story generation complete!`);
    console.log(`===== GENERATION END =====\n`);

    return storedSlices;
  } catch (error: any) {
    console.error(`[AudioStory] !!!!! GENERATION FAILED !!!!!`);
    console.error(`[AudioStory] Error:`, error);
    throw error;
  }
}

/**
 * Transcribe audio file using OpenAI Whisper
 */
async function transcribeAudioFile(audioPath: string): Promise<{
  segments: AudioTranscriptSegment[];
  duration: number;
  fullText: string;
}> {
  console.log(`[AudioStory] Transcribing audio: ${audioPath}`);

  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(audioPath),
    model: 'whisper-1',
    response_format: 'verbose_json',
    timestamp_granularities: ['segment'],
  });

  const segments: AudioTranscriptSegment[] = transcription.segments.map(seg => ({
    start: seg.start,
    end: seg.end,
    text: seg.text.trim(),
  }));

  const duration = segments.length > 0 ? segments[segments.length - 1].end : 0;
  const fullText = segments.map(s => s.text).join(' ');

  console.log(`[AudioStory] ✓ Transcription complete: ${segments.length} segments, ${duration}s`);

  return { segments, duration, fullText };
}
