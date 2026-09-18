import { db } from "@/db";
import { adminAuditLog, type AdminAuditLog } from "@/db/schema";
import { desc, eq, and } from "drizzle-orm";

export interface LogAdminActionInput {
  action:
    | "plan_changed"
    | "account_disabled"
    | "account_enabled"
    | "user_banned"
    | "user_unbanned"
    | "sessions_revoked"
    | "password_reset_requested"
    | "account_deleted"
    | "redeem_deleted"
    | "default_provider_changed"
    | "user_created"
    | "redeem_created";
  targetUserId?: string | null;
  targetAccountId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Persists an administrative action to admin_audit_log.
 * Strips sensitive tokens/keys from metadata.
 */
export async function logAdminAction(input: LogAdminActionInput): Promise<AdminAuditLog> {
  const safeMetadata = input.metadata ? { ...input.metadata } : {};

  // Defense-in-depth against accidental secret logging
  const sensitiveKeys = ["password", "token", "secret", "apiKey", "accessKey", "code"];
  for (const key of Object.keys(safeMetadata)) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s.toLowerCase()))) {
      delete safeMetadata[key];
    }
  }

  const [entry] = await db
    .insert(adminAuditLog)
    .values({
      action: input.action,
      targetUserId: input.targetUserId || null,
      targetAccountId: input.targetAccountId || null,
      metadataJson: Object.keys(safeMetadata).length > 0 ? JSON.stringify(safeMetadata) : null,
    })
    .returning();

  return entry;
}

export async function getRecentAdminAuditLogs(params?: {
  targetUserId?: string;
  targetAccountId?: string;
  limit?: number;
}): Promise<AdminAuditLog[]> {
  const conditions = [];

  if (params?.targetUserId) {
    conditions.push(eq(adminAuditLog.targetUserId, params.targetUserId));
  }
  if (params?.targetAccountId) {
    conditions.push(eq(adminAuditLog.targetAccountId, params.targetAccountId));
  }

  const query = db
    .select()
    .from(adminAuditLog)
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(params?.limit || 50);

  if (conditions.length > 0) {
    return await query.where(and(...conditions));
  }

  return await query;
}
