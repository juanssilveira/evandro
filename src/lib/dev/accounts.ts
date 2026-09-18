import { db } from "@/db";
import {
  accounts,
  accountMembers,
  videos,
  subscriptions,
  session,
  type Video,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getVideoProvider } from "@/lib/video-providers";
import { deleteAssetObject } from "@/lib/asset-storage/r2";
import { assertLocalDevPanelAccess } from "./guard";
import { logAdminAction } from "./audit";

export async function disableDevAccount(accountId: string, reason?: string) {
  await assertLocalDevPanelAccess();

  const now = new Date();
  const trimmedReason = reason?.trim() || null;

  const [updated] = await db
    .update(accounts)
    .set({
      status: "disabled",
      disabledAt: now,
      disabledReason: trimmedReason,
      updatedAt: now,
    })
    .where(eq(accounts.id, accountId))
    .returning();

  if (!updated) {
    throw new Error("Conta não encontrada.");
  }

  await logAdminAction({
    action: "account_disabled",
    targetAccountId: accountId,
    metadata: { reason: trimmedReason },
  });

  return { success: true, account: updated };
}

export async function enableDevAccount(accountId: string) {
  await assertLocalDevPanelAccess();

  const now = new Date();

  const [updated] = await db
    .update(accounts)
    .set({
      status: "active",
      disabledAt: null,
      disabledReason: null,
      updatedAt: now,
    })
    .where(eq(accounts.id, accountId))
    .returning();

  if (!updated) {
    throw new Error("Conta não encontrada.");
  }

  await logAdminAction({
    action: "account_enabled",
    targetAccountId: accountId,
  });

  return { success: true, account: updated };
}

export interface DeleteAccountResult {
  success: boolean;
  deletedVideosCount?: number;
  error?: string;
  failedAssets?: Array<{ videoId: string; provider: string; assetId: string | null; error: string }>;
}

export async function deleteDevAccount(
  accountId: string,
  confirmationName: string
): Promise<DeleteAccountResult> {
  await assertLocalDevPanelAccess();

  // 1. Verify account existence and confirm name match
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  if (!account) {
    return { success: false, error: "Conta não encontrada." };
  }

  if (account.name.trim().toLowerCase() !== confirmationName.trim().toLowerCase()) {
    return {
      success: false,
      error: "O nome de confirmação não confere com o nome da conta.",
    };
  }

  // 2. Fetch all members before deletion (to check if users become orphaned)
  const members = await db
    .select({ userId: accountMembers.userId })
    .from(accountMembers)
    .where(eq(accountMembers.accountId, accountId));

  const memberUserIds = members.map((m) => m.userId);

  // 3. Fetch all videos of the account
  const accountVideos: Video[] = await db
    .select()
    .from(videos)
    .where(eq(videos.accountId, accountId));

  // 4. External cleanup: delete Mux/Bunny assets and R2 previews
  const failedAssets: Array<{
    videoId: string;
    provider: string;
    assetId: string | null;
    error: string;
  }> = [];

  for (const video of accountVideos) {
    const providerName = video.provider || "mux";
    const externalId = video.providerVideoId || video.muxAssetId;

    try {
      const adapter = getVideoProvider(providerName);
      await adapter.deleteVideo(video);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erro no provider";
      console.error(`[Account Delete] Failed to delete video ${video.id} in provider ${providerName}:`, err);
      failedAssets.push({
        videoId: video.id,
        provider: providerName,
        assetId: externalId || null,
        error: errorMsg,
      });
    }

    // Delete R2 background preview if present
    if (video.backgroundPreviewKey) {
      try {
        await deleteAssetObject(video.backgroundPreviewKey);
      } catch (r2Err) {
        console.error(`[Account Delete] Warning: failed to delete R2 preview ${video.backgroundPreviewKey}:`, r2Err);
      }
    }
  }

  // If any external provider deletion failed, ABORT and DO NOT delete DB records
  if (failedAssets.length > 0) {
    return {
      success: false,
      error: `A exclusão da conta foi abortada pois ${failedAssets.length} vídeo(s) falharam na exclusão do provider. Nenhum dado foi apagado do banco para permitir retry.`,
      failedAssets,
    };
  }

  // 5. Delete account record from database (cascades handle videos, members, folders, settings, sessions)
  await db.delete(accounts).where(eq(accounts.id, accountId));

  // 6. For each user member, if they have no other accounts left:
  // inactivate active subscriptions and revoke active sessions
  const now = new Date();
  for (const uid of memberUserIds) {
    const [remaining] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(accountMembers)
      .where(eq(accountMembers.userId, uid));

    const remainingCount = remaining?.count ?? 0;
    if (remainingCount === 0) {
      // Inactivate active subscriptions
      await db
        .update(subscriptions)
        .set({
          status: "inactive",
          endedAt: now,
        })
        .where(
          and(
            eq(subscriptions.userId, uid),
            eq(subscriptions.status, "active")
          )
        );

      // Revoke all sessions
      await db.delete(session).where(eq(session.userId, uid));
    }
  }

  // 7. Audit log
  await logAdminAction({
    action: "account_deleted",
    targetAccountId: accountId,
    metadata: {
      accountName: account.name,
      deletedVideosCount: accountVideos.length,
      affectedUserIds: memberUserIds,
    },
  });

  return {
    success: true,
    deletedVideosCount: accountVideos.length,
  };
}
