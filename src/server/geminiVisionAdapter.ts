/**
 * AquaPlus Service OS — Gemini Vision Server Adapter
 * Connects to Google Gemini API using @google/genai SDK (v2.4.0).
 * Analyzes photos of physical spare parts and supplier invoices.
 */

import { GoogleGenAI, Type } from '@google/genai';
import {
  InventoryCategory,
  isInventoryCategory,
  InventoryScanRequest,
  InventoryScanResult,
  ScannedItemSuggestion,
  VisionConfidence,
} from '../types/index.ts';

export interface GeminiVisionConfig {
  apiKey?: string;
  model?: string;
}

export function getGeminiVisionConfig(): GeminiVisionConfig {
  const env = typeof process !== 'undefined' && process?.env ? process.env : {};
  return {
    apiKey: env.GEMINI_API_KEY || '',
    model: env.GEMINI_MODEL || 'gemini-2.5-flash',
  };
}

function hasUsableSecret(value: string | undefined, minimumLength: number): boolean {
  const normalized = value?.trim() || '';
  return (
    normalized.length >= minimumLength &&
    !/^(?:MY_|YOUR_|GENERATE_|CHANGE_ME|PLACEHOLDER)/i.test(normalized)
  );
}

export function getGeminiVisionStatus(): {
  status: 'not_configured' | 'configured' | 'error';
  details: string;
  model: string;
} {
  const config = getGeminiVisionConfig();
  if (!hasUsableSecret(config.apiKey, 10)) {
    return {
      status: 'not_configured',
      details: 'Missing or placeholder GEMINI_API_KEY in server environment variables.',
      model: config.model || 'gemini-2.5-flash',
    };
  }
  return {
    status: 'configured',
    details: 'Gemini Vision AI is configured and ready.',
    model: config.model || 'gemini-2.5-flash',
  };
}

export const INVENTORY_SCAN_JSON_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    scanType: {
      type: Type.STRING,
      enum: ['physical_parts', 'supplier_invoice', 'unrecognized'],
      description: 'Image classification type.',
    },
    supplierName: {
      type: Type.STRING,
      description: 'Vendor or supplier name extracted from the invoice/bill.',
    },
    invoiceNumber: {
      type: Type.STRING,
      description: 'Invoice, bill, or receipt reference number.',
    },
    invoiceDate: {
      type: Type.STRING,
      description: 'Invoice date in YYYY-MM-DD or printed format.',
    },
    rawSummary: {
      type: Type.STRING,
      description: 'Human-readable summary of identified items or explanation for unrecognized images.',
    },
    items: {
      type: Type.ARRAY,
      description: 'List of spare parts or inventory items identified.',
      items: {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            description: 'Item name or description.',
          },
          category: {
            type: Type.STRING,
            enum: [
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
            ],
            description: 'Standardized inventory category.',
          },
          quantity: {
            type: Type.INTEGER,
            description: 'Quantity of items detected or billed.',
          },
          unitCost: {
            type: Type.NUMBER,
            description: 'Estimated or billed unit procurement cost in INR.',
          },
          sellingPrice: {
            type: Type.NUMBER,
            description: 'Recommended retail price to end customer in INR.',
          },
          confidence: {
            type: Type.STRING,
            enum: ['high', 'medium', 'low'],
            description: 'Confidence level of the recognition.',
          },
          notes: {
            type: Type.STRING,
            description: 'Technical specifications, rating, or condition.',
          },
        },
        required: ['name', 'category', 'quantity', 'confidence'],
      },
    },
  },
  required: ['scanType', 'items', 'rawSummary'],
};

