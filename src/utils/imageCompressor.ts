/**
 * src/utils/imageCompressor.ts
 *
 * Client-side image compression and pre-processing pipeline for AquaPlus Service OS.
 * Resizes smartphone camera captures and invoice scans to max 1600px at 0.85 JPEG quality,
 * reducing payload from 8MB-15MB down to ~200KB-400KB while preserving OCR readability.
 */

export interface ImageCompressorOptions {
  /** Maximum width or height in pixels. Default: 1600. */
  maxDimension?: number;
  /** JPEG compression quality between 0.0 and 1.0. Default: 0.85. */
  quality?: number;
  /** Output MIME type. Default: 'image/jpeg'. */
  mimeType?: string;
}

export interface CompressedImageResult {
  /** Raw base64 string without data URI prefix (ready for Gemini API inlineData). */
  base64Data: string;
  /** MIME type of the compressed image, typically 'image/jpeg'. */
  mimeType: string;
  /** Output image width in pixels. */
  width: number;
  /** Output image height in pixels. */
  height: number;
  /** Original file size in bytes. */
  originalSize: number;
  /** Compressed file size in bytes (approximate or derived from base64). */
  compressedSize: number;
  /** Full data URI ('data:image/jpeg;base64,...') for UI image preview. */
  dataUrl?: string;
  /** Scale factor applied to original dimensions (<= 1.0). */
  scale?: number;
}

/**
 * Calculates scaled dimensions preserving aspect ratio without upscaling small images.
 */
export function calculateScaledDimensions(
  width: number,
  height: number,
  maxDimension = 1600
): { width: number; height: number; scale: number } {
  if (width <= 0 || height <= 0 || !Number.isFinite(width) || !Number.isFinite(height)) {
    return { width: 0, height: 0, scale: 1 };
  }
  const maxSide = Math.max(width, height);
  if (maxSide <= maxDimension) {
    return { width: Math.round(width), height: Math.round(height), scale: 1 };
  }
  const scale = maxDimension / maxSide;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  };
}

/**
 * Extracts MIME type and raw base64 data from a data URL string.
 */
export function parseDataUrl(dataUrl: string): { mimeType: string; base64Data: string } {
  if (!dataUrl || typeof dataUrl !== 'string') {
    return { mimeType: 'image/jpeg', base64Data: '' };
  }
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    return { mimeType: match[1], base64Data: match[2] };
  }
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex !== -1 && dataUrl.startsWith('data:')) {
    const header = dataUrl.slice(5, commaIndex);
    const mime = header.split(';')[0] || 'image/jpeg';
    return { mimeType: mime, base64Data: dataUrl.slice(commaIndex + 1) };
  }
  return { mimeType: 'image/jpeg', base64Data: dataUrl };
}

/**
 * Calculates exact or approximate binary byte size from a base64 string in O(1).
 */
export function estimateBase64Size(base64Data: string): number {
  if (!base64Data || typeof base64Data !== 'string') return 0;
  let padding = 0;
  if (base64Data.endsWith('==')) padding = 2;
  else if (base64Data.endsWith('=')) padding = 1;
  return Math.max(0, Math.floor((base64Data.length * 3) / 4) - padding);
}

/**
 * Validates that an input object is an image file of non-zero size.
 */
export function validateImageFile(file: unknown): { valid: boolean; error?: string } {
  if (!file || typeof file !== 'object') {
    return { valid: false, error: 'No image file provided.' };
  }
  const f = file as { size?: number; type?: string; name?: string };
  if (typeof f.size === 'number' && f.size === 0) {
    return { valid: false, error: 'The selected image file is empty (0 bytes).' };
  }
  const type = typeof f.type === 'string' ? f.type.toLowerCase().trim() : '';
  const name = typeof f.name === 'string' ? f.name.toLowerCase().trim() : '';
  const isImageMime = type.startsWith('image/');
  const isImageExt = /\.(jpe?g|png|webp|heic|heif|bmp|tiff?)$/i.test(name);

  if (type && !isImageMime && !isImageExt) {
    return {
      valid: false,
      error: `Unsupported file format (${type}). Please select an image (JPEG, PNG, WebP).`,
    };
  }
  if (!type && !isImageExt && name) {
    return {
      valid: false,
      error: 'File does not appear to be an image. Please select a JPEG, PNG, or WebP photo.',
    };
  }
  return { valid: true };
}

