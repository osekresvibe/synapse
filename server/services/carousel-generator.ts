
import ffmpeg from "fluent-ffmpeg";
import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";

const SLIDES_DIR = path.join(process.cwd(), "uploads", "carousel-slides");
const VIDEOS_DIR = path.join(process.cwd(), "uploads", "videos");

// Ensure directories exist
if (!fs.existsSync(SLIDES_DIR)) {
  fs.mkdirSync(SLIDES_DIR, { recursive: true });
}

export interface CarouselSlide {
  id: string;
  imagePath: string;
  timestamp: number;
  caption?: string;
  keyPoint?: string;
}

export interface CarouselConfig {
  slideCount: number;
  style: "visual" | "text-image" | "video-clips";
  aspectRatio: "1:1" | "4:5" | "9:16";
  width?: number;
  height?: number;
}

export class CarouselGenerator {
  /**
   * Extract frames from video at key moments to create carousel slides
   */
  static async generateSlides(
    videoPath: string,
    timestamps: number[],
    config: CarouselConfig
  ): Promise<CarouselSlide[]> {
    console.log(`[CarouselGenerator] Generating ${timestamps.length} slides`);
    
    const slides: CarouselSlide[] = [];
    
    for (const timestamp of timestamps) {
      const slideId = nanoid();
      const slidePath = path.join(SLIDES_DIR, `${slideId}.jpg`);
      
      await this.extractFrame(videoPath, timestamp, slidePath, config.aspectRatio);
      
      slides.push({
        id: slideId,
        imagePath: `/uploads/carousel-slides/${slideId}.jpg`,
        timestamp,
      });
    }
    
    return slides;
  }
  
  /**
   * Extract a single frame from video at specific timestamp
   */
  static async extractFrame(
    videoPath: string,
    timestamp: number,
    outputPath: string,
    aspectRatio: "1:1" | "4:5" | "9:16"
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Determine crop/scale filter based on aspect ratio
      const filters: Record<string, string> = {
        "1:1": "crop=min(iw\\,ih):min(iw\\,ih),scale=1080:1080",
        "4:5": "crop=ih*4/5:ih,scale=1080:1350",
        "9:16": "crop=ih*9/16:ih,scale=1080:1920",
      };
      
      ffmpeg(videoPath)
        .seekInput(timestamp)
        .frames(1)
        .videoFilters(filters[aspectRatio])
        .output(outputPath)
        .on("end", () => resolve())
        .on("error", reject)
        .run();
    });
  }
  
  /**
   * Extract audio from video for voiceover
   */
  static async extractAudio(
    videoPath: string,
    startTime: number,
    endTime: number
  ): Promise<string> {
    const audioId = nanoid();
    const audioPath = path.join(VIDEOS_DIR, `audio-${audioId}.mp3`);
    
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .setStartTime(startTime)
        .setDuration(endTime - startTime)
        .output(audioPath)
        .noVideo()
        .audioCodec("libmp3lame")
        .audioBitrate("192k")
        .on("end", () => resolve(audioPath))
        .on("error", reject)
        .run();
    });
  }
  
  /**
   * Add text overlay to an image slide
   */
  static async addTextOverlay(
    imagePath: string,
    text: string,
    style: "headline" | "caption" | "keypoint"
  ): Promise<string> {
    const outputId = nanoid();
    const outputPath = path.join(SLIDES_DIR, `text-${outputId}.jpg`);
    
    // Font sizes and positions based on style
    const styles = {
      headline: { fontSize: 72, y: 150, fontWeight: "bold" },
      caption: { fontSize: 48, y: 1750, fontWeight: "normal" },
      keypoint: { fontSize: 56, y: 900, fontWeight: "bold" },
    };
    
    const config = styles[style];
    
    return new Promise((resolve, reject) => {
      ffmpeg(imagePath)
        .videoFilters([
          `drawtext=text='${text.replace(/'/g, "\\'")}':fontsize=${config.fontSize}:fontcolor=white:x=(w-text_w)/2:y=${config.y}:shadowcolor=black:shadowx=2:shadowy=2`,
        ])
        .output(outputPath)
        .on("end", () => resolve(outputPath))
        .on("error", reject)
        .run();
    });
  }
  
  /**
   * Create a video carousel from slides (for Instagram/TikTok)
   */
  static async createVideoCarousel(
    slides: CarouselSlide[],
    audioPath: string | null = null,
    slideDuration: number = 2.5,
    aspectRatio: "1:1" | "4:5" | "9:16" = "9:16"
  ): Promise<string> {
    console.log(`[CarouselGenerator] Creating video carousel from ${slides.length} slides`);
    
    const outputId = nanoid();
    const outputPath = path.join(VIDEOS_DIR, `carousel-${outputId}.mp4`);
    
    // Define dimensions based on aspect ratio
    const dimensions: Record<string, string> = {
      "1:1": "1080:1080",
      "4:5": "1080:1350",
      "9:16": "1080:1920",
    };
    
    const targetDimensions = dimensions[aspectRatio];
    
    // Create a concat file for ffmpeg
    const concatFile = path.join(VIDEOS_DIR, `concat-${outputId}.txt`);
    const concatContent = slides
      .map((slide) => {
        const fullPath = path.join(process.cwd(), slide.imagePath.slice(1));
        return `file '${fullPath}'\nduration ${slideDuration}`;
      })
      .join("\n");
    
    fs.writeFileSync(concatFile, concatContent);
    
    return new Promise((resolve, reject) => {
      const command = ffmpeg()
        .input(concatFile)
        .inputOptions(["-f concat", "-safe 0"]);
      
      // Add audio if provided
      if (audioPath) {
        command
          .input(audioPath)
          .outputOptions([
            "-c:v libx264",
            "-pix_fmt yuv420p",
            "-shortest",
            "-c:a aac",
            `-s ${targetDimensions}`,
          ]);
      } else {
        // No audio - just encode video
        command.outputOptions([
          "-c:v libx264",
          "-pix_fmt yuv420p",
          "-preset veryfast",
          "-crf 20",
          `-s ${targetDimensions}`,
        ]);
      }
      
      command
        .output(outputPath)
        .on("end", () => {
          fs.unlinkSync(concatFile);
          console.log(`[CarouselGenerator] ✓ Video created: ${outputPath}`);
          resolve(outputPath);
        })
        .on("error", (err) => {
          console.error(`[CarouselGenerator] ✗ Failed to create video:`, err);
          try {
            fs.unlinkSync(concatFile);
          } catch {}
          reject(err);
        })
        .run();
    });
  }
}
