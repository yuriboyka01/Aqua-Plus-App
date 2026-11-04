import type { Connect } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { getWhatsAppIntegrationStatus, sendWhatsAppTemplateMessage } from './whatsappAdapter.ts';
import { getEmailIntegrationStatus, sendOwnerDailyReportEmail } from './emailAdapter.ts';
import { getAdminAuth } from './firebaseAdmin.ts';
import { runProductionDailyBatch } from './productionScheduler.ts';
import { BUSINESS_OWNER_ID } from '../lib/constants.ts';
import { getAdminDb } from './firebaseAdmin.ts';
import { parseMetaPayload, processMetaWebhook, verifyMetaChallenge, verifyMetaSignature } from './metaWebhook.ts';
import { normalizePhoneNumber } from '../utils/businessLogic.ts';
import { generateIdempotencyKey } from '../utils/businessLogic.ts';
import { getTodayKolkata } from '../utils/dateUtils.ts';
import { isAllowedOrigin } from '../utils/apiUtils.ts';

const OWNER_EMAILS = new Set(
  (process.env.OWNER_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);
const rateLimit = new Map<string, { startedAt: number; count: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 8;
const BODY_LIMIT_BYTES = 16_384;
const WEBHOOK_BODY_LIMIT_BYTES = 262_144;

type AuthenticatedOwner = { uid: string; email: string };

async function authenticateOwner(req: IncomingMessage): Promise<AuthenticatedOwner | null> {
  const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    console.warn(JSON.stringify({ severity: 'WARNING', message: 'Missing Authorization Bearer token' }));
    return null;
  }
  try {
    const user = await getAdminAuth().verifyIdToken(token, true);
    const email = user.email?.toLowerCase();
    if (!user.uid || !email || user.email_verified !== true || !OWNER_EMAILS.has(email)) {
      console.warn(JSON.stringify({ severity: 'WARNING', message: 'User not on owner allowlist', email, allowed: Array.from(OWNER_EMAILS) }));
      return null;
    }
    return { uid: user.uid, email };
  } catch (err: unknown) {
    console.error(JSON.stringify({ severity: 'ERROR', message: 'Failed to verify Firebase ID token', error: err instanceof Error ? err.message : String(err) }));
    return null;
  }
}

function isSchedulerRequest(req: IncomingMessage): boolean {
  const expected = process.env.SCHEDULER_BEARER_TOKEN || '';
  const actual = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1] || '';
  if (expected.length < 32 || !actual) return false;
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}

function isRateLimited(uid: string): boolean {
  const now = Date.now();
  const current = rateLimit.get(uid);
  if (!current || now - current.startedAt >= RATE_LIMIT_WINDOW_MS) {
    rateLimit.set(uid, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > RATE_LIMIT_MAX;
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > BODY_LIMIT_BYTES) throw new Error('Request body is too large.');
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  const parsed = JSON.parse(raw || '{}');
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Expected a JSON object.');
  }
  return parsed as Record<string, unknown>;
}

async function readRawBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > limit) throw new Error('Request body is too large.');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  res.statusCode = statusCode;
  res.end(JSON.stringify(data));
}

