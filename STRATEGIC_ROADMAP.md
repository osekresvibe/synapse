# 🎯 Synapse Edit - Strategic Roadmap & Status Tracker

**Last Updated:** November 18, 2024  
**Current Version:** v2.0  
**Market Position:** 6.5/10 → Target: 9/10 by Q2 2025

---

## 📊 Executive Summary

### Our Core Differentiator
**Intent-Driven + AI Auto-Refitting** - Users specify what they want, AI delivers it. Competitors make users build frame-by-frame.

### Market Position
- ✅ **Solved:** Intent-driven workflow, AI auto-refitting, engagement analysis
- 🚧 **In Progress:** Multi-track audio, performance optimization
- ❌ **Missing:** Stock media integration, advanced transitions, GPU acceleration

---

## 🎯 CORE FEATURES STATUS

### ✅ COMPLETED (v2.0)

#### 1. Intent-Driven Workflow
- **Status:** ✅ Fully Implemented
- **Location:** `client/src/components/intent-selector.tsx`
- **Features:**
  - Single video with custom duration
  - Multiple clips generation
  - Comprehensive edits
  - AI-decide mode
  - Aspect ratio detection (9:16, 1:1, 16:9)
  - Vibe/color grading presets (14 options)

#### 2. AI Auto-Refitting Engine
- **Status:** ✅ Fully Implemented
- **Location:** `server/routes.ts` (line ~1020)
- **Features:**
  - Smart clip removal when too long
  - Intelligent clip addition when too short
  - Engagement-based prioritization
  - **This is our MOAT** - competitors don't have this

#### 3. Smart Slice Analysis
- **Status:** ✅ Fully Implemented
- **Location:** `server/services/ai-analyzer.ts`
- **Features:**
  - AI engagement scoring
  - Scene type detection
  - Motion analysis
  - AI-powered thumbnail selection (GPT-4 Vision)
  - Keyword extraction

#### 4. Script-to-Video Pipeline (CAROUSEL MODE)
- **Status:** ✅ Fully Implemented
- **Location:** `server/routes.ts` (processScriptProject function)
- **Features:**
  - GPT-4 script parsing into scenes
  - Text-to-speech voiceovers (OpenAI TTS)
  - Slide image generation
  - Video carousel assembly
  - Color grading application
- **Outputs:** Video, slides, audio

#### 5. AI Video Generation (V5.0 - Runway Gen-3)
- **Status:** ✅ Fully Implemented
- **Location:** `server/services/ai-video-generator.ts`
- **Features:**
  - Script → Cinematic prompts conversion
  - Runway Gen-3 API integration
  - Scene-by-scene video generation
  - Multiple style presets (cinematic, documentary, dramatic)
  - Automatic scene stitching
- **API:** Runway Gen-3 Turbo (6s scenes)

#### 6. Color Grading System
- **Status:** ✅ Fully Implemented
- **Location:** `server/luts/` + `VideoProcessor.applyColorGrading()`
- **Presets:** 14 LUT-based filters
  - Vibrant, Cinematic, Corporate, Instagram, TikTok, YouTube
  - Dramatic, Pastel, Neon, Vintage, Film Noir, Golden Hour, Sunset, High Contrast

#### 7. Video Finalization Suite
- **Status:** ✅ Fully Implemented
- **Location:** `client/src/components/video-finalize.tsx`
- **Features:**
  - Smart subtitle positioning (AI-analyzed safe zones)
  - Text overlays with timestamp control
  - Branding watermarks
  - Advanced transitions (fade, dissolve, wipe, slide)
  - Multi-style customization

#### 8. Batch Upload Processing
- **Status:** ✅ Fully Implemented
- **Location:** `server/routes.ts` (batch endpoints)
- **Features:**
  - Upload up to 10 videos simultaneously
  - Parallel processing (max 3 concurrent)
  - Unified intent configuration
  - Batch progress tracking

---

## 🚧 IN PROGRESS (Partially Implemented)

### 1. Multi-Track Audio Mixer
- **Status:** 🚧 70% Complete
- **Location:** `server/services/audio-mixer.ts`
- **What's Done:**
  - AudioMixerControls UI component exists
  - Audio upload endpoint (`/api/upload-audio`)
  - Basic mixing infrastructure
- **What's Missing:**
  - Frontend integration with video player
  - Audio ducking (auto-lower music during speech)
  - Real-time preview
  - Waveform visualization
- **Priority:** HIGH - Competitors have this
- **Effort:** 1 week

### 2. Advanced Transitions
- **Status:** 🚧 50% Complete
- **Location:** `server/services/transition-engine.ts`
- **What's Done:**
  - TransitionEngine service exists
  - Basic fade/dissolve implemented
  - Integration in finalization pipeline
