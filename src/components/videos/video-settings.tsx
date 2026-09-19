"use client";

import * as React from "react";
import { useTransition, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { updatePlayerConfigAction } from "@/app/actions/videos";
import { useToast } from "@/components/ui/toast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { PlayerThumbnailUploader } from "./player-thumbnail-uploader";
import {
  PlayCircle,
  Play,
  Loader2,
  VolumeX,
  Palette,
  Check,
  SlidersHorizontal,
  Maximize2,
  EyeOff,
  MousePointerClick,
  Keyboard,
  Sparkles,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type PlayerConfig,
  type PlayerConfigPatch,
  type PlayerAccentColor,
  type PlayerAspectRatio,
  type FakeProgressBarColor,
  playerAccentColors,
  playerPlaybackRates,
  PLAYER_ACCENT_PRESETS,
} from "@/types/player-config";

export type VideoSettingsTabId = "appearance" | "playback" | "controls";

export interface VideoSettingsTab {
  id: VideoSettingsTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  badge: string;
  description: string;
}

export const SETTINGS_TABS: readonly VideoSettingsTab[] = [
  {
    id: "appearance",
    label: "Aparência",
    icon: Palette,
    title: "Aparência",
    badge: "Personalização",
    description: "Personalize a identidade visual e o formato de exibição do player para o seu conteúdo.",
  },
  {
    id: "playback",
    label: "Reprodução",
    icon: PlayCircle,
    title: "Reprodução & Progresso",
    badge: "Comportamento",
    description: "Configure o início automático, velocidade, volume e a barra de progresso inteligente.",
  },
  {
    id: "controls",
    label: "Controles",
    icon: SlidersHorizontal,
    title: "Controles",
    badge: "Interface & Ações",
    description: "Configure a visibilidade da barra de controles e as opções de tela cheia.",
  },
] as const;

interface VideoSettingsProps {
  videoId: string;
  config: PlayerConfig;
  onConfigChange: (config: PlayerConfig) => void;
  defaultTab?: VideoSettingsTabId;
  activeTab?: VideoSettingsTabId;
  onTabChange?: (tab: VideoSettingsTabId) => void;
}

export function VideoSettings({
  videoId,
  config,
  onConfigChange,
  defaultTab = "appearance",
  activeTab: activeTabProp,
  onTabChange,
}: VideoSettingsProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [pendingField, setPendingField] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const tabParam = searchParams?.get("tab");
  const tabFromUrl = React.useMemo<VideoSettingsTabId | null>(() => {
    if (!tabParam) return null;
    const lower = tabParam.toLowerCase().trim();
    if (lower === "appearance" || lower === "aparencia" || lower === "aparência") return "appearance";
    if (lower === "playback" || lower === "reproducao" || lower === "reprodução") return "playback";
    if (lower === "controls" || lower === "controles") return "controls";
    return null;
  }, [tabParam]);

  const [uncontrolledTab, setUncontrolledTab] = useState<VideoSettingsTabId>(defaultTab);
  const activeTab = activeTabProp ?? tabFromUrl ?? uncontrolledTab;

  const handleTabSelect = (tabId: VideoSettingsTabId) => {
    if (activeTabProp === undefined) {
      setUncontrolledTab(tabId);
    }
    onTabChange?.(tabId);

    try {
      const currentParams = new URLSearchParams(searchParams?.toString() || "");
      if (currentParams.get("tab") !== tabId) {
        currentParams.set("tab", tabId);
        const newUrl = `${pathname}?${currentParams.toString()}`;
        if (typeof window !== "undefined" && window.history?.replaceState) {
          window.history.replaceState(null, "", newUrl);
        }
        router.replace(newUrl, { scroll: false });
      }
    } catch {
      // safe fallback
    }
  };

  const handleTabKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    currentTabId: VideoSettingsTabId
  ) => {
    const currentIndex = SETTINGS_TABS.findIndex((t) => t.id === currentTabId);
    if (currentIndex === -1) return;

    let targetIndex = -1;

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      targetIndex = (currentIndex + 1) % SETTINGS_TABS.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      targetIndex = (currentIndex - 1 + SETTINGS_TABS.length) % SETTINGS_TABS.length;
    } else if (e.key === "Home") {
      e.preventDefault();
      targetIndex = 0;
    } else if (e.key === "End") {
      e.preventDefault();
      targetIndex = SETTINGS_TABS.length - 1;
    }

    if (targetIndex !== -1) {
      const nextTab = SETTINGS_TABS[targetIndex];
      handleTabSelect(nextTab.id);
      const tabElement = document.getElementById(`tab-${nextTab.id}`);
      tabElement?.focus();
    }
  };

  const handleConfigUpdate = (patch: PlayerConfigPatch, fieldKey: string) => {
    const previousConfig = config;
    const nextConfig: PlayerConfig = {
      ...config,
      appearance: {
        ...config.appearance,
        ...(patch.appearance || {}),
        thumbnail: {
          ...config.appearance?.thumbnail,
          ...(patch.appearance?.thumbnail || {}),
        },
        pauseThumbnail: {
          ...config.appearance?.pauseThumbnail,
          ...(patch.appearance?.pauseThumbnail || {}),
        },
      },
      playback: {
        ...config.playback,
        ...(patch.playback || {}),
      },
      controls: {
        ...config.controls,
        ...(patch.controls || {}),
        fullscreen: {
          ...config.controls?.fullscreen,
          ...(patch.controls?.fullscreen || {}),
        },
      },
      progress: {
        ...config.progress,
        ...(patch.progress || {}),
        fake: {
          ...config.progress?.fake,
          ...(patch.progress?.fake || {}),
        },
      },
      development: {
        ...config.development,
        ...(patch.development || {}),
      },
    };

    onConfigChange(nextConfig);
    setPendingField(fieldKey);
    setError(null);

    startTransition(async () => {
      const result = await updatePlayerConfigAction({
        videoId,
        config: patch,
      });

      setPendingField(null);

      if (result.error) {
        onConfigChange(previousConfig);
        setError(result.error);
        toast(result.error, "error");
      } else if (result.config) {
        onConfigChange(result.config as PlayerConfig);
        toast("Alterações salvas", "success");
      }
    });
  };

  const handleBackgroundAutoplayToggle = (checked: boolean) => {
    handleConfigUpdate(
      {
        playback: {
          backgroundAutoplay: checked,
          autoplay: false,
        },
      },
      "backgroundAutoplay"
    );
  };

  const handlePlaybackRateSelect = (rate: number) => {
    if (config.playback?.defaultPlaybackRate === rate) return;
    handleConfigUpdate(
      {
        playback: {
          defaultPlaybackRate: rate,
        },
      },
      "defaultPlaybackRate"
    );
  };

  const handleVolumeChange = (val: number) => {
    handleConfigUpdate(
      {
        playback: {
          defaultVolume: val,
        },
      },
      "defaultVolume"
    );
  };

  const handleAccentColorSelect = (color: PlayerAccentColor) => {
    if (config.appearance?.accentColor === color) return;

    handleConfigUpdate(
      {
        appearance: {
          accentColor: color,
        },
      },
      "accentColor"
    );
  };

  const handleAspectRatioSelect = (ratio: PlayerAspectRatio) => {
    if (config.appearance?.aspectRatio === ratio) return;

    handleConfigUpdate(
      {
        appearance: {
          aspectRatio: ratio,
        },
      },
      "aspectRatio"
    );
  };

  const handleBorderRadiusChange = (radius: number) => {
    handleConfigUpdate(
      {
        appearance: {
          borderRadius: radius,
        },
      },
      "borderRadius"
    );
  };

  const handleFakeColorSelect = (color: FakeProgressBarColor) => {
    if (config.progress?.fake?.color === color) return;

    handleConfigUpdate(
      {
        progress: {
          fake: {
            color,
          },
        },
      },
      "fakeColor"
    );
  };

  const currentAccent = config.appearance?.accentColor ?? "purple";
  const currentAspectRatio = config.appearance?.aspectRatio ?? "16:9";
  const currentBorderRadius = config.appearance?.borderRadius ?? 12;
  const currentPlaybackRate = config.playback?.defaultPlaybackRate ?? 1;
  const currentVolume = config.playback?.defaultVolume ?? 1;
  const isFullscreenEnabled = config.controls?.fullscreen?.enabled ?? true;
  const currentFakeHeight = config.progress?.fake?.height ?? 4;
  const currentFakeColor: FakeProgressBarColor = config.progress?.fake?.color ?? "accent";
  const isFakeProgressEnabled = config.progress?.fake?.enabled ?? false;

  const [prevConfigRadius, setPrevConfigRadius] = useState(currentBorderRadius);
  const [localRadius, setLocalRadius] = useState(currentBorderRadius);

  if (currentBorderRadius !== prevConfigRadius) {
    setPrevConfigRadius(currentBorderRadius);
    setLocalRadius(currentBorderRadius);
  }

  const [prevConfigVolume, setPrevConfigVolume] = useState(currentVolume);
  const [localVolume, setLocalVolume] = useState(currentVolume);

  if (currentVolume !== prevConfigVolume) {
    setPrevConfigVolume(currentVolume);
    setLocalVolume(currentVolume);
  }

  const [prevConfigRate, setPrevConfigRate] = useState(currentPlaybackRate);
  const [customRateInput, setCustomRateInput] = useState<string>(String(currentPlaybackRate));

  if (currentPlaybackRate !== prevConfigRate) {
    setPrevConfigRate(currentPlaybackRate);
    setCustomRateInput(String(currentPlaybackRate));
  }

  const handleCustomRateBlurOrSubmit = () => {
    const parsed = parseFloat(customRateInput);
    if (!isNaN(parsed) && parsed >= 0.25 && parsed <= 4) {
      const rounded = Math.round(parsed * 100) / 100;
      handlePlaybackRateSelect(rounded);
    } else {
      setCustomRateInput(String(currentPlaybackRate));
    }
  };

  const currentCategory = SETTINGS_TABS.find((t) => t.id === activeTab) ?? SETTINGS_TABS[0];
  const CategoryIcon = currentCategory.icon;

  return (
    <Card className="border-border bg-card shadow-xs rounded-xl overflow-hidden min-w-0">
      {/* Category Tabs Header Bar */}
      <div className="border-b border-border/70 bg-muted/25 p-1.5 sm:p-2">
        <div
          role="tablist"
          aria-label="Categorias de configuração"
          className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {SETTINGS_TABS.map((tab) => {
            const isSelected = activeTab === tab.id;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                role="tab"
                type="button"
                aria-selected={isSelected}
                aria-controls={`tabpanel-${tab.id}`}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => handleTabSelect(tab.id)}
                onKeyDown={(e) => handleTabKeyDown(e, tab.id)}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-1.5 sm:py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer select-none shrink-0",
                  isSelected
                    ? "bg-card text-foreground font-semibold shadow-xs border border-border/80"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/40 border border-transparent"
                )}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0 transition-colors",
                    isSelected ? "text-primary" : "text-muted-foreground"
                  )}
                />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Category Subheader */}
      <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-border/40 bg-card">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-7 rounded-md bg-muted text-foreground flex items-center justify-center shrink-0 border border-border/80">
              <CategoryIcon className="size-3.5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground leading-tight">
                {currentCategory.title}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed truncate sm:whitespace-normal">
                {currentCategory.description}
              </p>
            </div>
          </div>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border border-border/60 uppercase tracking-wide shrink-0">
            {currentCategory.badge}
          </span>
        </div>
      </div>

      {/* Tab Panels */}
      <div
        id={`tabpanel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        className="p-4 sm:p-5 space-y-3.5 focus:outline-none min-w-0"
      >
        {/* Tab 1: Aparência */}
        {activeTab === "appearance" && (
          <>
            {/* Aspect Ratio Section */}
            <div className="rounded-lg border border-border/80 bg-muted/20 pt-3 px-3.5 pb-3.5 sm:pt-3 sm:px-4 sm:pb-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Formato do player
                  </Label>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Define a proporção e as dimensões padrão do container de reprodução.
                  </p>
                </div>
                {isPending && pendingField === "aspectRatio" && (
                  <Loader2 className="size-3.5 animate-spin text-muted-foreground shrink-0" />
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-0.5">
                {/* Horizontal 16:9 Option */}
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleAspectRatioSelect("16:9")}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-all text-left cursor-pointer",
                    currentAspectRatio === "16:9"
                      ? "border-primary/50 bg-primary/[0.03] ring-1 ring-primary/20 shadow-xs"
                      : "border-border/60 bg-card hover:bg-muted/40 hover:border-border/80"
                  )}
                >
                  <div
                    className={cn(
                      "w-10 h-6 rounded border flex items-center justify-center shrink-0 transition-colors shadow-2xs",
                      currentAspectRatio === "16:9"
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border bg-zinc-800 text-zinc-400"
                    )}
                  >
                    <Play className="size-2.5 fill-current ml-0.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          currentAspectRatio === "16:9" ? "text-foreground font-bold" : "text-foreground/90"
                        )}
                      >
                        16:9
                      </span>
                      {currentAspectRatio === "16:9" && (
                        <span className="flex size-3.5 items-center justify-center rounded-full bg-primary text-white shrink-0">
                          <Check className="size-2 stroke-[3]" />
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5 whitespace-nowrap">
                      Horizontal
                    </p>
                  </div>
                </button>

                {/* Vertical 9:16 Option */}
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleAspectRatioSelect("9:16")}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-all text-left cursor-pointer",
                    currentAspectRatio === "9:16"
                      ? "border-primary/50 bg-primary/[0.03] ring-1 ring-primary/20 shadow-xs"
                      : "border-border/60 bg-card hover:bg-muted/40 hover:border-border/80"
                  )}
                >
                  <div
                    className={cn(
                      "w-6 h-10 rounded border flex items-center justify-center shrink-0 transition-colors shadow-2xs",
                      currentAspectRatio === "9:16"
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border bg-zinc-800 text-zinc-400"
                    )}
                  >
                    <Play className="size-2.5 fill-current ml-0.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          currentAspectRatio === "9:16" ? "text-foreground font-bold" : "text-foreground/90"
                        )}
                      >
                        9:16
                      </span>
                      {currentAspectRatio === "9:16" && (
                        <span className="flex size-3.5 items-center justify-center rounded-full bg-primary text-white shrink-0">
                          <Check className="size-2 stroke-[3]" />
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5 whitespace-nowrap">
                      Vertical
                    </p>
                  </div>
                </button>

                {/* Square 1:1 Option */}
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleAspectRatioSelect("1:1")}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-all text-left cursor-pointer",
                    currentAspectRatio === "1:1"
                      ? "border-primary/50 bg-primary/[0.03] ring-1 ring-primary/20 shadow-xs"
                      : "border-border/60 bg-card hover:bg-muted/40 hover:border-border/80"
                  )}
                >
                  <div
                    className={cn(
                      "size-8 rounded border flex items-center justify-center shrink-0 transition-colors shadow-2xs",
                      currentAspectRatio === "1:1"
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border bg-zinc-800 text-zinc-400"
                    )}
                  >
                    <Play className="size-2.5 fill-current ml-0.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          currentAspectRatio === "1:1" ? "text-foreground font-bold" : "text-foreground/90"
                        )}
                      >
                        1:1
                      </span>
                      {currentAspectRatio === "1:1" && (
                        <span className="flex size-3.5 items-center justify-center rounded-full bg-primary text-white shrink-0">
                          <Check className="size-2 stroke-[3]" />
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5 whitespace-nowrap">
                      Quadrado
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Accent Color Section */}
            <div className="rounded-lg border border-border/80 bg-muted/20 pt-3 px-3.5 pb-3.5 sm:pt-3 sm:px-4 sm:pb-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Cor de destaque
                  </Label>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Aplica a cor na barra de progresso, botão de play, volume e indicadores ativos.
                  </p>
                </div>
                {isPending && pendingField === "accentColor" && (
                  <Loader2 className="size-3.5 animate-spin text-muted-foreground shrink-0" />
                )}
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 pt-0.5">
                {playerAccentColors.map((colorKey) => {
                  const preset = PLAYER_ACCENT_PRESETS[colorKey];
                  const isSelected = currentAccent === colorKey;

                  return (
                    <button
                      key={colorKey}
                      type="button"
                      disabled={isPending}
                      onClick={() => handleAccentColorSelect(colorKey)}
                      className={cn(
                        "group relative flex flex-col items-center justify-center gap-1.5 py-2.5 px-1.5 rounded-lg border transition-all text-center cursor-pointer select-none",
                        isSelected
                          ? "border-border-strong bg-card shadow-xs ring-1 ring-border"
                          : "border-border/60 bg-card/60 hover:bg-muted/50 hover:border-border"
                      )}
                    >
                      {/* Color Swatch Circle */}
                      <div className="relative flex items-center justify-center shrink-0">
                        <div
                          className={cn(
                            "size-5.5 rounded-full shrink-0 flex items-center justify-center transition-transform group-hover:scale-105",
                            colorKey === "white"
                              ? "border border-zinc-300 dark:border-zinc-700 shadow-2xs"
                              : "border border-black/10 dark:border-white/10 shadow-inner",
                            isSelected && "ring-2 ring-offset-2 ring-offset-background",
                            isSelected && colorKey === "white" && "ring-zinc-400 dark:ring-zinc-500",
                            isSelected && colorKey !== "white" && "ring-current"
                          )}
                          style={{
                            backgroundColor: preset.tokens.base,
                            color: preset.tokens.base,
                          }}
                        >
                          {isSelected && (
                            <Check
                              className={cn(
                                "size-3 stroke-[3]",
                                colorKey === "white" ? "text-zinc-900" : "text-white"
                              )}
                            />
                          )}
                        </div>
                      </div>

                      {/* Label */}
                      <span
                        className={cn(
                          "text-[11px] leading-tight truncate max-w-full px-0.5 transition-colors",
                          isSelected ? "text-foreground font-semibold" : "text-muted-foreground font-normal"
                        )}
                      >
                        {preset.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Border Radius Section */}
            <div className="rounded-lg border border-border/80 bg-muted/20 pt-3 px-3.5 pb-3.5 sm:pt-3 sm:px-4 sm:pb-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label
                    htmlFor={`border-radius-range-${videoId}`}
                    className="text-xs font-semibold text-foreground cursor-pointer"
                  >
                    Arredondamento do player
                  </Label>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Define o arredondamento dos cantos do vídeo.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isPending && pendingField === "borderRadius" && (
                    <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                  )}
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-semibold bg-muted text-foreground border border-border/70">
                    {localRadius} px
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-mono text-muted-foreground w-6 text-right">0px</span>
                  <input
                    id={`border-radius-range-${videoId}`}
                    type="range"
                    min={0}
                    max={32}
                    step={2}
                    value={localRadius}
                    disabled={isPending}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (!isNaN(val) && val >= 0 && val <= 32) {
                        setLocalRadius(val);
                        onConfigChange({
                          ...config,
                          appearance: {
                            ...config.appearance,
                            borderRadius: val,
                          },
                        });
                      }
                    }}
                    onPointerUp={(e) => {
                      const val = Number((e.target as HTMLInputElement).value);
                      handleBorderRadiusChange(val);
                    }}
                    onKeyUp={(e) => {
                      if (e.key.startsWith("Arrow") || e.key === "Home" || e.key === "End") {
                        const val = Number((e.target as HTMLInputElement).value);
                        handleBorderRadiusChange(val);
                      }
                    }}
                    className="flex-1 accent-primary h-1.5 bg-muted rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                  />
                  <span className="text-[11px] font-mono text-muted-foreground w-8">32px</span>
                </div>

                {/* Quick Presets */}
                <div className="grid grid-cols-6 gap-1.5 pt-1">
                  {[0, 8, 12, 16, 24, 32].map((r) => (
                    <button
                      key={r}
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        if (currentBorderRadius === r) return;
                        setLocalRadius(r);
                        handleBorderRadiusChange(r);
                      }}
                      className={cn(
                        "py-1 px-1 text-[11px] font-mono rounded-md border transition-all text-center cursor-pointer",
                        currentBorderRadius === r
                          ? "border-primary/50 bg-primary/[0.03] ring-1 ring-primary/20 text-foreground font-semibold shadow-2xs"
                          : "border-border/60 bg-card hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {r}px{r === 12 ? " (padrão)" : ""}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Startup Thumbnail Section */}
            <PlayerThumbnailUploader
              videoId={videoId}
              kind="startup"
              currentAspectRatio={currentAspectRatio}
              config={config}
              isPending={isPending}
              onConfigChange={onConfigChange}
              onConfigUpdate={handleConfigUpdate}
              pendingField={pendingField}
            />

            {/* Pause Thumbnail Section */}
            <PlayerThumbnailUploader
              videoId={videoId}
              kind="pause"
              currentAspectRatio={currentAspectRatio}
              config={config}
              isPending={isPending}
              onConfigChange={onConfigChange}
              onConfigUpdate={handleConfigUpdate}
              pendingField={pendingField}
            />

            {/* Show Video Title Toggle */}
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border/80 bg-muted/20 py-3 px-3.5 sm:py-3 sm:px-4">
              <div className="space-y-1">
                <Label
                  htmlFor={`show-title-switch-${videoId}`}
                  className="text-xs font-semibold text-foreground cursor-pointer block"
                >
                  Exibir título do vídeo
                </Label>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Mostra o título no topo do player durante a reprodução.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isPending && pendingField === "showTitle" && (
                  <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                )}
                <Switch
                  id={`show-title-switch-${videoId}`}
                  checked={config.appearance?.showTitle ?? true}
                  disabled={isPending}
                  onCheckedChange={(checked) =>
                    handleConfigUpdate(
                      {
                        appearance: {
                          showTitle: checked,
                        },
                      },
                      "showTitle"
                    )
                  }
                />
              </div>
            </div>
          </>
        )}

        {/* Tab 2: Reprodução */}
        {activeTab === "playback" && (
          <>
            {/* Persistent Resume Toggle */}
            <div className="flex items-start justify-between gap-4 rounded-lg border border-border/80 bg-muted/20 py-3 px-3.5 sm:py-3.5 sm:px-4">
              <div className="flex items-start gap-3">
                <div className="size-8 rounded-md bg-muted text-muted-foreground flex items-center justify-center shrink-0 mt-0.5">
                  <History className="size-4" />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor={`persistent-resume-switch-${videoId}`}
                    className="text-xs font-semibold text-foreground cursor-pointer block leading-none"
                  >
                    Retomar reprodução
                  </Label>
                  <p className="text-[11px] text-muted-foreground leading-relaxed max-w-xl">
                    Ao retornar, o espectador pode continuar de onde parou ou assistir novamente desde o início.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 pt-0.5">
                {isPending && pendingField === "persistentResume" && (
                  <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                )}
                <Switch
                  id={`persistent-resume-switch-${videoId}`}
                  checked={config.playback.persistentResume ?? true}
                  disabled={isPending}
                  onCheckedChange={(checked) =>
                    handleConfigUpdate(
                      {
                        playback: {
                          persistentResume: checked,
                        },
                      },
                      "persistentResume"
                    )
                  }
                />
              </div>
            </div>

            {/* Background Autoplay Toggle */}
            <div className="flex items-start justify-between gap-4 rounded-lg border border-border/80 bg-muted/20 py-3 px-3.5 sm:py-3.5 sm:px-4">
              <div className="flex items-start gap-3">
                <div className="size-8 rounded-md bg-muted text-muted-foreground flex items-center justify-center shrink-0 mt-0.5">
                  <VolumeX className="size-4" />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor={`background-autoplay-switch-${videoId}`}
                    className="text-xs font-semibold text-foreground cursor-pointer block leading-none"
                  >
                    Background Autoplay
                  </Label>
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 tracking-wide uppercase">
                      Conta View
                    </span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-semibold bg-muted text-muted-foreground border border-border/60 tracking-wide uppercase">
                      Não Conta Play
                    </span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-semibold bg-muted/50 text-muted-foreground/80 border border-border/40 tracking-wide uppercase">
                      Sem Som
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed max-w-xl">
                    Exibe uma prévia do vídeo automaticamente, em loop e sem som, até o espectador iniciar a reprodução.
                  </p>
                  <p className="text-[10.5px] text-muted-foreground/75 leading-relaxed">
                    Ajuda a gerar percepção de movimento sem iniciar o Play principal.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 pt-0.5">
                {isPending && pendingField === "backgroundAutoplay" && (
                  <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                )}
                <Switch
                  id={`background-autoplay-switch-${videoId}`}
                  checked={config.playback.backgroundAutoplay}
                  disabled={isPending}
                  onCheckedChange={handleBackgroundAutoplayToggle}
                />
              </div>
            </div>

            {/* Default Playback Rate Section */}
            <div className="rounded-lg border border-border/80 bg-muted/20 pt-3 px-3.5 pb-3.5 sm:pt-3 sm:px-4 sm:pb-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Velocidade padrão
                  </Label>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Define a velocidade inicial com que o vídeo começará a ser reproduzido.
                  </p>
                </div>
                {isPending && pendingField === "defaultPlaybackRate" && (
                  <Loader2 className="size-3.5 animate-spin text-muted-foreground shrink-0" />
                )}
              </div>

              {/* Presets Grid */}
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 pt-0.5">
                {playerPlaybackRates.map((rate) => {
                  const isSelected = currentPlaybackRate === rate;

                  return (
                    <button
                      key={rate}
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        setCustomRateInput(String(rate));
                        handlePlaybackRateSelect(rate);
                      }}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg border transition-all text-center cursor-pointer",
                        isSelected
                          ? "border-primary/50 bg-primary/[0.03] ring-1 ring-primary/20 shadow-xs"
                          : "border-border/60 bg-card hover:bg-muted/40 hover:border-border/80"
                      )}
                    >
                      <span
                        className={cn(
                          "text-xs font-mono font-medium",
                          isSelected ? "text-foreground font-semibold text-primary" : "text-muted-foreground"
                        )}
                      >
                        {rate}x
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Speed Input */}
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/40">
                <span className="text-[11px] text-muted-foreground font-medium">
                  Velocidade customizada
                </span>
                <div className="flex items-center gap-1.5 max-w-[120px]">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min={0.25}
                      max={4}
                      step={0.05}
                      value={customRateInput}
                      disabled={isPending}
                      onChange={(e) => setCustomRateInput(e.target.value)}
                      onBlur={handleCustomRateBlurOrSubmit}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.currentTarget.blur();
                        }
                      }}
                      className="w-full px-2.5 py-1 text-xs font-mono font-semibold bg-background border border-border/80 rounded-md text-foreground text-right pr-6 focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground pointer-events-none">
                      x
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Default Volume Section */}
            <div className="rounded-lg border border-border/80 bg-muted/20 pt-3 px-3.5 pb-3.5 sm:pt-3 sm:px-4 sm:pb-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label
                    htmlFor={`default-volume-range-${videoId}`}
                    className="text-xs font-semibold text-foreground cursor-pointer"
                  >
                    Volume padrão
                  </Label>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Define o nível de volume inicial quando o vídeo principal for ativado.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isPending && pendingField === "defaultVolume" && (
                    <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                  )}
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-semibold bg-muted text-foreground border border-border/70">
                    {localVolume === 0 ? "0% (Mudo)" : `${Math.round(localVolume * 100)}%`}
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-mono text-muted-foreground w-6 text-right">0%</span>
                  <input
                    id={`default-volume-range-${videoId}`}
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={localVolume}
                    disabled={isPending}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (!isNaN(val) && val >= 0 && val <= 1) {
                        const rounded = Math.round(val * 100) / 100;
                        setLocalVolume(rounded);
                        onConfigChange({
                          ...config,
                          playback: {
                            ...config.playback,
                            defaultVolume: rounded,
                          },
                        });
                      }
                    }}
                    onPointerUp={(e) => {
                      const val = Number((e.target as HTMLInputElement).value);
                      const rounded = Math.round(val * 100) / 100;
                      handleVolumeChange(rounded);
                    }}
                    onKeyUp={(e) => {
                      if (e.key.startsWith("Arrow") || e.key === "Home" || e.key === "End") {
                        const val = Number((e.target as HTMLInputElement).value);
                        const rounded = Math.round(val * 100) / 100;
                        handleVolumeChange(rounded);
                      }
                    }}
                    className="flex-1 accent-primary h-1.5 bg-muted rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                  />
                  <span className="text-[11px] font-mono text-muted-foreground w-8">100%</span>
                </div>
              </div>
            </div>

            {/* Sub-section Divider: Barra de Progresso */}
            <div className="pt-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1 bg-border/60" />
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1 flex items-center gap-1.5">
                  <Sparkles className="size-3 text-muted-foreground" />
                  Barra de progresso inteligente
                </span>
                <div className="h-px flex-1 bg-border/60" />
              </div>
            </div>

            {/* Block 1: Barra de progresso inteligente */}
            <div className="rounded-lg border border-border/80 bg-muted/20 pt-3 px-3.5 pb-3.5 sm:pt-3 sm:px-4 sm:pb-4 space-y-2.5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-md bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                    <Sparkles className="size-4 text-primary" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor={`fake-progress-switch-${videoId}`}
                        className="text-xs font-semibold text-foreground cursor-pointer"
                      >
                        Barra de progresso inteligente
                      </Label>
                      <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                        Automático
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isPending && pendingField === "fakeProgress" && (
                    <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                  )}
                  <Switch
                    id={`fake-progress-switch-${videoId}`}
                    checked={isFakeProgressEnabled}
                    disabled={isPending}
                    onCheckedChange={(checked) =>
                      handleConfigUpdate(
                        {
                          progress: {
                            fake: {
                              enabled: checked,
                            },
                          },
                        },
                        "fakeProgress"
                      )
                    }
                  />
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Nosso motor calcula automaticamente uma curva de progresso adaptada à duração do vídeo, acelerando o avanço visual no início e suavizando ao longo da reprodução.
              </p>
            </div>

            {/* Recommendation Banner: Clean experience with fake bar */}
            {isFakeProgressEnabled && !(config.controls?.hidden ?? false) && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Para uma experiência mais limpa com a Barra de progresso inteligente, recomendamos desativar os controles do player.
                </p>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    handleConfigUpdate(
                      {
                        controls: {
                          hidden: true,
                        },
                      },
                      "controlsHidden"
                    )
                  }
                  className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-pressed transition-colors shrink-0 shadow-xs cursor-pointer"
                >
                  Desativar controles
                </button>
              </div>
            )}

            {/* Block 2: Altura da barra */}
            <div
              className={cn(
                "rounded-lg border border-border/80 bg-muted/20 pt-3 px-3.5 pb-3.5 sm:pt-3 sm:px-4 sm:pb-4 space-y-3 transition-opacity",
                !isFakeProgressEnabled && "opacity-50 pointer-events-none select-none"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label
                    htmlFor={`progress-height-range-${videoId}`}
                    className={cn(
                      "text-xs font-semibold text-foreground",
                      isFakeProgressEnabled && "cursor-pointer"
                    )}
                  >
                    Altura da barra
                  </Label>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Define a espessura visual da barra inteligente na borda inferior do player.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isPending && pendingField === "fakeHeight" && (
                    <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                  )}
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-semibold bg-muted text-foreground border border-border/70">
                    {currentFakeHeight} px
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-mono text-muted-foreground w-6 text-right">2px</span>
                  <input
                    id={`progress-height-range-${videoId}`}
                    type="range"
                    min={2}
                    max={10}
                    step={1}
                    value={currentFakeHeight}
                    disabled={isPending || !isFakeProgressEnabled}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (!isNaN(val) && val >= 2 && val <= 10) {
                        handleConfigUpdate(
                          {
                            progress: {
                              fake: {
                                height: val,
                              },
                            },
                          },
                          "fakeHeight"
                        );
                      }
                    }}
                    className={cn(
                      "flex-1 h-2 bg-muted rounded-lg appearance-none accent-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
                      isFakeProgressEnabled ? "cursor-pointer" : "cursor-not-allowed"
                    )}
                  />
                  <span className="text-[11px] font-mono text-muted-foreground w-7">10px</span>
                </div>

                {/* Quick presets */}
                <div className="grid grid-cols-5 gap-1.5 pt-1">
                  {[2, 4, 6, 8, 10].map((h) => (
                    <button
                      key={h}
                      type="button"
                      disabled={isPending || !isFakeProgressEnabled}
                      onClick={() => {
                        if (currentFakeHeight === h) return;
                        handleConfigUpdate(
                          {
                            progress: {
                              fake: {
                                height: h,
                              },
                            },
                          },
                          "fakeHeight"
                        );
                      }}
                      className={cn(
                        "py-1 px-1 text-[11px] font-mono rounded-md border transition-all text-center",
                        isFakeProgressEnabled ? "cursor-pointer" : "cursor-not-allowed",
                        currentFakeHeight === h
                          ? "border-primary/50 bg-primary/[0.03] ring-1 ring-primary/20 text-foreground font-semibold shadow-2xs"
                          : "border-border/60 bg-card hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {h}px{h === 4 ? " (padrão)" : ""}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Block 3: Cor da barra */}
            <div
              className={cn(
                "rounded-lg border border-border/80 bg-muted/20 pt-3 px-3.5 pb-3.5 sm:pt-3 sm:px-4 sm:pb-4 space-y-3 transition-opacity",
                !isFakeProgressEnabled && "opacity-50 pointer-events-none select-none"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Cor da barra
                  </Label>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Personalize a tonalidade da barra de progresso inteligente de forma independente.
                  </p>
                </div>
                {isPending && pendingField === "fakeColor" && (
                  <Loader2 className="size-3.5 animate-spin text-muted-foreground shrink-0" />
                )}
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-9 gap-2 pt-0.5">
                {/* Option 1: Cor principal (accent) */}
                {(() => {
                  const isSelected = currentFakeColor === "accent";
                  const primaryPreset = PLAYER_ACCENT_PRESETS[currentAccent];

                  return (
                    <button
                      type="button"
                      disabled={isPending || !isFakeProgressEnabled}
                      onClick={() => handleFakeColorSelect("accent")}
                      className={cn(
                        "group relative flex flex-col items-center justify-center gap-1.5 py-2.5 px-1 rounded-lg border transition-all text-center cursor-pointer select-none",
                        isSelected
                          ? "border-border-strong bg-card shadow-xs ring-1 ring-border"
                          : "border-border/60 bg-card/60 hover:bg-muted/50 hover:border-border"
                      )}
                    >
                      <div className="relative flex items-center justify-center shrink-0">
                        <div
                          className={cn(
                            "size-5.5 rounded-full shrink-0 flex items-center justify-center transition-transform group-hover:scale-105",
                            currentAccent === "white"
                              ? "border border-zinc-300 dark:border-zinc-700 shadow-2xs"
                              : "border border-black/10 dark:border-white/10 shadow-inner",
                            isSelected && "ring-2 ring-offset-2 ring-offset-background",
                            isSelected && currentAccent === "white" && "ring-zinc-400 dark:ring-zinc-500",
                            isSelected && currentAccent !== "white" && "ring-current"
                          )}
                          style={{
                            backgroundColor: primaryPreset.tokens.base,
                            color: primaryPreset.tokens.base,
                          }}
                        >
                          {isSelected && (
                            <Check
                              className={cn(
                                "size-3 stroke-[3]",
                                currentAccent === "white" ? "text-zinc-900" : "text-white"
                              )}
                            />
                          )}
                        </div>
                      </div>
                      <span
                        className={cn(
                          "text-[10.5px] leading-tight truncate max-w-full px-0.5 transition-colors",
                          isSelected ? "text-foreground font-semibold" : "text-muted-foreground font-normal"
                        )}
                        title="Cor principal"
                      >
                        Principal
                      </span>
                    </button>
                  );
                })()}

                {/* Other preset colors */}
                {playerAccentColors.map((colorKey) => {
                  const preset = PLAYER_ACCENT_PRESETS[colorKey];
                  const isSelected = currentFakeColor === colorKey;

                  return (
                    <button
                      key={colorKey}
                      type="button"
                      disabled={isPending || !isFakeProgressEnabled}
                      onClick={() => handleFakeColorSelect(colorKey)}
                      className={cn(
                        "group relative flex flex-col items-center justify-center gap-1.5 py-2.5 px-1 rounded-lg border transition-all text-center cursor-pointer select-none",
                        isSelected
                          ? "border-border-strong bg-card shadow-xs ring-1 ring-border"
                          : "border-border/60 bg-card/60 hover:bg-muted/50 hover:border-border"
                      )}
                    >
                      <div className="relative flex items-center justify-center shrink-0">
                        <div
                          className={cn(
                            "size-5.5 rounded-full shrink-0 flex items-center justify-center transition-transform group-hover:scale-105",
                            colorKey === "white"
                              ? "border border-zinc-300 dark:border-zinc-700 shadow-2xs"
                              : "border border-black/10 dark:border-white/10 shadow-inner",
                            isSelected && "ring-2 ring-offset-2 ring-offset-background",
                            isSelected && colorKey === "white" && "ring-zinc-400 dark:ring-zinc-500",
                            isSelected && colorKey !== "white" && "ring-current"
                          )}
                          style={{
                            backgroundColor: preset.tokens.base,
                            color: preset.tokens.base,
                          }}
                        >
                          {isSelected && (
                            <Check
                              className={cn(
                                "size-3 stroke-[3]",
                                colorKey === "white" ? "text-zinc-900" : "text-white"
                              )}
                            />
                          )}
                        </div>
                      </div>
                      <span
                        className={cn(
                          "text-[10.5px] leading-tight truncate max-w-full px-0.5 transition-colors",
                          isSelected ? "text-foreground font-semibold" : "text-muted-foreground font-normal"
                        )}
                      >
                        {preset.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Tab 3: Controles */}
        {activeTab === "controls" && (
          <>
            {/* Block 1: Controles do player (Hidden) */}
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border/80 bg-muted/20 py-3 px-3.5 sm:py-3 sm:px-4">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-md bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                  <EyeOff className="size-4" />
                </div>
                <div className="space-y-0.5">
                  <Label
                    htmlFor={`hide-controls-switch-${videoId}`}
                    className="text-xs font-semibold text-foreground cursor-pointer block"
                  >
                    Esconder controles do player
                  </Label>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Remove a barra de controles durante a reprodução.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isPending && pendingField === "controlsHidden" && (
                  <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                )}
                <Switch
                  id={`hide-controls-switch-${videoId}`}
                  checked={config.controls?.hidden ?? false}
                  disabled={isPending}
                  onCheckedChange={(checked) =>
                    handleConfigUpdate(
                      {
                        controls: {
                          hidden: checked,
                        },
                      },
                      "controlsHidden"
                    )
                  }
                />
              </div>
            </div>

            {/* Block 2: Fullscreen Section */}
            <div className="rounded-lg border border-border/80 bg-muted/20 pt-3 px-3.5 pb-3.5 sm:pt-3 sm:px-4 sm:pb-4 space-y-3">
              {/* Main Toggle: Permitir fullscreen */}
              <div className="flex items-center justify-between gap-4 pb-2 border-b border-border/40">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-md bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                    <Maximize2 className="size-4" />
                  </div>
                  <div className="space-y-0.5">
                    <Label
                      htmlFor={`fullscreen-enabled-switch-${videoId}`}
                      className="text-xs font-semibold text-foreground cursor-pointer block"
                    >
                      Permitir fullscreen
                    </Label>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Habilita modos de reprodução em tela cheia no player.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isPending && pendingField === "fullscreenEnabled" && (
                    <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                  )}
                  <Switch
                    id={`fullscreen-enabled-switch-${videoId}`}
                    checked={isFullscreenEnabled}
                    disabled={isPending}
                    onCheckedChange={(checked) =>
                      handleConfigUpdate(
                        {
                          controls: {
                            fullscreen: {
                              enabled: checked,
                            },
                          },
                        },
                        "fullscreenEnabled"
                      )
                    }
                  />
                </div>
              </div>

              {/* Sub-options: button, doubleClick, keyboardF */}
              <div className={cn("space-y-2.5 pt-1", !isFullscreenEnabled && "opacity-50 pointer-events-none")}>
                {/* Option: Exibir botão de fullscreen */}
                <div className="flex items-center justify-between gap-4 py-1.5 px-2 rounded-md hover:bg-muted/30 transition-colors">
                  <div className="space-y-0.5">
                    <Label
                      htmlFor={`fullscreen-button-switch-${videoId}`}
                      className={cn(
                        "text-xs font-medium text-foreground block",
                        isFullscreenEnabled && "cursor-pointer"
                      )}
                    >
                      Exibir botão de fullscreen
                    </Label>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Mostra o ícone de tela cheia na barra de controles.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isPending && pendingField === "fullscreenButton" && (
                      <Loader2 className="size-3 animate-spin text-muted-foreground" />
                    )}
                    <Switch
                      id={`fullscreen-button-switch-${videoId}`}
                      checked={config.controls?.fullscreen?.button ?? true}
                      disabled={isPending || !isFullscreenEnabled}
                      onCheckedChange={(checked) =>
                        handleConfigUpdate(
                          {
                            controls: {
                              fullscreen: {
                                button: checked,
                              },
                            },
                          },
                          "fullscreenButton"
                        )
                      }
                    />
                  </div>
                </div>

                {/* Option: Fullscreen com duplo clique */}
                <div className="flex items-center justify-between gap-4 py-1.5 px-2 rounded-md hover:bg-muted/30 transition-colors">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <MousePointerClick className="size-3 text-muted-foreground" />
                      <Label
                        htmlFor={`fullscreen-doubleclick-switch-${videoId}`}
                        className={cn(
                          "text-xs font-medium text-foreground block",
                          isFullscreenEnabled && "cursor-pointer"
                        )}
                      >
                        Fullscreen com duplo clique
                      </Label>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed pl-4.5">
                      Alterna tela cheia com dois cliques sobre o vídeo.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isPending && pendingField === "fullscreenDoubleClick" && (
                      <Loader2 className="size-3 animate-spin text-muted-foreground" />
                    )}
                    <Switch
                      id={`fullscreen-doubleclick-switch-${videoId}`}
                      checked={config.controls?.fullscreen?.doubleClick ?? true}
                      disabled={isPending || !isFullscreenEnabled}
                      onCheckedChange={(checked) =>
                        handleConfigUpdate(
                          {
                            controls: {
                              fullscreen: {
                                doubleClick: checked,
                              },
                            },
                          },
                          "fullscreenDoubleClick"
                        )
                      }
                    />
                  </div>
                </div>

                {/* Option: Fullscreen com tecla F */}
                <div className="flex items-center justify-between gap-4 py-1.5 px-2 rounded-md hover:bg-muted/30 transition-colors">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <Keyboard className="size-3 text-muted-foreground" />
                      <Label
                        htmlFor={`fullscreen-keyboardf-switch-${videoId}`}
                        className={cn(
                          "text-xs font-medium text-foreground block",
                          isFullscreenEnabled && "cursor-pointer"
                        )}
                      >
                        Fullscreen com tecla F
                      </Label>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed pl-4.5">
                      Permite usar o atalho de teclado F para tela cheia.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isPending && pendingField === "fullscreenKeyboardF" && (
                      <Loader2 className="size-3 animate-spin text-muted-foreground" />
                    )}
                    <Switch
                      id={`fullscreen-keyboardf-switch-${videoId}`}
                      checked={config.controls?.fullscreen?.keyboardF ?? true}
                      disabled={isPending || !isFullscreenEnabled}
                      onCheckedChange={(checked) =>
                        handleConfigUpdate(
                          {
                            controls: {
                              fullscreen: {
                                keyboardF: checked,
                              },
                            },
                          },
                          "fullscreenKeyboardF"
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <p className="text-xs text-destructive font-medium pt-1">{error}</p>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
