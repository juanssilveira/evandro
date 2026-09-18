"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldX, LogOut, Loader2 } from "lucide-react";

interface AccountDisabledCardProps {
  reason?: string | null;
  user: {
    email?: string | null;
  };
}

export function AccountDisabledCard({ reason, user }: AccountDisabledCardProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await authClient.signOut();
      router.push("/login");
      router.refresh();
    } catch {
      setIsLoggingOut(false);
    }
  };

  return (
    <Card className="border-border bg-card shadow-sm rounded-xl text-center max-w-md w-full">
      <CardHeader className="space-y-3 pb-4">
        <div className="flex justify-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive border border-destructive/20">
            <ShieldX className="size-6" />
          </div>
        </div>

        <CardTitle className="text-lg font-bold tracking-tight text-foreground">
          Conta Desativada
        </CardTitle>

        <CardDescription className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
          Esta conta foi desativada pelo administrador. O acesso aos recursos e reproduções está temporariamente suspenso.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 pb-4">
        {reason && (
          <div className="p-3 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground text-left">
            <span className="font-semibold text-foreground block mb-1">Motivo informado:</span>
            {reason}
          </div>
        )}

        {user.email && (
          <div className="text-xs text-muted-foreground font-mono">
            {user.email}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-2 border-t border-border/50">
        <Button
          type="button"
          variant="outline"
          className="w-full text-xs"
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? (
            <>
              <Loader2 className="mr-2 size-3.5 animate-spin" />
              Saindo...
            </>
          ) : (
            <>
              <LogOut className="mr-2 size-3.5" />
              Sair da conta
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
