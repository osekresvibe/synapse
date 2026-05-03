
import { nanoid } from "nanoid";

interface SliceInfo {
  engagementScore: number;
  clipType: string;
  startTime: number;
  endTime: number;
}

interface QualityScores {
  overall: number;
  technicalQuality: number;
  uniqueness: number;
  dynamism: number;
  usability: number;
  narrativeStructure: number;
  hookStrength: number;
  pacingFlow: number;
  engagementCurve: number;
  retentionPotential: number;
  platformOptimization: number;
}

interface QualityReport {
  id: string;
  projectId: string;
  videoId: string;
  videoType: "short" | "standard" | "comprehensive";
  qualityScores: QualityScores;
  competitiveRank: "S" | "A" | "B" | "C" | "D";
  recommendations: string[];
  strengths: string[];
  warnings: string[];
  timestamp: Date;
}

interface PlatformBenchmark {
  averageOverall: number;
  averageByType: {
    short: number;
    standard: number;
    comprehensive: number;
  };
  topPerformerScore: number;
  industryStandard: number;
}

const qualityReports: Map<string, QualityReport> = new Map();

export class QualityScorer {
  private static readonly INDUSTRY_STANDARD = 75;
  private static readonly RANK_THRESHOLDS = {
    S: 90,
    A: 80,
    B: 70,
    C: 60,
    D: 0,
  };

  static async generateQualityReport(
    projectId: string,
    videoId: string,
    videoType: "short" | "standard" | "comprehensive",
    videoPath: string,
    slices: SliceInfo[],
    sourceDuration: number
  ): Promise<QualityReport> {
    console.log(`[QualityScorer] Generating report for ${videoType} video`);

    const scores = this.calculateQualityScores(slices, videoType, sourceDuration);
    const rank = this.determineRank(scores.overall);
    const recommendations = this.generateRecommendations(scores, videoType, slices);
    const strengths = this.identifyStrengths(scores, slices);
    const warnings = this.generateWarnings(scores, slices);

    const report: QualityReport = {
      id: nanoid(),
      projectId,
      videoId,
      videoType,
      qualityScores: scores,
      competitiveRank: rank,
      recommendations,
      strengths,
      warnings,
      timestamp: new Date(),
    };

    qualityReports.set(report.id, report);
    console.log(`[QualityScorer] Report generated: ${rank} rank (${scores.overall.toFixed(1)})`);

    return report;
  }

  private static calculateQualityScores(
    slices: SliceInfo[],
    videoType: "short" | "standard" | "comprehensive",
    sourceDuration: number
  ): QualityScores {
    if (slices.length === 0) {
      return {
        overall: 50,
        technicalQuality: 50,
        uniqueness: 50,
        dynamism: 50,
        usability: 50,
        narrativeStructure: 50,
        hookStrength: 50,
        pacingFlow: 50,
        engagementCurve: 50,
        retentionPotential: 50,
        platformOptimization: 50,
      };
    }

    const avgEngagement = slices.reduce((sum, s) => sum + s.engagementScore, 0) / slices.length;
    const firstSlice = slices[0];
    const lastSlice = slices[slices.length - 1];
    
    const hookStrength = this.calculateHookStrength(firstSlice, videoType);
    const pacingFlow = this.calculatePacingFlow(slices, videoType);
    const engagementCurve = this.calculateEngagementCurve(slices);
    const narrativeStructure = this.calculateNarrativeStructure(slices, videoType);
    const technicalQuality = Math.min(100, avgEngagement * 1.1);
    const uniqueness = this.calculateUniqueness(slices);
    const dynamism = this.calculateDynamism(slices, videoType);
    const usability = this.calculateUsability(slices, videoType, sourceDuration);
    const retentionPotential = this.calculateRetentionPotential(slices, videoType);
    const platformOptimization = this.calculatePlatformOptimization(slices, videoType);

    const overall = (
      hookStrength * 0.15 +
      pacingFlow * 0.12 +
      engagementCurve * 0.13 +
      narrativeStructure * 0.12 +
      technicalQuality * 0.10 +
      uniqueness * 0.08 +
      dynamism * 0.10 +
      usability * 0.08 +
      retentionPotential * 0.07 +
      platformOptimization * 0.05
    );

    return {
      overall,
      technicalQuality,
      uniqueness,
      dynamism,
      usability,
      narrativeStructure,
      hookStrength,
      pacingFlow,
      engagementCurve,
      retentionPotential,
      platformOptimization,
    };
  }

  private static calculateHookStrength(firstSlice: SliceInfo | undefined, videoType: string): number {
    if (!firstSlice) return 50;
    
    let score = firstSlice.engagementScore;
    
    if (firstSlice.clipType.includes("hook") || firstSlice.clipType.includes("peak")) {
      score += 15;
    }
    
    const hookDuration = firstSlice.endTime - firstSlice.startTime;
    if (videoType === "short" && hookDuration <= 3) {
      score += 10;
    } else if (videoType === "standard" && hookDuration <= 5) {
      score += 8;
    }
    
    return Math.min(100, score);
  }

