import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

// Configure FFmpeg binary path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
console.log(`[SlideGenerator] FFmpeg binary path: ${ffmpegInstaller.path}`);

/**
 * SLIDE IMAGE GENERATOR
 * Creates professional carousel slide images from text content
 * Uses FFmpeg drawtext filter for high-quality text rendering
 */

export interface SlideConfig {
  textContent: string;
  backgroundColor?: string; // Hex color (default: #1a1a2e - dark)
  textColor?: string; // Hex color (default: #ffffff - white)
  fontSize?: number; // Default: 60
  fontFamily?: string; // Default: Arial
  width?: number; // Default: 1080px (Instagram square)
  height?: number; // Default: 1080px
}

export class SlideGenerator {
  /**
   * Generate a single slide image using FFmpeg
   * @param config - Slide configuration
   * @returns Path to generated PNG image
   */
  static async generateSlide(config: SlideConfig): Promise<string> {
    const {
      textContent,
      backgroundColor = "#1a1a2e",
      textColor = "#ffffff",
      fontSize = 60,
      fontFamily = "Arial",
      width = 1080,
      height = 1920, // Changed to 9:16 aspect ratio for Reels/TikTok
    } = config;

    const slideId = nanoid();
    const SLIDES_DIR = path.join(process.cwd(), "uploads", "slides");
    
    if (!fs.existsSync(SLIDES_DIR)) {
      fs.mkdirSync(SLIDES_DIR, { recursive: true });
    }

    const slidePath = path.join(SLIDES_DIR, `slide-${slideId}.png`);

    console.log(`[SlideGenerator] Generating slide: "${textContent.slice(0, 30)}..."`);

    // Escape special characters for FFmpeg drawtext
    // FFmpeg drawtext has very specific escaping requirements
    const escapedText = textContent
      .replace(/\\/g, "\\\\\\\\")  // Backslash needs 4 backslashes
      .replace(/'/g, "'\\\\\\''")   // Single quote
      .replace(/:/g, "\\:")          // Colon
      .replace(/,/g, "\\,")          // Comma (important - causes filter parsing errors)
      .replace(/\[/g, "\\[")         // Left bracket
      .replace(/\]/g, "\\]")         // Right bracket
      .replace(/\n/g, " ")           // Replace newlines with spaces instead of \n
      .replace(/\r/g, "");           // Remove carriage returns

    return new Promise((resolve, reject) => {
      try {
        // Calculate safe text area (80% of width to prevent overflow)
        const maxTextWidth = Math.floor(width * 0.8);
        
        ffmpeg()
          .input(`color=c=${backgroundColor}:s=${width}x${height}:d=1`)
          .inputOptions(['-f', 'lavfi'])
          .videoFilter([
            `drawtext=text='${escapedText}':fontcolor=${textColor}:fontsize=${fontSize}:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:x=(w-text_w)/2:y=(h-text_h)/2:line_spacing=20`
          ])
          .outputOptions(['-frames:v', '1'])
          .output(slidePath)
          .on("start", (cmd) => {
            console.log(`[SlideGenerator] FFmpeg command: ${cmd}`);
          })
          .on("end", () => {
            console.log(`[SlideGenerator] ✓ Slide generated: ${slidePath}`);
            resolve(slidePath);
          })
          .on("error", (err, stdout, stderr) => {
            console.error(`[SlideGenerator] !!!!! SLIDE GENERATION FAILED !!!!!`);
            console.error(`[SlideGenerator] Error:`, err.message);
            console.error(`[SlideGenerator] FFmpeg stdout:`, stdout);
            console.error(`[SlideGenerator] FFmpeg stderr:`, stderr);
            reject(err);
          })
          .run();
      } catch (syncError) {
        console.error(`[SlideGenerator] !!!!! SYNCHRONOUS FFMPEG ERROR !!!!!`);
        console.error(`[SlideGenerator] Error:`, syncError);
        reject(syncError);
      }
    });
  }

  /**
   * Generate multiple slides in parallel
   * @param slides - Array of slide configurations
   * @returns Array of image paths
   */
  static async generateMultipleSlides(
    slides: SlideConfig[]
  ): Promise<string[]> {
    console.log(`[SlideGenerator] Generating ${slides.length} slides...`);

    const slidePromises = slides.map((config, index) =>
      this.generateSlide(config).catch((err) => {
        console.warn(`[SlideGenerator] Slide ${index + 1} failed:`, err);
        return null;
      })
    );

    const results = await Promise.all(slidePromises);
    const successfulPaths = results.filter((path): path is string => path !== null);

    console.log(`[SlideGenerator] ✓ Generated ${successfulPaths.length}/${slides.length} slides`);
    return successfulPaths;
  }

  /**
   * Convert hex color to RGB format for FFmpeg
   */
  private static hexToRgb(hex: string): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return "rgb(26,26,46)"; // Default dark color

    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    
    return `rgb(${r},${g},${b})`;
  }

  /**
   * Convert absolute file path to public URL path
   */
  static getPublicPath(absolutePath: string): string {
    const uploadsIndex = absolutePath.indexOf("/uploads/");
    if (uploadsIndex === -1) return absolutePath;
    return absolutePath.substring(uploadsIndex);
  }
}
