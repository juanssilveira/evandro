"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { User, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { AccountSettingsCard } from "@/components/settings/account-settings-card";
import { SecuritySettingsCard } from "@/components/settings/security-settings-card";
import { PlanSettingsCard } from "@/components/settings/plan-settings-card";

export type SettingsTab = "general" | "plan";

interface SettingsViewProps {
  user: {
    name: string;
    email: string;
  };
  plan: {
    name: string;
    periodKey: string;
    videoCount: number;
    maxVideos: number;
    playsThisMonth: number;
    maxPlays: number;
    maxVideoDurationSeconds: number;
    maxPlaybackResolution: number;
    expiresAt?: string | null;
  };
  defaultTab?: SettingsTab;
}

export function SettingsView({
  user,
  plan,
  defaultTab = "general",
}: SettingsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const tabParam = searchParams?.get("tab");
  const tabFromUrl = React.useMemo<SettingsTab | null>(() => {
    if (!tabParam) return null;
    const lower = tabParam.toLowerCase().trim();
    if (lower === "general" || lower === "geral" || lower === "account" || lower === "conta") return "general";
    if (lower === "plan" || lower === "plano" || lower === "subscription") return "plan";
    return null;
  }, [tabParam]);

  const [uncontrolledTab, setUncontrolledTab] = React.useState<SettingsTab>(defaultTab);
  const activeTab = tabFromUrl ?? uncontrolledTab;

  const handleTabChange = (tabId: SettingsTab) => {
    setUncontrolledTab(tabId);
    try {
      const currentParams = new URLSearchParams(searchParams?.toString() || "");
      if (currentParams.get("tab") !== tabId) {
        currentParams.set("tab", tabId);
        const newUrl = `${pathname}?${currentParams.toString()}`;
        if (typeof window !== "undefined" && window.history?.replaceState) {
          window.history.replaceState(null, "", newUrl);
        }
        router.replace(newUrl, { scroll: false });
      }
    } catch {
      // safe fallback
    }
  };

  return (
    <div className="flex flex-col lg:flex-row items-start gap-6">
      {/* Left Navigation Sidebar */}
      <aside className="w-full lg:w-60 xl:w-64 shrink-0">
        <nav
          className="flex flex-row lg:flex-col gap-1.5 p-1.5 rounded-xl border border-border bg-card/60 shadow-2xs"
          aria-label="Navegação de configurações"
        >
          {/* Tab 1: Configurações Gerais */}
          <button
            type="button"
            onClick={() => handleTabChange("general")}
            className={cn(
              "flex-1 lg:flex-initial flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all cursor-pointer",
              activeTab === "general"
                ? "bg-white dark:bg-zinc-900 text-foreground font-semibold shadow-2xs border border-border"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent"
            )}
          >
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-md transition-colors",
                activeTab === "general"
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "bg-muted border border-border text-muted-foreground"
              )}
            >
              <User className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-foreground leading-none truncate">
                Configurações gerais
              </p>
              <p className="hidden sm:block text-[11px] text-muted-foreground font-normal mt-1 leading-none truncate">
                Conta e segurança
              </p>
            </div>
          </button>

          {/* Tab 2: Plano e Faturamento */}
          <button
            type="button"
            onClick={() => handleTabChange("plan")}
            className={cn(
              "flex-1 lg:flex-initial flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all cursor-pointer",
              activeTab === "plan"
                ? "bg-white dark:bg-zinc-900 text-foreground font-semibold shadow-2xs border border-border"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent"
            )}
          >
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-md transition-colors",
                activeTab === "plan"
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "bg-muted border border-border text-muted-foreground"
              )}
            >
              <CreditCard className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-foreground leading-none truncate">
                Plano e faturamento
              </p>
              <p className="hidden sm:block text-[11px] text-muted-foreground font-normal mt-1 leading-none truncate">
                Uso e capacidade
              </p>
            </div>
          </button>
        </nav>
      </aside>

      {/* Right Column: Tab Content occupying full remaining space */}
      <div className="flex-1 w-full min-w-0 space-y-6">
        {activeTab === "general" && (
          <>
            <section aria-label="Informações da conta">
              <AccountSettingsCard
                initialName={user.name}
                email={user.email}
              />
            </section>

            <section aria-label="Segurança da conta">
              <SecuritySettingsCard />
            </section>
          </>
        )}

        {activeTab === "plan" && (
          <section aria-label="Informações do plano">
            <PlanSettingsCard
              planName={plan.name}
              periodKey={plan.periodKey}
              videoCount={plan.videoCount}
              maxVideos={plan.maxVideos}
              playsThisMonth={plan.playsThisMonth}
              maxPlays={plan.maxPlays}
              maxVideoDurationSeconds={plan.maxVideoDurationSeconds}
              maxPlaybackResolution={plan.maxPlaybackResolution}
              expiresAt={plan.expiresAt}
            />
          </section>
        )}
      </div>
    </div>
  );
}
