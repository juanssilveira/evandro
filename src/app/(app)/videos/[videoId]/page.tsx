import { auth } from "@/lib/auth";
import { getCurrentAccount } from "@/lib/accounts";
import { getVideoForAccount } from "@/lib/videos";
import { generatePresignedPlaybackUrl } from "@/lib/r2";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";
import { VideoPlayerView } from "@/components/videos/video-player-view";
import { ArrowLeft, HardDrive, Calendar, Film } from "lucide-react";
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

  const playbackUrl = await generatePresignedPlaybackUrl(video.storageKey, 3600);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top Header */}
      <header className="flex h-14 items-center justify-between border-b border-border px-6 bg-card">
        <div className="flex items-center gap-2 font-bold text-foreground">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
            WM
          </div>
          <span>WatchMap</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            {session.user.email}
          </span>
          <LogoutButton />
        </div>
      </header>

      {/* Main Page Area */}
      <main className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-6">
        {/* Navigation & Title */}
        <div className="space-y-4">
          <Link
            href="/videos"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Voltar para vídeos
          </Link>

          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {video.title}
            </h1>
            <p className="text-xs text-muted-foreground">
              Conta: <strong className="text-foreground">{account.name}</strong>
            </p>
          </div>
        </div>

        {/* Video Player & Settings */}
        <VideoPlayerView
          videoId={video.id}
          playbackUrl={playbackUrl}
          title={video.title}
          initialDebugEnabled={video.debugEnabled}
        />

        {/* Video Info Card */}
        <Card className="border-border bg-card">
          <CardContent className="p-4 sm:p-6 grid gap-4 sm:grid-cols-3 text-sm">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Film className="size-5" />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs text-muted-foreground">Nome original</p>
                <p className="font-medium text-foreground truncate" title={video.originalFilename}>
                  {video.originalFilename}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <HardDrive className="size-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tamanho</p>
                <p className="font-medium text-foreground">
                  {formatBytes(video.sizeBytes)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Calendar className="size-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Enviado em</p>
                <p className="font-medium text-foreground">
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
