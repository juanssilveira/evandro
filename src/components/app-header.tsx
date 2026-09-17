import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { UserMenu } from "@/components/auth/user-menu";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  isCurrent?: boolean;
}

export interface AppHeaderProps {
  currentPath?: string;
  user: {
    name?: string | null;
    email?: string | null;
    planName?: string | null;
  };
  breadcrumbs?: BreadcrumbItem[];
  className?: string;
}

export function AppHeader({
  user,
  breadcrumbs = [],
  className,
}: AppHeaderProps) {
  // Only display breadcrumb trail and divider when inside a subpage (2 or more hierarchy levels)
  const hasSubpageBreadcrumbs = Boolean(breadcrumbs && breadcrumbs.length > 1);

  return (
    <header
      className={cn(
        "sticky top-0 z-20 w-full border-b border-border bg-card/95 backdrop-blur-xs",
        className
      )}
    >
      {/* Inner wrapper aligned to the same max-width as the main container */}
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between px-4 sm:px-6">
        {/* Left: Logo + Discreet Breadcrumb Navigation */}
        <div className="flex items-center gap-3 sm:gap-3.5 min-w-0 pr-4">
          {/* Brand Wordmark */}
          <Logo href="/videos" size="md" />

          {/* Subpage Breadcrumbs: Only rendered when inside subpages */}
          {hasSubpageBreadcrumbs && (
            <>
              {/* Subtle Vertical Divider */}
              <div
                className="h-3.5 w-px bg-border/60 shrink-0"
                aria-hidden="true"
              />

              {/* Breadcrumb Path */}
              <nav
                aria-label="Navegação estrutural"
                className="flex items-center min-w-0 text-xs font-normal"
              >
                <ol className="flex items-center gap-1.5 min-w-0">
                  {breadcrumbs.map((item, index) => {
                    const isLast = index === breadcrumbs.length - 1;
                    const isCurrent = item.isCurrent ?? isLast;

                    return (
                      <li
                        key={`${item.label}-${index}`}
                        className="flex items-center gap-1.5 min-w-0"
                      >
                        {index > 0 && (
                          <ChevronRight
                            className="size-3 text-muted-foreground/40 shrink-0 select-none"
                            aria-hidden="true"
                          />
                        )}

                        {item.href && !isCurrent ? (
                          <Link
                            href={item.href}
                            className="text-muted-foreground hover:text-foreground transition-colors hover:underline underline-offset-4 decoration-border/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-sm whitespace-nowrap shrink-0"
                          >
                            {item.label}
                          </Link>
                        ) : (
                          <span
                            className={cn(
                              "font-medium text-foreground/85 truncate max-w-[140px] xs:max-w-[200px] sm:max-w-[300px] md:max-w-[440px] lg:max-w-[560px]",
                              !isLast && "text-muted-foreground"
                            )}
                            aria-current={isCurrent ? "page" : undefined}
                            title={item.label}
                          >
                            {item.label}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </nav>
            </>
          )}
        </div>

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
