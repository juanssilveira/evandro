import { z } from "zod";

export const playerConfigSchema = z.object({
  version: z.literal(1).default(1),

  playback: z
    .object({
      autoplay: z.boolean().default(false),
      backgroundAutoplay: z.boolean().default(false),
    })
    .default({
      autoplay: false,
      backgroundAutoplay: false,
    }),

  controls: z
    .object({
      hidden: z.boolean().default(false),
      fullscreen: z
        .object({
          enabled: z.boolean().default(true),
          button: z.boolean().default(true),
          doubleClick: z.boolean().default(true),
          keyboardF: z.boolean().default(true),
        })
        .default({
          enabled: true,
          button: true,
          doubleClick: true,
          keyboardF: true,
        }),
    })
    .default({
      hidden: false,
      fullscreen: {
        enabled: true,
        button: true,
        doubleClick: true,
        keyboardF: true,
      },
    }),

  progress: z
    .object({
      fake: z
        .object({
          enabled: z.boolean().default(false),
          targetPercent: z.number().default(0.85),
          targetSeconds: z.number().default(10),
        })
        .default({
          enabled: false,
          targetPercent: 0.85,
          targetSeconds: 10,
        }),
    })
    .default({
      fake: {
        enabled: false,
        targetPercent: 0.85,
        targetSeconds: 10,
      },
    }),

  development: z
    .object({
      debug: z.boolean().default(false),
    })
    .default({
      debug: false,
    }),
});

export type PlayerConfig = z.infer<typeof playerConfigSchema>;

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type PlayerConfigPatch = DeepPartial<PlayerConfig>;

export const DEFAULT_PLAYER_CONFIG: PlayerConfig = {
  version: 1,

  playback: {
    autoplay: false,
    backgroundAutoplay: false,
  },

  controls: {
    hidden: false,
    fullscreen: {
      enabled: true,
      button: true,
      doubleClick: true,
      keyboardF: true,
    },
  },

  progress: {
    fake: {
      enabled: false,
      targetPercent: 0.85,
      targetSeconds: 10,
    },
  },

  development: {
    debug: false,
  },
};

export function parsePlayerConfig(input: unknown): PlayerConfig {
  const result = playerConfigSchema.safeParse(input);
  if (result.success) {
    return result.data;
  }
  return DEFAULT_PLAYER_CONFIG;
}
