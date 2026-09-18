"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ShieldAlert,
  Users,
  KeyRound,
  LayoutDashboard,
  Film,
  ArrowLeftRight,
  Database,
  Server,
  AlertTriangle,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import type { AdminEnvironment } from "@/lib/dev/env-config";

export function DevHeader() {
  const searchParams = useSearchParams();
  const rawEnv = searchParams.get("env");
  const env: AdminEnvironment | null =
    rawEnv === "production" ? "production" : rawEnv === "development" ? "development" : null;
  const currentTab = searchParams.get("tab") || "overview";

  const navItems = env
    ? [
        {
          id: "overview",
          label: "Overview",
          href: `/dev?env=${env}&tab=overview`,
          icon: LayoutDashboard,
        },
        {
          id: "users",
          label: "Usuários",
          href: `/dev?env=${env}&tab=users`,
          icon: Users,
        },
        {
          id: "redeem-codes",
          label: "Redeem Codes",
          href: `/dev?env=${env}&tab=redeem-codes`,
          icon: KeyRound,
        },
        {
          id: "video-infra",
          label: "Infra de Vídeo",
          href: `/dev?env=${env}&tab=video-infra`,
          icon: Film,
        },
      ]
    : [];

  const otherEnv: AdminEnvironment = env === "production" ? "development" : "production";
  const otherEnvHref = `/dev?env=${otherEnv}&tab=overview`;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
      {/* Top Banner */}
      {env === "production" ? (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-1.5 text-xs text-amber-500 dark:text-amber-400 font-mono font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-3.5 text-amber-500 shrink-0" />
            <span className="font-bold tracking-wide">PRODUCTION · DADOS REAIS</span>
          </div>
          <span className="text-[11px] opacity-90 hidden sm:inline">
            Atenção: Ações administrativas gravam diretamente na infraestrutura de produção
          </span>
        </div>
      ) : env === "development" ? (
        <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-mono font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-3.5 text-emerald-500 shrink-0" />
            <span>DEVELOPMENT · LOCALHOST</span>
          </div>
          <span className="text-[11px] opacity-75 hidden sm:inline">
            Painel administrativo conectado ao ambiente de desenvolvimento (.env.local)
          </span>
        </div>
      ) : (
        <div className="bg-muted/40 border-b border-border px-4 py-1.5 text-xs text-muted-foreground font-mono font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-3.5 text-muted-foreground shrink-0" />
            <span>DEV ONLY · LOCALHOST</span>
          </div>
          <span className="text-[11px] opacity-75 hidden sm:inline">
            Painel administrativo interno isolado
          </span>
        </div>
      )}

      {/* Main Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link
            href={env ? `/dev?env=${env}&tab=overview` : "/dev"}
            className="flex items-center gap-3 hover:opacity-90 transition-opacity"
          >
            <Logo size="sm" showSubtitle={false} />
            <div className="h-4 w-px bg-border" />
            <span className="text-sm font-semibold tracking-tight text-foreground">
              Admin Dev
            </span>
          </Link>

          {navItems.length > 0 && (
            <nav className="flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Icon className="size-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          {env ? (
            <div className="flex items-center gap-2">
              {/* Active environment pill */}
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono font-bold tracking-wider uppercase border shadow-xs ${
                  env === "production"
                    ? "bg-amber-500/15 text-amber-500 border-amber-500/30"
                    : "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                }`}
              >
                {env === "production" ? (
                  <Server className="size-3.5" />
                ) : (
                  <Database className="size-3.5" />
                )}
                <span>{env}</span>
              </div>

              {/* Switch environment quick link */}
              <Link
                href={otherEnvHref}
                title={`Alternar para ${otherEnv}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-border transition-colors"
              >
                <ArrowLeftRight className="size-3" />
                <span className="capitalize hidden sm:inline">{otherEnv}</span>
              </Link>
            </div>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-muted text-muted-foreground border border-border">
              Selecione o ambiente
            </span>
          )}

          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-muted/60 text-muted-foreground border border-border/60 hidden md:inline-flex">
            127.0.0.1
          </span>
        </div>
      </div>
    </header>
  );
}
