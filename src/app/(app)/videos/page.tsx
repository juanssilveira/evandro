import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getCurrentAccount } from "@/lib/accounts";
import { getVideosForAccount, syncVideoStatus } from "@/lib/videos";
import { getFoldersForAccount } from "@/lib/folders";
import { getActivePlanForUser, getVideoPlaysMapThisMonth } from "@/lib/plans/access";
import { headers } from "next/headers";
import { VideosWorkspace } from "@/components/videos/videos-workspace";
import { UploadButton } from "@/components/videos/upload-button";
import { CreateFolderButton } from "@/components/videos/create-folder-button";
import { AppHeader } from "@/components/app-header";
import { VideosListRefresher } from "@/components/videos/videos-list-refresher";
import { VideosLibrary } from "@/components/videos/videos-library";

import { getMuxSignedThumbnailUrl } from "@/lib/mux";

export const metadata: Metadata = {
  title: "Biblioteca",
  description: "Gerencie seus vídeos no WatchMap.",
};

export default async function VideosPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const account = session?.user.id
    ? await getCurrentAccount(session.user.id)
    : null;

  // Fetch folders and all videos for account
  const [foldersList, rawVideoList] = await Promise.all([
    account ? getFoldersForAccount(account.id) : [],
    account ? getVideosForAccount(account.id) : [],
  ]);

  // Fetch active plan for header
  const activePlan =
    session?.user.id
      ? await getActivePlanForUser(session.user.id)
      : null;

  // Sync any non-terminal video with Mux on page load
  const videoList = await Promise.all(
    rawVideoList.map(async (video) => {
      if (
        video.status !== "ready" &&
        video.status !== "errored" &&
        (video.muxAssetId || video.muxUploadId)
      ) {
        const syncRes = await syncVideoStatus(video.id, account?.id);
        return syncRes.video || video;
      }
      return video;
    })
  );

  // Fetch real monthly Plays and signed thumbnails per video server-side
  const videoIds = videoList.map((v) => v.id);
  const videoPlaysMap = await getVideoPlaysMapThisMonth(videoIds);

  const videoThumbnailsMap: Record<string, string> = {};
  await Promise.all(
    videoList.map(async (v) => {
      if (v.status === "ready" && v.muxPlaybackId) {
        try {
          videoThumbnailsMap[v.id] = await getMuxSignedThumbnailUrl(v.muxPlaybackId, {
            width: 480,
            height: 270,
            fit_mode: "smartcrop",
          });
        } catch (err) {
          console.error(`[Thumbnail] Failed to sign thumbnail for video ${v.id}:`, err);
        }
      }
    })
  );

  // Calculate folder metrics (videoCount, totalSizeBytes, totalPlays) from videos list and plays map
  const enrichedFoldersList = foldersList.map((folder) => {
    const folderVideos = videoList.filter((v) => v.folderId === folder.id);
    const totalSizeBytes = folderVideos.reduce(
      (acc, v) => acc + (Number(v.sizeBytes) || 0),
      0
    );
    const totalPlays = folderVideos.reduce(
      (acc, v) => acc + (videoPlaysMap[v.id] || 0),
      0
    );
    return {
      ...folder,
      videoCount: folderVideos.length,
      totalSizeBytes,
      totalPlays,
    };
  });

  const hasPendingVideos = videoList.some(
    (v) =>
      v.status === "processing" ||
      v.status === "waiting_upload" ||
      v.status === "uploading"
  );

  return (
    <VideosWorkspace>
      <div className="flex min-h-screen flex-col bg-background">
        <AppHeader
          currentPath="/videos"
          user={{
            name: session?.user.name,
            email: session?.user.email,
            planName: activePlan?.plan ? `Plano ${activePlan.plan.name}` : "Plano Pro",
          }}
        />

        {/* Auto-refresher while videos are processing in the background */}
        <VideosListRefresher hasPendingVideos={hasPendingVideos} />

        {/* Main Content Area */}
        <main className="flex-1 mx-auto w-full max-w-[1440px] px-4 sm:px-6 py-8 space-y-6">
          {/* Page Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Biblioteca
              </h1>
              <p className="text-sm text-muted-foreground">
                Gerencie sua biblioteca de vídeos e configurações.
              </p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <CreateFolderButton />
              <UploadButton />
            </div>
          </div>

          {/* Videos Library Section */}
          <section aria-label="Biblioteca de vídeos">
            <VideosLibrary
              folders={enrichedFoldersList}
              videos={videoList}
              videoPlaysMap={videoPlaysMap}
              videoThumbnailsMap={videoThumbnailsMap}
            />
          </section>
        </main>
      </div>
    </VideosWorkspace>
  );
}

