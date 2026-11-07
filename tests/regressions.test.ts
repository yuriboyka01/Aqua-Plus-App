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
import {
  getStockStatus,
  validateInventoryItem,
  calculateInventoryMetrics,
  INVENTORY_CATEGORIES,
  isInventoryCategory,
} from '../src/types/index.ts';
import {
  SAMPLE_INVENTORY_ITEMS,
  getInitialSampleInventory,
} from '../src/services/dbService.ts';
import {
  calculateScaledDimensions,
  estimateBase64Size,
  parseDataUrl,
  validateImageFile,
  formatFileSize,
} from '../src/utils/imageCompressor.ts';
import {
  normalizeCategory,
  normalizeConfidence,
  parseAndNormalizeVisionResponse,
} from '../src/server/geminiVisionAdapter.ts';
import {
  scanInventoryImage,
  InventoryScanError,
  isQuotaExceededError,
} from '../src/services/apiService.ts';

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
  assert.equal(results.length, 14);
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

test('getStockStatus evaluates boundary thresholds and defensive non-number fallbacks', () => {
  // Out of stock: quantity <= 0
  assert.equal(getStockStatus({ quantity: 0, lowStockThreshold: 10 }), 'out_of_stock');
  assert.equal(getStockStatus({ quantity: -1, lowStockThreshold: 10 }), 'out_of_stock');
  assert.equal(getStockStatus({ quantity: -50, lowStockThreshold: 0 }), 'out_of_stock');
  assert.equal(getStockStatus({ quantity: 0, lowStockThreshold: 0 }), 'out_of_stock');

  // Low stock: 0 < quantity <= lowStockThreshold
  assert.equal(getStockStatus({ quantity: 1, lowStockThreshold: 10 }), 'low_stock');
  assert.equal(getStockStatus({ quantity: 5, lowStockThreshold: 10 }), 'low_stock');
  assert.equal(getStockStatus({ quantity: 10, lowStockThreshold: 10 }), 'low_stock');
  assert.equal(getStockStatus({ quantity: 1, lowStockThreshold: 1 }), 'low_stock');

  // In stock: quantity > lowStockThreshold
  assert.equal(getStockStatus({ quantity: 11, lowStockThreshold: 10 }), 'in_stock');
  assert.equal(getStockStatus({ quantity: 50, lowStockThreshold: 10 }), 'in_stock');
  assert.equal(getStockStatus({ quantity: 1, lowStockThreshold: 0 }), 'in_stock');
  assert.equal(getStockStatus({ quantity: 100, lowStockThreshold: 5 }), 'in_stock');

  // Defensive fallback for undefined, null, or NaN values
  assert.equal(getStockStatus({ quantity: undefined as any, lowStockThreshold: 5 }), 'out_of_stock');
  assert.equal(getStockStatus({ quantity: null as any, lowStockThreshold: 5 }), 'out_of_stock');
  assert.equal(getStockStatus({ quantity: NaN, lowStockThreshold: 5 }), 'out_of_stock');
  assert.equal(getStockStatus({ quantity: 10, lowStockThreshold: NaN }), 'in_stock');
  assert.equal(getStockStatus(null as any), 'out_of_stock');
});