/**
 * Formats byte count into human-readable size for UI displays (e.g. "320 KB", "11.4 MB").
 */
export function formatFileSize(bytes: number): string {
  if (bytes <= 0 || !Number.isFinite(bytes)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Reads a File or Blob into a base64 Data URL using FileReader or Node arrayBuffer.
 */
export async function readFileAsDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    // 1. Browser runtime with FileReader
    if (typeof FileReader !== 'undefined') {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('FileReader returned non-string result.'));
        }
      };
      reader.onerror = () => reject(reader.error || new Error('FileReader failed to read file.'));
      reader.readAsDataURL(file);
      return;
    }

    // 2. Node.js runtime fallback via arrayBuffer
    if (typeof (file as any).arrayBuffer === 'function') {
      (file as any)
        .arrayBuffer()
        .then((buffer: ArrayBuffer) => {
          const base64 = Buffer.from(buffer).toString('base64');
          const mime = (file as any).type || 'image/jpeg';
          resolve(`data:${mime};base64,${base64}`);
        })
        .catch(reject);
      return;
    }

    reject(new Error('Unable to read image: neither FileReader nor arrayBuffer is supported in this runtime.'));
  });
}

/**
 * Compresses an image file client-side using HTML5 Canvas to maxDimension and quality.
 * Falls back safely to direct DataURL if Canvas is unavailable.
 */
export async function compressImage(
  file: File | Blob,
  options: ImageCompressorOptions = {}
): Promise<CompressedImageResult> {
  // 1. Validate file
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid image file.');
  }

  const originalSize = file.size || 0;
  const maxDimension = options.maxDimension ?? 1600;
  const quality = Math.min(1.0, Math.max(0.1, options.quality ?? 0.85));
  const outputMimeType = options.mimeType ?? 'image/jpeg';

  // 2. Check if running in browser with DOM canvas support
  const hasCanvasSupport =
    typeof document !== 'undefined' &&
    typeof document.createElement === 'function' &&
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function';

  // 3. Fallback path if canvas or DOM is unavailable
  if (!hasCanvasSupport) {
    const rawDataUrl = await readFileAsDataUrl(file);
    const { mimeType: parsedMime, base64Data } = parseDataUrl(rawDataUrl);
    const compressedSize = estimateBase64Size(base64Data);
    return {
      base64Data,
      mimeType: parsedMime || outputMimeType,
      width: 0,
      height: 0,
      originalSize,
      compressedSize: compressedSize || originalSize,
      dataUrl: rawDataUrl,
      scale: 1,
    };
  }

  // 4. In-browser canvas compression pipeline
  const objectUrl = URL.createObjectURL(file);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Failed to load image into browser memory. The file may be corrupted.'));
      el.src = objectUrl;
    });

    const naturalWidth = img.naturalWidth || img.width;
    const naturalHeight = img.naturalHeight || img.height;

    if (!naturalWidth || !naturalHeight) {
      throw new Error('Image dimensions could not be determined.');
    }

    const { width: targetWidth, height: targetHeight, scale } = calculateScaledDimensions(
      naturalWidth,
      naturalHeight,
      maxDimension
    );

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      // Fallback if 2D context creation failed
      const rawDataUrl = await readFileAsDataUrl(file);
      const { mimeType: parsedMime, base64Data } = parseDataUrl(rawDataUrl);
      return {
        base64Data,
        mimeType: parsedMime || outputMimeType,
        width: naturalWidth,
        height: naturalHeight,
        originalSize,
        compressedSize: estimateBase64Size(base64Data) || originalSize,
        dataUrl: rawDataUrl,
        scale: 1,
      };
    }

    // High quality bicubic downsampling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const dataUrl = canvas.toDataURL(outputMimeType, quality);
    const { mimeType: finalMime, base64Data } = parseDataUrl(dataUrl);
    const compressedSize = estimateBase64Size(base64Data);

    // Free canvas memory buffer on mobile devices
    canvas.width = 0;
    canvas.height = 0;

    return {
      base64Data,
      mimeType: finalMime,
      width: targetWidth,
      height: targetHeight,
      originalSize,
      compressedSize,
      dataUrl,
      scale,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
