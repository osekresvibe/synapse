# Distribution Intelligence & Virality Engine
## Technical Specification v1.0

---

## OVERVIEW

Extend Synapse Edit from post-production into intelligent distribution. Users finish editing → platform tells them WHERE to post, WHEN, and predicts HOW it will perform.

**Core Value Proposition:** "Edit once, distribute smart."

---

## MODULE 1: Platform Optimizer

**Purpose:** Auto-package finished clips for optimal performance on each platform.

### Technical Components

```
1. Multi-Format Export Engine
   ├── TikTok/Reels: 9:16, 1080x1920, max 60s
   ├── YouTube Shorts: 9:16, 1080x1920, max 60s  
   ├── Twitter/X: 1:1 or 16:9, max 2:20
   ├── Instagram Feed: 1:1 or 4:5
   └── LinkedIn: 16:9, 1080x1920

2. Auto-Adjustments Per Platform
   ├── Safe zone masking (avoid UI overlays)
   ├── Caption positioning (platform-specific)
   ├── Thumbnail auto-selection (from existing ai-analyzer)
   └── Aspect ratio smart-crop (focus on subject)
```

### Implementation

```typescript
interface PlatformExport {
  platform: "tiktok" | "reels" | "youtube_shorts" | "twitter" | "instagram" | "linkedin";
  aspectRatio: string;
  resolution: { width: number; height: number };
  maxDuration: number;
  safeZones: { top: number; bottom: number; left: number; right: number };
  captionPosition: "bottom" | "top" | "center";
}

// Extends VideoProcessor class
exportForPlatform(clipPath: string, platform: string): Promise<string>
```

**Integration Point:** Extends existing `VideoProcessor` class.

**Effort:** Low | **Impact:** High

---

## MODULE 2: Hook Scoring System

**Purpose:** Score the first 3-5 seconds of every clip for retention strength.

### Scoring Criteria (0-100)

| Factor | Weight | What It Measures |
|--------|--------|------------------|
| Visual Movement | 20% | Motion in first 2s (static = bad) |
| Audio Hook | 25% | Speech/music starts immediately |
| Face Presence | 15% | Human face in frame (boosts retention) |
| Text/Overlay | 10% | Curiosity-driving text present |
| Pattern Break | 15% | Unexpected visual in first 1s |
| Pacing | 15% | Cuts within first 3s |

### Implementation

```typescript
interface HookAnalysis {
  overallScore: number;        // 0-100
  factors: {
    visualMovement: number;
    audioHook: number;
    facePresence: number;
    textOverlay: number;
    patternBreak: number;
    pacing: number;
  };
  recommendation: string;      // "Add text hook" or "Start with face"
  predictedRetention: "high" | "medium" | "low";
  improvementSuggestions: string[];
}

// New service
class HookAnalyzer {
  async analyzeHook(videoPath: string): Promise<HookAnalysis>
  async suggestImprovements(analysis: HookAnalysis): Promise<string[]>
}
```

### Hook Quality Thresholds

- **85-100:** Strong hook, high retention predicted
- **70-84:** Good hook, minor improvements suggested
- **50-69:** Weak hook, specific improvements required
- **0-49:** Poor hook, consider re-editing first 3 seconds

**Integration Point:** Adds to existing `ai-analyzer.ts` after clip extraction.

**Effort:** Medium | **Impact:** High

---

## MODULE 3: Virality Prediction Engine

**Purpose:** Predict clip performance BEFORE publishing.

### Architecture

```
Input: Finished Clip
        ↓
┌─────────────────────────────────────┐
│      VIRALITY SCORING PIPELINE      │
├─────────────────────────────────────┤
│ 1. Hook Score (from Module 2)       │
│ 2. Content Pattern Match            │
│    - Compare to trending formats    │
│    - Detect: Tutorial, Story, etc.  │
│ 3. Audio Energy Analysis            │
│    - Music BPM, speech cadence      │
│ 4. Visual Complexity Score          │
│    - Too busy = scroll past         │
│ 5. Topic Heat (optional)            │
│    - Cross-ref with trending topics │
└─────────────────────────────────────┘
        ↓
Output: Virality Score + Platform Recommendations
```

### Output Schema

