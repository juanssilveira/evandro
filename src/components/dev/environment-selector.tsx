"use client";

import Link from "next/link";
import { ShieldAlert, Database, Server, ArrowRight, AlertTriangle, CheckCircle2, Lock } from "lucide-react";
import type { AdminEnvironmentStatus } from "@/lib/dev/env-config";

interface EnvironmentSelectorProps {
  status: AdminEnvironmentStatus;
}

export function EnvironmentSelector({ status }: EnvironmentSelectorProps) {
  const { development, production } = status;

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      {/* Title Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium bg-primary/10 text-primary border border-primary/20 mb-4">
          <ShieldAlert className="size-3.5" />
          <span>PAINEL ADMINISTRATIVO LOCAL</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
          Selecione o ambiente
        </h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-lg mx-auto">
          Escolha a infraestrutura que deseja consultar e gerenciar através do painel.
          O painel continuará executando localmente.
        </p>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Development Card */}
        <div className="relative group rounded-xl border border-border bg-card/60 backdrop-blur-md p-6 sm:p-8 flex flex-col justify-between transition-all duration-200 hover:border-border/80 hover:shadow-lg hover:shadow-black/20">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="size-12 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                <Database className="size-6" />
              </div>
              {development.available ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="size-3" />
                  <span>Disponível</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20">
                  <AlertTriangle className="size-3" />
                  <span>Indisponível</span>
                </span>
              )}
            </div>

            <h2 className="text-xl font-bold text-foreground tracking-tight">
              Development
            </h2>
            <p className="text-xs font-mono text-muted-foreground mt-1 mb-4">
              Fonte: .env.local
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Ambiente de desenvolvimento padrão. Utiliza banco de dados Neon local/dev,
              Mux dev e assets isolados.
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-border">
            <Link
              href="/dev?env=development&tab=overview"
              className="inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-foreground text-background hover:bg-foreground/90 transition-colors shadow-sm"
            >
              <span>Acessar Development</span>
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>

        {/* Production Card */}
        <div
          className={`relative group rounded-xl border p-6 sm:p-8 flex flex-col justify-between transition-all duration-200 ${
            production.available
              ? "border-amber-500/30 bg-card/60 backdrop-blur-md hover:border-amber-500/60 hover:shadow-lg hover:shadow-amber-500/5"
              : "border-border/60 bg-muted/20 opacity-80"
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="size-12 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                <Server className="size-6" />
              </div>

              {production.available ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-mono">
                  <AlertTriangle className="size-3" />
                  <span>DADOS REAIS</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                  <Lock className="size-3" />
                  <span>Indisponível</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-foreground tracking-tight">
                Production
              </h2>
            </div>
            <p className="text-xs font-mono text-muted-foreground mt-1 mb-4">
              Fonte: .env.production
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Infraestrutura oficial de produção. Acessa banco Neon de produção, Mux/Bunny live
              e R2 production. Todas as ações gravam diretamente nos dados reais.
            </p>

            {!production.available && (
              <div className="mt-4 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-start gap-2">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block">Configuração pendente</span>
                  <span>
                    {production.reason ||
                      "Arquivo .env.production não configurado ou DATABASE_URL ausente."}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-border">
            {production.available ? (
              <Link
                href="/dev?env=production&tab=overview"
                className="inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-colors shadow-sm"
              >
                <span>Acessar Production</span>
                <ArrowRight className="size-4" />
              </Link>
            ) : (
              <button
                disabled
                className="inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-muted text-muted-foreground cursor-not-allowed border border-border"
              >
                <span>Production Indisponível</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
