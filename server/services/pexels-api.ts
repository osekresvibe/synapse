
import axios from 'axios';
import { promises as fs } from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const PEXELS_API_BASE = 'https://api.pexels.com/v1';

export interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  duration: number;
  image: string;
  video_files: Array<{
    id: number;
    quality: string;
    file_type: string;
    width: number;
    height: number;
    link: string;
  }>;
  video_pictures: Array<{
    id: number;
    picture: string;
    nr: number;
  }>;
}

export interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
  };
}

export class PexelsAPI {
  /**
   * Search for stock videos
   */
  static async searchVideos(query: string, perPage = 15, page = 1): Promise<{ videos: PexelsVideo[]; total: number }> {
    if (!PEXELS_API_KEY) {
      throw new Error('Pexels API key not configured');
    }

    try {
      const response = await axios.get(`${PEXELS_API_BASE}/videos/search`, {
        headers: {
          Authorization: PEXELS_API_KEY,
        },
        params: {
          query,
          per_page: perPage,
          page,
          orientation: 'portrait', // Default to portrait for social media
        },
      });

      return {
        videos: response.data.videos || [],
        total: response.data.total_results || 0,
      };
    } catch (error: any) {
      console.error('[Pexels] Video search failed:', error.message);
      throw new Error('Failed to search Pexels videos');
    }
  }

  /**
   * Search for stock photos
   */
  static async searchPhotos(query: string, perPage = 15, page = 1): Promise<{ photos: PexelsPhoto[]; total: number }> {
    if (!PEXELS_API_KEY) {
      throw new Error('Pexels API key not configured');
    }

    try {
      const response = await axios.get(`${PEXELS_API_BASE}/search`, {
        headers: {
          Authorization: PEXELS_API_KEY,
        },
        params: {
          query,
          per_page: perPage,
          page,
          orientation: 'portrait',
        },
      });

      return {
        photos: response.data.photos || [],
        total: response.data.total_results || 0,
      };
    } catch (error: any) {
      console.error('[Pexels] Photo search failed:', error.message);
      throw new Error('Failed to search Pexels photos');
    }
  }

  /**
   * Download Pexels media to local storage
   */
  static async downloadMedia(url: string, type: 'video' | 'photo'): Promise<string> {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
          Authorization: PEXELS_API_KEY,
        },
      });

      const ext = type === 'video' ? 'mp4' : 'jpg';
      const filename = `pexels-${nanoid()}.${ext}`;
      const dir = path.join(process.cwd(), 'uploads', type === 'video' ? 'videos' : 'slides');
      
      if (!await fs.access(dir).then(() => true).catch(() => false)) {
        await fs.mkdir(dir, { recursive: true });
      }

      const filePath = path.join(dir, filename);
      await fs.writeFile(filePath, response.data);

      return `/uploads/${type === 'video' ? 'videos' : 'slides'}/${filename}`;
    } catch (error: any) {
      console.error('[Pexels] Download failed:', error.message);
      throw new Error('Failed to download Pexels media');
    }
  }

  /**
   * Get popular videos
   */
  static async getPopularVideos(perPage = 15, page = 1): Promise<{ videos: PexelsVideo[]; total: number }> {
    if (!PEXELS_API_KEY) {
      throw new Error('Pexels API key not configured');
    }

    try {
      const response = await axios.get(`${PEXELS_API_BASE}/videos/popular`, {
        headers: {
          Authorization: PEXELS_API_KEY,
        },
        params: {
          per_page: perPage,
          page,
        },
      });

      return {
        videos: response.data.videos || [],
        total: response.data.total_results || 0,
      };
    } catch (error: any) {
      console.error('[Pexels] Popular videos fetch failed:', error.message);
      throw new Error('Failed to fetch popular videos');
    }
  }
}