test('validateInventoryItem enforces domain invariants, string lengths, and numeric bounds', () => {
  // Valid item passes
  const valid = validateInventoryItem({
    name: '75 GPD TFC RO Membrane',
    category: 'ro_membrane',
    quantity: 10,
    lowStockThreshold: 4,
    unitCost: 650,
    sellingPrice: 1400,
    storageLocation: 'Cabinet B-01',
    notes: 'Authentic Filmtec type',
  });
  assert.equal(valid.isValid, true);
  assert.deepEqual(valid.errors, {});

  // Missing or whitespace-only name
  assert.equal(validateInventoryItem({ name: '', category: 'spun_filter', quantity: 5, lowStockThreshold: 2, unitCost: 40, sellingPrice: 100 }).isValid, false);
  assert.equal(validateInventoryItem({ name: '   ', category: 'spun_filter', quantity: 5, lowStockThreshold: 2, unitCost: 40, sellingPrice: 100 }).isValid, false);

  // Name length boundary > 120 chars
  const longName = 'A'.repeat(121);
  const nameRes = validateInventoryItem({ name: longName, category: 'spun_filter', quantity: 5, lowStockThreshold: 2, unitCost: 40, sellingPrice: 100 });
  assert.equal(nameRes.isValid, false);
  assert.match(nameRes.errors.name || '', /cannot exceed 120/i);

  // Category validation and type guard
  assert.equal(isInventoryCategory('spun_filter'), true);
  assert.equal(isInventoryCategory('ro_membrane'), true);
  assert.equal(isInventoryCategory('sediment_filter'), true);
  assert.equal(isInventoryCategory('carbon_block'), true);
  assert.equal(isInventoryCategory('post_carbon'), true);
  assert.equal(isInventoryCategory('booster_pump'), true);
  assert.equal(isInventoryCategory('smps_adapter'), true);
  assert.equal(isInventoryCategory('flow_restrictor'), true);
  assert.equal(isInventoryCategory('fittings_tubing'), true);
  assert.equal(isInventoryCategory('other'), true);
  assert.equal(isInventoryCategory('invalid_category_xyz'), false);
  assert.equal(isInventoryCategory(null), false);
  assert.equal(isInventoryCategory(123), false);

  const invalidCatRes = validateInventoryItem({ name: 'Spun Filter', category: 'invalid_cat' as any, quantity: 5, lowStockThreshold: 2, unitCost: 40, sellingPrice: 100 });
  assert.equal(invalidCatRes.isValid, false);
  assert.match(invalidCatRes.errors.category || '', /valid inventory category/i);

  // Negative numeric bounds
  const negQty = validateInventoryItem({ name: 'Spun Filter', category: 'spun_filter', quantity: -1, lowStockThreshold: 2, unitCost: 40, sellingPrice: 100 });
  assert.equal(negQty.isValid, false);
  assert.match(negQty.errors.quantity || '', /0 or greater/i);

  const negThresh = validateInventoryItem({ name: 'Spun Filter', category: 'spun_filter', quantity: 1, lowStockThreshold: -5, unitCost: 40, sellingPrice: 100 });
  assert.equal(negThresh.isValid, false);
  assert.match(negThresh.errors.lowStockThreshold || '', /0 or greater/i);

  const negCost = validateInventoryItem({ name: 'Spun Filter', category: 'spun_filter', quantity: 1, lowStockThreshold: 2, unitCost: -10, sellingPrice: 100 });
  assert.equal(negCost.isValid, false);
  assert.match(negCost.errors.unitCost || '', /₹0 or greater/i);

  const negPrice = validateInventoryItem({ name: 'Spun Filter', category: 'spun_filter', quantity: 1, lowStockThreshold: 2, unitCost: 10, sellingPrice: -50 });
  assert.equal(negPrice.isValid, false);
  assert.match(negPrice.errors.sellingPrice || '', /₹0 or greater/i);

  // Upper boundary enforcement (100,000 for qty/thresh, 1,000,000 for prices)
  assert.equal(validateInventoryItem({ name: 'Spun Filter', category: 'spun_filter', quantity: 100001, lowStockThreshold: 2, unitCost: 10, sellingPrice: 50 }).isValid, false);
  assert.equal(validateInventoryItem({ name: 'Spun Filter', category: 'spun_filter', quantity: 10, lowStockThreshold: 100001, unitCost: 10, sellingPrice: 50 }).isValid, false);
  assert.equal(validateInventoryItem({ name: 'Spun Filter', category: 'spun_filter', quantity: 10, lowStockThreshold: 2, unitCost: 1000001, sellingPrice: 50 }).isValid, false);
  assert.equal(validateInventoryItem({ name: 'Spun Filter', category: 'spun_filter', quantity: 10, lowStockThreshold: 2, unitCost: 10, sellingPrice: 1000001 }).isValid, false);

  // Optional string length limits
  assert.equal(validateInventoryItem({ name: 'Spun Filter', category: 'spun_filter', quantity: 10, lowStockThreshold: 2, unitCost: 10, sellingPrice: 50, storageLocation: 'B'.repeat(101) }).isValid, false);
  assert.equal(validateInventoryItem({ name: 'Spun Filter', category: 'spun_filter', quantity: 10, lowStockThreshold: 2, unitCost: 10, sellingPrice: 50, notes: 'N'.repeat(501) }).isValid, false);
});

