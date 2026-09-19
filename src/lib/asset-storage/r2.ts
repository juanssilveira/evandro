import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  assetsBucket: string;
  assetsBaseUrl: string;
}

export function getR2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const assetsBucket =
    process.env.R2_ASSETS_BUCKET || "evandro-assets-development";
  const assetsBaseUrl =
    process.env.ASSETS_BASE_URL ||
    process.env.CDN_URL ||
    process.env.BASE_URL ||
    "http://localhost:3000";

  if (!accountId || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    assetsBucket,
    assetsBaseUrl,
  };
}

let s3ClientInstance: S3Client | null = null;

export function getR2Client(): S3Client | null {
  const config = getR2Config();
  if (!config) {
    return null;
  }

  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  return s3ClientInstance;
}

export interface PutAssetParams {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
  cacheControl?: string;
}

/**
 * Uploads a lightweight derived asset (e.g. animated WebP/GIF background preview) to R2.
 */
export async function putAssetObject(params: PutAssetParams): Promise<boolean> {
  const config = getR2Config();
  const client = getR2Client();

  if (!config || !client) {
    console.warn(
      "[Asset Storage R2] R2 credentials not configured. Skipping asset upload."
    );
    return false;
  }

  try {
    const command = new PutObjectCommand({
      Bucket: config.assetsBucket,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
      CacheControl:
        params.cacheControl || "public, max-age=31536000, immutable",
    });

    await client.send(command);
    return true;
  } catch (error) {
    console.error(`[Asset Storage R2] Failed to upload asset key=${params.key}:`, error);
    return false;
  }
}

/**
 * Deletes a derived asset from R2 (idempotent).
 */
export async function deleteAssetObject(key: string): Promise<boolean> {
  const config = getR2Config();
  const client = getR2Client();

  if (!config || !client || !key) {
    return true;
  }

  try {
    const command = new DeleteObjectCommand({
      Bucket: config.assetsBucket,
      Key: key,
    });

    await client.send(command);
    return true;
  } catch (error) {
    console.error(`[Asset Storage R2] Failed to delete asset key=${key}:`, error);
    return false;
  }
}

/**
 * Retrieves a derived asset from R2.
 */
export async function getAssetObject(key: string): Promise<{
  body: Uint8Array;
  contentType: string;
  cacheControl?: string;
} | null> {
  const config = getR2Config();
  const client = getR2Client();

  if (!config || !client || !key) {
    return null;
  }

  try {
    const command = new GetObjectCommand({
      Bucket: config.assetsBucket,
      Key: key,
    });

    const response = await client.send(command);
    if (!response.Body) {
      return null;
    }

    const byteArray = await response.Body.transformToByteArray();
    return {
      body: byteArray,
      contentType: response.ContentType || "image/webp",
      cacheControl:
        response.CacheControl || "public, max-age=31536000, immutable",
    };
  } catch {
    return null;
  }
}

/**
 * Returns public URL for a stored asset key.
 */
export function getAssetPublicUrl(key: string): string {
  if (!key) return "";
  const baseUrl =
    process.env.ASSETS_BASE_URL ||
    process.env.CDN_URL ||
    process.env.BASE_URL ||
    "http://localhost:3000";

  return `${baseUrl.replace(/\/$/, "")}/${key.replace(/^\//, "")}`;
}
