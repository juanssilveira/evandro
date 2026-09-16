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

export const updatePlayerConfigActionSchema = z.object({
  videoId: z.string().uuid("ID de vídeo inválido"),
  config: z.object({
    appearance: z
      .object({
        accentColor: z.enum(["purple", "blue", "emerald", "orange", "rose"]).optional(),
      })
      .optional(),
    playback: z
      .object({
        autoplay: z.boolean().optional(),
        backgroundAutoplay: z.boolean().optional(),
      })
      .optional(),
    controls: z
      .object({
        hidden: z.boolean().optional(),
        fullscreen: z
          .object({
            enabled: z.boolean().optional(),
            button: z.boolean().optional(),
            doubleClick: z.boolean().optional(),
            keyboardF: z.boolean().optional(),
          })
          .optional(),
      })
      .optional(),
    progress: z
      .object({
        fake: z
          .object({
            enabled: z.boolean().optional(),
            targetPercent: z.number().optional(),
            targetSeconds: z.number().optional(),
          })
          .optional(),
      })
      .optional(),
    development: z
      .object({
        debug: z.boolean().optional(),
      })
      .optional(),
  }),
});

export type UpdatePlayerConfigActionInput = z.infer<typeof updatePlayerConfigActionSchema>;

export const updateVideoDebugSchema = z.object({
  videoId: z.string().uuid("ID de vídeo inválido"),
  debugEnabled: z.boolean(),
});

export type UpdateVideoDebugInput = z.infer<typeof updateVideoDebugSchema>;
