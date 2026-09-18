import {
  accounts,
  accountMembers,
  videos,
  subscriptions,
  session,
  type Video,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { assertLocalDevPanelAccess } from "./guard";
import { logAdminAction } from "./audit";
import { getAdminDb } from "./db";
import { getAdminEnvironmentConfig, type AdminEnvironment, type AdminInfraConfig } from "./env-config";
import Mux from "@mux/mux-node";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

export async function disableDevAccount(
  env: AdminEnvironment,
  accountId: string,
  reason?: string
) {
  await assertLocalDevPanelAccess();

  const adminDb = getAdminDb(env);
  const now = new Date();
  const trimmedReason = reason?.trim() || null;

  const [updated] = await adminDb
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

  await logAdminAction(env, {
    action: "account_disabled",
    targetAccountId: accountId,
    metadata: { reason: trimmedReason },
  });

  return { success: true, account: updated };
}

export async function enableDevAccount(env: AdminEnvironment, accountId: string) {
  await assertLocalDevPanelAccess();

  const adminDb = getAdminDb(env);
  const now = new Date();

  const [updated] = await adminDb
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

  await logAdminAction(env, {
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

async function deleteMuxAssetWithConfig(
  assetId: string,
  config: AdminInfraConfig
): Promise<boolean> {
  if (!config.MUX_TOKEN_ID || !config.MUX_TOKEN_SECRET) {
    console.warn("[Mux Cleanup] Mux credentials missing for environment. Skipping asset deletion.");
    return true;
  }

  try {
    const mux = new Mux({
      tokenId: config.MUX_TOKEN_ID,
      tokenSecret: config.MUX_TOKEN_SECRET,
    });
    await mux.video.assets.delete(assetId);
    return true;
  } catch (error: unknown) {
    const isNotFound =
      error &&
      typeof error === "object" &&
      "status" in error &&
      (error as { status: number }).status === 404;

    if (isNotFound) {
      return true;
    }

    console.error(`[Mux Cleanup] Failed to delete asset ${assetId}:`, error);
    return false;
  }
}

async function deleteBunnyVideoWithConfig(
  videoId: string,
  config: AdminInfraConfig
): Promise<boolean> {
  if (!config.BUNNY_STREAM_LIBRARY_ID || !config.BUNNY_STREAM_API_KEY) {
    console.warn("[Bunny Cleanup] Bunny credentials missing for environment. Skipping video deletion.");
    return true;
  }

  try {
    const response = await fetch(
      `https://video.bunnycdn.com/library/${config.BUNNY_STREAM_LIBRARY_ID}/videos/${videoId}`,
      {
        method: "DELETE",
        headers: {
          AccessKey: config.BUNNY_STREAM_API_KEY,
          Accept: "application/json",
        },
      }
    );

    if (response.status === 404 || response.ok) {
      return true;
    }

    const errorText = await response.text().catch(() => "");
    console.error(
      `[Bunny Cleanup] Failed to delete video ${videoId} (status ${response.status}): ${errorText}`
    );
    return false;
  } catch (error) {
    console.error(`[Bunny Cleanup] Error deleting video ${videoId}:`, error);
    return false;
  }
}

async function deleteR2AssetWithConfig(
  key: string,
  config: AdminInfraConfig
): Promise<boolean> {
  if (
    !config.R2_ACCOUNT_ID ||
    !config.R2_ACCESS_KEY_ID ||
    !config.R2_SECRET_ACCESS_KEY ||
    !config.R2_ASSETS_BUCKET
  ) {
    return true;
  }

  try {
    const client = new S3Client({
      region: "auto",
      endpoint: `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.R2_ACCESS_KEY_ID,
        secretAccessKey: config.R2_SECRET_ACCESS_KEY,
      },
    });

    const command = new DeleteObjectCommand({
      Bucket: config.R2_ASSETS_BUCKET,
      Key: key,
    });

    await client.send(command);
    return true;
  } catch (error) {
    console.error(`[R2 Cleanup] Failed to delete asset ${key}:`, error);
    return false;
  }
}

export async function deleteDevAccount(
  env: AdminEnvironment,
  accountId: string,
  confirmationName: string
): Promise<DeleteAccountResult> {
  await assertLocalDevPanelAccess();

  const adminDb = getAdminDb(env);
  const config = getAdminEnvironmentConfig(env);

  // 1. Verify account existence and confirm name match
  const [account] = await adminDb
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
  const members = await adminDb
    .select({ userId: accountMembers.userId })
    .from(accountMembers)
    .where(eq(accountMembers.accountId, accountId));

  const memberUserIds = members.map((m) => m.userId);

  // 3. Fetch all videos of the account
  const accountVideos: Video[] = await adminDb
    .select()
    .from(videos)
    .where(eq(videos.accountId, accountId));

  // 4. External cleanup: delete Mux/Bunny assets and R2 previews using env-specific config
  const failedAssets: Array<{
    videoId: string;
    provider: string;
    assetId: string | null;
    error: string;
  }> = [];

  for (const video of accountVideos) {
    const providerName = video.provider || "mux";
    const externalId = video.providerVideoId || video.muxAssetId;

    if (providerName === "bunny" && externalId) {
      const ok = await deleteBunnyVideoWithConfig(externalId, config);
      if (!ok) {
        failedAssets.push({
          videoId: video.id,
          provider: "bunny",
          assetId: externalId,
          error: "Falha na API do Bunny Stream",
        });
      }
    } else if (providerName === "mux" && externalId) {
      const ok = await deleteMuxAssetWithConfig(externalId, config);
      if (!ok) {
        failedAssets.push({
          videoId: video.id,
          provider: "mux",
          assetId: externalId,
          error: "Falha na API do Mux",
        });
      }
    }

    // Delete R2 background preview if present
    if (video.backgroundPreviewKey) {
      try {
        await deleteR2AssetWithConfig(video.backgroundPreviewKey, config);
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
  await adminDb.delete(accounts).where(eq(accounts.id, accountId));

  // 6. For each user member, if they have no other accounts left:
  // inactivate active subscriptions and revoke active sessions
  const now = new Date();
  for (const uid of memberUserIds) {
    const [remaining] = await adminDb
      .select({ count: sql<number>`count(*)::int` })
      .from(accountMembers)
      .where(eq(accountMembers.userId, uid));

    const remainingCount = remaining?.count ?? 0;
    if (remainingCount === 0) {
      // Inactivate active subscriptions
      await adminDb
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
      await adminDb.delete(session).where(eq(session.userId, uid));
    }
  }

  // 7. Audit log
  await logAdminAction(env, {
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
