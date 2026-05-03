# Multi-Track Audio Mixer - Test Plan

## Feature Overview
The Multi-Track Audio Mixer allows users to:
- Upload 3 types of tracks: Music, Voiceover, SFX
- Adjust volume sliders for each track (0-100%)
- Preview individual tracks before mixing
- AI automatically balances levels (music quieter, voiceover prominent)
- One-click "Apply Mix" button
- FFmpeg-based multi-track mixing
- Automatic audio normalization
- Non-destructive (original video preserved)

## Architecture

### Frontend Components
- **`AudioMixerControls`** (`client/src/components/audio-mixer-controls.tsx`)
  - Tab-based UI: Background, Voiceover, Ducking
  - Visual volume sliders for each track
  - Track upload via `/api/upload-audio`
  - Fade in/out controls
  - Master volume control
  
- **`VideoFinalize`** (`client/src/components/video-finalize.tsx`)
  - Orchestrates finalization workflow
  - "Audio Mix" tab integrates AudioMixerControls
  - Sends finalization config including audio tracks

### Backend Services
- **`AudioMixer.mixAudioTracks()`** (`server/services/audio-mixer.ts`)
  - FFmpeg-based audio mixing
  - Volume adjustment per track (logarithmic dB scale)
  - Fade in/out per track
  - Audio ducking via sidechain compression
  - Master volume control

### API Endpoints
- **`POST /api/upload-audio`** - Upload audio files
- **`POST /api/projects/:projectId/videos/:videoId/mix-audio`** - Mix audio tracks (DEPRECATED/UNUSED)
- **`POST /api/projects/:projectId/videos/:videoId/finalize`** - Apply finalization settings

## 🚨 CRITICAL ISSUE IDENTIFIED

### Problem: Audio Mixing NOT Integrated into Finalization

The `/finalize` endpoint **DOES NOT** call `AudioMixer.mixAudioTracks()`.

**Current finalization flow:**
1. ✅ Phase 1: Apply transitions
2. ❌ **MISSING: Apply audio mixing** 
3. ✅ Phase 2: Apply subtitles, overlays, branding

**Expected flow:**
1. Phase 1: Apply transitions
2. **Phase 2: Mix audio tracks** ← MISSING
3. Phase 3: Apply subtitles, overlays, branding

### Impact
- Users can configure audio in the UI
- Configuration is sent to backend
- **Backend ignores audio configuration**
- Final video has no custom audio mixing applied

## Test Scenarios

### Test 1: Upload Audio Tracks ✅
**Steps:**
1. Navigate to finalization screen
2. Click "Audio Mix" tab
3. Upload Background music track
4. Upload Voiceover track
5. Verify tracks appear in UI

**Expected:**
- Tracks upload successfully
- Display in respective tabs with volume sliders
- Default volume: 100%

### Test 2: Volume Slider Controls ✅
**Steps:**
1. Upload 2+ tracks
2. Adjust volume sliders
3. Verify values update

**Expected:**
- Slider moves smoothly
- Volume percentage displays correctly
- Config state updates

### Test 3: Audio Ducking Configuration ✅
**Steps:**
1. Upload background + voiceover tracks
2. Navigate to "Ducking" tab
3. Enable auto-ducking
4. Adjust reduction ratio (default 50%)
5. Adjust attack/release times

**Expected:**
- Ducking toggle works
- Sliders control ducking parameters
- Help text explains feature

### Test 4: Fade In/Out Controls ✅
**Steps:**
1. Upload a track
2. Set fade in: 0.5s
3. Set fade out: 1.0s

**Expected:**
- Number inputs accept decimal values
- Min value: 0
- Updates track config

### Test 5: Master Volume Control ✅
**Steps:**
1. Upload tracks
2. Adjust master volume slider (0-100%)

**Expected:**
- Master volume affects all tracks
- Independent of individual track volumes

### Test 6: Remove Track ✅
**Steps:**
1. Upload multiple tracks
2. Click remove icon on a track
3. Verify track removed

**Expected:**
- Track disappears from UI
- Config updates correctly
- Other tracks unaffected

### Test 7: **Apply Finalization with Audio** ❌ FAILS
**Steps:**
1. Upload background music + voiceover
2. Configure volumes (music: 60%, voice: 100%)
3. Enable ducking
4. Click "Apply & Download"
5. Download final video
6. Check audio in final video

**Expected:**
- Final video contains mixed audio
- Music volume reduced
- Voiceover prominent
- Ducking applied during speech

**ACTUAL:**
- Audio mixing is **NOT applied**
- Original video audio unchanged
- Custom tracks ignored

### Test 8: AI Auto-Balance (Ducking) ❌ UNTESTED
**Steps:**
1. Upload music (100%) + voiceover (100%)
2. Enable ducking with 50% reduction
3. Apply finalization
4. Listen to final video

**Expected:**
- Music automatically lowers when voiceover speaks
- Smooth transitions (attack/release)
- Music returns to full volume during silence

**ACTUAL:**
- Cannot test - audio mixing not integrated

### Test 9: Multiple Background Tracks ❌ UNTESTED
**Steps:**
1. Upload 2 background music tracks
2. Set different volumes (music1: 50%, music2: 80%)
3. Apply finalization

**Expected:**
- Both tracks mixed together
- Individual volume levels respected
- Smooth audio blend

