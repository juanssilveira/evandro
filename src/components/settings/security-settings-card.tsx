"use client";

import * as React from "react";
import { authClient } from "@/lib/auth-client";
import { changePasswordSchema } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { Loader2, CheckCircle2, KeyRound, Eye, EyeOff } from "lucide-react";

export function SecuritySettingsCard() {
  const { toast } = useToast();

  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");

  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  const [isPending, setIsPending] = React.useState(false);
  const [errors, setErrors] = React.useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
    general?: string;
  }>({});
  const [success, setSuccess] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPending) return;

    setErrors({});
    setSuccess(false);

    const validation = changePasswordSchema.safeParse({
      currentPassword,
      newPassword,
      confirmPassword,
    });

    if (!validation.success) {
      const fieldErrors: typeof errors = {};
      for (const issue of validation.error.issues) {
        const field = issue.path[0] as keyof typeof errors;
        if (field && !fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setIsPending(true);

    try {
      const result = await authClient.changePassword({
        currentPassword: validation.data.currentPassword,
        newPassword: validation.data.newPassword,
        revokeOtherSessions: false,
      });

      if (result?.error) {
        const errorMsg =
          result.error.message?.toLowerCase().includes("invalid") ||
          result.error.status === 400 ||
          result.error.status === 401
            ? "A senha atual informada está incorreta."
            : result.error.message || "Erro ao alterar a senha. Tente novamente.";

        setErrors({ general: errorMsg });
        setIsPending(false);
        return;
      }

      // Success
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setSuccess(true);
      toast("Senha alterada com sucesso.", "success");
    } catch {
      setErrors({
        general: "Ocorreu um erro inesperado ao alterar a senha. Tente novamente.",
      });
    } finally {
      setIsPending(false);
    }
  };

  const hasFilledFields =
    currentPassword.length > 0 ||
    newPassword.length > 0 ||
    confirmPassword.length > 0;

  return (
    <Card className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
      <CardHeader className="p-5 sm:p-6 border-b border-border/70 bg-muted/10">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0">
            <KeyRound className="size-4.5" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-foreground">
              Segurança
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Atualize sua senha de acesso para manter sua conta protegida.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="p-5 sm:p-6 space-y-5">
          {errors.general && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive font-medium flex items-center gap-2"
            >
              <span>{errors.general}</span>
            </div>
          )}

          {success && (
            <div
              role="status"
              className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-2"
            >
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>Sua senha foi alterada com sucesso.</span>
            </div>
          )}

          <div className="space-y-4 max-w-xl">
            {/* Current Password */}
            <div className="space-y-1.5">
              <Label
                htmlFor="current-password"
                className="text-xs font-medium text-foreground"
              >
                Senha atual
              </Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  disabled={isPending}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    setSuccess(false);
                    if (errors.currentPassword || errors.general) {
                      setErrors((prev) => ({
                        ...prev,
                        currentPassword: undefined,
                        general: undefined,
                      }));
                    }
                  }}
                  placeholder="••••••••"
                  className="h-9 pr-10"
                  required
                  autoComplete="current-password"
                  aria-invalid={!!errors.currentPassword}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword((prev) => !prev)}
                  tabIndex={-1}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 size-7 inline-flex items-center justify-center text-muted-foreground hover:text-foreground rounded-md transition-colors"
                  aria-label={
                    showCurrentPassword
                      ? "Ocultar senha atual"
                      : "Mostrar senha atual"
                  }
                >
                  {showCurrentPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              {errors.currentPassword && (
                <p className="text-[11px] text-destructive font-medium">
                  {errors.currentPassword}
                </p>
              )}
            </div>

            {/* New Password & Confirm Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* New Password */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="new-password"
                  className="text-xs font-medium text-foreground"
                >
                  Nova senha
                </Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    disabled={isPending}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setSuccess(false);
                      if (errors.newPassword || errors.general) {
                        setErrors((prev) => ({
                          ...prev,
                          newPassword: undefined,
                          general: undefined,
                        }));
                      }
                    }}
                    placeholder="Mínimo 8 caracteres"
                    className="h-9 pr-10"
                    required
                    autoComplete="new-password"
                    aria-invalid={!!errors.newPassword}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    tabIndex={-1}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 size-7 inline-flex items-center justify-center text-muted-foreground hover:text-foreground rounded-md transition-colors"
                    aria-label={
                      showNewPassword
                        ? "Ocultar nova senha"
                        : "Mostrar nova senha"
                    }
                  >
                    {showNewPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
                {errors.newPassword && (
                  <p className="text-[11px] text-destructive font-medium">
                    {errors.newPassword}
                  </p>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="confirm-password"
                  className="text-xs font-medium text-foreground"
                >
                  Confirmar nova senha
                </Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    disabled={isPending}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setSuccess(false);
                      if (errors.confirmPassword || errors.general) {
                        setErrors((prev) => ({
                          ...prev,
                          confirmPassword: undefined,
                          general: undefined,
                        }));
                      }
                    }}
                    placeholder="Repita a nova senha"
                    className="h-9 pr-10"
                    required
                    autoComplete="new-password"
                    aria-invalid={!!errors.confirmPassword}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    tabIndex={-1}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 size-7 inline-flex items-center justify-center text-muted-foreground hover:text-foreground rounded-md transition-colors"
                    aria-label={
                      showConfirmPassword
                        ? "Ocultar confirmação"
                        : "Mostrar confirmação"
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-[11px] text-destructive font-medium">
                    {errors.confirmPassword}
                  </p>
                )}
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              A senha deve ter pelo menos 8 caracteres.
            </p>
          </div>
        </CardContent>

        <div className="flex items-center justify-end px-5 py-3.5 sm:px-6 border-t border-border/70 bg-muted/5">
          <Button
            type="submit"
            size="default"
            disabled={isPending || !hasFilledFields}
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Atualizando senha...</span>
              </>
            ) : (
              <span>Atualizar senha</span>
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
}
