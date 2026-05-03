
import { PRICING_TIERS, OVERAGE_PRICING, type UserSubscription, type SubscriptionTier } from '@shared/pricing';

export class SubscriptionManager {
  /**
   * Check if user is in free trial period
   */
  static isInFreeTrial(subscription: UserSubscription): boolean {
    const now = new Date();
    const trialEnd = new Date(subscription.startDate);
    trialEnd.setDate(trialEnd.getDate() + 30);
    
    return subscription.tier === 'FREE_TRIAL' && now < trialEnd;
  }

  /**
   * Check if user can save projects
   * Returns object with canSave flag and overage info
   */
  static canSaveProject(subscription: UserSubscription): {
    canSave: boolean;
    isOverage: boolean;
    overageCost: number;
    remainingInPlan: number;
  } {
    if (subscription.tier === 'FREE_TRIAL') {
      return { canSave: false, isOverage: false, overageCost: 0, remainingInPlan: 0 };
    }

    const limits = PRICING_TIERS[subscription.tier].limits;
    
    if (limits.projectSaves === -1) {
      return { canSave: true, isOverage: false, overageCost: 0, remainingInPlan: -1 };
    }
    
    const used = subscription.usage.projectsSaved;
    const remaining = limits.projectSaves - used;
    
    if (remaining > 0) {
      return { canSave: true, isOverage: false, overageCost: 0, remainingInPlan: remaining };
    }
    
    // Allow overage with cost
    return {
      canSave: true,
      isOverage: true,
      overageCost: OVERAGE_PRICING.projectSave,
      remainingInPlan: 0
    };
  }

  /**
   * Check if user can generate more videos this month
   * Returns object with canGenerate flag and overage info
   */
  static canGenerateVideo(subscription: UserSubscription): { 
    canGenerate: boolean; 
    isOverage: boolean;
    overageCost: number;
    remainingInPlan: number;
    willUseCredits: boolean;
    creditsRemaining: number;
  } {
    const limits = PRICING_TIERS[subscription.tier].limits;
    
    if (limits.monthlyVideos === -1) {
      return { canGenerate: true, isOverage: false, overageCost: 0, remainingInPlan: -1, willUseCredits: false, creditsRemaining: 0 };
    }
    
    const used = subscription.usage.videosThisMonth;
    const remaining = limits.monthlyVideos - used;
    const creditBalance = subscription.creditBalance?.videos || 0;
    
    // First check plan limit
    if (remaining > 0) {
      return { canGenerate: true, isOverage: false, overageCost: 0, remainingInPlan: remaining, willUseCredits: false, creditsRemaining: creditBalance };
    }
    
    // Then check credit balance
    if (creditBalance > 0) {
      return {
        canGenerate: true,
        isOverage: false,
        overageCost: 0,
        remainingInPlan: 0,
        willUseCredits: true,
        creditsRemaining: creditBalance - 1
      };
    }
    
    // Finally allow overage with cost
    return { 
      canGenerate: true, 
      isOverage: true, 
      overageCost: OVERAGE_PRICING.videoGeneration,
      remainingInPlan: 0,
      willUseCredits: false,
      creditsRemaining: 0
    };
  }

  /**
   * Check if user can use AI generation
   * Returns object with canUse flag and credit info
   */
  static canUseAI(subscription: UserSubscription): {
    canUse: boolean;
    usesPlanLimit: boolean;
    usesCredits: boolean;
    creditCost: number;
    remainingInPlan: number;
    creditsRemaining: number;
  } {
    const limits = PRICING_TIERS[subscription.tier].limits;
    
    if (limits.aiGenerations === -1) {
      return { 
        canUse: true, 
        usesPlanLimit: true, 
        usesCredits: false, 
        creditCost: 0, 
        remainingInPlan: -1, 
        creditsRemaining: subscription.credits?.balance || 0 
      };
    }
    
    const used = subscription.usage.aiGenerationsThisMonth;
    const remaining = limits.aiGenerations - used;
    const creditBalance = subscription.credits?.balance || 0;
    
    // First check plan limit
    if (remaining > 0) {
      return { 
        canUse: true, 
        usesPlanLimit: true, 
        usesCredits: false, 
        creditCost: 0, 
        remainingInPlan: remaining, 
        creditsRemaining: creditBalance 
      };
    }
    
    // Then check credit balance
    const creditCost = CREDIT_COSTS.aiGeneration;
    if (creditBalance >= creditCost) {
      return {
        canUse: true,
        usesPlanLimit: false,
        usesCredits: true,
        creditCost,
        remainingInPlan: 0,
        creditsRemaining: creditBalance - creditCost
      };
    }
    
    // Cannot proceed without credits
    return {
      canUse: false,
      usesPlanLimit: false,
      usesCredits: false,
      creditCost,
      remainingInPlan: 0,
      creditsRemaining: 0
    };
  }

  /**
   * Check if user has storage capacity
   * Returns object with canUpload flag and overage info
   */
  static canUploadVideo(subscription: UserSubscription, videoSizeMB: number): {
    canUpload: boolean;
    isOverage: boolean;
    overageCost: number;
    remainingGB: number;
  } {
    const limits = PRICING_TIERS[subscription.tier].limits;
    const storageLimit = limits.storageGB;
    
    if (!storageLimit || storageLimit === -1) {
      return { canUpload: true, isOverage: false, overageCost: 0, remainingGB: -1 };
    }
    
    const currentUsageGB = (subscription.usage.storageUsedMB || 0) / 1024;
    const uploadSizeGB = videoSizeMB / 1024;
    const newTotalGB = currentUsageGB + uploadSizeGB;
    const remainingGB = storageLimit - currentUsageGB;
    
    if (newTotalGB <= storageLimit) {
      return { canUpload: true, isOverage: false, overageCost: 0, remainingGB };
    }
    
    // Calculate overage cost (charge per GB over limit)
    const overageGB = newTotalGB - storageLimit;
    const overageCost = Math.ceil(overageGB) * OVERAGE_PRICING.storage;
    
    return {
      canUpload: true,
      isOverage: true,
      overageCost,
      remainingGB: 0
    };
  }

