# Synapse Edit - Editing Principles & Viral Formula

## The Viral Formula
> "A Visually Explosive, Emotionally Charged Hook, followed by a Relentlessly Paced, Relatable/Valuable Core, that is cut just short enough to drive a re-watch or compel an identity-driven share."

---

## 1. The Hook (First 3 Seconds - Serving the Algorithm)

The primary goal is to maximize **Audience Retention** and **Re-watches**.

| Element | Principle | Automation Focus |
|---------|-----------|------------------|
| **The Pacing** | Pattern Interruption | Cuts every 1-2 seconds, extreme energy, movement, unconventional sound |
| **The Visual** | Instant Curiosity | Text overlay detection, action-filled moments, dramatic peaks |
| **The Tease** | Open Loop | Start with punchline/result, delay the answer |
| **The Rule** | 3-Second Filter | If premise isn't clear in 3s, viewer is gone |

### Implementation:
- Hook clips ≤3 seconds, highest engagement score
- Prioritize clips tagged: `hook`, `action`, `peak`, `climax`
- Auto-generate text overlay option for curiosity hooks
- Never start with low-energy content (intros, setup shots)

---

## 2. The Arousal (Content Psychology)

Content must trigger **strong, high-arousal emotions** to be shareable.

| Emotion | Sharing Motivation | Example Content |
|---------|-------------------|-----------------|
| **Awe/Inspiration** | Sharing hope, wonder | Transformations, feats of skill, kindness |
| **Humor** | Building social bonds | Relatable comedy, unexpected twists |
| **Anger/Outrage** | Signaling identity | Unpopular opinions, debate sparkers |
| **Relatability** | Connection with others | Universal experiences, niche frustrations |
| **Practical Utility** | Looking knowledgeable | Life hacks, tips, educational content |

### Implementation:
- Sentiment analysis on transcripts to detect emotional peaks
- Tag clips with emotional categories
- Prioritize high-arousal segments in clip selection

---

## 3. The Loop (Retention & Distribution)

| Element | Principle | Automation Focus |
|---------|-----------|------------------|
| **Clarity** | Sound-Off Viewing | Bold, animated captions (80%+ watch on mute) |
| **The Pacing** | Value Density | Remove all filler, every shot advances value |
| **The Share** | Social Currency | Content makes sharer look good |
| **The Finale** | Encourage Re-Watch | End on punchline or just before climax |
| **The Call** | Prompt Engagement | Direct CTA for comments/shares |

### Implementation:
- Auto-generate ASS-styled captions with word highlighting
- Filler word detection and removal ("um", "uh", pauses)
- Strategic endpoint selection (climax or just before)
- Optional CTA text overlay at end

---

## Core Guiding Principles (Universal)

| Principle | Description | Automation Focus |
|-----------|-------------|------------------|
| **Continuity** | Seamless flow of time, space, action | Shot matching for visual/spatial logic |
| **Pacing & Rhythm** | Shot duration dictates energy | Audio cues (tempo) + visual cues (motion) |
| **Emotional Pacing** | Guide emotional journey | Sentiment analysis, align cuts to emotional shifts |
| **B-roll & Context** | Break up talking, add depth | Auto-insert B-roll based on transcript keywords |
| **Sound Sync** | Audio supports visual | Voice priority for dialogue, track priority for music |

---

## Format-Specific Priority Stacks

### 1. 🎮 Gaming/Streaming (Priority: Action Synthesis)
**Goal:** Condense hours of raw footage into minutes of concentrated excitement.

| Principle | Automation Goal | Key Action |
|-----------|----------------|------------|
| **Reaction Focus** | The reaction is funnier/more impactful than gameplay itself | **Face/Voice Syncing:** Identify high-arousal voice/face events (shouting, laughter, jump scare expression). Auto-cut to reaction cam with immediate zoom or punch-in and apply sound effects/memes |
| **Filler Removal** | No dead air or downtime during non-action segments | **Aggressive Jump-Cutting:** Use jump cuts to remove silent/slow gameplay, ensuring character/game object remains mostly centered, creating fast, manic energy |
| **Highlight Synthesis** | Create quick, branded intro/montage to hook viewers | **"Whip Cut" Reel:** Automatically compile top 3-5 most exciting clips identified by Reaction Focus model into 5-second, rapid-fire, stylized intro sequence |

### 2. 🎓 Educational (Long-form) (Priority: Concept Retention)
**Goal:** Clarity, trust, and ease of information digestion (not speed).

| Principle | Automation Goal | Key Action |
|-----------|----------------|------------|
| **Visual Reinforcement** | Visuals must constantly support the verbal concept to aid learning | **Concept-Triggered Visuals:** Identify key terms in transcript (e.g., "Mitochondria," "Compound Interest"). Auto-insert relevant supporting graphic, animation, or B-roll for 3-5 seconds before cutting back to speaker |
| **Structural Navigation** | Long videos must be easily scannable and reviewable | **Chapter Detection & Title Cards:** Detect shifts in topic based on outline/transcript. Auto-generate and insert animated Chapter Title Card with baked-in platform timestamps |
| **Pacing for Clarity** | Pacing should be steady, not manic | **Judicious Cleanup:** Remove filler words but leave natural breath/pause after complex concepts or before key transitions to allow for cognitive absorption |

### 3. 🍳 Cooking/How-To (Priority: Process Flow & Appetite)
**Goal:** Preserve procedural logic while maximizing food appeal.

