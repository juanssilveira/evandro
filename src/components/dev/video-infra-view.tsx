"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  AlertTriangle,
  Film,
  Server,
  Loader2,
  HardDrive,
  Info,
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
import { updateDefaultVideoProviderAction } from "@/app/actions/dev";
import type {
  VideoProvidersConfigurationStatus,
  VideoCountsByProvider,
} from "@/lib/video-providers/status";

interface VideoInfraViewProps {
  currentProvider: "mux" | "bunny";
  configStatus: VideoProvidersConfigurationStatus;
  videoCounts: VideoCountsByProvider;
}

export function VideoInfraView({
  currentProvider,
  configStatus,
  videoCounts,
}: VideoInfraViewProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [confirmProvider, setConfirmProvider] = React.useState<"mux" | "bunny" | null>(null);
  const [isPending, setIsPending] = React.useState(false);

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
      const res = await updateDefaultVideoProviderAction(confirmProvider);
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

  const renderProviderCard = (providerKey: "mux" | "bunny") => {
    const isCurrent = currentProvider === providerKey;
    const isConfigured = configStatus[providerKey].configured;
    const label = providerNames[providerKey];
    const videoCount = videoCounts[providerKey];

    return (
      <div
        key={providerKey}
        className={`relative flex flex-col justify-between p-6 rounded-xl border transition-all ${
          isCurrent
            ? "border-primary/50 bg-primary/5 shadow-sm"
            : "border-border bg-card shadow-xs"
        }`}
      >
        <div className="space-y-4">
          {/* Top Bar: Title + Status Badge */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-lg ${
                  isCurrent
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <Server className="size-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-base tracking-tight">
                  {label}
                </h3>
                <span className="text-xs text-muted-foreground font-mono">
                  {videoCount} {videoCount === 1 ? "vídeo" : "vídeos"} no banco
                </span>
              </div>
            </div>

            {/* Config Status Badge */}
            {isConfigured ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="size-3.5" />
                Configurado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <AlertTriangle className="size-3.5" />
                Configuração incompleta
              </span>
            )}
          </div>

          {/* Description & Notice */}
          <div className="text-xs text-muted-foreground leading-relaxed">
            {providerKey === "mux" ? (
              <p>Infraestrutura de streaming de alta fidelidade com delivery HLS global.</p>
            ) : (
              <p>Infraestrutura global de streaming com armazenamento de alta performance.</p>
            )}

            {!isConfigured && (
              <div className="mt-3 p-2.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 flex items-start gap-2">
                <Info className="size-4 shrink-0 mt-0.5" />
                <span>Configure as variáveis de ambiente necessárias antes de ativar.</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Button & Active State */}
        <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
          {isCurrent ? (
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
              </span>
              <span>Provider atual</span>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">Inativo para novos uploads</div>
          )}

          {!isCurrent && (
            <Button
              variant={isConfigured ? "default" : "secondary"}
              size="sm"
              disabled={!isConfigured || isPending}
              onClick={() => handleOpenConfirm(providerKey)}
            >
              Usar para novos vídeos
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Infraestrutura de Vídeo
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Escolha qual provider será utilizado para novos uploads. Vídeos existentes permanecem na infraestrutura em que foram criados.
        </p>
      </div>

      {/* Active Provider Banner */}
      <div className="p-4 rounded-lg bg-card border border-border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/10 text-primary shrink-0">
            <Film className="size-4" />
          </div>
          <div>
            <span className="text-xs font-medium text-muted-foreground block">
              Provider atual para novos uploads
            </span>
            <span className="text-sm font-semibold text-foreground">
              {providerNames[currentProvider]}
            </span>
          </div>
        </div>
        <div className="text-xs font-mono text-muted-foreground">
          Setting: default_video_provider = {currentProvider}
        </div>
      </div>

      {/* Provider Selector Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderProviderCard("mux")}
        {renderProviderCard("bunny")}
      </div>

      {/* Observability Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground tracking-tight flex items-center gap-2">
            <HardDrive className="size-4 text-muted-foreground" />
            Distribuição de Vídeos por Infraestrutura
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Contagem física de registros na base de dados (tabela videos). Cada registro permanece na infraestrutura gravada no momento do upload.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-lg p-4 shadow-xs">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
              Mux
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground font-mono">
                {videoCounts.mux}
              </span>
              <span className="text-xs text-muted-foreground">vídeos</span>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4 shadow-xs">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
              Bunny Stream
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground font-mono">
                {videoCounts.bunny}
              </span>
              <span className="text-xs text-muted-foreground">vídeos</span>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4 shadow-xs">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
              Total Geral
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground font-mono">
                {videoCounts.total}
              </span>
              <span className="text-xs text-muted-foreground">vídeos</span>
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
