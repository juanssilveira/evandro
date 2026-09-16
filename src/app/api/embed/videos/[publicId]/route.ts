import { NextRequest, NextResponse } from "next/server";
import { getVideoByPublicId } from "@/lib/videos";
import { getPlayerConfigByVideoId } from "@/lib/player-settings";
import { generatePresignedPlaybackUrl } from "@/lib/r2";

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

    const video = await getVideoByPublicId(publicId);
    if (!video) {
      return NextResponse.json(
        { error: "Vídeo não encontrado." },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const [config, playbackUrl] = await Promise.all([
      getPlayerConfigByVideoId(video.id),
      generatePresignedPlaybackUrl(video.storageKey, 3600),
    ]);

    // Return only public data for the embed player
    return NextResponse.json(
      {
        videoId: video.publicId,
        title: video.title,
        playbackUrl,
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
      { error: "Falha ao carregar reprodução do vídeo." },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