| Principle | Automation Goal | Key Action |
|-----------|----------------|------------|
| **Step-by-Step Clarity** | Never lose track of core recipe steps | **Process Sequencing:** Identify key actions (Chopping, Stirring, Plating). Ensure all cuts flow logically from one step to next, often using Match Cuts (cutting on the action) or simple Crossfades between major stages |
| **Sensory Enhancement** | Make the food look and sound appealing | **Aesthetic Prioritization:** Automatically apply Color Grading profiles that boost saturation, contrast, and warmth to make food pop ("appetizing vibrant colors"). Emphasize ASMR sounds (sizzle, chop, pour) while balancing narration |
| **Time Compression** | Repetitive tasks must be dramatically sped up | **Speed Ramping:** Detect repetitive/slow-moving tasks (mixing, simmering) and automatically speed ramp the footage (4x to 8x) but use slow motion for the most important, brief events (e.g., perfect chop, satisfying drizzle) |

### 4. 😂 Comedy Sketches (Priority: Punchline Timing)
**Goal:** Rhythm and expectation management. A millisecond of difference can kill a joke.

| Principle | Automation Goal | Key Action |
|-----------|----------------|------------|
| **Punchline Isolation** | The cut must amplify the joke, not undermine it | **Tight Cutting (The "Button"):** On the punchline, automatically cut away immediately—often slightly before the character finishes the word—or cut to a reaction shot for maximum impact. **The enemy of comedy is the unnecessary pause** |
| **Setup/Payoff Structure** | Build tension before the joke lands | **Pacing Contrast:** Use fast, tight dialogue cuts for the Setup, then intentionally place a slightly awkward pause (10-20 frames of silence) right before the Payoff to increase tension, making the punchline more jarring and funny |
| **Visual Gags/Emphasis** | Visuals or sound effects must underscore the humor | **SFX/Zoom Sync:** Use sudden zoom-ins or freeze-frames combined with cartoonish sound effects (boing, record scratch) timed precisely to the visual gag or an exaggerated character reaction |

### 5. 🎵 Music Videos: Rhythm Sync → Aesthetic Filter → Dynamic Transitions
| Aspect | Principle | Automation |
|--------|-----------|------------|
| Pacing | Visual Beat Matching | Cuts timed to rhythm, tempo, lyrical accents |
| Narrative | Mood/Story enhancement | Montage sequences, rhythmic transitions |
| Visuals | Stylized effects | Unified color grade matching genre/mood |

### 6. 🎙️ Podcast Clips: Dialogue Cleanup → Dynamic Zoom → Animated Captions
| Aspect | Principle | Automation |
|--------|-----------|------------|
| Pacing | Cut the Fat | Remove filler words, long pauses, tangents |
| Visuals | Dynamic elements | Auto zoom/punch-ins every 5-8 seconds |
| Key Element | Captions | High-accuracy, stylized, animated |

### 7. 🎬 Trailers: Pacing Acceleration → Dramatic Moments → Score Matching
| Aspect | Principle | Automation |
|--------|-----------|------------|
| Pacing | Build Tension | Start slow, accelerate toward climax |
| Narrative | Highlight drama | Prioritize high-emotion clips, exclude setup |
| Audio | Tempo Mapping | Align cuts to music intensity curve |

### 8. 💬 Talking Head: Dialogue Cleanup → Visual Variety → Branding
| Aspect | Principle | Automation |
|--------|-----------|------------|
| Pacing | Judicious Cutting | J/L cuts for smooth dialogue flow |
| Visuals | Maintain engagement | Auto punch-ins, speaker framing |
| Branding | Professional polish | Consistent overlays and style |

---

## Video Category Detection

Current categories and their priority focus:

| Category | Detection Signals | Editing Priority |
|----------|-------------------|------------------|
| `gaming` | Gameplay footage, reaction cams, high-energy audio | Reaction focus, aggressive jump-cutting, highlight synthesis |
| `educational` | Long-form explanations, concept-heavy speech | Visual reinforcement, chapter detection, steady pacing |
| `cooking` | Food preparation, step-by-step process | Process sequencing, aesthetic enhancement, time compression |
| `comedy` | Joke structure, punchlines, timing-critical | Punchline isolation, setup/payoff structure, visual gags |
| `music_video` | Beat patterns, no speech, performance visuals | Proportional Narrative Sampling |
| `talking_head` | Single speaker, static shots, high speech ratio | Filler removal, punch-ins |
| `podcast` | Multiple speakers, interview setup | J/L cuts, dynamic zoom |
| `tutorial` | Demonstrations, explanatory speech | Clear pacing, key moments |
| `trailer` | Action sequences, dramatic content | Tension building, climax focus |
| `vlog` | Mixed content, personal moments | Variety, authentic pacing |
| `generic` | Unclassified | Engagement-based selection |

---

## Clip Selection Algorithms

### 1. Proportional Narrative Sampling (Music/Songs)
- Preserves chronological structure (intro → verse → chorus → outro)
- Allocates time proportionally to each section
- Picks highest-engagement clips within each section
- Never scrambles narrative order

### 2. Engagement-Based Selection (Generic)
- Sorts by engagement score
- Hook-first enforcement for opener
- Energy curve matching for pacing

### 3. Filler-Removed Selection (Podcast/Talking Head)
- Transcript-based filler detection
- Removes dead air, filler words
- Maintains natural speech flow

---

## Quality Scoring Dimensions

1. **Technical Quality** - Resolution, stability, audio clarity
2. **Engagement Potential** - Hook strength, emotional peaks
3. **Pacing Score** - Cut rhythm, energy flow
4. **Narrative Coherence** - Story arc preservation
5. **Platform Optimization** - Aspect ratio, duration fit
