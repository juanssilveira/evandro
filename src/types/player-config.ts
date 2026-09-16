import { z } from "zod";

export const playerAccentColors = [
  "purple",
  "blue",
  "emerald",
  "orange",
  "rose",
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
};

export const playerConfigSchema = z.object({
  version: z.literal(1).default(1),

  appearance: z
    .object({
      accentColor: z.enum(playerAccentColors).default("purple"),
    })
    .default({
      accentColor: "purple",
    }),

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

  appearance: {
    accentColor: "purple",
  },

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
