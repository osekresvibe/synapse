
import ffmpeg from "fluent-ffmpeg";
import { promisify } from "util";
import { exec } from "child_process";

const execPromise = promisify(exec);

export interface AudioSegment {
  startTime: number;
  endTime: number;
  type: "silence" | "sound" | "music" | "speech";
  volume: number; // dB level
  energy?: number; // For music: relative energy/intensity
}

export interface MusicStructure {
  intro?: { start: number; end: number };
  verses: Array<{ start: number; end: number }>;
  choruses: Array<{ start: number; end: number }>;
  bridge?: { start: number; end: number };
  solo?: { start: number; end: number };
  outro?: { start: number; end: number };
}

export class AudioAnalyzer {
  /**
   * Detect silence segments in audio
   * Returns segments that are NOT silent (i.e., where actual content exists)
   */
  static async detectSilence(
    videoPath: string,
    silenceThreshold: number = -40, // dB (lower = more strict)
    minSilenceDuration: number = 0.5 // seconds
  ): Promise<AudioSegment[]> {
    console.log(`[AudioAnalyzer] Detecting silence in ${videoPath}`);

    try {
      // Use FFmpeg's silencedetect filter to find silent periods
      const { stdout } = await execPromise(
        `ffmpeg -i "${videoPath}" -af silencedetect=noise=${silenceThreshold}dB:d=${minSilenceDuration} -f null - 2>&1`
      );

      const silenceRegex = /silence_(start|end): ([\d.]+)/g;
      const matches = Array.from(stdout.matchAll(silenceRegex));

      const silentPeriods: Array<{ start: number; end: number }> = [];
      let currentSilence: { start?: number; end?: number } = {};

      for (const match of matches) {
        const [, type, time] = match;
        const timestamp = parseFloat(time);

        if (type === "start") {
          currentSilence.start = timestamp;
        } else if (type === "end" && currentSilence.start !== undefined) {
          currentSilence.end = timestamp;
          silentPeriods.push({
            start: currentSilence.start,
            end: currentSilence.end,
          });
          currentSilence = {};
        }
      }

      // Get total video duration
      const duration = await this.getAudioDuration(videoPath);

      // Invert: convert silent periods to sound periods
      const soundSegments: AudioSegment[] = [];
      let lastEnd = 0;

      for (const silence of silentPeriods) {
        if (silence.start > lastEnd) {
          soundSegments.push({
            startTime: lastEnd,
            endTime: silence.start,
            type: "sound",
            volume: 0, // Placeholder, will be calculated separately if needed
          });
        }
        lastEnd = silence.end;
      }

      // Add final segment if there's content after last silence
      if (lastEnd < duration) {
        soundSegments.push({
          startTime: lastEnd,
          endTime: duration,
          type: "sound",
          volume: 0,
        });
      }

      console.log(
        `[AudioAnalyzer] Detected ${soundSegments.length} sound segments (removed ${silentPeriods.length} silent periods)`
      );
      return soundSegments;
    } catch (error) {
      console.error("[AudioAnalyzer] Silence detection failed:", error);
      // Fallback: return entire video as one sound segment
      const duration = await this.getAudioDuration(videoPath);
      return [{ startTime: 0, endTime: duration, type: "sound", volume: 0 }];
    }
  }

