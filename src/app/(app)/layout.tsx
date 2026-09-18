import { auth } from "@/lib/auth";
import { getCurrentAccount } from "@/lib/accounts";
import { isAccountActive } from "@/lib/accounts/status";
import { getActivePlanForUser } from "@/lib/plans/access";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AccountDisabledCard } from "@/components/auth/account-disabled-card";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login");
  }

  const account = await getCurrentAccount(session.user.id);
  if (!account || !isAccountActive(account)) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-background">
        <AccountDisabledCard
          reason={account?.disabledReason}
          user={{ email: session.user.email }}
        />
      </div>
    );
  }

  const activePlan = await getActivePlanForUser(session.user.id);
  if (!activePlan) {
    redirect("/no-plan");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      {children}
    </div>
  );
}