export const INVENTORY_SCAN_SYSTEM_PROMPT = `
You are the expert computer vision AI for AquaPlus Service OS, specialized in water purification hardware, RO/UV filter spare parts, and plumbing components in the Indian water purification service industry (e.g. Madurai, Tamil Nadu).

Analyze the provided image and classify it into one of three scan types:
1. "physical_parts": Photo showing physical water purifier hardware, components, filters, pumps, power supplies, or fittings.
2. "supplier_invoice": A printed bill, handwritten invoice, delivery challan, or receipt from a water purification equipment supplier, distributor, or dealer.
3. "unrecognized": An image that does not depict water purifier hardware/parts or equipment invoices/bills (e.g., general scenery, portraits, food, animals, random objects, or completely unrelated documents).

INSTRUCTIONS FOR "physical_parts":
- Identify all distinct water purifier spare parts and hardware items visible in the image.
- Classify each item into exactly one of the allowed categories:
  * spun_filter: 10-inch or 20-inch polypropylene (PP) spun / melt-blown sediment pre-filter cartridges (typically white cylindrical fibrous filters).
  * ro_membrane: Thin-film composite RO membrane elements (e.g. 75 GPD, 80 GPD, 100 GPD; wrapped cylindrical elements often branded Dow, Filmtec, Vontron, CSM, Hi-Tech).
  * sediment_filter: Inline sediment filter cartridges (sealed cylindrical plastic housings with 1/4" push-fit stem/ports).
  * carbon_block: CTO sintered carbon block cartridges (black cylindrical extruded carbon wrapped in outer white mesh).
  * post_carbon: Post-carbon, silver impregnated, alkaline, or mineral inline cartridges (often blue, white, or yellow cylinders).
  * booster_pump: 24V or 36V DC diaphragm booster pumps (e.g. Kemflo, BNQS, Grand Forest, E-Chen, 75/100 GPD pumps with motor body and pump head).
  * smps_adapter: 24V or 36V DC switch-mode power supply adapters / electronic ballasts with AC cords.
  * flow_restrictor: Wastewater flow restrictor tubes (e.g. FR 350, FR 450, FR 650 with quick-connect fittings).
  * fittings_tubing: Push-fit elbows, tees, check valves, bulkheads, solenoid valves (SV 24V), low-pressure switches (LPS), high-pressure switches (HPS), or 1/4" and 3/8" RO tubing.
  * other: TDS meters, UV lamps, UV chambers, filter housing bowls, spanner wrenches, or unclassified purifier spares.
- Count the visible quantity of each part type. If packaged in a clearly labeled box/pack (e.g. "Pack of 25"), record the pack quantity. Otherwise, count individual items pictured.
- Estimate realistic unit procurement cost (unitCost in INR ₹) and selling price (sellingPrice in INR ₹) if recognizable, or set to 0 if unknown.
- Set confidence to "high", "medium", or "low" based on visual clarity and certainty.
- Note any brand names, specs (e.g. "75 GPD", "24V 2.5A", "5 Micron"), or condition in the "notes" field.
- Set supplierName, invoiceNumber, and invoiceDate to null/empty string.

INSTRUCTIONS FOR "supplier_invoice":
- Extract the vendor/distributor business name into "supplierName".
- Extract the invoice/bill reference number into "invoiceNumber".
- Extract the invoice date into "invoiceDate" (prefer YYYY-MM-DD format if date is clear).
- Extract each billed line item that represents water purification spare parts, filters, or hardware into the "items" array:
  * "name": Item description as written on the invoice.
  * "category": Map to the most appropriate category among the 10 allowed categories.
  * "quantity": Billed quantity as an integer.
  * "unitCost": Unit rate / price per item in INR (₹) before tax or net rate.
  * "sellingPrice": Recommended retail selling price (unitCost with typical 40-80% markup).
  * "confidence": "high" for clearly printed text, "medium" for handwritten/faded text, "low" for ambiguous text.
  * "notes": Line item specifics, batch, or tax info.
- EXCLUDE non-inventory charges such as courier/transport freight fees, packaging charges, labor/service charges, or overall invoice discount lines.

INSTRUCTIONS FOR "unrecognized":
- If the image does not contain water purifier spare parts or supplier invoices, set scanType to "unrecognized".
- Set items to an empty array [].
- Set rawSummary to a polite, descriptive explanation of what was detected in the photo and why it could not be identified as inventory (e.g., "The image appears to be a landscape photo with no water purification components or invoices visible.").

Always return valid JSON adhering strictly to the response schema.
`;

