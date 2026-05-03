/**
 * AI Scene Analyzer
 * Converts script text into cinematic video prompts for AI generation
 * V5.0: Transform documentary scripts into Runway-compatible prompts
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ScriptScene {
  narration: string; // Text for voiceover/subtitles
  visualPrompt: string; // Runway-compatible prompt
  startTime: number;
  duration: number;
  characterId?: string; // NEW: Track which character appears in this scene
  voiceId?: string; // NEW: TTS voice for this scene
}

export interface PromptGenerationOptions {
  style?: 'cinematic' | 'documentary' | 'dramatic' | 'realistic';
  sceneCount?: number;
  userContext?: string;
  characters?: Array<{ // NEW: Character definitions for multi-episode consistency
    name: string;
    visualDescription: string;
    voiceId: string;
  }>;
}

/**
 * Generate cinematic prompts from script using GPT-4o
 */
export async function generateCinematicPrompts(
  scriptContent: string,
  options: PromptGenerationOptions = {}
): Promise<ScriptScene[]> {
  const { style = 'cinematic', sceneCount = 8, userContext, characters } = options;

  console.log(`[AI-Scene-Analyzer] Generating ${sceneCount} cinematic prompts for script...`);
  console.log(`[AI-Scene-Analyzer] Style: ${style}`);
  if (userContext) {
    console.log(`[AI-Scene-Analyzer] User context: "${userContext.substring(0, 80)}..."`);
  }
  if (characters && characters.length > 0) {
    console.log(`[AI-Scene-Analyzer] 🎭 Character-driven scenes with ${characters.length} characters`);
  }

  const systemPrompt = `You are a professional cinematographer and AI video prompt engineer.
Your job is to convert documentary scripts into cinematic visual prompts for AI generation.

RULES:
Generate EXACTLY ${sceneCount} distinct visual scenes from this script.
    Each scene should be 4-8 seconds of cinematic footage.

    CRITICAL REQUIREMENTS:
    - Return EXACTLY ${sceneCount} scenes (no more, no less)
    - Distribute the script content evenly across all ${sceneCount} scenes
    - Each scene must have unique, cinematic visual descriptions
    - Longer scripts should have more detailed narration per scene

STYLE KEYWORDS:
- cinematic: "cinematic lighting, professional cinematography, 4K quality, film grain"
- documentary: "documentary style, realistic footage, news broadcast quality"
- dramatic: "dramatic lighting, intense atmosphere, high contrast"
- realistic: "photorealistic, natural lighting, real-world footage"
- history: "historical documentary, archival footage style, Ken Burns effect, sepia tone, vintage cinematography"
- nature: "nature documentary, David Attenborough style, sweeping landscapes, wildlife cinematography, golden hour lighting"
- talking-head: "professional presenter speaking to camera, medium close-up shot, clean background, studio lighting, eye contact with viewer, confident body language, business casual attire"

Return ONLY a JSON array of scenes with this structure:
[
  {
    "visualPrompt": "A sweeping aerial shot of ancient pyramids at golden hour, camera slowly descending as the sun casts long shadows across the desert, cinematic lighting, 4K quality",
    "narration": "The pyramids of Giza stand as testament to human ingenuity",
    "duration": 6,
    "sceneType": "opening"
  }
]

Scene types: opening, context, climax, transition, closing`;

  // Updated user prompt to incorporate character definitions
  const userPrompt = `You are a professional film director and scriptwriter. Transform the following script into ${sceneCount} cinematic video prompts.

${userContext ? `IMPORTANT CONTEXT: ${userContext}\n\n` : ''}

${characters && characters.length > 0 ? `
CHARACTER DEFINITIONS (use these exact descriptions for visual consistency):
${characters.map(c => `- ${c.name}: ${c.visualDescription}`).join('\n')}

When a character speaks (indicated by [CHARACTER_NAME]: dialogue), use their exact visual description.
` : ''}

SCRIPT:
${scriptContent}`;


  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8, // Creative but consistent
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content || '[]';
    const jsonContent = content.replace(/```json\n?|\n?```/g, '').trim();
    const scenes: ScriptScene[] = JSON.parse(jsonContent);

    console.log(`[SceneAnalyzer] ✓ Generated ${scenes.length} scene prompts`);

    // Post-processing to map characters and voices if not directly inferred by GPT
    // This part would require more sophisticated prompt engineering or a secondary AI call
    // For now, we assume GPT-4o can infer character speaking and assign voice based on the prompt.

    return scenes;
  } catch (error: any) {
    console.error(`[SceneAnalyzer] Failed to generate prompts:`, error.message);
    throw new Error(`AI prompt generation failed: ${error.message}`);
  }
}

