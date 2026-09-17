import { auth } from "@/lib/auth";
import { getCurrentAccount } from "@/lib/accounts";
import { getVideosForAccount, syncVideoStatus } from "@/lib/videos";
import { headers } from "next/headers";
import Link from "next/link";
import { UploadDialog } from "@/components/videos/upload-dialog";
import { VideoCardMenu } from "@/components/videos/video-card-menu";
import { AppHeader } from "@/components/app-header";
import { VideosListRefresher } from "@/components/videos/videos-list-refresher";
import { Video, HardDrive, Calendar, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(date);
}

export default async function VideosPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const account = session?.user.id
    ? await getCurrentAccount(session.user.id)
    : null;

  const rawVideoList = account ? await getVideosForAccount(account.id) : [];

  // Sync any non-terminal video with Mux on page load
  const videoList = await Promise.all(
    rawVideoList.map(async (video) => {
      if (video.status !== "ready" && video.status !== "errored" && (video.muxAssetId || video.muxUploadId)) {
        const syncRes = await syncVideoStatus(video.id, account?.id);
        return syncRes.video || video;
      }
      return video;
    })
  );

  const hasPendingVideos = videoList.some(
    (v) => v.status === "processing" || v.status === "waiting_upload" || v.status === "uploading"
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader
        currentPath="/videos"
        user={{
          name: session?.user.name,
          email: session?.user.email,
        }}
      />

      {/* Auto-refresher while videos are processing in the background */}
      <VideosListRefresher hasPendingVideos={hasPendingVideos} />

      {/* Main Content Area */}
      <main className="flex-1 mx-auto w-full max-w-[1440px] px-4 sm:px-6 py-8 space-y-6">

        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Vídeos
            </h1>
            <p className="text-sm text-muted-foreground">
              Gerencie e configure seus vídeos.
            </p>
          </div>
          <div className="shrink-0">
            <UploadDialog />
          </div>
        </div>

        {/* Video List or Empty State */}
        {videoList.length === 0 ? (
          /* ── Empty State ── */
          <div className="rounded-xl border border-border bg-card shadow-xs">
            <div className="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center">
              {/* Icon */}
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary-soft border border-primary/20 text-primary">
                <Video className="size-6" />
              </div>

              {/* Text */}
              <div className="space-y-1.5 max-w-xs">
                <h2 className="text-sm font-semibold text-foreground">
                  Nenhum vídeo ainda
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Envie seu primeiro vídeo para começar a configurar o player e
                  acompanhar seus dados.
                </p>
              </div>

              {/* CTA */}
              <UploadDialog />
            </div>
          </div>
        ) : (
          /* ── Video List ── */
          <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden divide-y divide-border/60">
            {videoList.map((video) => {
              const isProcessing =
                video.status === "processing" ||
                video.status === "waiting_upload" ||
                video.status === "uploading";
              const isErrored = video.status === "errored";
              const isReady = video.status === "ready";

              return (
                <div
                  key={video.id}
                  className={cn(
                    "relative group flex items-center gap-4 px-4 py-3.5 transition-colors overflow-hidden",
                    isReady && "hover:bg-muted/30 cursor-pointer",
                    isProcessing && "bg-muted/15 cursor-not-allowed opacity-90 select-none",
                    isErrored && "bg-destructive/5 hover:bg-destructive/10"
                  )}
                  title={isProcessing ? "Vídeo em processamento no Mux. A página será liberada assim que concluir." : undefined}
                >
                  {/* Shimmer sweep effect during processing */}
                  {isProcessing && (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
                    >
                      <div
                        className="h-full w-[200%] absolute top-0 -left-full bg-gradient-to-r from-transparent via-amber-500/10 dark:via-amber-400/10 to-transparent"
                        style={{
                          animation: "wm-table-shimmer 2.2s infinite cubic-bezier(0.4, 0, 0.2, 1)",
                        }}
                      />
                    </div>
                  )}

                  {/* Stretched link — enabled only when video is ready */}
                  {isReady && (
                    <Link
                      href={`/videos/${video.id}`}
                      className="absolute inset-0 z-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
                      aria-label={`Abrir vídeo ${video.title}`}
                    />
                  )}

                  {/* Icon */}
                  <div
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors z-10 pointer-events-none",
                      isReady && "bg-primary/8 text-primary border-primary/15 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary",
                      isProcessing && "bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse",
                      isErrored && "bg-destructive/10 text-destructive border-destructive/20"
                    )}
                  >
                    {isProcessing ? (
                      <Loader2 className="size-4 animate-spin text-amber-500" />
                    ) : (
                      <Video className="size-4" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 z-10 pointer-events-none">
                    <div className="flex items-center gap-2">
                      <p
                        className={cn(
                          "text-sm font-medium transition-colors truncate",
                          isReady && "text-foreground group-hover:text-primary",
                          isProcessing && "text-muted-foreground",
                          isErrored && "text-foreground"
                        )}
                        title={video.title}
                      >
                        {video.title}
                      </p>
                      {isProcessing && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                          <span className="size-1.5 rounded-full bg-amber-500 animate-ping" />
                          Processando
                        </span>
                      )}
                      {isErrored && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-destructive/10 text-destructive border border-destructive/20 shrink-0">
                          <AlertCircle className="size-2.5" />
                          Erro
                        </span>
                      )}
                    </div>
                    <p
                      className="text-[11px] font-mono text-muted-foreground truncate mt-0.5"
                      title={video.originalFilename}
                    >
                      {video.originalFilename}
                    </p>
                    {/* Metadata row */}
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground font-mono">
                      <span className="flex items-center gap-1">
                        <HardDrive className="size-3 shrink-0" />
                        {formatBytes(video.sizeBytes)}
                      </span>
                      <span className="text-border" aria-hidden="true">·</span>
                      <span suppressHydrationWarning className="flex items-center gap-1">
                        <Calendar className="size-3 shrink-0" />
                        {formatDate(video.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Context menu */}
                  <div className="relative z-10">
                    <VideoCardMenu video={video} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <style>{`
          @keyframes wm-table-shimmer {
            0% { transform: translateX(0); }
            100% { transform: translateX(100%); }
          }
        `}</style>
      </main>
    </div>
  );
}
