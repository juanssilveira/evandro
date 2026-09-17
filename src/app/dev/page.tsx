import { assertLocalDevPanelAccess } from "@/lib/dev/guard";
import {
  getDevOverviewMetrics,
  getDevAccountUsageList,
  getDevUsersList,
  getDevRedeemCodesList,
} from "@/lib/dev/service";
import { OverviewView } from "@/components/dev/overview-view";
import { UsersView } from "@/components/dev/users-view";
import { RedeemCodesView } from "@/components/dev/redeem-codes-view";

export const dynamic = "force-dynamic";

interface DevPageProps {
  searchParams: Promise<{
    tab?: string;
  }>;
}

export default async function DevPage({ searchParams }: DevPageProps) {
  // Fail-closed security guard check
  await assertLocalDevPanelAccess();

  const resolvedParams = await searchParams;
  const currentTab = resolvedParams.tab || "overview";

  if (currentTab === "users") {
    const users = await getDevUsersList();
    return <UsersView users={users} />;
  }

  if (currentTab === "redeem-codes") {
    const codes = await getDevRedeemCodesList();
    return <RedeemCodesView codes={codes} />;
  }

  // Default to overview
  const [metrics, accounts] = await Promise.all([
    getDevOverviewMetrics(),
    getDevAccountUsageList(),
  ]);

  return <OverviewView metrics={metrics} accounts={accounts} />;
}
