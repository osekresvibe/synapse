
export const PRICING_TIERS = {
  FREE_TRIAL: {
    id: 'free_trial',
    name: 'Free Trial',
    price: 0,
    duration: '30 days',
    features: [
      'All V2.0 features',
      'Immediate download only',
      'No project saving',
      'AI video generation (10 videos/month)',
      'Basic script generation',
      'Stock media library access',
      'Standard processing speed',
    ],
    limits: {
      projectSaves: 0,
      monthlyVideos: 10,
      maxDuration: 60, // seconds
      aiGenerations: 10,
    }
  },
  STARTER: {
    id: 'starter',
    name: 'Starter',
    price: 12,
    duration: 'per month',
    features: [
      'Everything in Free Trial',
      'Save up to 15 projects',
      '30 videos per month',
      'Up to 3-minute videos',
      '15GB total storage',
      'Basic transitions',
      'Email support',
      '720p exports',
    ],
    limits: {
      projectSaves: 15,
      monthlyVideos: 30,
      maxDuration: 180,
      aiGenerations: 30,
      exportQuality: '720p',
      storageGB: 15,
    }
  },
  CREATOR: {
    id: 'creator',
    name: 'Creator',
    price: 24,
    duration: 'per month',
    popular: true,
    features: [
      'Everything in Starter',
      'Save up to 100 projects',
      'Unlimited AI videos',
      'Unlimited editing',
      'Up to 10-minute videos',
      '100GB total storage',
      '2 Custom Talking Head Avatars',
      'Advanced transitions & effects',
      'AI style mimicry',
      'Video & image mimicry',
      'Music-aware editing (Coming)',
      'Priority support',
      '1080p exports',
      'Batch processing',
    ],
    limits: {
      projectSaves: 100,
      monthlyVideos: -1, // Unlimited AI video generation
      maxDuration: 600,
      aiGenerations: -1, // Unlimited AI generations
      customAvatars: 2, // NEW: Limit custom talking head avatars
      exportQuality: '1080p',
      storageGB: 100,
    }
  },
  PRO: {
    id: 'pro',
    name: 'Professional',
    price: 49,
    duration: 'per month',
    features: [
      'Everything in Creator',
      'Unlimited AI videos',
      'Unlimited editing',
      'Up to 10-minute videos',
      '200GB total storage',
      '5 Custom Talking Head Avatars',
      'AI video understanding',
      'Custom brand presets',
      'API access (Coming)',
      'Team collaboration (Coming)',
      'White-label exports (Coming)',
      '4K exports',
      'Dedicated support',
      'GPU acceleration',
    ],
    limits: {
      projectSaves: 500,
      monthlyVideos: -1, // Unlimited AI video generation
      maxDuration: 600,
      aiGenerations: -1, // Unlimited AI generations
      customAvatars: 5, // More avatars for agencies
      exportQuality: '4k',
      storageGB: 200,
    }
  },
  EARLY_BIRD: {
    id: 'early_bird',
    name: 'Early Bird Special',
    price: 19, // 60% discount from Creator tier
    duration: 'per month',
    popular: true,
    limitedTime: true,
    spotsRemaining: 100, // Create scarcity
    features: [
      '🔥 LIMITED: First 100 users only',
      '💰 Lock in $19/mo forever (normally $24)',
      'Everything in Creator tier',
      'Save up to 100 projects',
      'Unlimited AI videos',
      'Up to 10-minute videos',
      '100GB total storage',
      '2 Custom Talking Head Avatars',
      'Advanced transitions & effects',
      'AI style mimicry',
      'Priority support',
      '1080p exports',
      'Lifetime price guarantee',
      'Early access to new features',
    ],
    limits: {
      projectSaves: 100,
      monthlyVideos: -1,
      maxDuration: 600,
      aiGenerations: -1,
      customAvatars: 2,
      exportQuality: '1080p',
      storageGB: 100,
    }
  },
  ENTERPRISE: {
    id: 'enterprise',
    name: 'Enterprise',
    price: null, // Custom pricing
    duration: 'custom',
    features: [
      'Everything in Professional',
      'Unlimited everything',
      'Custom integrations',
      'Dedicated infrastructure',
      'SLA guarantees',
      'Advanced analytics',
      'Multi-team management',
      'Custom AI models',
      'On-premise deployment option',
      'Priority feature requests',
      '24/7 phone support',
    ],
    limits: {
      projectSaves: -1,
      dailyVideos: -1,
      maxDuration: -1,
      aiGenerations: -1,
      exportQuality: '4k',
    }
  }
} as const;

export type SubscriptionTier = keyof typeof PRICING_TIERS;

// Credit costs for operations beyond plan limits
export const CREDIT_COSTS = {
  videoGeneration: 10, // 10 credits per video
  aiGeneration: 5, // 5 credits per AI generation
  storageGB: 2, // 2 credits per GB/month
  projectSave: 1, // 1 credit per project slot
  processingMinute: 1, // 1 credit per minute of processing time
} as const;

// Processing credit costs (in minutes consumed from subscription period)
export const PROCESSING_COSTS = {
  // Compression costs based on video size and target quality
  compression: {
    perGB: 15, // 15 minutes per GB compressed (heavy CPU work)
    qualityMultipliers: {
      low: 0.5, // Fast compression, less quality
      medium: 1.0, // Balanced
      high: 1.5, // Slow compression, better quality
    }
  },
  // Format conversion costs
  conversion: {
    perMinuteOfVideo: 0.5, // 0.5 minutes of subscription per minute of video
    formatMultipliers: {
      'mp4-to-webm': 1.0,
      'mov-to-mp4': 1.2, // ProRes decode is expensive
      'webm-to-mp4': 0.8,
      'any-to-optimized': 1.5, // Full re-encode with optimization
    }
  },
  // Combined operations cost more
  compressionAndConversion: 1.3, // 30% penalty for doing both
} as const;

// Credit Packs (one-time purchases for extra capacity)
export const CREDIT_PACKS = {
  STARTER: {
    id: 'starter_pack',
    name: 'Starter Pack',
    price: 9,
    credits: 100,
    popular: false,
    bonus: 0,
  },
  STANDARD: {
    id: 'standard_pack',
    name: 'Standard Pack',
    price: 19,
    credits: 250,
    popular: true,
    bonus: 25, // 10% bonus
  },
  PREMIUM: {
    id: 'premium_pack',
    name: 'Premium Pack',
    price: 49,
    credits: 750,
    popular: false,
    bonus: 150, // 20% bonus
  },
  ULTIMATE: {
    id: 'ultimate_pack',
    name: 'Ultimate Pack',
    price: 99,
    credits: 1800,
    popular: false,
    bonus: 450, // 25% bonus
  }
} as const;

export interface UserSubscription {
  tier: SubscriptionTier;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  usage: {
    videosThisMonth: number;
    projectsSaved: number;
    aiGenerationsThisMonth: number;
    storageUsedMB: number;
  };
  credits?: {
    balance: number; // Total available credits
    lifetimeEarned: number; // Total credits ever received
    lifetimeSpent: number; // Total credits ever used
    purchaseHistory: Array<{
      packId: string;
      purchaseDate: Date;
      creditsAdded: number;
      bonusCredits: number;
    }>;
  };
  processingCredits?: {
    totalMinutes: number; // Total processing time allocated (e.g., 30 days = 43200 minutes)
    usedMinutes: number; // Processing time consumed by compression/conversion
    renewalDate: Date; // Calculated based on credits consumed
  };
}
