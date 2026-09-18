import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getCurrentAccount } from "@/lib/accounts";
import { getVideosForAccount, syncVideoStatus } from "@/lib/videos";
import { getVideoPosterUrl } from "@/lib/video-providers";
import { getFolderForAccount } from "@/lib/folders";
import { getActivePlanForUser, getVideoPlaysMapThisMonth } from "@/lib/plans/access";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { VideosWorkspace } from "@/components/videos/videos-workspace";
import { UploadButton } from "@/components/videos/upload-button";
import { AppHeader } from "@/components/app-header";
import { VideosListRefresher } from "@/components/videos/videos-list-refresher";
import { VideosLibrary } from "@/components/videos/videos-library";
import { Breadcrumbs } from "@/components/ui/breadcrumb";
import { FOLDER_COLOR_CONFIGS } from "@/lib/folder-colors";
import type { FolderColor } from "@/db/schema/folders";
import { Folder as FolderIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface FolderPageProps {
  params: Promise<{ folderId: string }>;
}

export async function generateMetadata({
  params,
}: FolderPageProps): Promise<Metadata> {
  const { folderId } = await params;
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session?.user?.id) {
      return { title: "Pasta" };
    }
    const account = await getCurrentAccount(session.user.id);
    if (!account) {
      return { title: "Pasta" };
    }
    const folder = await getFolderForAccount(folderId, account.id);
    if (!folder || !folder.name) {
      return { title: "Pasta" };
    }
    return {
      title: folder.name,
      description: `Vídeos da pasta ${folder.name} no WatchMap.`,
    };
  } catch {
    return { title: "Pasta" };
  }
}

export default async function FolderPage({ params }: FolderPageProps) {
  const { folderId } = await params;

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

  const folder = await getFolderForAccount(folderId, account.id);
  if (!folder) {
    notFound();
  }

  const activePlan = await getActivePlanForUser(session.user.id);

  const rawVideoList = await getVideosForAccount(account.id, folder.id);

  // Sync any non-terminal video with provider on page load
  const videoList = await Promise.all(
    rawVideoList.map(async (video) => {
      if (
        video.status !== "ready" &&
        video.status !== "errored" &&
        (video.providerVideoId || video.providerUploadId || video.muxAssetId || video.muxUploadId)
      ) {
        const syncRes = await syncVideoStatus(video.id, account.id);
        return syncRes.video || video;
      }
      return video;
    })
  );

  // Fetch real monthly Plays per video server-side
  const videoIds = videoList.map((v) => v.id);
  const videoPlaysMap = await getVideoPlaysMapThisMonth(videoIds);

  // Resolve poster URLs provider-neutrally server-side
  const videoPosterUrls: Record<string, string | null> = {};
  for (const video of videoList) {
    videoPosterUrls[video.id] = getVideoPosterUrl(video);
  }

  const hasPendingVideos = videoList.some(
    (v) =>
      v.status === "processing" ||
      v.status === "waiting_upload" ||
      v.status === "uploading"
  );

  const folderCfg =
    FOLDER_COLOR_CONFIGS[(folder.color as FolderColor) || "gray"] ||
    FOLDER_COLOR_CONFIGS.gray;

  return (
    <VideosWorkspace folderId={folder.id}>
      <div className="flex min-h-screen flex-col bg-background">
        <AppHeader
          currentPath="/videos"
          user={{
            name: session.user.name,
            email: session.user.email,
            planName: activePlan?.plan ? `Plano ${activePlan.plan.name}` : "Plano Pro",
          }}
        />

        {/* Auto-refresher while videos are processing in the background */}
        <VideosListRefresher hasPendingVideos={hasPendingVideos} />

        {/* Main Content Area */}
        <main className="flex-1 mx-auto w-full max-w-[1440px] px-4 sm:px-6 py-8 space-y-6">
          {/* Breadcrumbs Navigation */}
          <div className="flex items-center">
            <Breadcrumbs
              items={[
                { label: "Biblioteca", href: "/videos" },
                { label: folder.name, isCurrent: true },
              ]}
            />
          </div>

          {/* Page Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex size-10 items-center justify-center rounded-xl border shrink-0 shadow-xs",
                  folderCfg.iconClass
                )}
              >
                <FolderIcon className="size-5 fill-current/20" />
              </div>
              <div className="space-y-0.5">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  {folder.name}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {videoList.length === 1
                    ? "1 vídeo nesta pasta"
                    : `${videoList.length} vídeos nesta pasta`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <UploadButton />
            </div>
          </div>

          {/* Videos Library Section */}
          <section aria-label={`Vídeos da pasta ${folder.name}`}>
            <VideosLibrary
              videos={videoList}
              videoPlaysMap={videoPlaysMap}
              videoPosterUrls={videoPosterUrls}
              currentFolder={folder}
            />
          </section>
        </main>
      </div>
    </VideosWorkspace>
  );
}
