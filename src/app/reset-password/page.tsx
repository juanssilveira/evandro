"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, CheckCircle2, KeyRound, AlertCircle } from "lucide-react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setError(null);

    if (!token) {
      setError("Token de redefinição inválido ou ausente.");
      return;
    }

    if (password.length < 6) {
      setError("A nova senha deve ter no mínimo 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setIsLoading(true);

    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token,
      });

      if (result.error) {
        setError(result.error.message || "Token expirado ou inválido. Solicite uma nova redefinição.");
        setIsLoading(false);
        return;
      }

      setIsSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 2500);
    } catch {
      setError("Falha ao redefinir a senha. Tente novamente.");
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <Card className="border-border bg-card shadow-sm rounded-xl max-w-md w-full text-center">
        <CardHeader className="space-y-2 pb-4">
          <div className="flex justify-center mb-2">
            <div className="flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive border border-destructive/20">
              <AlertCircle className="size-6" />
            </div>
          </div>
          <CardTitle className="text-lg font-bold tracking-tight text-foreground">
            Link Inválido
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            O link de redefinição de senha é inválido ou não contém um token.
          </CardDescription>
        </CardHeader>
        <CardFooter className="pt-2">
          <Link
            href="/login"
            className="w-full inline-flex items-center justify-center h-9 px-4 text-sm font-medium rounded-lg bg-gradient-to-b from-violet-500 to-[#7C3AED] text-white hover:from-violet-500/95 hover:to-[#6D28D9] transition-all"
          >
            Ir para o Login
          </Link>
        </CardFooter>
      </Card>
    );
  }

  if (isSuccess) {
    return (
      <Card className="border-border bg-card shadow-sm rounded-xl max-w-md w-full text-center">
        <CardHeader className="space-y-2 pb-4">
          <div className="flex justify-center mb-2">
            <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="size-6" />
            </div>
          </div>
          <CardTitle className="text-lg font-bold tracking-tight text-foreground">
            Senha Alterada!
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Sua senha foi redefinida com sucesso. Redirecionando para o login...
          </CardDescription>
        </CardHeader>
        <CardFooter className="pt-2">
          <Link
            href="/login"
            className="w-full inline-flex items-center justify-center h-9 px-4 text-sm font-medium rounded-lg bg-gradient-to-b from-violet-500 to-[#7C3AED] text-white hover:from-violet-500/95 hover:to-[#6D28D9] transition-all"
          >
            Fazer Login Agora
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card shadow-sm rounded-xl max-w-md w-full">
      <CardHeader className="space-y-1.5 text-center pb-6">
        <div className="flex justify-center mb-2">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
            <KeyRound className="size-6" />
          </div>
        </div>
        <CardTitle className="text-xl font-bold tracking-tight text-foreground">
          Criar Nova Senha
        </CardTitle>
        <CardDescription className="text-muted-foreground text-xs max-w-xs mx-auto">
          Digite e confirme sua nova senha de acesso à plataforma
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive font-medium"
            >
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="new-password" className="text-xs font-medium text-foreground">
              Nova Senha
            </Label>
            <Input
              id="new-password"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={password}
              disabled={isLoading}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-password" className="text-xs font-medium text-foreground">
              Confirmar Nova Senha
            </Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="Digite novamente a nova senha"
              value={confirmPassword}
              disabled={isLoading}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4 pt-2">
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Salvando nova senha...
              </>
            ) : (
              "Salvar Nova Senha"
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Lembrou da senha?{" "}
            <Link
              href="/login"
              className="font-semibold text-primary hover:text-primary-hover transition-colors"
            >
              Voltar ao login
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <React.Suspense
        fallback={
          <div className="flex items-center justify-center p-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <ResetPasswordForm />
      </React.Suspense>
    </div>
  );
}
