import type { FolderColor } from "@/db/schema/folders";

export interface FolderColorConfig {
  id: FolderColor;
  label: string;
  iconClass: string;
  badgeClass: string;
  dotClass: string;
  swatchBg: string;
  swatchBorder: string;
}

export const FOLDER_COLOR_CONFIGS: Record<FolderColor, FolderColorConfig> = {
  gray: {
    id: "gray",
    label: "Cinza",
    iconClass:
      "text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700/60",
    badgeClass: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    dotClass: "bg-zinc-400",
    swatchBg: "bg-zinc-400 dark:bg-zinc-500",
    swatchBorder: "border-zinc-400",
  },
  violet: {
    id: "violet",
    label: "Roxo",
    iconClass:
      "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-900/60",
    badgeClass: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
    dotClass: "bg-violet-500",
    swatchBg: "bg-violet-500",
    swatchBorder: "border-violet-500",
  },
  blue: {
    id: "blue",
    label: "Azul",
    iconClass:
      "text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-900/60",
    badgeClass: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
    dotClass: "bg-sky-500",
    swatchBg: "bg-sky-500",
    swatchBorder: "border-sky-500",
  },
  green: {
    id: "green",
    label: "Verde",
    iconClass:
      "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60",
    badgeClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    dotClass: "bg-emerald-500",
    swatchBg: "bg-emerald-500",
    swatchBorder: "border-emerald-500",
  },
  orange: {
    id: "orange",
    label: "Laranja",
    iconClass:
      "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60",
    badgeClass: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    dotClass: "bg-amber-500",
    swatchBg: "bg-amber-500",
    swatchBorder: "border-amber-500",
  },
};
