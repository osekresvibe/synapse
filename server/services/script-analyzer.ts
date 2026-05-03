import OpenAI from "openai";
import type { InsertSmartSlice } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

/**
 * SCRIPT-TO-SCENES ANALYZER
 * Parses user script/prompt into structured scenes for video/carousel/audio generation
 */

export interface ScriptScene {
  order: number;
  textContent: string; // Text displayed on slide
  voiceoverText: string; // Spoken narration
  visualDescription: string; // Description for visual generation
  duration: number; // Scene duration in seconds
  sceneType: "intro" | "content" | "conclusion";
}

export class ScriptAnalyzer {
  /**
   * Parse script into structured scenes using GPT-4o
   * @param scriptContent - User's input script/prompt
   * @param targetSceneCount - Desired number of scenes (default: AI decides)
   * @returns Array of structured scenes
   */
  static async parseScriptToScenes(
    scriptContent: string,
    targetSceneCount?: number
  ): Promise<ScriptScene[]> {
    console.log(`[ScriptAnalyzer] Parsing script into scenes`);
    console.log(`[ScriptAnalyzer] Script length: ${scriptContent.length} characters`);

    const sceneCountGuidance = targetSceneCount
      ? `Generate EXACTLY ${targetSceneCount} scenes.`
      : `Generate 3-8 scenes based on the content length and complexity.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert content structurer for video/carousel creation. Parse user scripts into engaging, bite-sized scenes.

Each scene should:
- Have clear, concise text (20-40 words for display)
- Include natural voiceover narration (conversational tone)
- Describe compelling visuals (abstract, minimalist style)
- Be 3-5 seconds duration (adjust based on text length)

Scene types:
- intro: Hook/attention grabber
- content: Main information/value
- conclusion: Call-to-action/summary

Return ONLY valid JSON matching this exact structure (no markdown, no code blocks):
{
  "scenes": [
    {
      "order": 1,
      "textContent": "Displayed text",
      "voiceoverText": "Spoken narration",
      "visualDescription": "Abstract visual description",
      "duration": 4,
      "sceneType": "intro"
    }
  ]
}`
          },
          {
            role: "user",
            content: `Parse this script into scenes:\n\n${scriptContent}\n\n${sceneCountGuidance}`
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content || "{}";
      
      // Strip markdown code blocks if present
      const jsonContent = content.replace(/```json\n?|\n?```/g, '').trim();
      
      const parsed = JSON.parse(jsonContent);
      const scenes: ScriptScene[] = parsed.scenes || [];

      if (scenes.length === 0) {
        throw new Error("GPT-4o returned empty scenes array");
      }

      console.log(`[ScriptAnalyzer] ✓ Parsed ${scenes.length} scenes successfully`);
      return scenes;
    } catch (error) {
      console.error(`[ScriptAnalyzer] Failed to parse script:`, error);
      
      // Fallback: Create a single scene from the entire script
      console.log(`[ScriptAnalyzer] Using fallback: single scene`);
      return [{
        order: 1,
        textContent: scriptContent.slice(0, 200),
        voiceoverText: scriptContent,
        visualDescription: "Abstract geometric shapes with gradient background",
        duration: Math.min(Math.ceil(scriptContent.length / 15), 10),
        sceneType: "content"
      }];
    }
  }

  /**
   * Convert parsed scenes to SmartSlice format for database storage
   */
  static scenesToSmartSlices(
    projectId: string,
    scenes: ScriptScene[]
  ): InsertSmartSlice[] {
    return scenes.map((scene) => ({
      projectId,
      order: scene.order,
      startTime: 0, // Not applicable for script-based projects
      endTime: scene.duration,
      textContent: scene.textContent,
      transcription: scene.voiceoverText, // Reuse transcription field for voiceover
      thumbnailPath: null, // Will be generated later
      clipType: scene.sceneType,
      engagementScore: null,
    }));
  }
}
