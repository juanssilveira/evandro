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

interface UserMenuProps {
  name: string | null | undefined;
  email: string | null | undefined;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "U";
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function UserMenu({ name, email }: UserMenuProps) {
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "flex h-9 items-center gap-2 px-2 rounded-lg",
              "text-sm font-medium text-foreground/80 hover:text-foreground",
              "hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-primary/30"
            )}
            aria-label="Menu do usuário"
          />
        }
      >
        {/* Avatar */}
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[11px] font-bold border border-primary/20 select-none"
          aria-hidden="true"
        >
          {initials}
        </span>

        {/* Name — hidden on small screens */}
        <span className="hidden sm:inline-block text-xs font-medium text-foreground truncate max-w-[120px]">
          {displayName}
        </span>

        <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-52">
        {/* User info header */}
        <div className="px-2.5 py-2 space-y-0.5">
          <p className="text-xs font-semibold text-foreground truncate">
            {displayName}
          </p>
          {email && (
            <p className="text-[11px] text-muted-foreground truncate">{email}</p>
          )}
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={handleLogout}
          disabled={isLoading}
          className="gap-2 text-xs text-foreground/80"
        >
          {isLoading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <LogOut className="size-3.5 text-muted-foreground" />
          )}
          <span>Sair</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
