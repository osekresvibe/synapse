import {
  type Project,
  type InsertProject,
  type ProjectSource,
  type InsertProjectSource,
  type SmartSlice,
  type InsertSmartSlice,
  type GeneratedVideo,
  type InsertGeneratedVideo,
  type ReferenceVideo,
  type InsertReferenceVideo,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Projects
  getProject(id: string): Promise<Project | undefined>;
  getAllProjects(): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(
    id: string,
    updates: Partial<Project>
  ): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;

  // Project Sources (for multi-video compilation projects)
  getSourcesByProject(projectId: string): Promise<ProjectSource[]>;
  createProjectSource(source: InsertProjectSource): Promise<ProjectSource>;
  createProjectSources(sources: InsertProjectSource[]): Promise<ProjectSource[]>;
  deleteProjectSources(projectId: string): Promise<boolean>;

  // Smart Slices
  getSlicesByProject(projectId: string): Promise<SmartSlice[]>;
  createSlice(slice: InsertSmartSlice): Promise<SmartSlice>;
  createSlices(slices: InsertSmartSlice[]): Promise<SmartSlice[]>;
  updateSlice(id: string, updates: Partial<SmartSlice>): Promise<SmartSlice | undefined>;
  deleteSlice(id: string): Promise<boolean>;

  // Generated Videos
  getVideosByProject(projectId: string): Promise<GeneratedVideo[]>;
  getVideoById(id: string): Promise<GeneratedVideo | undefined>;
  createVideo(video: InsertGeneratedVideo): Promise<GeneratedVideo>;
  updateVideo(
    id: string,
    updates: Partial<GeneratedVideo>
  ): Promise<GeneratedVideo | undefined>;
  deleteVideo(id: string): Promise<boolean>;

  // Reference Videos
  getReferenceVideo(id: string): Promise<ReferenceVideo | undefined>;
  getReferenceVideoById(id: string): Promise<ReferenceVideo | null>;
  createReferenceVideo(
    video: InsertReferenceVideo
  ): Promise<ReferenceVideo>;
}

export class MemStorage implements IStorage {
  private projects: Map<string, Project>;
  private projectSources: Map<string, ProjectSource>;
  private slices: Map<string, SmartSlice>;
  private videos: Map<string, GeneratedVideo>;
  private referenceVideos: Map<string, ReferenceVideo>;

  constructor() {
    this.projects = new Map();
    this.projectSources = new Map();
    this.slices = new Map();
    this.videos = new Map();
    this.referenceVideos = new Map();
  }