### Test 10: SFX Tracks ❌ UNTESTED
**Steps:**
1. Upload SFX track (e.g., whoosh, impact sound)
2. Set start time: 5s
3. Apply finalization

**Expected:**
- SFX plays at specified timestamp
- Mixes with other audio tracks
- Correct timing

### Test 11: Normalization ❌ UNTESTED
**Steps:**
1. Upload very quiet background music
2. Upload very loud voiceover
3. Apply finalization

**Expected:**
- FFmpeg normalizes audio levels
- No clipping/distortion
- Professional-sounding mix

### Test 12: Professional Result Quality ❌ UNTESTED
**Criteria:**
- No audio artifacts
- Smooth fade transitions
- Ducking sounds natural
- Volume levels balanced
- Comparable to manual editing in professional tools

## Integration Requirements

### Backend Changes Needed

#### 1. Integrate Audio Mixing into Finalization Endpoint

**File:** `server/routes.ts`
**Location:** `/api/projects/:projectId/videos/:videoId/finalize`

**Add Phase 1.5 - Audio Mixing (BEFORE visual effects):**

```typescript
// PHASE 1.5: Apply audio mixing if tracks provided
if (config.audio?.tracks && config.audio.tracks.length > 0) {
  const audioMixedPath = path.join(process.cwd(), "uploads", "videos", `audio-mixed-${nanoid()}.mp4`);
  
  console.log(`[finalize] Mixing ${config.audio.tracks.length} audio tracks`);
  
  await AudioMixer.mixAudioTracks(
    currentVideoPath,
    config.audio.tracks,
    config.audio.ducking || { enabled: false, threshold: -24, ratio: 50, attack: 0.1, release: 0.5 },
    config.audio.masterVolume || 100,
    audioMixedPath
  );
  
  // Cleanup previous temp file
  if (currentVideoPath !== VideoProcessor.getFullPath(video.videoPath) && transitionOutputPath !== currentVideoPath) {
    if (fs.existsSync(currentVideoPath)) fs.unlinkSync(currentVideoPath);
  }
  
  currentVideoPath = audioMixedPath;
  console.log(`[finalize] Audio mixing complete: ${audioMixedPath}`);
}
```

**Insert location:** After transition processing (line ~1531), before subtitle/overlay processing (line ~1540)

#### 2. Add Import Statement

```typescript
import { AudioMixer } from './services/audio-mixer';
```

#### 3. Add Cleanup for Audio-Mixed Temp File

In the `finally` block, add:

```typescript
// Cleanup audio-mixed temp file
if (currentVideoPath.includes('audio-mixed') && fs.existsSync(currentVideoPath)) {
  fs.unlinkSync(currentVideoPath);
}
```

### Frontend Changes (Optional Enhancements)

1. **Audio Preview** - Play individual tracks before mixing
2. **Waveform Visualization** - Show audio waveforms
3. **Real-time Preview** - Preview mixed audio before applying
4. **Presets** - Save/load common audio configs

## Success Criteria

✅ **Basic Functionality:**
- [ ] Upload background, voiceover, SFX tracks
- [ ] Adjust volumes independently
- [ ] Enable/disable ducking
- [ ] Configure fade in/out
- [ ] Apply finalization with audio

✅ **Audio Quality:**
- [ ] No clipping or distortion
- [ ] Smooth fade transitions
- [ ] Natural-sounding ducking
- [ ] Balanced mix (music quieter, voice prominent)

✅ **AI Auto-Balance:**
- [ ] Ducking reduces background when voiceover plays
- [ ] Attack/release times create smooth transitions
- [ ] Music returns to normal during silence

✅ **Professional Output:**
- [ ] Comparable to manual DAW mixing
- [ ] No audio artifacts
- [ ] Proper normalization
- [ ] Broadcast-ready quality

## Testing Tools Needed

1. **Sample Audio Files:**
   - Background music (instrumental, ~30s)
   - Voiceover (narration, ~20s)
   - SFX (whoosh/impact sounds)

2. **Video Analysis:**
   - FFprobe to inspect audio streams
   - Audacity to visualize waveforms
   - Professional audio meter

3. **Comparison:**
   - Original video audio
   - Mixed video audio
   - Manually mixed reference (gold standard)

## Risk Assessment

### High Risk
❌ **Audio mixing not integrated** - Feature appears functional in UI but doesn't work

### Medium Risk
⚠️ **FFmpeg filter complexity** - Ducking with multiple tracks may have edge cases
⚠️ **Volume conversion** - dB scale conversion must be accurate

### Low Risk
✅ **UI controls** - Well-implemented, functional
✅ **File uploads** - Standard implementation

## Next Steps

1. **Fix Integration** - Add audio mixing to finalization endpoint
2. **Manual Testing** - Upload real audio files and test end-to-end
3. **Playwright E2E Test** - Automate test scenarios 1-7
4. **Quality Validation** - Compare output with professional tools
5. **Performance Testing** - Test with multiple/large audio files

## Notes

- FFmpeg must be installed on the system
- Audio files should be common formats (MP3, WAV, AAC)
- Ducking uses sidechain compression (sidechaincompress filter)
- Volume scale: 0% = -60dB (mute), 100% = 0dB (no change)
- Logarithmic volume conversion ensures natural-sounding adjustments
