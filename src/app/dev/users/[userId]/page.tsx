import { notFound } from "next/navigation";
import { assertLocalDevPanelAccess } from "@/lib/dev/guard";
import { getDevUserDetails } from "@/lib/dev/users";
import { UserDetailView } from "@/components/dev/user-detail-view";

export const dynamic = "force-dynamic";

interface UserDetailPageProps {
  params: Promise<{
    userId: string;
  }>;
}

export default async function UserDetailPage({ params }: UserDetailPageProps) {
  await assertLocalDevPanelAccess();

  const { userId } = await params;
  if (!userId) {
    notFound();
  }

  const details = await getDevUserDetails(userId);
  if (!details) {
    notFound();
  }

  return <UserDetailView details={details} />;
}
