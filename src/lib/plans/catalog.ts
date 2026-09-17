export interface PlanLimits {
  maxVideos: number;
  maxPlaysPerMonth: number;
  maxVideoDurationSeconds: number;
  maxPlaybackResolution: number;
}

export interface PlanDefinition {
  code: "pro";
  name: string;
  limits: PlanLimits;
}

export const PRO_PLAN: PlanDefinition = {
  code: "pro",
  name: "Pro",
  limits: {
    maxVideos: 10,
    maxPlaysPerMonth: 5000,
    maxVideoDurationSeconds: 1200, // 20 minutes
    maxPlaybackResolution: 1080,
  },
} as const;

export const PLANS = {
  pro: PRO_PLAN,
} as const;

export type PlanCode = keyof typeof PLANS;

export function getPlanByCode(code: string): PlanDefinition | null {
  if (code in PLANS) {
    return PLANS[code as PlanCode];
  }
  return null;
}
