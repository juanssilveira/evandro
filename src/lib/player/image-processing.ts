import type { PlayerAspectRatio } from "@/types/player-config";

export interface ProcessedImageResult {
  blob: Blob;
  width: number;
  height: number;
  sizeBytes: number;
  aspectRatio: PlayerAspectRatio;
}

export const RECOMMENDED_DIMENSIONS: Record<
  PlayerAspectRatio,
  { width: number; height: number; label: string }
> = {
  "16:9": { width: 1280, height: 720, label: "1280 × 720 px (16:9)" },
  "9:16": { width: 720, height: 1280, label: "720 × 1280 px (9:16)" },
  "1:1": { width: 1080, height: 1080, label: "1080 × 1080 px (1:1)" },
};

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/png",
  "image/x-png",
  "image/webp",
  "image/avif",
  "image/bmp",
];
const ALLOWED_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".avif",
  ".jfif",
  ".pjpeg",
  ".bmp",
];
const MAX_ORIGINAL_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const TARGET_SIZE_BYTES = 500 * 1024; // ~500 KB
const HARD_MAX_SIZE_BYTES = 750 * 1024; // 750 KB

/**
 * Validates and processes an uploaded image client-side:
 * 1. Checks format (JPEG/PNG/WebP/etc) and original size (<= 10MB)
 * 2. Decodes image in browser (Canvas / Image)
 * 3. Applies center-crop to target aspect ratio
 * 4. Resizes to recommended dimensions
 * 5. Encodes to WebP with iterative quality control (target ~500KB, hard max 750KB)
 */
export async function processClientThumbnail(
  file: File,
  aspectRatio: PlayerAspectRatio
): Promise<ProcessedImageResult> {
  // 1. Validate original file
  const mime = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  const isAllowedMime = mime ? ALLOWED_MIME_TYPES.includes(mime) : false;
  const isAllowedExt = ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));

  if (!isAllowedMime && !isAllowedExt) {
    throw new Error(
      "Formato inválido. Selecione uma imagem nos formatos JPG, PNG ou WebP."
    );
  }

  if (file.size > MAX_ORIGINAL_SIZE_BYTES) {
    throw new Error(
      `O arquivo selecionado excede o limite máximo de 10 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB).`
    );
  }

  // 2. Decode image
  const img = await loadImageFromFile(file);
  const targetDim = RECOMMENDED_DIMENSIONS[aspectRatio];

  // 3. Calculate center crop coordinates
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;

  if (srcW <= 0 || srcH <= 0) {
    throw new Error("Não foi possível identificar as dimensões da imagem.");
  }

  const targetRatio = targetDim.width / targetDim.height;
  const srcRatio = srcW / srcH;

  let cropX = 0;
  let cropY = 0;
  let cropW = srcW;
  let cropH = srcH;

  if (srcRatio > targetRatio) {
    // Source is wider than target: crop left & right
    cropW = Math.round(srcH * targetRatio);
    cropX = Math.round((srcW - cropW) / 2);
  } else if (srcRatio < targetRatio) {
    // Source is taller than target: crop top & bottom
    cropH = Math.round(srcW / targetRatio);
    cropY = Math.round((srcH - cropH) / 2);
  }

  // 4. Render to canvas
  let outW = targetDim.width;
  let outH = targetDim.height;

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;

  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    throw new Error("Não foi possível inicializar o contexto gráfico 2D.");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, outW, outH);

  // 5. Iterative WebP encoding with progressive quality reduction
  const qualitySteps = [0.84, 0.76, 0.68, 0.60, 0.50, 0.40];
  let finalBlob: Blob | null = null;

  for (const q of qualitySteps) {
    const blob = await canvasToWebpBlob(canvas, q);
    if (!blob) continue;

    finalBlob = blob;
    if (blob.size <= TARGET_SIZE_BYTES) {
      break;
    }
  }

  // Fallback: If still above 750KB after quality reduction, scale canvas dimensions down slightly
  if (!finalBlob || finalBlob.size > HARD_MAX_SIZE_BYTES) {
    outW = Math.round(targetDim.width * 0.75);
    outH = Math.round(targetDim.height * 0.75);
    canvas.width = outW;
    canvas.height = outH;

    ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, outW, outH);

    for (const q of [0.75, 0.60, 0.45]) {
      const blob = await canvasToWebpBlob(canvas, q);
      if (blob) {
        finalBlob = blob;
        if (blob.size <= HARD_MAX_SIZE_BYTES) break;
      }
    }
  }

  if (!finalBlob) {
    throw new Error("Falha ao codificar a imagem para o formato WebP.");
  }

  if (finalBlob.size > HARD_MAX_SIZE_BYTES) {
    throw new Error(
      `O arquivo processado excede o limite máximo de ${Math.round(HARD_MAX_SIZE_BYTES / 1024)} KB.`
    );
  }

  return {
    blob: finalBlob,
    width: outW,
    height: outH,
    sizeBytes: finalBlob.size,
    aspectRatio,
  };
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Falha ao carregar e decodificar a imagem selecionada."));
    };

    img.src = url;
  });
}

function canvasToWebpBlob(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        resolve(blob);
      },
      "image/webp",
      quality
    );
  });
}
