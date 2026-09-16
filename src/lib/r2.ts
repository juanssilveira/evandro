import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error("Cloudflare R2 environment variables are not configured properly.");
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName };
}

export function getR2Client(): S3Client {
  const { accountId, accessKeyId, secretAccessKey } = getR2Config();

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

export function getVideoStorageKey(accountId: string, videoId: string): string {
  return `accounts/${accountId}/videos/${videoId}/source.mp4`;
}

export async function generatePresignedUploadUrl(params: {
  accountId: string;
  videoId: string;
  mimeType: string;
  expiresIn?: number;
}): Promise<string> {
  const { bucketName } = getR2Config();
  const s3 = getR2Client();
  const key = getVideoStorageKey(params.accountId, params.videoId);

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: params.mimeType,
  });

  return await getSignedUrl(s3, command, {
    expiresIn: params.expiresIn || 900,
  });
}

export async function generatePresignedPlaybackUrl(
  storageKey: string,
  expiresIn: number = 3600
): Promise<string> {
  const { bucketName } = getR2Config();
  const s3 = getR2Client();

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: storageKey,
  });

  return await getSignedUrl(s3, command, {
    expiresIn,
  });
}

export async function verifyObjectExists(key: string): Promise<boolean> {
  const { bucketName } = getR2Config();
  const s3 = getR2Client();

  try {
    const command = new HeadObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    await s3.send(command);
    return true;
  } catch {
    return false;
  }
}
