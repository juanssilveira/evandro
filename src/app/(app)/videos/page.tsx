import { auth } from "@/lib/auth";
import { getCurrentAccount } from "@/lib/accounts";
import { getVideosForAccount } from "@/lib/videos";
import { headers } from "next/headers";
import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";
import { UploadDialog } from "@/components/videos/upload-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Video, HardDrive, Calendar, Play } from "lucide-react";

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
    timeStyle: "short",
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
            {session?.user.email}
          </span>
          <LogoutButton />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full space-y-6">
        {/* Page Header with Single Primary Action */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Vídeos
            </h1>
            <p className="text-xs text-muted-foreground">
              Conta: <strong className="font-semibold text-foreground">{account?.name || "..."}</strong>
            </p>
          </div>
          <UploadDialog />
        </div>

        {/* Video List or Empty State */}
        {videoList.length === 0 ? (
          <Card className="border-border border-dashed py-14 text-center bg-card/60 rounded-xl shadow-none">
            <CardContent className="flex flex-col items-center justify-center space-y-4">
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Video className="size-6" />
              </div>
              <div className="space-y-1 max-w-sm">
                <h2 className="text-base font-semibold text-foreground">
                  Nenhum vídeo ainda
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Envie seu primeiro arquivo de vídeo MP4 para começar a visualizar e configurar sua reprodução.
                </p>
              </div>
              <UploadDialog />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {videoList.map((video) => (
              <Link
                key={video.id}
                href={`/videos/${video.id}`}
                className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-xl"
              >
                <Card className="border-border group-hover:border-primary/40 group-hover:shadow-sm transition-all flex flex-col justify-between overflow-hidden h-full rounded-xl bg-card">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors mt-0.5 border border-primary/20 group-hover:border-primary">
                        <Play className="size-4 fill-current ml-0.5" />
                      </div>
                      <div className="overflow-hidden">
                        <h3
                          className="font-semibold text-foreground group-hover:text-primary transition-colors text-sm leading-tight truncate"
                          title={video.title}
                        >
                          {video.title}
                        </h3>
                        <p
                          className="text-xs text-muted-foreground truncate mt-0.5 font-mono text-[11px]"
                          title={video.originalFilename}
                        >
                          {video.originalFilename}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-2.5 border-t border-border/70">
                      <span className="flex items-center gap-1.5 font-mono text-[11px]">
                        <HardDrive className="size-3 text-muted-foreground" />
                        {formatBytes(video.sizeBytes)}
                      </span>
                      <span className="flex items-center gap-1.5 font-mono text-[11px]">
                        <Calendar className="size-3 text-muted-foreground" />
                        {formatDate(video.createdAt)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
