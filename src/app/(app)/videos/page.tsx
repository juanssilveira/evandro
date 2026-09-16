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
            {session?.user.email}
          </span>
          <LogoutButton />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-6">
        {/* Page Title & Action */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Vídeos
            </h1>
            <p className="text-sm text-muted-foreground">
              Conta: <strong className="text-foreground">{account?.name || "..."}</strong>
            </p>
          </div>
          <UploadDialog />
        </div>

        {/* Video List or Empty State */}
        {videoList.length === 0 ? (
          <Card className="border-border border-dashed py-14 text-center">
            <CardContent className="flex flex-col items-center justify-center space-y-4">
              <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Video className="size-7" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-foreground">
                  Nenhum vídeo ainda
                </h2>
                <p className="text-sm text-muted-foreground">
                  Envie seu primeiro vídeo para começar.
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
                className="group block focus:outline-none"
              >
                <Card className="border-border group-hover:border-primary/50 group-hover:shadow-sm transition-all flex flex-col justify-between overflow-hidden h-full">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors mt-0.5">
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
                          className="text-xs text-muted-foreground truncate mt-0.5"
                          title={video.originalFilename}
                        >
                          {video.originalFilename}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
                      <span className="flex items-center gap-1">
                        <HardDrive className="size-3" />
                        {formatBytes(video.sizeBytes)}
                      </span>
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="size-3" />
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