- **What's Missing:**
  - Wipe, slide, zoom transitions
  - Per-clip transition customization UI
  - Transition preview
- **Priority:** MEDIUM
- **Effort:** 3 days

---

## ❌ NOT STARTED (Critical Gaps)

### 1. Stock Media Library (Pexels Integration)
- **Status:** ❌ Not Started (UI placeholder exists)
- **API:** Pexels API (FREE tier available)
- **What's Needed:**
  - Pexels API key setup (environment variable)
  - Search interface in UI
  - Drag-and-drop to timeline
  - B-roll insertion into clips
- **Location:** Placeholder in `client/src/pages/home.tsx` (line ~365)
- **Priority:** HIGH - Quick win
- **Effort:** 1 week
- **API Cost:** FREE (50 requests/hour)
- **Implementation Plan:**
  1. Add `PEXELS_API_KEY` to Replit Secrets
  2. Create `server/services/pexels-api.ts`
  3. Build search UI component
  4. Add download + insert logic

### 2. GPU-Accelerated Processing
- **Status:** ❌ Not Started
- **Current:** CPU-based FFmpeg (SLOW - 60s per video)
- **Target:** NVIDIA NVENC encoding (10x faster)
- **Blocker:** Requires GPU-enabled Replit infrastructure
- **Priority:** CRITICAL - Speed is table stakes
- **Effort:** 2 weeks + infrastructure
- **Monthly Cost:** $800-1200 (4x RTX 3090 servers)

### 3. Parallel Processing Pipeline
- **Status:** ❌ Not Started (only batch upload uses it)
- **What's Needed:**
  - Worker threads for frame extraction
  - Concurrent color grading
  - Background video generation while editing
- **Priority:** HIGH - 5x speed improvement
- **Effort:** 1 week

### 4. Real-Time Collaboration
- **Status:** ❌ Not Started
- **What's Needed:**
  - WebSocket server (Socket.io)
  - CRDT for conflict resolution (Yjs/Automerge)
  - Presence indicators
  - Shared project state
- **Priority:** MEDIUM - Enterprise feature
- **Effort:** 3 weeks

### 5. Download & Share Feature
- **Status:** ❌ Not Started (removed from UI, planned for v4.1)
- **What's Needed:**
  - Direct download button for processed videos
  - Social media share integration (TikTok, Instagram, YouTube)
  - Format optimization per platform
  - Cloud export options
- **Priority:** MEDIUM - Nice to have but not critical
- **Effort:** 1 week

---

## 🔄 RETHINKING THE STRATEGY

### ❌ REMOVING: "Video to Script" Feature
**Reason:** Users don't come with videos to create scripts. They come with scripts to create videos.

### ✅ ADDING: "Audio to Video Story" Feature
**Concept:** Upload podcast/voiceover → AI generates script → Creates video story

#### Implementation Plan:
1. **Audio Transcription**
   - OpenAI Whisper API (already integrated)
   - Extract voiceover from uploaded audio
   - Generate timestamped transcript

2. **Script Analysis**
   - Use existing `ScriptAnalyzer` service
   - Parse transcript into scenes
   - Identify key moments/quotes

3. **Video Generation Routes**
   - Option A: AI video generation (Runway Gen-3)
   - Option B: Stock footage + slides (Pexels + SlideGenerator)
   - Option C: Hybrid approach

4. **Audio Sync**
   - Use original audio as voiceover track
   - Sync video scenes with audio timestamps
   - Auto-cut on pauses/breath marks

**Priority:** MEDIUM  
**Effort:** 2 weeks (leverages existing infrastructure)  
**Depends On:** Pexels integration for B-roll

---

### 🎭 Feature: Talking Heads for App Intros & Sales Campaigns

**Status:** 🔄 Planned  
**Target:** Agencies & Content Creators  
**Use Case:** Generate professional talking head videos from scripts (product demos, app intros, sales pitches)

#### What Makes This Different from Competitors:
- **Not template-driven** (like Yapper, D-ID, Synthesia)
- **AI generates the visuals** based on script context
- **Natural, non-robotic presentation**
- **Customizable character styles** (professional, casual, energetic, etc.)

#### Technical Approach:
1. **Script Input** → User provides sales script or app intro text
2. **Character Selection** → Choose presenter style (professional, friendly, technical)
3. **AI Video Generation** → Runway Gen-3 generates talking head footage
4. **Lip Sync** (Optional) → Use Runway's Gen-3 alpha for mouth movement sync
5. **Background Options** → Office, studio, minimal, custom

