import { ImageStyleAnalysis, ImageStyleAnalyzer } from './image-style-analyzer';

export interface ImageGenerationRequest {
  prompt: string;
  aspectRatio?: '1:1' | '16:9' | '9:16';
  style?: 'photorealistic' | 'artistic' | 'cinematic' | 'illustration';
  referenceStyle?: ImageStyleAnalysis; // Apply analyzed style from reference image
}

export class AIImageGenerator {
  /**
   * Generate an image using Runway ML or fallback to placeholder
   */
  static async generateImage(request: ImageGenerationRequest): Promise<string> {
    const { prompt, aspectRatio = '16:9', style = 'cinematic', referenceStyle } = request;

    // Enhance prompt with reference style if provided
    let enhancedPrompt = prompt;
    if (referenceStyle) {
      enhancedPrompt = ImageStyleAnalyzer.applyStyleToPrompt(prompt, referenceStyle);
      console.log(`[AIImageGenerator] ✨ Style-enhanced prompt: "${enhancedPrompt}"`);
    }

    console.log(`[AIImageGenerator] Generating image: "${enhancedPrompt}" (${aspectRatio}, ${style})`);

    // Try Runway ML first if API key exists
    const runwayApiKey = process.env.RUNWAY_API_KEY;
    if (runwayApiKey) {
      try {
        console.log('[AIImageGenerator] Using Runway ML API...');
        return await this.generateWithRunway(enhancedPrompt, aspectRatio, style);
      } catch (error) {
        console.error('[AIImageGenerator] ❌ Runway generation failed:', error);
        console.log('[AIImageGenerator] Falling back to placeholder...');
      }
    } else {
      console.log('[AIImageGenerator] ⚠️ No RUNWAY_API_KEY - using placeholder images');
    }

    // Fallback to placeholder service
    return this.generatePlaceholder(enhancedPrompt, aspectRatio);
  }

  /**
   * Generate image using Runway ML API
   */
  private static async generateWithRunway(
    prompt: string,
    aspectRatio: string,
    style: string
  ): Promise<string> {
    const response = await fetch('https://api.runwayml.com/v1/images/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RUNWAY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: `${prompt}, ${style} style, high quality`,
        aspect_ratio: aspectRatio,
        model: 'runway-gen3',
      }),
    });

    if (!response.ok) {
      throw new Error(`Runway API error: ${response.statusText}`);
    }

    const data = await response.json() as { url: string };
    return data.url;
  }

  /**
   * Generate placeholder image
   */
  private static generatePlaceholder(prompt: string, aspectRatio: string): string {
    const dimensions = aspectRatio === '16:9' ? '1920x1080' : 
                      aspectRatio === '9:16' ? '1080x1920' : 
                      '1080x1080';
    
    const encodedPrompt = encodeURIComponent(prompt.substring(0, 50));
    return `https://placehold.co/${dimensions}/1a1a1a/white?text=${encodedPrompt}`;
  }

  /**
   * Batch generate multiple images
   */
  static async generateBatch(requests: ImageGenerationRequest[]): Promise<string[]> {
    const results = await Promise.all(
      requests.map(req => this.generateImage(req))
    );
    return results;
  }
}
