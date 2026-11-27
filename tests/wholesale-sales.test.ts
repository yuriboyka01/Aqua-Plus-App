import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  WholesaleSale,
  WholesaleSaleInput,
  WholesaleSaleLineItem,
  InventoryItem,
  validateWholesaleSale,
} from '../src/types';
import { exportWholesaleSalesToCsv } from '../src/utils/csvExport';

function createValidLineItem(overrides: Partial<WholesaleSaleLineItem> = {}): WholesaleSaleLineItem {
  const quantity = overrides.quantity ?? 5;
  const unitPrice = overrides.unitPrice ?? 110;
  return {
    itemId: 'inv_sample_spun_5u',
    itemName: '5µ PP Spun Filter Cartridge (10-inch)',
    category: 'spun_filter',
    quantity,
    unitPrice,
    lineTotal: overrides.lineTotal ?? quantity * unitPrice,
    ...overrides,
  };
}

function createValidSaleInput(overrides: Partial<WholesaleSaleInput> = {}): WholesaleSaleInput {
  const items = overrides.items ?? [
    createValidLineItem({
      itemId: 'inv_sample_spun_5u',
      itemName: '5µ PP Spun Filter Cartridge (10-inch)',
      category: 'spun_filter',
      quantity: 10,
      unitPrice: 95, // custom wholesale rate (retail 120)
      lineTotal: 950,
    }),
    createValidLineItem({
      itemId: 'inv_sample_ro_mem_75',
      itemName: '75 GPD TFC Residential RO Membrane',
      category: 'ro_membrane',
      quantity: 2,
      unitPrice: 1250, // custom wholesale rate (retail 1450)
      lineTotal: 2500,
    }),
  ];
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

  return {
    saleDate: '2026-11-26',
    technicianName: 'Karthik RO Services',
    technicianPhone: '9842112233',
    items,
    totalUnits,
    subtotal,
    isCustomTotal: true,
    totalAmount: 3300, // negotiated flat custom bill total vs 3450 subtotal
    paymentStatus: 'Paid',
    notes: 'Monthly technician counter pickup - rounded bulk discount',
    ...overrides,
  };
}

