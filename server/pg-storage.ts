import { eq } from "drizzle-orm";
import { db } from "./db";
import {
  projects,
  smartSlices,
  generatedVideos,
  referenceVideos,
  type Project,
  type InsertProject,
  type SmartSlice,
  type InsertSmartSlice,
  type GeneratedVideo,
  type InsertGeneratedVideo,
  type ReferenceVideo,
  type InsertReferenceVideo,
} from "@shared/schema";
import type { IStorage } from "./storage";

export class PgStorage implements IStorage {
  // Projects
  async getProject(id: string): Promise<Project | undefined> {
    const result = await db.select().from(projects).where(eq(projects.id, id));
    return result[0];
  }

  async getAllProjects(): Promise<Project[]> {
    return await db.select().from(projects);
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const result = await db.insert(projects).values(insertProject).returning();
    return result[0];
  }

  async updateProject(
    id: string,
    updates: Partial<Project>
  ): Promise<Project | undefined> {
    const result = await db
      .update(projects)
      .set(updates)
      .where(eq(projects.id, id))
      .returning();
    return result[0];
  }

  async deleteProject(id: string): Promise<boolean> {
    // Delete related slices and videos first (CASCADE not configured in schema)
    await db.delete(smartSlices).where(eq(smartSlices.projectId, id));
    await db.delete(generatedVideos).where(eq(generatedVideos.projectId, id));

    // Delete the project
    const result = await db.delete(projects).where(eq(projects.id, id)).returning();
    return result.length > 0;
  }

  // Smart Slices
  async getSlicesByProject(projectId: string): Promise<SmartSlice[]> {
    return await db
      .select()
      .from(smartSlices)
      .where(eq(smartSlices.projectId, projectId));
  }

  async createSlice(insertSlice: InsertSmartSlice): Promise<SmartSlice> {
    const result = await db
      .insert(smartSlices)
      .values(insertSlice)
      .returning();
    return result[0];
  }

  async createSlices(insertSlices: InsertSmartSlice[]): Promise<SmartSlice[]> {
    if (insertSlices.length === 0) return [];
    const result = await db
      .insert(smartSlices)
      .values(insertSlices)
      .returning();
    return result;
  }

  async updateSlice(id: string, updates: Partial<SmartSlice>): Promise<SmartSlice | undefined> {
    const updated = await db
      .update(smartSlices)
      .set(updates)
      .where(eq(smartSlices.id, id))
      .returning();

    return updated[0];
  }

  async deleteSlice(id: string): Promise<boolean> {
    const deleted = await db
      .delete(smartSlices)
      .where(eq(smartSlices.id, id))
      .returning();

    return deleted.length > 0;
  }

  // Generated Videos
  async getVideosByProject(projectId: string): Promise<GeneratedVideo[]> {
    return await db
      .select()
      .from(generatedVideos)
      .where(eq(generatedVideos.projectId, projectId));
  }

  async getVideoById(id: string): Promise<GeneratedVideo | undefined> {
    const result = await db
      .select()
      .from(generatedVideos)
      .where(eq(generatedVideos.id, id));
    return result[0];
  }

  async createVideo(
    insertVideo: InsertGeneratedVideo
  ): Promise<GeneratedVideo> {
    const result = await db
      .insert(generatedVideos)
      .values(insertVideo)
      .returning();
    return result[0];
  }

  async updateVideo(
    id: string,
    updates: Partial<GeneratedVideo>
  ): Promise<GeneratedVideo | undefined> {
    const result = await db
      .update(generatedVideos)
      .set(updates)
      .where(eq(generatedVideos.id, id))
      .returning();
    return result[0];
  }

  async deleteVideo(id: string): Promise<boolean> {
    const result = await db
      .delete(generatedVideos)
      .where(eq(generatedVideos.id, id))
      .returning();
    return result.length > 0;
  }

  // Reference Videos
  async getReferenceVideo(id: string): Promise<ReferenceVideo | undefined> {
    const result = await db
      .select()
      .from(referenceVideos)
      .where(eq(referenceVideos.id, id));
    return result[0];
  }

  async createReferenceVideo(
    referenceVideo: InsertReferenceVideo
  ): Promise<ReferenceVideo> {
    const [result] = await db
      .insert(referenceVideos)
      .values(referenceVideo)
      .returning();
    return result;
  }

  async getReferenceVideoById(id: string): Promise<ReferenceVideo | null> {
    const [result] = await db
      .select()
      .from(referenceVideos)
      .where(eq(referenceVideos.id, id))
      .limit(1);
    return result || null;
  }
}