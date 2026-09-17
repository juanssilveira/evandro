import { db } from "@/db";
import { folders, videos, type Folder, type FolderColor, type Video } from "@/db/schema";
import { eq, and, sql, asc } from "drizzle-orm";

export interface FolderWithCount extends Folder {
  videoCount: number;
}

export async function getFoldersForAccount(
  accountId: string
): Promise<FolderWithCount[]> {
  const rows = await db
    .select({
      id: folders.id,
      accountId: folders.accountId,
      name: folders.name,
      color: folders.color,
      createdAt: folders.createdAt,
      updatedAt: folders.updatedAt,
      videoCount: sql<number>`count(${videos.id})::int`,
    })
    .from(folders)
    .leftJoin(
      videos,
      and(eq(videos.folderId, folders.id), eq(videos.accountId, accountId))
    )
    .where(eq(folders.accountId, accountId))
    .groupBy(folders.id)
    .orderBy(asc(folders.createdAt));

  return rows as FolderWithCount[];
}

export async function getFolderForAccount(
  folderId: string,
  accountId: string
): Promise<Folder | null> {
  const [folder] = await db
    .select()
    .from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.accountId, accountId)))
    .limit(1);

  return folder || null;
}

export async function createFolder(
  accountId: string,
  input: { name: string; color?: FolderColor }
): Promise<Folder> {
  const [newFolder] = await db
    .insert(folders)
    .values({
      accountId,
      name: input.name.trim(),
      color: input.color || "gray",
    })
    .returning();

  return newFolder;
}

export async function updateFolder(
  folderId: string,
  accountId: string,
  input: { name?: string; color?: FolderColor }
): Promise<Folder | null> {
  const updateData: Partial<{ name: string; color: string }> = {};
  if (input.name !== undefined) {
    updateData.name = input.name.trim();
  }
  if (input.color !== undefined) {
    updateData.color = input.color;
  }

  if (Object.keys(updateData).length === 0) {
    return getFolderForAccount(folderId, accountId);
  }

  const [updated] = await db
    .update(folders)
    .set(updateData)
    .where(and(eq(folders.id, folderId), eq(folders.accountId, accountId)))
    .returning();

  return updated || null;
}

export async function deleteFolder(
  folderId: string,
  accountId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(folders)
        .where(and(eq(folders.id, folderId), eq(folders.accountId, accountId)))
        .limit(1);

      if (!existing) {
        throw new Error("FOLDER_NOT_FOUND");
      }

      // Reassign videos in this folder to root (folderId = null) atomically
      await tx
        .update(videos)
        .set({ folderId: null })
        .where(and(eq(videos.folderId, folderId), eq(videos.accountId, accountId)));

      // Delete the folder
      await tx
        .delete(folders)
        .where(and(eq(folders.id, folderId), eq(folders.accountId, accountId)));
    });

    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "FOLDER_NOT_FOUND") {
      return { success: false, error: "Pasta não encontrada." };
    }
    console.error("[Delete Folder Error]", error);
    return { success: false, error: "Erro ao excluir a pasta." };
  }
}

export async function moveVideoToFolder(
  videoId: string,
  accountId: string,
  folderId: string | null
): Promise<Video | null> {
  // If target folderId provided, verify it belongs to this account
  if (folderId !== null) {
    const folder = await getFolderForAccount(folderId, accountId);
    if (!folder) {
      return null;
    }
  }

  const [updated] = await db
    .update(videos)
    .set({ folderId })
    .where(and(eq(videos.id, videoId), eq(videos.accountId, accountId)))
    .returning();

  return updated || null;
}
