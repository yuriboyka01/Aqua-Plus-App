import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { recordMessageAttempt } from './dbService';
import { BUSINESS_OWNER_ID } from '../lib/constants';

const API_BASE_URL_STORAGE_KEY = 'aquaplus_api_base_url';

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

/**
 * Sends a message directly through the official Meta WhatsApp Business Cloud API.
 * Uses Capacitor's native HTTP on Android/iOS (bypassing CORS entirely) and native fetch on web.
 */
export async function sendViaMetaCloudDirect(phone: string, templateName?: string): Promise<{
  success: boolean;
  status: string;
  providerMessageId?: string;
  error?: string;
}> {
  const token = (import.meta.env.VITE_WHATSAPP_ACCESS_TOKEN as string | undefined)?.trim();
  const phoneId = (import.meta.env.VITE_WHATSAPP_PHONE_NUMBER_ID as string | undefined)?.trim() || '1449739141549620';
  const version = (import.meta.env.VITE_WHATSAPP_GRAPH_API_VERSION as string | undefined)?.trim() || 'v25.0';
  const template = templateName || (import.meta.env.VITE_WHATSAPP_TEMPLATE_NAME as string | undefined)?.trim() || 'hello_world';

  if (!token || !phoneId) {
    return {
      success: false,
      status: 'not_configured',
      error: 'Meta WhatsApp Cloud API credentials missing from client environment.',
    };
  }

  const cleanDigits = phone.replace(/\D/g, '');
  const recipient = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;
  const url = `https://graph.facebook.com/${version}/${phoneId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    to: recipient,
    type: 'template',
    template: {
      name: template,
      language: { code: template === 'hello_world' ? 'en_US' : 'en' },
    },
  };

  try {
    let resData: any;
    let statusCode: number;

    if (Capacitor.isNativePlatform()) {
      const response = await CapacitorHttp.post({
        url,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: payload,
      });
      statusCode = response.status;
      resData = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    } else {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      statusCode = response.status;
      resData = await response.json();
    }

    if (statusCode >= 200 && statusCode < 300 && resData?.messages?.[0]?.id) {
      return {
        success: true,
        status: 'accepted',
        providerMessageId: resData.messages[0].id,
      };
    } else {
      const errMsg = resData?.error?.message || `Meta Graph API error (HTTP ${statusCode})`;
      return {
        success: false,
        status: 'failed',
        error: errMsg,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      status: 'failed',
      error: err?.message || 'Direct connection to Meta Graph API failed.',
    };
  }
}

export async function runDailyBatch(): Promise<DailyBatchResponse> {
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
  // If backend server URL is configured or running locally, query it first
  const backendBase = getApiBaseUrl();
  const isLocalWeb = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  if (backendBase || isLocalWeb) {
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
      // Backend unreachable, fall through to client-level direct status
    }
  }

  // Client-Level Direct Cloud Gateway Status
  const hasToken = !!import.meta.env.VITE_WHATSAPP_ACCESS_TOKEN;
  const phoneId = (import.meta.env.VITE_WHATSAPP_PHONE_NUMBER_ID as string | undefined)?.trim() || '1449739141549620';

  return {
    whatsapp: {
      status: hasToken ? 'configured' : 'not_configured',
      details: hasToken
        ? `Meta WhatsApp Business Cloud API is active (Phone ID: ...${phoneId.slice(-4)}). Direct Cloud Gateway ready.`
        : 'Meta WhatsApp credentials missing.',
      phoneNumberIdMasked: phoneId ? `...${phoneId.slice(-4)}` : undefined,
    },
    email: {
      status: 'configured',
      details: 'Owner daily digest email configured.',
    },
  };
}

export async function testWhatsAppIntegration(phone: string, customerName: string): Promise<{
  success: boolean;
  status: string;
  error?: string;
  providerMessageId?: string;
}> {
  // On native mobile app, always dispatch directly via Meta Cloud API using Capacitor native HTTP
  if (Capacitor.isNativePlatform()) {
    return await sendViaMetaCloudDirect(phone);
  }

  // On web, try backend server if available, falling back gracefully to direct dispatch
  const backendBase = getApiBaseUrl();
  const isLocalWeb = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  if (backendBase || isLocalWeb) {
    try {
      let token: string | undefined;
      try {
        token = await auth.currentUser?.getIdToken();
      } catch {
        // Token refresh error (e.g. securetoken API disabled); proceed to direct dispatch
      }
      const url = resolveApiUrl('/api/whatsapp/test');
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ phone, customerName }),
      });
      const text = await res.text();
      if (!text.startsWith('<!doctype') && !text.startsWith('<html')) {
        const data = JSON.parse(text);
        if (res.ok && data.success) return data;
      }
    } catch {
      // Backend unreachable or failed; fall through to permanent direct cloud gateway
    }
  }

  // Permanent Direct Cloud Gateway Fallback
  return await sendViaMetaCloudDirect(phone);
}

export async function sendWhatsAppReminder(customerId: string, reminderId: string): Promise<{
  success: boolean; status: string; providerMessageId?: string; error?: string;
}> {
  // On native mobile app, dispatch directly via Meta Cloud API
  const isNative = Capacitor.isNativePlatform();
  const backendBase = getApiBaseUrl();
  const isLocalWeb = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  if (!isNative && (backendBase || isLocalWeb)) {
    try {
      let token: string | undefined;
      try {
        token = await auth.currentUser?.getIdToken();
      } catch {}
      const url = resolveApiUrl('/api/whatsapp/send-reminder');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ customerId, reminderId }),
      });
      const text = await response.text();
      if (!text.startsWith('<!doctype') && !text.startsWith('<html')) {
        const result = JSON.parse(text);
        if (response.ok && result.success) return result;
      }
    } catch {
      // Fall through to direct client dispatch
    }
  }

  // Direct Client Dispatch with Firestore persistence
  try {
    const [custDoc, remDoc] = await Promise.all([
      getDoc(doc(db, 'customers', customerId)),
      getDoc(doc(db, 'reminders', reminderId)),
    ]);

    if (!custDoc.exists() || !remDoc.exists()) {
      return { success: false, status: 'failed', error: 'Customer or reminder not found in database.' };
    }

    const customer = custDoc.data() as any;
    const res = await sendViaMetaCloudDirect(customer.primaryPhone);
    const attemptedAt = new Date().toISOString();

    if (res.success) {
      await recordMessageAttempt({
        customerId,
        customerName: customer.fullName || '',
        customerPhone: customer.primaryPhone || '',
        reminderId,
        idempotencyKey: `${customerId}_${reminderId}_${Date.now()}`,
        provider: 'whatsapp_cloud_api',
        templateName: import.meta.env.VITE_WHATSAPP_TEMPLATE_NAME || 'hello_world',
        language: 'en',
        providerMessageId: res.providerMessageId || undefined,
        status: 'success',
        attemptedAt,
        ownerId: BUSINESS_OWNER_ID,
      }, BUSINESS_OWNER_ID);

      await updateDoc(doc(db, 'reminders', reminderId), {
        status: 'sent',
        messageStatus: 'sent',
        lastAttemptDate: attemptedAt,
        updatedAt: attemptedAt,
      });
    }

    return res;
  } catch (err: any) {
    return {
      success: false,
      status: 'failed',
      error: err?.message || 'Direct reminder dispatch failed',
    };
  }
}

export async function testEmailIntegration(email: string): Promise<{
  success: boolean;
  status: string;
  error?: string;
}> {
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
