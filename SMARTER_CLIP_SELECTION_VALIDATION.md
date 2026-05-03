# "Smarter Clip Selection" Feature - Validation Report

**Date:** November 19, 2025  
**Feature Status:** ❌ NOT IMPLEMENTED

---

## What the Screenshot Proposes

The screenshot describes an enhancement to add **context-aware clip selection**:

### Proposed Enhancement:
> "Add a context field to your intent selector that feeds into AI analysis"

**Examples Given:**
- "Tutorial video" → prioritize clear explanations
- "Hype reel" → prioritize high-energy moments
- "Product demo" → prioritize feature showcases

### Proposed Implementation:
1. **Frontend:** Add optional `context` field to `client/src/components/intent-selector.tsx`
2. **Backend:** Update `server/services/ai-analyzer.ts` to use video context
3. **Benefits:**
   - Better first-draft quality (fewer iterations needed)
   - Platform-specific optimizations (TikTok vs. LinkedIn)
   - Tone-aware editing (energetic vs. professional)
   - Purpose-driven clip selection (tutorial vs. hype reel)

---

## Current Implementation Status

### ❌ NOT IMPLEMENTED

**Evidence from codebase:**

#### 1. Frontend Intent Selector
**File:** `client/src/components/intent-selector.tsx`

**Current state:**
- ✅ Has `vibe` selector (color grading: vibrant, cinematic, corporate, etc.)
- ✅ Has `aspectRatio` selector (9:16, 1:1, 16:9)
- ❌ **NO `videoContext` field**
- ❌ **NO "Tutorial video" / "Hype reel" / "Product demo" selector**

**Current IntentConfig interface:**
```typescript
interface IntentConfig {
  targetDuration?: number;
  clipCount?: number;
  clipDuration?: number;
  aspectRatio?: "9:16" | "1:1" | "16:9";
  vibe?: string;  // Color grading only
  // ❌ No videoContext field
}
```

#### 2. Backend AI Analyzer
**File:** `server/services/ai-analyzer.ts`

**Current method signature:**
```typescript
static selectClipsForVideo(
  slices: Array<{ id: string; startTime: number; endTime: number; engagementScore?: number | null; clipType?: string | null }>,
  targetDuration: number,
  videoType: "short" | "standard" | "comprehensive"
): string[] {
  // Selection logic based on videoType only
}
```

**Current behavior:**
- ✅ Selects clips based on `videoType`:
  - `"short"` → High energy curve (90 → 95 → 100)
  - `"standard"` → Narrative arc (85 → 75 → 90 → 80)
  - `"comprehensive"` → Full story (80 → 70 → 85 → 75 → 90 → 85)
- ✅ Uses `preferredTypes`: ["hook", "chorus", "verse", "talking_head", "broll"]
- ❌ **NO `videoContext` parameter**
- ❌ **NO purpose-driven selection** (tutorial vs. hype reel)

**What's missing:**
- No context-aware prompting for Vision API
- No tutorial-specific clip prioritization
- No product demo feature showcase logic
- No platform-specific optimizations beyond videoType

---

## Gap Analysis

### What EXISTS Currently:
1. ✅ **videoType-based selection** (short/standard/comprehensive)
2. ✅ **Energy curve optimization** for different video types
3. ✅ **Diversity scoring** to avoid repetitive clips
4. ✅ **Preferred clip types** (hook, verse, chorus, etc.)
5. ✅ **Vibe/color grading selector** (vibrant, cinematic, etc.)

### What's MISSING (Per Screenshot):
1. ❌ **videoContext field** in frontend intent selector
2. ❌ **Context-aware AI analysis** in backend
3. ❌ **Purpose-driven clip selection** (tutorial, hype, demo)
4. ❌ **Platform-specific optimizations** (TikTok vs. LinkedIn)
5. ❌ **Tone-aware editing** (energetic vs. professional)

---

## Why Current System ≠ Proposed Feature

