"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { signupSchema, type SignupInput } from "@/lib/validations/auth";
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

export default function SignupPage() {
  const router = useRouter();
  const [formData, setFormData] = React.useState<SignupInput>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = React.useState<Partial<Record<keyof SignupInput, string>>>({});
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoading) return;

    setErrors({});
    setAuthError(null);

    const validation = signupSchema.safeParse(formData);
    if (!validation.success) {
      const fieldErrors: Partial<Record<keyof SignupInput, string>> = {};
      for (const issue of validation.error.issues) {
        const field = issue.path[0] as keyof SignupInput;
        if (!fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    try {
      const result = await authClient.signUp.email({
        name: validation.data.name,
        email: validation.data.email,
        password: validation.data.password,
      });

      if (result.error) {
        setAuthError(
          result.error.message || "Não foi possível criar sua conta. Tente novamente."
        );
        setIsLoading(false);
        return;
      }

      router.push("/videos");
      router.refresh();
    } catch {
      setAuthError("Ocorreu um erro ao criar a conta. Tente novamente.");
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-border bg-card shadow-sm rounded-xl">
      <CardHeader className="space-y-1.5 text-center pb-6">
        <CardTitle className="text-xl font-bold tracking-tight text-foreground">
          Criar sua conta
        </CardTitle>
        <CardDescription className="text-muted-foreground text-xs max-w-xs mx-auto">
          Preencha os campos abaixo para começar a gerenciar e analisar seus vídeos
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-3.5">
          {authError && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive font-medium"
            >
              {authError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs font-medium text-foreground">
              Nome completo
            </Label>
            <Input
              id="name"
              type="text"
              placeholder="Seu nome"
              value={formData.name}
              disabled={isLoading}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              aria-invalid={!!errors.name}
              autoComplete="name"
              required
            />
            {errors.name && (
              <p className="text-[11px] text-destructive font-medium">{errors.name}</p>
            )}
          </div>

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
              placeholder="Mínimo 8 caracteres"
              value={formData.password}
              disabled={isLoading}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, password: e.target.value }))
              }
              aria-invalid={!!errors.password}
              autoComplete="new-password"
              required
            />
            {errors.password && (
              <p className="text-[11px] text-destructive font-medium">{errors.password}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword" className="text-xs font-medium text-foreground">
              Confirmar senha
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Repita sua senha"
              value={formData.confirmPassword}
              disabled={isLoading}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  confirmPassword: e.target.value,
                }))
              }
              aria-invalid={!!errors.confirmPassword}
              autoComplete="new-password"
              required
            />
            {errors.confirmPassword && (
              <p className="text-[11px] text-destructive font-medium">
                {errors.confirmPassword}
              </p>
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
                Criando conta...
              </>
            ) : (
              "Criar conta"
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Já possui uma conta?{" "}
            <Link
              href="/login"
              className="font-semibold text-primary hover:text-primary-hover transition-colors"
            >
              Entrar
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
