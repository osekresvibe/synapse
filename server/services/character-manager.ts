
/**
 * CHARACTER CONSISTENCY MANAGER
 * Enables multi-episode series with consistent AI-generated characters
 * V6.0: Solves the market gap - no competitor offers this workflow
 */

import { nanoid } from 'nanoid';
import fs from 'fs';
import path from 'path';

export interface CharacterDefinition {
  id: string;
  name: string;
  visualDescription: string; // "30-year-old Roman emperor in purple toga, laurel crown, stern expression"
  voiceId: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  gender: 'male' | 'female' | 'neutral';
  referenceImageUrl?: string; // Optional: User-uploaded reference image
  runwayCharacterId?: string; // Runway Gen-3 Alpha character ID (for advanced consistency)
}

export interface SeriesProject {
  seriesId: string;
  seriesTitle: string;
  episodeCount: number;
  characters: CharacterDefinition[];
  createdAt: Date;
}

export class CharacterManager {
  private static CHARACTERS_DIR = path.join(process.cwd(), 'uploads', 'characters');
  private static SERIES_INDEX_PATH = path.join(this.CHARACTERS_DIR, 'series-index.json');

  /**
   * Initialize character storage
   */
  static initialize() {
    if (!fs.existsSync(this.CHARACTERS_DIR)) {
      fs.mkdirSync(this.CHARACTERS_DIR, { recursive: true });
    }

    if (!fs.existsSync(this.SERIES_INDEX_PATH)) {
      fs.writeFileSync(this.SERIES_INDEX_PATH, JSON.stringify({ series: [] }));
    }
  }

  /**
   * Create a new series with character definitions
   */
  static createSeries(
    title: string,
    characters: Omit<CharacterDefinition, 'id'>[]
  ): SeriesProject {
    this.initialize();

    const seriesId = nanoid();
    const characterDefinitions: CharacterDefinition[] = characters.map(char => ({
      ...char,
      id: nanoid(),
    }));

    const series: SeriesProject = {
      seriesId,
      seriesTitle: title,
      episodeCount: 0,
      characters: characterDefinitions,
      createdAt: new Date(),
    };

    // Save series to index
    const index = JSON.parse(fs.readFileSync(this.SERIES_INDEX_PATH, 'utf-8'));
    index.series.push(series);
    fs.writeFileSync(this.SERIES_INDEX_PATH, JSON.stringify(index, null, 2));

    console.log(`[CharacterManager] Created series "${title}" with ${characters.length} characters`);
    return series;
  }

  /**
   * Get series by ID
   */
  static getSeries(seriesId: string): SeriesProject | null {
    this.initialize();
    const index = JSON.parse(fs.readFileSync(this.SERIES_INDEX_PATH, 'utf-8'));
    return index.series.find((s: SeriesProject) => s.seriesId === seriesId) || null;
  }

  /**
   * Get all series
   */
  static getAllSeries(): SeriesProject[] {
    this.initialize();
    const index = JSON.parse(fs.readFileSync(this.SERIES_INDEX_PATH, 'utf-8'));
    return index.series || [];
  }

  /**
   * Inject character description into scene prompt for consistency
   */
  static injectCharacterIntoPrompt(
    basePrompt: string,
    character: CharacterDefinition
  ): string {
    // Add character description at the beginning for maximum influence
    return `${character.visualDescription}. ${basePrompt}`;
  }

  /**
   * Generate character-specific scene prompts for a script
   * Automatically detects character names in script and injects visual descriptions
   */
  static parseScriptWithCharacters(
    scriptContent: string,
    characters: CharacterDefinition[]
  ): Array<{
    line: string;
    character: CharacterDefinition | null;
    visualPrompt: string;
  }> {
    const lines = scriptContent.split('\n');
    const parsedLines: Array<{
      line: string;
      character: CharacterDefinition | null;
      visualPrompt: string;
    }> = [];

    for (const line of lines) {
      // Detect character tags: [CHARACTER_NAME]: dialogue
      const characterMatch = line.match(/^\[([^\]]+)\]:\s*(.+)$/);

      if (characterMatch) {
        const characterName = characterMatch[1].trim();
        const dialogue = characterMatch[2].trim();

        // Find matching character
        const character = characters.find(
          c => c.name.toLowerCase() === characterName.toLowerCase()
        );

        if (character) {
          const visualPrompt = `${character.visualDescription}, speaking with emotion: "${dialogue.substring(0, 50)}..."`;
          parsedLines.push({
            line: dialogue,
            character,
            visualPrompt,
          });
        } else {
          // Character not found, use generic prompt
          parsedLines.push({
            line: dialogue,
            character: null,
            visualPrompt: `Person speaking: "${dialogue.substring(0, 50)}..."`,
          });
        }
      } else {
        // Narration or non-character line
        parsedLines.push({
          line,
          character: null,
          visualPrompt: `Cinematic scene: ${line.substring(0, 100)}`,
        });
      }
    }

    return parsedLines;
  }

  /**
   * Update series episode count
   */
  static incrementEpisodeCount(seriesId: string): void {
    this.initialize();
    const index = JSON.parse(fs.readFileSync(this.SERIES_INDEX_PATH, 'utf-8'));
    const series = index.series.find((s: SeriesProject) => s.seriesId === seriesId);

    if (series) {
      series.episodeCount++;
      fs.writeFileSync(this.SERIES_INDEX_PATH, JSON.stringify(index, null, 2));
      console.log(`[CharacterManager] Series "${series.seriesTitle}" now has ${series.episodeCount} episodes`);
    }
  }

  /**
   * Advanced: Upload reference image for character (future integration with Runway Gen-3 Alpha)
   */
  static async uploadCharacterReference(
    characterId: string,
    imageBuffer: Buffer
  ): Promise<string> {
    this.initialize();
    const imagePath = path.join(this.CHARACTERS_DIR, `${characterId}.jpg`);
    fs.writeFileSync(imagePath, imageBuffer);

    // Future: Send to Runway Gen-3 Alpha for character ID creation
    // const runwayCharacterId = await createRunwayCharacter(imagePath);

    console.log(`[CharacterManager] Saved reference image for character ${characterId}`);
    return imagePath;
  }

  /**
   * Generate voice mapping for multi-character scenes
   */
  static getVoiceMapping(characters: CharacterDefinition[]): Record<string, string> {
    const voiceMap: Record<string, string> = {};
    characters.forEach(char => {
      voiceMap[char.name] = char.voiceId;
    });
    return voiceMap;
  }
}
