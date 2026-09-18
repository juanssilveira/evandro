import * as React from "react";
import { cn } from "@/lib/utils";

export interface EvandroWatchIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
}

export function EvandroWatchIcon({
  size = 32,
  className,
  ...props
}: EvandroWatchIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden="true"
      {...props}
    >
      <defs>
        <linearGradient
          id="evandro-watch-icon-gradient-component"
          x1="16"
          y1="1"
          x2="16"
          y2="31"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
      <rect
        x="1"
        y="1"
        width="30"
        height="30"
        rx="7.5"
        fill="url(#evandro-watch-icon-gradient-component)"
        stroke="#6D28D9"
        strokeWidth="1.2"
      />
      <path
        d="M13 10.2c0-.67.73-1.08 1.3-.71l7.8 4.97c.54.34.54 1.14 0 1.48l-7.8 4.97c-.57.37-1.3-.04-1.3-.71V10.2z"
        fill="#FFFFFF"
      />
    </svg>
  );
}
