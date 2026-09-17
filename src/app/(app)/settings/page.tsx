import { auth } from "@/lib/auth";
import { getCurrentAccount } from "@/lib/accounts";
import { getPlanUsage } from "@/lib/plans/access";
import { PRO_PLAN } from "@/lib/plans/catalog";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { AccountSettingsCard } from "@/components/settings/account-settings-card";
import { SecuritySettingsCard } from "@/components/settings/security-settings-card";
import { PlanSettingsCard } from "@/components/settings/plan-settings-card";

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
      <main className="flex-1 mx-auto w-full max-w-4xl px-4 sm:px-6 py-8 space-y-6">
        {/* Page Header */}
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Configurações
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Gerencie os dados da sua conta, credenciais de segurança e consulte os limites do seu plano.
          </p>
        </div>

        {/* Section 1: Conta */}
        <section aria-label="Informações da conta">
          <AccountSettingsCard
            initialName={session.user.name || ""}
            email={session.user.email || ""}
          />
        </section>

        {/* Section 2: Segurança */}
        <section aria-label="Segurança da conta">
          <SecuritySettingsCard />
        </section>

        {/* Section 3: Plano */}
        <section aria-label="Informações do plano">
          <PlanSettingsCard
            planName={planName}
            periodKey={usageStats.periodKey}
            videoCount={usageStats.videoCount}
            maxVideos={usageStats.maxVideos}
            playsThisMonth={usageStats.playsThisMonth}
            maxPlays={usageStats.maxPlays}
            maxVideoDurationSeconds={planLimits.maxVideoDurationSeconds}
            maxPlaybackResolution={planLimits.maxPlaybackResolution}
          />
        </section>
      </main>
    </div>
  );
}
