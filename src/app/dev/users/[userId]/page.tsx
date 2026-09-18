import { notFound, redirect } from "next/navigation";
import { assertLocalDevPanelAccess } from "@/lib/dev/guard";
import { getDevUserDetails } from "@/lib/dev/users";
import { UserDetailView } from "@/components/dev/user-detail-view";
import { getAdminEnvironmentStatus, type AdminEnvironment } from "@/lib/dev/env-config";

export const dynamic = "force-dynamic";

interface UserDetailPageProps {
  params: Promise<{
    userId: string;
  }>;
  searchParams: Promise<{
    env?: string;
  }>;
}

export default async function UserDetailPage({
  params,
  searchParams,
}: UserDetailPageProps) {
  await assertLocalDevPanelAccess();

  const { userId } = await params;
  if (!userId) {
    notFound();
  }

  const resolvedSearchParams = await searchParams;
  const rawEnv = resolvedSearchParams.env;
  const envStatus = getAdminEnvironmentStatus();

  // If no environment specified or invalid, redirect to /dev selector
  if (!rawEnv || (rawEnv !== "development" && rawEnv !== "production")) {
    redirect("/dev");
  }

  const env = rawEnv as AdminEnvironment;

  if (env === "production" && !envStatus.production.available) {
    redirect("/dev");
  }

  const details = await getDevUserDetails(env, userId);
  if (!details) {
    notFound();
  }

  return <UserDetailView details={details} env={env} />;
}
