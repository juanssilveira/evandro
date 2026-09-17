"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown, LogOut, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface UserMenuProps {
  name: string | null | undefined;
  email: string | null | undefined;
  planName?: string | null | undefined;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "U";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getFirstTwoNames(
  name: string | null | undefined,
  fallback = "Usuário"
): string {
  if (!name || !name.trim()) return fallback;
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).join(" ");
}

export function UserMenu({ name, email, planName }: UserMenuProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await authClient.signOut();
      router.push("/login");
      router.refresh();
    } catch {
      setIsLoading(false);
    }
  };

  const initials = getInitials(name);
  const displayName = name || email || "Usuário";
  const twoNames = getFirstTwoNames(name, email ? email.split("@")[0] : "Usuário");
  const planLabel = planName || "Plano Pro";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "flex h-9 items-center gap-2.5 px-2 rounded-lg",
              "text-foreground/80 hover:text-foreground",
              "hover:bg-zinc-100 dark:hover:bg-zinc-800/60 focus-visible:ring-2 focus-visible:ring-primary/30"
            )}
            aria-label="Menu do usuário"
          />
        }
      >
        {/* Avatar */}
        <span
          className="flex size-7.5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[11px] font-bold border border-primary/20 select-none"
          aria-hidden="true"
        >
          {initials}
        </span>

        {/* Name and Plan — hidden on small screens */}
        <div className="hidden sm:flex flex-col text-left leading-none">
          <span className="text-xs font-semibold text-foreground truncate max-w-[140px]">
            {twoNames}
          </span>
          <span className="text-[10px] font-medium text-muted-foreground/75 mt-0.5 leading-none">
            {planLabel}
          </span>
        </div>

        <ChevronDown className="size-3.5 text-muted-foreground/70 shrink-0 ml-0.5" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        {/* User info header */}
        <div className="px-2.5 py-2 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-foreground truncate">
              {displayName}
            </p>
            <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20 shrink-0">
              {planLabel}
            </span>
          </div>
          {email && (
            <p className="text-[11px] text-muted-foreground truncate font-mono">
              {email}
            </p>
          )}
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={handleLogout}
          disabled={isLoading}
          className="gap-2 text-xs text-foreground/80 cursor-pointer"
        >
          {isLoading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <LogOut className="size-3.5 text-muted-foreground" />
          )}
          <span>Sair da conta</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
