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
import { ShieldAlert, LogOut, Loader2 } from "lucide-react";

interface NoPlanCardProps {
  user: {
    name?: string | null;
    email?: string | null;
  };
}

export function NoPlanCard({ user }: NoPlanCardProps) {
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

  return (
    <Card className="border-border bg-card shadow-sm rounded-xl text-center">
      <CardHeader className="space-y-3 pb-4">
        <div className="flex justify-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <ShieldAlert className="size-6" />
          </div>
        </div>

        <CardTitle className="text-lg font-bold tracking-tight text-foreground">
          Você não tem nenhum plano ativo.
        </CardTitle>

        <CardDescription className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
          Sua conta está autenticada, mas ainda não possui uma assinatura ativa para acessar os recursos da plataforma.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 pb-4">
        <div className="rounded-lg border border-border/80 bg-muted/30 p-3 text-xs text-left font-mono">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
            Conta conectada
          </p>
          <p className="font-medium text-foreground truncate mt-0.5">
            {user.name || user.email}
          </p>
          {user.name && user.email && (
            <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          className="w-full text-xs"
          onClick={handleLogout}
          disabled={isLoading}
        >
          {isLoading ? (
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
