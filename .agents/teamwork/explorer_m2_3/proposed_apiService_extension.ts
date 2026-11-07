import {
  InventoryCategory,
  InventoryScanResult,
  InventoryScanType,
  ScannedItemSuggestion,
  VisionConfidence,
  isInventoryCategory,
} from '../types';

export type InventoryScanErrorCode =
  | 'BACKEND_NOT_CONFIGURED'
  | 'UNAUTHORIZED'
  | 'QUOTA_EXCEEDED'
  | 'SERVICE_UNAVAILABLE'
  | 'SERVER_ERROR'
  | 'PAYLOAD_TOO_LARGE'
  | 'INVALID_REQUEST'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'INVALID_RESPONSE'
  | 'CANCELLED';

export class InventoryScanError extends Error {
  readonly code: InventoryScanErrorCode;
  readonly statusCode?: number;
  readonly canRetry: boolean;

  constructor(
    message: string,
    code: InventoryScanErrorCode,
    statusCode?: number,
    canRetry: boolean = false
  ) {
    super(message);
    this.name = 'InventoryScanError';
    this.code = code;
    this.statusCode = statusCode;
    this.canRetry = canRetry;
  }
}

export interface InventoryScanOptions {
  timeoutMs?: number; // Defaults to 25_000 (25 seconds)
  signal?: AbortSignal;
  authToken?: string; // Optional override for testing or background execution
}