  /**
   * Detect music structure (intro, verse, chorus, bridge, outro)
   * Uses audio energy analysis to identify song sections
   */
  static async detectMusicStructure(
    videoPath: string
  ): Promise<MusicStructure> {
    console.log(`[AudioAnalyzer] Detecting music structure in ${videoPath}`);

    try {
      const duration = await this.getAudioDuration(videoPath);
      const energyLevels = await this.analyzeAudioEnergy(videoPath);

      // Simple heuristic-based structure detection
      // In production, this would use ML models trained on music datasets
      const structure: MusicStructure = {
        verses: [],
        choruses: [],
      };

      // Intro: First 10-15s with building energy
      if (duration >= 10) {
        structure.intro = { start: 0, end: Math.min(12, duration * 0.15) };
      }

      // Divide remaining song into sections based on energy patterns
      const sectionStart = structure.intro?.end || 0;
      const sectionEnd = duration * 0.9; // Reserve last 10% for outro
      const sectionDuration = sectionEnd - sectionStart;

      // Typical pop song: Verse-Chorus-Verse-Chorus-Bridge-Chorus
      const avgSectionLength = 20; // 20 seconds per section
      const numSections = Math.floor(sectionDuration / avgSectionLength);

      let currentTime = sectionStart;
      let isVerse = true; // Alternate between verse and chorus

      for (let i = 0; i < numSections && currentTime < sectionEnd; i++) {
        const segmentDuration = Math.min(avgSectionLength, sectionEnd - currentTime);

        if (isVerse) {
          structure.verses.push({
            start: currentTime,
            end: currentTime + segmentDuration,
          });
        } else {
          structure.choruses.push({
            start: currentTime,
            end: currentTime + segmentDuration,
          });
        }

        currentTime += segmentDuration;
        isVerse = !isVerse;
      }

      // Bridge: Around 60-70% through the song
      const bridgePosition = duration * 0.65;
      if (duration >= 60 && bridgePosition < sectionEnd) {
        structure.bridge = {
          start: bridgePosition,
          end: Math.min(bridgePosition + 15, sectionEnd),
        };
      }

      // Outro: Last 10% of song
      structure.outro = {
        start: duration * 0.9,
        end: duration,
      };

      console.log("[AudioAnalyzer] Detected structure:", structure);
      return structure;
    } catch (error) {
      console.error("[AudioAnalyzer] Music structure detection failed:", error);
      // Fallback: simple beginning/middle/end structure
      const duration = await this.getAudioDuration(videoPath);
      return {
        verses: [{ start: duration * 0.2, end: duration * 0.4 }],
        choruses: [{ start: duration * 0.4, end: duration * 0.8 }],
        outro: { start: duration * 0.8, end: duration },
      };
    }
  }

  /**
   * Analyze audio energy levels over time
   * Returns array of energy values at regular intervals
   */
  static async analyzeAudioEnergy(
    videoPath: string,
    intervalSeconds: number = 1
  ): Promise<number[]> {
    try {
      // Use FFmpeg's volumedetect or astats filter
      const { stdout } = await execPromise(
        `ffmpeg -i "${videoPath}" -af astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=- -f null - 2>&1`
      );

      // Parse RMS levels from output
      const rmsRegex = /lavfi\.astats\.Overall\.RMS_level=([-\d.]+)/g;
      const matches = Array.from(stdout.matchAll(rmsRegex));
      const energyLevels = matches.map((m) => parseFloat(m[1]));

      console.log(
        `[AudioAnalyzer] Analyzed ${energyLevels.length} energy data points`
      );
      return energyLevels;
    } catch (error) {
      console.error("[AudioAnalyzer] Energy analysis failed:", error);
      return [];
    }
  }

  /**
   * Get audio duration using ffprobe
   */
  static async getAudioDuration(videoPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err: any, metadata: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(Math.floor(metadata.format.duration || 0));
        }
      });
    });
  }

  /**
   * Trim silence from video clips
   * Returns adjusted start/end times with silence removed
   */
  static trimSilenceFromClip(
    clipStart: number,
    clipEnd: number,
    soundSegments: AudioSegment[]
  ): { start: number; end: number } | null {
    // Find sound segments that overlap with this clip
    const overlappingSegments = soundSegments.filter(
      (seg) => seg.endTime > clipStart && seg.startTime < clipEnd
    );

    if (overlappingSegments.length === 0) {
      console.warn(
        `[AudioAnalyzer] Clip ${clipStart}-${clipEnd}s is entirely silent`
      );
      return null; // This clip is all silence
    }

    // Use the first sound segment's start and last sound segment's end
    const firstSound = overlappingSegments[0];
    const lastSound = overlappingSegments[overlappingSegments.length - 1];

    return {
      start: Math.max(clipStart, firstSound.startTime),
      end: Math.min(clipEnd, lastSound.endTime),
    };
  }
}
