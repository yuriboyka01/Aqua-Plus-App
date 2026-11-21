/**
 * Pure vision response normalization and category alias utilities.
 * Safe for both browser (client test runner) and Node.js server runtimes.
 */

import {
  InventoryCategory,
  isInventoryCategory,
  InventoryScanResult,
  ScannedItemSuggestion,
  VisionConfidence,
} from '../types/index.ts';

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
