import { NextRequest, NextResponse } from "next/server";
import { getVideoByPublicId, syncVideoStatus } from "@/lib/videos";
import { getPlayerConfigByVideoId } from "@/lib/player-settings";
import { getAssetPublicUrl } from "@/lib/asset-storage/r2";
import {
  getVideoPlaybackUrl,
  getVideoPosterUrl,
  getVideoBackgroundPreviewUrl,
} from "@/lib/video-providers";
import { resolvePlaybackEntitlement } from "@/lib/plans/playback";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ publicId: string }> }
) {
  try {
    const { publicId } = await params;

    if (!publicId || typeof publicId !== "string") {
      return NextResponse.json(
        { error: "Identificador de vídeo inválido." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // -------------------------------------------------------------
    // FASE 1 — ENTITLEMENT (Validate active plan before inspecting media)
    // -------------------------------------------------------------
    const entitlement = await resolvePlaybackEntitlement(publicId);
    if (!entitlement.authorized) {
      return NextResponse.json(
        { error: entitlement.error || "Este vídeo está temporariamente indisponível." },
        {
          status: entitlement.statusCode || 403,
          headers: {
            ...CORS_HEADERS,
            "Cache-Control": "private, no-cache, no-store, must-revalidate",
          },
        }
      );
    }

    // -------------------------------------------------------------
    // FASE 2 — MEDIA RELEASE & VISUAL CONFIG
    // -------------------------------------------------------------
    let video = await getVideoByPublicId(publicId);
    if (!video) {
      return NextResponse.json(
        { error: "Vídeo não encontrado." },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    // If video is not marked as ready yet, attempt to sync with provider
    if (
      video.status !== "ready" &&
      (video.providerVideoId || video.providerUploadId || video.muxAssetId || video.muxUploadId)
    ) {
      const syncRes = await syncVideoStatus(video.id);
      if (syncRes.video) {
        video = syncRes.video;
      }
    }

    const playbackUrl = getVideoPlaybackUrl(video);
    if (video.status !== "ready" || !playbackUrl) {
      return NextResponse.json(
        { error: "Vídeo em processamento ou indisponível para reprodução." },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const posterUrl = getVideoPosterUrl(video);

    let backgroundPreviewUrl =
      video.backgroundPreviewStatus === "ready" && video.backgroundPreviewKey
        ? getAssetPublicUrl(video.backgroundPreviewKey)
        : null;

    if (!backgroundPreviewUrl) {
      backgroundPreviewUrl = getVideoBackgroundPreviewUrl(video);
    }

    const config = await getPlayerConfigByVideoId(video.id);

    return NextResponse.json(
      {
        videoId: video.publicId,
        title: video.title,
        duration: video.duration,
        playbackUrl,
        playback: {
          type: "hls",
          url: playbackUrl,
        },
        posterUrl,
        backgroundPreviewUrl,
        config,
      },
      {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("[Embed API Error]", error);
    return NextResponse.json(
      { error: "Falha ao carregar informações do vídeo." },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
