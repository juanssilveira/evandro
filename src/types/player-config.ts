import { z } from "zod";

export const playerAccentColors = [
  "purple",
  "blue",
  "emerald",
  "orange",
  "rose",
  "black",
  "white",
  "gray",
] as const;

export type PlayerAccentColor = (typeof playerAccentColors)[number];

export interface PlayerAccentTokens {
  base: string;
  hover: string;
  active: string;
  soft: string;
  foreground: string;
}

export interface PlayerAccentPreset {
  name: string;
  tokens: PlayerAccentTokens;
}

export const PLAYER_ACCENT_PRESETS: Record<PlayerAccentColor, PlayerAccentPreset> = {
  purple: {
    name: "Roxo",
    tokens: {
      base: "#7C3AED",
      hover: "#6D28D9",
      active: "#5B21B6",
      soft: "rgba(124, 58, 237, 0.15)",
      foreground: "#FFFFFF",
    },
  },
  blue: {
    name: "Azul",
    tokens: {
      base: "#2563EB",
      hover: "#1D4ED8",
      active: "#1E40AF",
      soft: "rgba(37, 99, 235, 0.15)",
      foreground: "#FFFFFF",
    },
  },
  emerald: {
    name: "Esmeralda",
    tokens: {
      base: "#059669",
      hover: "#047857",
      active: "#065F46",
      soft: "rgba(5, 150, 105, 0.15)",
      foreground: "#FFFFFF",
    },
  },
  orange: {
    name: "Laranja",
    tokens: {
      base: "#EA580C",
      hover: "#C2410C",
      active: "#9A3412",
      soft: "rgba(234, 88, 12, 0.15)",
      foreground: "#FFFFFF",
    },
  },
  rose: {
    name: "Rosa",
    tokens: {
      base: "#E11D48",
      hover: "#BE123C",
      active: "#9F1239",
      soft: "rgba(225, 29, 72, 0.15)",
      foreground: "#FFFFFF",
    },
  },
  black: {
    name: "Preto",
    tokens: {
      base: "#18181B",
      hover: "#27272A",
      active: "#09090B",
      soft: "rgba(24, 24, 27, 0.15)",
      foreground: "#FFFFFF",
    },
  },
  white: {
    name: "Branco",
    tokens: {
      base: "#FFFFFF",
      hover: "#F4F4F5",
      active: "#E4E4E7",
      soft: "rgba(255, 255, 255, 0.2)",
      foreground: "#09090B",
    },
  },
  gray: {
    name: "Cinza",
    tokens: {
      base: "#71717A",
      hover: "#52525B",
      active: "#3F3F46",
      soft: "rgba(113, 113, 122, 0.15)",
      foreground: "#FFFFFF",
    },
  },
};

export const fakeProgressBarColors = [
  "accent",
  "purple",
  "blue",
  "emerald",
  "orange",
  "rose",
  "black",
  "white",
  "gray",
] as const;

export type FakeProgressBarColor = (typeof fakeProgressBarColors)[number];

export const playerAspectRatios = ["16:9", "9:16", "1:1"] as const;
export type PlayerAspectRatio = (typeof playerAspectRatios)[number];

export const playerPlaybackRates = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
export type PlaybackRate = (typeof playerPlaybackRates)[number];

export const playerConfigSchema = z.object({
  version: z.literal(1).default(1),

  appearance: z
    .object({
      accentColor: z.enum(playerAccentColors).default("purple"),
      aspectRatio: z.enum(playerAspectRatios).default("16:9"),
      showTitle: z.boolean().default(true),
      borderRadius: z.number().min(0).max(32).default(12),
      thumbnail: z
        .object({
          enabled: z.boolean().default(true),
        })
        .default({
          enabled: true,
        }),
    })
    .default({
      accentColor: "purple",
      aspectRatio: "16:9",
      showTitle: true,
      borderRadius: 12,
      thumbnail: {
        enabled: true,
      },
    }),

  playback: z
    .object({
      autoplay: z.boolean().default(false),
      backgroundAutoplay: z.boolean().default(false),
      defaultPlaybackRate: z.number().min(0.25).max(4).default(1),
      defaultVolume: z.number().min(0).max(1).default(1),
    })
    .default({
      autoplay: false,
      backgroundAutoplay: false,
      defaultPlaybackRate: 1,
      defaultVolume: 1,
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
          height: z.number().min(2).max(10).default(4),
          color: z.enum(fakeProgressBarColors).default("accent"),
        })
        .default({
          enabled: false,
          height: 4,
          color: "accent",
        }),
    })
    .default({
      fake: {
        enabled: false,
        height: 4,
        color: "accent",
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

  appearance: {
    accentColor: "purple",
    aspectRatio: "16:9",
    showTitle: true,
    borderRadius: 12,
    thumbnail: {
      enabled: true,
    },
  },

  playback: {
    autoplay: false,
    backgroundAutoplay: false,
    defaultPlaybackRate: 1,
    defaultVolume: 1,
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
      height: 4,
      color: "accent",
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
