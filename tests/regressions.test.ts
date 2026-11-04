import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { evaluateReminderEligibility, generateIdempotencyKey, shouldSupersedeReminder } from '../src/utils/businessLogic.ts';
import { runAllBusinessLogicTests } from '../src/utils/testRunner.ts';
import { getTodayKolkata } from '../src/utils/dateUtils.ts';
import { isHttpProtocol } from '../src/utils/apiUtils.ts';
import { executeScheduledDailyBatch } from '../src/server/schedulerAdapter.ts';
import { parseMetaPayload, processMetaWebhook, verifyMetaChallenge, verifyMetaSignature } from '../src/server/metaWebhook.ts';
import { getWhatsAppIntegrationStatus, sendWhatsAppTemplateMessage } from '../src/server/whatsappAdapter.ts';

const today = getTodayKolkata();
function customer(overrides: Record<string, unknown> = {}): any {
  return { id: 'c1', fullName: 'Test', primaryPhone: '9876543210', locality: 'Madurai', status: 'active', whatsappConsent: true, lastServiceDate: today, nextReminderDate: today, ownerId: 'owner', ...overrides };
}
function reminder(overrides: Record<string, unknown> = {}): any {
  return { id: 'r1', customerId: 'c1', customerName: 'Test', customerPhone: '9876543210', customerLocality: 'Madurai', serviceRecordId: 's1', lastServiceDate: today, reminderDate: today, status: 'due_today', messageStatus: 'not_sent', ownerId: 'owner', ...overrides };
}
const settings: any = { businessName: 'AquaPlus', primaryPhone: '7010329920', businessEmail: '', ownerNotificationEmail: '', ownerEmailConfirmed: false, scheduledProcessingEnabled: true };

