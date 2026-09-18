"use client";

import * as React from "react";
import { useTransition, useState } from "react";
import { updatePlayerConfigAction } from "@/app/actions/videos";
import { useToast } from "@/components/ui/toast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type PlayerConfig,
  type PlayerConfigPatch,
  type PlayerAccentColor,
  type PlayerAspectRatio,
  playerAccentColors,
  playerPlaybackRates,
  PLAYER_ACCENT_PRESETS,
} from "@/types/player-config";

export type VideoSettingsTabId = "appearance" | "playback" | "controls" | "progress";

export interface VideoSettingsTab {
  id: VideoSettingsTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const SETTINGS_TABS: readonly VideoSettingsTab[] = [
  { id: "appearance", label: "Aparência", icon: Palette },
  { id: "playback", label: "Reprodução", icon: PlayCircle },
  { id: "controls", label: "Controles", icon: SlidersHorizontal },
  { id: "progress", label: "Progresso", icon: Activity },
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

  const [uncontrolledTab, setUncontrolledTab] = useState<VideoSettingsTabId>(defaultTab);
  const activeTab = activeTabProp ?? uncontrolledTab;

  const handleTabSelect = (tabId: VideoSettingsTabId) => {
    if (activeTabProp === undefined) {
      setUncontrolledTab(tabId);
    }
    onTabChange?.(tabId);
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

  const currentAccent = config.appearance?.accentColor ?? "purple";
  const currentAspectRatio = config.appearance?.aspectRatio ?? "16:9";
  const currentPlaybackRate = config.playback?.defaultPlaybackRate ?? 1;
  const currentVolume = config.playback?.defaultVolume ?? 1;
  const isFullscreenEnabled = config.controls?.fullscreen?.enabled ?? true;
  const currentFakeHeight = config.progress?.fake?.height ?? 4;
  const isFakeProgressEnabled = config.progress?.fake?.enabled ?? false;

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

  return (
    <div className="space-y-4 min-w-0">
      {/* Category Tabs Navigation (Sticky in desktop, horizontally scrollable in mobile) */}
      <div className="sticky top-20 z-10 bg-background/95 backdrop-blur-xs py-1">
        <div
          role="tablist"
          aria-label="Categorias de configuração"
          className="flex items-center gap-1.5 p-1 bg-muted/40 border border-border/70 rounded-xl overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                  "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer select-none shrink-0",
                  isSelected
                    ? "bg-card text-foreground font-semibold shadow-xs border border-border/80"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent"
                )}
              >
                <Icon
                  className={cn(
                    "size-3.5 shrink-0 transition-colors",
                    isSelected ? "text-primary" : "text-muted-foreground"
                  )}
                />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Panels */}
      <div
        id={`tabpanel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        className="focus:outline-none min-w-0"
      >
        {/* Tab 1: Aparência */}
        {activeTab === "appearance" && (
          <Card className="border-border bg-card shadow-xs rounded-xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Palette className="size-4 text-muted-foreground" />
                  Aparência
                </CardTitle>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border border-border/60 uppercase tracking-wide">
                  Personalização
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Personalize a identidade visual e o formato de exibição do player para o seu conteúdo.
              </p>
            </CardHeader>

            <CardContent className="pt-4 space-y-3.5">
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
                        ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs"
                        : "border-border/70 bg-card hover:bg-muted/40 hover:border-border"
                    )}
                  >
                    <div
                      className={cn(
                        "w-10 h-6 rounded border flex items-center justify-center shrink-0 transition-colors shadow-2xs",
                        currentAspectRatio === "16:9"
                          ? "border-primary bg-primary/10 text-primary"
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
                        ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs"
                        : "border-border/70 bg-card hover:bg-muted/40 hover:border-border"
                    )}
                  >
                    <div
                      className={cn(
                        "w-6 h-10 rounded border flex items-center justify-center shrink-0 transition-colors shadow-2xs",
                        currentAspectRatio === "9:16"
                          ? "border-primary bg-primary/10 text-primary"
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
                        ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs"
                        : "border-border/70 bg-card hover:bg-muted/40 hover:border-border"
                    )}
                  >
                    <div
                      className={cn(
                        "size-8 rounded border flex items-center justify-center shrink-0 transition-colors shadow-2xs",
                        currentAspectRatio === "1:1"
                          ? "border-primary bg-primary/10 text-primary"
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

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-0.5">
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
                          "flex flex-col items-center justify-center gap-2 py-2.5 px-2 rounded-lg border transition-all text-center cursor-pointer",
                          isSelected
                            ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs"
                            : "border-border/70 bg-card hover:bg-muted/40 hover:border-border"
                        )}
                      >
                        <div
                          className="size-4.5 rounded-full shadow-inner ring-2 ring-white/10 shrink-0 flex items-center justify-center"
                          style={{ backgroundColor: preset.tokens.base }}
                        >
                          {isSelected && (
                            <Check className="size-2.5 text-white stroke-[3]" />
                          )}
                        </div>
                        <span
                          className={cn(
                            "text-[11px] font-medium whitespace-nowrap truncate max-w-full px-1",
                            isSelected ? "text-foreground font-semibold" : "text-muted-foreground"
                          )}
                        >
                          {preset.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

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
            </CardContent>
          </Card>
        )}

        {/* Tab 2: Reprodução */}
        {activeTab === "playback" && (
          <Card className="border-border bg-card shadow-xs rounded-xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <PlayCircle className="size-4 text-muted-foreground" />
                  Reprodução
                </CardTitle>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border border-border/60 uppercase tracking-wide">
                  Modos Exclusivos
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Configure o início automático e comportamento de áudio do player.
              </p>
            </CardHeader>

            <CardContent className="pt-4 space-y-3">
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
                            ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs"
                            : "border-border/70 bg-card hover:bg-muted/40 hover:border-border"
                        )}
                      >
                        <span
                          className={cn(
                            "text-xs font-mono font-medium",
                            isSelected ? "text-foreground font-bold text-primary" : "text-muted-foreground"
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
            </CardContent>
          </Card>
        )}

        {/* Tab 3: Controles */}
        {activeTab === "controls" && (
          <Card className="border-border bg-card shadow-xs rounded-xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <SlidersHorizontal className="size-4 text-muted-foreground" />
                  Controles
                </CardTitle>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border border-border/60 uppercase tracking-wide">
                  Interface & Ações
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Configure a visibilidade da barra de controles e as opções de tela cheia.
              </p>
            </CardHeader>

            <CardContent className="pt-4 space-y-3.5">
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
            </CardContent>
          </Card>
        )}

        {/* Tab 4: Progresso */}
        {activeTab === "progress" && (
          <Card className="border-border bg-card shadow-xs rounded-xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Activity className="size-4 text-muted-foreground" />
                  Barra de progresso
                </CardTitle>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border border-border/60 uppercase tracking-wide">
                  Timeline
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Configure o comportamento visual da timeline e o motor de progresso inteligente.
              </p>
            </CardHeader>

            <CardContent className="pt-4 space-y-3.5">
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
                            ? "border-primary bg-primary/10 text-primary font-bold shadow-2xs"
                            : "border-border/70 bg-card hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {h}px{h === 4 ? " (padrão)" : ""}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
