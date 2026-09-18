import { assertLocalDevPanelAccess } from "@/lib/dev/guard";
import {
  getDevPlatformOverviewAnalytics,
  getDevUsersList,
  getDevRedeemCodesList,
  getVideoInfraFullReport,
} from "@/lib/dev/service";
import { OverviewView } from "@/components/dev/overview-view";
import { UsersView } from "@/components/dev/users-view";
import { RedeemCodesView } from "@/components/dev/redeem-codes-view";
import { VideoInfraView } from "@/components/dev/video-infra-view";

export const dynamic = "force-dynamic";

interface DevPageProps {
  searchParams: Promise<{
    tab?: string;
    range?: string;
  }>;
}

export default async function DevPage({ searchParams }: DevPageProps) {
  // Fail-closed security guard check
  await assertLocalDevPanelAccess();

  const resolvedParams = await searchParams;
  const currentTab = resolvedParams.tab || "overview";
  const range = resolvedParams.range || "30d";

  if (currentTab === "video-infra") {
    const report = await getVideoInfraFullReport();
    return <VideoInfraView report={report} />;
  }

  if (currentTab === "users") {
    const users = await getDevUsersList();
    return <UsersView users={users} />;
  }

  if (currentTab === "redeem-codes") {
    const codes = await getDevRedeemCodesList();
    return <RedeemCodesView codes={codes} />;
  }

  // Default to overview operational analytics
  const analytics = await getDevPlatformOverviewAnalytics(range);
  return <OverviewView analytics={analytics} />;
}
