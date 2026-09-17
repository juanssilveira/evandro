"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { updateNameSchema } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { Loader2, CheckCircle2, User, Lock } from "lucide-react";

interface AccountSettingsCardProps {
  initialName: string;
  email: string;
}

export function AccountSettingsCard({ initialName, email }: AccountSettingsCardProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = React.useState(initialName);
  const [prevInitialName, setPrevInitialName] = React.useState(initialName);
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  // Sync state if initialName changes from server revalidation
  if (prevInitialName !== initialName) {
    setPrevInitialName(initialName);
    setName(initialName);
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPending) return;

    setError(null);
    setSuccess(false);

    const validation = updateNameSchema.safeParse({ name });
    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? "Nome inválido");
      return;
    }

    // Don't call API if name hasn't changed
    if (name.trim() === initialName.trim()) {
      setSuccess(true);
      return;
    }

    setIsPending(true);

    try {
      const result = await authClient.updateUser({
        name: validation.data.name,
      });

      if (result?.error) {
        setError(result.error.message || "Erro ao atualizar o nome. Tente novamente.");
        setIsPending(false);
        return;
      }

      setSuccess(true);
      toast("Nome alterado com sucesso.", "success");
      router.refresh();
    } catch {
      setError("Ocorreu um erro inesperado ao salvar. Tente novamente.");
    } finally {
      setIsPending(false);
    }
  };

  const hasChanges = name.trim() !== initialName.trim();

  return (
    <Card className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
      <CardHeader className="p-5 sm:p-6 border-b border-border/70 bg-muted/10">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0">
            <User className="size-4.5" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-foreground">
              Conta
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Informações pessoais e dados de identificação do seu perfil.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="p-5 sm:p-6 space-y-5">
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive font-medium flex items-center gap-2"
            >
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div
              role="status"
              className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-2"
            >
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>Dados da conta atualizados com sucesso.</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Nome Field */}
            <div className="space-y-1.5">
              <Label htmlFor="account-name" className="text-xs font-medium text-foreground">
                Nome completo
              </Label>
              <Input
                id="account-name"
                type="text"
                value={name}
                disabled={isPending}
                onChange={(e) => {
                  setName(e.target.value);
                  setSuccess(false);
                  if (error) setError(null);
                }}
                placeholder="Seu nome"
                className="h-9"
                required
                maxLength={100}
                aria-invalid={!!error}
              />
              <p className="text-[11px] text-muted-foreground">
                Nome exibido no menu e nos relatórios da sua conta.
              </p>
            </div>

            {/* Email Field (Read-only) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="account-email" className="text-xs font-medium text-foreground">
                  E-mail de acesso
                </Label>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                  <Lock className="size-2.5" />
                  Somente leitura
                </span>
              </div>
              <div className="relative">
                <Input
                  id="account-email"
                  type="email"
                  value={email}
                  readOnly
                  disabled
                  className="h-9 bg-zinc-50 dark:bg-zinc-800/50 text-muted-foreground cursor-not-allowed border-dashed"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                O e-mail é utilizado para login e não pode ser alterado diretamente.
              </p>
            </div>
          </div>
        </CardContent>

        <div className="flex items-center justify-end px-5 py-3.5 sm:px-6 border-t border-border/70 bg-muted/5">
          <Button
            type="submit"
            size="default"
            disabled={isPending || !hasChanges}
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Salvando...</span>
              </>
            ) : (
              <span>Salvar alterações</span>
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
}
