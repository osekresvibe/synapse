
/**
 * Story Remix Service
 * Analyzes existing video content and generates new narratives
 * Innovation: Transforms raw footage into multiple story variations
 */

import OpenAI from 'openai';
import { SmartSlice } from '@shared/schema';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface RemixedStory {
  title: string;
  narrative: string;
  scenes: RemixedScene[];
  mood: string;
  targetAudience: string;
}

export interface RemixedScene {
  sliceId: string;
  order: number;
  newContext: string;
  voiceoverText: string;
  duration: number;
}

export interface RemixOptions {
  storyStyle: 'documentary' | 'dramatic' | 'educational' | 'promotional' | 'inspirational';
  targetDuration?: number;
  preserveOrder?: boolean;
}

/**
 * Analyze video slices and generate a completely new narrative
 */
export async function remixStory(
  slices: SmartSlice[],
  options: RemixOptions
): Promise<RemixedStory> {
  console.log(`[StoryRemix] Remixing ${slices.length} clips into ${options.storyStyle} narrative`);

  // Prepare clip descriptions for AI analysis
  const clipDescriptions = slices.map((slice, idx) => ({
    id: slice.id,
    index: idx,
    duration: slice.endTime - slice.startTime,
    transcript: slice.transcription || 'No audio',
    visualType: slice.clipType || 'unknown',
    engagementScore: slice.engagementScore || 50,
  }));

  const prompt = `You are a master storyteller and video editor. Analyze these video clips and create a COMPLETELY NEW narrative story using them.

Available Clips:
${JSON.stringify(clipDescriptions, null, 2)}

Story Style: ${options.storyStyle}
Target Duration: ${options.targetDuration || 'flexible'} seconds
${options.preserveOrder ? 'Keep clips in original order' : 'You can rearrange clips freely'}

Your task:
1. Invent a NEW narrative arc that makes sense with these visuals (ignore original audio)
2. Assign each clip a new role in your story
3. Write engaging voiceover text for each scene
4. Order the clips to maximize story impact
5. Give the story a compelling title

Return a JSON object with this structure:
{
  "title": "Compelling Story Title",
  "narrative": "2-3 sentence story summary",
  "mood": "overall mood (dramatic, uplifting, mysterious, etc.)",
  "targetAudience": "who this story appeals to",
  "scenes": [
    {
      "sliceId": "clip-id-from-list",
      "order": 0,
      "newContext": "What this clip NOW represents in your story",
      "voiceoverText": "Narration text for this scene (30-60 words)",
      "duration": 5
    }
  ]
}

BE CREATIVE. Transform mundane footage into compelling narratives.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a creative director who can transform any footage into compelling stories. You think outside the box and find unexpected narratives.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.9, // High creativity
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    console.log(`[StoryRemix] Generated story: "${result.title}"`);
    console.log(`[StoryRemix] Scenes: ${result.scenes?.length || 0}`);
    
    return result as RemixedStory;
  } catch (error: any) {
    console.error('[StoryRemix] Failed to generate story:', error.message);
    throw new Error(`Story remix failed: ${error.message}`);
  }
}

/**
 * Generate multiple story variations from the same footage
 */
export async function generateStoryVariations(
  slices: SmartSlice[],
  count: number = 3
): Promise<RemixedStory[]> {
  console.log(`[StoryRemix] Generating ${count} story variations`);
  
  const styles: RemixOptions['storyStyle'][] = [
    'documentary',
    'dramatic',
    'educational',
    'promotional',
    'inspirational',
  ];
  
  const selectedStyles = styles.slice(0, count);
  
  const variations = await Promise.all(
    selectedStyles.map(style =>
      remixStory(slices, { storyStyle: style })
    )
  );
  
  console.log(`[StoryRemix] Generated ${variations.length} variations`);
  return variations;
}
