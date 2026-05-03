
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import type { AudioTrack, AudioDuckingConfig } from '@shared/schema';

export class AudioMixer {
  /**
   * Mix multiple audio tracks with ducking support
   */
  static async mixAudioTracks(
    videoPath: string,
    audioTracks: AudioTrack[],
    duckingConfig: AudioDuckingConfig,
    masterVolume: number,
    outputPath: string
  ): Promise<void> {
    if (audioTracks.length === 0) {
      // No audio mixing needed, just copy
      await fs.copyFile(videoPath, outputPath);
      return;
    }

    // Validate all audio files exist
    for (const track of audioTracks) {
      const filePath = track.url;
      try {
        await fs.access(filePath);
      } catch (error) {
        console.error(`[AudioMixer] Audio file not found: ${filePath}`);
        throw new Error(`Audio file not found: ${filePath}`);
      }
    }

    const filterComplex: string[] = [];
    const inputs: string[] = ['-i', videoPath];
    
    // Separate background and voiceover tracks
    const backgroundTracks = audioTracks.filter(t => t.type === 'background');
    const voiceoverTracks = audioTracks.filter(t => t.type === 'voiceover');
    const sfxTracks = audioTracks.filter(t => t.type === 'sfx');

    let audioIndex = 1; // 0 is video
    const trackLabels: string[] = [];

    // Add all audio track inputs
    for (const track of audioTracks) {
      if (track.url) {
        inputs.push('-i', track.url);
      }
    }

    // Process each track with volume, fade, and trim
    for (let i = 0; i < audioTracks.length; i++) {
      const track = audioTracks[i];
      const inputIndex = audioIndex + i;
      let filter = `[${inputIndex}:a]`;
      const filters: string[] = [];

      // Volume adjustment
      const volumeDb = this.volumeToDb(track.volume);
      filters.push(`volume=${volumeDb}dB`);

      // Fade in/out
      if (track.fadeIn) {
        filters.push(`afade=t=in:st=0:d=${track.fadeIn}`);
      }
      if (track.fadeOut && track.duration) {
        filters.push(`afade=t=out:st=${track.duration - track.fadeOut}:d=${track.fadeOut}`);
      }

      // Delay to start time
      if (track.startTime > 0) {
        filters.push(`adelay=${track.startTime * 1000}|${track.startTime * 1000}`);
      }

      const label = `a${i}`;
      filter += filters.join(',');
      filter += `[${label}]`;
      filterComplex.push(filter);
      trackLabels.push(label);
    }

    // Apply audio ducking if enabled
    if (duckingConfig.enabled && backgroundTracks.length > 0 && voiceoverTracks.length > 0) {
      const bgLabels = trackLabels.slice(0, backgroundTracks.length);
      const voiceLabels = trackLabels.slice(backgroundTracks.length, backgroundTracks.length + voiceoverTracks.length);

      // Mix background tracks first
      const bgMixed = 'bgmix';
      if (bgLabels.length > 1) {
        filterComplex.push(`${bgLabels.map(l => `[${l}]`).join('')}amix=inputs=${bgLabels.length}[${bgMixed}]`);
      } else {
        filterComplex.push(`[${bgLabels[0]}]acopy[${bgMixed}]`);
      }

      // Mix voiceover tracks
      const voiceMixed = 'voicemix';
      if (voiceLabels.length > 1) {
        filterComplex.push(`${voiceLabels.map(l => `[${l}]`).join('')}amix=inputs=${voiceLabels.length}[${voiceMixed}]`);
      } else {
        filterComplex.push(`[${voiceLabels[0]}]acopy[${voiceMixed}]`);
      }

      // Apply sidechaincompress for ducking
      const duckRatio = duckingConfig.ratio / 100;
      filterComplex.push(
        `[${bgMixed}][${voiceMixed}]sidechaincompress=threshold=${duckingConfig.threshold}dB:ratio=${1 / (1 - duckRatio)}:attack=${duckingConfig.attack}:release=${duckingConfig.release}[bgducked]`
      );

      // Mix ducked background with voice
      const allLabels = ['bgducked', voiceMixed, ...trackLabels.slice(backgroundTracks.length + voiceoverTracks.length)];
      filterComplex.push(`${allLabels.map(l => `[${l}]`).join('')}amix=inputs=${allLabels.length}:dropout_transition=0[mixed]`);
    } else {
      // No ducking, just mix all tracks
      filterComplex.push(`${trackLabels.map(l => `[${l}]`).join('')}amix=inputs=${trackLabels.length}:dropout_transition=0[mixed]`);
    }

    // Apply master volume
    const masterDb = this.volumeToDb(masterVolume);
    filterComplex.push(`[mixed]volume=${masterDb}dB[final]`);

    // Build FFmpeg command
    const args = [
      ...inputs,
      '-filter_complex',
      filterComplex.join(';'),
      '-map', '0:v', // Video from original
      '-map', '[final]', // Mixed audio
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-shortest', // End when shortest stream ends
      '-y',
      outputPath
    ];

    await this.runFFmpeg(args);
  }

  /**
   * Extract audio from video for analysis
   */
  static async extractAudio(videoPath: string, outputPath: string): Promise<void> {
    const args = [
      '-i', videoPath,
      '-vn', // No video
      '-acodec', 'pcm_s16le',
      '-ar', '44100',
      '-ac', '2',
      '-y',
      outputPath
    ];

    await this.runFFmpeg(args);
  }

  /**
   * Detect speech segments for ducking
   */
  static async detectSpeech(audioPath: string): Promise<Array<{ start: number; end: number }>> {
    // Use silencedetect to find non-silent (speech) segments
    const segments: Array<{ start: number; end: number }> = [];
    
    return new Promise((resolve, reject) => {
      const args = [
        '-i', audioPath,
        '-af', 'silencedetect=noise=-30dB:d=0.5',
        '-f', 'null',
        '-'
      ];

      const proc = spawn('ffmpeg', args);
      let stderr = '';

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`FFmpeg exited with code ${code}`));
        }

        // Parse silence detection output
        const silenceStart = /silence_start: ([\d.]+)/g;
        const silenceEnd = /silence_end: ([\d.]+)/g;

        const starts: number[] = [];
        const ends: number[] = [];

        let match;
        while ((match = silenceStart.exec(stderr)) !== null) {
          starts.push(parseFloat(match[1]));
        }
        while ((match = silenceEnd.exec(stderr)) !== null) {
          ends.push(parseFloat(match[1]));
        }

        // Convert silence segments to speech segments
        let currentStart = 0;
        for (let i = 0; i < ends.length; i++) {
          if (ends[i] > currentStart) {
            segments.push({ start: currentStart, end: starts[i] || ends[i] });
          }
          currentStart = ends[i];
        }

        resolve(segments);
      });
    });
  }

  /**
   * Convert volume percentage (0-100) to dB
   */
  private static volumeToDb(volume: number): number {
    if (volume === 0) return -60; // Mute
    if (volume === 100) return 0; // No change
    // Logarithmic scale: -60dB to 0dB
    return 20 * Math.log10(volume / 100);
  }

  /**
   * Run FFmpeg command with promise
   */
  private static runFFmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('[AudioMixer] Running FFmpeg:', 'ffmpeg', args.join(' '));
      const proc = spawn('ffmpeg', args);

      let stderr = '';
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          console.error('[AudioMixer] FFmpeg error:', stderr);
          return reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
        }
        resolve();
      });
    });
  }
}