```typescript
interface ViralityPrediction {
  overallScore: number;           // 0-100
  platformScores: {
    tiktok: number;
    reels: number;
    youtubeShorts: number;
    twitter: number;
    linkedin: number;
  };
  bestPlatform: string;
  bestPostingTime: {
    dayOfWeek: string;
    timeSlot: string;
    timezone: string;
  };
  improvements: string[];
  confidenceLevel: "high" | "medium" | "low";
  reasoning: string;              // Why this prediction was made
}

// New service
class ViralityEngine {
  async predict(videoPath: string, hookAnalysis: HookAnalysis): Promise<ViralityPrediction>
  async compareToTrending(videoPath: string, niche: string): Promise<PatternMatch[]>
}
```

### Platform-Specific Scoring Factors

| Platform | Primary Factors | Secondary Factors |
|----------|-----------------|-------------------|
| TikTok | Hook speed, audio trend match | Visual effects, text overlays |
| Reels | Aesthetic quality, face presence | Music sync, transitions |
| YouTube Shorts | Value density, clarity | Thumbnail strength, title hook |
| Twitter | Controversy/novelty, brevity | Text clarity, shareability |
| LinkedIn | Professional relevance, insight | Authority signals, polish |

**Effort:** High | **Impact:** Very High (Major Differentiator)

---

## MODULE 4: Caption & Hashtag Intelligence

**Purpose:** Generate platform-optimized captions and hashtags.

### Features

```
1. Caption Generator
   ├── Hook line (curiosity/controversy)
   ├── Context line
   ├── CTA line
   └── Platform-specific length limits

2. Hashtag Engine
   ├── Niche-relevant tags (from content analysis)
   ├── Trending tags (optional API integration)
   ├── Mix of reach vs. targeted tags
   └── Platform hashtag limits (TikTok: 5, IG: 30)
```

### Implementation

```typescript
interface CaptionPackage {
  platform: string;
  caption: string;
  hashtags: string[];
  characterCount: number;
  hookStrength: "strong" | "medium" | "weak";
  alternativeHooks: string[];     // 2-3 options to choose from
}

interface HashtagStrategy {
  primary: string[];              // High relevance, medium reach
  reach: string[];                // Lower relevance, high reach
  niche: string[];                // High relevance, lower reach
  trending: string[];             // Currently trending (if API available)
}

// New service
class CaptionGenerator {
  async generateCaption(
    videoPath: string, 
    transcript: string, 
    platform: string
  ): Promise<CaptionPackage>
  
  async generateHashtags(
    content: string, 
    platform: string, 
    niche: string
  ): Promise<HashtagStrategy>
}
```

### Platform Caption Limits

| Platform | Max Length | Hashtag Limit | Best Practice |
|----------|-----------|---------------|---------------|
| TikTok | 2200 chars | 3-5 | Front-load hook |
| Instagram | 2200 chars | 20-30 | Mix in comments |
| YouTube Shorts | 100 chars | N/A | Title-focused |
| Twitter | 280 chars | 2-3 | Punchy, shareable |
| LinkedIn | 3000 chars | 3-5 | Professional tone |

**Effort:** Medium | **Impact:** Medium

---

## MODULE 5: Distribution Dashboard

**Purpose:** Single view showing all clips ready for distribution with scores.

### UI Components

```
┌────────────────────────────────────────────────────────────────┐
│  DISTRIBUTION QUEUE                              [Batch Export]│
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Clip 1: "Product Demo Highlight"              ✓ Ready    │  │
│  │ ├── Hook Score: 85/100 ✓                                 │  │
│  │ ├── Virality: 72/100                                     │  │
│  │ ├── Best Platform: TikTok                                │  │
│  │ ├── Best Time: Wed 6pm EST                               │  │
│  │ └── [Export All] [View Details] [Schedule]               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Clip 2: "Tutorial Intro"                      ⚠️ Improve │  │
│  │ ├── Hook Score: 45/100 ⚠️                                │  │
│  │ ├── Virality: 58/100                                     │  │
│  │ ├── Issue: "Hook is too slow - add text overlay"         │  │
│  │ └── [Improve Hook] [Export Anyway] [Discard]             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Clip Detail View

```
┌────────────────────────────────────────────────────────────────┐
│  CLIP DETAILS: "Product Demo Highlight"                        │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  PLATFORM BREAKDOWN                                            │
│  ┌────────────┬─────────┬─────────────┬───────────────────┐    │
│  │ Platform   │ Score   │ Best Time   │ Action            │    │
│  ├────────────┼─────────┼─────────────┼───────────────────┤    │
│  │ TikTok     │ 82/100  │ Wed 6pm     │ [Export] [Caption]│    │
│  │ Reels      │ 78/100  │ Thu 12pm    │ [Export] [Caption]│    │
│  │ YT Shorts  │ 71/100  │ Sat 10am    │ [Export] [Caption]│    │
│  │ Twitter    │ 65/100  │ Tue 9am     │ [Export] [Caption]│    │
│  └────────────┴─────────┴─────────────┴───────────────────┘    │
│                                                                │
│  HOOK ANALYSIS                                                 │
│  ├── Visual Movement: 90/100 ✓                                 │
│  ├── Audio Hook: 85/100 ✓                                      │
│  ├── Face Presence: 70/100                                     │
│  ├── Text Overlay: 80/100 ✓                                    │
│  └── Pacing: 95/100 ✓                                          │
│                                                                │
│  SUGGESTED IMPROVEMENTS                                        │
│  • Consider adding face cam in first 2 seconds                 │
│  • Audio could start 0.5s earlier                              │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Effort:** Medium | **Impact:** High

