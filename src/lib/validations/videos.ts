import { z } from "zod";

export const createUploadSchema = z.object({
  filename: z.string().min(1, "Nome do arquivo é obrigatório"),
  mimeType: z.literal("video/mp4", {
    message: "Apenas arquivos MP4 (video/mp4) são permitidos",
  }),
  sizeBytes: z.number().positive("Tamanho do arquivo deve ser maior que zero"),
});

export type CreateUploadInput = z.infer<typeof createUploadSchema>;

export const finalizeUploadSchema = z.object({
  videoId: z.string().uuid("ID de vídeo inválido"),
  title: z.string().trim().min(1, "O título é obrigatório").max(255, "Título muito longo"),
  originalFilename: z.string().min(1, "Nome original do arquivo é obrigatório"),
  sizeBytes: z.number().positive("Tamanho do arquivo deve ser maior que zero"),
});

export type FinalizeUploadInput = z.infer<typeof finalizeUploadSchema>;
