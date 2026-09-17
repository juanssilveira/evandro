import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { CreditCard, CheckCircle2 } from "lucide-react";

interface PlanSettingsCardProps {
  planName: string;
  periodKey: string;
  videoCount: number;
  maxVideos: number;
  playsThisMonth: number;
  maxPlays: number;
  maxVideoDurationSeconds: number;
  maxPlaybackResolution: number;
  expiresAt?: string | Date | null;
}

function formatExpirationDate(dateInput: string | Date): string {
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export function PlanSettingsCard({
  planName,
  periodKey,
  videoCount,
  maxVideos,
  playsThisMonth,
  maxPlays,
  maxVideoDurationSeconds,
  maxPlaybackResolution,
  expiresAt,
}: PlanSettingsCardProps) {
  const videoPercentage = Math.min(
    100,
    Math.round((videoCount / (maxVideos || 1)) * 100)
  );

  const playsPercentage = Math.min(
    100,
    Number(((playsThisMonth / (maxPlays || 1)) * 100).toFixed(1))
  );

  const maxDurationMinutes = Math.round(maxVideoDurationSeconds / 60);

  return (
    <Card className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
      <CardHeader className="p-5 sm:p-6 border-b border-border/70 bg-muted/10">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0">
            <CreditCard className="size-4.5" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-foreground">
              Plano
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Informações da sua assinatura atual e capacidade de uso.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 divide-y divide-border/60">
        {/* Plan & Status Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 sm:px-6 sm:py-4">
          <div className="space-y-0.5">
            <span className="text-xs text-muted-foreground font-medium">
              Plano atual
            </span>
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-semibold text-foreground">
                Plano {planName}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="size-3 shrink-0" />
                Ativo
              </span>
            </div>
          </div>
          <div className="flex items-center gap-6 text-left sm:text-right">
            {expiresAt && (
              <div className="space-y-0.5">
                <span className="text-xs text-muted-foreground font-medium">
                  Válido até
                </span>
                <p className="text-xs font-mono font-medium text-foreground">
                  {formatExpirationDate(expiresAt)}
                </p>
              </div>
            )}
            <div className="space-y-0.5">
              <span className="text-xs text-muted-foreground font-medium">
                Ciclo atual
              </span>
              <p className="text-xs font-mono font-medium text-foreground">
                {periodKey}
              </p>
            </div>
          </div>
        </div>

        {/* Videos Usage */}
        <div className="p-5 sm:px-6 sm:py-4 space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <span className="text-xs font-medium text-foreground">
                Vídeos cadastrados
              </span>
              <p className="text-[11px] text-muted-foreground">
                Total de vídeos ativos na biblioteca
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-xs font-semibold text-foreground">
                {videoCount}{" "}
                <span className="font-normal text-muted-foreground">
                  de {maxVideos}
                </span>
              </span>
              <span className="text-[11px] text-muted-foreground ml-1.5 font-mono">
                ({videoPercentage}%)
              </span>
            </div>
          </div>

          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
            role="progressbar"
            aria-valuenow={videoCount}
            aria-valuemin={0}
            aria-valuemax={maxVideos}
            aria-label="Uso de vídeos cadastrados"
          >
            <div
              className="h-full bg-primary transition-all duration-300 rounded-full"
              style={{ width: `${videoPercentage}%` }}
            />
          </div>
        </div>

        {/* Plays Usage */}
        <div className="p-5 sm:px-6 sm:py-4 space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <span className="text-xs font-medium text-foreground">
                Plays no mês
              </span>
              <p className="text-[11px] text-muted-foreground">
                Visualizações registradas no ciclo mensal
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-xs font-semibold text-foreground">
                {playsThisMonth.toLocaleString("pt-BR")}{" "}
                <span className="font-normal text-muted-foreground">
                  de {maxPlays.toLocaleString("pt-BR")}
                </span>
              </span>
              <span className="text-[11px] text-muted-foreground ml-1.5 font-mono">
                ({playsPercentage}%)
              </span>
            </div>
          </div>

          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
            role="progressbar"
            aria-valuenow={playsThisMonth}
            aria-valuemin={0}
            aria-valuemax={maxPlays}
            aria-label="Uso de plays no mês"
          >
            <div
              className="h-full bg-primary transition-all duration-300 rounded-full"
              style={{ width: `${playsPercentage}%` }}
            />
          </div>
        </div>

        {/* Limits Specifications: Duration & Quality */}
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border/60">
          <div className="p-5 sm:px-6 sm:py-4 space-y-0.5">
            <span className="text-xs text-muted-foreground font-medium">
              Duração máxima por vídeo
            </span>
            <p className="text-sm font-semibold text-foreground">
              Até {maxDurationMinutes} minutos{" "}
              <span className="text-xs font-mono font-normal text-muted-foreground">
                ({maxVideoDurationSeconds}s)
              </span>
            </p>
          </div>

          <div className="p-5 sm:px-6 sm:py-4 space-y-0.5">
            <span className="text-xs text-muted-foreground font-medium">
              Qualidade máxima de reprodução
            </span>
            <p className="text-sm font-semibold text-foreground">
              Até {maxPlaybackResolution}p Full HD
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
