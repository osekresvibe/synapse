
import ffmpeg from "fluent-ffmpeg";
import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";

const PREVIEW_DIR = path.join(process.cwd(), "uploads", "previews");

if (!fs.existsSync(PREVIEW_DIR)) {
  fs.mkdirSync(PREVIEW_DIR, { recursive: true });
}

export class PreviewGenerator {
  /**
   * Generate lightweight proxy video for fast scrubbing (sub-5s generation)
   * Uses aggressive compression: 480p, 15fps, low bitrate
   */
  static async generateFastProxy(videoPath: string): Promise<string> {
    const proxyId = nanoid();
    const proxyPath = path.join(PREVIEW_DIR, `proxy-${proxyId}.mp4`);

    console.log(`[PreviewGenerator] Creating fast proxy for ${path.basename(videoPath)}`);
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions([
          '-vf', 'scale=480:-2', // 480p width, maintain aspect ratio
          '-r', '15', // 15fps for speed
          '-c:v', 'libx264',
          '-preset', 'ultrafast', // Fastest encoding
          '-crf', '28', // Lower quality for smaller file
          '-c:a', 'aac',
          '-b:a', '64k', // Low audio bitrate
          '-movflags', '+faststart'
        ])
        .output(proxyPath)
        .on('end', () => {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          const size = (fs.statSync(proxyPath).size / 1024).toFixed(0);
          console.log(`[PreviewGenerator] ✓ Proxy created in ${elapsed}s (${size}KB)`);
          resolve(`/uploads/previews/proxy-${proxyId}.mp4`);
        })
        .on('error', (err) => {
          console.error(`[PreviewGenerator] ✗ Error:`, err.message);
          reject(err);
        })
        .run();
    });
  }

  /**
   * Generate sprite sheet for thumbnail scrubbing (10x10 grid)
   */
  static async generateSpriteSheet(videoPath: string, duration: number): Promise<{
    spriteUrl: string;
    columns: number;
    rows: number;
    thumbnailWidth: number;
    thumbnailHeight: number;
  }> {
    const spriteId = nanoid();
    const spritePath = path.join(PREVIEW_DIR, `sprite-${spriteId}.jpg`);

    console.log(`[PreviewGenerator] Creating sprite sheet for ${path.basename(videoPath)}`);

    // Extract 100 thumbnails (10x10 grid)
    const frameCount = 100;
    const interval = duration / frameCount;

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions([
          `-vf`, `fps=1/${interval},scale=160:90,tile=10x10`,
          '-frames:v', '1'
        ])
        .output(spritePath)
        .on('end', () => {
          console.log(`[PreviewGenerator] ✓ Sprite sheet created`);
          resolve({
            spriteUrl: `/uploads/previews/sprite-${spriteId}.jpg`,
            columns: 10,
            rows: 10,
            thumbnailWidth: 160,
            thumbnailHeight: 90
          });
        })
        .on('error', reject)
        .run();
    });
  }
}
