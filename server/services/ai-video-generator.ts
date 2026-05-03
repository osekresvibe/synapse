/**
 * AI Video Generator Service
 * Orchestrates the complete AI video generation workflow
 * V5.0: Script → Cinematic Prompts → AI Videos → Final Compilation
 */

import { storage } from '../storage';
import { InsertSmartSlice } from '@shared/schema';
import { generateCinematicPrompts, ScriptScene } from './ai-scene-analyzer';
import { generateRunwayVideo, RunwayGenerationParams } from './runway-api';
import pLimit from 'p-limit';

export interface AIVideoProgress {
  stage: 'analyzing' | 'generating_prompts' | 'generating_videos' | 'complete' | 'error';
  progress: number; // 0-100
  message: string;
  scenesCompleted?: number;
  scenesTotal?: number;
}

export interface AIVideoGenerationOptions {
  videoStyle?: 'cinematic' | 'documentary' | 'dramatic' | 'realistic';
  sceneVideoDuration?: 4 | 6 | 8; // veo3.1 supports 4, 6, or 8 seconds
  aspectRatio?: '16:9' | '9:16' | '1:1';
  userContext?: string; // NEW: User-provided context
}

/**
 * Main orchestration function: Script → AI Videos → SmartSlices
 */
export async function generateAIVideoFromScript(
  projectId: string,
  scriptContent: string,
  options: AIVideoGenerationOptions = {}
): Promise<InsertSmartSlice[]> {
  console.log(`\n===== AI VIDEO GENERATION START: ${projectId} =====`);
  console.log(`[AI-Video] Script length: ${scriptContent.length} characters`);
  console.log(`[AI-Video] Options:`, JSON.stringify(options, null, 2));

  // Import progressMap from routes
  const { progressMap } = await import('../routes');

  // Validate Runway API key immediately
  if (!process.env.RUNWAY_API_KEY) {
    console.error(`[AI-Video] RUNWAY_API_KEY not found in environment variables`);
    throw new Error('Runway API key not configured. Please add RUNWAY_API_KEY to your secrets.');
  }

  console.log(`[AI-Video] ✓ Runway API key detected (length: ${process.env.RUNWAY_API_KEY.length})`);

  const {
    videoStyle = 'cinematic',
    sceneVideoDuration = 6,
    aspectRatio = '16:9',
  } = options;

  try {
    // Step 1: Parse script into cinematic prompts using GPT-4o
    progressMap.set(projectId, {
      stage: "analyzing",
      progress: 15,
      message: "Analyzing script and planning scenes...",
    });

    // Calculate target scene count based on script length (aim for ~30-60 second videos)
    const wordsInScript = scriptContent.split(/\s+/).length;
    const estimatedNarrationSeconds = Math.ceil(wordsInScript / 2.5); // ~2.5 words per second
    const targetSceneCount = Math.max(5, Math.min(15, Math.ceil(estimatedNarrationSeconds / sceneVideoDuration)));

    console.log(`[AI-Video] Step 1: Generating cinematic prompts...`);
    console.log(`[AI-Video] Script: ${wordsInScript} words → ${estimatedNarrationSeconds}s narration → ${targetSceneCount} scenes`);
    if (options.userContext) {
      console.log(`[AI-Video] 💡 User context: "${options.userContext.substring(0, 80)}..."`);
    }

    progressMap.set(projectId, {
      stage: "analyzing",
      progress: 25,
      message: `Creating ${targetSceneCount} cinematic scene prompts...`,
    });

    const scenes: ScriptScene[] = await generateCinematicPrompts(scriptContent, {
      style: videoStyle,
      sceneCount: targetSceneCount,
      userContext: options.userContext, // NEW: Pass context to scene analyzer
    });

    console.log(`[AI-Video] ✓ Generated ${scenes.length} cinematic prompts`);
    scenes.forEach((scene, i) => {
      console.log(`[AI-Video] Scene ${i + 1}: "${scene.visualPrompt.substring(0, 60)}..."`);
    });

    // Step 2: Generate AI videos with Runway Gen-3 (parallel processing)
    progressMap.set(projectId, {
      stage: "generating",
      progress: 35,
      message: `Generating ${scenes.length} AI video scenes with Runway...`,
    });

    console.log(`[AI-Video] Step 2: Generating ${scenes.length} AI videos with Runway...`);
    const limit = pLimit(4); // SPEED: Increased to 4 concurrent API calls (was 2)

    let completedCount = 0;
    const videoPromises = scenes.map((scene, index) =>
      limit(async () => {
        console.log(`[AI-Video] [${index + 1}/${scenes.length}] Starting Runway generation...`);

        progressMap.set(projectId, {
          stage: "generating",
          progress: 35 + Math.floor((completedCount / scenes.length) * 50),
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
          console.log(`[AI-Video] [${index + 1}/${scenes.length}] ✓ Video generated: ${result.localPath}`);
          
          progressMap.set(projectId, {
            stage: "generating",
            progress: 35 + Math.floor((completedCount / scenes.length) * 50),
            message: `Generated ${completedCount} of ${scenes.length} scenes...`,
          });

          return {
            scene,
            videoResult: result,
            success: true,
          };
        } catch (error: any) {
          completedCount++;
          console.error(`[AI-Video] [${index + 1}/${scenes.length}] ✗ Generation failed:`, error.message);
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
    const failCount = generatedVideos.filter(v => !v.success).length;

    console.log(`[AI-Video] Video generation complete: ${successCount} succeeded, ${failCount} failed`);

    if (successCount === 0) {
      throw new Error('All AI video generations failed. Please check Runway API key and quota.');
    }

    // Step 3: Create SmartSlices for each generated video
    progressMap.set(projectId, {
      stage: "generating",
      progress: 85,
      message: `Creating video slices and thumbnails...`,
    });

    console.log(`[AI-Video] Step 3: Creating SmartSlices...`);
    const slices: InsertSmartSlice[] = [];

    let currentTime = 0;
    for (let i = 0; i < generatedVideos.length; i++) {
      const { scene, videoResult, success } = generatedVideos[i];

      if (!success || !videoResult) {
        console.warn(`[AI-Video] Skipping failed scene ${i + 1}`);
        continue;
      }

      progressMap.set(projectId, {
        stage: "generating",
        progress: 85 + Math.floor((i / generatedVideos.length) * 10),
        message: `Processing scene ${i + 1} of ${generatedVideos.length}...`,
      });

      // Extract thumbnail from AI video (first frame at 0.5s for better preview)
      let thumbnailPath: string | null = null;
      try {
        const { VideoProcessor } = await import('./video-processor');
        thumbnailPath = await VideoProcessor.extractThumbnail(videoResult.localPath, 0.5);
        console.log(`[AI-Video] Thumbnail extracted for scene ${i + 1}: ${thumbnailPath}`);
      } catch (thumbErr) {
        console.warn(`[AI-Video] Failed to extract thumbnail for scene ${i + 1}:`, thumbErr);
      }

      const slice: InsertSmartSlice = {
        projectId,
        order: i,
        startTime: currentTime,
        endTime: currentTime + videoResult.duration,
        transcription: scene.narration || scene.visualPrompt,
        textContent: scene.narration,
        engagementScore: 90, // AI-generated videos assumed high quality
        thumbnailPath, // Extracted thumbnail for visual preview
        clipType: 'ai-generated',
        // AI Video specific fields
        cinematicPrompt: scene.visualPrompt,
        aiVideoPath: videoResult.localPath,
        aiVideoUrl: videoResult.videoUrl || null,
        aiGenerationStatus: 'ready',
      };

      slices.push(slice);
      currentTime += videoResult.duration;

      console.log(`[AI-Video] Created slice ${i + 1}: ${slice.startTime}s - ${slice.endTime}s`);
    }

    // Step 4: Store slices in database
    console.log(`[AI-Video] Step 4: Storing ${slices.length} slices in database...`);
    const storedSlices = await storage.createSlices(slices);
    console.log(`[AI-Video] ✓ Stored ${storedSlices.length} slices with IDs:`, storedSlices.map(s => s.id));

    // Step 5: Create video records for each AI-generated clip
    console.log(`[AI-Video] Step 5: Creating video records...`);
    const totalDuration = slices.reduce((sum, s) => sum + (s.endTime - s.startTime), 0);

    // Create a video record for each successfully stored slice
    for (let i = 0; i < storedSlices.length; i++) {
      const slice = storedSlices[i];
      if (slice.aiVideoPath) {
        await storage.createVideo({
          projectId,
          type: 'standard',
          duration: slice.endTime - slice.startTime,
          videoPath: slice.aiVideoPath,
          clipSequence: [slice.id],
          status: 'ready',
        });
      }
    }
    console.log(`[AI-Video] ✓ Created ${storedSlices.length} video records`);

    // Step 6: Ensure project is marked with correct type and status
    await storage.updateProject(projectId, {
      projectType: 'ai-video',
      status: 'ready',
    });
    console.log(`[AI-Video] ✓ Project marked as ai-video type with ready status`);

    console.log(`[AI-Video] ✓ AI video generation complete!`);
    console.log(`[AI-Video] Total duration: ${totalDuration}s`);
    console.log(`===== AI VIDEO GENERATION END =====\n`);

    return storedSlices;
  } catch (error: any) {
    console.error(`[AI-Video] !!!!! GENERATION FAILED !!!!!`);
    console.error(`[AI-Video] Error:`, error);
    console.error(`[AI-Video] Stack:`, error.stack);
    throw error;
  }
}