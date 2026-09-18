import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getCurrentAccount } from "@/lib/accounts";
import { getPlanUsage } from "@/lib/plans/access";
import { PRO_PLAN } from "@/lib/plans/catalog";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { SettingsView } from "@/components/settings/settings-view";

export const metadata: Metadata = {
  title: "Configurações",
  description: "Gerencie sua conta, segurança e plano no Evandro Watch.",
};

interface SettingsPageProps {
  searchParams?: Promise<{ tab?: string }>;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const rawTab = resolvedSearchParams.tab?.toLowerCase().trim();
  const defaultTab =
    rawTab === "plan" || rawTab === "plano" || rawTab === "subscription"
      ? "plan"
      : "general";

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

      {/* Main Content Area — Standard 1440px container */}
      <main className="flex-1 mx-auto w-full max-w-[1440px] px-4 sm:px-6 py-8 space-y-8">
        {/* Page Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Configurações
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerencie os dados da sua conta, credenciais de segurança e consulte os limites do seu plano.
          </p>
        </div>

        {/* 2-Column Settings View */}
        <SettingsView
          user={{
            name: session.user.name || "",
            email: session.user.email || "",
          }}
          plan={{
            name: planName,
            periodKey: usageStats.periodKey,
            videoCount: usageStats.videoCount,
            maxVideos: usageStats.maxVideos,
            playsThisMonth: usageStats.playsThisMonth,
            maxPlays: usageStats.maxPlays,
            maxVideoDurationSeconds: planLimits.maxVideoDurationSeconds,
            maxPlaybackResolution: planLimits.maxPlaybackResolution,
            expiresAt: usageStats.subscription?.expiresAt
              ? usageStats.subscription.expiresAt.toISOString()
              : null,
          }}
          defaultTab={defaultTab}
        />
      </main>
    </div>
  );
}
