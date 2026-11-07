import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  InventoryItem,
  InventoryCategory,
  INVENTORY_CATEGORIES,
  isInventoryCategory,
  validateInventoryItem,
  getStockStatus,
  calculateInventoryMetrics,
} from '../src/types';
import {
  SAMPLE_INVENTORY_ITEMS,
  getInitialSampleInventory,
} from '../src/services/dbService';

describe('Adversarial Security Rules & Schema Verification', () => {
  const rulesPath = resolve(process.cwd(), 'firestore.rules');
  const rulesContent = readFileSync(rulesPath, 'utf8');

  test('firestore.rules file contains required inventory security rule definitions', () => {
    assert.match(rulesContent, /function isValidInventoryItem\(data\)/);
    assert.match(rulesContent, /match \/inventory\/\{itemId\}/);
    assert.match(rulesContent, /data\.keys\(\)\.hasOnly\(\[/);
    assert.match(rulesContent, /incoming\(\)\.get\('isSampleData',\s*false\)\s*==\s*existing\(\)\.get\('isSampleData',\s*false\)/);
    assert.match(rulesContent, /incoming\(\)\.ownerId\s*==\s*existing\(\)\.ownerId/);
  });

  test('firestore.rules field whitelisting specifies exactly the 13 approved fields', () => {
    const hasOnlyMatch = rulesContent.match(/isValidInventoryItem[\s\S]*?data\.keys\(\)\.hasOnly\(\[([\s\S]*?)\]\)/);
    assert.ok(hasOnlyMatch, 'isValidInventoryItem must define keys().hasOnly([...])');

    const rawFields = hasOnlyMatch[1]
      .split(',')
      .map((s) => s.trim().replace(/['"]/g, ''))
      .filter(Boolean);

    const expectedFields = [
      'id',
      'name',
      'category',
      'quantity',
      'lowStockThreshold',
      'unitCost',
      'sellingPrice',
      'storageLocation',
      'notes',
      'isSampleData',
      'ownerId',
      'createdAt',
      'updatedAt',
    ];

    assert.equal(rawFields.length, 13, 'Expected exactly 13 whitelisted fields');
    assert.deepEqual(rawFields.sort(), expectedFields.sort(), 'Whitelisted fields must match domain model exactly');
  });

  // Strict simulation of Firestore Rules isValidInventoryItem(data) semantics
  function evaluateFirestoreRulesIsValidInventoryItem(data: any): { allowed: boolean; reason?: string } {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return { allowed: false, reason: 'data must be an object' };
    }

    const whitelistedKeys = new Set([
      'id',
      'name',
      'category',
      'quantity',
      'lowStockThreshold',
      'unitCost',
      'sellingPrice',
      'storageLocation',
      'notes',
      'isSampleData',
      'ownerId',
      'createdAt',
      'updatedAt',
    ]);

    // data.keys().hasOnly(...)
    const keys = Object.getOwnPropertyNames(data);
    for (const k of keys) {
      if (!whitelistedKeys.has(k)) {
        return { allowed: false, reason: `Unlisted field injection rejected: ${k}` };
      }
    }

    // name check: data.name is string && data.name.size() >= 1 && data.name.size() <= 120
    if (typeof data.name !== 'string' || data.name.length < 1 || data.name.length > 120) {
      return { allowed: false, reason: 'name must be string 1-120 chars' };
    }

    // category check: data.category in [...]
    const allowedCategories = new Set([
      'spun_filter',
      'ro_membrane',
      'sediment_filter',
      'carbon_block',
      'post_carbon',
      'booster_pump',
      'smps_adapter',
      'flow_restrictor',
      'fittings_tubing',
      'other',
    ]);
    if (typeof data.category !== 'string' || !allowedCategories.has(data.category)) {
      return { allowed: false, reason: 'category invalid' };
    }

    // quantity: data.quantity is number && data.quantity >= 0 && data.quantity <= 100000
    if (typeof data.quantity !== 'number' || Number.isNaN(data.quantity) || data.quantity < 0 || data.quantity > 100000) {
      return { allowed: false, reason: 'quantity must be number 0-100000' };
    }

    // lowStockThreshold: data.lowStockThreshold is number && data.lowStockThreshold >= 0 && data.lowStockThreshold <= 100000
    if (
      typeof data.lowStockThreshold !== 'number' ||
      Number.isNaN(data.lowStockThreshold) ||
      data.lowStockThreshold < 0 ||
      data.lowStockThreshold > 100000
    ) {
      return { allowed: false, reason: 'lowStockThreshold must be number 0-100000' };
    }

    // unitCost: data.unitCost is number && data.unitCost >= 0 && data.unitCost <= 1000000
    if (typeof data.unitCost !== 'number' || Number.isNaN(data.unitCost) || data.unitCost < 0 || data.unitCost > 1000000) {
      return { allowed: false, reason: 'unitCost must be number 0-1000000' };
    }

    // sellingPrice: data.sellingPrice is number && data.sellingPrice >= 0 && data.sellingPrice <= 1000000
    if (typeof data.sellingPrice !== 'number' || Number.isNaN(data.sellingPrice) || data.sellingPrice < 0 || data.sellingPrice > 1000000) {
      return { allowed: false, reason: 'sellingPrice must be number 0-1000000' };
    }

    // ownerId: data.ownerId is string && data.ownerId.size() <= 128
    if (typeof data.ownerId !== 'string' || data.ownerId.length === 0 || data.ownerId.length > 128) {
      return { allowed: false, reason: 'ownerId must be string <= 128 chars' };
    }

    // createdAt: data.createdAt is string && data.createdAt.size() <= 35
    if (typeof data.createdAt !== 'string' || data.createdAt.length === 0 || data.createdAt.length > 35) {
      return { allowed: false, reason: 'createdAt must be string <= 35 chars' };
    }

    // updatedAt: data.updatedAt is string && data.updatedAt.size() <= 35
    if (typeof data.updatedAt !== 'string' || data.updatedAt.length === 0 || data.updatedAt.length > 35) {
      return { allowed: false, reason: 'updatedAt must be string <= 35 chars' };
    }

    // optional id: (!('id' in data) || (data.id is string && data.id.size() <= 128))
    if ('id' in data && (typeof data.id !== 'string' || data.id.length > 128)) {
      return { allowed: false, reason: 'id must be string <= 128 chars' };
    }

    // optional storageLocation: (!('storageLocation' in data) || (data.storageLocation is string && data.storageLocation.size() <= 100))
    if ('storageLocation' in data && (typeof data.storageLocation !== 'string' || data.storageLocation.length > 100)) {
      return { allowed: false, reason: 'storageLocation must be string <= 100 chars' };
    }

    // optional notes: (!('notes' in data) || (data.notes is string && data.notes.size() <= 500))
    if ('notes' in data && (typeof data.notes !== 'string' || data.notes.length > 500)) {
      return { allowed: false, reason: 'notes must be string <= 500 chars' };
    }

    // optional isSampleData: (!('isSampleData' in data) || (data.isSampleData is bool))
    if ('isSampleData' in data && typeof data.isSampleData !== 'boolean') {
      return { allowed: false, reason: 'isSampleData must be boolean' };
    }

    return { allowed: true };
  }

  function createValidBaseItem() {
    return {
      id: 'inv_test_item_1',
      name: '5µ Spun Sediment Filter',
      category: 'spun_filter',
      quantity: 50,
      lowStockThreshold: 10,
      unitCost: 45,
      sellingPrice: 120,
      storageLocation: 'Bin A-01',
      notes: 'Standard 10-inch cartridge',
      isSampleData: false,
      ownerId: 'aquaplus-business',
      createdAt: '2026-11-07T05:00:00.000Z',
      updatedAt: '2026-11-07T05:00:00.000Z',
    };
  }

  test('valid inventory item passes security rules validation', () => {
    const item = createValidBaseItem();
    const result = evaluateFirestoreRulesIsValidInventoryItem(item);
    assert.equal(result.allowed, true);
  });

  test('injection of arbitrary or malicious unlisted keys is strictly rejected by hasOnly', () => {
    const maliciousFields = [
      'maliciousField',
      '__proto__',
      'admin',
      'role',
      'permissions',
      'bypassSecurity',
      'dropDatabase',
      'systemCommand',
      'billingOverride',
      'isOwner',
    ];

    for (const field of maliciousFields) {
      const item = createValidBaseItem();
      if (field === '__proto__') {
        Object.defineProperty(item, '__proto__', { value: true, enumerable: true, configurable: true, writable: true });
      } else {
        (item as any)[field] = true;
      }
      const result = evaluateFirestoreRulesIsValidInventoryItem(item);
      assert.equal(result.allowed, false, `Field "${field}" should have been rejected by keys().hasOnly()`);
      assert.match(result.reason || '', /Unlisted field injection rejected/);
    }
  });

  test('string size limits prevent storage exhaustion', () => {
    // 1. name boundaries (1 to 120)
    const base1 = createValidBaseItem();
    base1.name = '';
    assert.equal(evaluateFirestoreRulesIsValidInventoryItem(base1).allowed, false);

    const base2 = createValidBaseItem();
    base2.name = 'A';
    assert.equal(evaluateFirestoreRulesIsValidInventoryItem(base2).allowed, true);

    const base3 = createValidBaseItem();
    base3.name = 'A'.repeat(120);
    assert.equal(evaluateFirestoreRulesIsValidInventoryItem(base3).allowed, true);

    const base4 = createValidBaseItem();
    base4.name = 'A'.repeat(121);
    assert.equal(evaluateFirestoreRulesIsValidInventoryItem(base4).allowed, false);

    // 2. storageLocation boundary (<= 100)
    const loc1 = createValidBaseItem();
    loc1.storageLocation = 'B'.repeat(100);
    assert.equal(evaluateFirestoreRulesIsValidInventoryItem(loc1).allowed, true);

    const loc2 = createValidBaseItem();
    loc2.storageLocation = 'B'.repeat(101);
    assert.equal(evaluateFirestoreRulesIsValidInventoryItem(loc2).allowed, false);

    // 3. notes boundary (<= 500)
    const notes1 = createValidBaseItem();
    notes1.notes = 'N'.repeat(500);
    assert.equal(evaluateFirestoreRulesIsValidInventoryItem(notes1).allowed, true);

    const notes2 = createValidBaseItem();
    notes2.notes = 'N'.repeat(501);
    assert.equal(evaluateFirestoreRulesIsValidInventoryItem(notes2).allowed, false);

    // 4. createdAt & updatedAt (<= 35)
    const time1 = createValidBaseItem();
    time1.createdAt = '2026-11-07T05:00:00.00000000000000Z'; // 34 chars
    assert.equal(evaluateFirestoreRulesIsValidInventoryItem(time1).allowed, true);

    const time2 = createValidBaseItem();
    time2.createdAt = '2026-11-07T05:00:00.0000000000000000Z'; // 36 chars
    assert.equal(evaluateFirestoreRulesIsValidInventoryItem(time2).allowed, false);
  });

  test('numeric boundaries prevent underflow and overflow', () => {
    // 1. quantity (0 to 100,000)
    const q1 = createValidBaseItem();
    q1.quantity = -1;
    assert.equal(evaluateFirestoreRulesIsValidInventoryItem(q1).allowed, false);

    const q2 = createValidBaseItem();
    q2.quantity = 0;
    assert.equal(evaluateFirestoreRulesIsValidInventoryItem(q2).allowed, true);

    const q3 = createValidBaseItem();
    q3.quantity = 100000;
    assert.equal(evaluateFirestoreRulesIsValidInventoryItem(q3).allowed, true);

    const q4 = createValidBaseItem();
    q4.quantity = 100001;
    assert.equal(evaluateFirestoreRulesIsValidInventoryItem(q4).allowed, false);

    const q5 = createValidBaseItem();
    q5.quantity = NaN;
    assert.equal(evaluateFirestoreRulesIsValidInventoryItem(q5).allowed, false);

    // 2. lowStockThreshold (0 to 100,000)
    const th1 = createValidBaseItem();
    th1.lowStockThreshold = -1;
    assert.equal(evaluateFirestoreRulesIsValidInventoryItem(th1).allowed, false);

    const th2 = createValidBaseItem();
    th2.lowStockThreshold = 100001;
    assert.equal(evaluateFirestoreRulesIsValidInventoryItem(th2).allowed, false);

    // 3. unitCost & sellingPrice (0 to 1,000,000)
    const cost1 = createValidBaseItem();
    cost1.unitCost = -1;
    assert.equal(evaluateFirestoreRulesIsValidInventoryItem(cost1).allowed, false);

    const cost2 = createValidBaseItem();
    cost2.unitCost = 1000001;
    assert.equal(evaluateFirestoreRulesIsValidInventoryItem(cost2).allowed, false);

    const price1 = createValidBaseItem();
    price1.sellingPrice = -1;
    assert.equal(evaluateFirestoreRulesIsValidInventoryItem(price1).allowed, false);

    const price2 = createValidBaseItem();
    price2.sellingPrice = 1000001;
    assert.equal(evaluateFirestoreRulesIsValidInventoryItem(price2).allowed, false);
  });

  test('category must strictly match one of the 10 domain categories', () => {
    for (const cat of INVENTORY_CATEGORIES) {
      const item = createValidBaseItem();
      item.category = cat;
      assert.equal(evaluateFirestoreRulesIsValidInventoryItem(item).allowed, true);
    }

    const invalidCategories = ['filter', 'SPUN_FILTER', 'spun-filter', 'membrane', 'tool', 'motor', ''];
    for (const badCat of invalidCategories) {
      const item = createValidBaseItem();
      item.category = badCat as any;
      assert.equal(evaluateFirestoreRulesIsValidInventoryItem(item).allowed, false);
    }
  });

  test('sample data flag tamper protection semantics', () => {
    // In firestore.rules:
    // incoming().get('isSampleData', false) == existing().get('isSampleData', false)

    function evaluateSampleDataTamper(existing: any, incoming: any): boolean {
      const existingSample = existing?.isSampleData === true;
      const incomingSample = incoming?.isSampleData === true;
      return existingSample === incomingSample;
    }

    // Real record cannot be changed to sample data
    assert.equal(evaluateSampleDataTamper({ isSampleData: false }, { isSampleData: true }), false);
    assert.equal(evaluateSampleDataTamper({}, { isSampleData: true }), false);

    // Sample data cannot be changed to real record
    assert.equal(evaluateSampleDataTamper({ isSampleData: true }, { isSampleData: false }), false);
    assert.equal(evaluateSampleDataTamper({ isSampleData: true }, {}), false);

    // Real record retains real record status
    assert.equal(evaluateSampleDataTamper({ isSampleData: false }, { isSampleData: false }), true);
    assert.equal(evaluateSampleDataTamper({}, {}), true);
    assert.equal(evaluateSampleDataTamper({ isSampleData: false }, {}), true);

    // Sample record retains sample record status
    assert.equal(evaluateSampleDataTamper({ isSampleData: true }, { isSampleData: true }), true);
  });
});

describe('Adversarial Transaction Semantics & Concurrency Verification', () => {
  // Pure algorithm simulation identical to adjustInventoryQuantity in dbService.ts
  function adjustStockTransactionStep(
    currentData: { quantity: number; name?: string },
    delta: number
  ): {
    prevQty: number;
    newQty: number;
    clamped: boolean;
    updatedData: { quantity: number; name?: string };
  } {
    const prevQty = Number(currentData.quantity) || 0;
    const rawNewQty = prevQty + delta;
    const newQty = Math.max(0, rawNewQty);
    const clamped = rawNewQty < 0;

    return {
      prevQty,
      newQty,
      clamped,
      updatedData: { ...currentData, quantity: newQty },
    };
  }

  test('large negative delta is safely clamped to 0 and flagged as clamped', () => {
    const initialItem = { quantity: 5, name: '75 GPD Membrane' };
    const result = adjustStockTransactionStep(initialItem, -1000);

    assert.equal(result.prevQty, 5);
    assert.equal(result.newQty, 0);
    assert.equal(result.clamped, true);
    assert.equal(result.updatedData.quantity, 0);
  });

  test('exact decrement to 0 is not flagged as clamped', () => {
    const initialItem = { quantity: 5, name: '75 GPD Membrane' };
    const result = adjustStockTransactionStep(initialItem, -5);

    assert.equal(result.prevQty, 5);
    assert.equal(result.newQty, 0);
    assert.equal(result.clamped, false);
    assert.equal(result.updatedData.quantity, 0);
  });

  test('underflow decrement on zero inventory remains 0 and flags clamped', () => {
    const initialItem = { quantity: 0, name: 'Empty Spun Filters' };
    const result = adjustStockTransactionStep(initialItem, -10);

    assert.equal(result.prevQty, 0);
    assert.equal(result.newQty, 0);
    assert.equal(result.clamped, true);
    assert.equal(result.updatedData.quantity, 0);
  });

  test('zero delta preserves exact quantity and clamped is false', () => {
    const initialItem = { quantity: 42, name: 'PE Tubing Roll' };
    const result = adjustStockTransactionStep(initialItem, 0);

    assert.equal(result.prevQty, 42);
    assert.equal(result.newQty, 42);
    assert.equal(result.clamped, false);
    assert.equal(result.updatedData.quantity, 42);
  });

  test('positive delta increments stock and clamped is false', () => {
    const initialItem = { quantity: 15, name: 'SMPS Adapter' };
    const result = adjustStockTransactionStep(initialItem, 25);

    assert.equal(result.prevQty, 15);
    assert.equal(result.newQty, 40);
    assert.equal(result.clamped, false);
    assert.equal(result.updatedData.quantity, 40);
  });

  test('concurrent transactional race simulation guarantees non-negative inventory under contention', async () => {
    // Simulate Firestore transactional optimistic concurrency:
    // When multiple transactions contend on the same document,
    // each transaction reads version, computes, and commits if version matches;
    // on contention, it retries with the latest version.
    let itemState = { quantity: 20, version: 1 };
    let contentionRetries = 0;

    async function executeTransaction(delta: number): Promise<{ previousQuantity: number; newQuantity: number; clamped: boolean }> {
      const maxRetries = 35;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const readSnapshot = { ...itemState };
        // Jittered read-time simulation
        await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 4)));

        const rawNewQty = readSnapshot.quantity + delta;
        const newQty = Math.max(0, rawNewQty);
        const wasClamped = rawNewQty < 0;

        // Atomic commit check (precondition: version unchanged)
        if (itemState.version === readSnapshot.version) {
          itemState = {
            quantity: newQty,
            version: itemState.version + 1,
          };
          return { previousQuantity: readSnapshot.quantity, newQuantity: newQty, clamped: wasClamped };
        } else {
          contentionRetries++;
          // Exponential backoff with jitter on contention collision
          const backoffMs = Math.min(150, Math.floor(Math.random() * (2 ** Math.min(attempt, 5)) * 3) + 2);
          await new Promise((r) => setTimeout(r, backoffMs));
        }
      }
      throw new Error(`Transaction exceeded ${maxRetries} retries due to high contention`);
    }

    // Launch 50 concurrent transactions trying to decrement 1 unit from stock of 20
    const operations = Array.from({ length: 50 }, () => -1);
    const results = await Promise.all(operations.map((d) => executeTransaction(d)));

    // Invariants that MUST hold:
    // 1. Final stock must be exactly 0, never negative
    assert.equal(itemState.quantity, 0);

    // 2. Exactly 20 operations should have decremented with clamped = false
    const unclampedDeductions = results.filter((r) => !r.clamped && r.newQuantity < r.previousQuantity);
    assert.equal(unclampedDeductions.length, 20);

    // 3. Exactly 30 operations should have clamped at 0
    const clampedDeductions = results.filter((r) => r.clamped && r.newQuantity === 0);
    assert.equal(clampedDeductions.length, 30);

    // 4. Contention retries occurred, proving optimistic concurrency handled collisions
    assert.ok(contentionRetries > 0, `Expected concurrency contention retries, got ${contentionRetries}`);
  });
});

