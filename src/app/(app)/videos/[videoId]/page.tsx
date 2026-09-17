import { auth } from "@/lib/auth";
import { getCurrentAccount } from "@/lib/accounts";
import { getVideoForAccount, syncVideoStatus } from "@/lib/videos";
import { getPlayerConfig } from "@/lib/player-settings";
import { DEFAULT_PLAYER_CONFIG } from "@/types/player-config";
import { getHlsPlaybackUrl } from "@/lib/mux";
import { getAssetPublicUrl } from "@/lib/asset-storage/r2";
import { getMuxPosterUrl } from "@/lib/background-preview";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { VideoDetailsView } from "@/components/videos/video-details-view";
import { AppHeader } from "@/components/app-header";

interface VideoPageProps {
  params: Promise<{ videoId: string }>;
}

export default async function VideoDetailsPage({ params }: VideoPageProps) {
  const { videoId } = await params;

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

  const video = await getVideoForAccount(videoId, account.id);
  if (!video) {
    notFound();
  }

  // If video is still processing or waiting for upload, attempt to sync status
  let currentVideo = video;
  if (video.status !== "ready" && (video.muxAssetId || video.muxUploadId)) {
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
  const playbackUrl = currentVideo.muxPlaybackId
    ? getHlsPlaybackUrl(currentVideo.muxPlaybackId)
    : "";

  const posterUrl = currentVideo.muxPlaybackId
    ? getMuxPosterUrl(currentVideo.muxPlaybackId)
    : null;

  const backgroundPreviewUrl =
    currentVideo.backgroundPreviewStatus === "ready" && currentVideo.backgroundPreviewKey
      ? getAssetPublicUrl(currentVideo.backgroundPreviewKey)
      : null;

  const cdnUrl = process.env.CDN_URL || process.env.BASE_URL || "http://localhost:3000";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader
        currentPath={`/videos/${videoId}`}
        user={{
          name: session.user.name,
          email: session.user.email,
        }}
      />

      {/* Main Page Area */}
      <main className="flex-1 mx-auto w-full max-w-[1440px] px-4 sm:px-6 py-8 space-y-6">
        <VideoDetailsView
          video={currentVideo}
          accountName={account.name}
          playbackUrl={playbackUrl}
          posterUrl={posterUrl}
          backgroundPreviewUrl={backgroundPreviewUrl}
          initialConfig={playerConfig}
          cdnUrl={cdnUrl}
        />
      </main>
    </div>
  );
}