export function createApiMiddleware(): Connect.NextHandleFunction {
  return (req, res, next) => {
    const url = new URL(req.url || '/', 'http://localhost');
    if (!url.pathname.startsWith('/api/')) return next();

    const origin = req.headers.origin;
    if (origin && isAllowedOrigin(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Requested-With');
    }
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    void (async () => {
      if (url.pathname === '/api/health' && req.method === 'GET') {
        sendJson(res, 200, { status: 'ok', service: 'AquaPlus Service Backend', timestamp: new Date().toISOString() });
        return;
      }

      // Meta's webhook is public by design; authenticity is established by
      // its verification token (GET) and raw-body HMAC signature (POST).
      if (url.pathname === '/api/webhooks/whatsapp' && req.method === 'GET') {
        const mode = url.searchParams.get('hub.mode');
        const token = url.searchParams.get('hub.verify_token') || '';
        const challenge = url.searchParams.get('hub.challenge') || '';
        const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '';
        if (verifyMetaChallenge(mode, token, expected) && challenge) {
          res.statusCode = 200; res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.end(challenge);
        } else sendJson(res, 403, { error: 'Webhook verification failed.' });
        return;
      }
      if (url.pathname === '/api/webhooks/whatsapp' && req.method === 'POST') {
        const rawBody = await readRawBody(req, WEBHOOK_BODY_LIMIT_BYTES);
        const signatureHeader = req.headers['x-hub-signature-256'];
        if (!verifyMetaSignature(rawBody, Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader, process.env.WHATSAPP_APP_SECRET || '')) {
          sendJson(res, 401, { error: 'Invalid webhook signature.' });
          return;
        }
        let payload: unknown;
        try { payload = parseMetaPayload(rawBody); }
        catch {
          sendJson(res, 400, { error: 'Malformed webhook payload.' });
          return;
        }
        try {
          const result = await processMetaWebhook(getAdminDb(), payload);
          sendJson(res, 200, { status: 'accepted', ...result });
        } catch {
          console.error(JSON.stringify({ severity: 'ERROR', message: 'WhatsApp webhook event persistence failed.' }));
          sendJson(res, 500, { error: 'Webhook event could not be recorded. Meta may retry safely.' });
        }
        return;
      }

      if (OWNER_EMAILS.size === 0) {
        sendJson(res, 503, { error: 'Server owner allowlist (OWNER_EMAILS) is not configured.' });
        return;
      }

      const owner = await authenticateOwner(req);
      const schedulerCaller = !owner && isSchedulerRequest(req);
      if (!owner && !schedulerCaller) {
        sendJson(res, 401, { error: 'An authorized, verified owner account is required.' });
        return;
      }
      if (schedulerCaller && (url.pathname !== '/api/scheduler/run' || req.method !== 'POST')) {
        sendJson(res, 403, { error: 'Scheduler credentials can only invoke the scheduled batch endpoint.' });
        return;
      }
      const ownerId = owner?.uid || process.env.SCHEDULER_OWNER_UID;
      if (!ownerId) {
        sendJson(res, 503, { error: 'Scheduler owner identity is not configured on the server.' });
        return;
      }
      if (schedulerCaller) {
        const schedulerOwner = await getAdminAuth().getUser(ownerId);
        if (!schedulerOwner.email || !schedulerOwner.emailVerified || !OWNER_EMAILS.has(schedulerOwner.email.toLowerCase())) {
          sendJson(res, 403, { error: 'Configured scheduler owner is not on the verified owner allowlist.' });
          return;
        }
      }
      if (isRateLimited(ownerId)) {
        res.setHeader('Retry-After', '60');
        sendJson(res, 429, { error: 'Too many API requests. Try again in a minute.' });
        return;
      }

      if (url.pathname === '/api/integrations/status' && req.method === 'GET') {
        sendJson(res, 200, {
          whatsapp: getWhatsAppIntegrationStatus(),
          email: getEmailIntegrationStatus(),
        });
        return;
      }

      if (url.pathname === '/api/scheduler/run' && req.method === 'POST') {
        try {
          const result = await runProductionDailyBatch(BUSINESS_OWNER_ID);
          sendJson(res, 200, result);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Daily batch failed.';
          sendJson(res, message.includes('already running') ? 409 : 500, {
            error: message.includes('already running') ? message : 'Daily batch failed. Review server logs and the scheduler run record.',
          });
        }
        return;
      }

      if (url.pathname === '/api/whatsapp/test' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
        const testRecipient = process.env.WHATSAPP_TEST_RECIPIENT || '';
        if (!testRecipient) {
          sendJson(res, 503, { success: false, status: 'not_configured', error: 'Live WhatsApp test is unavailable: test recipient is not configured.' });
          return;
        }
        if (!phone || normalizePhoneNumber(phone) !== normalizePhoneNumber(testRecipient)) {
          sendJson(res, 403, { success: false, status: 'failed', error: 'WhatsApp test messages are restricted to the configured test recipient.' });
          return;
        }

        const result = await sendWhatsAppTemplateMessage({
          recipientPhone: phone,
          customerName: 'AquaPlus Test',
          lastServiceDate: 'integration test',
          businessPhone: process.env.BUSINESS_PHONE || '+91 70103 29920',
        });
        sendJson(res, result.success ? 200 : 502, result);
        return;
      }

      if (url.pathname === '/api/whatsapp/send-reminder' && req.method === 'POST') {
        if (!owner) { sendJson(res, 403, { error: 'An owner account is required for reminder dispatch.' }); return; }
        const whatsappStatus = getWhatsAppIntegrationStatus();
        if (whatsappStatus.status !== 'configured') {
          sendJson(res, 503, {
            success: false,
            status: 'not_configured',
            error: whatsappStatus.details,
          });
          return;
        }
        const body = await readJsonBody(req);
        const customerId = typeof body.customerId === 'string' ? body.customerId : '';
        const reminderId = typeof body.reminderId === 'string' ? body.reminderId : '';
        const languageCode: 'en' | 'ta' = body.languageCode === 'ta' ? 'ta' : 'en';
        if (!/^[a-zA-Z0-9_-]{1,128}$/.test(customerId) || !/^[a-zA-Z0-9_-]{1,128}$/.test(reminderId)) {
          sendJson(res, 400, { error: 'Valid customer and reminder identifiers are required.' }); return;
        }
        const adminDb = getAdminDb();
        const [customerSnap, reminderSnap] = await Promise.all([
          adminDb.collection('customers').doc(customerId).get(),
          adminDb.collection('reminders').doc(reminderId).get(),
        ]);
        if (!customerSnap.exists || !reminderSnap.exists) { sendJson(res, 404, { error: 'Customer or reminder was not found.' }); return; }
        const customer: any = { id: customerSnap.id, ...customerSnap.data() };
        const reminder: any = { id: reminderSnap.id, ...reminderSnap.data() };
        if (customer.status !== 'active' || customer.isSampleData || reminder.isSampleData || customer.whatsappConsent !== true || customer.remindersPaused || reminder.status === 'paused') {
          sendJson(res, 403, { error: 'Customer is not eligible for WhatsApp messaging.' }); return;
        }
        if (!customer.lastServiceDate || !customer.nextReminderDate || reminder.lastServiceDate !== customer.lastServiceDate || reminder.reminderDate !== customer.nextReminderDate || reminder.reminderDate > getTodayKolkata() || reminder.status === 'superseded' || reminder.status === 'sent' || reminder.messageStatus === 'sent') {
          sendJson(res, 409, { error: 'Reminder is not the current eligible service cycle.' }); return;
        }
        if (reminder.serviceRecordId) {
          const service = await adminDb.collection('serviceRecords').doc(reminder.serviceRecordId).get();
          if (!service.exists || service.data()?.customerId !== customerId || service.data()?.serviceDate !== customer.lastServiceDate) {
            sendJson(res, 409, { error: 'Reminder service history does not match the current cycle.' }); return;
          }
        }
        const idempotencyKey = generateIdempotencyKey(customerId, reminder.serviceRecordId || reminderId, reminder.reminderDate);
        const reservations = adminDb.collection('messageReservations');
        const reservationRef = reservations.doc(`reservation_${createHash('sha256').update(`${BUSINESS_OWNER_ID}:${idempotencyKey}`).digest('hex')}`);
        const claimed = await adminDb.runTransaction(async (tx: any) => {
          const existing = await tx.get(reservations.where('idempotencyKey', '==', idempotencyKey));
          if (!existing.empty) return false;
          tx.create(reservationRef, { ownerId: BUSINESS_OWNER_ID, idempotencyKey, status: 'processing', attemptCount: 1, startedAt: new Date().toISOString() });
          return true;
        });
        if (!claimed) { sendJson(res, 409, { error: 'This reminder already has a dispatch reservation.' }); return; }
        const result = await sendWhatsAppTemplateMessage({ recipientPhone: customer.primaryPhone, customerName: customer.fullName, lastServiceDate: reminder.lastServiceDate, businessPhone: process.env.BUSINESS_PHONE || '+91 70103 29920', languageCode });
        const attemptedAt = new Date().toISOString();
        const attemptId = `attempt_${createHash('sha256').update(`${BUSINESS_OWNER_ID}:${idempotencyKey}:${attemptedAt}`).digest('hex')}`;
        const attemptRef = adminDb.collection('messageAttempts').doc(attemptId);
        try {
          const batch = adminDb.batch();
          batch.update(reservationRef, { status: result.success ? 'sent' : result.status === 'unknown' ? 'processing' : 'failed', providerMessageId: result.providerMessageId || null, finishedAt: attemptedAt });
          batch.create(attemptRef, { id: attemptId, customerId, customerName: customer.fullName, customerPhone: customer.primaryPhone, reminderId, serviceRecordId: reminder.serviceRecordId || null, idempotencyKey, provider: 'whatsapp_cloud_api', templateName: process.env.WHATSAPP_TEMPLATE_NAME || 'service_maintenance_reminder', language: languageCode, status: result.success ? 'success' : result.status === 'unknown' ? 'unknown' : 'failed', providerMessageId: result.providerMessageId || null, errorDetails: result.error || null, attemptedAt, ownerId: BUSINESS_OWNER_ID });
          batch.update(reminderSnap.ref, { status: result.success ? 'sent' : 'failed', messageStatus: result.success ? 'sent' : 'failed', lastAttemptDate: attemptedAt, errorMessage: result.error || null, updatedAt: attemptedAt });
          await batch.commit();
        } catch {
          console.error(JSON.stringify({ severity: 'ERROR', message: 'Manual WhatsApp result persistence failed; reservation retained for reconciliation.', reminderId }));
          sendJson(res, 503, { success: false, status: 'reconciliation_required', error: 'Provider outcome could not be saved. This reminder will not be sent again automatically; reconcile its reservation.' });
          return;
        }
        sendJson(res, result.success ? 200 : 502, { success: result.success, status: result.success ? 'accepted' : 'failed', providerMessageId: result.providerMessageId, error: result.error });
        return;
      }

      if (url.pathname === '/api/email/test' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const email = typeof body.email === 'string' ? body.email.trim() : '';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
          sendJson(res, 400, { success: false, status: 'failed', error: 'Enter a valid email address.' });
          return;
        }
        const result = await sendOwnerDailyReportEmail({
          recipientEmail: email,
          subject: 'AquaPlus Service Test Report',
          textContent: 'This is a test verification email from AquaPlus Service.',
          reportDate: new Date().toISOString().slice(0, 10),
        });
        sendJson(res, result.success ? 200 : 502, result);
        return;
      }

      sendJson(res, 404, { error: `Endpoint ${url.pathname} not found` });
    })().catch((error: unknown) => {
      if (res.headersSent) return;
      const message = error instanceof Error ? error.message : 'Internal server error';
      const status = message.includes('Request body is too large') ? 413 : message.includes('JSON') ? 400 : 500;
      sendJson(res, status, { error: status === 500 ? 'Internal server error' : message });
    });
  };
}

