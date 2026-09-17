import { auth } from "@/lib/auth";
import { getActivePlanForUser } from "@/lib/plans/access";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

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