async function withEnv<T>(values: Record<string, string | undefined>, callback: () => Promise<T> | T): Promise<T> {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await callback();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('existing built-in business logic suite passes', () => {
  const results = runAllBusinessLogicTests();
  assert.equal(results.length, 11);
  assert.deepEqual(results.filter((result) => !result.passed), []);
});

test('superseded reminders are terminal and ineligible', () => {
  const result = evaluateReminderEligibility(reminder({ status: 'superseded' }), customer(), [], true);
  assert.equal(result.isEligible, false);
  assert.match(result.reasons.join(' '), /superseded/i);
});

test('new service retires pending reminder states while retaining sent history', () => {
  for (const status of ['upcoming', 'due_today', 'overdue', 'paused', 'failed']) assert.equal(shouldSupersedeReminder(status), true);
  for (const status of ['sent', 'contacted_manually', 'superseded']) assert.equal(shouldSupersedeReminder(status), false);
});

test('new current-cycle reminder is eligible and old overdue reminder is skipped', async () => {
  let dispatches = 0;
  const old = reminder({ id: 'old', serviceRecordId: 's0', lastServiceDate: '2026-01-01', reminderDate: '2026-02-01', status: 'overdue' });
  const current = reminder();
  const result = await executeScheduledDailyBatch({
    customers: [customer()], reminders: [old, current], serviceRecords: [{ id: 's1', customerId: 'c1', serviceDate: today } as any],
    pastAttempts: [], settings, ownerId: 'owner', whatsappConfigured: true,
    claimDispatch: async () => true,
    dispatchMessage: async () => { dispatches++; return { success: true, status: 'sent', providerMessageId: 'wamid.1' }; },
  });
  assert.equal(dispatches, 1);
  assert.equal(result.messagesSent, 1);
  assert.equal(result.skippedCount, 1);
});

test('superseded reminder never reaches automatic dispatch', async () => {
  let dispatches = 0;
  const result = await executeScheduledDailyBatch({
    customers: [customer()], reminders: [reminder({ status: 'superseded' })],
    serviceRecords: [{ id: 's1', customerId: 'c1', serviceDate: today } as any], pastAttempts: [], settings, ownerId: 'owner',
    whatsappConfigured: true, claimDispatch: async () => true,
    dispatchMessage: async () => { dispatches++; return { success: true, status: 'sent', providerMessageId: 'wamid.unexpected' }; },
  });
  assert.equal(dispatches, 0);
  assert.equal(result.messagesSent, 0);
});

test('provider success with failed persistence is partial and remains reserved from resend', async () => {
  let dispatches = 0;
  const rem = reminder();
  const params: any = {
    customers: [customer()], reminders: [rem], serviceRecords: [{ id: 's1', customerId: 'c1', serviceDate: today }],
    pastAttempts: [], settings, ownerId: 'owner', whatsappConfigured: true,
    claimDispatch: async () => dispatches === 0,
    dispatchMessage: async () => { dispatches++; return { success: true, status: 'sent', providerMessageId: 'wamid.ambiguous' }; },
    onDispatchResult: async () => { throw new Error('database write failed'); },
  };
  const first = await executeScheduledDailyBatch(params);
  const second = await executeScheduledDailyBatch(params);
  assert.equal(first.status, 'partial_failure');
  assert.equal(first.persistenceFailures, 1);
  assert.equal(second.messagesSent, 0);
  assert.equal(dispatches, 1);
});

test('repeat scheduler execution with an existing reservation cannot duplicate a successful send', async () => {
  let dispatches = 0;
  let reserved = false;
  const params: any = {
    customers: [customer()], reminders: [reminder()], serviceRecords: [{ id: 's1', customerId: 'c1', serviceDate: today }],
    pastAttempts: [], settings, ownerId: 'owner', whatsappConfigured: true,
    claimDispatch: async () => { if (reserved) return false; reserved = true; return true; },
    dispatchMessage: async () => { dispatches++; return { success: true, status: 'sent', providerMessageId: 'wamid.once' }; },
  };
  await executeScheduledDailyBatch(params);
  await executeScheduledDailyBatch(params);
  assert.equal(dispatches, 1);
});

test('an unknown provider outcome is persisted as unknown for reconciliation', async () => {
  const result = await executeScheduledDailyBatch({
    customers: [customer()], reminders: [reminder()], serviceRecords: [{ id: 's1', customerId: 'c1', serviceDate: today } as any],
    pastAttempts: [], settings, ownerId: 'owner', whatsappConfigured: true, claimDispatch: async () => true,
    dispatchMessage: async () => ({ success: false, status: 'unknown', error: 'ambiguous outcome' }),
  });
  assert.equal(result.createdAttempts[0]?.status, 'unknown');
});

test('Meta webhook HMAC accepts valid signatures and rejects invalid signatures and payloads', () => {
  const raw = Buffer.from(JSON.stringify({ object: 'whatsapp_business_account', entry: [] }));
  const secret = 'local-test-secret';
  const signature = `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
  assert.equal(verifyMetaSignature(raw, signature, secret), true);
  assert.equal(verifyMetaSignature(raw, signature, 'wrong'), false);
  assert.equal(verifyMetaSignature(raw, 'sha256=bad', secret), false);
  assert.equal(verifyMetaChallenge('subscribe', 'a-long-verification-token-for-tests', 'a-long-verification-token-for-tests'), true);
  assert.equal(verifyMetaChallenge('subscribe', 'wrong-token', 'a-long-verification-token-for-tests'), false);
  assert.deepEqual(parseMetaPayload(raw).entry, []);
  assert.throws(() => parseMetaPayload(Buffer.from('{bad')));
  assert.throws(() => parseMetaPayload(Buffer.from('{}')));
});

class FakeDb {
  rows = new Map<string, any>();
  collection(name: string): any {
    const db = this;
    return {
      name, isCollection: true,
      doc(id: string) { return { name, id, key: `${name}/${id}` }; },
      where(field: string, _op: string, value: unknown) { return { name, field, value, isQuery: true }; },
    };
  }
  async runTransaction(callback: (tx: any) => Promise<any>) {
    const pending: Array<() => void> = [];
    const tx = {
      get: async (ref: any) => {
        if (ref.isQuery || ref.isCollection) {
          const docs = [...this.rows.values()].filter((row) => row.collection === ref.name && (!ref.isQuery || row.data[ref.field] === ref.value)).map((row) => ({ id: row.id, ref: this.collection(ref.name).doc(row.id), data: () => row.data }));
          return { docs, empty: docs.length === 0 };
        }
        const row = this.rows.get(ref.key);
        return { exists: !!row, data: () => row?.data };
      },
      create: (ref: any, data: any) => pending.push(() => { if (this.rows.has(ref.key)) throw new Error('already exists'); this.rows.set(ref.key, { collection: ref.name, id: ref.id, data }); }),
      update: (ref: any, data: any) => pending.push(() => { const row = this.rows.get(ref.key); if (row) Object.assign(row.data, data); }),
      set: (ref: any, data: any, options?: any) => pending.push(() => { const previous = this.rows.get(ref.key); this.rows.set(ref.key, { collection: ref.name, id: ref.id, data: options?.merge && previous ? { ...previous.data, ...data } : data }); }),
    };
    const result = await callback(tx);
    pending.forEach((apply) => apply());
    return result;
  }
}

test('repeated delivery webhook events are idempotent and correlate to provider attempt', async () => {
  const db = new FakeDb();
  db.rows.set('messageAttempts/a1', { collection: 'messageAttempts', id: 'a1', data: { providerMessageId: 'wamid.123' } });
  const payload = { object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'messages', value: { statuses: [{ id: 'wamid.123', status: 'delivered', timestamp: '1792400000' }] } }] }] };
  const first = await processMetaWebhook(db, payload);
  const second = await processMetaWebhook(db, payload);
  assert.equal(first.processed, 1);
  assert.equal(second.duplicates, 1);
  assert.equal(db.rows.get('messageDeliveryEvents/' + [...db.rows.keys()].find((key) => key.startsWith('messageDeliveryEvents/'))!.split('/')[1])?.data.attemptId, 'a1');
});

test('inbound STOP updates only the matching customer consent', async () => {
  const db = new FakeDb();
  db.rows.set('customers/c1', { collection: 'customers', id: 'c1', data: customer({ primaryPhone: '+91 98765 43210', whatsappConsent: true }) });
  const payload = { object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'messages', value: { messages: [{ from: '919876543210', type: 'text', text: { body: 'STOP' }, timestamp: '1792400000' }] } }] }] };
  const result = await processMetaWebhook(db, payload);
  assert.equal(result.processed, 1);
  assert.equal(db.rows.get('customers/c1')?.data.whatsappConsent, false);
  assert.equal(evaluateReminderEligibility(reminder(), customer({ whatsappConsent: false }), [], true).isEligible, false);
  assert.ok([...db.rows.keys()].some((key) => key.startsWith('auditEvents/whatsapp_optout_')));
});

test('ambiguous phone matches are audited without changing either customer', async () => {
  const db = new FakeDb();
  db.rows.set('customers/c1', { collection: 'customers', id: 'c1', data: customer({ primaryPhone: '9876543210', whatsappConsent: true }) });
  db.rows.set('customers/c2', { collection: 'customers', id: 'c2', data: customer({ id: 'c2', primaryPhone: '+91 98765 43210', whatsappConsent: true }) });
  const payload = { object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'messages', value: { messages: [{ from: '919876543210', type: 'text', text: { body: 'UNSUBSCRIBE' }, timestamp: '1792400000' }] } }] }] };
  const result = await processMetaWebhook(db, payload);
  assert.equal(result.ambiguousOptOuts, 1);
  assert.equal(db.rows.get('customers/c1')?.data.whatsappConsent, true);
  assert.equal(db.rows.get('customers/c2')?.data.whatsappConsent, true);
});

test('idempotency key is stable for the same reminder cycle', () => {
  assert.equal(generateIdempotencyKey('c1', 's1', today), generateIdempotencyKey('c1', 's1', today));
});


test('same-origin backend requests are supported on HTTP(S), not native app origins', () => {
  assert.equal(isHttpProtocol('http:'), true);
  assert.equal(isHttpProtocol('https:'), true);
  assert.equal(isHttpProtocol('capacitor:'), false);
  assert.equal(isHttpProtocol('file:'), false);
});

test('production WhatsApp stays disabled for hello_world or missing webhook secrets', async () => {
  await withEnv({
    WHATSAPP_ACCESS_TOKEN: 'local-test-token',
    WHATSAPP_PHONE_NUMBER_ID: '123456789012345',
    WHATSAPP_TEMPLATE_NAME: 'hello_world',
    WHATSAPP_APP_SECRET: 'x'.repeat(32),
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: 'y'.repeat(32),
  }, () => {
    const testOnly = getWhatsAppIntegrationStatus();
    assert.equal(testOnly.status, 'not_configured');
    assert.match(testOnly.details, /hello_world|test template/i);

    process.env.WHATSAPP_TEMPLATE_NAME = 'service_maintenance_reminder';
    delete process.env.WHATSAPP_APP_SECRET;
    const missingAppSecret = getWhatsAppIntegrationStatus();
    assert.equal(missingAppSecret.status, 'not_configured');
    assert.match(missingAppSecret.details, /webhook/i);

    process.env.WHATSAPP_APP_SECRET = 'x'.repeat(32);
    delete process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    assert.equal(getWhatsAppIntegrationStatus().status, 'not_configured');

    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'y'.repeat(32);
    assert.equal(getWhatsAppIntegrationStatus().status, 'configured');
  });
});

test('approved reminder template defaults to the documented English language code', async () => {
  await withEnv({
    WHATSAPP_ACCESS_TOKEN: 'local-test-token',
    WHATSAPP_PHONE_NUMBER_ID: '123456789012345',
    WHATSAPP_TEMPLATE_NAME: 'service_maintenance_reminder',
    WHATSAPP_GRAPH_API_VERSION: 'v25.0',
  }, async () => {
    const originalFetch = globalThis.fetch;
    let capturedPayload: any;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      capturedPayload = JSON.parse(String(init?.body || '{}'));
      return new Response(JSON.stringify({ messages: [{ id: 'wamid.local-test' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    try {
      const result = await sendWhatsAppTemplateMessage({
        recipientPhone: '9876543210',
        customerName: 'Local Test',
        lastServiceDate: '30 Oct 2026',
        businessPhone: '+91 70103 29920',
      });
      assert.equal(result.success, true);
      assert.equal(capturedPayload.template.name, 'service_maintenance_reminder');
      assert.equal(capturedPayload.template.language.code, 'en');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
