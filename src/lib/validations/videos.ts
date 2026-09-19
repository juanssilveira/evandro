import { z } from "zod";
import { playerAccentColors, fakeProgressBarColors } from "@/types/player-config";

export const createUploadSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "O título é obrigatório")
    .max(120, "O título deve ter no máximo 120 caracteres"),
  filename: z.string().min(1, "Nome do arquivo é obrigatório"),
  mimeType: z.literal("video/mp4", {
    message: "Apenas arquivos MP4 (video/mp4) são permitidos",
  }),
  sizeBytes: z.number().positive("Tamanho do arquivo deve ser maior que zero"),
  folderId: z.string().uuid("ID de pasta inválido").nullable().optional(),
});

export type CreateUploadInput = z.infer<typeof createUploadSchema>;


export const syncVideoStatusSchema = z.object({
  videoId: z.string().uuid("ID de vídeo inválido"),
});

export type SyncVideoStatusInput = z.infer<typeof syncVideoStatusSchema>;

export const updatePlayerConfigActionSchema = z.object({
  videoId: z.string().uuid("ID de vídeo inválido"),
  config: z.object({
    appearance: z
      .object({
        accentColor: z.enum(playerAccentColors).optional(),
        aspectRatio: z.enum(["16:9", "9:16", "1:1"]).optional(),
        showTitle: z.boolean().optional(),
        borderRadius: z.number().min(0).max(32).optional(),
        thumbnail: z
          .object({
            enabled: z.boolean().optional(),
            source: z.enum(["provider", "custom"]).optional(),
            customUrl: z.string().nullable().optional(),
            customKey: z.string().nullable().optional(),
            customAspectRatio: z.enum(["16:9", "9:16", "1:1"]).nullable().optional(),
            showPlayButton: z.boolean().optional(),
          })
          .optional(),
        pauseThumbnail: z
          .object({
            enabled: z.boolean().optional(),
            customUrl: z.string().nullable().optional(),
            customKey: z.string().nullable().optional(),
            customAspectRatio: z.enum(["16:9", "9:16", "1:1"]).nullable().optional(),
            showPlayButton: z.boolean().optional(),
          })
          .optional(),
      })
      .optional(),
    playback: z
      .object({
        autoplay: z.boolean().optional(),
        backgroundAutoplay: z.boolean().optional(),
        persistentResume: z.boolean().optional(),
        defaultPlaybackRate: z.number().min(0.25).max(4).optional(),
        defaultVolume: z.number().min(0).max(1).optional(),
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
            height: z.number().min(2).max(10).optional(),
            color: z.enum(fakeProgressBarColors).optional(),
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

export const updateVideoTitleSchema = z.object({
  videoId: z.string().uuid("ID de vídeo inválido"),
  title: z
    .string()
    .trim()
    .min(1, "O título é obrigatório")
    .max(120, "O título deve ter no máximo 120 caracteres"),
});

export type UpdateVideoTitleInput = z.infer<typeof updateVideoTitleSchema>;

export const deleteVideoSchema = z.object({
  videoId: z.string().uuid("ID de vídeo inválido"),
});

export type DeleteVideoInput = z.infer<typeof deleteVideoSchema>;

export const uploadPlayerThumbnailSchema = z.object({
  videoId: z.string().uuid("ID de vídeo inválido"),
  kind: z.enum(["startup", "pause"]),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]),
});

export type UploadPlayerThumbnailInput = z.infer<typeof uploadPlayerThumbnailSchema>;

export const removePlayerThumbnailSchema = z.object({
  videoId: z.string().uuid("ID de vídeo inválido"),
  kind: z.enum(["startup", "pause"]),
});

export type RemovePlayerThumbnailInput = z.infer<typeof removePlayerThumbnailSchema>;

