
import OpenAI from "openai";

// Use AI_INTEGRATIONS_OPENAI_API_KEY (Replit integration) or fallback to OPENAI_API_KEY
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined,
});

/**
 * Prompt Refinement Service
 * Refines video generation prompts based on user feedback
 */
export class PromptRefiner {
  /**
   * Refine a prompt based on natural language feedback
   * @param originalPrompt - Original video generation prompt
   * @param feedback - User's natural language feedback
   * @returns Refined prompt
   */
  static async refinePromptWithFeedback(
    originalPrompt: string,
    feedback: string,
    options: { throwOnError?: boolean } = {}
  ): Promise<string> {
    console.log(`[PromptRefiner] Refining prompt with feedback: "${feedback}"`);

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert at refining video editing prompts based on user feedback.
Given an original prompt and feedback, create an improved version that addresses the feedback while maintaining the core intent.

Return ONLY the refined prompt text, no explanations or markdown.`
          },
          {
            role: "user",
            content: `Original prompt: "${originalPrompt}"\n\nUser feedback: "${feedback}"\n\nProvide the refined prompt:`
          }
        ],
        temperature: 0.7,
        max_tokens: 300,
      });

      const refinedPrompt = response.choices[0]?.message?.content?.trim() || originalPrompt;
      console.log(`[PromptRefiner] Refined prompt: "${refinedPrompt}"`);

      return refinedPrompt;
    } catch (error: any) {
      console.error(`[PromptRefiner] Error:`, error.message);
      
      // V3.0: Throw explicit errors when requested for better error propagation
      if (options.throwOnError) {
        throw new Error(`Failed to refine prompt: ${error.message}`);
      }
      
      // Graceful fallback: Return original prompt on error
      console.warn(`[PromptRefiner] Returning original prompt due to error`);
      return originalPrompt;
    }
  }

  /**
   * Refine multiple prompts in batch
   */
  static async batchRefine(
    prompts: Array<{ id: string; prompt: string; feedback: string }>
  ): Promise<Array<{ id: string; refinedPrompt: string }>> {
    const results = await Promise.all(
      prompts.map(async ({ id, prompt, feedback }) => ({
        id,
        refinedPrompt: await this.refinePromptWithFeedback(prompt, feedback)
      }))
    );

    return results;
  }
}
