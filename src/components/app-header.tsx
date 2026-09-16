import * as React from "react";
import Link from "next/link";
import { Play } from "lucide-react";
import { UserMenu } from "@/components/auth/user-menu";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  /** Regex or prefix to match for active state */
  activePattern?: RegExp;
}

interface AppHeaderProps {
  /** Server-side current pathname for active link detection */
  currentPath: string;
  user: {
    name?: string | null;
    email?: string | null;
  };
  className?: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Vídeos",
    href: "/videos",
    activePattern: /^\/videos/,
  },
];

export function AppHeader({ currentPath, user, className }: AppHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-20 w-full border-b border-border bg-card",
        className
      )}
    >
      {/* Inner wrapper aligned to the same max-width as the main container */}
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between px-4 sm:px-6">
        {/* Left: Logo + nav */}
        <div className="flex items-center gap-6">
          {/* Wordmark */}
          <Link
            href="/videos"
            className="flex items-center gap-2.5 font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-md"
            aria-label="WatchMap — ir para biblioteca"
          >
            <span
              className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-b from-violet-500 to-[#7C3AED] text-white text-xs font-bold shadow-[0_1px_2px_rgba(0,0,0,0.1),0_1px_0_#6D28D9] border border-[#6D28D9]"
              aria-hidden="true"
            >
              <Play className="size-3.5 fill-white ml-0.5" />
            </span>
            <span className="text-sm font-bold tracking-tight">WatchMap</span>
          </Link>

          {/* Primary navigation */}
          <nav className="flex items-center gap-1" aria-label="Navegação principal">
            {NAV_ITEMS.map((item) => {
              const isActive = item.activePattern
                ? item.activePattern.test(currentPath)
                : currentPath === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex h-8 items-center rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    isActive
                      ? "bg-primary/8 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-zinc-100"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: User menu */}
        <UserMenu name={user.name} email={user.email} />
      </div>
    </header>
  );
}