  // Projects
  async getProject(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async getAllProjects(): Promise<Project[]> {
    return Array.from(this.projects.values());
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const id = randomUUID();
    const project: Project = {
      ...insertProject,
      id,
      projectType: insertProject.projectType ?? "video",
      sourceVideoUrl: insertProject.sourceVideoUrl ?? null,
      sourceVideoPath: insertProject.sourceVideoPath ?? null,
      thumbnailPath: insertProject.thumbnailPath ?? null,
      scriptContent: insertProject.scriptContent ?? null,
      status: insertProject.status || "pending",
      duration: insertProject.duration ?? null,
      userIntent: insertProject.userIntent ?? null,
      intentConfig: insertProject.intentConfig ?? null,
      videoCategory: insertProject.videoCategory ?? null,
      batchId: insertProject.batchId ?? null,
      batchIndex: insertProject.batchIndex ?? null,
      seriesId: insertProject.seriesId ?? null,
      episodeNumber: insertProject.episodeNumber ?? null,
      characterData: insertProject.characterData ?? null,
      isCompilation: insertProject.isCompilation ?? false,
      createdAt: new Date(),
    };
    this.projects.set(id, project);
    return project;
  }

  async updateProject(
    id: string,
    updates: Partial<Project>
  ): Promise<Project | undefined> {
    const project = this.projects.get(id);
    if (!project) return undefined;

    const updated = { ...project, ...updates };
    this.projects.set(id, updated);
    return updated;
  }

  async deleteProject(id: string): Promise<boolean> {
    const deleted = this.projects.delete(id);

    // Also delete related slices, videos, and project sources
    const slicesToDelete = Array.from(this.slices.values())
      .filter(s => s.projectId === id);
    slicesToDelete.forEach(s => this.slices.delete(s.id));

    const videosToDelete = Array.from(this.videos.values())
      .filter(v => v.projectId === id);
    videosToDelete.forEach(v => this.videos.delete(v.id));

    // Delete project sources for compilation projects
    const sourcesToDelete = Array.from(this.projectSources.values())
      .filter(s => s.projectId === id);
    sourcesToDelete.forEach(s => this.projectSources.delete(s.id));

    return deleted;
  }

  // Project Sources (for multi-video compilation projects)
  async getSourcesByProject(projectId: string): Promise<ProjectSource[]> {
    return Array.from(this.projectSources.values())
      .filter(source => source.projectId === projectId)
      .sort((a, b) => a.order - b.order);
  }

  async createProjectSource(insertSource: InsertProjectSource): Promise<ProjectSource> {
    const id = randomUUID();
    const source: ProjectSource = {
      ...insertSource,
      id,
      sourceProjectId: insertSource.sourceProjectId ?? null,
      originalFileName: insertSource.originalFileName ?? null,
      duration: insertSource.duration ?? null,
      order: insertSource.order ?? 0,
      thumbnailPath: insertSource.thumbnailPath ?? null,
      createdAt: new Date(),
    };
    this.projectSources.set(id, source);
    return source;
  }

  async createProjectSources(insertSources: InsertProjectSource[]): Promise<ProjectSource[]> {
    return Promise.all(insertSources.map(source => this.createProjectSource(source)));
  }

  async deleteProjectSources(projectId: string): Promise<boolean> {
    const sources = Array.from(this.projectSources.values())
      .filter(s => s.projectId === projectId);
    sources.forEach(s => this.projectSources.delete(s.id));
    return sources.length > 0;
  }

  // Smart Slices
  async getSlicesByProject(projectId: string): Promise<SmartSlice[]> {
    return Array.from(this.slices.values()).filter(
      (slice) => slice.projectId === projectId
    );
  }

  async createSlice(insertSlice: InsertSmartSlice): Promise<SmartSlice> {
    const id = randomUUID();
    const slice: SmartSlice = {
      ...insertSlice,
      id,
      sourceId: insertSlice.sourceId ?? null,
      order: insertSlice.order ?? 0,
      startTime: insertSlice.startTime ?? 0,
      endTime: insertSlice.endTime ?? 3,
      transcription: insertSlice.transcription ?? null,
      textContent: insertSlice.textContent ?? null,
      engagementScore: insertSlice.engagementScore ?? null,
      thumbnailPath: insertSlice.thumbnailPath ?? null,
      clipType: insertSlice.clipType ?? null,
      cinematicPrompt: insertSlice.cinematicPrompt ?? null,
      aiVideoUrl: insertSlice.aiVideoUrl ?? null,
      aiVideoPath: insertSlice.aiVideoPath ?? null,
      aiGenerationStatus: insertSlice.aiGenerationStatus ?? null,
    };
    this.slices.set(id, slice);
    return slice;
  }

  async createSlices(insertSlices: InsertSmartSlice[]): Promise<SmartSlice[]> {
    return Promise.all(insertSlices.map((slice) => this.createSlice(slice)));
  }

  async updateSlice(
    id: string,
    updates: Partial<SmartSlice>
  ): Promise<SmartSlice | undefined> {
    const slice = this.slices.get(id);
    if (!slice) return undefined;

    const updated = { ...slice, ...updates };
    this.slices.set(id, updated);
    return updated;
  }

  async deleteSlice(id: string): Promise<boolean> {
    return this.slices.delete(id);
  }

  // Generated Videos
  async getVideosByProject(projectId: string): Promise<GeneratedVideo[]> {
    return Array.from(this.videos.values()).filter(
      (video) => video.projectId === projectId
    );
  }

  async getVideoById(id: string): Promise<GeneratedVideo | undefined> {
    return this.videos.get(id);
  }

  async createVideo(insertVideo: InsertGeneratedVideo): Promise<GeneratedVideo> {
    const id = randomUUID();
    const video: GeneratedVideo = {
      ...insertVideo,
      id,
      status: insertVideo.status || "pending",
      videoPath: null,
      appliedMood: insertVideo.appliedMood ?? null,
      appliedStyle: insertVideo.appliedStyle ?? null,
    };
    this.videos.set(id, video);
    return video;
  }

  async updateVideo(
    id: string,
    updates: Partial<GeneratedVideo>
  ): Promise<GeneratedVideo | undefined> {
    const video = this.videos.get(id);
    if (!video) return undefined;

    const updated = { ...video, ...updates };
    this.videos.set(id, updated);
    return updated;
  }

  async deleteVideo(id: string): Promise<boolean> {
    return this.videos.delete(id);
  }

  // Reference Videos
  async getReferenceVideo(id: string): Promise<ReferenceVideo | undefined> {
    return this.referenceVideos.get(id);
  }

  async getReferenceVideoById(id: string): Promise<ReferenceVideo | null> {
    return this.referenceVideos.get(id) || null;
  }

  async createReferenceVideo(
    insertVideo: InsertReferenceVideo
  ): Promise<ReferenceVideo> {
    const id = randomUUID();
    const video: ReferenceVideo = {
      ...insertVideo,
      id,
      videoPath: null,
      analyzedStyle: null,
      cutTempo: null,
      colorProfile: null,
      transitionTypes: null,
    };
    this.referenceVideos.set(id, video);
    return video;
  }
}

// Use PostgreSQL storage in production, memory storage for testing
import { PgStorage } from "./pg-storage";

export const storage =
  process.env.NODE_ENV === "development"
    ? new PgStorage()
    : new MemStorage();