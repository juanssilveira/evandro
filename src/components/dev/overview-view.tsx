"use client";

import * as React from "react";
import Link from "next/link";
import {
  Users,
  Video,
  PlaySquare,
  HardDrive,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Calendar,
  ArrowUpRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import type { PlatformOverviewAnalytics, AnalyticsRange } from "@/lib/dev/analytics";
import type { AdminEnvironment } from "@/lib/dev/env-config";
import { formatBytes, formatDuration, formatDate } from "@/lib/dev/formatters";

interface OverviewViewProps {
  analytics: PlatformOverviewAnalytics;
  env: AdminEnvironment;
}

export function OverviewView({ analytics, env }: OverviewViewProps) {
  const { range, rangeDays, kpis, consumption, dailyPlays, growthSeries } = analytics;

  const renderDelta = (deltaPercent: number | null, label = "vs período anterior") => {
    if (deltaPercent === null) {
      return <span className="text-xs text-muted-foreground">—</span>;
    }

    const isPositive = deltaPercent > 0;
    const isZero = deltaPercent === 0;

    return (
      <div className="flex items-center gap-1 text-xs">
        {isPositive ? (
          <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-medium">
            <TrendingUp className="size-3" />
            +{deltaPercent}%
          </span>
        ) : isZero ? (
          <span className="text-muted-foreground font-medium">0%</span>
        ) : (
          <span className="inline-flex items-center gap-0.5 text-rose-600 dark:text-rose-400 font-medium">
            <TrendingDown className="size-3" />
            {deltaPercent}%
          </span>
        )}
        <span className="text-muted-foreground text-[11px]">{label}</span>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Top Header & Range Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Painel Operacional
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Métricas de crescimento, consumo e atividade da plataforma.
          </p>
        </div>

        {/* Range Selector */}
        <div className="flex items-center bg-card border border-border p-1 rounded-lg shadow-2xs self-start sm:self-auto">
          <Calendar className="size-3.5 text-muted-foreground ml-2 mr-1" />
          <span className="text-xs text-muted-foreground mr-2 font-medium">Período:</span>
          {(["7d", "30d", "90d"] as AnalyticsRange[]).map((r) => {
            const isActive = range === r;
            const labels: Record<AnalyticsRange, string> = {
              "7d": "7 dias",
              "30d": "30 dias",
              "90d": "90 dias",
            };
            return (
              <Link
                key={r}
                href={`/dev?env=${env}&tab=overview&range=${r}`}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {labels[r]}
              </Link>
            );
          })}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Usuários
              </span>
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Users className="size-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground font-mono">
                {kpis.totalUsers}
              </span>
              <span className="text-xs text-muted-foreground">cadastrados</span>
            </div>
            <div className="mt-2 text-xs">
              <span className="font-semibold text-foreground">+{kpis.newUsers.current}</span>
              <span className="text-muted-foreground ml-1">nos últimos {rangeDays}d</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border/60">
            {renderDelta(kpis.newUsers.deltaPercent)}
          </div>
        </div>

        {/* Active Subscriptions */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Assinantes Pro
              </span>
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                <Sparkles className="size-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground font-mono">
                {kpis.activePlanUsers}
              </span>
              <span className="text-xs text-muted-foreground">com plano ativo</span>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {kpis.totalUsers > 0
                ? `${Math.round((kpis.activePlanUsers / kpis.totalUsers) * 100)}% da base total`
                : "0% da base"}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border/60 text-xs text-muted-foreground flex justify-between">
            <span>{kpis.noPlanUsers} sem plano</span>
            <span>{kpis.totalAccounts} contas</span>
          </div>
        </div>

        {/* Video Uploads */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Uploads
              </span>
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                <Video className="size-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground font-mono">
                {kpis.uploadsInRange.current}
              </span>
              <span className="text-xs text-muted-foreground">em {rangeDays}d</span>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Total ativo: <span className="font-semibold text-foreground font-mono">{kpis.totalVideos}</span> vídeos
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border/60">
            {renderDelta(kpis.uploadsInRange.deltaPercent)}
          </div>
        </div>

        {/* Plays in Range */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Plays ({rangeDays}d)
              </span>
              <div className="p-2 rounded-lg bg-violet-500/10 text-violet-500">
                <PlaySquare className="size-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground font-mono">
                {kpis.playsInRange.current.toLocaleString("pt-BR")}
              </span>
              <span className="text-xs text-muted-foreground">plays</span>
            </div>
            <div className="mt-2 text-xs">
              <span className="font-semibold text-foreground font-mono">{kpis.playsToday.toLocaleString("pt-BR")}</span>
              <span className="text-muted-foreground ml-1">plays hoje</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border/60">
            {renderDelta(kpis.playsInRange.deltaPercent)}
          </div>
        </div>
      </div>

      {/* Chart 1: Daily Plays Time Series */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Reproduções por Dia
            </h2>
            <p className="text-xs text-muted-foreground">
              Volume diário de sessões de reprodução nos últimos {rangeDays} dias.
            </p>
          </div>
          <div className="text-xs font-mono text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-md">
            Fonte: play_sessions.created_at
          </div>
        </div>

        <div className="h-64 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyPlays} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="playsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-primary, #6366f1)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-primary, #6366f1)" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #27272a)" opacity={0.4} vertical={false} />
              <XAxis
                dataKey="date"
                stroke="var(--muted-foreground, #71717a)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val: string) => {
                  const parts = val.split("-");
                  return `${parts[2]}/${parts[1]}`;
                }}
              />
              <YAxis
                stroke="var(--muted-foreground, #71717a)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card, #18181b)",
                  borderColor: "var(--border, #27272a)",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "var(--foreground, #fafafa)",
                }}
                labelFormatter={(label) => typeof label === "string" ? `Data: ${formatDate(label)}` : String(label ?? "")}
                formatter={(value) => [`${value} plays`, "Reproduções"]}
              />
              <Area
                type="monotone"
                dataKey="plays"
                stroke="var(--color-primary, #6366f1)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#playsGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 2: Growth Series (Users + Uploads) */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Crescimento de Cadastros e Uploads
            </h2>
            <p className="text-xs text-muted-foreground">
              Novos usuários e novos vídeos adicionados por dia.
            </p>
          </div>
          <div className="text-xs font-mono text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-md">
            Fontes: user.created_at & videos.created_at
          </div>
        </div>

        <div className="h-64 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={growthSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #27272a)" opacity={0.4} vertical={false} />
              <XAxis
                dataKey="date"
                stroke="var(--muted-foreground, #71717a)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val: string) => {
                  const parts = val.split("-");
                  return `${parts[2]}/${parts[1]}`;
                }}
              />
              <YAxis
                stroke="var(--muted-foreground, #71717a)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card, #18181b)",
                  borderColor: "var(--border, #27272a)",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "var(--foreground, #fafafa)",
                }}
                labelFormatter={(label) => typeof label === "string" ? `Data: ${formatDate(label)}` : String(label ?? "")}
              />
              <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
              <Bar dataKey="newUsers" name="Novos Usuários" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="uploads" name="Uploads de Vídeo" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Video Consumption & Provider Split */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Consumo da Operação
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Volume físico e distribuição de infraestrutura de vídeo armazenada no banco.
            </p>
          </div>
          <Link
            href={`/dev?env=${env}&tab=video-infra`}
            className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary-hover font-medium"
          >
            <span>Ver Infra de Vídeo</span>
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* General Stats */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <HardDrive className="size-4 text-cyan-500" />
              <span>Volume Total</span>
            </div>
            <div>
              <div className="text-2xl font-bold font-mono text-foreground">
                {formatBytes(consumption.totalMediaSizeBytes)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {formatDuration(consumption.totalDurationSeconds)} de vídeo hospedado
              </div>
            </div>
            <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                {consumption.videoStatusCounts.ready} prontos
              </span>
              <span className="text-amber-600 dark:text-amber-400">
                {consumption.videoStatusCounts.processing + consumption.videoStatusCounts.uploading} em proc
              </span>
              {consumption.videoStatusCounts.errored > 0 && (
                <span className="text-destructive">
                  {consumption.videoStatusCounts.errored} com erro
                </span>
              )}
            </div>
          </div>

          {/* Mux Provider Box */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <span className="size-2 rounded-full bg-[#FF2B6D]"></span>
                <span>Mux</span>
              </div>
              <span className="text-xs font-mono text-muted-foreground">
                {consumption.totalVideos > 0
                  ? `${Math.round((consumption.providers.mux.videoCount / consumption.totalVideos) * 100)}%`
                  : "0%"}
              </span>
            </div>
            <div>
              <div className="text-2xl font-bold font-mono text-foreground">
                {consumption.providers.mux.videoCount} <span className="text-sm font-normal text-muted-foreground">vídeos</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {formatBytes(consumption.providers.mux.totalSizeBytes)} · {formatDuration(consumption.providers.mux.totalDurationSeconds)}
              </div>
            </div>
            <div className="pt-3 border-t border-border/60 text-xs text-muted-foreground flex justify-between font-mono">
              <span>{consumption.providers.mux.totalPlays.toLocaleString("pt-BR")} plays</span>
              <span>Mux Assets</span>
            </div>
          </div>

          {/* Bunny Stream Box */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <span className="size-2 rounded-full bg-[#FF8400]"></span>
                <span>Bunny Stream</span>
              </div>
              <span className="text-xs font-mono text-muted-foreground">
                {consumption.totalVideos > 0
                  ? `${Math.round((consumption.providers.bunny.videoCount / consumption.totalVideos) * 100)}%`
                  : "0%"}
              </span>
            </div>
            <div>
              <div className="text-2xl font-bold font-mono text-foreground">
                {consumption.providers.bunny.videoCount} <span className="text-sm font-normal text-muted-foreground">vídeos</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {formatBytes(consumption.providers.bunny.totalSizeBytes)} · {formatDuration(consumption.providers.bunny.totalDurationSeconds)}
              </div>
            </div>
            <div className="pt-3 border-t border-border/60 text-xs text-muted-foreground flex justify-between font-mono">
              <span>{consumption.providers.bunny.totalPlays.toLocaleString("pt-BR")} plays</span>
              <span>Bunny Video Library</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
