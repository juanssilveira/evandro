import { auth } from "@/lib/auth";
import { getCurrentAccount } from "@/lib/accounts";
import { getVideoForAccount } from "@/lib/videos";
import { getPlayerConfig } from "@/lib/player-settings";
import { DEFAULT_PLAYER_CONFIG } from "@/types/player-config";
import { generatePresignedPlaybackUrl } from "@/lib/r2";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { VideoDetailsView } from "@/components/videos/video-details-view";
import { Play } from "lucide-react";

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
      {/* Top Navigation Header */}
      <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 sm:px-6 sticky top-0 z-20">
        <div className="flex items-center gap-2.5 font-bold text-foreground">
          <div className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-b from-violet-500 to-[#7C3AED] text-white text-xs font-bold shadow-[0_1px_2px_rgba(0,0,0,0.1),0_1px_0_#6D28D9] border border-[#6D28D9]">
            <Play className="size-3.5 fill-white ml-0.5" />
          </div>
          <span className="text-sm font-bold tracking-tight">WatchMap</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-block text-xs font-medium text-muted-foreground">
            {session.user.email}
          </span>
          <LogoutButton />
        </div>
      </header>

      {/* Main Page Area */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] mx-auto w-full space-y-6">
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

