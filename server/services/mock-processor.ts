import type { InsertSmartSlice, InsertGeneratedVideo } from "@shared/schema";
import path from "path";

/**
 * Mock processor for testing without real video files
 * Generates fake data instantly to test the UI and workflow
 */
export class MockProcessor {
  static async createMockSlices(
    projectId: string,
    duration: number
  ): Promise<InsertSmartSlice[]> {
    const slices: InsertSmartSlice[] = [];
    const segmentDuration = 10;
    const numSegments = Math.floor(duration / segmentDuration);

    console.log(`[MOCK] Creating ${numSegments} mock slices for ${duration}s video`);

    for (let i = 0; i < numSegments; i++) {
      const startTime = i * segmentDuration;
      const endTime = Math.min(startTime + segmentDuration, duration);
      const engagementScore = Math.floor(Math.random() * 40) + 60;

      slices.push({
        projectId,
        startTime,
        endTime,
        transcription: `Mock segment ${i + 1}: Sample content from ${startTime}s to ${endTime}s`,
        engagementScore,
        thumbnailPath: null,
        clipType: i % 3 === 0 ? "speech" : i % 3 === 1 ? "broll" : "action",
      });
    }

    return slices;
  }

  static async createMockVideos(
    projectId: string,
    slices: Array<InsertSmartSlice & { id: string }>,
    userIntent: {
      type: string;
      singleDuration?: number;
      multipleCount?: number;
      multipleClipDuration?: number;
    }
  ): Promise<InsertGeneratedVideo[]> {
    const videos: InsertGeneratedVideo[] = [];

    console.log(`[MOCK] Creating videos based on intent:`, userIntent);

    switch (userIntent.type) {
      case "single-video":
        videos.push({
          projectId,
          type: "standard",
          duration: userIntent.singleDuration || 60,
          clipSequence: this.selectMockClips(slices, userIntent.singleDuration || 60, 8),
          videoPath: `/mock/single_${projectId}.mp4`,
          status: "ready",
        });
        break;

      case "multiple-clips":
        const count = userIntent.multipleCount || 3;
        const clipDuration = userIntent.multipleClipDuration || 15;
        for (let i = 0; i < count; i++) {
          videos.push({
            projectId,
            type: "short",
            duration: clipDuration,
            clipSequence: this.selectMockClips(slices, clipDuration, 3),
            videoPath: `/mock/short_${i}_${projectId}.mp4`,
            status: "ready",
          });
        }
        break;

      case "comprehensive":
        videos.push({
          projectId,
          type: "comprehensive",
          duration: 180,
          clipSequence: this.selectMockClips(slices, 180, 20),
          videoPath: `/mock/comprehensive_${projectId}.mp4`,
          status: "ready",
        });
        break;

      case "custom":
        // Custom configuration - use provided values from intentConfig
        const customDuration = (userIntent as any).targetDuration || 60;
        const customType = customDuration <= 20 ? "short" : customDuration <= 90 ? "standard" : "comprehensive";
        videos.push({
          projectId,
          type: customType,
          duration: customDuration,
          clipSequence: this.selectMockClips(slices, customDuration, Math.ceil(customDuration / 10)),
          videoPath: `/mock/custom_${projectId}.mp4`,
          status: "ready",
        });
        break;

      case "ai-decide":
        // AI decides best format based on content - default to standard for now
        videos.push({
          projectId,
          type: "standard",
          duration: 60,
          clipSequence: this.selectMockClips(slices, 60, 8),
          videoPath: `/mock/standard_${projectId}.mp4`,
          status: "ready",
        });
        break;
    }

    console.log(`[MOCK] Created ${videos.length} mock video(s)`);
    return videos;
  }

  private static selectMockClips(
    slices: Array<InsertSmartSlice & { id: string }>,
    targetDuration: number,
    maxClips: number
  ): string[] {
    if (!slices || slices.length === 0) {
      console.warn(`[selectMockClips] No slices available!`);
      return [];
    }

    const clipSequence: string[] = [];
    let currentDuration = 0;

    // Sort by engagement score
    const sortedSlices = [...slices].sort(
      (a, b) => (b.engagementScore || 0) - (a.engagementScore || 0)
    );

    console.log(`[selectMockClips] Selecting from ${sortedSlices.length} slices for ${targetDuration}s target`);

    for (const slice of sortedSlices) {
      if (clipSequence.length >= maxClips) break;

      const clipDuration = slice.endTime - slice.startTime;

      // Be more lenient with duration matching for short clips
      if (currentDuration + clipDuration <= targetDuration + 10) {
        clipSequence.push(slice.id);
        currentDuration += clipDuration;
        console.log(`[selectMockClips] Added slice ${slice.id}, duration: ${clipDuration}s, total: ${currentDuration}s`);
      }

      // If we're close to target duration, stop
      if (currentDuration >= targetDuration - 3) break;
    }

    console.log(`[selectMockClips] Selected ${clipSequence.length} clips for total ${currentDuration}s`);
    return clipSequence;
  }
}