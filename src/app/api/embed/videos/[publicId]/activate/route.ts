import { NextRequest, NextResponse } from "next/server";
import { recordPlaybackSession } from "@/lib/plans/playback";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function POST(
  request: NextRequest,
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

    let body: { playSessionId?: string; isEditor?: boolean } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Corpo da requisição inválido." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const { playSessionId, isEditor } = body;

    if (!playSessionId || typeof playSessionId !== "string" || !playSessionId.trim()) {
      return NextResponse.json(
        { error: "playSessionId é obrigatório." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Check if request is authenticated admin editor preview
    let adminUserId: string | undefined;
    if (isEditor) {
      const session = await auth.api.getSession({
        headers: await headers(),
      });
      if (session?.user?.id) {
        adminUserId = session.user.id;
      }
    }

    const result = await recordPlaybackSession({
      publicId,
      playSessionId: playSessionId.trim(),
      isEditorAdmin: Boolean(isEditor && adminUserId),
      adminUserId,
    });

    return NextResponse.json(
      {
        ok: result.success,
        recorded: result.recorded ?? false,
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
    console.error("[Activation Endpoint Error]", error);
    // Non-blocking tracking response
    return NextResponse.json(
      { ok: false, error: "Falha ao registrar play." },
      { status: 200, headers: CORS_HEADERS }
    );
  }
}