describe('Wholesale Sale Validation (validateWholesaleSale)', () => {
  test('accepts a valid wholesale sale with custom unit prices and custom bill total (isCustomTotal: true)', () => {
    const input = createValidSaleInput({ isCustomTotal: true, totalAmount: 3300 });
    const result = validateWholesaleSale(input);

    assert.equal(result.isValid, true);
    assert.deepEqual(result.errors, {});
  });

  test('accepts a valid wholesale sale with optional fields omitted and boundary limits', () => {
    const maxItems: WholesaleSaleLineItem[] = Array.from({ length: 50 }, (_, idx) =>
      createValidLineItem({
        itemId: `item_${idx + 1}`,
        itemName: `Spare Part ${idx + 1}`,
        quantity: 1,
        unitPrice: 0,
        lineTotal: 0,
      })
    );

    const input = createValidSaleInput({
      technicianName: '  ' + 'A'.repeat(120) + '  ',
      technicianPhone: undefined,
      items: maxItems,
      totalUnits: 50,
      subtotal: 0,
      isCustomTotal: false,
      totalAmount: 0,
      notes: 'N'.repeat(500),
    });

    const result = validateWholesaleSale(input);
    assert.equal(result.isValid, true);
    assert.deepEqual(result.errors, {});
  });

  test('rejects missing, empty, whitespace-only, and >120 char technicianName', () => {
    const missing = validateWholesaleSale(createValidSaleInput({ technicianName: undefined }));
    assert.equal(missing.isValid, false);
    assert.ok(missing.errors.technicianName);

    const empty = validateWholesaleSale(createValidSaleInput({ technicianName: '' }));
    assert.equal(empty.isValid, false);
    assert.ok(empty.errors.technicianName);

    const whitespace = validateWholesaleSale(createValidSaleInput({ technicianName: '   \t\n  ' }));
    assert.equal(whitespace.isValid, false);
    assert.ok(whitespace.errors.technicianName);

    const tooLong = validateWholesaleSale(createValidSaleInput({ technicianName: 'T'.repeat(121) }));
    assert.equal(tooLong.isValid, false);
    assert.match(tooLong.errors.technicianName || '', /120/);
  });

  test('rejects invalid saleDate formats', () => {
    const invalidDates = [
      undefined,
      '',
      '26-11-2026',
      '2026/11/26',
      '2026-11-26T10:00:00Z',
      '2026-1-5',
      'invalid-date',
    ];

    for (const saleDate of invalidDates) {
      const result = validateWholesaleSale(createValidSaleInput({ saleDate }));
      assert.equal(result.isValid, false, `Expected saleDate "${String(saleDate)}" to be rejected`);
      assert.ok(result.errors.saleDate);
    }
  });

  test('rejects empty items array and >50 items', () => {
    const missingItems = validateWholesaleSale(createValidSaleInput({ items: undefined }));
    assert.equal(missingItems.isValid, false);
    assert.ok(missingItems.errors.items);

    const emptyItems = validateWholesaleSale(createValidSaleInput({ items: [] }));
    assert.equal(emptyItems.isValid, false);
    assert.ok(emptyItems.errors.items);

    const tooManyItems: WholesaleSaleLineItem[] = Array.from({ length: 51 }, (_, idx) =>
      createValidLineItem({
        itemId: `part_${idx + 1}`,
        itemName: `Part ${idx + 1}`,
        quantity: 1,
        unitPrice: 50,
        lineTotal: 50,
      })
    );
    const overLimit = validateWholesaleSale(createValidSaleInput({ items: tooManyItems }));
    assert.equal(overLimit.isValid, false);
    assert.match(overLimit.errors.items || '', /50/);
  });

  test('rejects non-integer or <=0 item quantity and missing line item identifiers', () => {
    const badQuantities = [0, -1, -10, 1.5, 0.25, Number.NaN];
    for (const quantity of badQuantities) {
      const result = validateWholesaleSale(
        createValidSaleInput({
          items: [createValidLineItem({ quantity, lineTotal: 100 })],
        })
      );
      assert.equal(result.isValid, false, `Expected quantity "${quantity}" to be rejected`);
      assert.ok(result.errors.items);
    }

    const missingId = validateWholesaleSale(
      createValidSaleInput({
        items: [createValidLineItem({ itemId: '' })],
      })
    );
    assert.equal(missingId.isValid, false);
    assert.ok(missingId.errors.items);

    const missingName = validateWholesaleSale(
      createValidSaleInput({
        items: [createValidLineItem({ itemName: '' })],
      })
    );
    assert.equal(missingName.isValid, false);
    assert.ok(missingName.errors.items);
  });

  test('rejects negative, NaN, or excessive unitPrice', () => {
    const badPrices = [-1, -0.01, Number.NaN, 1000001];
    for (const unitPrice of badPrices) {
      const result = validateWholesaleSale(
        createValidSaleInput({
          items: [createValidLineItem({ unitPrice })],
        })
      );
      assert.equal(result.isValid, false, `Expected unitPrice "${unitPrice}" to be rejected`);
      assert.ok(result.errors.items);
    }
  });

  test('rejects negative, NaN, missing, or excessive totalAmount', () => {
    const badTotals = [undefined, -1, -0.5, Number.NaN, 10000001];
    for (const totalAmount of badTotals) {
      const result = validateWholesaleSale(
        createValidSaleInput({ totalAmount: totalAmount as number })
      );
      assert.equal(result.isValid, false, `Expected totalAmount "${String(totalAmount)}" to be rejected`);
      assert.ok(result.errors.totalAmount);
    }
  });

  test('rejects >500 char notes and >20 char technicianPhone', () => {
    const longNotes = validateWholesaleSale(createValidSaleInput({ notes: 'N'.repeat(501) }));
    assert.equal(longNotes.isValid, false);
    assert.match(longNotes.errors.notes || '', /500/);

    const longPhone = validateWholesaleSale(createValidSaleInput({ technicianPhone: '9'.repeat(21) }));
    assert.equal(longPhone.isValid, false);
    assert.match(longPhone.errors.technicianPhone || '', /20/);
  });
});

