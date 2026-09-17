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
import { Input } from "@/components/ui/input";
import {
  ShieldAlert,
  LogOut,
  Loader2,
  Copy,
  Check,
  Ticket,
} from "lucide-react";
import { redeemCodeAction } from "@/app/actions/redeem";

interface NoPlanCardProps {
  user: {
    email?: string | null;
  };
}

export function NoPlanCard({ user }: NoPlanCardProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [isRedeeming, setIsRedeeming] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleCopyEmail = async () => {
    if (!user.email) return;
    try {
      await navigator.clipboard.writeText(user.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard write failure
    }
  };

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || isRedeeming) return;

    setErrorMessage(null);
    setIsRedeeming(true);

    try {
      const result = await redeemCodeAction({ code: code.trim() });
      if (result.error) {
        setErrorMessage(result.error);
        setIsRedeeming(false);
      } else {
        router.push("/videos");
        router.refresh();
      }
    } catch {
      setErrorMessage("Código inválido ou já utilizado.");
      setIsRedeeming(false);
    }
  };

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

      <CardContent className="space-y-4 pb-4">
        {/* Email Badge with Copy Action */}
        {user.email && (
          <div className="flex items-center justify-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-muted/40 text-xs font-mono text-foreground/90 max-w-full">
              <span className="truncate max-w-[240px] sm:max-w-[300px]">
                {user.email}
              </span>
              <button
                type="button"
                onClick={handleCopyEmail}
                className="inline-flex items-center justify-center size-5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                title={copied ? "Email copiado!" : "Copiar email"}
                aria-label="Copiar email"
              >
                {copied ? (
                  <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* Redeem Code Section */}
        <div className="pt-2 border-t border-border/60">
          <form onSubmit={handleRedeem} className="space-y-2.5">
            <div className="flex flex-col sm:flex-row items-stretch gap-2">
              <div className="relative flex-1">
                <Input
                  type="text"
                  placeholder="EVN-XXXX-XXXX-XXXX"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    if (errorMessage) setErrorMessage(null);
                  }}
                  className="font-mono uppercase tracking-wider text-xs sm:text-sm text-center sm:text-left h-9"
                  disabled={isRedeeming}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck="false"
                  required
                />
              </div>
              <Button
                type="submit"
                className="h-9 text-xs sm:text-sm px-4 shrink-0 font-medium"
                disabled={isRedeeming || !code.trim()}
              >
                {isRedeeming ? (
                  <>
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    Resgatando...
                  </>
                ) : (
                  <>
                    <Ticket className="mr-1.5 size-3.5" />
                    Resgatar código
                  </>
                )}
              </Button>
            </div>

            {/* Error Feedback */}
            {errorMessage && (
              <p className="text-xs text-destructive text-center font-medium animate-in fade-in duration-200">
                {errorMessage}
              </p>
            )}
          </form>
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-2 pt-2 border-t border-border/50">
        <Button
          type="button"
          variant="outline"
          className="w-full text-xs"
          onClick={handleLogout}
          disabled={isLoggingOut || isRedeeming}
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
