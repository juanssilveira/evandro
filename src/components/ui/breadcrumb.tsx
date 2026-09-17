import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  isCurrent?: boolean;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items = [], className }: BreadcrumbsProps) {
  if (!items || items.length === 0) return null;

  return (
    <nav
      aria-label="Navegação estrutural"
      className={cn("flex items-center min-w-0 text-xs font-normal", className)}
    >
      <ol className="flex items-center gap-1.5 min-w-0">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
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
  );
}