#### Implementation (Uses Existing Infrastructure):
- **Frontend:** New "Talking Head" mode in ScriptInput component
- **Backend:** Extend `ai-scene-analyzer.ts` with talking head prompt templates
- **API:** Runway Gen-3 Alpha (supports better human generation)
- **Customization:** Character description in `userContext` field

**Priority:** HIGH (Competitive differentiator for agencies)  
**Effort:** 1 week (leverages existing AI video pipeline)  
**Revenue Impact:** High (targets B2B agencies)

---

### 🎬 Feature: Multi-Character Mini-Series with Voice Roles

**Status:** 🔄 Planned  
**Target:** Storytellers, Content Creators, Educators  
**Use Case:** Create episodic content with multiple characters/voices playing different roles (mini-series, educational shows, narrative podcasts turned into video)

#### What This Unlocks:
- **Character-driven storytelling** (e.g., "The History of Rome" with multiple historical figures)
- **Educational mini-series** (e.g., "Science Explained" with host + expert voices)
- **Narrative podcasts → Video** (automatically cast different speakers as visual characters)
- **Movie-style scripts** with dialogue between characters

#### User Experience:
```
1. User writes script with character tags:
   [NARRATOR]: "In 44 BC, Julius Caesar was assassinated..."
   [CAESAR]: "Et tu, Brute?"
   [BRUTUS]: "For the good of Rome..."

2. AI automatically:
   - Detects character roles
   - Assigns different TTS voices (male/female/neutral)
   - Generates character-specific visuals (Runway Gen-3)
   - Sequences scenes with character transitions

3. Output: Episodic video series with distinct characters
```

#### Technical Implementation:

**Phase 1: Script Parsing (2 days)**
- Extend `ScriptAnalyzer.parseScriptToScenes()` to detect `[CHARACTER]:` tags
- Extract character list and dialogue per character
- Assign TTS voice IDs (OpenAI TTS has 6 voices: alloy, echo, fable, onyx, nova, shimmer)

**Phase 2: Character Voice Mapping (1 day)**
```typescript
// server/services/character-voice-mapper.ts
interface CharacterVoiceMap {
  characterName: string;
  voiceId: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  gender: 'male' | 'female' | 'neutral';
  visualStyle: string; // "Roman general in armor", "Scientist in lab coat"
}

function assignVoicesToCharacters(characters: string[]): CharacterVoiceMap[] {
  // Smart assignment based on character name/context
  // E.g., "CAESAR" → male voice + "Roman emperor in toga"
}
```

**Phase 3: Multi-Voice TTS Generation (3 days)**
- Extend `tts-generator.ts` to support per-character voice selection
- Generate separate audio files per character
- Combine audio with timing metadata

**Phase 4: Character-Specific AI Video (3 days)**
- Extend `ai-scene-analyzer.ts` to generate character-specific prompts
- Example: `[CAESAR]` → "Close-up of Roman emperor in toga, speaking confidently"
- Use `userContext` to pass character descriptions to Runway

**Phase 5: Episode Sequencing (2 days)**
- Auto-split long scripts into episodes (based on scene breaks or length)
- Generate episode metadata (title, character list, duration)
- Create playlist/series structure in database

#### Database Schema Updates:
```typescript
// Add to shared/schema.ts
export const characters = pgTable("characters", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id),
  name: text("name").notNull(), // "CAESAR", "NARRATOR"
  voiceId: text("voice_id").notNull(), // OpenAI TTS voice
  visualStyle: text("visual_style"), // "Roman general in armor"
  dialogueCount: integer("dialogue_count").default(0)
});

export const episodes = pgTable("episodes", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id),
  episodeNumber: integer("episode_number").notNull(),
  title: text("title"),
  duration: integer("duration"),
  characterList: text("character_list").array() // ["CAESAR", "BRUTUS"]
});
```

#### Frontend Updates:
- Add **"Mini-Series Mode"** toggle in ScriptInput
- Character assignment UI (drag characters to voice options)
- Episode preview list
- Character spotlight view (filter scenes by character)

**Priority:** MEDIUM-HIGH (Unique differentiator, storytelling niche)  
**Effort:** 2 weeks  
**Dependencies:** Existing AI video + TTS pipeline  
**Revenue Potential:** High (attracts educators, storytellers, content studios)

---

## 📋 90-DAY EXECUTION PLAN

### 🔥 MONTH 1: Speed & Feature Parity (Weeks 1-4)

#### Week 1-2: FINISH MULTI-TRACK AUDIO
- [ ] Integrate AudioMixerControls into video player
- [ ] Implement audio ducking algorithm
- [ ] Add waveform visualization
- [ ] Test with background music + voiceover

