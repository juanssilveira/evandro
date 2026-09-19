import { NextRequest, NextResponse } from "next/server";
import { resolveEmbedBootstrap } from "@/lib/embed/bootstrap";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Timing-Allow-Origin": "*",
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

    const resolution = await resolveEmbedBootstrap(publicId);

    const { dbDurationMs, accessDurationMs, payloadDurationMs, totalDurationMs } = resolution.metrics;
    const serverTiming = `ep-db;dur=${dbDurationMs}, ep-access;dur=${accessDurationMs}, ep-payload;dur=${payloadDurationMs}, ep-bootstrap;dur=${totalDurationMs}`;

    if (!resolution.authorized || !resolution.data) {
      return NextResponse.json(
        { error: resolution.error || "Este vídeo está temporariamente indisponível." },
        {
          status: resolution.statusCode,
          headers: {
            ...CORS_HEADERS,
            "Server-Timing": serverTiming,
            "Cache-Control": "private, no-cache, no-store, must-revalidate",
          },
        }
      );
    }

    return NextResponse.json(resolution.data, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Server-Timing": serverTiming,
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[Embed API Error]", error);
    return NextResponse.json(
      { error: "Falha ao carregar informações do vídeo." },
      {
        status: 500,
        headers: {
          ...CORS_HEADERS,
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      }
    );
  }
}