test('stock adjustment arithmetic maintains non-negative balance and detects clamped deltas', () => {
  // Pure logic simulation of adjustInventoryQuantity algorithm
  function simulateStockAdjustment(previousQuantity: number, delta: number) {
    const rawNewQty = previousQuantity + delta;
    const newQty = Math.max(0, rawNewQty);
    const clamped = rawNewQty < 0;
    return { previousQuantity, newQuantity: newQty, clamped };
  }

  // Normal addition
  const addRes = simulateStockAdjustment(10, 5);
  assert.equal(addRes.newQuantity, 15);
  assert.equal(addRes.clamped, false);

  // Normal decrement within available balance
  const decRes = simulateStockAdjustment(10, -4);
  assert.equal(decRes.newQuantity, 6);
  assert.equal(decRes.clamped, false);

  // Exact decrement to 0
  const exactZeroRes = simulateStockAdjustment(8, -8);
  assert.equal(exactZeroRes.newQuantity, 0);
  assert.equal(exactZeroRes.clamped, false);

  // Underflow clamped to 0
  const underflowRes = simulateStockAdjustment(5, -12);
  assert.equal(underflowRes.newQuantity, 0);
  assert.equal(underflowRes.clamped, true);

  // Decrement from 0 already out of stock
  const zeroUnderflowRes = simulateStockAdjustment(0, -3);
  assert.equal(zeroUnderflowRes.newQuantity, 0);
  assert.equal(zeroUnderflowRes.clamped, true);

  // Zero delta
  const zeroDeltaRes = simulateStockAdjustment(15, 0);
  assert.equal(zeroDeltaRes.newQuantity, 15);
  assert.equal(zeroDeltaRes.clamped, false);
});

test('sample inventory seed dataset contains realistic Madurai spare parts with expected KPI aggregates', () => {
  // 1. Exactly 12 items in catalog
  assert.equal(SAMPLE_INVENTORY_ITEMS.length, 12);

  // 2. All 10 categories are represented
  const categoriesPresent = new Set(SAMPLE_INVENTORY_ITEMS.map((item) => item.category));
  for (const cat of INVENTORY_CATEGORIES) {
    assert.equal(categoriesPresent.has(cat), true, `Expected category ${cat} to be present in seed items`);
  }

  // 3. Every item satisfies schema validity and positive constraints
  for (const item of SAMPLE_INVENTORY_ITEMS) {
    assert.equal(isInventoryCategory(item.category), true);
    assert.equal(item.quantity >= 0, true);
    assert.equal(item.lowStockThreshold >= 0, true);
    assert.equal(item.unitCost >= 0, true);
    assert.equal(item.sellingPrice >= item.unitCost, true, `Selling price for ${item.name} should be >= unit cost`);
    assert.equal(typeof item.storageLocation, 'string');
    assert.equal(typeof item.notes, 'string');
    assert.equal(item.isSampleData, true);
    assert.equal(item.name.length >= 3 && item.name.length <= 120, true);
  }

  // 4. Balanced distribution of stock states: 7 in_stock, 3 low_stock, 2 out_of_stock
  const inStock = SAMPLE_INVENTORY_ITEMS.filter((i) => getStockStatus(i) === 'in_stock');
  const lowStock = SAMPLE_INVENTORY_ITEMS.filter((i) => getStockStatus(i) === 'low_stock');
  const outOfStock = SAMPLE_INVENTORY_ITEMS.filter((i) => getStockStatus(i) === 'out_of_stock');

  assert.equal(inStock.length, 7, 'Expected 7 healthy in-stock items');
  assert.equal(lowStock.length, 3, 'Expected 3 low-stock alert items');
  assert.equal(outOfStock.length, 2, 'Expected 2 out-of-stock items');

  // 5. getInitialSampleInventory properly assigns ownerId, createdAt, updatedAt
  const initialized = getInitialSampleInventory('madurai-branch-01');
  assert.equal(initialized.length, 12);
  for (const item of initialized) {
    assert.equal(item.ownerId, 'madurai-branch-01');
    assert.equal(typeof item.createdAt, 'string');
    assert.equal(typeof item.updatedAt, 'string');
    assert.equal(item.isSampleData, true);
  }

  // 6. Aggregate KPI metrics calculation
  const metrics = calculateInventoryMetrics(initialized);
  assert.equal(metrics.totalSkus, 12);
  assert.equal(metrics.totalUnits, 139);
  assert.equal(metrics.totalCostValue, 25115);
  assert.equal(metrics.totalRetailValue, 53880);
  assert.equal(metrics.lowStockCount, 3);
  assert.equal(metrics.outOfStockCount, 2);
});