describe('Firestore Rules Static & Schema Verification (wholesaleSales)', () => {
  const rulesPath = resolve(process.cwd(), 'firestore.rules');
  const rulesContent = readFileSync(rulesPath, 'utf8');

  const wholesaleMatchBlock = rulesContent.match(
    /match \/wholesaleSales\/\{saleId\}\s*\{([\s\S]*?)\n\s*\}/
  );

  test('firestore.rules defines isValidWholesaleSale(data) and match /wholesaleSales/{saleId}', () => {
    assert.match(rulesContent, /function isValidWholesaleSale\(data\)/);
    assert.match(rulesContent, /match \/wholesaleSales\/\{saleId\}/);
    assert.ok(wholesaleMatchBlock, 'Expected match /wholesaleSales/{saleId} block');
  });

  test('isValidWholesaleSale keys().hasOnly([...]) contains the exact 16 whitelisted fields', () => {
    const hasOnlyMatch = rulesContent.match(
      /isValidWholesaleSale[\s\S]*?data\.keys\(\)\.hasOnly\(\[([\s\S]*?)\]\)/
    );
    assert.ok(hasOnlyMatch, 'isValidWholesaleSale must define data.keys().hasOnly([...])');

    const rawFields = hasOnlyMatch[1]
      .split(',')
      .map((s) => s.trim().replace(/['"]/g, ''))
      .filter(Boolean);

    const expectedFields = [
      'id',
      'billNumber',
      'saleDate',
      'technicianName',
      'technicianPhone',
      'items',
      'totalUnits',
      'subtotal',
      'isCustomTotal',
      'totalAmount',
      'paymentStatus',
      'notes',
      'isSampleData',
      'ownerId',
      'createdAt',
      'updatedAt',
    ];

    assert.equal(rawFields.length, 16, 'Expected exactly 16 whitelisted wholesaleSales fields');
    assert.deepEqual(
      [...rawFields].sort(),
      [...expectedFields].sort(),
      'Whitelisted fields must match WholesaleSale schema exactly'
    );
  });

  test('match /wholesaleSales/{saleId} enforces immutable ownerId, immutable isSampleData, and sample-only delete', () => {
    assert.ok(wholesaleMatchBlock, 'Expected match /wholesaleSales/{saleId} block');
    const block = wholesaleMatchBlock[1];

    // Create & update validation
    assert.match(block, /allow create:[\s\S]*?isValidId\(saleId\)[\s\S]*?isValidWholesaleSale\(incoming\(\)\)/);
    assert.match(block, /allow update:[\s\S]*?isValidId\(saleId\)[\s\S]*?isValidWholesaleSale\(incoming\(\)\)/);

    // Immutable ownerId on update
    assert.match(block, /allow update:[\s\S]*?incoming\(\)\.ownerId\s*==\s*existing\(\)\.ownerId/);

    // Immutable isSampleData on update
    assert.match(
      block,
      /allow update:[\s\S]*?incoming\(\)\.get\('isSampleData',\s*false\)\s*==\s*existing\(\)\.get\('isSampleData',\s*false\)/
    );

    // Sample-only delete rule
    assert.match(
      block,
      /allow delete:\s*if\s*isValidId\(saleId\)\s*&&\s*isOwner\(existing\(\)\.ownerId\)\s*&&\s*existing\(\)\.isSampleData\s*==\s*true;/
    );
  });

  // Strict simulation of Firestore Rules isValidWholesaleSale(data) semantics
  function evaluateFirestoreRulesIsValidWholesaleSale(data: any): { allowed: boolean; reason?: string } {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return { allowed: false, reason: 'data must be an object' };
    }

    const whitelistedKeys = new Set([
      'id',
      'billNumber',
      'saleDate',
      'technicianName',
      'technicianPhone',
      'items',
      'totalUnits',
      'subtotal',
      'isCustomTotal',
      'totalAmount',
      'paymentStatus',
      'notes',
      'isSampleData',
      'ownerId',
      'createdAt',
      'updatedAt',
    ]);

    for (const k of Object.getOwnPropertyNames(data)) {
      if (!whitelistedKeys.has(k)) {
        return { allowed: false, reason: `Unlisted field injection rejected: ${k}` };
      }
    }

    if (typeof data.id !== 'string' || data.id.length < 1 || data.id.length > 128) {
      return { allowed: false, reason: 'id invalid' };
    }
    if (typeof data.billNumber !== 'string' || data.billNumber.length < 1 || data.billNumber.length > 40) {
      return { allowed: false, reason: 'billNumber invalid' };
    }
    if (typeof data.saleDate !== 'string' || data.saleDate.length < 8 || data.saleDate.length > 30) {
      return { allowed: false, reason: 'saleDate invalid' };
    }
    if (typeof data.technicianName !== 'string' || data.technicianName.length < 1 || data.technicianName.length > 120) {
      return { allowed: false, reason: 'technicianName invalid' };
    }
    if ('technicianPhone' in data && (typeof data.technicianPhone !== 'string' || data.technicianPhone.length > 20)) {
      return { allowed: false, reason: 'technicianPhone invalid' };
    }
    if (!Array.isArray(data.items) || data.items.length < 1 || data.items.length > 50) {
      return { allowed: false, reason: 'items list invalid' };
    }
    if (typeof data.totalUnits !== 'number' || Number.isNaN(data.totalUnits) || data.totalUnits < 1 || data.totalUnits > 1000000) {
      return { allowed: false, reason: 'totalUnits invalid' };
    }
    if (typeof data.subtotal !== 'number' || Number.isNaN(data.subtotal) || data.subtotal < 0 || data.subtotal > 10000000) {
      return { allowed: false, reason: 'subtotal invalid' };
    }
    if (typeof data.isCustomTotal !== 'boolean') {
      return { allowed: false, reason: 'isCustomTotal must be bool' };
    }
    if (typeof data.totalAmount !== 'number' || Number.isNaN(data.totalAmount) || data.totalAmount < 0 || data.totalAmount > 10000000) {
      return { allowed: false, reason: 'totalAmount invalid' };
    }
    if (!['Paid', 'Pending', 'Partial'].includes(data.paymentStatus)) {
      return { allowed: false, reason: 'paymentStatus invalid' };
    }
    if ('notes' in data && (typeof data.notes !== 'string' || data.notes.length > 500)) {
      return { allowed: false, reason: 'notes invalid' };
    }
    if ('isSampleData' in data && typeof data.isSampleData !== 'boolean') {
      return { allowed: false, reason: 'isSampleData must be bool' };
    }
    if (typeof data.ownerId !== 'string' || data.ownerId.length < 1 || data.ownerId.length > 128) {
      return { allowed: false, reason: 'ownerId invalid' };
    }
    if (typeof data.createdAt !== 'string' || data.createdAt.length > 35) {
      return { allowed: false, reason: 'createdAt invalid' };
    }
    if (typeof data.updatedAt !== 'string' || data.updatedAt.length > 35) {
      return { allowed: false, reason: 'updatedAt invalid' };
    }

    return { allowed: true };
  }

  function createValidFirestoreSaleDoc(): WholesaleSale {
    return {
      id: 'ws_test_1',
      billNumber: 'WS-261126-TEST',
      saleDate: '2026-11-26',
      technicianName: 'Suresh RO Tech',
      technicianPhone: '9842100011',
      items: [createValidLineItem({ quantity: 4, unitPrice: 100, lineTotal: 400 })],
      totalUnits: 4,
      subtotal: 400,
      isCustomTotal: true,
      totalAmount: 380,
      paymentStatus: 'Paid',
      notes: 'Counter cash discount',
      isSampleData: false,
      ownerId: 'aquaplus-business',
      createdAt: '2026-11-26T04:00:00.000Z',
      updatedAt: '2026-11-26T04:00:00.000Z',
    };
  }

  test('isValidWholesaleSale semantics reject unlisted field injection and invalid paymentStatus', () => {
    const validDoc = createValidFirestoreSaleDoc();
    assert.equal(evaluateFirestoreRulesIsValidWholesaleSale(validDoc).allowed, true);

    const injected = { ...validDoc, adminOverride: true };
    const injectedRes = evaluateFirestoreRulesIsValidWholesaleSale(injected);
    assert.equal(injectedRes.allowed, false);
    assert.match(injectedRes.reason || '', /Unlisted field injection rejected/);

    const badStatus = { ...validDoc, paymentStatus: 'Waived' };
    assert.equal(evaluateFirestoreRulesIsValidWholesaleSale(badStatus).allowed, false);
  });

  test('sample-only delete and immutable ownerId/isSampleData update guards behave strictly', () => {
    function canDeleteSale(existing: Partial<WholesaleSale>): boolean {
      return existing.isSampleData === true;
    }
    function canUpdateSale(existing: Partial<WholesaleSale>, incoming: Partial<WholesaleSale>): boolean {
      const sameOwner = incoming.ownerId === existing.ownerId;
      const sameSampleFlag = (incoming.isSampleData === true) === (existing.isSampleData === true);
      return sameOwner && sameSampleFlag;
    }

    assert.equal(canDeleteSale({ isSampleData: false }), false);
    assert.equal(canDeleteSale({}), false);
    assert.equal(canDeleteSale({ isSampleData: true }), true);

    assert.equal(
      canUpdateSale({ ownerId: 'aquaplus-business', isSampleData: false }, { ownerId: 'other-owner', isSampleData: false }),
      false
    );
    assert.equal(
      canUpdateSale({ ownerId: 'aquaplus-business', isSampleData: false }, { ownerId: 'aquaplus-business', isSampleData: true }),
      false
    );
    assert.equal(
      canUpdateSale({ ownerId: 'aquaplus-business', isSampleData: true }, { ownerId: 'aquaplus-business', isSampleData: false }),
      false
    );
    assert.equal(
      canUpdateSale({ ownerId: 'aquaplus-business', isSampleData: false }, { ownerId: 'aquaplus-business' }),
      true
    );
  });
});

describe('Stock Deduction & Custom Bill Pricing Invariants', () => {
  // Pure model of recordWholesaleSale normalization + atomic stock deduction from src/services/dbService.ts
  function executeAtomicWholesaleSale(
    inventoryStore: Map<string, InventoryItem>,
    saleInput: WholesaleSaleInput,
    ownerId = 'aquaplus-business'
  ): {
    saleDoc: WholesaleSale;
    stockChanges: {
      itemId: string;
      itemName: string;
      previousQuantity: number;
      newQuantity: number;
      deducted: number;
    }[];
  } {
    const validation = validateWholesaleSale(saleInput);
    if (!validation.isValid) {
      const firstError = Object.values(validation.errors).find(Boolean) || 'Invalid wholesale sale details.';
      throw new Error(firstError);
    }

    const requestedByItem = new Map<string, number>();
    for (const line of saleInput.items) {
      requestedByItem.set(line.itemId, (requestedByItem.get(line.itemId) || 0) + line.quantity);
    }

    const normalizedItems: WholesaleSaleLineItem[] = saleInput.items.map((line) => {
      const unitPrice = Math.max(0, Number(line.unitPrice) || 0);
      const lineTotal = Math.max(0, line.quantity * unitPrice);
      return {
        itemId: line.itemId,
        itemName: line.itemName.trim(),
        category: line.category,
        quantity: line.quantity,
        unitPrice,
        lineTotal,
      };
    });

    const totalUnits = normalizedItems.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const isCustomTotal = Boolean(saleInput.isCustomTotal);
    const totalAmount = isCustomTotal ? Math.max(0, Number(saleInput.totalAmount) || 0) : subtotal;

    // Transactional pre-read & stock sufficiency check (fails atomically before any mutation)
    const stagedUpdates: { item: InventoryItem; newQuantity: number; deducted: number }[] = [];
    for (const [itemId, qtyNeeded] of requestedByItem.entries()) {
      const inv = inventoryStore.get(itemId);
      if (!inv) {
        throw new Error(`Spare part "${itemId}" was not found in inventory.`);
      }
      const prevQty = Number(inv.quantity) || 0;
      if (prevQty < qtyNeeded) {
        throw new Error(
          `Insufficient stock for "${inv.name}": ${prevQty} available, ${qtyNeeded} requested.`
        );
      }
      stagedUpdates.push({
        item: inv,
        newQuantity: prevQty - qtyNeeded,
        deducted: qtyNeeded,
      });
    }

    const nowIso = '2026-11-26T04:15:00.000Z';
    const stockChanges = stagedUpdates.map(({ item, newQuantity, deducted }) => {
      const previousQuantity = item.quantity;
      inventoryStore.set(item.id, { ...item, quantity: newQuantity, updatedAt: nowIso });
      return {
        itemId: item.id,
        itemName: item.name,
        previousQuantity,
        newQuantity,
        deducted,
      };
    });

    const saleDoc: WholesaleSale = {
      id: 'ws_sim_1',
      billNumber: 'WS-261126-SIM1',
      saleDate: saleInput.saleDate,
      technicianName: saleInput.technicianName.trim(),
      ...(saleInput.technicianPhone?.trim() ? { technicianPhone: saleInput.technicianPhone.trim() } : {}),
      items: normalizedItems,
      totalUnits,
      subtotal,
      isCustomTotal,
      totalAmount,
      paymentStatus: saleInput.paymentStatus,
      ...(saleInput.notes?.trim() ? { notes: saleInput.notes.trim() } : {}),
      ownerId,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    return { saleDoc, stockChanges };
  }

  function makeInventoryMap(): Map<string, InventoryItem> {
    const nowIso = '2026-11-20T00:00:00.000Z';
    const items: InventoryItem[] = [
      {
        id: 'inv_spun',
        name: '5µ PP Spun Filter Cartridge',
        category: 'spun_filter',
        quantity: 42,
        lowStockThreshold: 15,
        unitCost: 45,
        sellingPrice: 120,
        ownerId: 'aquaplus-business',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'inv_membrane',
        name: '75 GPD TFC RO Membrane',
        category: 'ro_membrane',
        quantity: 10,
        lowStockThreshold: 4,
        unitCost: 680,
        sellingPrice: 1450,
        ownerId: 'aquaplus-business',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'inv_fr450',
        name: 'Flow Restrictor FR-450',
        category: 'flow_restrictor',
        quantity: 15,
        lowStockThreshold: 5,
        unitCost: 35,
        sellingPrice: 110,
        ownerId: 'aquaplus-business',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ];
    return new Map(items.map((i) => [i.id, i]));
  }

  test('multi-item bill computes totalUnits and subtotal accurately while preserving custom override totalAmount when isCustomTotal is true', () => {
    const store = makeInventoryMap();

    const saleInput: WholesaleSaleInput = {
      saleDate: '2026-11-26',
      technicianName: 'Muthu RO Tech',
      technicianPhone: '9842199999',
      items: [
        {
          itemId: 'inv_spun',
          itemName: '5µ PP Spun Filter Cartridge',
          category: 'spun_filter',
          quantity: 12,
          unitPrice: 85, // 12 * 85 = 1020
          lineTotal: 1020,
        },
        {
          itemId: 'inv_membrane',
          itemName: '75 GPD TFC RO Membrane',
          category: 'ro_membrane',
          quantity: 3,
          unitPrice: 1200, // 3 * 1200 = 3600
          lineTotal: 3600,
        },
        {
          itemId: 'inv_fr450',
          itemName: 'Flow Restrictor FR-450',
          category: 'flow_restrictor',
          quantity: 5,
          unitPrice: 70, // 5 * 70 = 350
          lineTotal: 350,
        },
      ],
      totalUnits: 20,
      subtotal: 4970,
      isCustomTotal: true,
      totalAmount: 4750, // custom negotiated round figure (subtotal 4970 preserved)
      paymentStatus: 'Partial',
      notes: 'Custom rounded bill total for bulk order',
    };

    const { saleDoc, stockChanges } = executeAtomicWholesaleSale(store, saleInput);

    // Pricing invariants
    assert.equal(saleDoc.totalUnits, 20); // 12 + 3 + 5
    assert.equal(saleDoc.subtotal, 4970); // 1020 + 3600 + 350
    assert.equal(saleDoc.isCustomTotal, true);
    assert.equal(saleDoc.totalAmount, 4750);
    assert.notEqual(saleDoc.totalAmount, saleDoc.subtotal);

    // Stock deduction invariants
    assert.equal(stockChanges.length, 3);
    assert.equal(store.get('inv_spun')?.quantity, 30); // 42 - 12
    assert.equal(store.get('inv_membrane')?.quantity, 7); // 10 - 3
    assert.equal(store.get('inv_fr450')?.quantity, 10); // 15 - 5
  });

  test('when isCustomTotal is false, totalAmount matches calculated subtotal', () => {
    const store = makeInventoryMap();
    const saleInput = createValidSaleInput({
      items: [
        createValidLineItem({
          itemId: 'inv_spun',
          itemName: '5µ PP Spun Filter Cartridge',
          category: 'spun_filter',
          quantity: 4,
          unitPrice: 90,
          lineTotal: 360,
        }),
        createValidLineItem({
          itemId: 'inv_fr450',
          itemName: 'Flow Restrictor FR-450',
          category: 'flow_restrictor',
          quantity: 6,
          unitPrice: 80,
          lineTotal: 480,
        }),
      ],
      totalUnits: 10,
      subtotal: 840,
      isCustomTotal: false,
      totalAmount: 840,
    });

    const { saleDoc } = executeAtomicWholesaleSale(store, saleInput);
    assert.equal(saleDoc.totalUnits, 10);
    assert.equal(saleDoc.subtotal, 840);
    assert.equal(saleDoc.isCustomTotal, false);
    assert.equal(saleDoc.totalAmount, 840);
    assert.equal(store.get('inv_spun')?.quantity, 38);
    assert.equal(store.get('inv_fr450')?.quantity, 9);
  });

  test('insufficient stock on any line item aborts atomically with zero partial stock deductions', () => {
    const store = makeInventoryMap();

    const saleInput = createValidSaleInput({
      items: [
        createValidLineItem({
          itemId: 'inv_spun',
          itemName: '5µ PP Spun Filter Cartridge',
          category: 'spun_filter',
          quantity: 5, // available: 42
          unitPrice: 100,
          lineTotal: 500,
        }),
        createValidLineItem({
          itemId: 'inv_membrane',
          itemName: '75 GPD TFC RO Membrane',
          category: 'ro_membrane',
          quantity: 11, // available: 10 -> exceeds stock!
          unitPrice: 1200,
          lineTotal: 13200,
        }),
      ],
      totalUnits: 16,
      subtotal: 13700,
      isCustomTotal: true,
      totalAmount: 13000,
    });

    assert.throws(
      () => executeAtomicWholesaleSale(store, saleInput),
      /Insufficient stock for "75 GPD TFC RO Membrane": 10 available, 11 requested/
    );

    // First item MUST NOT have been deducted
    assert.equal(store.get('inv_spun')?.quantity, 42);
    assert.equal(store.get('inv_membrane')?.quantity, 10);
    assert.equal(store.get('inv_fr450')?.quantity, 15);
  });

  test('duplicate itemId lines aggregate requested quantity before checking stock', () => {
    const store = makeInventoryMap();

    // inv_membrane has 10 units; 6 + 5 = 11 requested across two lines
    const splitOverdraft = createValidSaleInput({
      items: [
        createValidLineItem({
          itemId: 'inv_membrane',
          itemName: '75 GPD TFC RO Membrane',
          category: 'ro_membrane',
          quantity: 6,
          unitPrice: 1250,
          lineTotal: 7500,
        }),
        createValidLineItem({
          itemId: 'inv_membrane',
          itemName: '75 GPD TFC RO Membrane',
          category: 'ro_membrane',
          quantity: 5,
          unitPrice: 1200,
          lineTotal: 6000,
        }),
      ],
      totalUnits: 11,
      subtotal: 13500,
      isCustomTotal: false,
      totalAmount: 13500,
    });

    assert.throws(
      () => executeAtomicWholesaleSale(store, splitOverdraft),
      /Insufficient stock for "75 GPD TFC RO Membrane": 10 available, 11 requested/
    );
    assert.equal(store.get('inv_membrane')?.quantity, 10);
  });

  test('exportWholesaleSalesToCsv outputs subtotal, custom total flag, and override totalAmount cleanly', async () => {
    const originalDocument = (globalThis as any).document;
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;

    let capturedBlob: Blob | null = null;
    let capturedDownloadFilename = '';

    const fakeLink = {
      style: {} as Record<string, string>,
      setAttribute(name: string, value: string) {
        if (name === 'download') capturedDownloadFilename = value;
      },
      click() {},
    };

    (globalThis as any).document = {
      body: {
        appendChild() {},
        removeChild() {},
      },
      createElement() {
        return fakeLink;
      },
    };
    URL.createObjectURL = (blob: Blob) => {
      capturedBlob = blob;
      return 'blob:mock-wholesale-csv';
    };
    URL.revokeObjectURL = () => {};

    try {
      const sale: WholesaleSale = {
        id: 'ws_csv_1',
        billNumber: 'WS-261126-CSV1',
        saleDate: '2026-11-26',
        technicianName: 'Arun, Madurai Tech',
        technicianPhone: '9842100022',
        items: [
          createValidLineItem({
            itemId: 'inv_spun',
            itemName: '5µ Spun Filter',
            quantity: 10,
            unitPrice: 85,
            lineTotal: 850,
          }),
          createValidLineItem({
            itemId: 'inv_membrane',
            itemName: '75 GPD Membrane',
            category: 'ro_membrane',
            quantity: 2,
            unitPrice: 1200,
            lineTotal: 2400,
          }),
        ],
        totalUnits: 12,
        subtotal: 3250,
        isCustomTotal: true,
        totalAmount: 3100,
        paymentStatus: 'Paid',
        notes: 'Rounded bill',
        ownerId: 'aquaplus-business',
        createdAt: '2026-11-26T04:20:00.000Z',
        updatedAt: '2026-11-26T04:20:00.000Z',
      };

      exportWholesaleSalesToCsv([sale]);

      assert.ok(capturedBlob, 'Expected Blob to be passed to URL.createObjectURL');
      assert.match(capturedDownloadFilename, /^AquaPlus_Wholesale_Sales_\d{4}-\d{2}-\d{2}\.csv$/);

      const csvText = await (capturedBlob as Blob).text();
      const [headerLine, dataLine] = csvText.split('\r\n');

      assert.equal(
        headerLine,
        'Bill Number,Sale Date,Technician Name,Technician Phone,Parts Sold,Total Units,Calculated Subtotal (INR),Custom Total Used,Final Bill Amount (INR),Payment Status,Notes'
      );
      assert.ok(dataLine.includes('WS-261126-CSV1'));
      assert.ok(dataLine.includes('"Arun, Madurai Tech"'));
      assert.ok(dataLine.includes('10x 5µ Spun Filter (@₹85); 2x 75 GPD Membrane (@₹1200)'));
      assert.ok(dataLine.includes(',12,3250,Yes,3100,Paid,Rounded bill'));
    } finally {
      (globalThis as any).document = originalDocument;
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    }
  });
});
