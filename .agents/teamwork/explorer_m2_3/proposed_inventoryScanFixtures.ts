import { InventoryScanResult } from '../../../src/types';

export const MOCK_PHYSICAL_PARTS_SCAN_RESULT: InventoryScanResult = {
  scanType: 'physical_parts',
  items: [
    {
      name: 'AquaPlus 5 Micron PP Spun Filter 10-inch',
      category: 'spun_filter',
      quantity: 4,
      unitCost: 45,
      confidence: 'high',
      notes: 'White cylindrical melt-blown polypropylene sediment filter cartridges, standard 10-inch housing size.',
    },
    {
      name: 'Filmtec 75 GPD RO Membrane Element',
      category: 'ro_membrane',
      quantity: 2,
      unitCost: 850,
      confidence: 'high',
      notes: 'Blue wrapped thin-film composite membrane elements with black o-rings.',
    },
    {
      name: 'Kemflo 450 CC Flow Restrictor',
      category: 'flow_restrictor',
      quantity: 3,
      unitCost: 65,
      confidence: 'medium',
      notes: 'White inline push-fit flow restrictor labeled 450 CC.',
    },
  ],
  rawSummary: 'Identified 4 spun filter cartridges, 2 RO membrane elements, and 3 flow restrictors in physical parts photograph.',
};

export const MOCK_INVOICE_SCAN_RESULT: InventoryScanResult = {
  scanType: 'supplier_invoice',
  supplierName: 'Sri Murugan Water Tech & Spares, Madurai',
  invoiceNumber: 'INV-2026-0842',
  invoiceDate: '2026-11-05',
  items: [
    {
      name: 'PP Spun Filter 10 Inch 5 Micron',
      category: 'spun_filter',
      quantity: 50,
      unitCost: 38,
      confidence: 'high',
      notes: 'Box of 50 cartridges at ₹38/unit. HSN: 8421.',
    },
    {
      name: 'Vontron 80 GPD RO Membrane Elements',
      category: 'ro_membrane',
      quantity: 10,
      unitCost: 780,
      confidence: 'high',
      notes: '10 units at ₹780/unit.',
    },
    {
      name: 'Grand Forest 100 GPD Booster Pump 24V',
      category: 'booster_pump',
      quantity: 5,
      unitCost: 1150,
      confidence: 'high',
      notes: '5 booster pump units at ₹1,150/unit.',
    },
    {
      name: 'SMPS Power Adapter 24V 2.5A',
      category: 'smps_adapter',
      quantity: 8,
      unitCost: 260,
      confidence: 'high',
      notes: '8 power supply adapters at ₹260/unit.',
    },
  ],
  rawSummary: 'Supplier bill from Sri Murugan Water Tech (INV-2026-0842) dated 2026-11-05 with 4 spare part line items.',
};

export const MOCK_UNRECOGNIZED_SCAN_RESULT: InventoryScanResult = {
  scanType: 'unrecognized',
  items: [],
  rawSummary: 'The image provided is too blurry or does not appear to show water purifier spare parts or a supplier invoice.',
  error: 'Could not identify water purifier parts or supplier bill. Please retake the photo with good lighting or enter items manually.',
};

export type MockScanScenario =
  | 'physical_parts'
  | 'supplier_invoice'
  | 'unrecognized'
  | 'quota_exceeded_429'
  | 'unauthorized_401'
  | 'forbidden_403'
  | 'payload_too_large_413'
  | 'service_unavailable_503'
  | 'server_error_500'
  | 'html_error_502'
  | 'timeout';

export function createMockScanFetch(scenario: MockScanScenario, delayMs: number = 0): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }

    if (init?.signal?.aborted) {
      const error = new Error('The operation was aborted');
      error.name = 'AbortError';
      throw error;
    }

    if (scenario === 'timeout') {
      return new Promise((_, reject) => {
        if (init?.signal) {
          init.signal.addEventListener('abort', () => {
            const error = new Error('The operation was aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }
      });
    }

    let status = 200;
    let body = '';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    switch (scenario) {
      case 'physical_parts':
        body = JSON.stringify(MOCK_PHYSICAL_PARTS_SCAN_RESULT);
        break;
      case 'supplier_invoice':
        body = JSON.stringify(MOCK_INVOICE_SCAN_RESULT);
        break;
      case 'unrecognized':
        body = JSON.stringify(MOCK_UNRECOGNIZED_SCAN_RESULT);
        break;
      case 'quota_exceeded_429':
        status = 429;
        headers['Retry-After'] = '60';
        body = JSON.stringify({ error: 'AI scan quota temporarily exhausted. Please wait a moment or enter manually.' });
        break;
      case 'unauthorized_401':
        status = 401;
        body = JSON.stringify({ error: 'An authorized, verified owner account is required.' });
        break;
      case 'forbidden_403':
        status = 403;
        body = JSON.stringify({ error: 'Access forbidden: owner permissions required.' });
        break;
      case 'payload_too_large_413':
        status = 413;
        body = JSON.stringify({ error: 'Request body is too large.' });
        break;
      case 'service_unavailable_503':
        status = 503;
        body = JSON.stringify({ error: 'Gemini Vision AI service is not configured. Missing GEMINI_API_KEY.' });
        break;
      case 'server_error_500':
        status = 500;
        body = JSON.stringify({ error: 'Internal server error processing vision prompt.' });
        break;
      case 'html_error_502':
        status = 502;
        headers['Content-Type'] = 'text/html';
        body = '<!DOCTYPE html><html><body><h1>502 Bad Gateway</h1></body></html>';
        break;
    }

    return new Response(body, {
      status,
      headers,
    });
  };
}
