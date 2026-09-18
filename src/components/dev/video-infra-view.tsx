"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  AlertTriangle,
  Film,
  Loader2,
  HardDrive,
  Info,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogPopup,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import {
  updateDefaultVideoProviderAction,
  refreshProviderStatsAction,
} from "@/app/actions/dev";
import type { VideoInfraFullReport } from "@/lib/dev/video-infra";
import type { AdminEnvironment } from "@/lib/dev/env-config";
import { formatBytes, formatDuration, formatDate } from "@/lib/dev/formatters";

interface VideoInfraViewProps {
  report: VideoInfraFullReport;
  env: AdminEnvironment;
}

export function VideoInfraView({ report, env }: VideoInfraViewProps) {
  const router = useRouter();
  const { toast } = useToast();

  const {
    currentProvider,
    configStatus,
    localStats,
    distribution,
    external,
    cachedAt,
  } = report;

  const [confirmProvider, setConfirmProvider] = React.useState<"mux" | "bunny" | null>(null);
  const [isPending, setIsPending] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const providerNames: Record<"mux" | "bunny", string> = {
    mux: "Mux",
    bunny: "Bunny Stream",
  };

  const handleOpenConfirm = (provider: "mux" | "bunny") => {
    if (provider === currentProvider) return;
    if (!configStatus[provider].configured) return;
    setConfirmProvider(provider);
  };

  const handleConfirmChange = async () => {
    if (!confirmProvider) return;
    setIsPending(true);

    try {
      const res = await updateDefaultVideoProviderAction(confirmProvider, env);
      if (res.success) {
        toast(
          `Provider padrão alterado para ${providerNames[confirmProvider]}. Novos uploads usarão esta infraestrutura.`,
          "success"
        );
        setConfirmProvider(null);
        router.refresh();
      } else {
        toast(res.error, "error");
      }
    } catch {
      toast("Falha ao alterar o provider padrão.", "error");
    } finally {
      setIsPending(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await refreshProviderStatsAction(env);
      if (res.success) {
        toast("Métricas de infraestrutura atualizadas com sucesso.", "success");
        router.refresh();
      }
    } catch {
      toast("Falha ao atualizar métricas.", "error");
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Header & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Infraestrutura de Vídeo & Observabilidade
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Métricas de armazenamento físico, delivery de CDN e roteamento para novos uploads.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-muted-foreground font-mono hidden sm:inline">
            Última consulta: {formatDate(cachedAt, true)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Atualizar dados</span>
          </Button>
        </div>
      </div>

      {/* Active Default Provider Banner */}
      <div className="p-4 rounded-xl bg-card border border-border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary shrink-0">
            <Film className="size-4" />
          </div>
          <div>
            <span className="text-xs font-medium text-muted-foreground block">
              Provider padrão para novos uploads
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-base font-bold text-foreground">
                {providerNames[currentProvider]}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                ATIVO PARA NOVOS UPLOADS
              </span>
            </div>
          </div>
        </div>
        <div className="text-xs font-mono text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-md">
          Setting: default_video_provider = {currentProvider}
        </div>
      </div>

      {/* Provider Cards Grid: Mux & Bunny */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* MUX CARD */}
        <div
          className={`bg-card rounded-xl border p-6 flex flex-col justify-between space-y-6 shadow-xs ${
            currentProvider === "mux" ? "border-primary/40 ring-1 ring-primary/20" : "border-border"
          }`}
        >
          <div className="space-y-6">
            {/* Brand Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="relative size-10 rounded-xl overflow-hidden border border-border flex items-center justify-center bg-muted/40 p-1.5 shrink-0">
                  <Image
                    src="/brands/mux.svg"
                    alt="Mux Logo"
                    width={32}
                    height={32}
                    className="object-contain"
                  />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Mux</h3>
                  <p className="text-xs text-muted-foreground">Streaming e codificação de alta fidelidade</p>
                </div>
              </div>

              {/* Status */}
              {configStatus.mux.configured ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="size-3.5" />
                  Configurado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <AlertTriangle className="size-3.5" />
                  Incompleto
                </span>
              )}
            </div>

            {/* WatchMap DB Metrics */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Dados WatchMap (Banco Local)
              </span>
              <div className="grid grid-cols-3 gap-3 p-3.5 bg-muted/30 border border-border rounded-lg text-xs font-mono">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">Vídeos</span>
                  <span className="text-sm font-bold text-foreground">{localStats.mux.videoCount}</span>
                  <span className="text-[10px] text-muted-foreground block">
                    {localStats.mux.readyCount} ready · {localStats.mux.processingCount} proc
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">Armazenado</span>
                  <span className="text-sm font-bold text-foreground">{formatBytes(localStats.mux.totalSizeBytes)}</span>
                  <span className="text-[10px] text-muted-foreground block">
                    {formatDuration(localStats.mux.totalDurationSeconds)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">Plays Totais</span>
                  <span className="text-sm font-bold text-foreground">{localStats.mux.totalPlays.toLocaleString("pt-BR")}</span>
                  <span className="text-[10px] text-muted-foreground block">via WatchMap</span>
                </div>
              </div>
            </div>

            {/* Mux External Stats */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block flex items-center justify-between">
                <span>Dados Externos Mux</span>
                <span className="text-[10px] font-normal normal-case text-muted-foreground">Mux Video & Delivery API</span>
              </span>

              {external.mux.available ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-muted/30 border border-border rounded-lg text-xs font-mono">
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase">Assets Mux</span>
                      <span className="text-sm font-bold text-foreground">{external.mux.totalAssets}</span>
                      <span className="text-[10px] text-muted-foreground block">registros na API</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase">Duração Stored</span>
                      <span className="text-sm font-bold text-foreground">
                        {external.mux.totalStoredDurationSeconds
                          ? formatDuration(external.mux.totalStoredDurationSeconds)
                          : "0s"}
                      </span>
                      <span className="text-[10px] text-muted-foreground block">no Mux Video</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase">Delivery Mux (30d)</span>
                      <span className="text-sm font-bold text-foreground">
                        {external.mux.deliveredMinutes ? `${external.mux.deliveredMinutes} min` : "0 min"}
                      </span>
                      <span className="text-[10px] text-muted-foreground block">entregues pela CDN</span>
                    </div>
                  </div>

                  {/* Resolution Tier Breakdown */}
                  {external.mux.resolutionTierBreakdown &&
                    Object.keys(external.mux.resolutionTierBreakdown).length > 0 && (
                      <div className="p-3 bg-muted/20 border border-border rounded-lg text-xs space-y-1">
                        <span className="text-muted-foreground font-semibold block text-[11px]">
                          Breakdown por Resolução (Tier):
                        </span>
                        <div className="flex flex-wrap gap-2 pt-1 font-mono text-[11px]">
                          {Object.entries(external.mux.resolutionTierBreakdown).map(([tier, stat]) => (
                            <span
                              key={tier}
                              className="px-2 py-0.5 rounded bg-background border border-border text-foreground"
                            >
                              {tier}: {stat.count} assets ({formatDuration(stat.durationSeconds)})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              ) : (
                <div className="p-3 bg-muted/30 border border-border rounded-lg text-xs text-muted-foreground">
                  {external.mux.error || "Dados externos do Mux indisponíveis no momento."}
                </div>
              )}
            </div>
          </div>

          {/* Action / State */}
          <div className="pt-4 border-t border-border flex items-center justify-between">
            {currentProvider === "mux" ? (
              <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                <span className="size-2 rounded-full bg-primary animate-pulse" />
                <span>Ativo para novos uploads</span>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={!configStatus.mux.configured || isPending}
                onClick={() => handleOpenConfirm("mux")}
              >
                Ativar para novos uploads
              </Button>
            )}
          </div>
        </div>

        {/* BUNNY STREAM CARD */}
        <div
          className={`bg-card rounded-xl border p-6 flex flex-col justify-between space-y-6 shadow-xs ${
            currentProvider === "bunny" ? "border-primary/40 ring-1 ring-primary/20" : "border-border"
          }`}
        >
          <div className="space-y-6">
            {/* Brand Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="relative size-10 rounded-xl overflow-hidden border border-border flex items-center justify-center bg-muted/40 p-1.5 shrink-0">
                  <Image
                    src="/brands/bunny.svg"
                    alt="Bunny Stream Logo"
                    width={32}
                    height={32}
                    className="object-contain"
                  />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Bunny Stream</h3>
                  <p className="text-xs text-muted-foreground">Armazenamento global e streaming ultra-rápido</p>
                </div>
              </div>

              {/* Status */}
              {configStatus.bunny.configured ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="size-3.5" />
                  Configurado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <AlertTriangle className="size-3.5" />
                  Incompleto
                </span>
              )}
            </div>

            {/* WatchMap DB Metrics */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Dados WatchMap (Banco Local)
              </span>
              <div className="grid grid-cols-3 gap-3 p-3.5 bg-muted/30 border border-border rounded-lg text-xs font-mono">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">Vídeos</span>
                  <span className="text-sm font-bold text-foreground">{localStats.bunny.videoCount}</span>
                  <span className="text-[10px] text-muted-foreground block">
                    {localStats.bunny.readyCount} ready · {localStats.bunny.processingCount} proc
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">Armazenado</span>
                  <span className="text-sm font-bold text-foreground">{formatBytes(localStats.bunny.totalSizeBytes)}</span>
                  <span className="text-[10px] text-muted-foreground block">
                    {formatDuration(localStats.bunny.totalDurationSeconds)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">Plays Totais</span>
                  <span className="text-sm font-bold text-foreground">{localStats.bunny.totalPlays.toLocaleString("pt-BR")}</span>
                  <span className="text-[10px] text-muted-foreground block">via WatchMap</span>
                </div>
              </div>
            </div>

            {/* Bunny External Stats */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block flex items-center justify-between">
                <span>Dados Externos Bunny</span>
                <span className="text-[10px] font-normal normal-case text-muted-foreground">Bunny Account API</span>
              </span>

              {external.bunny.available ? (
                <div className="grid grid-cols-3 gap-3 p-3.5 bg-muted/30 border border-border rounded-lg text-xs font-mono">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">VideoCount</span>
                    <span className="text-sm font-bold text-foreground">{external.bunny.videoCount}</span>
                    <span className="text-[10px] text-muted-foreground block">na Video Library</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">StorageUsage</span>
                    <span className="text-sm font-bold text-foreground">
                      {formatBytes(external.bunny.storageUsageBytes || 0)}
                    </span>
                    <span className="text-[10px] text-muted-foreground block">no Bunny CDN</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">TrafficUsage</span>
                    <span className="text-sm font-bold text-foreground">
                      {formatBytes(external.bunny.trafficUsageBytes || 0)}
                    </span>
                    <span className="text-[10px] text-muted-foreground block">tráfego consumido</span>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-muted/30 border border-border rounded-lg text-xs text-muted-foreground flex items-start gap-2">
                  <Info className="size-4 shrink-0 mt-0.5 text-muted-foreground" />
                  <div>
                    <span className="font-semibold block text-foreground">Métricas da conta Bunny indisponíveis</span>
                    <span>{external.bunny.error || "BUNNY_ACCOUNT_API_KEY não configurada. As métricas locais continuam ativas."}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action / State */}
          <div className="pt-4 border-t border-border flex items-center justify-between">
            {currentProvider === "bunny" ? (
              <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                <span className="size-2 rounded-full bg-primary animate-pulse" />
                <span>Ativo para novos uploads</span>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={!configStatus.bunny.configured || isPending}
                onClick={() => handleOpenConfirm("bunny")}
              >
                Ativar para novos uploads
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Observability Section: Distribution Breakdown */}
      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground tracking-tight flex items-center gap-2">
            <HardDrive className="size-4 text-muted-foreground" />
            Distribuição de Vídeos por Infraestrutura
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Contagem física de registros na base de dados WatchMap. Cada vídeo permanece na infraestrutura gravada no momento do upload.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Mux
              </span>
              <span className="text-xs font-mono font-bold text-foreground">
                {distribution.muxPercent}%
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground font-mono">
                {localStats.mux.videoCount}
              </span>
              <span className="text-xs text-muted-foreground">vídeos</span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5 mt-3 overflow-hidden">
              <div
                className="bg-[#FF2B6D] h-1.5 rounded-full"
                style={{ width: `${distribution.muxPercent}%` }}
              />
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Bunny Stream
              </span>
              <span className="text-xs font-mono font-bold text-foreground">
                {distribution.bunnyPercent}%
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground font-mono">
                {localStats.bunny.videoCount}
              </span>
              <span className="text-xs text-muted-foreground">vídeos</span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5 mt-3 overflow-hidden">
              <div
                className="bg-[#FF8400] h-1.5 rounded-full"
                style={{ width: `${distribution.bunnyPercent}%` }}
              />
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Total Geral
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                100%
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground font-mono">
                {localStats.total.videoCount}
              </span>
              <span className="text-xs text-muted-foreground">vídeos armazenados</span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-3 font-mono">
              {formatBytes(localStats.total.totalSizeBytes)} · {formatDuration(localStats.total.totalDurationSeconds)}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Dialog
        open={confirmProvider !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) {
            setConfirmProvider(null);
          }
        }}
      >
        <DialogPopup className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Alterar provider para {confirmProvider ? providerNames[confirmProvider] : ""}?
            </DialogTitle>
            <DialogDescription className="pt-2">
              A mudança será aplicada somente aos novos uploads.
              <span className="block mt-1">Os vídeos existentes não serão alterados.</span>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4 flex sm:justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={isPending}
              onClick={() => setConfirmProvider(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="default"
              disabled={isPending}
              onClick={handleConfirmChange}
            >
              {isPending && <Loader2 className="size-4 animate-spin mr-1.5" />}
              Alterar provider
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </div>
  );
}
