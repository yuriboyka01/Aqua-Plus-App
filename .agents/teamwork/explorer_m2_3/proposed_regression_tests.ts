import test from 'node:test';
import assert from 'node:assert/strict';
import {
  scanInventoryImage,
  InventoryScanError,
  isQuotaExceededError,
  isAuthError,
  isNetworkOrTimeoutError,
  getScanErrorMessage,
  setApiBaseUrl,
} from '../src/services/apiService';
import {
  createMockScanFetch,
  MOCK_PHYSICAL_PARTS_SCAN_RESULT,
  MOCK_INVOICE_SCAN_RESULT,
} from '../src/services/inventoryScanFixtures';

test('scanInventoryImage parses physical spare parts scan result with high confidence items', async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = createMockScanFetch('physical_parts');
  try {
    const result = await scanInventoryImage('dGVzdA==', 'image/jpeg', {
      authToken: 'mock-valid-owner-token',
    });
    assert.equal(result.scanType, 'physical_parts');
    assert.equal(result.items.length, 3);
    assert.equal(result.items[0].name, 'AquaPlus 5 Micron PP Spun Filter 10-inch');
    assert.equal(result.items[0].category, 'spun_filter');
    assert.equal(result.items[0].quantity, 4);
    assert.equal(result.items[0].unitCost, 45);
    assert.equal(result.items[0].confidence, 'high');
    assert.equal(result.items[1].name, 'Filmtec 75 GPD RO Membrane Element');
    assert.equal(result.items[1].category, 'ro_membrane');
    assert.equal(result.items[1].quantity, 2);
    assert.equal(result.items[2].name, 'Kemflo 450 CC Flow Restrictor');
    assert.equal(result.items[2].category, 'flow_restrictor');
    assert.equal(result.items[2].quantity, 3);
    assert.match(result.rawSummary || '', /spun filter cartridges/i);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('scanInventoryImage parses supplier invoice scan result with metadata and itemized parts', async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = createMockScanFetch('supplier_invoice');
  try {
    const result = await scanInventoryImage('dGVzdA==', 'image/jpeg', {
      authToken: 'mock-valid-owner-token',
    });
    assert.equal(result.scanType, 'supplier_invoice');
    assert.equal(result.supplierName, 'Sri Murugan Water Tech & Spares, Madurai');
    assert.equal(result.invoiceNumber, 'INV-2026-0842');
    assert.equal(result.invoiceDate, '2026-11-05');
    assert.equal(result.items.length, 4);
    assert.equal(result.items[0].name, 'PP Spun Filter 10 Inch 5 Micron');
    assert.equal(result.items[0].quantity, 50);
    assert.equal(result.items[0].unitCost, 38);
    assert.equal(result.items[2].category, 'booster_pump');
    assert.equal(result.items[3].category, 'smps_adapter');
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('scanInventoryImage handles unrecognized scan with safe empty item list and user guidance without throwing', async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = createMockScanFetch('unrecognized');
  try {
    const result = await scanInventoryImage('dGVzdA==', 'image/jpeg', {
      authToken: 'mock-valid-owner-token',
    });
    assert.equal(result.scanType, 'unrecognized');
    assert.equal(result.items.length, 0);
    assert.ok(result.error);
    assert.match(result.error, /Could not identify water purifier parts/i);
    assert.match(result.rawSummary || '', /too blurry/i);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('scanInventoryImage normalizes data URL input and strips base64 prefix cleanly', async () => {
  let capturedBody = '';
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    capturedBody = typeof init?.body === 'string' ? init.body : '';
    return new Response(JSON.stringify(MOCK_PHYSICAL_PARTS_SCAN_RESULT), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8';
    await scanInventoryImage(dataUrl, 'image/png', {
      authToken: 'mock-valid-owner-token',
    });
    const parsed = JSON.parse(capturedBody);
    assert.equal(parsed.imageBase64, 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8');
    assert.equal(parsed.mimeType, 'image/png');
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('scanInventoryImage throws friendly QUOTA_EXCEEDED InventoryScanError on HTTP 429', async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = createMockScanFetch('quota_exceeded_429');
  try {
    await assert.rejects(
      async () => {
        await scanInventoryImage('dGVzdA==', 'image/jpeg', {
          authToken: 'mock-valid-owner-token',
        });
      },
      (err: any) => {
        assert.equal(err instanceof InventoryScanError, true);
        assert.equal(err.code, 'QUOTA_EXCEEDED');
        assert.equal(err.statusCode, 429);
        assert.equal(err.canRetry, true);
        assert.match(err.message, /AI scan quota temporarily exhausted/i);
        return true;
      }
    );
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('scanInventoryImage throws UNAUTHORIZED InventoryScanError on missing auth or HTTP 401', async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = createMockScanFetch('unauthorized_401');
  try {
    await assert.rejects(
      async () => {
        await scanInventoryImage('dGVzdA==', 'image/jpeg', {
          authToken: 'expired-or-invalid-token',
        });
      },
      (err: any) => {
        assert.equal(err instanceof InventoryScanError, true);
        assert.equal(err.code, 'UNAUTHORIZED');
        assert.equal(err.statusCode, 401);
        assert.equal(err.canRetry, false);
        return true;
      }
    );
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('scanInventoryImage throws SERVICE_UNAVAILABLE InventoryScanError on HTTP 503', async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = createMockScanFetch('service_unavailable_503');
  try {
    await assert.rejects(
      async () => {
        await scanInventoryImage('dGVzdA==', 'image/jpeg', {
          authToken: 'mock-valid-owner-token',
        });
      },
      (err: any) => {
        assert.equal(err instanceof InventoryScanError, true);
        assert.equal(err.code, 'SERVICE_UNAVAILABLE');
        assert.equal(err.statusCode, 503);
        assert.equal(err.canRetry, false);
        assert.match(err.message, /AI vision service is currently unavailable/i);
        return true;
      }
    );
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('scanInventoryImage throws SERVER_ERROR InventoryScanError on HTTP 500', async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = createMockScanFetch('server_error_500');
  try {
    await assert.rejects(
      async () => {
        await scanInventoryImage('dGVzdA==', 'image/jpeg', {
          authToken: 'mock-valid-owner-token',
        });
      },
      (err: any) => {
        assert.equal(err instanceof InventoryScanError, true);
        assert.equal(err.code, 'SERVER_ERROR');
        assert.equal(err.statusCode, 500);
        assert.equal(err.canRetry, true);
        return true;
      }
    );
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('scanInventoryImage throws INVALID_RESPONSE InventoryScanError on HTML error response', async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = createMockScanFetch('html_error_502');
  try {
    await assert.rejects(
      async () => {
        await scanInventoryImage('dGVzdA==', 'image/jpeg', {
          authToken: 'mock-valid-owner-token',
        });
      },
      (err: any) => {
        assert.equal(err instanceof InventoryScanError, true);
        assert.equal(err.code, 'INVALID_RESPONSE');
        assert.equal(err.statusCode, 502);
        assert.match(err.message, /Backend server unavailable \(returned HTML HTTP 502\)/i);
        return true;
      }
    );
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('scanInventoryImage enforces timeout and throws TIMEOUT error with canRetry=true', async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = createMockScanFetch('timeout');
  try {
    await assert.rejects(
      async () => {
        await scanInventoryImage('dGVzdA==', 'image/jpeg', {
          authToken: 'mock-valid-owner-token',
          timeoutMs: 50,
        });
      },
      (err: any) => {
        assert.equal(err instanceof InventoryScanError, true);
        assert.equal(err.code, 'TIMEOUT');
        assert.equal(err.statusCode, 408);
        assert.equal(err.canRetry, true);
        assert.match(err.message, /Image scan timed out/i);
        return true;
      }
    );
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('scanInventoryImage helper predicates classify errors accurately', () => {
  const quotaErr = new InventoryScanError('Quota exceeded', 'QUOTA_EXCEEDED', 429, true);
  assert.equal(isQuotaExceededError(quotaErr), true);
  assert.equal(isAuthError(quotaErr), false);

  const authErr = new InventoryScanError('Unauthorized', 'UNAUTHORIZED', 401, false);
  assert.equal(isAuthError(authErr), true);
  assert.equal(isQuotaExceededError(authErr), false);

  const timeoutErr = new InventoryScanError('Timed out', 'TIMEOUT', 408, true);
  assert.equal(isNetworkOrTimeoutError(timeoutErr), true);

  const networkErr = new InventoryScanError('Network failed', 'NETWORK_ERROR', 0, true);
  assert.equal(isNetworkOrTimeoutError(networkErr), true);

  assert.equal(getScanErrorMessage(quotaErr), 'Quota exceeded');
  assert.equal(getScanErrorMessage(new Error('Generic err')), 'Generic err');
  assert.match(getScanErrorMessage('string error'), /unexpected error/i);
});