export async function scanInventoryImage(
  imageBase64: string,
  mimeType: string = 'image/jpeg',
  options?: InventoryScanOptions
): Promise<InventoryScanResult> {
  if (!imageBase64 || typeof imageBase64 !== 'string' || !imageBase64.trim()) {
    throw new InventoryScanError(
      'Image data is required to perform an inventory scan.',
      'INVALID_REQUEST',
      400,
      false
    );
  }

  if (!canUseBackendApi()) {
    throw new InventoryScanError(
      'Backend API URL is required in the Android app. Open Settings, enter the deployed HTTPS backend URL, and save it.',
      'BACKEND_NOT_CONFIGURED',
      0,
      false
    );
  }

  const token = options?.authToken || (await auth.currentUser?.getIdToken());
  if (!token) {
    throw new InventoryScanError(
      'Sign in with an authorized owner account before scanning inventory items.',
      'UNAUTHORIZED',
      401,
      false
    );
  }

  // Sanitize imageBase64 (strip data URL prefix if present)
  let cleanBase64 = imageBase64.trim();
  let resolvedMimeType = (mimeType || '').trim().toLowerCase();

  if (cleanBase64.startsWith('data:')) {
    const match = cleanBase64.match(/^data:([^;]+);base64,(.+)$/s);
    if (match) {
      if (!resolvedMimeType || resolvedMimeType === 'image/jpeg') {
        resolvedMimeType = match[1].toLowerCase();
      }
      cleanBase64 = match[2].trim();
    } else if (cleanBase64.includes(',')) {
      cleanBase64 = cleanBase64.split(',')[1].trim();
    }
  }

  if (!cleanBase64) {
    throw new InventoryScanError(
      'Image data is empty or malformed.',
      'INVALID_REQUEST',
      400,
      false
    );
  }

  if (!resolvedMimeType) {
    resolvedMimeType = 'image/jpeg';
  }

  const timeoutMs = options?.timeoutMs ?? 25_000;
  const controller = new AbortController();
  let timedOut = false;

  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error('TIMEOUT'));
  }, timeoutMs);

  const forwardAbort = () => {
    controller.abort(options?.signal?.reason);
  };

  if (options?.signal) {
    if (options.signal.aborted) {
      clearTimeout(timeoutId);
      throw new InventoryScanError('Image scan was cancelled.', 'CANCELLED', 0, false);
    }
    options.signal.addEventListener('abort', forwardAbort, { once: true });
  }

  const url = resolveApiUrl('/api/inventory/scan');
  let response: Response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        imageBase64: cleanBase64,
        mimeType: resolvedMimeType,
      }),
      signal: controller.signal,
    });
  } catch (fetchError: unknown) {
    if (timedOut) {
      throw new InventoryScanError(
        `Image scan timed out after ${Math.round(timeoutMs / 1000)} seconds. Please check your network connection or enter items manually.`,
        'TIMEOUT',
        408,
        true
      );
    }
    if (options?.signal?.aborted) {
      throw new InventoryScanError('Image scan was cancelled.', 'CANCELLED', 0, false);
    }
    const msg = fetchError instanceof Error ? fetchError.message : String(fetchError);
    throw new InventoryScanError(
      `Unable to connect to backend server at ${url} (${msg}). Check your connection or enter items manually.`,
      'NETWORK_ERROR',
      0,
      true
    );
  } finally {
    clearTimeout(timeoutId);
    if (options?.signal) {
      options.signal.removeEventListener('abort', forwardAbort);
    }
  }

  const text = await response.text();

  if (text.startsWith('<!doctype') || text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
    throw new InventoryScanError(
      `Backend server unavailable (returned HTML HTTP ${response.status}). Check API URL configuration or enter items manually.`,
      'INVALID_RESPONSE',
      response.status,
      false
    );
  }

  let resultData: any;
  try {
    resultData = text ? JSON.parse(text) : {};
  } catch {
    throw new InventoryScanError(
      `Invalid JSON response received from server at ${url}. Please switch to manual entry.`,
      'INVALID_RESPONSE',
      response.status,
      false
    );
  }

  if (!response.ok) {
    const serverError = typeof resultData?.error === 'string' ? resultData.error : '';

    switch (response.status) {
      case 401:
      case 403:
        throw new InventoryScanError(
          serverError || 'Authentication required. Sign in with an authorized owner account or enter items manually.',
          'UNAUTHORIZED',
          response.status,
          false
        );

      case 429:
        throw new InventoryScanError(
          'AI scan quota temporarily exhausted. Please wait a moment or enter manually.',
          'QUOTA_EXCEEDED',
          429,
          true
        );

      case 413:
        throw new InventoryScanError(
          serverError || 'Image file is too large. Please take a closer photo or use a smaller image.',
          'PAYLOAD_TOO_LARGE',
          413,
          false
        );

      case 503:
        throw new InventoryScanError(
          serverError || 'AI vision service is currently unavailable. Please verify API configuration or enter items manually.',
          'SERVICE_UNAVAILABLE',
          503,
          false
        );

      case 400:
        throw new InventoryScanError(
          serverError || 'Invalid image or scan request. Please provide a clear spare parts photo or bill.',
          'INVALID_REQUEST',
          400,
          false
        );

      default:
        throw new InventoryScanError(
          serverError || `AI scan failed due to a server error (HTTP ${response.status}). Please try again or switch to manual entry.`,
          'SERVER_ERROR',
          response.status,
          true
        );
    }
  }

  // Normalize and sanitize successful response
  const scanType: InventoryScanType =
    resultData.scanType === 'physical_parts' ||
    resultData.scanType === 'supplier_invoice' ||
    resultData.scanType === 'unrecognized'
      ? resultData.scanType
      : 'unrecognized';

  const rawItems = Array.isArray(resultData.items) ? resultData.items : [];
  const normalizedItems: ScannedItemSuggestion[] = rawItems.map((item: any) => {
    const name = typeof item?.name === 'string' && item.name.trim() ? item.name.trim() : 'Unknown Spare Part';
    const category: InventoryCategory = isInventoryCategory(item?.category) ? item.category : 'other';
    const quantity =
      typeof item?.quantity === 'number' && !Number.isNaN(item.quantity) && item.quantity >= 0
        ? Math.round(item.quantity)
        : 1;
    const unitCost =
      typeof item?.unitCost === 'number' && !Number.isNaN(item.unitCost) && item.unitCost >= 0
        ? Number(item.unitCost.toFixed(2))
        : undefined;
    const sellingPrice =
      typeof item?.sellingPrice === 'number' && !Number.isNaN(item.sellingPrice) && item.sellingPrice >= 0
        ? Number(item.sellingPrice.toFixed(2))
        : undefined;
    const confidence: VisionConfidence =
      item?.confidence === 'high' || item?.confidence === 'medium' || item?.confidence === 'low'
        ? item.confidence
        : 'medium';

    return {
      name,
      category,
      quantity,
      unitCost,
      sellingPrice,
      confidence,
      notes: typeof item?.notes === 'string' ? item.notes.trim() : undefined,
      matchedItemId: typeof item?.matchedItemId === 'string' ? item.matchedItemId : undefined,
      action:
        item?.action === 'add_new' || item?.action === 'increment_existing' || item?.action === 'skip'
          ? item.action
          : 'add_new',
    };
  });

  let rawSummary = typeof resultData.rawSummary === 'string' ? resultData.rawSummary.trim() : undefined;
  let error = typeof resultData.error === 'string' ? resultData.error.trim() : undefined;

  if (scanType === 'unrecognized' && !error) {
    error =
      'Image could not be identified as water purifier spare parts or a supplier bill. Please ensure good lighting and clear text, or enter items manually.';
  }

  return {
    scanType,
    supplierName: typeof resultData.supplierName === 'string' ? resultData.supplierName.trim() : undefined,
    invoiceNumber: typeof resultData.invoiceNumber === 'string' ? resultData.invoiceNumber.trim() : undefined,
    invoiceDate: typeof resultData.invoiceDate === 'string' ? resultData.invoiceDate.trim() : undefined,
    items: normalizedItems,
    rawSummary,
    error,
  };
}

export function isQuotaExceededError(error: unknown): boolean {
  if (error instanceof InventoryScanError) {
    return error.code === 'QUOTA_EXCEEDED' || error.statusCode === 429;
  }
  if (error instanceof Error) {
    return /quota|429|resource_exhausted|rate limit/i.test(error.message);
  }
  return false;
}

export function isAuthError(error: unknown): boolean {
  if (error instanceof InventoryScanError) {
    return error.code === 'UNAUTHORIZED' || error.statusCode === 401 || error.statusCode === 403;
  }
  if (error instanceof Error) {
    return /unauthorized|sign in|owner account/i.test(error.message);
  }
  return false;
}

export function isNetworkOrTimeoutError(error: unknown): boolean {
  if (error instanceof InventoryScanError) {
    return error.code === 'TIMEOUT' || error.code === 'NETWORK_ERROR' || error.statusCode === 408;
  }
  if (error instanceof Error) {
    return /timeout|network|connect|fetch/i.test(error.message);
  }
  return false;
}

export function getScanErrorMessage(error: unknown): string {
  if (error instanceof InventoryScanError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred during image scan. Please switch to manual entry.';
}
