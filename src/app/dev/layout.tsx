import { assertLocalDevPanelAccess } from "@/lib/dev/guard";
import { DevHeader } from "@/components/dev/dev-header";

export const dynamic = "force-dynamic";

export default async function DevLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fail-closed security guard check
  await assertLocalDevPanelAccess();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col antialiased">
      <DevHeader />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