---

## DATA FLOW

```
User Finishes Edit
        ↓
[Existing Pipeline] → Final Clip
        ↓
[NEW] Hook Analysis → Hook Score (0-100)
        ↓
[NEW] Virality Engine → Platform Scores + Recommendations
        ↓
[NEW] Caption Generator → Ready-to-post captions per platform
        ↓
[NEW] Distribution Dashboard → User reviews & exports
        ↓
Export for Selected Platforms (auto-formatted)
        ↓
[FUTURE] Direct posting via social APIs
```

---

## IMPLEMENTATION PHASES

### Phase 1: Foundation (2-3 weeks)
- [ ] Hook Scoring System (Module 2)
- [ ] Platform Optimizer - basic multi-format export (Module 1)
- [ ] Distribution Dashboard - basic queue view (Module 5)

### Phase 2: Intelligence (3-4 weeks)
- [ ] Virality Prediction Engine (Module 3)
- [ ] Platform-specific scoring factors
- [ ] Improvement suggestions

### Phase 3: Automation (2-3 weeks)
- [ ] Caption & Hashtag Intelligence (Module 4)
- [ ] Batch export functionality
- [ ] Optimal timing recommendations

### Phase 4: Integration (Future)
- [ ] Social media API integrations for direct posting
- [ ] Performance tracking and feedback loop
- [ ] A/B testing suggestions

---

## TECH STACK ADDITIONS

| Component | Technology | Purpose |
|-----------|------------|---------|
| Hook Analysis | OpenAI GPT-4 Vision | Analyze first 3s visually |
| Audio Analysis | Existing FFmpeg + AI | BPM, speech detection |
| Virality Scoring | GPT-4 | Pattern matching, predictions |
| Caption Generation | GPT-4 | Platform-optimized copy |
| Multi-Format Export | FFmpeg | Already integrated |
| Trending Data | Optional: Social APIs | Real-time trend matching |

---

## API ENDPOINTS (Proposed)

```
POST /api/distribution/analyze
  - Input: clipId
  - Output: HookAnalysis + ViralityPrediction

POST /api/distribution/export
  - Input: clipId, platforms[]
  - Output: exportedFiles[]

POST /api/distribution/caption
  - Input: clipId, platform
  - Output: CaptionPackage

GET /api/distribution/queue
  - Output: All clips with distribution status

POST /api/distribution/batch-export
  - Input: clipIds[], platforms[]
  - Output: batchJobId
```

---

## SUCCESS METRICS

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Hook Score Accuracy | >70% correlation | Compare to actual retention rates |
| Platform Prediction | >60% accuracy | Best platform = highest engagement |
| Time Saved | 2+ hours per video | User surveys, workflow timing |
| Feature Adoption | >50% of users | Usage analytics |
| Export Completion | >80% of analyzed clips | Funnel tracking |

---

## COMPETITIVE ADVANTAGE

This feature set positions Synapse Edit as:

1. **Not just an editor** → A complete content distribution system
2. **Proactive intelligence** → Tells you what will work before you post
3. **Time multiplier** → One edit becomes optimized content for 5 platforms
4. **Learning system** → Gets smarter based on what actually performs

**Key Differentiator:** Competitors help you edit. We help you go viral.

---

## OPEN QUESTIONS

1. **Direct Posting:** Should we integrate social APIs for one-click posting, or just prepare assets?
2. **Trending Data:** Worth the cost/complexity of real-time trend APIs?
3. **Performance Tracking:** How deep should the feedback loop go?
4. **Pricing:** Is this a premium tier feature or included in base?

---

*Last Updated: December 2024*
*Status: Planning*