#### Week 3: STOCK MEDIA INTEGRATION
- [ ] Set up Pexels API key in Secrets
- [ ] Build search interface component
- [ ] Implement video/image download
- [ ] Add drag-to-timeline functionality

#### Week 4: PARALLEL PROCESSING
- [ ] Implement worker thread pool
- [ ] Parallelize color grading
- [ ] Background video generation
- [ ] 5x speed improvement target

**End-of-Month Goal:** 8/10 feature completeness

---

### 🎨 MONTH 2: Polish & Differentiation (Weeks 5-8)

#### Week 5: AUDIO-TO-VIDEO STORY
- [ ] Audio upload + transcription
- [ ] Script generation from transcript
- [ ] Scene-audio synchronization
- [ ] B-roll insertion from Pexels

#### Week 6-7: ADVANCED TRANSITIONS
- [ ] Wipe, slide, zoom effects
- [ ] Per-clip transition UI
- [ ] Transition preview system
- [ ] Template library (3-5 presets)

#### Week 8: AI VIDEO UNDERSTANDING
- [ ] "Make this funnier" - punchline detection
- [ ] "Remove boring parts" - engagement-based trimming
- [ ] Scene auto-chaptering
- [ ] GPT-4 Vision analysis enhancements

**End-of-Month Goal:** 9/10 feature completeness + unique AI features

---

### 🚀 MONTH 3: Performance & Enterprise (Weeks 9-12)

#### Week 9-10: GPU ACCELERATION (if infrastructure available)
- [ ] NVIDIA NVENC encoding setup
- [ ] CUDA-accelerated filters
- [ ] 60s → 5s processing time

#### Week 11: COLLABORATION FEATURES
- [ ] Project sharing + permissions
- [ ] Real-time sync (basic)
- [ ] Comment system

#### Week 12: POLISH + LAUNCH
- [ ] Bug fixes
- [ ] Performance optimization
- [ ] Marketing materials
- [ ] Case studies

**End-of-Quarter Goal:** Market-ready product, 150 paid users

---

## 💰 INFRASTRUCTURE CHECKLIST

### Environment Variables Needed:
- [x] `OPENAI_API_KEY` - ✅ Configured
- [x] `RUNWAY_API_KEY` - ✅ Configured (needs verification)
- [ ] `PEXELS_API_KEY` - ❌ NOT SET (free tier)
- [ ] `ELEVENLABS_API_KEY` - ❌ Optional (voice cloning)

### Current Costs (Estimated):
- OpenAI API: ~$200-500/month (1000 users)
- Runway Gen-3: ~$300-600/month (pay-per-use)
- **Total:** $500-1100/month

### With GPU Acceleration:
- GPU Servers: +$800-1200/month
- **Total:** $1300-2300/month
- **Break-even:** ~115 users @ $20/mo

---

## 🎯 SUCCESS METRICS

### 3-Month Targets:
- Processing time: 60s → 5s (with GPU) or 60s → 15s (with parallel processing)
- Feature completeness: 65% → 95%
- User retention: 20% → 50%
- Daily active users: 100 → 1000

### 6-Month Targets:
- Revenue: $0 → $10k MRR
- Enterprise customers: 0 → 5
- Unique AI features: 2 → 5

---

## 🔑 IMMEDIATE NEXT STEPS (This Week)

1. **FINISH MULTI-TRACK AUDIO** (2 days)
   - Connect UI to backend
   - Test audio mixing pipeline

2. **SET UP PEXELS API** (1 day)
   - Add API key to Secrets
   - Verify API access
   - Build basic search endpoint

3. **IMPLEMENT PARALLEL PROCESSING** (2 days)
   - Worker thread pool
   - Concurrent color grading

**Ship these 3 features = 7.5/10 rating achieved**

---

## 📝 NOTES & DECISIONS

### Strategy Pivots:
- ❌ **Removed:** Video-to-Script (no user demand)
- ✅ **Added:** Audio-to-Video Story (podcast market opportunity)
- ✅ **Prioritized:** Stock media over custom templates (commoditized)

### Tech Debt:
- Mock mode still enabled by default (set `MOCK_MODE=false` for production)
- Thumbnail caching not optimized (use CDN in future)
- Database migrations needed for collaboration features

### Competitive Analysis Update:
- Descript: Leading in collaboration, weak in AI video gen
- CapCut: Mobile-first, template-heavy
- Runway: AI video gen only, no editing workflow
- **Our Position:** Best of all worlds - AI-driven + full editing suite

---

**Next Review:** December 15, 2024  
**Owner:** Development Team  
**Status:** Active Development