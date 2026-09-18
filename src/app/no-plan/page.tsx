import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getActivePlanForUser } from "@/lib/plans/access";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NoPlanCard } from "@/components/auth/no-plan-card";
import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = {
  title: "Acesso",
  description: "Ative seu acesso no Evandro Watch.",
};

export default async function NoPlanPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login");
  }

  const activePlan = await getActivePlanForUser(session.user.id);
  if (activePlan) {
    redirect("/videos");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 sm:p-6 selection:bg-primary/20 selection:text-primary">
      <div className="w-full max-w-md space-y-6">
        {/* Wordmark Header */}
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>

        {/* Card */}
        <NoPlanCard user={session.user} />
      </div>
    </div>
  );
}
