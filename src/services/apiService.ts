import { auth } from '../lib/firebase';
import { isHttpProtocol } from '../utils/apiUtils';
import {
  InventoryCategory,
  InventoryScanResult,
  InventoryScanType,
  ScannedItemSuggestion,
  VisionConfidence,
  isInventoryCategory,
} from '../types';

const API_BASE_URL_STORAGE_KEY = 'aquaplus_api_base_url';

function canUseBackendApi(): boolean {
  return !!getApiBaseUrl() || (typeof window !== 'undefined' && isHttpProtocol(window.location.protocol));
}

export function sanitizeApiBaseUrl(raw: string): string {
  let url = raw.trim();
  if (!url) return '';
  // Fix mobile keyboard auto-correct issues like "http: /", "http:/", "http //"
  url = url.replace(/^(https?):?\s*\/+/i, '$1://');
  url = url.replace(/\s+/g, '');
  if (!/^https?:\/\//i.test(url)) {
    url = `http://${url}`;
  }
  return url.replace(/\/+$/, '');
}

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(API_BASE_URL_STORAGE_KEY);
    if (saved) {
      // Auto-purge malformed or obsolete local Wi-Fi IP addresses
      if (saved.includes(' ') || saved.includes('http: /') || saved.includes('10.137.168')) {
        localStorage.removeItem(API_BASE_URL_STORAGE_KEY);
      } else {
        return sanitizeApiBaseUrl(saved);
      }
    }
  }
  const envUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (envUrl) return sanitizeApiBaseUrl(envUrl);
  return '';
}

export function setApiBaseUrl(url: string): void {
  if (typeof window !== 'undefined') {
    const sanitized = sanitizeApiBaseUrl(url);
    if (sanitized) {
      localStorage.setItem(API_BASE_URL_STORAGE_KEY, sanitized);
    } else {
      localStorage.removeItem(API_BASE_URL_STORAGE_KEY);
    }
  }
}

function resolveApiUrl(path: string): string {
  const base = getApiBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${normalizedPath}` : normalizedPath;
}

export interface DailyBatchResponse {
  status: 'completed' | 'partial_failure' | 'reconciliation_required' | 'already_completed' | 'disabled' | 'not_configured';
  reportDate: string;
  totalRemindersEvaluated: number;
  eligibleCount: number;
  messagesSent: number;
  messagesFailed: number;
  persistenceFailures?: number;
  unknownOutcomes?: number;
  skippedCount: number;
  emailDeliveryStatus?: string;
}

export async function runDailyBatch(): Promise<DailyBatchResponse> {
  if (!canUseBackendApi()) {
    throw new Error('Backend API URL is required in the Android app. Open Settings, enter the deployed HTTPS backend URL, and save it.');
  }
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Sign in with an authorized owner account before running the daily batch.');
  const url = resolveApiUrl('/api/scheduler/run');
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await response.text();
  if (text.startsWith('<!doctype') || text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
    throw new Error(`Backend server unavailable (returned HTML HTTP ${response.status}). Check API URL configuration.`);
  }
  let result: any;
  try {
    result = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Invalid response received from server at ${url}`);
  }
  if (!response.ok) throw new Error(result.error || `Daily batch failed (HTTP ${response.status}).`);
  return result as DailyBatchResponse;
}

export interface IntegrationStatusResponse {
  whatsapp: {
    status: 'not_configured' | 'configured' | 'connected' | 'error';
    details: string;
    phoneNumberIdMasked?: string;
  };
  email: {
    status: 'not_configured' | 'configured' | 'error';
    details: string;
  };
}

export async function fetchIntegrationStatus(): Promise<IntegrationStatusResponse> {
  // Web deployments use the same-origin API; native shells require an explicit backend URL.
  if (canUseBackendApi()) {
    try {
      const token = await auth.currentUser?.getIdToken();
      const url = resolveApiUrl('/api/integrations/status');
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const text = await res.text();
      if (!text.startsWith('<!doctype') && !text.startsWith('<html')) {
        const data = JSON.parse(text);
        if (res.ok && data.whatsapp) return data;
      }
    } catch {
      // Keep the unavailable state below; provider credentials remain server-side.
    }
  }

  return {
    whatsapp: {
      status: 'error',
      details: 'Backend server unavailable. Configure the API base URL and try again.',
    },
    email: {
      status: 'error',
      details: 'Backend server unavailable. Configure the API base URL and try again.',
    },
  };
}

export async function testWhatsAppIntegration(phone: string, customerName: string): Promise<{
  success: boolean;
  status: string;
  error?: string;
  providerMessageId?: string;
}> {
  if (!canUseBackendApi()) {
    return { success: false, status: 'failed', error: 'Backend API URL is required in the Android app. Save the deployed HTTPS URL in Settings before testing WhatsApp.' };
  }
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return { success: false, status: 'failed', error: 'Sign in with an authorized owner account before testing WhatsApp.' };
    const url = resolveApiUrl('/api/whatsapp/test');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ phone, customerName }),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok ? data : { success: false, status: 'failed', error: data.error || `WhatsApp test failed (HTTP ${res.status}).` };
  } catch (error) {
    return { success: false, status: 'failed', error: error instanceof Error ? error.message : 'Backend WhatsApp test failed.' };
  }
}

export async function sendWhatsAppReminder(
  customerId: string,
  reminderId: string,
  languageCode: 'en' | 'ta' = 'en'
): Promise<{
  success: boolean; status: string; providerMessageId?: string; error?: string;
}> {
  if (!canUseBackendApi()) {
    return { success: false, status: 'failed', error: 'Backend API URL is required in the Android app. Save the deployed HTTPS URL in Settings before sending reminders.' };
  }
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return { success: false, status: 'failed', error: 'Sign in with an authorized owner account before sending a reminder.' };
    const url = resolveApiUrl('/api/whatsapp/send-reminder');
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ customerId, reminderId, languageCode }),
    });
    const result = await response.json().catch(() => ({}));
    return response.ok ? result : { success: false, status: result.status || 'failed', error: result.error || `Reminder send failed (HTTP ${response.status}).` };
  } catch (error) {
    return { success: false, status: 'failed', error: error instanceof Error ? error.message : 'Backend reminder dispatch failed.' };
  }
}

export async function testEmailIntegration(email: string): Promise<{
  success: boolean;
  status: string;
  error?: string;
}> {
  if (!canUseBackendApi()) {
    return { success: false, status: 'failed', error: 'Backend API URL is required in the Android app. Save the deployed HTTPS URL in Settings before testing email.' };
  }
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Sign in with an authorized owner account before testing email.');
    const url = resolveApiUrl('/api/email/test');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email }),
    });
    const text = await res.text();
    if (text.startsWith('<!doctype') || text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
      return {
        success: false,
        status: 'failed',
        error: `Server returned HTML (HTTP ${res.status}). Ensure API Server URL points to the backend server.`,
      };
    }
    let data: any;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      return {
        success: false,
        status: 'failed',
        error: `Failed to parse JSON response from server at ${url}`,
      };
    }
    return data;
  } catch (err: any) {
    return {
      success: false,
      status: 'failed',
      error: err?.message || 'Network request failed',
    };
  }
}


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
  timeoutMs?: number;
  signal?: AbortSignal;
  authToken?: string;
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
