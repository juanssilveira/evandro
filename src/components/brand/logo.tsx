import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { EvandroWatchIcon } from "@/components/brand/evandro-watch-icon";

export interface LogoProps {
  size?: "sm" | "md" | "lg";
  href?: string;
  className?: string;
  showSubtitle?: boolean;
}

const SIZE_CONFIGS = {
  sm: {
    container: "gap-2",
    iconSize: 28,
    title: "text-[12.5px] font-bold tracking-tight leading-none",
    subtitle: "text-[8.5px] font-medium tracking-normal text-muted-foreground/75 leading-none",
    spacing: "mt-1",
  },
  md: {
    container: "gap-2.5",
    iconSize: 32,
    title: "text-[14px] font-bold tracking-tight leading-none",
    subtitle: "text-[9.5px] font-medium tracking-normal text-muted-foreground/75 leading-none",
    spacing: "mt-1",
  },
  lg: {
    container: "gap-3",
    iconSize: 40,
    title: "text-[17px] font-bold tracking-tight leading-none",
    subtitle: "text-[11px] font-medium tracking-normal text-muted-foreground/75 leading-none",
    spacing: "mt-1.5",
  },
} as const;

export function Logo({
  size = "md",
  href,
  className,
  showSubtitle = true,
}: LogoProps) {
  const config = SIZE_CONFIGS[size];

  const content = (
    <div
      className={cn(
        "inline-flex items-center select-none text-left",
        config.container,
        className
      )}
    >
      <EvandroWatchIcon size={config.iconSize} />

      <div className="flex flex-col justify-center leading-none text-left">
        <span
          className={cn(
            "font-bold tracking-tight text-foreground",
            config.title
          )}
        >
          Evandro Watch
        </span>
        {showSubtitle && (
          <span
            className={cn(
              "font-medium text-muted-foreground/80 leading-none",
              config.subtitle,
              config.spacing
            )}
          >
            by Evandro Intelligence
          </span>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-md transition-opacity hover:opacity-95"
        aria-label="Evandro Watch — Página Inicial"
      >
        {content}
      </Link>
    );
  }

  return content;
}

