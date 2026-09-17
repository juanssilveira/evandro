import { auth } from "@/lib/auth";
import { getCurrentAccount } from "@/lib/accounts";
import { getPlanUsage } from "@/lib/plans/access";
import { PRO_PLAN } from "@/lib/plans/catalog";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import {
  Film,
  PlayCircle,
  Clock,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

export default async function SettingsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login");
  }

  const account = await getCurrentAccount(session.user.id);
  if (!account) {
    notFound();
  }

  const usageStats = await getPlanUsage(session.user.id, account.id);
  const planLimits = usageStats.plan?.limits ?? PRO_PLAN.limits;
  const planName = usageStats.plan?.name || "Pro";

  const videoPercentage = Math.min(
    100,
    Math.round((usageStats.videoCount / usageStats.maxVideos) * 100)
  );

  const playsPercentage = Math.min(
    100,
    Number(((usageStats.playsThisMonth / usageStats.maxPlays) * 100).toFixed(1))
  );

  const maxDurationMinutes = Math.round(
    planLimits.maxVideoDurationSeconds / 60
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader
        currentPath="/settings"
        user={{
          name: session.user.name,
          email: session.user.email,
          planName: `Plano ${planName}`,
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 mx-auto w-full max-w-[1440px] px-4 sm:px-6 py-8 space-y-8">
        {/* Page Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Configurações
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerencie as configurações da sua conta e acompanhe o uso do seu plano.
          </p>
        </div>

        {/* Plan Overview & Usage Section */}
        <section className="space-y-6" aria-labelledby="plan-section-heading">
          {/* Main Plan Card */}
          <div className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
            {/* Plan Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 sm:p-6 border-b border-border/70 bg-muted/20">
              <div className="flex items-center gap-3.5">
                <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                  <ShieldCheck className="size-5.5" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h2
                      id="plan-section-heading"
                      className="text-base font-semibold text-foreground"
                    >
                      Plano {planName}
                    </h2>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="size-3" />
                      Ativo
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ciclo de faturamento: {usageStats.periodKey}
                  </p>
                </div>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 sm:p-6">
              {/* Card 1: Vídeos */}
              <div className="flex flex-col justify-between p-4 rounded-xl border border-border bg-card shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                      <Film className="size-4" />
                    </div>
                    <span className="text-xs font-semibold text-foreground">
                      Vídeos Cadastrados
                    </span>
                  </div>
                  <span className="text-xs font-mono font-medium text-muted-foreground">
                    {videoPercentage}%
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-bold text-foreground text-base">
                      {usageStats.videoCount}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        de {usageStats.maxVideos} vídeos
                      </span>
                    </span>
                  </div>
                  {/* Progress Bar */}
                  <div
                    className="h-2 w-full overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuenow={usageStats.videoCount}
                    aria-valuemin={0}
                    aria-valuemax={usageStats.maxVideos}
                  >
                    <div
                      className="h-full bg-primary transition-all duration-300 rounded-full"
                      style={{ width: `${videoPercentage}%` }}
                    />
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground">
                  Limite total de vídeos permitidos simultaneamente no plano.
                </p>
              </div>

              {/* Card 2: Plays no Mês */}
              <div className="flex flex-col justify-between p-4 rounded-xl border border-border bg-card shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500 border border-violet-500/20">
                      <PlayCircle className="size-4" />
                    </div>
                    <span className="text-xs font-semibold text-foreground">
                      Plays Utilizados no Mês
                    </span>
                  </div>
                  <span className="text-xs font-mono font-medium text-muted-foreground">
                    {playsPercentage}%
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-bold text-foreground text-base">
                      {usageStats.playsThisMonth.toLocaleString("pt-BR")}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        de {usageStats.maxPlays.toLocaleString("pt-BR")} plays
                      </span>
                    </span>
                  </div>
                  {/* Progress Bar */}
                  <div
                    className="h-2 w-full overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuenow={usageStats.playsThisMonth}
                    aria-valuemin={0}
                    aria-valuemax={usageStats.maxPlays}
                  >
                    <div
                      className="h-full bg-violet-500 transition-all duration-300 rounded-full"
                      style={{ width: `${playsPercentage}%` }}
                    />
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground">
                  Visualizações registradas no ciclo mensal atual.
                </p>
              </div>

              {/* Card 3: Duração Máxima */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 shrink-0">
                    <Clock className="size-4.5" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground font-medium">
                      Duração Máxima Permitida
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      Até {maxDurationMinutes} minutos por vídeo
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono font-medium text-muted-foreground shrink-0">
                  {planLimits.maxVideoDurationSeconds}s
                </span>
              </div>

              {/* Card 4: Qualidade Máxima */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shrink-0">
                    <Sparkles className="size-4.5" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground font-medium">
                      Qualidade Máxima de Reprodução
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      Até {planLimits.maxPlaybackResolution}p Full HD
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono font-medium text-muted-foreground shrink-0">
                  {planLimits.maxPlaybackResolution}p
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
