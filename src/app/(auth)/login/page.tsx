"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
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
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = React.useState<LoginInput>({
    email: "",
    password: "",
  });
  const [errors, setErrors] = React.useState<Partial<Record<keyof LoginInput, string>>>({});
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoading) return;

    setErrors({});
    setAuthError(null);

    const validation = loginSchema.safeParse(formData);
    if (!validation.success) {
      const fieldErrors: Partial<Record<keyof LoginInput, string>> = {};
      for (const issue of validation.error.issues) {
        const field = issue.path[0] as keyof LoginInput;
        if (!fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    try {
      const result = await authClient.signIn.email({
        email: validation.data.email,
        password: validation.data.password,
      });

      if (result.error) {
        setAuthError("E-mail ou senha inválidos.");
        setIsLoading(false);
        return;
      }

      router.push("/videos");
      router.refresh();
    } catch {
      setAuthError("Ocorreu um erro ao tentar entrar. Tente novamente.");
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-border bg-card shadow-sm rounded-xl">
      <CardHeader className="space-y-1.5 text-center pb-6">
        <CardTitle className="text-xl font-bold tracking-tight text-foreground">
          Entrar na sua conta
        </CardTitle>
        <CardDescription className="text-muted-foreground text-xs max-w-xs mx-auto">
          Informe suas credenciais para gerenciar e configurar seus vídeos
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {authError && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive font-medium"
            >
              {authError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-medium text-foreground">
              E-mail
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="nome@empresa.com"
              value={formData.email}
              disabled={isLoading}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, email: e.target.value }))
              }
              aria-invalid={!!errors.email}
              autoComplete="email"
              required
            />
            {errors.email && (
              <p className="text-[11px] text-destructive font-medium">{errors.email}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-medium text-foreground">
              Senha
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={formData.password}
              disabled={isLoading}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, password: e.target.value }))
              }
              aria-invalid={!!errors.password}
              autoComplete="current-password"
              required
            />
            {errors.password && (
              <p className="text-[11px] text-destructive font-medium">{errors.password}</p>
            )}
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
                Entrando...
              </>
            ) : (
              "Entrar"
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Não possui uma conta?{" "}
            <Link
              href="/signup"
              className="font-semibold text-primary hover:text-primary-hover transition-colors"
            >
              Criar conta
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
