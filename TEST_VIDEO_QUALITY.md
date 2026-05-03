
# Video Quality Testing Checklist

## Test 1: Clip Duration Validation
- [ ] Upload 60s video
- [ ] Select "Multiple clips" with 30s target
- [ ] Verify: Creates max 2 clips (60/30 = 2)
- [ ] Verify: No clips shorter than 0.75s
- [ ] Verify: High engagement clips (85+) get 2-3s duration

## Test 2: AI Feedback Refinement
- [ ] Generate initial video
- [ ] Submit feedback: "make it faster and more energetic"
- [ ] Verify: New video has higher engagement clips
- [ ] Verify: Vibrant color grading applied
- [ ] Verify: Shorter clip durations

## Test 3: Smart Clip Selection
- [ ] Upload tutorial video (context: tutorial)
- [ ] Verify: Selects talking_head clips
- [ ] Verify: Longer clip durations (3-5s)
- [ ] Upload hype video (context: hype)
- [ ] Verify: Selects action/hook clips only
- [ ] Verify: Fast cuts (1-2s)

## Test 4: Video Path Validation
- [ ] Generate all 3 video types
- [ ] Verify: All video files exist on disk
- [ ] Verify: All video URLs load in browser
- [ ] Verify: No 404 errors in console

## Test 5: Comprehensive Editor
- [ ] Drag clips in Smart Slices timeline
- [ ] Verify: Video regenerates with new sequence
- [ ] Apply mood preset
- [ ] Verify: Color grading applied
- [ ] Export video
- [ ] Verify: Downloaded file plays correctly
