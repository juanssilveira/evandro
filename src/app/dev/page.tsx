import { assertLocalDevPanelAccess } from "@/lib/dev/guard";
import {
  getDevPlatformOverviewAnalytics,
  getDevUsersList,
  getDevRedeemCodesList,
  getVideoInfraFullReport,
  getAdminEnvironmentStatus,
  type AdminEnvironment,
} from "@/lib/dev/service";
import { EnvironmentSelector } from "@/components/dev/environment-selector";
import { OverviewView } from "@/components/dev/overview-view";
import { UsersView } from "@/components/dev/users-view";
import { RedeemCodesView } from "@/components/dev/redeem-codes-view";
import { VideoInfraView } from "@/components/dev/video-infra-view";

export const dynamic = "force-dynamic";

interface DevPageProps {
  searchParams: Promise<{
    env?: string;
    tab?: string;
    range?: string;
  }>;
}

export default async function DevPage({ searchParams }: DevPageProps) {
  // Fail-closed security guard check
  await assertLocalDevPanelAccess();

  const resolvedParams = await searchParams;
  const rawEnv = resolvedParams.env;
  const envStatus = getAdminEnvironmentStatus();

  // If no environment selected or invalid value, show environment selector landing
  if (!rawEnv || (rawEnv !== "development" && rawEnv !== "production")) {
    return <EnvironmentSelector status={envStatus} />;
  }

  const env = rawEnv as AdminEnvironment;

  // If production is requested but unavailable, display selector with error details (NO fallback to dev)
  if (env === "production" && !envStatus.production.available) {
    return <EnvironmentSelector status={envStatus} />;
  }

  const currentTab = resolvedParams.tab || "overview";
  const range = resolvedParams.range || "30d";

  if (currentTab === "video-infra") {
    const report = await getVideoInfraFullReport(env);
    return <VideoInfraView report={report} env={env} />;
  }

  if (currentTab === "users") {
    const users = await getDevUsersList(env);
    return <UsersView users={users} env={env} />;
  }

  if (currentTab === "redeem-codes") {
    const codes = await getDevRedeemCodesList(env);
    return <RedeemCodesView codes={codes} env={env} />;
  }

  // Default to overview operational analytics
  const analytics = await getDevPlatformOverviewAnalytics(env, range);
  return <OverviewView analytics={analytics} env={env} />;
}
