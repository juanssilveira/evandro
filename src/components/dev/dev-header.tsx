"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ShieldAlert, Users, KeyRound, LayoutDashboard } from "lucide-react";
import { Logo } from "@/components/brand/logo";


export function DevHeader() {
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "overview";

  const navItems = [
    {
      id: "overview",
      label: "Overview",
      href: "/dev?tab=overview",
      icon: LayoutDashboard,
    },
    {
      id: "users",
      label: "Usuários",
      href: "/dev?tab=users",
      icon: Users,
    },
    {
      id: "redeem-codes",
      label: "Redeem Codes",
      href: "/dev?tab=redeem-codes",
      icon: KeyRound,
    },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
      {/* Top Banner */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 text-xs text-amber-600 dark:text-amber-400 font-mono font-medium flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-3.5 text-amber-500 shrink-0" />
          <span>DEV ONLY · LOCALHOST</span>
        </div>
        <span className="text-[11px] opacity-75 hidden sm:inline">
          Painel administrativo interno isolado do ambiente de produção
        </span>
      </div>

      {/* Main Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <Logo size="sm" showSubtitle={false} />
            <div className="h-4 w-px bg-border" />

            <span className="text-sm font-semibold tracking-tight text-foreground">
              Admin Dev
            </span>
          </div>

          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <Icon className="size-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-muted text-muted-foreground border border-border">
            127.0.0.1 / loopback
          </span>
        </div>
      </div>
    </header>
  );
}