test('imageCompressor calculates scaled dimensions preserving aspect ratio without upscaling', () => {
  // 1. High resolution landscape image (e.g. 4032x3024) scaled down to max 1600
  const landscape = calculateScaledDimensions(4032, 3024, 1600);
  assert.equal(landscape.width, 1600);
  assert.equal(landscape.height, 1200);
  assert.ok(Math.abs(landscape.scale - 1600 / 4032) < 0.001);

  // 2. High resolution portrait image (e.g. 3024x4032) scaled down to max 1600
  const portrait = calculateScaledDimensions(3024, 4032, 1600);
  assert.equal(portrait.width, 1200);
  assert.equal(portrait.height, 1600);

  // 3. Small image (e.g. 800x600) is NOT upscaled
  const small = calculateScaledDimensions(800, 600, 1600);
  assert.equal(small.width, 800);
  assert.equal(small.height, 600);
  assert.equal(small.scale, 1);

  // 4. Invalid or zero dimensions return clamped zero
  const zero = calculateScaledDimensions(0, -100, 1600);
  assert.equal(zero.width, 0);
  assert.equal(zero.height, 0);
});

test('imageCompressor base64 estimation and file formatting logic', () => {
  // Base64 size estimation with padding variations
  assert.equal(estimateBase64Size(''), 0);
  assert.equal(estimateBase64Size('QUJD'), 3); // "ABC" (4 chars, no padding)
  assert.equal(estimateBase64Size('QUJDRA=='), 4); // 4 bytes (with 2 '=' padding)

  // Data URL parsing
  const parsed = parseDataUrl('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA');
  assert.equal(parsed.mimeType, 'image/png');
  assert.equal(parsed.base64Data, 'iVBORw0KGgoAAAANSUhEUgAA');

  // File validation
  assert.equal(validateImageFile(null).valid, false);
  assert.equal(validateImageFile({ size: 0 }).valid, false);
  assert.equal(validateImageFile({ size: 1024, type: 'application/pdf' }).valid, false);
  assert.equal(validateImageFile({ size: 1024, type: 'image/jpeg', name: 'photo.jpg' }).valid, true);
  assert.equal(validateImageFile({ size: 2048, name: 'bill.png' }).valid, true);

  // File size formatter
  assert.equal(formatFileSize(0), '0 B');
  assert.equal(formatFileSize(512), '512 B');
  assert.equal(formatFileSize(2048), '2.0 KB');
  assert.equal(formatFileSize(1500 * 1024), '1.5 MB');
});