  /**
   * Get storage usage percentage
   */
  static getStorageUsagePercent(subscription: UserSubscription): number {
    const limits = PRICING_TIERS[subscription.tier].limits;
    const storageLimit = limits.storageGB;
    
    if (!storageLimit || storageLimit === -1) return 0;
    
    const currentUsageGB = ((subscription.usage as any).storageUsedMB || 0) / 1024;
    return (currentUsageGB / storageLimit) * 100;
  }

  /**
   * Get max video duration for user's tier
   */
  static getMaxDuration(subscription: UserSubscription): number {
    const limits = PRICING_TIERS[subscription.tier].limits;
    return limits.maxDuration === -1 ? Infinity : limits.maxDuration;
  }

  /**
   * Check if trial has expired
   */
  static hasTrialExpired(subscription: UserSubscription): boolean {
    const now = new Date();
    const trialEnd = new Date(subscription.startDate);
    trialEnd.setDate(trialEnd.getDate() + 30);
    
    return subscription.tier === 'FREE_TRIAL' && now >= trialEnd;
  }

  /**
   * Get days remaining in trial
   */
  static getTrialDaysRemaining(subscription: UserSubscription): number {
    if (subscription.tier !== 'FREE_TRIAL') return 0;
    
    const now = new Date();
    const trialEnd = new Date(subscription.startDate);
    trialEnd.setDate(trialEnd.getDate() + 30);
    
    const msRemaining = trialEnd.getTime() - now.getTime();
    return Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
  }

  /**
   * Reset monthly usage counters
   */
  static resetMonthlyUsage(subscription: UserSubscription): UserSubscription {
    return {
      ...subscription,
      usage: {
        ...subscription.usage,
        videosThisMonth: 0,
        aiGenerationsThisMonth: 0,
      }
    };
  }
}
/**
   * Record overage usage
   */
  static recordOverage(
    subscription: UserSubscription,
    type: 'video' | 'ai' | 'storage' | 'project',
    amount: number = 1
  ): UserSubscription {
    const overages = subscription.overages || {
      videosThisMonth: 0,
      aiGenerationsThisMonth: 0,
      storageGB: 0,
      projectSlots: 0
    };

    let cost = 0;
    switch (type) {
      case 'video':
        overages.videosThisMonth += amount;
        cost = amount * OVERAGE_PRICING.videoGeneration;
        break;
      case 'ai':
        overages.aiGenerationsThisMonth += amount;
        cost = amount * OVERAGE_PRICING.aiGeneration;
        break;
      case 'storage':
        overages.storageGB += amount;
        cost = amount * OVERAGE_PRICING.storage;
        break;
      case 'project':
        overages.projectSlots += amount;
        cost = amount * OVERAGE_PRICING.projectSave;
        break;
    }

    return {
      ...subscription,
      overages,
      overageCharges: (subscription.overageCharges || 0) + cost
    };
  }

  /**
   * Calculate total bill for the month
   */
  static calculateMonthlyBill(subscription: UserSubscription): {
    basePlan: number;
    overages: number;
    total: number;
    breakdown: Array<{ item: string; cost: number }>;
  } {
    const tier = PRICING_TIERS[subscription.tier];
    const basePlan = tier.price || 0;
    const overages = subscription.overageCharges || 0;
    
    const breakdown = [
      { item: `${tier.name} Plan`, cost: basePlan }
    ];

    if (subscription.overages) {
      if (subscription.overages.videosThisMonth > 0) {
        breakdown.push({
          item: `${subscription.overages.videosThisMonth} additional videos`,
          cost: subscription.overages.videosThisMonth * OVERAGE_PRICING.videoGeneration
        });
      }
      if (subscription.overages.aiGenerationsThisMonth > 0) {
        breakdown.push({
          item: `${subscription.overages.aiGenerationsThisMonth} additional AI generations`,
          cost: subscription.overages.aiGenerationsThisMonth * OVERAGE_PRICING.aiGeneration
        });
      }
      if (subscription.overages.storageGB > 0) {
        breakdown.push({
          item: `${subscription.overages.storageGB.toFixed(2)}GB additional storage`,
          cost: subscription.overages.storageGB * OVERAGE_PRICING.storage
        });
      }
      if (subscription.overages.projectSlots > 0) {
        breakdown.push({
          item: `${subscription.overages.projectSlots} additional project slots`,
          cost: subscription.overages.projectSlots * OVERAGE_PRICING.projectSave
        });
      }
    }

    return {
      basePlan,
      overages,
      total: basePlan + overages,
      breakdown
    };
  }

  /**
   * Reset monthly usage and overages
   */
  static resetMonthlyUsage(subscription: UserSubscription): UserSubscription {
    return {
      ...subscription,
      usage: {
        ...subscription.usage,
        videosThisMonth: 0,
        aiGenerationsThisMonth: 0,
      },
      overages: {
        videosThisMonth: 0,
        aiGenerationsThisMonth: 0,
        storageGB: 0,
        projectSlots: 0
      },
      overageCharges: 0
    };
  }
}
