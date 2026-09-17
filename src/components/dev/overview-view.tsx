import {
  Users,
  Building2,
  Video,
  PlaySquare,
  HardDrive,
  Clock,
  CheckCircle2,
  Clock3,
  AlertCircle,
} from "lucide-react";
import { type OverviewMetrics, type AccountUsageRow } from "@/lib/dev/service";
import { formatBytes, formatDuration, formatDate } from "@/lib/dev/formatters";

interface OverviewViewProps {
  metrics: OverviewMetrics;
  accounts: AccountUsageRow[];
}

export function OverviewView({ metrics, accounts }: OverviewViewProps) {
  return (
    <div className="space-y-8">
      {/* Top Section Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Visão Geral da Plataforma
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Métricas consolidadas e uso de recursos no ambiente local de desenvolvimento.
        </p>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Users */}
        <div className="bg-card border border-border rounded-lg p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Usuários
            </span>
            <div className="p-2 rounded-md bg-primary/10 text-primary">
              <Users className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {metrics.totalUsers}
            </span>
            <span className="text-xs text-muted-foreground">total</span>
          </div>
          <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between text-xs">
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              {metrics.activePlanUsers} com plano ativo
            </span>
            <span className="text-muted-foreground">
              {metrics.noPlanUsers} sem plano
            </span>
          </div>
        </div>

        {/* Total Accounts */}
        <div className="bg-card border border-border rounded-lg p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Contas
            </span>
            <div className="p-2 rounded-md bg-zinc-500/10 text-zinc-600 dark:text-zinc-400">
              <Building2 className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {metrics.totalAccounts}
            </span>
            <span className="text-xs text-muted-foreground">organizações/contas</span>
          </div>
          <div className="mt-3 pt-3 border-t border-border/60 text-xs text-muted-foreground">
            Média de {metrics.totalAccounts > 0 ? (metrics.totalUsers / metrics.totalAccounts).toFixed(1) : 0} usuários por conta
          </div>
        </div>

        {/* Total Videos & Breakdown */}
        <div className="bg-card border border-border rounded-lg p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Vídeos
            </span>
            <div className="p-2 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Video className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {metrics.totalVideos}
            </span>
            <span className="text-xs text-muted-foreground">total</span>
          </div>
          <div className="mt-3 pt-3 border-t border-border/60 flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-3" />
              {metrics.videoStatusCounts.ready} ready
            </span>
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <Clock3 className="size-3" />
              {metrics.videoStatusCounts.processing + metrics.videoStatusCounts.uploading} proc
            </span>
            {metrics.videoStatusCounts.errored > 0 && (
              <span className="inline-flex items-center gap-1 text-destructive">
                <AlertCircle className="size-3" />
                {metrics.videoStatusCounts.errored} err
              </span>
            )}
          </div>
        </div>

        {/* Plays This Month */}
        <div className="bg-card border border-border rounded-lg p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Plays do Mês
            </span>
            <div className="p-2 rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <PlaySquare className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {metrics.totalMonthlyPlays.toLocaleString("pt-BR")}
            </span>
            <span className="text-xs text-muted-foreground">reproduções</span>
          </div>
          <div className="mt-3 pt-3 border-t border-border/60 text-xs text-muted-foreground">
            Soma de plays no período corrente (UTC)
          </div>
        </div>

        {/* Total Media Size */}
        <div className="bg-card border border-border rounded-lg p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Mídia Enviada
            </span>
            <div className="p-2 rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
              <HardDrive className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {formatBytes(metrics.totalMediaSizeBytes)}
            </span>
            <span className="text-xs text-muted-foreground">volume de arquivos</span>
          </div>
          <div className="mt-3 pt-3 border-t border-border/60 text-xs text-muted-foreground">
            Soma dos tamanhos originais persistidos
          </div>
        </div>

        {/* Total Duration */}
        <div className="bg-card border border-border rounded-lg p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Duração Hospedada
            </span>
            <div className="p-2 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Clock className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {formatDuration(metrics.totalDurationSeconds)}
            </span>
            <span className="text-xs text-muted-foreground">tempo total</span>
          </div>
          <div className="mt-3 pt-3 border-t border-border/60 text-xs text-muted-foreground">
            Duração combinada de todos os vídeos
          </div>
        </div>
      </div>

      {/* Account Usage Breakdown Table */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Uso por Conta
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Métricas discriminadas de cada conta cadastrada no ambiente local.
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b border-border text-xs text-muted-foreground uppercase font-medium">
                <tr>
                  <th className="px-4 py-3">Conta / Usuário</th>
                  <th className="px-4 py-3">Plano</th>
                  <th className="px-4 py-3">Validade</th>
                  <th className="px-4 py-3 text-center">Vídeos</th>
                  <th className="px-4 py-3 text-center">Plays Mês</th>
                  <th className="px-4 py-3 text-right">Mídia</th>
                  <th className="px-4 py-3 text-right">Duração</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {accounts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhuma conta cadastrada.
                    </td>
                  </tr>
                ) : (
                  accounts.map((acc) => {
                    const isPro = acc.planCode === "pro" && acc.subscriptionStatus === "active";
                    return (
                      <tr key={acc.accountId} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{acc.accountName}</div>
                          <div className="text-xs text-muted-foreground">
                            {acc.primaryEmail !== "—" ? acc.primaryEmail : acc.primaryUserName}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {isPro ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                              Pro
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground border border-border">
                              Sem plano
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {isPro
                            ? acc.expiresAt
                              ? formatDate(acc.expiresAt)
                              : "Sem vencimento"
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-xs">
                          {acc.videoCount} / {isPro ? "10" : "0"}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-xs">
                          {acc.playsThisMonth.toLocaleString("pt-BR")}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          {formatBytes(acc.totalMediaSizeBytes)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                          {formatDuration(acc.totalDurationSeconds)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
