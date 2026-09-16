import { auth } from "@/lib/auth";
import { getCurrentAccount } from "@/lib/accounts";
import { getVideosForAccount } from "@/lib/videos";
import { headers } from "next/headers";
import Link from "next/link";
import { UploadDialog } from "@/components/videos/upload-dialog";
import { VideoCardMenu } from "@/components/videos/video-card-menu";
import { AppHeader } from "@/components/app-header";
import { Video, HardDrive, Calendar } from "lucide-react";

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

  const videoList = account ? await getVideosForAccount(account.id) : [];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader
        currentPath="/videos"
        user={{
          name: session?.user.name,
          email: session?.user.email,
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 mx-auto w-full max-w-[1240px] px-4 sm:px-6 py-8 space-y-6">

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
            {videoList.map((video) => (
              <div
                key={video.id}
                className="relative group flex items-center gap-4 px-4 py-3.5 hover:bg-muted/30 transition-colors"
              >
                {/* Stretched link */}
                <Link
                  href={`/videos/${video.id}`}
                  className="absolute inset-0 z-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
                  aria-label={`Abrir vídeo ${video.title}`}
                />

                {/* Icon */}
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary border border-primary/15 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-colors z-10 pointer-events-none">
                  <Video className="size-4" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 z-10 pointer-events-none">
                  <p
                    className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate"
                    title={video.title}
                  >
                    {video.title}
                  </p>
                  <p
                    className="text-[11px] font-mono text-muted-foreground truncate mt-0.5"
                    title={video.originalFilename}
                  >
                    {video.originalFilename}
                  </p>
                  {/* Metadata row — visible on sm+ inline, stacked below on xs */}
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground font-mono">
                    <span className="flex items-center gap-1">
                      <HardDrive className="size-3 shrink-0" />
                      {formatBytes(video.sizeBytes)}
                    </span>
                    <span className="text-border" aria-hidden="true">·</span>
                    <span className="flex items-center gap-1">
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
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
