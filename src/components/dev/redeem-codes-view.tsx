"use client";

import * as React from "react";
import { KeyRound, Plus, Copy, Check, AlertTriangle, Loader2 } from "lucide-react";
import { type DevRedeemCodeRow } from "@/lib/dev/service";
import { formatDate } from "@/lib/dev/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogPopup,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { createDevRedeemCodeAction } from "@/app/actions/dev";

interface RedeemCodesViewProps {
  codes: DevRedeemCodeRow[];
}

export function RedeemCodesView({ codes }: RedeemCodesViewProps) {
  const { toast } = useToast();

  const [isGenerateOpen, setIsGenerateOpen] = React.useState(false);
  const [generatePending, setGeneratePending] = React.useState(false);
  const [durationDays, setDurationDays] = React.useState("7");
  const [planCode] = React.useState("pro");

  // State for newly generated code display (one-time)
  const [newlyGeneratedCode, setNewlyGeneratedCode] = React.useState<{
    code: string;
    durationDays: number;
  } | null>(null);
  const [copied, setCopied] = React.useState(false);

  const handleGenerateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneratePending(true);

    const formData = new FormData();
    formData.append("durationDays", durationDays);
    formData.append("planCode", planCode);

    try {
      const res = await createDevRedeemCodeAction(formData);
      if (res.success) {
        setNewlyGeneratedCode({
          code: res.data.code,
          durationDays: res.data.durationDays,
        });
        setIsGenerateOpen(false);
        toast("Código de resgate criado com sucesso.", "success");
      } else {
        toast(res.error, "error");
      }
    } catch {
      toast("Falha ao gerar código de resgate.", "error");
    } finally {
      setGeneratePending(false);
    }
  };

  const handleCopyCode = async (codeToCopy: string) => {
    try {
      await navigator.clipboard.writeText(codeToCopy);
      setCopied(true);
      toast("Código copiado para a área de transferência.", "info");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };


  return (
    <div className="space-y-8">
      {/* Header with Title and Generate Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Códigos de Resgate (Redeem Codes)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gere e acompanhe códigos promocionais para liberação de acesso Pro.
          </p>
        </div>

        <Button
          onClick={() => {
            setNewlyGeneratedCode(null);
            setIsGenerateOpen(true);
          }}
          className="inline-flex items-center gap-2"
        >
          <Plus className="size-4" />
          <span>Gerar Novo Código</span>
        </Button>
      </div>

      {/* One-time Newly Generated Code Card */}
      {newlyGeneratedCode && (
        <div className="p-5 bg-primary/5 border border-primary/20 rounded-lg space-y-3 animate-in fade-in slide-in-from-top-2 duration-200 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <KeyRound className="size-4" />
              <span>Código Gerado com Sucesso</span>
            </div>
            <button
              onClick={() => setNewlyGeneratedCode(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Fechar aviso
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-background border border-border rounded-md">
            <div>
              <div className="text-xs text-muted-foreground">Código de Resgate:</div>
              <div className="text-lg font-mono font-bold tracking-wider text-foreground select-all">
                {newlyGeneratedCode.code}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground mr-2">
                Duração: {newlyGeneratedCode.durationDays} dias
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleCopyCode(newlyGeneratedCode.code)}
                className="inline-flex items-center gap-1.5"
              >
                {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                <span>{copied ? "Copiado!" : "Copiar"}</span>
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="size-3.5 shrink-0" />
            <span>
              Copie o código agora. Por razões de segurança, apenas o hash é persistido e ele não poderá ser visualizado novamente.
            </span>
          </div>
        </div>
      )}

      {/* Codes List Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border text-xs text-muted-foreground uppercase font-medium">
              <tr>
                <th className="px-4 py-3">Criado em</th>
                <th className="px-4 py-3">Plano</th>
                <th className="px-4 py-3">Duração</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Utilizado em</th>
                <th className="px-4 py-3">Utilizado por</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {codes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum código gerado até o momento.
                  </td>
                </tr>
              ) : (
                codes.map((c) => {
                  const isUsed = Boolean(c.usedAt);
                  return (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                        {formatDate(c.createdAt, true)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                          Pro
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-foreground">
                        {c.durationDays} dias
                      </td>
                      <td className="px-4 py-3">
                        {isUsed ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground border border-border">
                            Utilizado
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            Disponível
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {c.usedAt ? formatDate(c.usedAt, true) : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {c.usedByUser ? (
                          <div>
                            <span className="font-medium text-foreground">{c.usedByUser.name}</span>
                            <span className="block font-mono text-[11px] text-muted-foreground">
                              {c.usedByUser.email}
                            </span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Gerar Redeem Code */}
      <Dialog open={isGenerateOpen} onOpenChange={setIsGenerateOpen}>
        <DialogPopup className="sm:max-w-md">
          <form onSubmit={handleGenerateCode}>
            <DialogHeader>
              <DialogTitle>Gerar Código de Resgate</DialogTitle>
              <DialogDescription>
                Gera um código criptograficamente seguro no padrão EVN-XXXX-XXXX-XXXX.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="dev-plan-code">Plano</Label>
                <Input
                  id="dev-plan-code"
                  value="Pro"
                  disabled
                  className="bg-muted text-muted-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dev-duration">Duração do Acesso (dias)</Label>
                <div className="flex items-center gap-2">
                  {["7", "14", "30", "90", "365"].map((d) => (
                    <button
                      type="button"
                      key={d}
                      onClick={() => setDurationDays(d)}
                      className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                        durationDays === d
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-foreground border-border hover:bg-muted"
                      }`}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
                <Input
                  id="dev-duration"
                  type="number"
                  min={1}
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value)}
                  placeholder="Dias (ex: 7)"
                  required
                  disabled={generatePending}
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsGenerateOpen(false)}
                disabled={generatePending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={generatePending}>
                {generatePending && <Loader2 className="size-4 animate-spin mr-2" />}
                Gerar Código
              </Button>
            </DialogFooter>
          </form>
        </DialogPopup>
      </Dialog>
    </div>
  );
}

