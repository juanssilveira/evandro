import * as React from "react";
import Link from "next/link";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LogoProps {
  size?: "sm" | "md" | "lg";
  href?: string;
  className?: string;
  showSubtitle?: boolean;
}

const SIZE_CONFIGS = {
  sm: {
    container: "gap-2",
    iconBox: "size-7 rounded-lg",
    playIcon: "size-3",
    title: "text-[12.5px] font-bold tracking-tight leading-none",
    subtitle: "text-[8.5px] font-medium tracking-normal text-muted-foreground/75 leading-none",
    spacing: "mt-1",
  },
  md: {
    container: "gap-2.5",
    iconBox: "size-8 rounded-[9px]",
    playIcon: "size-3.5",
    title: "text-[14px] font-bold tracking-tight leading-none",
    subtitle: "text-[9.5px] font-medium tracking-normal text-muted-foreground/75 leading-none",
    spacing: "mt-1",
  },
  lg: {
    container: "gap-3",
    iconBox: "size-10 rounded-xl",
    playIcon: "size-4.5",
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
      <span
        className={cn(
          "flex shrink-0 items-center justify-center bg-gradient-to-b from-violet-500 to-[#7C3AED] text-white font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_1px_2px_rgba(0,0,0,0.1),0_1.5px_0_#6D28D9] border border-[#6D28D9]",
          config.iconBox
        )}
        aria-hidden="true"
      >
        <Play className={cn("fill-white ml-0.5", config.playIcon)} />
      </span>

      <div className="flex flex-col justify-center leading-none text-left">
        <span
          className={cn(
            "font-bold tracking-tight text-foreground",
            config.title
          )}
        >
          WatchMap
        </span>
        {showSubtitle && (
          <span
            className={cn(
              "font-medium text-muted-foreground/80 leading-none",
              config.subtitle,
              config.spacing
            )}
          >
            by Evandro Engine
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
        aria-label="WatchMap — Página Inicial"
      >
        {content}
      </Link>
    );
  }

  return content;
}
