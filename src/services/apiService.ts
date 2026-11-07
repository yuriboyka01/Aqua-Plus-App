import { auth } from '../lib/firebase';

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
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Sign in with an authorized owner account before running the daily batch.');
  const response = await fetch('/api/scheduler/run', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const result = await response.json();
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
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Sign in with an authorized owner account to check integrations.');
    const res = await fetch('/api/integrations/status', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err: any) {
    return {
      whatsapp: {
        status: 'not_configured',
        details: 'API endpoint unavailable or credentials missing from server environment.',
      },
      email: {
        status: 'not_configured',
        details: 'API endpoint unavailable or credentials missing from server environment.',
      },
    };
  }
}

export async function testWhatsAppIntegration(phone: string, customerName: string): Promise<{
  success: boolean;
  status: string;
  error?: string;
  providerMessageId?: string;
}> {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Sign in with an authorized owner account before testing WhatsApp.');
    const res = await fetch('/api/whatsapp/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ phone, customerName }),
    });
    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      status: 'failed',
      error: err?.message || 'Network request failed',
    };
  }
}

export async function sendWhatsAppReminder(customerId: string, reminderId: string): Promise<{
  success: boolean; status: string; providerMessageId?: string; error?: string;
}> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Sign in with an authorized owner account before sending a reminder.');
  const response = await fetch('/api/whatsapp/send-reminder', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId, reminderId }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Reminder dispatch failed (HTTP ${response.status}).`);
  return result;
}

export async function testEmailIntegration(email: string): Promise<{
  success: boolean;
  status: string;
  error?: string;
}> {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Sign in with an authorized owner account before testing email.');
    const res = await fetch('/api/email/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email }),
    });
    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      status: 'failed',
      error: err?.message || 'Network request failed',
    };
  }
}