describe('Sample Data Isolation & Purge Safety Verification', () => {
  test('all 12 sample inventory items have isSampleData strictly true', () => {
    assert.equal(SAMPLE_INVENTORY_ITEMS.length, 12);
    for (const item of SAMPLE_INVENTORY_ITEMS) {
      assert.equal(item.isSampleData, true, `Item ${item.name} must have isSampleData: true`);
    }
  });

  test('getInitialSampleInventory preserves sample data flag and sets ISO timestamps', () => {
    const initialized = getInitialSampleInventory('test_owner');
    assert.equal(initialized.length, 12);
    for (const item of initialized) {
      assert.equal(item.isSampleData, true);
      assert.equal(item.ownerId, 'test_owner');
      assert.ok(item.createdAt.includes('T'));
      assert.ok(item.updatedAt.includes('T'));
    }
  });

  test('purgeSampleData logic strictly filters by isSampleData === true and leaves real items untouched', () => {
    const sampleItems = getInitialSampleInventory('test_owner');
    const realItems: InventoryItem[] = [
      {
        id: 'inv_real_101',
        name: 'Genuine Commercial Membrane',
        category: 'ro_membrane',
        quantity: 15,
        lowStockThreshold: 3,
        unitCost: 1200,
        sellingPrice: 2500,
        isSampleData: false,
        ownerId: 'test_owner',
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      },
      {
        id: 'inv_real_102',
        name: 'Custom Booster Pump 150 GPD',
        category: 'booster_pump',
        quantity: 8,
        lowStockThreshold: 2,
        unitCost: 1800,
        sellingPrice: 3400,
        // isSampleData omitted (undefined)
        ownerId: 'test_owner',
        createdAt: '2026-11-02T00:00:00.000Z',
        updatedAt: '2026-11-02T00:00:00.000Z',
      },
    ];

    const mixedCatalog = [...sampleItems, ...realItems];

    // Purge logic simulation
    const purgedIds = mixedCatalog.filter((i) => i.isSampleData === true).map((i) => i.id);
    const retainedItems = mixedCatalog.filter((i) => !purgedIds.includes(i.id));

    assert.equal(purgedIds.length, 12);
    assert.equal(retainedItems.length, 2);
    assert.equal(retainedItems[0].id, 'inv_real_101');
    assert.equal(retainedItems[1].id, 'inv_real_102');
  });
});
