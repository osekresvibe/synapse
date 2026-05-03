import { db } from "../db";
import { editingFeedback, clipFeedback, learnedWeights } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import type { 
  InsertEditingFeedback, 
  InsertClipFeedback,
  EditingFeedback,
  ClipFeedback,
  LearnedWeights
} from "@shared/schema";

// Weight types we learn
type WeightType = 
  | "engagement_boost"      // Adjust engagement score thresholds
  | "duration_preference"   // Preferred clip duration
  | "hook_priority"         // Priority for hook selection
  | "pacing_multiplier";    // How fast cuts should be

// Learned weight cache (refreshed periodically)
const weightCache: Map<string, LearnedWeights[]> = new Map();
let cacheLastUpdated = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class FeedbackLearningService {
  
  /**
   * Store feedback for a generated video
   */
  static async storeFeedback(feedback: InsertEditingFeedback): Promise<EditingFeedback> {
    const [result] = await db.insert(editingFeedback).values(feedback).returning();
    console.log(`[FeedbackLearning] Stored feedback for video ${feedback.generatedVideoId}: ${feedback.action}`);
    return result;
  }

  /**
   * Store per-clip feedback
   */
  static async storeClipFeedback(clips: InsertClipFeedback[]): Promise<ClipFeedback[]> {
    if (clips.length === 0) return [];
    const results = await db.insert(clipFeedback).values(clips).returning();
    console.log(`[FeedbackLearning] Stored ${clips.length} clip ratings`);
    return results;
  }

  /**
   * Record that a video was accepted (user exported/downloaded)
   */
  static async recordAcceptance(
    projectId: string,
    generatedVideoId: string,
    videoCategory: string | null,
    clipSequence: string[],
    duration: number,
    regenerationCount: number = 0,
    timeToAcceptMs?: number
  ): Promise<void> {
    try {
      const feedbackRecord = await this.storeFeedback({
        projectId,
        generatedVideoId,
        videoCategory,
        action: "accepted",
        clipSequence,
        actualDuration: duration,
        regenerationCount,
        timeToAccept: timeToAcceptMs ? Math.round(timeToAcceptMs / 1000) : undefined,
      });
      
      // Store implicit "kept" action for all clips with correct FK
      if (clipSequence.length > 0 && feedbackRecord.id) {
        const clipFeedbacks: InsertClipFeedback[] = clipSequence.map((sliceId, idx) => ({
          editingFeedbackId: feedbackRecord.id,
          sliceId,
          action: "kept",
          position: idx === 0 ? "hook" : idx === clipSequence.length - 1 ? "closer" : "middle",
        }));
        
        await this.storeClipFeedback(clipFeedbacks);
      }
      
      // Trigger weight recomputation (non-blocking)
      this.recomputeWeights(videoCategory || "generic").catch(err => {
        console.warn(`[FeedbackLearning] Weight recomputation failed:`, err.message);
      });
    } catch (error: any) {
      console.error(`[FeedbackLearning] Error recording acceptance:`, error.message);
    }
  }

  /**
   * Record that a video was regenerated (user wasn't satisfied)
   */
  static async recordRegeneration(
    projectId: string,
    generatedVideoId: string,
    videoCategory: string | null,
    clipSequence: string[],
    feedbackText?: string
  ): Promise<void> {
    await this.storeFeedback({
      projectId,
      generatedVideoId,
      videoCategory,
      action: "regenerated",
      clipSequence,
      feedbackText,
    });
    
    console.log(`[FeedbackLearning] Recorded regeneration for ${videoCategory || 'generic'} video`);
  }

  /**
   * Record explicit user rating
   */
  static async recordRating(
    projectId: string,
    generatedVideoId: string,
    rating: number,
    videoCategory: string | null,
    feedbackText?: string
  ): Promise<void> {
    await this.storeFeedback({
      projectId,
      generatedVideoId,
      videoCategory,
      action: rating >= 4 ? "accepted" : "regenerated",
      overallRating: rating,
      feedbackText,
    });
  }

  /**
   * Get learned weights for a video category
   */
  static async getWeights(videoCategory: string): Promise<LearnedWeights[]> {
    const now = Date.now();
    
    // Check cache
    if (now - cacheLastUpdated < CACHE_TTL_MS && weightCache.has(videoCategory)) {
      return weightCache.get(videoCategory)!;
    }
    
    // Fetch from DB
    const weights = await db.select()
      .from(learnedWeights)
      .where(eq(learnedWeights.videoCategory, videoCategory));
    
    weightCache.set(videoCategory, weights);
    cacheLastUpdated = now;
    
    return weights;
  }

  /**
   * Get engagement score multiplier based on learned preferences
   */
  static async getEngagementMultiplier(
    videoCategory: string, 
    clipType: string | null
  ): Promise<number> {
    const weights = await this.getWeights(videoCategory);
    
    // Find specific weight for this clip type
    const clipWeight = weights.find(
      w => w.weightType === "engagement_boost" && w.clipType === clipType
    );
    
    // Or category-wide weight
    const categoryWeight = weights.find(
      w => w.weightType === "engagement_boost" && !w.clipType
    );
    
    return clipWeight?.weightValue ?? categoryWeight?.weightValue ?? 1.0;
  }

  /**
   * Get preferred clip duration for a category/type
   */
  static async getPreferredDuration(
    videoCategory: string,
    clipType: string | null
  ): Promise<{ min: number; max: number; target: number } | null> {
    const weights = await this.getWeights(videoCategory);
    
    const durationWeight = weights.find(
      w => w.weightType === "duration_preference" && 
           (w.clipType === clipType || !w.clipType)
    );
    
    if (!durationWeight?.avgDuration) return null;
    
    const target = durationWeight.avgDuration;
    return {
      min: Math.max(1, target * 0.7),
      max: target * 1.3,
      target,
    };
  }

  /**
   * Get hook selection priority for a category
   */
  static async getHookPriority(videoCategory: string): Promise<{
    preferHighEnergy: boolean;
    preferSpeech: boolean;
    minEngagement: number;
  }> {
    const weights = await this.getWeights(videoCategory);
    
    const hookWeight = weights.find(w => w.weightType === "hook_priority");
    
    // Default priorities by category
    const defaults: Record<string, { preferHighEnergy: boolean; preferSpeech: boolean; minEngagement: number }> = {
      music_video: { preferHighEnergy: true, preferSpeech: false, minEngagement: 70 },
      talking_head: { preferHighEnergy: false, preferSpeech: true, minEngagement: 65 },
      podcast: { preferHighEnergy: false, preferSpeech: true, minEngagement: 60 },
      tutorial: { preferHighEnergy: false, preferSpeech: true, minEngagement: 55 },
      trailer: { preferHighEnergy: true, preferSpeech: false, minEngagement: 80 },
    };
    
    if (hookWeight) {
      return {
        preferHighEnergy: hookWeight.weightValue > 1.2,
        preferSpeech: hookWeight.weightValue < 0.8,
        minEngagement: Math.round(60 * hookWeight.weightValue),
      };
    }
    
    return defaults[videoCategory] || defaults.talking_head;
  }

  /**
   * Recompute learned weights from feedback history
   * Uses exponential moving average to weight recent feedback higher
   */
  static async recomputeWeights(videoCategory: string): Promise<void> {
    console.log(`[FeedbackLearning] Recomputing weights for ${videoCategory}...`);
    
    // Get all feedback for this category
    const feedbackHistory = await db.select()
      .from(editingFeedback)
      .where(eq(editingFeedback.videoCategory, videoCategory))
      .orderBy(desc(editingFeedback.createdAt))
      .limit(100); // Last 100 feedbacks
    
    if (feedbackHistory.length < 3) {
      console.log(`[FeedbackLearning] Not enough feedback (${feedbackHistory.length}) to learn from`);
      return;
    }
    
    // Calculate acceptance rate
    const accepted = feedbackHistory.filter(f => f.action === "accepted").length;
    const acceptanceRate = accepted / feedbackHistory.length;
    
    // Calculate average rating (if available)
    const rated = feedbackHistory.filter(f => f.overallRating);
    const avgRating = rated.length > 0 
      ? rated.reduce((sum, f) => sum + (f.overallRating || 0), 0) / rated.length 
      : null;
    
    // Calculate engagement boost based on success
    // If acceptance rate is high, reduce threshold; if low, increase threshold
    const engagementBoost = 1 + (acceptanceRate - 0.5) * 0.4; // Range: 0.8 - 1.2
    
    // Upsert the category-wide weight
    await db.insert(learnedWeights)
      .values({
        videoCategory,
        clipType: null,
        weightType: "engagement_boost",
        weightValue: engagementBoost,
        sampleCount: feedbackHistory.length,
        successRate: acceptanceRate,
        avgRating,
      })
      .onConflictDoUpdate({
        target: [learnedWeights.videoCategory, learnedWeights.clipType, learnedWeights.weightType],
        set: {
          weightValue: engagementBoost,
          sampleCount: feedbackHistory.length,
          successRate: acceptanceRate,
          avgRating,
          lastUpdated: sql`now()`,
        },
      });
    
    // Clear cache to force refresh
    weightCache.delete(videoCategory);
    
    console.log(`[FeedbackLearning] Updated weights for ${videoCategory}: boost=${engagementBoost.toFixed(2)}, acceptance=${(acceptanceRate * 100).toFixed(1)}%`);
  }

  /**
   * Get learning metrics for dashboard
   */
  static async getMetrics(): Promise<{
    totalFeedback: number;
    byCategory: Record<string, { count: number; acceptanceRate: number; avgRating: number | null }>;
    improvementTrend: "improving" | "stable" | "declining" | "insufficient_data";
  }> {
    // Get all feedback counts
    const allFeedback = await db.select({
      videoCategory: editingFeedback.videoCategory,
      action: editingFeedback.action,
      rating: editingFeedback.overallRating,
    }).from(editingFeedback);
    
    const totalFeedback = allFeedback.length;
    
    // Group by category
    const byCategory: Record<string, { count: number; accepted: number; ratings: number[] }> = {};
    
    for (const fb of allFeedback) {
      const cat = fb.videoCategory || "generic";
      if (!byCategory[cat]) {
        byCategory[cat] = { count: 0, accepted: 0, ratings: [] };
      }
      byCategory[cat].count++;
      if (fb.action === "accepted") byCategory[cat].accepted++;
      if (fb.rating) byCategory[cat].ratings.push(fb.rating);
    }
    
    const categoryMetrics: Record<string, { count: number; acceptanceRate: number; avgRating: number | null }> = {};
    for (const [cat, data] of Object.entries(byCategory)) {
      categoryMetrics[cat] = {
        count: data.count,
        acceptanceRate: data.count > 0 ? data.accepted / data.count : 0,
        avgRating: data.ratings.length > 0 
          ? data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length 
          : null,
      };
    }
    
    // Calculate improvement trend (compare recent vs older)
    let improvementTrend: "improving" | "stable" | "declining" | "insufficient_data" = "insufficient_data";
    
    if (totalFeedback >= 20) {
      const recent = allFeedback.slice(0, Math.floor(totalFeedback / 2));
      const older = allFeedback.slice(Math.floor(totalFeedback / 2));
      
      const recentAcceptance = recent.filter(f => f.action === "accepted").length / recent.length;
      const olderAcceptance = older.filter(f => f.action === "accepted").length / older.length;
      
      const diff = recentAcceptance - olderAcceptance;
      if (diff > 0.1) improvementTrend = "improving";
      else if (diff < -0.1) improvementTrend = "declining";
      else improvementTrend = "stable";
    }
    
    return { totalFeedback, byCategory: categoryMetrics, improvementTrend };
  }

  /**
   * Export feedback data for analysis
   */
  static async exportFeedbackData(): Promise<{
    feedback: EditingFeedback[];
    clips: ClipFeedback[];
    weights: LearnedWeights[];
  }> {
    const [feedback, clips, weights] = await Promise.all([
      db.select().from(editingFeedback).orderBy(desc(editingFeedback.createdAt)).limit(500),
      db.select().from(clipFeedback).orderBy(desc(clipFeedback.createdAt)).limit(2000),
      db.select().from(learnedWeights),
    ]);
    
    return { feedback, clips, weights };
  }
}