| Aspect | Current System | Proposed Feature |
|--------|----------------|------------------|
| **Input Type** | videoType: "short" \| "standard" \| "comprehensive" | videoContext: "Tutorial" \| "Hype reel" \| "Product demo" |
| **Purpose** | Duration-based selection strategy | Content purpose-driven selection |
| **AI Analysis** | Generic engagement scoring | Context-aware scoring (e.g., "clear explanations" for tutorials) |
| **Clip Prioritization** | Energy curve-based | Purpose-based (features for demos, energy for hype) |
| **Platform Optimization** | None | TikTok vs. LinkedIn style differences |

**Example difference:**
- **Current:** "standard" video → selects clips with narrative arc (85 → 75 → 90 → 80)
- **Proposed:** "Tutorial video" → prioritizes clips with clear explanations, step-by-step pacing, lower energy for clarity

---

## Implementation Checklist (If Proceeding)

### Phase 1: Schema & Types (2 hours)
- [ ] Add `videoContext` field to `IntentConfig` type in `shared/schema.ts`
- [ ] Define context enum: `"tutorial" | "hype" | "demo" | "vlog" | "review"` etc.
- [ ] Update database schema if persisting context

### Phase 2: Frontend (3 hours)
- [ ] Add context selector to `intent-selector.tsx`
- [ ] Design UI for context dropdown/cards
- [ ] Wire context to `onSelect` callback
- [ ] Add data-testid attributes

### Phase 3: Backend AI Enhancement (5-8 hours)
- [ ] Update `selectClipsForVideo()` to accept `videoContext` parameter
- [ ] Define context-specific selection rules:
  ```typescript
  if (videoContext === "tutorial") {
    // Prioritize talking_head clips with clear audio
    // Lower energy threshold (65-75 instead of 85-90)
    // Prefer longer clips for explanation clarity
  } else if (videoContext === "hype") {
    // Maximum energy clips only (90+)
    // Fast cuts, short clips
    // Action and hook clip types
  } else if (videoContext === "demo") {
    // Feature showcase clips
    // Product visibility scoring
    // Clear visual demonstration moments
  }
  ```
- [ ] Update Vision API prompts with context:
  ```typescript
  const prompt = `Score engagement for a ${videoContext} video...`
  ```
- [ ] Implement platform-specific tweaks (TikTok vs. LinkedIn)

### Phase 4: Testing (2 hours)
- [ ] Test tutorial context → verify explanation clips prioritized
- [ ] Test hype context → verify high-energy clips only
- [ ] Test demo context → verify feature showcases selected
- [ ] Compare results with/without context

**Total Estimated Effort:** 12-15 hours

---

## Recommendation

**Current Status:** Feature does NOT exist in codebase.

**Options:**

### Option A: Implement as V4.0 Feature
- **Effort:** 12-15 hours (full implementation)
- **Value:** High - significantly improves clip selection quality
- **Risk:** Low - additive feature, doesn't break existing functionality

### Option B: Use Existing videoType System
- **Effort:** 0 hours (already implemented)
- **Value:** Moderate - videoType provides basic selection strategies
- **Risk:** None - currently production-ready

### Option C: Enhance Existing System
- **Effort:** 4-6 hours (map videoType to purposes)
- **Value:** Medium - improve current system without full refactor
- **Example:**
  ```typescript
  // Map existing videoTypes to purposes
  "short" → high energy (similar to "hype")
  "standard" → balanced narrative (similar to "tutorial")
  "comprehensive" → full story (similar to "review")
  ```

---

## Conclusion

**The "Smarter Clip Selection" feature from the screenshot has NOT been implemented.**

**Current system:**
- Uses `videoType` ("short" | "standard" | "comprehensive")
- Energy curve-based selection
- No videoContext field

**Proposed system:**
- Would use `videoContext` ("tutorial" | "hype" | "demo")
- Purpose-driven selection
- Context-aware AI analysis

**Gap:** ~80% of proposed functionality missing (context field, purpose-driven logic, platform optimizations)

**Next Steps:** Decide if this feature should be implemented for V4.0 or if current videoType system is sufficient for V3.0 release.

---

**Validated by:** Codebase Analysis  
**Files Checked:** 
- `client/src/components/intent-selector.tsx`
- `server/services/ai-analyzer.ts`
- `shared/schema.ts`
