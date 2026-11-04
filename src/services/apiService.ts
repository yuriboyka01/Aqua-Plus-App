import { auth } from '../lib/firebase';
import { isHttpProtocol } from '../utils/apiUtils';

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
