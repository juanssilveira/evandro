import { auth } from "@/lib/auth";
import { getCurrentAccount } from "@/lib/accounts";
import { getVideoForAccount } from "@/lib/videos";
import { getPlayerConfig } from "@/lib/player-settings";
import { DEFAULT_PLAYER_CONFIG } from "@/types/player-config";
import { generatePresignedPlaybackUrl } from "@/lib/r2";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";
import { VideoPlayerView } from "@/components/videos/video-player-view";
import { ArrowLeft, HardDrive, Calendar, Film, Play } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

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
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border/60">
          <div className="space-y-1.5 min-w-0">
            <Link
              href="/videos"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group"
            >
              <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
              <span>Voltar para biblioteca</span>
            </Link>

            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate" title={video.title}>
                {video.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-xs font-medium shadow-2xs">
              Conta: <strong className="text-foreground font-semibold">{account.name}</strong>
            </span>
          </div>
        </div>

        {/* Video Player & Settings (2-Column Layout) */}
        <VideoPlayerView
          videoId={video.id}
          playbackUrl={playbackUrl}
          title={video.title}
          initialConfig={playerConfig}
          publicId={video.publicId}
          baseUrl={process.env.BASE_URL || "http://localhost:3000"}
        />

        {/* Video Metadata Card */}
        <Card className="border-border bg-card shadow-xs rounded-xl overflow-hidden mt-8">
          <CardContent className="p-4 sm:p-5 grid gap-4 sm:grid-cols-3 text-sm">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                <Film className="size-4" />
              </div>
              <div className="overflow-hidden">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Arquivo original</p>
                <p className="text-xs font-mono font-medium text-foreground truncate mt-0.5" title={video.originalFilename}>
                  {video.originalFilename}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                <HardDrive className="size-4" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Tamanho do arquivo</p>
                <p className="text-xs font-mono font-medium text-foreground mt-0.5">
                  {formatBytes(video.sizeBytes)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                <Calendar className="size-4" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Data de upload</p>
                <p className="text-xs font-mono font-medium text-foreground mt-0.5">
                  {formatDate(video.createdAt)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
