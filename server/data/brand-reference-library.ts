/**
 * Brand Reference Library
 * Curated collection of top brand editing styles across all video categories
 * 
 * These references are used to:
 * 1. Provide editing style templates for each category
 * 2. Extract and apply editing DNA (pacing, transitions, color grading)
 * 3. Give users one-click access to professional editing patterns
 */

export interface BrandReference {
  id: string;
  brand: string;
  category: string;
  subcategory?: string;
  description: string;
  editingStyle: {
    pacing: "slow" | "normal" | "fast" | "dynamic";
    cutTempo: number; // ms between cuts
    transitionTypes: string[];
    colorGrading: string;
    hookDuration: number; // seconds
    energyCurve: number[]; // 0-100 energy over video duration
  };
  signatureElements: string[];
  exampleUrls?: string[];
  youtubeChannelId?: string;
  tikTokHandle?: string;
}

export const BRAND_REFERENCE_LIBRARY: BrandReference[] = [
  // ═══════════════════════════════════════════════════════════════
  // ACTION / SPORTS / ADVENTURE
  // ═══════════════════════════════════════════════════════════════
  {
    id: "dji-action",
    brand: "DJI",
    category: "action",
    subcategory: "drone_sports",
    description: "Premium action footage with cinematic drone shots, smooth transitions, and epic music sync",
    editingStyle: {
      pacing: "dynamic",
      cutTempo: 1200,
      transitionTypes: ["smooth_zoom", "whip_pan", "crossfade", "match_cut"],
      colorGrading: "cinematic",
      hookDuration: 1.5,
      energyCurve: [90, 85, 70, 80, 95, 100, 85]
    },
    signatureElements: [
      "Drone reveals with epic scale",
      "Beat-synced cuts on action peaks", 
      "Slow-mo impact moments",
      "Wide-to-tight shot progressions"
    ],
    youtubeChannelId: "UCsNGtpqGsyw0U6qEG-WHadA"
  },
  {
    id: "gopro-action",
    brand: "GoPro",
    category: "action",
    subcategory: "pov_sports",
    description: "High-energy POV action with fast cuts, immersive angles, and adrenaline-pumping pacing",
    editingStyle: {
      pacing: "fast",
      cutTempo: 800,
      transitionTypes: ["jump_cut", "whip_pan", "speed_ramp", "impact_zoom"],
      colorGrading: "vibrant",
      hookDuration: 1.0,
      energyCurve: [100, 95, 90, 85, 95, 100, 95]
    },
    signatureElements: [
      "First-person POV shots",
      "Speed ramps on jumps/tricks",
      "Multi-angle coverage of single action",
      "Bass drop sync cuts"
    ],
    youtubeChannelId: "UCqhnX4jA0A5paNd1v-zEysw"
  },
  {
    id: "onewheel-action",
    brand: "Onewheel",
    category: "action",
    subcategory: "electric_sports",
    description: "Lifestyle-meets-action with flowing movements, urban exploration, and community vibes",
    editingStyle: {
      pacing: "dynamic",
      cutTempo: 1500,
      transitionTypes: ["smooth_pan", "crossfade", "match_cut", "dolly_zoom"],
      colorGrading: "warm",
      hookDuration: 2.0,
      energyCurve: [80, 75, 85, 90, 85, 95, 80]
    },
    signatureElements: [
      "Flowing tracking shots",
      "Urban exploration aesthetics",
      "Community/lifestyle moments",
      "Sunset/golden hour grading"
    ],
    youtubeChannelId: "UC0cwjmjMFVBd-X5d4NvJVyg"
  },
  {
    id: "redbull-action",
    brand: "Red Bull",
    category: "action",
    subcategory: "extreme_sports",
    description: "Extreme sports mastery with impossible angles, dramatic slow-mo, and heart-pounding builds",
    editingStyle: {
      pacing: "dynamic",
      cutTempo: 1000,
      transitionTypes: ["speed_ramp", "impact_cut", "whip_pan", "reveal"],
      colorGrading: "dramatic",
      hookDuration: 0.8,
      energyCurve: [95, 80, 70, 85, 100, 95, 100]
    },
    signatureElements: [
      "Impossible camera angles",
      "Dramatic build to climax",
      "Slow-mo impact moments",
      "Epic scale establishing shots"
    ],
    youtubeChannelId: "UCblfuW_4rakIf2h6aqANefA"
  },

  // ═══════════════════════════════════════════════════════════════
  // GAMING
  // ═══════════════════════════════════════════════════════════════
  {
    id: "nvidia-gaming",
    brand: "NVIDIA",
    category: "gaming",
    subcategory: "tech_showcase",
    description: "High-fidelity gaming showcases with ray-tracing beauty shots and tech-forward editing",
    editingStyle: {
      pacing: "normal",
      cutTempo: 2000,
      transitionTypes: ["dissolve", "fade", "smooth_zoom", "glitch"],
      colorGrading: "highcontrast",
      hookDuration: 2.0,
      energyCurve: [70, 80, 85, 90, 85, 95, 80]
    },
    signatureElements: [
      "Ray-tracing showcase shots",
      "Before/after comparisons",
      "Cinematic game footage",
      "Tech overlay graphics"
    ],
    youtubeChannelId: "UCHuiy8bXnmK5nisYHUd1J5g"
  },
  {
    id: "playstation-gaming",
    brand: "PlayStation",
    category: "gaming",
    subcategory: "trailers",
    description: "Emotional storytelling with cinematic pacing, narrative focus, and premium production",
    editingStyle: {
      pacing: "dynamic",
      cutTempo: 1800,
      transitionTypes: ["fade", "match_cut", "crossfade", "reveal"],
      colorGrading: "cinematic",
      hookDuration: 3.0,
      energyCurve: [60, 70, 80, 85, 90, 100, 70]
    },
    signatureElements: [
      "Story-driven editing",
      "Emotional music sync",
      "Character-focused moments",
      "Narrative arc structure"
    ],
    youtubeChannelId: "UC-2Y8dQb0S6DtpxNgAKoJKA"
  },

  // ═══════════════════════════════════════════════════════════════
  // COOKING / FOOD
  // ═══════════════════════════════════════════════════════════════
  {
    id: "tasty-cooking",
    brand: "Tasty (BuzzFeed)",
    category: "cooking",
    subcategory: "recipe_shorts",
    description: "Iconic overhead recipe format with satisfying process shots and minimal text",
    editingStyle: {
      pacing: "fast",
      cutTempo: 1500,
      transitionTypes: ["jump_cut", "time_lapse", "slide"],
      colorGrading: "vibrant",
      hookDuration: 1.0,
      energyCurve: [80, 75, 80, 85, 90, 100]
    },
    signatureElements: [
      "Overhead camera angle",
      "Hands-only visible",
      "Process time-lapses",
      "Final reveal with steam/sizzle"
    ],
    youtubeChannelId: "UCJFp8uSYCjXOMnkUyb3CQ3Q"
  },
  {
    id: "babish-cooking",
    brand: "Binging with Babish",
    category: "cooking",
    subcategory: "entertainment_cooking",
    description: "Cinematic cooking with personality, storytelling, and high production value",
    editingStyle: {
      pacing: "normal",
      cutTempo: 2500,
      transitionTypes: ["crossfade", "match_cut", "slide"],
      colorGrading: "warm",
      hookDuration: 3.0,
      energyCurve: [70, 75, 80, 85, 80, 90, 85]
    },
    signatureElements: [
      "Cinematic close-ups",
      "Personality-driven narration",
      "Pop culture references",
      "Multi-attempt cooking process"
    ],
    youtubeChannelId: "UCJHA_jMfCvEnv-3kRjTCQXw"
  },

  // ═══════════════════════════════════════════════════════════════
  // EDUCATIONAL / TUTORIAL
  // ═══════════════════════════════════════════════════════════════
  {
    id: "veritasium-educational",
    brand: "Veritasium",
    category: "educational",
    subcategory: "science",
    description: "High-production science content with visual experiments and engaging explanations",
    editingStyle: {
      pacing: "normal",
      cutTempo: 3000,
      transitionTypes: ["fade", "crossfade", "slide"],
      colorGrading: "corporate",
      hookDuration: 5.0,
      energyCurve: [80, 70, 75, 80, 75, 85, 70]
    },
    signatureElements: [
      "Visual experiments",
      "Expert interviews",
      "On-location shoots",
      "Clear visual explanations"
    ],
    youtubeChannelId: "UCHnyfMqiRRG1u-2MsSQLbXA"
  },
  {
    id: "kurzgesagt-educational",
    brand: "Kurzgesagt",
    category: "educational",
    subcategory: "animation",
    description: "Beautiful animated explainers with consistent pacing and clear information hierarchy",
    editingStyle: {
      pacing: "normal",
      cutTempo: 4000,
      transitionTypes: ["smooth_zoom", "fade", "reveal"],
      colorGrading: "vibrant",
      hookDuration: 4.0,
      energyCurve: [75, 70, 75, 80, 75, 80, 75]
    },
    signatureElements: [
      "Consistent animation style",
      "Information layering",
      "Clear visual metaphors",
      "Satisfying transitions"
    ],
    youtubeChannelId: "UCsXVk37bltHxD1rDPwtNM8Q"
  },

  // ═══════════════════════════════════════════════════════════════
  // MUSIC VIDEO / PERFORMANCE
  // ═══════════════════════════════════════════════════════════════
  {
    id: "vevo-music",
    brand: "Vevo",
    category: "music_video",
    subcategory: "official_videos",
    description: "Professional music video editing with beat-perfect cuts and narrative flow",
    editingStyle: {
      pacing: "dynamic",
      cutTempo: 1000,
      transitionTypes: ["beat_cut", "crossfade", "match_cut", "whip_pan"],
      colorGrading: "cinematic",
      hookDuration: 0.5,
      energyCurve: [90, 85, 95, 100, 90, 100, 85]
    },
    signatureElements: [
      "Beat-synced editing",
      "Performance + narrative intercut",
      "Chorus energy spikes",
      "Verse breathing room"
    ],
    youtubeChannelId: "UC2pmfLm7iq6Ov1UwYrWYkZA"
  },
  {
    id: "colors-music",
    brand: "COLORS",
    category: "music_video",
    subcategory: "live_performance",
    description: "Minimalist live performance captures with single-take energy and intimate vibes",
    editingStyle: {
      pacing: "slow",
      cutTempo: 5000,
      transitionTypes: ["slow_zoom", "fade"],
      colorGrading: "pastel",
      hookDuration: 5.0,
      energyCurve: [60, 70, 75, 80, 85, 90, 80]
    },
    signatureElements: [
      "Single continuous shot feel",
      "Slow push-in cameras",
      "Minimal cuts",
      "Intimate atmosphere"
    ],
    youtubeChannelId: "UC2Qw1dzXDBAZPwS7zm37g8g"
  },

  // ═══════════════════════════════════════════════════════════════
  // COMEDY / ENTERTAINMENT
  // ═══════════════════════════════════════════════════════════════
  {
    id: "duolingo-comedy",
    brand: "Duolingo",
    category: "comedy",
    subcategory: "brand_humor",
    description: "Unhinged brand humor with chaotic energy, meme culture, and trending audio",
    editingStyle: {
      pacing: "fast",
      cutTempo: 600,
      transitionTypes: ["jump_cut", "zoom", "shake", "impact"],
      colorGrading: "vibrant",
      hookDuration: 0.5,
      energyCurve: [100, 95, 100, 90, 100, 95, 100]
    },
    signatureElements: [
      "Meme format adoption",
      "Trending audio sync",
      "Chaotic energy",
      "Self-aware humor"
    ],
    tikTokHandle: "@duolingo"
  },
  {
    id: "nba-comedy",
    brand: "NBA",
    category: "comedy",
    subcategory: "sports_entertainment",
    description: "Sports entertainment with player personalities, memes, and behind-the-scenes moments",
    editingStyle: {
      pacing: "fast",
      cutTempo: 800,
      transitionTypes: ["jump_cut", "zoom", "replay", "impact"],
      colorGrading: "vibrant",
      hookDuration: 1.0,
      energyCurve: [95, 90, 85, 95, 100, 90, 85]
    },
    signatureElements: [
      "Player personality focus",
      "Reaction shots",
      "Slow-mo replay moments",
      "Meme integration"
    ],
    tikTokHandle: "@nba"
  },

  // ═══════════════════════════════════════════════════════════════
  // TALKING HEAD / PODCAST
  // ═══════════════════════════════════════════════════════════════
  {
    id: "lex-podcast",
    brand: "Lex Fridman",
    category: "podcast",
    subcategory: "interview",
    description: "Long-form interview clips with minimal cuts and focus on content",
    editingStyle: {
      pacing: "slow",
      cutTempo: 8000,
      transitionTypes: ["crossfade", "fade"],
      colorGrading: "noir",
      hookDuration: 5.0,
      energyCurve: [50, 55, 60, 65, 60, 70, 55]
    },
    signatureElements: [
      "Minimal editing",
      "Content-first approach",
      "Two-camera setup",
      "Dark moody atmosphere"
    ],
    youtubeChannelId: "UCSHZKyawb77ixDdsGog4iWA"
  },
  {
    id: "mkbhd-talking",
    brand: "MKBHD",
    category: "talking_head",
    subcategory: "tech_review",
    description: "Premium tech reviews with clean cuts, stunning b-roll, and polished production",
    editingStyle: {
      pacing: "normal",
      cutTempo: 3000,
      transitionTypes: ["fade", "slide", "zoom"],
      colorGrading: "corporate",
      hookDuration: 3.0,
      energyCurve: [70, 75, 80, 75, 85, 80, 75]
    },
    signatureElements: [
      "Clean talking head segments",
      "Premium b-roll inserts",
      "Product beauty shots",
      "Consistent branding"
    ],
    youtubeChannelId: "UCBJycsmduvYEL83R_U4JriQ"
  },

  // ═══════════════════════════════════════════════════════════════
  // MARKETING / PRODUCT
  // ═══════════════════════════════════════════════════════════════
  {
    id: "apple-marketing",
    brand: "Apple",
    category: "marketing",
    subcategory: "product_launch",
    description: "Minimalist product reveals with dramatic lighting, smooth animations, and premium feel",
    editingStyle: {
      pacing: "slow",
      cutTempo: 3500,
      transitionTypes: ["fade", "reveal", "smooth_zoom", "dissolve"],
      colorGrading: "corporate",
      hookDuration: 2.0,
      energyCurve: [60, 65, 70, 80, 85, 90, 75]
    },
    signatureElements: [
      "Dramatic product reveals",
      "Clean white/black backgrounds",
      "Precision camera movements",
      "Feature highlight zooms"
    ],
    youtubeChannelId: "UCE_M8A5yxnLfW0KghEeajjw"
  },
  {
    id: "nike-marketing",
    brand: "Nike",
    category: "marketing",
    subcategory: "brand_storytelling",
    description: "Emotional brand storytelling with athlete focus, inspirational pacing, and cinematic quality",
    editingStyle: {
      pacing: "dynamic",
      cutTempo: 1500,
      transitionTypes: ["fade", "match_cut", "crossfade", "reveal"],
      colorGrading: "dramatic",
      hookDuration: 2.0,
      energyCurve: [70, 65, 75, 85, 90, 100, 80]
    },
    signatureElements: [
      "Athlete stories",
      "Emotional builds",
      "Inspirational music sync",
      "Dramatic lighting"
    ],
    youtubeChannelId: "UCVaXvd24JJQkc2qVQaFjxww"
  },

  // ═══════════════════════════════════════════════════════════════
  // TRAILER / CINEMATIC
  // ═══════════════════════════════════════════════════════════════
  {
    id: "marvel-trailer",
    brand: "Marvel Studios",
    category: "trailer",
    subcategory: "movie_trailer",
    description: "High-impact movie trailers with tension building, reveals, and epic moments",
    editingStyle: {
      pacing: "dynamic",
      cutTempo: 1200,
      transitionTypes: ["fade_to_black", "impact_cut", "reveal", "match_cut"],
      colorGrading: "cinematic",
      hookDuration: 1.0,
      energyCurve: [80, 60, 70, 85, 75, 95, 100]
    },
    signatureElements: [
      "Tension builds",
      "Character reveals",
      "Action beat drops",
      "Logo stinger ending"
    ],
    youtubeChannelId: "UCvC4D8onUfXzvjTOM-dBfEA"
  },

  // ═══════════════════════════════════════════════════════════════
  // VIDEO EDITING SOFTWARE SHOWCASES
  // ═══════════════════════════════════════════════════════════════
  {
    id: "adobe-showcase",
    brand: "Adobe Creative Cloud",
    category: "marketing",
    subcategory: "software_demo",
    description: "Professional editing showcases demonstrating creative possibilities",
    editingStyle: {
      pacing: "dynamic",
      cutTempo: 1500,
      transitionTypes: ["all"],
      colorGrading: "vibrant",
      hookDuration: 1.5,
      energyCurve: [85, 80, 85, 90, 85, 95, 90]
    },
    signatureElements: [
      "Diverse editing styles",
      "Before/after reveals",
      "Feature highlights",
      "Creative inspiration"
    ],
    youtubeChannelId: "UCL0iAkpqV5YaIVG7xkDtS4Q"
  },
  {
    id: "capcut-showcase",
    brand: "CapCut",
    category: "marketing",
    subcategory: "mobile_editing",
    description: "Trendy mobile editing with viral templates and social-first approach",
    editingStyle: {
      pacing: "fast",
      cutTempo: 800,
      transitionTypes: ["velocity_edit", "zoom", "shake", "glitch"],
      colorGrading: "instagram",
      hookDuration: 0.5,
      energyCurve: [100, 95, 90, 100, 95, 100, 90]
    },
    signatureElements: [
      "Trending templates",
      "Velocity edits",
      "Beat sync",
      "Social media optimized"
    ],
    tikTokHandle: "@capcut"
  },
  {
    id: "blackmagic-showcase",
    brand: "Blackmagic Design",
    category: "marketing",
    subcategory: "cinema_editing",
    description: "Cinema-grade color grading and professional film editing showcases",
    editingStyle: {
      pacing: "slow",
      cutTempo: 3000,
      transitionTypes: ["fade", "crossfade", "dissolve"],
      colorGrading: "cinematic",
      hookDuration: 3.0,
      energyCurve: [60, 65, 70, 75, 80, 85, 75]
    },
    signatureElements: [
      "Color grading showcases",
      "Cinema camera footage",
      "Professional workflows",
      "Film emulation looks"
    ],
    youtubeChannelId: "UCufB8ydVlON5LaSEMGqI3dw"
  }
];

/**
 * Get references by category
 */
export function getReferencesByCategory(category: string): BrandReference[] {
  return BRAND_REFERENCE_LIBRARY.filter(ref => ref.category === category);
}

/**
 * Get all unique categories
 */
export function getAllCategories(): string[] {
  return Array.from(new Set(BRAND_REFERENCE_LIBRARY.map(ref => ref.category)));
}

/**
 * Get reference by ID
 */
export function getReferenceById(id: string): BrandReference | undefined {
  return BRAND_REFERENCE_LIBRARY.find(ref => ref.id === id);
}

/**
 * Get best match for a video category
 */
export function getBestReferenceForCategory(category: string): BrandReference | undefined {
  const matches = getReferencesByCategory(category);
  // Return first match (they're ordered by quality)
  return matches[0];
}

/**
 * Extract editing parameters from a brand reference
 */
export function extractEditingParams(reference: BrandReference) {
  return {
    pacing: reference.editingStyle.pacing,
    cutTempo: reference.editingStyle.cutTempo,
    transitionStyle: reference.editingStyle.transitionTypes[0],
    colorGrade: reference.editingStyle.colorGrading,
    hookDuration: reference.editingStyle.hookDuration,
    energyCurve: reference.editingStyle.energyCurve
  };
}