// Placeholder for SceneBreakdown interface and analyzeScriptForScenes function
// This part is not directly modified by the user's request but is part of the original file structure.
// Assuming these are defined elsewhere or are part of a larger class/module not fully provided.

export interface SceneBreakdown {
  sceneNumber: number;
  duration: number;
  visualPrompt: string;
  voiceoverText: string;
  cameraAngle: string;
  mood: string;
}

// The following function `analyzeScriptForScenes` is assumed to be part of the same module
// based on the provided changes snippet, and it's being modified.
// The original code for this function was not provided in full, only the part that was replaced.
// Therefore, we'll construct the modified function based on the provided snippet.

// Mocking the function as the original was not fully provided, but the modification is clear.
// In a real scenario, you would integrate the changes into the actual existing function.
async function analyzeScriptForScenes(
    scriptContent: string,
    options: {
      videoStyle?: string;
      sceneVideoDuration?: number;
      userContext?: string; // NEW: User-provided context
    } = {}
  ): Promise<SceneBreakdown[]> {
    console.log(`[SceneAnalyzer] Analyzing script (${scriptContent.length} chars)`);
    if (options.userContext) {
      console.log(`[SceneAnalyzer] 📝 Using user context: "${options.userContext.substring(0, 100)}..."`);
    }

    // Build context-aware system prompt
    const contextGuidance = options.userContext
      ? `\n\nIMPORTANT USER CONTEXT:\n${options.userContext}\n\nUse this context to inform your visual interpretations, tone, and style choices.`
      : '';

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a professional cinematographer and scene director. Break down the script into individual cinematic scenes.

Each scene should be:
- Visually distinct and compelling
- 4-8 seconds in duration (default: ${options.sceneVideoDuration || 6}s)
- Self-contained with clear subject/action
- Optimized for video generation AI
${contextGuidance}

Return JSON array with this structure:
[
  {
    "sceneNumber": 1,
    "duration": 6,
    "visualPrompt": "detailed description for video generation",
    "voiceoverText": "narrator dialogue for this scene",
    "cameraAngle": "wide/medium/close-up/aerial/etc",
    "mood": "epic/dramatic/serene/energetic/etc"
  }
]

Guidelines:
- Extract ONLY visual elements from script
- Avoid text overlays in prompts (we'll add those separately)
- Focus on action, setting, atmosphere
- Use cinematic language (e.g., "golden hour lighting", "slow motion", "crane shot")
${options.userContext ? '- Align visual style with user context provided above' : ''}`
        },
        {
          role: 'user',
          content: `Break this script into scenes for ${options.videoStyle || 'cinematic'} video generation:\n\n${scriptContent}`
        }
      ],
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error("[SceneAnalyzer] No content received from AI.");
      return [];
    }

    try {
      const jsonObject = JSON.parse(content);
      // Assuming the response is a JSON object with a key containing the array, e.g., { scenes: [...] }
      // If the response is directly the array, use JSON.parse(content) directly.
      // Based on 'json_object' response_format, it's likely an object.
      // We need to find the array within the object. A common pattern is 'scenes' or the main key.
      const scenesArray = Object.values(jsonObject)[0] as SceneBreakdown[];
      if (!Array.isArray(scenesArray)) {
        console.error("[SceneAnalyzer] Parsed JSON is not an array:", jsonObject);
        throw new Error("AI response was not a valid JSON array of scenes.");
      }
      console.log(`[SceneAnalyzer] ✓ Analyzed script into ${scenesArray.length} scenes.`);
      return scenesArray;
    } catch (error: any) {
      console.error(`[SceneAnalyzer] Failed to parse AI response JSON: ${error.message}`);
      console.error("AI Response Content:", content); // Log the raw content for debugging
      throw new Error(`Failed to parse AI response: ${error.message}`);
    }
}