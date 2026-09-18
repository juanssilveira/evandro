import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getCurrentAccount } from "@/lib/accounts";
import {
  getVideoForAccount,
  getVideoWithFolderForAccount,
  syncVideoStatus,
} from "@/lib/videos";
import {
  getVideoPlaybackUrl,
  getVideoPosterUrl,
  getVideoBackgroundPreviewUrl,
} from "@/lib/video-providers";

import { getPlayerConfig } from "@/lib/player-settings";
import { getActivePlanForUser } from "@/lib/plans/access";
import { DEFAULT_PLAYER_CONFIG } from "@/types/player-config";
import { getAssetPublicUrl } from "@/lib/asset-storage/r2";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { VideoDetailsView } from "@/components/videos/video-details-view";
import { AppHeader } from "@/components/app-header";

interface VideoPageProps {
  params: Promise<{ videoId: string }>;
  searchParams?: Promise<{ tab?: string }>;
}

export async function generateMetadata({
  params,
}: VideoPageProps): Promise<Metadata> {
  const { videoId } = await params;
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session?.user?.id) {
      return { title: "Vídeo" };
    }
    const account = await getCurrentAccount(session.user.id);
    if (!account) {
      return { title: "Vídeo" };
    }
    const video = await getVideoForAccount(videoId, account.id);
    if (!video || !video.title) {
      return { title: "Vídeo" };
    }
    return {
      title: video.title,
    };
  } catch {
    return { title: "Vídeo" };
  }
}

export default async function VideoDetailsPage({
  params,
  searchParams,
}: VideoPageProps) {
  const { videoId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const rawTab = resolvedSearchParams.tab?.toLowerCase().trim();
  let defaultTab: "appearance" | "playback" | "controls" = "appearance";
  if (rawTab === "playback" || rawTab === "reproducao" || rawTab === "reprodução") {
    defaultTab = "playback";
  } else if (rawTab === "controls" || rawTab === "controles") {
    defaultTab = "controls";
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login");
  }

  const account = await getCurrentAccount(session.user.id);
  if (!account) {
    notFound();
  }

  const activePlan = await getActivePlanForUser(session.user.id);

  const videoWithFolder = await getVideoWithFolderForAccount(videoId, account.id);
  if (!videoWithFolder) {
    notFound();
  }

  const { video, folder } = videoWithFolder;

  // If video is still processing or waiting for upload, attempt to sync status
  let currentVideo = video;
  if (
    (video.status !== "ready" &&
      (video.providerVideoId || video.providerUploadId || video.muxAssetId || video.muxUploadId)) ||
    (video.status === "ready" && video.backgroundPreviewStatus === "pending")
  ) {
    const syncRes = await syncVideoStatus(video.id, account.id);
    if (syncRes.video) {
      currentVideo = syncRes.video;
    }
  }

  // If video is still processing or not ready, block entry and redirect to library
  if (currentVideo.status !== "ready") {
    redirect("/videos");
  }

  const playerConfig = (await getPlayerConfig(currentVideo.id, account.id)) ?? DEFAULT_PLAYER_CONFIG;

  const playbackUrl = getVideoPlaybackUrl(currentVideo) || "";
  const posterUrl = getVideoPosterUrl(currentVideo);

  let backgroundPreviewUrl =
    currentVideo.backgroundPreviewStatus === "ready" && currentVideo.backgroundPreviewKey
      ? getAssetPublicUrl(currentVideo.backgroundPreviewKey)
      : null;

  if (!backgroundPreviewUrl) {
    backgroundPreviewUrl = getVideoBackgroundPreviewUrl(currentVideo);
  }

  const cdnUrl = process.env.CDN_URL || process.env.BASE_URL || "http://localhost:3000";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader
        currentPath={`/videos/${videoId}`}
        user={{
          name: session.user.name,
          email: session.user.email,
          planName: activePlan?.plan ? `Plano ${activePlan.plan.name}` : "Plano Pro",
        }}
      />

      {/* Main Page Area */}
      <main className="flex-1 mx-auto w-full max-w-[1440px] px-4 sm:px-6 py-8 space-y-6">
        <VideoDetailsView
          video={currentVideo}
          folder={folder}
          accountName={account.name}
          playbackUrl={playbackUrl}
          posterUrl={posterUrl}
          backgroundPreviewUrl={backgroundPreviewUrl}
          initialConfig={playerConfig}
          cdnUrl={cdnUrl}
          defaultTab={defaultTab}
        />
      </main>
    </div>
  );
}

