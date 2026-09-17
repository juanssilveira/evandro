import * as React from "react";
import Link from "next/link";
import { UserMenu } from "@/components/auth/user-menu";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

export interface AppHeaderProps {
  currentPath?: string;
  user: {
    name?: string | null;
    email?: string | null;
    planName?: string | null;
  };
  className?: string;
}

export function AppHeader({
  user,
  currentPath = "/videos",
  className,
}: AppHeaderProps) {
  const isVideosActive = currentPath.startsWith("/videos") || currentPath === "/";
  const isSettingsActive = currentPath.startsWith("/settings");

  return (
    <header
      className={cn(
        "sticky top-0 z-20 w-full border-b border-border bg-card/95 backdrop-blur-xs",
        className
      )}
    >
      {/* Inner wrapper aligned to the same max-width as the main container */}
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between px-4 sm:px-6">
        {/* Left: Brand Wordmark */}
        <div className="flex items-center min-w-0">
          <Logo href="/videos" size="md" />
        </div>

        {/* Center: Main Navigation */}
        <nav
          aria-label="Navegação principal"
          className="flex items-center gap-1 sm:gap-1.5"
        >
          <Link
            href="/videos"
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors",
              isVideosActive
                ? "bg-muted text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
            aria-current={isVideosActive ? "page" : undefined}
          >
            Biblioteca
          </Link>
          <Link
            href="/settings"
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors",
              isSettingsActive
                ? "bg-muted text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
            aria-current={isSettingsActive ? "page" : undefined}
          >
            Configurações
          </Link>
        </nav>

        {/* Right: User menu */}
        <div className="shrink-0">
          <UserMenu
            name={user.name}
            email={user.email}
            planName={user.planName}
          />
        </div>
      </div>
    </header>
  );
}