  private static calculatePacingFlow(slices: SliceInfo[], videoType: string): number {
    if (slices.length < 2) return 60;
    
    let varianceScore = 0;
    const durations = slices.map(s => s.endTime - s.startTime);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const variance = durations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) / durations.length;
    
    if (videoType === "short") {
      varianceScore = variance < 2 ? 90 : variance < 4 ? 75 : 60;
    } else {
      varianceScore = variance < 4 ? 85 : variance < 8 ? 70 : 55;
    }
    
    const clipTypeVariety = new Set(slices.map(s => s.clipType)).size;
    const varietyBonus = Math.min(15, clipTypeVariety * 3);
    
    return Math.min(100, varianceScore + varietyBonus);
  }

  private static calculateEngagementCurve(slices: SliceInfo[]): number {
    if (slices.length < 3) return 70;
    
    const firstThird = slices.slice(0, Math.floor(slices.length / 3));
    const lastThird = slices.slice(Math.floor(slices.length * 2 / 3));
    
    const firstAvg = firstThird.reduce((sum, s) => sum + s.engagementScore, 0) / firstThird.length;
    const lastAvg = lastThird.reduce((sum, s) => sum + s.engagementScore, 0) / lastThird.length;
    
    if (firstAvg >= 70 && lastAvg >= 75) {
      return 95;
    } else if (firstAvg >= 65 && lastAvg >= 70) {
      return 85;
    } else if (firstAvg >= 60) {
      return 75;
    }
    
    return 65;
  }

  private static calculateNarrativeStructure(slices: SliceInfo[], videoType: string): number {
    if (slices.length < 2) return 55;
    
    const hasHook = slices[0]?.clipType.includes("hook") || slices[0]?.engagementScore > 75;
    const hasClimax = slices.some(s => s.clipType.includes("climax") || s.clipType.includes("peak"));
    const hasConclusion = slices[slices.length - 1]?.clipType.includes("outro") || 
                          slices[slices.length - 1]?.engagementScore > 70;
    
    let score = 50;
    if (hasHook) score += 20;
    if (hasClimax) score += 15;
    if (hasConclusion) score += 15;
    
    return Math.min(100, score);
  }

  private static calculateUniqueness(slices: SliceInfo[]): number {
    const uniqueTypes = new Set(slices.map(s => s.clipType)).size;
    const totalSlices = slices.length;
    
    const typeRatio = totalSlices > 0 ? uniqueTypes / Math.min(totalSlices, 8) : 0.5;
    return Math.min(100, 40 + typeRatio * 60);
  }

  private static calculateDynamism(slices: SliceInfo[], videoType: string): number {
    if (slices.length < 2) return 60;
    
    const engagementChanges = [];
    for (let i = 1; i < slices.length; i++) {
      engagementChanges.push(Math.abs(slices[i].engagementScore - slices[i - 1].engagementScore));
    }
    
    const avgChange = engagementChanges.reduce((a, b) => a + b, 0) / engagementChanges.length;
    
    if (videoType === "short") {
      return avgChange > 15 ? 90 : avgChange > 10 ? 80 : avgChange > 5 ? 70 : 60;
    }
    
    return avgChange > 12 ? 85 : avgChange > 8 ? 75 : avgChange > 4 ? 65 : 55;
  }

  private static calculateUsability(slices: SliceInfo[], videoType: string, sourceDuration: number): number {
    const totalUsedDuration = slices.reduce((sum, s) => sum + (s.endTime - s.startTime), 0);
    const utilizationRatio = totalUsedDuration / sourceDuration;
    
    let idealRatio;
    switch (videoType) {
      case "short": idealRatio = 0.1; break;
      case "standard": idealRatio = 0.25; break;
      case "comprehensive": idealRatio = 0.5; break;
      default: idealRatio = 0.2;
    }
    
    const ratioScore = 1 - Math.abs(utilizationRatio - idealRatio) * 2;
    return Math.min(100, Math.max(40, ratioScore * 100));
  }

  private static calculateRetentionPotential(slices: SliceInfo[], videoType: string): number {
    const avgEngagement = slices.reduce((sum, s) => sum + s.engagementScore, 0) / slices.length;
    const hasStrongHook = slices[0]?.engagementScore > 80;
    const hasStrongEnd = slices[slices.length - 1]?.engagementScore > 75;
    
    let score = avgEngagement;
    if (hasStrongHook) score += 10;
    if (hasStrongEnd) score += 10;
    
    return Math.min(100, score);
  }

  private static calculatePlatformOptimization(slices: SliceInfo[], videoType: string): number {
    const totalDuration = slices.reduce((sum, s) => sum + (s.endTime - s.startTime), 0);
    
    let idealDuration;
    switch (videoType) {
      case "short": idealDuration = 15; break;
      case "standard": idealDuration = 60; break;
      case "comprehensive": idealDuration = 180; break;
      default: idealDuration = 60;
    }
    
    const durationScore = Math.max(0, 100 - Math.abs(totalDuration - idealDuration) * 2);
    return Math.min(100, durationScore);
  }

  private static determineRank(overallScore: number): "S" | "A" | "B" | "C" | "D" {
    if (overallScore >= this.RANK_THRESHOLDS.S) return "S";
    if (overallScore >= this.RANK_THRESHOLDS.A) return "A";
    if (overallScore >= this.RANK_THRESHOLDS.B) return "B";
    if (overallScore >= this.RANK_THRESHOLDS.C) return "C";
    return "D";
  }

  private static generateRecommendations(
    scores: QualityScores,
    videoType: string,
    slices: SliceInfo[]
  ): string[] {
    const recommendations: string[] = [];

    if (scores.hookStrength < 75) {
      recommendations.push("Consider starting with a higher-engagement clip to improve hook strength");
    }
    if (scores.pacingFlow < 70) {
      recommendations.push("Adjust clip durations for more consistent pacing");
    }
    if (scores.narrativeStructure < 70) {
      recommendations.push("Add clearer story arc: strong hook → buildup → climax → resolution");
    }
    if (scores.dynamism < 65) {
      recommendations.push("Mix high and low energy clips for more dynamic flow");
    }
    if (scores.retentionPotential < 75) {
      recommendations.push("Strengthen the ending with a compelling finale clip");
    }

    return recommendations;
  }

  private static identifyStrengths(scores: QualityScores, slices: SliceInfo[]): string[] {
    const strengths: string[] = [];

    if (scores.hookStrength >= 85) strengths.push("Excellent hook - captures attention immediately");
    if (scores.pacingFlow >= 85) strengths.push("Great pacing - smooth flow between clips");
    if (scores.engagementCurve >= 85) strengths.push("Strong engagement curve - maintains viewer interest");
    if (scores.narrativeStructure >= 80) strengths.push("Clear narrative structure - tells a complete story");
    if (scores.dynamism >= 80) strengths.push("Dynamic content - good energy variation");

    return strengths;
  }

  private static generateWarnings(scores: QualityScores, slices: SliceInfo[]): string[] {
    const warnings: string[] = [];

    if (scores.hookStrength < 60) warnings.push("Weak hook may cause early drop-off");
    if (scores.pacingFlow < 55) warnings.push("Inconsistent pacing may confuse viewers");
    if (slices.length < 3) warnings.push("Very few clips - consider adding more variety");
    if (scores.overall < 60) warnings.push("Below industry standard - consider regenerating");

    return warnings;
  }

  static getPlatformBenchmark(): PlatformBenchmark {
    const reports = Array.from(qualityReports.values());
    
    if (reports.length === 0) {
      return {
        averageOverall: 75,
        averageByType: { short: 75, standard: 75, comprehensive: 75 },
        topPerformerScore: 85,
        industryStandard: this.INDUSTRY_STANDARD,
      };
    }

    const avgOverall = reports.reduce((sum, r) => sum + r.qualityScores.overall, 0) / reports.length;
    
    const byType = { short: [] as number[], standard: [] as number[], comprehensive: [] as number[] };
    for (const report of reports) {
      byType[report.videoType].push(report.qualityScores.overall);
    }

    return {
      averageOverall: avgOverall,
      averageByType: {
        short: byType.short.length > 0 
          ? byType.short.reduce((a, b) => a + b, 0) / byType.short.length 
          : 75,
        standard: byType.standard.length > 0 
          ? byType.standard.reduce((a, b) => a + b, 0) / byType.standard.length 
          : 75,
        comprehensive: byType.comprehensive.length > 0 
          ? byType.comprehensive.reduce((a, b) => a + b, 0) / byType.comprehensive.length 
          : 75,
      },
      topPerformerScore: Math.max(...reports.map(r => r.qualityScores.overall), 85),
      industryStandard: this.INDUSTRY_STANDARD,
    };
  }

  static getOptimizedSettings(category: string, duration: number): Record<string, any> {
    const categorySettings: Record<string, any> = {
      gaming: { minClipDuration: 0.5, maxClipDuration: 3, pacingStyle: "aggressive" },
      tutorial: { minClipDuration: 3, maxClipDuration: 10, pacingStyle: "steady" },
      music_video: { minClipDuration: 1, maxClipDuration: 4, pacingStyle: "dynamic" },
      comedy: { minClipDuration: 1, maxClipDuration: 5, pacingStyle: "dynamic" },
      vlog: { minClipDuration: 2, maxClipDuration: 8, pacingStyle: "moderate" },
      cooking: { minClipDuration: 2, maxClipDuration: 8, pacingStyle: "steady" },
      generic: { minClipDuration: 2, maxClipDuration: 6, pacingStyle: "moderate" },
    };

    return categorySettings[category] || categorySettings.generic;
  }

  static getAllReports(): QualityReport[] {
    return Array.from(qualityReports.values());
  }
}
