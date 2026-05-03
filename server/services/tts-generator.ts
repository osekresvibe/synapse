import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

// Use OpenAI API key for TTS
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * TEXT-TO-SPEECH GENERATOR
 * Generates professional voiceovers using OpenAI TTS
 */

export type VoiceOption = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

export class TTSGenerator {
  /**
   * Generate voiceover audio from text using OpenAI TTS
   * @param text - Text to convert to speech
   * @param voice - Voice option (default: "nova" - warm, friendly female)
   * @returns Path to generated MP3 file
   */
  static async generateVoiceover(
    text: string,
    voice: VoiceOption = "nova"
  ): Promise<string> {
    const audioId = nanoid();
    const AUDIO_DIR = path.join(process.cwd(), "uploads", "audio");
    
    if (!fs.existsSync(AUDIO_DIR)) {
      fs.mkdirSync(AUDIO_DIR, { recursive: true });
    }

    const audioPath = path.join(AUDIO_DIR, `voiceover-${audioId}.mp3`);

    console.log(`[TTSGenerator] Generating voiceover: ${text.slice(0, 50)}...`);

    try {
      const mp3 = await openai.audio.speech.create({
        model: "tts-1", // Fast, cost-effective
        voice: voice,
        input: text,
        speed: 1.0, // Normal speed
      });

      const buffer = Buffer.from(await mp3.arrayBuffer());
      fs.writeFileSync(audioPath, buffer);

      console.log(`[TTSGenerator] ✓ Voiceover generated: ${audioPath}`);
      return audioPath;
    } catch (error) {
      console.error(`[TTSGenerator] Failed to generate voiceover:`, error);
      throw error;
    }
  }

  /**
   * Generate voiceovers for multiple scenes in parallel
   * @param scenes - Array of {text, voice} objects
   * @returns Array of audio file paths
   */
  static async generateMultipleVoiceovers(
    scenes: Array<{ text: string; voice?: VoiceOption }>
  ): Promise<string[]> {
    console.log(`[TTSGenerator] Generating ${scenes.length} voiceovers in parallel...`);

    const voiceoverPromises = scenes.map((scene, index) =>
      this.generateVoiceover(scene.text, scene.voice || "nova").catch((err) => {
        console.warn(`[TTSGenerator] Scene ${index + 1} voiceover failed:`, err);
        return null; // Return null for failed generations
      })
    );

    const results = await Promise.all(voiceoverPromises);
    const successfulPaths = results.filter((path): path is string => path !== null);

    console.log(`[TTSGenerator] ✓ Generated ${successfulPaths.length}/${scenes.length} voiceovers`);
    return successfulPaths;
  }

  /**
   * Combine multiple audio files into a single MP3
   * Uses FFmpeg to concatenate audio files
   * @param audioPaths - Array of audio file paths
   * @param outputName - Output filename (optional)
   * @returns Path to combined audio file
   */
  static async combineAudioFiles(
    audioPaths: string[],
    outputName?: string
  ): Promise<string> {
    const ffmpeg = (await import("fluent-ffmpeg")).default;
    const audioId = outputName || `combined-${nanoid()}`;
    const AUDIO_DIR = path.join(process.cwd(), "uploads", "audio");
    const outputPath = path.join(AUDIO_DIR, `${audioId}.mp3`);

    console.log(`[TTSGenerator] Combining ${audioPaths.length} audio files...`);

    if (audioPaths.length === 0) {
      throw new Error("No audio files provided for combining");
    }

    if (audioPaths.length === 1) {
      // Just copy the single file
      return audioPaths[0];
    }

    return new Promise((resolve, reject) => {
      const command = ffmpeg();

      // Add all input files
      audioPaths.forEach(audioPath => {
        command.input(audioPath);
      });

      // Use concat filter for audio merging
      const filterStr = audioPaths.map((_, i) => `[${i}:a]`).join('') + `concat=n=${audioPaths.length}:v=0:a=1[out]`;

      command
        .complexFilter(filterStr)
        .outputOptions(['-map', '[out]'])
        .output(outputPath)
        .on("end", () => {
          console.log(`[TTSGenerator] ✓ Combined audio: ${outputPath}`);
          resolve(outputPath);
        })
        .on("error", (err) => {
          console.error(`[TTSGenerator] Failed to combine audio:`, err);
          reject(err);
        })
        .run();
    });
  }
}
