import { NextRequest, NextResponse } from "next/server";
import {
  recordTelemetrySession,
  telemetryPayloadSchema,
} from "@/lib/tracker/telemetry";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Timing-Allow-Origin": "*",
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

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Corpo da requisição inválido." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const parseResult = telemetryPayloadSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Payload de telemetria inválido.",
          issues: parseResult.error.issues,
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const result = await recordTelemetrySession(publicId, parseResult.data);

    return NextResponse.json(
      { ok: result.success },
      {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("[Telemetry Endpoint Error]", error);
    return NextResponse.json(
      { ok: false, error: "Falha ao processar telemetria." },
      {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      }
    );
  }
}
