import { NextRequest, NextResponse } from "next/server";
import { getAssetObject } from "@/lib/asset-storage/r2";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  if (!slug || slug.length === 0) {
    return new NextResponse("Not found", { status: 404 });
  }

  const key = `player-thumbnails/${slug.join("/")}`;
  const asset = await getAssetObject(key);

  if (!asset) {
    return new NextResponse("Thumbnail not found", { status: 404 });
  }

  return new NextResponse(asset.body as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": asset.contentType || "image/webp",
      "Cache-Control":
        asset.cacheControl || "public, max-age=31536000, immutable",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
