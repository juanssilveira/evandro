"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Sparkles,
  ShieldAlert,
  Ban,
  HardDrive,
  Clock,
  PlaySquare,
  Video,
  KeyRound,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  Trash2,
  CheckCircle2,
  LogOut,
  Calendar,
  AlertCircle,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { DevUserDetails, SetPlanMode } from "@/lib/dev/users";
import type { AdminEnvironment } from "@/lib/dev/env-config";
import { formatBytes, formatDuration, formatDate } from "@/lib/dev/formatters";
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
import {
  updateDevUserPlanAction,
  disableAccountAction,
  enableAccountAction,
  banUserAction,
  unbanUserAction,
  revokeUserSessionsAction,
  sendPasswordResetAction,
  deleteAccountAction,
} from "@/app/actions/dev";

interface UserDetailViewProps {
  details: DevUserDetails;
  env: AdminEnvironment;
}

export function UserDetailView({ details, env }: UserDetailViewProps) {
  const router = useRouter();
  const { toast } = useToast();

  const {
    user,
    account,
    currentPlan,
    subscriptionHistory,
    usage,
    providerSplit,
    videos: userVideos,
    redeemsUsed,
    sessions,
    dailyPlays,
    dailyUploads,
    emailServiceAvailable,
  } = details;

  // Action Pending States
  const [actionPending, setActionPending] = React.useState(false);

  // 1. Plan Dialog
  const [isPlanOpen, setIsPlanOpen] = React.useState(false);
  const [planMode, setPlanMode] = React.useState<SetPlanMode>(
    currentPlan.status === "active"
      ? currentPlan.expiresAt
        ? "pro_temporary"
        : "pro_permanent"
      : "none"
  );
  const [temporaryType, setTemporaryType] = React.useState<"days" | "date">("days");
  const [durationDays, setDurationDays] = React.useState("30");
  const [expirationDate, setExpirationDate] = React.useState(
    currentPlan.expiresAt ? new Date(currentPlan.expiresAt).toISOString().split("T")[0] : ""
  );

  // 2. Disable Account Dialog
  const [isDisableOpen, setIsDisableOpen] = React.useState(false);
  const [disableReason, setDisableReason] = React.useState("");

  // 3. Ban User Dialog
  const [isBanOpen, setIsBanOpen] = React.useState(false);
  const [banReason, setBanReason] = React.useState("");
  const [banDuration, setBanDuration] = React.useState<"permanent" | "1d" | "7d" | "30d" | "custom">("permanent");
  const [customBanDays, setCustomBanDays] = React.useState("30");

  // 4. Revoke Sessions Dialog
  const [isRevokeOpen, setIsRevokeOpen] = React.useState(false);

  // 5. Password Reset Dialog
  const [isResetOpen, setIsResetOpen] = React.useState(false);

  // 6. Delete Account Dialog (Danger Zone)
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [confirmAccountName, setConfirmAccountName] = React.useState("");

  // Handler: Update Plan
  const handleUpdatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionPending(true);

    const formData = new FormData();
    formData.append("env", env);
    formData.append("userId", user.id);
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
        toast(`Plano configurado com sucesso.`, "success");
        setIsPlanOpen(false);
        router.refresh();
      } else {
        toast(res.error, "error");
      }
    } catch {
      toast("Falha ao atualizar plano.", "error");
    } finally {
      setActionPending(false);
    }
  };

  // Handler: Disable Account
  const handleDisableAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) return;
    setActionPending(true);

    const formData = new FormData();
    formData.append("env", env);
    formData.append("accountId", account.id);
    formData.append("reason", disableReason);

    try {
      const res = await disableAccountAction(formData);
      if (res.success) {
        toast(`Conta desativada com sucesso.`, "success");
        setIsDisableOpen(false);
        router.refresh();
      } else {
        toast(res.error, "error");
      }
    } catch {
      toast("Falha ao desativar conta.", "error");
    } finally {
      setActionPending(false);
    }
  };

  // Handler: Enable Account
  const handleEnableAccount = async () => {
    if (!account) return;
    setActionPending(true);

    const formData = new FormData();
    formData.append("env", env);
    formData.append("accountId", account.id);

    try {
      const res = await enableAccountAction(formData);
      if (res.success) {
        toast(`Conta reativada com sucesso.`, "success");
        router.refresh();
      } else {
        toast(res.error, "error");
      }
    } catch {
      toast("Falha ao reativar conta.", "error");
    } finally {
      setActionPending(false);
    }
  };

  // Handler: Ban User
  const handleBanUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionPending(true);

    const formData = new FormData();
    formData.append("env", env);
    formData.append("userId", user.id);
    formData.append("banReason", banReason);
    formData.append("durationOption", banDuration);
    if (banDuration === "custom") {
      formData.append("customDays", customBanDays);
    }

    try {
      const res = await banUserAction(formData);
      if (res.success) {
        toast(`Usuário banido e sessões revogadas.`, "success");
        setIsBanOpen(false);
        router.refresh();
      } else {
        toast(res.error, "error");
      }
    } catch {
      toast("Falha ao banir usuário.", "error");
    } finally {
      setActionPending(false);
    }
  };

  // Handler: Unban User
  const handleUnbanUser = async () => {
    setActionPending(true);

    const formData = new FormData();
    formData.append("env", env);
    formData.append("userId", user.id);

    try {
      const res = await unbanUserAction(formData);
      if (res.success) {
        toast(`Banimento removido com sucesso.`, "success");
        router.refresh();
      } else {
        toast(res.error, "error");
      }
    } catch {
      toast("Falha ao desbanir usuário.", "error");
    } finally {
      setActionPending(false);
    }
  };

  // Handler: Revoke Sessions
  const handleRevokeSessions = async () => {
    setActionPending(true);

    const formData = new FormData();
    formData.append("env", env);
    formData.append("userId", user.id);

    try {
      const res = await revokeUserSessionsAction(formData);
      if (res.success) {
        toast(`Todas as sessões ativas foram revogadas.`, "success");
        setIsRevokeOpen(false);
        router.refresh();
      } else {
        toast(res.error, "error");
      }
    } catch {
      toast("Falha ao revogar sessões.", "error");
    } finally {
      setActionPending(false);
    }
  };

  // Handler: Send Password Reset
  const handleSendPasswordReset = async () => {
    setActionPending(true);

    const formData = new FormData();
    formData.append("env", env);
    formData.append("userId", user.id);

    try {
      const res = await sendPasswordResetAction(formData);
      if (res.success) {
        toast(`Email de redefinição de senha enviado para ${user.email}.`, "success");
        setIsResetOpen(false);
      } else {
        toast(res.error, "error");
      }
    } catch {
      toast("Falha ao solicitar redefinição de senha.", "error");
    } finally {
      setActionPending(false);
    }
  };

  // Handler: Delete Account
  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) return;
    setActionPending(true);

    const formData = new FormData();
    formData.append("env", env);
    formData.append("accountId", account.id);
    formData.append("confirmationName", confirmAccountName);

    try {
      const res = await deleteAccountAction(formData);
      if (res.success) {
        toast(`Conta ${account.name} e todos os vídeos foram excluídos com sucesso.`, "success");
        setIsDeleteOpen(false);
        router.push(`/dev?env=${env}&tab=users`);
        router.refresh();
      } else {
        toast(res.error, "error");
      }
    } catch {
      toast("Falha ao excluir conta.", "error");
    } finally {
      setActionPending(false);
    }
  };

  const isPro = currentPlan.status === "active";
  const isAccountDisabled = account?.status === "disabled";
  const isBanned = user.banned;

  return (
    <div className="space-y-8">
      {/* Back Link */}
      <div>
        <Link
          href={`/dev?env=${env}&tab=users`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
        >
          <ArrowLeft className="size-3.5" />
          <span>Voltar para usuários</span>
        </Link>
      </div>

      {/* User Header Card */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {user.name}
              </h1>

              {/* Status Badges */}
              {isBanned && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/20">
                  <Ban className="size-3" />
                  Usuário Banido
                </span>
              )}
              {isAccountDisabled && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <ShieldAlert className="size-3" />
                  Conta Desativada
                </span>
              )}
              {isPro ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                  <Sparkles className="size-3" />
                  Plano Pro
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                  Sem Plano
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground font-mono">
              <span>{user.email}</span>
              <span>·</span>
              <span>Cadastrado em {formatDate(user.createdAt)}</span>
              <span>·</span>
              <span>{user.emailVerified ? "Email verificado" : "Email não verificado"}</span>
            </div>

            {/* Banned details banner */}
            {isBanned && (
              <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive flex items-start gap-2">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block">Banimento ativo</span>
                  <span>Motivo: {user.banReason || "Não especificado"}. </span>
                  <span>Expira em: {user.banExpires ? formatDate(user.banExpires, true) : "Permanente"}.</span>
                </div>
              </div>
            )}

            {/* Disabled account banner */}
            {isAccountDisabled && (
              <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                <ShieldAlert className="size-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block">Conta desativada</span>
                  <span>{account?.disabledReason ? `Motivo: ${account.disabledReason}. ` : ""}</span>
                  <span>O acesso aos recursos e reproduções está bloqueado.</span>
                </div>
              </div>
            )}
          </div>

          {/* Account Metadata Box */}
          <div className="p-4 bg-muted/40 border border-border rounded-lg text-xs space-y-1.5 md:min-w-[280px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Conta:</span>
              <span className="font-semibold text-foreground">{account?.name || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">User ID:</span>
              <span className="font-mono text-[11px] text-muted-foreground">{user.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Account ID:</span>
              <span className="font-mono text-[11px] text-muted-foreground">{account?.id || "—"}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons Hub */}
        <div className="pt-4 border-t border-border space-y-3">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Ações Operacionais
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Normal Actions */}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsPlanOpen(true)}
              className="inline-flex items-center gap-1.5"
            >
              <Sparkles className="size-3.5 text-primary" />
              <span>Alterar Plano</span>
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsResetOpen(true)}
              className="inline-flex items-center gap-1.5"
            >
              <KeyRound className="size-3.5" />
              <span>Redefinir Senha</span>
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsRevokeOpen(true)}
              className="inline-flex items-center gap-1.5"
            >
              <LogOut className="size-3.5" />
              <span>Revogar Sessões ({sessions.length})</span>
            </Button>

            {/* Administrative Actions */}
            <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

            {isAccountDisabled ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleEnableAccount}
                disabled={actionPending}
                className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
              >
                <CheckCircle2 className="size-3.5" />
                <span>Reativar Conta</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDisableOpen(true)}
                className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
              >
                <ShieldAlert className="size-3.5" />
                <span>Desativar Conta</span>
              </Button>
            )}

            {isBanned ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleUnbanUser}
                disabled={actionPending}
                className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
              >
                <CheckCircle2 className="size-3.5" />
                <span>Remover Banimento</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsBanOpen(true)}
                className="inline-flex items-center gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                <Ban className="size-3.5" />
                <span>Banir Usuário</span>
              </Button>
            )}

            {/* Danger Zone Action */}
            <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

            {account && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setConfirmAccountName("");
                  setIsDeleteOpen(true);
                }}
                className="inline-flex items-center gap-1.5"
              >
                <Trash2 className="size-3.5" />
                <span>Excluir Conta</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Account Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Videos Count */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Vídeos
            </span>
            <Video className="size-4 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-foreground">
              {usage.videoCount}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              / {isPro ? usage.maxVideos : "0"}
            </span>
          </div>
          {isPro && (
            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-blue-500 h-1.5 rounded-full"
                style={{ width: `${Math.min(100, (usage.videoCount / (usage.maxVideos || 1)) * 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* Monthly Plays */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Plays do Mês
            </span>
            <PlaySquare className="size-4 text-violet-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-foreground">
              {usage.playsThisMonth.toLocaleString("pt-BR")}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              / {isPro ? usage.maxPlays.toLocaleString("pt-BR") : "0"}
            </span>
          </div>
          {isPro && (
            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-violet-500 h-1.5 rounded-full"
                style={{ width: `${Math.min(100, (usage.playsThisMonth / (usage.maxPlays || 1)) * 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* Media Size */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Armazenamento
            </span>
            <HardDrive className="size-4 text-cyan-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-foreground">
            {formatBytes(usage.totalSizeBytes)}
          </div>
          <div className="text-[11px] text-muted-foreground">Volume de arquivos</div>
        </div>

        {/* Total Duration */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Duração Total
            </span>
            <Clock className="size-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-foreground">
            {formatDuration(usage.totalDurationSeconds)}
          </div>
          <div className="text-[11px] text-muted-foreground">Tempo total hospedado</div>
        </div>

        {/* Active Sessions */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Sessões Ativas
            </span>
            <LogOut className="size-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-foreground">
            {usage.activeSessionsCount}
          </div>
          <div className="text-[11px] text-muted-foreground">Dispositivos conectados</div>
        </div>
      </div>

      {/* User Analytics Charts (30 Days Plays + Uploads) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plays Chart */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-xs space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Plays — Últimos 30 Dias</h3>
            <p className="text-xs text-muted-foreground">Reproduções deste usuário.</p>
          </div>
          <div className="h-56 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyPlays} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="userPlaysGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #27272a)" opacity={0.4} vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="var(--muted-foreground, #71717a)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val: string) => {
                    const parts = val.split("-");
                    return `${parts[2]}/${parts[1]}`;
                  }}
                />
                <YAxis
                  stroke="var(--muted-foreground, #71717a)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card, #18181b)",
                    borderColor: "var(--border, #27272a)",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "var(--foreground, #fafafa)",
                  }}
                  labelFormatter={(label) => typeof label === "string" ? `Data: ${formatDate(label)}` : String(label ?? "")}
                />
                <Area type="monotone" dataKey="plays" stroke="#6366f1" strokeWidth={2} fill="url(#userPlaysGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Uploads Chart */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-xs space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Uploads — Últimos 30 Dias</h3>
            <p className="text-xs text-muted-foreground">Vídeos enviados por este usuário.</p>
          </div>
          <div className="h-56 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyUploads} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #27272a)" opacity={0.4} vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="var(--muted-foreground, #71717a)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val: string) => {
                    const parts = val.split("-");
                    return `${parts[2]}/${parts[1]}`;
                  }}
                />
                <YAxis
                  stroke="var(--muted-foreground, #71717a)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card, #18181b)",
                    borderColor: "var(--border, #27272a)",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "var(--foreground, #fafafa)",
                  }}
                  labelFormatter={(label) => typeof label === "string" ? `Data: ${formatDate(label)}` : String(label ?? "")}
                />
                <Bar dataKey="uploads" name="Uploads" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Provider Split */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Consumo por Provider</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-4 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-[#FF2B6D]" />
                <span className="text-xs font-semibold text-foreground">Mux</span>
              </div>
              <span className="text-xs font-mono text-muted-foreground">
                {providerSplit.mux.videoCount} {providerSplit.mux.videoCount === 1 ? "vídeo" : "vídeos"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/60 text-xs font-mono">
              <div>
                <span className="text-muted-foreground block text-[10px]">Tamanho</span>
                <span>{formatBytes(providerSplit.mux.totalSizeBytes)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">Duração</span>
                <span>{formatDuration(providerSplit.mux.totalDurationSeconds)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">Plays</span>
                <span>{providerSplit.mux.plays.toLocaleString("pt-BR")}</span>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-[#FF8400]" />
                <span className="text-xs font-semibold text-foreground">Bunny Stream</span>
              </div>
              <span className="text-xs font-mono text-muted-foreground">
                {providerSplit.bunny.videoCount} {providerSplit.bunny.videoCount === 1 ? "vídeo" : "vídeos"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/60 text-xs font-mono">
              <div>
                <span className="text-muted-foreground block text-[10px]">Tamanho</span>
                <span>{formatBytes(providerSplit.bunny.totalSizeBytes)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">Duração</span>
                <span>{formatDuration(providerSplit.bunny.totalDurationSeconds)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">Plays</span>
                <span>{providerSplit.bunny.plays.toLocaleString("pt-BR")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Videos List Table */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          Vídeos do Usuário ({userVideos.length})
        </h3>
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b border-border text-xs text-muted-foreground uppercase font-medium">
                <tr>
                  <th className="px-4 py-3">Título</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Duração</th>
                  <th className="px-4 py-3">Tamanho</th>
                  <th className="px-4 py-3 text-center">Plays</th>
                  <th className="px-4 py-3 text-right">Criado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {userVideos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground text-xs">
                      Nenhum vídeo cadastrado nesta conta.
                    </td>
                  </tr>
                ) : (
                  userVideos.map((v) => (
                    <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/videos/${v.id}`}
                          className="font-medium text-foreground hover:text-primary transition-colors block"
                        >
                          {v.title}
                        </Link>
                        <span className="text-[11px] text-muted-foreground font-mono">{v.publicId}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs font-mono uppercase">
                          <span
                            className={`size-2 rounded-full ${
                              v.provider === "bunny" ? "bg-[#FF8400]" : "bg-[#FF2B6D]"
                            }`}
                          />
                          {v.provider}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {v.status === "ready" ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Ready</span>
                        ) : v.status === "errored" ? (
                          <span className="text-destructive font-medium">Erro</span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 font-medium">{v.status}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                        {v.duration ? formatDuration(v.duration) : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                        {formatBytes(v.sizeBytes)}
                      </td>
                      <td className="px-4 py-3 text-center text-xs font-mono">
                        {v.plays.toLocaleString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground font-mono">
                        {formatDate(v.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Subscription History Table */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          Histórico de Assinaturas ({subscriptionHistory.length})
        </h3>
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b border-border text-xs text-muted-foreground uppercase font-medium">
                <tr>
                  <th className="px-4 py-3">Plano</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Início</th>
                  <th className="px-4 py-3">Expiração</th>
                  <th className="px-4 py-3">Encerramento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {subscriptionHistory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground text-xs">
                      Nenhuma assinatura registrada.
                    </td>
                  </tr>
                ) : (
                  subscriptionHistory.map((s) => (
                    <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground uppercase text-xs">
                        {s.planCode}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {s.status === "active" ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Ativa</span>
                        ) : (
                          <span className="text-muted-foreground">Inativa</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                        {formatDate(s.startedAt)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                        {s.expiresAt ? formatDate(s.expiresAt) : "Permanente"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                        {s.endedAt ? formatDate(s.endedAt) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Used Redeem Codes Section (if any) */}
      {redeemsUsed.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            Códigos Promocionais Resgatados ({redeemsUsed.length})
          </h3>
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 border-b border-border text-xs text-muted-foreground uppercase font-medium">
                  <tr>
                    <th className="px-4 py-3">Plano</th>
                    <th className="px-4 py-3">Duração Concedida</th>
                    <th className="px-4 py-3">Data do Resgate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {redeemsUsed.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground uppercase text-xs">
                        {r.planCode}
                      </td>
                      <td className="px-4 py-3 text-xs text-foreground">
                        {r.durationDays} dias
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                        {formatDate(r.usedAt, true)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Active Sessions List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            Sessões Ativas ({sessions.length})
          </h3>
          {sessions.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRevokeOpen(true)}
              className="text-xs"
            >
              Revogar todas as sessões
            </Button>
          )}
        </div>
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b border-border text-xs text-muted-foreground uppercase font-medium">
                <tr>
                  <th className="px-4 py-3">Criada em</th>
                  <th className="px-4 py-3">Expira em</th>
                  <th className="px-4 py-3">IP</th>
                  <th className="px-4 py-3">Navegador / User Agent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground text-xs">
                      Nenhuma sessão ativa encontrada.
                    </td>
                  </tr>
                ) : (
                  sessions.map((s) => (
                    <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                        {formatDate(s.createdAt, true)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                        {formatDate(s.expiresAt, true)}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-foreground">
                        {s.ipAddress || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-xs">
                        {s.userAgent || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal 1: Plan Configuration */}
      <Dialog open={isPlanOpen} onOpenChange={setIsPlanOpen}>
        <DialogPopup className="sm:max-w-md">
          <form onSubmit={handleUpdatePlan}>
            <DialogHeader>
              <DialogTitle>Configurar Plano do Usuário</DialogTitle>
              <DialogDescription>
                {user.name} ({user.email})
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
                      <Label htmlFor="exp-date-modal" className="text-xs">Data de Expiração</Label>
                      <Input
                        id="exp-date-modal"
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
                onClick={() => setIsPlanOpen(false)}
                disabled={actionPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={actionPending}>
                {actionPending && <Loader2 className="size-4 animate-spin mr-2" />}
                Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        </DialogPopup>
      </Dialog>

      {/* Modal 2: Disable Account */}
      <Dialog open={isDisableOpen} onOpenChange={setIsDisableOpen}>
        <DialogPopup className="sm:max-w-md">
          <form onSubmit={handleDisableAccount}>
            <DialogHeader>
              <DialogTitle>Desativar Conta</DialogTitle>
              <DialogDescription>
                A conta ficará bloqueada para uso do produto e embeds públicos. Todos os dados, vídeos e plano permanecem preservados.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-2">
              <Label htmlFor="disable-reason">Motivo da desativação (opcional)</Label>
              <Input
                id="disable-reason"
                value={disableReason}
                onChange={(e) => setDisableReason(e.target.value)}
                placeholder="Ex: Suspeita de fraude, pendência cadastral..."
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsDisableOpen(false)}
                disabled={actionPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="default"
                disabled={actionPending}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {actionPending && <Loader2 className="size-4 animate-spin mr-2" />}
                Confirmar Desativação
              </Button>
            </DialogFooter>
          </form>
        </DialogPopup>
      </Dialog>

      {/* Modal 3: Ban User */}
      <Dialog open={isBanOpen} onOpenChange={setIsBanOpen}>
        <DialogPopup className="sm:max-w-md">
          <form onSubmit={handleBanUser}>
            <DialogHeader>
              <DialogTitle>Banir Usuário</DialogTitle>
              <DialogDescription>
                O usuário não conseguirá mais realizar login na plataforma e todas as sessões ativas serão revogadas imediatamente.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="ban-reason">Motivo do Banimento</Label>
                <Input
                  id="ban-reason"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="Ex: Violação grave dos termos"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Duração do Banimento</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "permanent" as const, label: "Permanente" },
                    { id: "1d" as const, label: "1 dia" },
                    { id: "7d" as const, label: "7 dias" },
                    { id: "30d" as const, label: "30 dias" },
                    { id: "custom" as const, label: "Personalizada" },
                  ].map((d) => (
                    <button
                      type="button"
                      key={d.id}
                      onClick={() => setBanDuration(d.id)}
                      className={`px-3 py-2 text-xs rounded-lg border text-left transition-colors ${
                        banDuration === d.id
                          ? "border-destructive bg-destructive/10 text-destructive font-semibold"
                          : "border-border bg-card text-foreground hover:bg-muted"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>

                {banDuration === "custom" && (
                  <div className="pt-2">
                    <Label htmlFor="custom-ban-days" className="text-xs">Dias de Banimento</Label>
                    <Input
                      id="custom-ban-days"
                      type="number"
                      min={1}
                      value={customBanDays}
                      onChange={(e) => setCustomBanDays(e.target.value)}
                      required
                    />
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsBanOpen(false)}
                disabled={actionPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={actionPending}
              >
                {actionPending && <Loader2 className="size-4 animate-spin mr-2" />}
                Confirmar Banimento
              </Button>
            </DialogFooter>
          </form>
        </DialogPopup>
      </Dialog>

      {/* Modal 4: Revoke Sessions */}
      <Dialog open={isRevokeOpen} onOpenChange={setIsRevokeOpen}>
        <DialogPopup className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Revogar Todas as Sessões?</DialogTitle>
            <DialogDescription>
              Isso desconectará o usuário de todos os dispositivos ativos ({sessions.length} sessões encontradas).
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsRevokeOpen(false)}
              disabled={actionPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={handleRevokeSessions}
              disabled={actionPending}
            >
              {actionPending && <Loader2 className="size-4 animate-spin mr-2" />}
              Revogar Sessões
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      {/* Modal 5: Password Reset */}
      <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
        <DialogPopup className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar Redefinição de Senha?</DialogTitle>
            <DialogDescription>
              Um link seguro para definição de nova senha será enviado para {user.email}.
            </DialogDescription>
          </DialogHeader>

          {!emailServiceAvailable && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2 mt-2">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <span>
                Atenção: A variável RESEND_API_KEY não está configurada no ambiente. O envio irá retornar aviso de serviço indisponível.
              </span>
            </div>
          )}

          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsResetOpen(false)}
              disabled={actionPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={handleSendPasswordReset}
              disabled={actionPending}
            >
              {actionPending && <Loader2 className="size-4 animate-spin mr-2" />}
              Enviar Email de Reset
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      {/* Modal 6: Delete Account (Danger Zone) */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogPopup className="sm:max-w-lg">
          <form onSubmit={handleDeleteAccount}>
            <DialogHeader>
              <DialogTitle className="text-destructive flex items-center gap-2">
                <AlertTriangle className="size-5" />
                Exclusão Definitiva de Conta
              </DialogTitle>
              <DialogDescription className="text-left space-y-2 pt-2">
                <span className="block font-medium text-foreground">
                  Esta ação é destrutiva e irreversível.
                </span>
                <span className="block text-xs">
                  Todos os vídeos ({userVideos.length}) serão permanentemente excluídos do Mux e Bunny, os previews R2 serão apagados, e a conta será removida da base.
                </span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-4 text-left">
              <Label htmlFor="confirm-account-name" className="text-xs">
                Digite exatamente o nome da conta (<span className="font-semibold text-foreground font-mono">{account?.name}</span>) para confirmar:
              </Label>
              <Input
                id="confirm-account-name"
                value={confirmAccountName}
                onChange={(e) => setConfirmAccountName(e.target.value)}
                placeholder={account?.name}
                autoComplete="off"
                required
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsDeleteOpen(false)}
                disabled={actionPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={
                  actionPending ||
                  confirmAccountName.trim().toLowerCase() !== (account?.name || "").trim().toLowerCase()
                }
              >
                {actionPending && <Loader2 className="size-4 animate-spin mr-2" />}
                Excluir Conta Permanentemente
              </Button>
            </DialogFooter>
          </form>
        </DialogPopup>
      </Dialog>
    </div>
  );
}