const CATEGORY_ALIASES: Record<string, InventoryCategory> = {
  spun: 'spun_filter',
  spunfilter: 'spun_filter',
  spun_filter: 'spun_filter',
  pre_filter: 'spun_filter',
  prefilter: 'spun_filter',
  pp_filter: 'spun_filter',
  membrane: 'ro_membrane',
  ro_membrane: 'ro_membrane',
  romembrane: 'ro_membrane',
  inline_sediment: 'sediment_filter',
  sediment: 'sediment_filter',
  sediment_filter: 'sediment_filter',
  carbon: 'carbon_block',
  cto: 'carbon_block',
  carbon_block: 'carbon_block',
  post_carbon: 'post_carbon',
  mineral_filter: 'post_carbon',
  mineral_cartridge: 'post_carbon',
  alkaline: 'post_carbon',
  pump: 'booster_pump',
  booster_pump: 'booster_pump',
  motor: 'booster_pump',
  smps: 'smps_adapter',
  adapter: 'smps_adapter',
  power_supply: 'smps_adapter',
  smps_adapter: 'smps_adapter',
  fr: 'flow_restrictor',
  flow_restrictor: 'flow_restrictor',
  fitting: 'fittings_tubing',
  fittings: 'fittings_tubing',
  tubing: 'fittings_tubing',
  pipe: 'fittings_tubing',
  fittings_tubing: 'fittings_tubing',
  solenoid_valve: 'fittings_tubing',
  sv: 'fittings_tubing',
};

export function normalizeCategory(raw: unknown): InventoryCategory {
  if (typeof raw !== 'string') return 'other';
  const clean = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (isInventoryCategory(clean)) return clean;
  if (CATEGORY_ALIASES[clean]) return CATEGORY_ALIASES[clean];
  for (const [alias, cat] of Object.entries(CATEGORY_ALIASES)) {
    if (clean.includes(alias)) return cat;
  }
  return 'other';
}

export function normalizeConfidence(raw: unknown): VisionConfidence {
  if (raw === 'high' || raw === 'medium' || raw === 'low') return raw;
  return 'medium';
}

export function parseAndNormalizeVisionResponse(raw: unknown): InventoryScanResult {
  if (!raw || typeof raw !== 'object') {
    return {
      scanType: 'unrecognized',
      items: [],
      rawSummary: 'Unable to parse AI vision response.',
    };
  }

  const data = raw as Record<string, unknown>;

  let scanType: 'physical_parts' | 'supplier_invoice' | 'unrecognized' = 'unrecognized';
  if (data.scanType === 'physical_parts' || data.scanType === 'supplier_invoice') {
    scanType = data.scanType;
  }

  const rawSummary =
    typeof data.rawSummary === 'string' && data.rawSummary.trim()
      ? data.rawSummary.trim()
      : scanType === 'unrecognized'
        ? 'The image could not be recognized as water purifier spare parts or a supplier invoice.'
        : 'Items successfully identified.';

  if (scanType === 'unrecognized') {
    return {
      scanType: 'unrecognized',
      items: [],
      rawSummary,
    };
  }

  const rawItems = Array.isArray(data.items) ? data.items : [];
  const items: ScannedItemSuggestion[] = [];

  for (const rawItem of rawItems) {
    if (!rawItem || typeof rawItem !== 'object') continue;
    const item = rawItem as Record<string, unknown>;

    const name =
      typeof item.name === 'string' && item.name.trim()
        ? item.name.trim().slice(0, 120)
        : 'Spare Part';

    const category = normalizeCategory(item.category);

    const rawQty = Number(item.quantity);
    const quantity = !Number.isNaN(rawQty) && rawQty > 0 ? Math.floor(rawQty) : 1;

    let unitCost: number | undefined;
    if (typeof item.unitCost === 'number' && !Number.isNaN(item.unitCost) && item.unitCost >= 0) {
      unitCost = Math.round(item.unitCost * 100) / 100;
    }

    let sellingPrice: number | undefined;
    if (typeof item.sellingPrice === 'number' && !Number.isNaN(item.sellingPrice) && item.sellingPrice >= 0) {
      sellingPrice = Math.round(item.sellingPrice * 100) / 100;
    }

    const confidence = normalizeConfidence(item.confidence);

    const notes =
      typeof item.notes === 'string' && item.notes.trim()
        ? item.notes.trim().slice(0, 300)
        : undefined;

    items.push({
      name,
      category,
      quantity,
      unitCost,
      sellingPrice,
      confidence,
      notes,
      action: 'add_new',
    });
  }

  const supplierName =
    typeof data.supplierName === 'string' && data.supplierName.trim()
      ? data.supplierName.trim().slice(0, 100)
      : undefined;

  const invoiceNumber =
    typeof data.invoiceNumber === 'string' && data.invoiceNumber.trim()
      ? data.invoiceNumber.trim().slice(0, 50)
      : undefined;

  const invoiceDate =
    typeof data.invoiceDate === 'string' && data.invoiceDate.trim()
      ? data.invoiceDate.trim().slice(0, 30)
      : undefined;

  return {
    scanType,
    supplierName,
    invoiceNumber,
    invoiceDate,
    items,
    rawSummary,
  };
}

let cachedAiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  const config = getGeminiVisionConfig();
  if (!config.apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not configured.');
  }
  if (!cachedAiClient) {
    cachedAiClient = new GoogleGenAI({ apiKey: config.apiKey });
  }
  return cachedAiClient;
}

export async function scanInventoryWithGeminiVision(
  request: InventoryScanRequest,
  clientOverride?: GoogleGenAI
): Promise<InventoryScanResult> {
  let cleanMimeType = request.mimeType || 'image/jpeg';
  let cleanBase64 = request.imageBase64 || '';

  const dataUrlMatch = cleanBase64.match(/^data:([a-zA-Z0-9.+/-]+);base64,(.+)$/s);
  if (dataUrlMatch) {
    cleanMimeType = dataUrlMatch[1].toLowerCase();
    cleanBase64 = dataUrlMatch[2];
  }
  cleanBase64 = cleanBase64.replace(/\s+/g, '');

  if (!cleanBase64) {
    return {
      scanType: 'unrecognized',
      items: [],
      rawSummary: 'Empty image data provided.',
      error: 'EMPTY_IMAGE_DATA',
    };
  }

  const status = getGeminiVisionStatus();
  if (status.status !== 'configured') {
    return {
      scanType: 'unrecognized',
      items: [],
      rawSummary: status.details,
      error: 'GEMINI_NOT_CONFIGURED',
    };
  }

  try {
    const ai = clientOverride || getAiClient();
    const model = getGeminiVisionConfig().model || 'gemini-2.5-flash';

    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          inlineData: {
            mimeType: cleanMimeType,
            data: cleanBase64,
          },
        },
        {
          text: INVENTORY_SCAN_SYSTEM_PROMPT,
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: INVENTORY_SCAN_JSON_SCHEMA,
        temperature: 0.1,
      },
    });

    const text = response.text || '{}';
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      console.error(JSON.stringify({ severity: 'ERROR', message: 'Failed to parse Gemini Vision JSON output', rawText: text }));
      return {
        scanType: 'unrecognized',
        items: [],
        rawSummary: 'Gemini returned malformed response.',
        error: 'JSON_PARSE_ERROR',
      };
    }

    return parseAndNormalizeVisionResponse(parsed);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ severity: 'ERROR', message: 'Gemini Vision API generation failed', error: message }));

    return {
      scanType: 'unrecognized',
      items: [],
      rawSummary: 'Unable to analyze image with Gemini Vision AI. Please check network or enter items manually.',
      error: message,
    };
  }
}
