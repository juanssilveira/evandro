"use client";

import * as React from "react";
import { UserPlus, Sparkles, Calendar, ShieldCheck, Loader2 } from "lucide-react";
import { type DevUserRow } from "@/lib/dev/service";
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
import { createDevUserAction, updateDevUserPlanAction } from "@/app/actions/dev";

interface UsersViewProps {
  users: DevUserRow[];
}

export function UsersView({ users }: UsersViewProps) {
  const { toast } = useToast();


  // Create User Modal State
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [createPending, setCreatePending] = React.useState(false);
  const [createName, setCreateName] = React.useState("");
  const [createEmail, setCreateEmail] = React.useState("");
  const [createPassword, setCreatePassword] = React.useState("");

  // Manage Plan Modal State
  const [selectedUser, setSelectedUser] = React.useState<DevUserRow | null>(null);
  const [planMode, setPlanMode] = React.useState<"none" | "pro_permanent" | "pro_temporary">("pro_permanent");
  const [temporaryType, setTemporaryType] = React.useState<"days" | "date">("days");
  const [durationDays, setDurationDays] = React.useState("30");
  const [expirationDate, setExpirationDate] = React.useState("");
  const [planPending, setPlanPending] = React.useState(false);

  const handleOpenPlanModal = (u: DevUserRow) => {
    setSelectedUser(u);
    if (u.planCode === "pro" && u.subscriptionStatus === "active") {
      if (u.expiresAt) {
        setPlanMode("pro_temporary");
        setTemporaryType("date");
        setExpirationDate(new Date(u.expiresAt).toISOString().split("T")[0]);
      } else {
        setPlanMode("pro_permanent");
      }
    } else {
      setPlanMode("pro_permanent");
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatePending(true);

    const formData = new FormData();
    formData.append("name", createName);
    formData.append("email", createEmail);
    formData.append("password", createPassword);

    try {
      const res = await createDevUserAction(formData);
      if (res.success) {
        toast(`Usuário ${createEmail} criado com sucesso.`, "success");
        setIsCreateOpen(false);
        setCreateName("");
        setCreateEmail("");
        setCreatePassword("");
      } else {
        toast(res.error, "error");
      }
    } catch {
      toast("Falha ao criar usuário.", "error");
    } finally {
      setCreatePending(false);
    }
  };

  const handleUpdatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setPlanPending(true);

    const formData = new FormData();
    formData.append("userId", selectedUser.id);
    formData.append("mode", planMode);

    if (planMode === "pro_temporary") {
      if (temporaryType === "days") {
        formData.append("durationDays", durationDays);
      } else {
        formData.append("expirationDate", expirationDate);
      }
    }

    try {
      const res = await updateDevUserPlanAction(formData);
      if (res.success) {
        toast(`Plano de ${selectedUser.email} configurado com sucesso.`, "success");
        setSelectedUser(null);
      } else {
        toast(res.error, "error");
      }
    } catch {
      toast("Falha ao atualizar plano.", "error");
    } finally {
      setPlanPending(false);
    }
  };


  return (
    <div className="space-y-8">
      {/* Header with Title and Create Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Gerenciamento de Usuários
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Listagem, criação e atribuição de planos no ambiente local.
          </p>
        </div>

        <Button
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-2"
        >
          <UserPlus className="size-4" />
          <span>Criar Usuário</span>
        </Button>
      </div>

      {/* Users Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border text-xs text-muted-foreground uppercase font-medium">
              <tr>
                <th className="px-4 py-3">Usuário</th>
                <th className="px-4 py-3">Conta</th>
                <th className="px-4 py-3">Plano</th>
                <th className="px-4 py-3">Expiração</th>
                <th className="px-4 py-3 text-center">Vídeos</th>
                <th className="px-4 py-3 text-center">Plays Mês</th>
                <th className="px-4 py-3">Criado em</th>
                <th className="px-4 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isPro = u.planCode === "pro" && u.subscriptionStatus === "active";
                  return (
                    <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{u.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{u.email}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {u.accountName || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {isPro ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                            <Sparkles className="size-3" />
                            Pro
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground border border-border">
                            Sem plano
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {isPro
                          ? u.expiresAt
                            ? formatDate(u.expiresAt)
                            : "Sem vencimento"
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-xs">
                        {u.videoCount}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-xs">
                        {u.playsThisMonth.toLocaleString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDate(u.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenPlanModal(u)}
                        >
                          Alterar Plano
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Criar Usuário */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogPopup className="sm:max-w-md">
          <form onSubmit={handleCreateUser}>
            <DialogHeader>
              <DialogTitle>Criar Usuário Manualmente</DialogTitle>
              <DialogDescription>
                Cria um novo usuário utilizando o Better Auth e executa os hooks oficiais de provisionamento de conta.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="dev-name">Nome Completo</Label>
                <Input
                  id="dev-name"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Ex: João Silva"
                  required
                  disabled={createPending}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dev-email">E-mail</Label>
                <Input
                  id="dev-email"
                  type="email"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  placeholder="usuario@exemplo.com"
                  required
                  disabled={createPending}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dev-password">Senha Inicial</Label>
                <Input
                  id="dev-password"
                  type="password"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                  disabled={createPending}
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsCreateOpen(false)}
                disabled={createPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createPending}>
                {createPending && <Loader2 className="size-4 animate-spin mr-2" />}
                Criar Usuário
              </Button>
            </DialogFooter>
          </form>
        </DialogPopup>
      </Dialog>

      {/* Modal: Manipular Plano */}
      <Dialog
        open={Boolean(selectedUser)}
        onOpenChange={(open) => !open && setSelectedUser(null)}
      >
        <DialogPopup className="sm:max-w-md">
          <form onSubmit={handleUpdatePlan}>

            <DialogHeader>
              <DialogTitle>Configurar Plano do Usuário</DialogTitle>
              <DialogDescription>
                {selectedUser?.name} ({selectedUser?.email})
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Selecione o plano:</Label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
                    <input
                      type="radio"
                      name="planMode"
                      value="none"
                      checked={planMode === "none"}
                      onChange={() => setPlanMode("none")}
                      className="text-primary focus:ring-primary"
                    />
                    <div>
                      <div className="text-sm font-medium text-foreground">Sem plano</div>
                      <div className="text-xs text-muted-foreground">Inativa a assinatura atual do usuário</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
                    <input
                      type="radio"
                      name="planMode"
                      value="pro_permanent"
                      checked={planMode === "pro_permanent"}
                      onChange={() => setPlanMode("pro_permanent")}
                      className="text-primary focus:ring-primary"
                    />
                    <div>
                      <div className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        <ShieldCheck className="size-4 text-primary" />
                        Pro sem vencimento
                      </div>
                      <div className="text-xs text-muted-foreground">Acesso permanente ilimitado</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
                    <input
                      type="radio"
                      name="planMode"
                      value="pro_temporary"
                      checked={planMode === "pro_temporary"}
                      onChange={() => setPlanMode("pro_temporary")}
                      className="text-primary focus:ring-primary"
                    />
                    <div>
                      <div className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        <Calendar className="size-4 text-primary" />
                        Pro com vencimento
                      </div>
                      <div className="text-xs text-muted-foreground">Acesso com expiração configurável</div>
                    </div>
                  </label>
                </div>
              </div>

              {planMode === "pro_temporary" && (
                <div className="p-3 bg-muted/40 border border-border rounded-lg space-y-3">
                  <div className="flex items-center gap-4 text-xs font-medium">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="tempType"
                        checked={temporaryType === "days"}
                        onChange={() => setTemporaryType("days")}
                      />
                      <span>Por dias</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="tempType"
                        checked={temporaryType === "date"}
                        onChange={() => setTemporaryType("date")}
                      />
                      <span>Por data específica</span>
                    </label>
                  </div>

                  {temporaryType === "days" ? (
                    <div className="space-y-2">
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
                            {d} dias
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          value={durationDays}
                          onChange={(e) => setDurationDays(e.target.value)}
                          placeholder="Outros dias"
                          className="w-32"
                          required
                        />
                        <span className="text-xs text-muted-foreground">dias a partir de hoje</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Label htmlFor="dev-exp-date" className="text-xs">Data de Expiração</Label>
                      <Input
                        id="dev-exp-date"
                        type="date"
                        value={expirationDate}
                        onChange={(e) => setExpirationDate(e.target.value)}
                        required
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setSelectedUser(null)}
                disabled={planPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={planPending}>
                {planPending && <Loader2 className="size-4 animate-spin mr-2" />}
                Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        </DialogPopup>
      </Dialog>
    </div>
  );
}

