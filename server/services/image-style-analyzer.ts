import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ImageStyleAnalysis {
  colorPalette: {
    primary: string;      // Hex color
    secondary: string;    // Hex color
    accent: string;       // Hex color
    background: string;   // Hex color
    text: string;        // Hex color
  };
  fontStyle: {
    family: string;      // e.g., "bold sans-serif", "elegant serif"
    weight: string;      // "light", "regular", "bold", "black"
    alignment: string;   // "left", "center", "right"
    casing: string;      // "uppercase", "lowercase", "title"
  };
  composition: {
    layout: string;      // "centered", "asymmetric", "grid", "minimal"
    textPosition: string; // "top", "center", "bottom", "overlay"
    imageStyle: string;  // "photographic", "illustrated", "abstract", "gradient"
  };
  vibe: string;          // Overall aesthetic: "corporate", "playful", "elegant", "bold", "minimal"
  reasoning: string;     // AI explanation of the style
}

export class ImageStyleAnalyzer {
  /**
   * Analyze a reference image URL to extract style parameters
   */
  static async analyzeImageStyle(imageUrl: string): Promise<ImageStyleAnalysis> {
    console.log(`[ImageStyleAnalyzer] Analyzing image style from: ${imageUrl}`);

    try {
      // Download and convert image to base64
      const imageBuffer = await this.downloadImage(imageUrl);
      const base64Image = imageBuffer.toString('base64');

      // Use GPT-4 Vision to analyze the image
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this viral image/graphic and extract its style DNA for replication. Focus on:

1. COLOR PALETTE: Identify the 5 main colors (primary, secondary, accent, background, text) as HEX codes
2. FONT STYLE: Describe font family, weight, alignment, and casing
3. COMPOSITION: Layout style, text positioning, image treatment
4. OVERALL VIBE: The aesthetic category (corporate, playful, elegant, bold, minimal, etc.)

Return ONLY a JSON object with this exact structure:
{
  "colorPalette": {
    "primary": "#HEXCODE",
    "secondary": "#HEXCODE",
    "accent": "#HEXCODE",
    "background": "#HEXCODE",
    "text": "#HEXCODE"
  },
  "fontStyle": {
    "family": "bold sans-serif",
    "weight": "bold",
    "alignment": "center",
    "casing": "uppercase"
  },
  "composition": {
    "layout": "centered",
    "textPosition": "overlay",
    "imageStyle": "photographic"
  },
  "vibe": "bold",
  "reasoning": "Brief explanation of the dominant style characteristics"
}`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content || '{}';
      const jsonContent = content.replace(/```json\n?|\n?```/g, '').trim();
      const analysis: ImageStyleAnalysis = JSON.parse(jsonContent);

      console.log(`[ImageStyleAnalyzer] ✓ Style analyzed: ${analysis.vibe} with ${analysis.colorPalette.primary} primary color`);
      
      return analysis;
    } catch (error) {
      console.error('[ImageStyleAnalyzer] Analysis failed:', error);
      // Return fallback style
      return this.getFallbackStyle();
    }
  }

  /**
   * Download image from URL
   */
  private static async downloadImage(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Apply analyzed style to AI image generation prompt
   */
  static applyStyleToPrompt(basePrompt: string, style: ImageStyleAnalysis): string {
    const styleEnhancements = [
      `color palette with ${style.colorPalette.primary} primary and ${style.colorPalette.accent} accents`,
      `${style.composition.imageStyle} style`,
      `${style.composition.layout} layout composition`,
      `${style.vibe} aesthetic`,
    ];

    return `${basePrompt}, ${styleEnhancements.join(', ')}`;
  }

  /**
   * Generate CSS styles from analyzed image
   */
  static generateCSSFromStyle(style: ImageStyleAnalysis): {
    backgroundColor: string;
    color: string;
    fontFamily: string;
    fontWeight: string;
    textAlign: string;
    textTransform: string;
  } {
    return {
      backgroundColor: style.colorPalette.background,
      color: style.colorPalette.text,
      fontFamily: style.fontStyle.family.includes('serif') ? 'serif' : 'sans-serif',
      fontWeight: style.fontStyle.weight,
      textAlign: style.fontStyle.alignment as any,
      textTransform: style.fontStyle.casing as any,
    };
  }

  /**
   * Fallback style if analysis fails
   */
  private static getFallbackStyle(): ImageStyleAnalysis {
    return {
      colorPalette: {
        primary: '#000000',
        secondary: '#FFFFFF',
        accent: '#FF6B6B',
        background: '#F5F5F5',
        text: '#333333',
      },
      fontStyle: {
        family: 'sans-serif',
        weight: 'bold',
        alignment: 'center',
        casing: 'uppercase',
      },
      composition: {
        layout: 'centered',
        textPosition: 'center',
        imageStyle: 'photographic',
      },
      vibe: 'minimal',
      reasoning: 'Fallback minimal style',
    };
  }
}