test('parseAndNormalizeVisionResponse normalizes physical parts and maps aliases correctly', () => {
  const rawModelOutput = {
    scanType: 'physical_parts',
    rawSummary: 'Found multiple water purifier components.',
    items: [
      {
        name: 'PP Spun Filter 5 Micron',
        category: 'pre_filter', // Alias for spun_filter
        quantity: 10,
        unitCost: 45,
        sellingPrice: 120,
        confidence: 'high',
        notes: 'White meltblown cartridge',
      },
      {
        name: 'Dow Filmtec Membrane 75 GPD',
        category: 'romembrane', // Alias for ro_membrane
        quantity: 2,
        unitCost: 1100,
        sellingPrice: 1800,
        confidence: 'high',
      },
      {
        name: 'Grand Forest Booster Pump 24V',
        category: 'pump', // Alias for booster_pump
        quantity: 1,
        unitCost: 1250,
        sellingPrice: 1950,
        confidence: 'high',
      },
      {
        name: 'Unknown Electronic Board',
        category: 'unclassified_thing',
        quantity: -5, // Invalid negative quantity
        confidence: 'invalid_confidence',
      },
    ],
  };

  const normalized = parseAndNormalizeVisionResponse(rawModelOutput);
  assert.equal(normalized.scanType, 'physical_parts');
  assert.equal(normalized.items.length, 4);

  // pre_filter alias mapped to spun_filter
  assert.equal(normalized.items[0].category, 'spun_filter');
  assert.equal(normalized.items[0].quantity, 10);
  assert.equal(normalized.items[0].unitCost, 45);

  // romembrane alias mapped to ro_membrane
  assert.equal(normalized.items[1].category, 'ro_membrane');
  assert.equal(normalized.items[1].quantity, 2);

  // pump alias mapped to booster_pump
  assert.equal(normalized.items[2].category, 'booster_pump');

  // fallback category 'other', clamped quantity 1, fallback confidence 'medium'
  assert.equal(normalized.items[3].category, 'other');
  assert.equal(normalized.items[3].quantity, 1);
  assert.equal(normalized.items[3].confidence, 'medium');
});

test('parseAndNormalizeVisionResponse handles supplier invoice metadata and unrecognized images safely', () => {
  // 1. Supplier invoice parsing
  const invoiceOutput = {
    scanType: 'supplier_invoice',
    supplierName: 'Sri Balaji Water Purification Spares Madurai',
    invoiceNumber: 'INV-2026-991',
    invoiceDate: '2026-11-06',
    rawSummary: 'Tax invoice for wholesale filters',
    items: [
      {
        name: 'CTO 10-inch Carbon Block',
        category: 'carbon_block',
        quantity: 25,
        unitCost: 85,
        sellingPrice: 160,
        confidence: 'high',
      },
    ],
  };

  const invoiceResult = parseAndNormalizeVisionResponse(invoiceOutput);
  assert.equal(invoiceResult.scanType, 'supplier_invoice');
  assert.equal(invoiceResult.supplierName, 'Sri Balaji Water Purification Spares Madurai');
  assert.equal(invoiceResult.invoiceNumber, 'INV-2026-991');
  assert.equal(invoiceResult.items.length, 1);
  assert.equal(invoiceResult.items[0].category, 'carbon_block');
  assert.equal(invoiceResult.items[0].quantity, 25);

  // 2. Unrecognized image (must produce empty items list)
  const unrecognizedOutput = {
    scanType: 'unrecognized',
    rawSummary: 'The image appears to be a landscape photo.',
    items: [{ name: 'Phantom Item', category: 'spun_filter', quantity: 99 }],
  };

  const unrecognizedResult = parseAndNormalizeVisionResponse(unrecognizedOutput);
  assert.equal(unrecognizedResult.scanType, 'unrecognized');
  assert.equal(unrecognizedResult.items.length, 0); // Must be strictly empty
  assert.match(unrecognizedResult.rawSummary || '', /landscape/i);
});

test('scanInventoryImage validates input parameters and handles error classifications', async () => {
  // Empty base64 rejects with INVALID_REQUEST
  await assert.rejects(
    async () => {
      await scanInventoryImage('', 'image/jpeg');
    },
    (err: any) => {
      assert.equal(err instanceof InventoryScanError, true);
      assert.equal(err.code, 'INVALID_REQUEST');
      return true;
    }
  );

  // Helper check for quota errors
  const quotaErr = new InventoryScanError('Rate limited', 'QUOTA_EXCEEDED', 429, true);
  assert.equal(isQuotaExceededError(quotaErr), true);
  assert.equal(isQuotaExceededError(new Error('Resource exhausted 429 quota')), true);
  assert.equal(isQuotaExceededError(new Error('Regular network failure')), false);
});
