import { auth } from "@/lib/auth";
import { getCurrentAccount } from "@/lib/accounts";
import { getVideoForAccount } from "@/lib/videos";
import { getPlayerConfig } from "@/lib/player-settings";
import { DEFAULT_PLAYER_CONFIG } from "@/types/player-config";
import { generatePresignedPlaybackUrl } from "@/lib/r2";
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

  const playerConfig = (await getPlayerConfig(video.id, account.id)) ?? DEFAULT_PLAYER_CONFIG;
  const playbackUrl = await generatePresignedPlaybackUrl(video.storageKey, 3600);

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
          video={video}
          accountName={account.name}
          playbackUrl={playbackUrl}
          initialConfig={playerConfig}
          baseUrl={process.env.BASE_URL || "http://localhost:3000"}
        />
      </main>
    </div>
  );
}


