import { z } from "zod";
import { folderColors } from "@/db/schema/folders";

export const createFolderSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "O nome da pasta é obrigatório")
    .max(80, "O nome da pasta deve ter no máximo 80 caracteres"),
  color: z.enum(folderColors).default("gray").optional(),
});

export type CreateFolderInput = z.infer<typeof createFolderSchema>;

export const updateFolderSchema = z.object({
  folderId: z.string().uuid("ID de pasta inválido"),
  name: z
    .string()
    .trim()
    .min(1, "O nome da pasta é obrigatório")
    .max(80, "O nome da pasta deve ter no máximo 80 caracteres")
    .optional(),
  color: z.enum(folderColors).optional(),
});

export type UpdateFolderInput = z.infer<typeof updateFolderSchema>;

export const deleteFolderSchema = z.object({
  folderId: z.string().uuid("ID de pasta inválido"),
});

export type DeleteFolderInput = z.infer<typeof deleteFolderSchema>;

export const moveVideoToFolderSchema = z.object({
  videoId: z.string().uuid("ID de vídeo inválido"),
  folderId: z.string().uuid("ID de pasta inválido").nullable(),
});

export type MoveVideoToFolderInput = z.infer<typeof moveVideoToFolderSchema>;
