export type ServiceCategory =
  | 'Routine Filter Change'
  | 'Pre-Filter Service'
  | 'RO Membrane Replacement'
  | 'Pump / Electrical Repair'
  | 'Full Service & Sanitization'
  | 'General Maintenance & TDS Check'
  | 'Installation / Relocation'
  | 'Other Service';

export type PaymentStatus = 'Paid' | 'Pending' | 'Partial';

export type CustomerStatus = 'active' | 'archived';

export type ReminderStatus =
  | 'upcoming'
  | 'due_today'
  | 'overdue'
  | 'paused'
  | 'sent'
  | 'failed'
  | 'contacted_manually'
  | 'superseded';

export type MessageDispatchStatus = 'not_sent' | 'pending' | 'sent' | 'failed';

export type GatewayConfigStatus =
  | 'not_configured'
  | 'configured'
  | 'connected'
  | 'disabled'
  | 'error';

export interface Customer {
  id: string;
  customerId: string; // e.g. "AP-1001"
  fullName: string;
  primaryPhone: string;
  alternatePhone?: string;
  address: string;
  locality: string; // Madurai area like Thirunagar, Anna Nagar, KK Nagar
  customerNotes?: string;
  purifierBrand: string; // e.g. Kent, Aquaguard, Pureit, Havells, Livpure, Aqua Plus
  purifierModel?: string;
  installationDate?: string; // YYYY-MM-DD
  registrationDate: string; // YYYY-MM-DD
  whatsappConsent: boolean;
  emailConsent?: boolean;
  consentTimestamp?: string;
  consentSource?: string; // e.g., "In-person visit", "Phone agreement", "Work order form"
  status: CustomerStatus;
  defaultIntervalDays?: number; // Customer specific override, e.g. 90
  lastServiceDate?: string; // YYYY-MM-DD
  nextReminderDate?: string; // YYYY-MM-DD
  remindersPaused?: boolean;
  isSampleData?: boolean;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceRecord {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  serviceDate: string; // YYYY-MM-DD
  serviceCategory: ServiceCategory;
  problemReported?: string;
  workPerformed: string;
  filtersReplaced?: string;
  serviceCharge: number;
  partsCharge: number;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  technicianNotes?: string;
  recommendedIntervalDays: number;
  calculatedNextReminderDate: string; // YYYY-MM-DD
  nextReminderDate: string; // YYYY-MM-DD (actual or manual override)
  isDateOverridden: boolean;
  internalNotes?: string;
  isSampleData?: boolean;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Reminder {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerLocality: string;
  serviceRecordId?: string;
  serviceCategory?: ServiceCategory;
  lastServiceDate?: string;
  reminderDate: string; // YYYY-MM-DD
  status: ReminderStatus;
  manualContactNotes?: string;
  manualContactDate?: string;
  lastAttemptDate?: string;
  messageStatus: MessageDispatchStatus;
  errorMessage?: string;
  isSampleData?: boolean;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessageAttempt {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  reminderId?: string;
  serviceRecordId?: string;
  idempotencyKey: string;
  provider: 'whatsapp_cloud_api' | 'manual_phone_call' | 'fallback_link';
  templateName: string;
  language: 'en' | 'ta';
  status: 'success' | 'failed' | 'unknown' | 'simulated_blocked';
  providerMessageId?: string;
  providerDeliveryStatus?: 'sent' | 'delivered' | 'read' | 'failed';
  errorDetails?: string;
  attemptedAt: string;
  ownerId: string;
}

export interface MessageDeliveryEvent {
  id: string;
  providerMessageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipientPhone?: string;
  errorCode?: string;
  createdAt: string;
}

export interface OwnerReport {
  id: string;
  reportDate: string; // YYYY-MM-DD
  generatedAt: string;
  recipientEmail: string;
  status: 'generated' | 'sent' | 'failed' | 'not_configured';
  totalCustomers: number;
  completedToday: number;
  dueToday: number;
  upcomingCount: number;
  overdueCount: number;
  messagesSentCount: number;
  messagesFailedCount: number;
  manualFollowUpsCount: number;
  consentAttentionCount: number;
  summaryText: string;
  ownerId: string;
}

export interface AppSettings {
  id: string;
  businessName: string;
  location: string;
  businessAddress: string;
  primaryPhone: string;
  secondaryPhone: string;
  businessEmail: string;
  website: string;
  ownerNotificationEmail: string;
  ownerEmailConfirmed: boolean;
  dailyReportTime: string; // e.g. "09:00"
  timezone: string; // "Asia/Kolkata"
  currency: string; // "INR"
  defaultIntervalDays: number; // e.g. 90
  categoryIntervals: Record<string, number>;
  whatsappTemplateEn: string;
  whatsappTemplateTa: string;
  whatsappStatus: GatewayConfigStatus;
  whatsappPhoneNumberId?: string;
  whatsappBusinessAccountId?: string;
  whatsappAccessTokenMasked?: string;
  emailStatus: GatewayConfigStatus;
  scheduledProcessingEnabled: boolean;
  lastScheduledRun?: string;
  ownerId: string;
  updatedAt: string;
}

export type AuditEntityType =
  | 'Customer'
  | 'ServiceRecord'
  | 'Reminder'
  | 'Settings'
  | 'BatchScheduler'
  | 'InventoryItem';

export interface AuditEvent {
  id: string;
  action: string;
  details: string;
  entityType: AuditEntityType;
  entityId?: string;
  ownerId: string;
  timestamp: string;
}

export interface DashboardMetrics {
  totalCustomers: number;
  servicesCompletedThisMonth: number;
  servicesDueToday: number;
  servicesDueSoon: number; // next 14 days
  overdueFollowUps: number;
  messagesSentSuccessfully: number;
  failedMessagesRequiringAttention: number;
  contactedManuallyCount: number;
}

// ============================================================================
// INVENTORY MANAGEMENT DOMAIN TYPES & CONSTANTS
// ============================================================================

export type InventoryCategory =
  | 'spun_filter'
  | 'ro_membrane'
  | 'sediment_filter'
  | 'carbon_block'
  | 'post_carbon'
  | 'booster_pump'
  | 'smps_adapter'
  | 'flow_restrictor'
  | 'fittings_tubing'
  | 'other';

export const INVENTORY_CATEGORIES: readonly InventoryCategory[] = [
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
] as const;

export const INVENTORY_CATEGORY_LABELS: Record<InventoryCategory, string> = {
  spun_filter: 'Spun Filter (PP)',
  ro_membrane: 'RO Membrane',
  sediment_filter: 'Sediment Filter',
  carbon_block: 'Carbon Block (CTO)',
  post_carbon: 'Post Carbon / Mineral',
  booster_pump: 'Booster Pump',
  smps_adapter: 'SMPS Power Adapter',
  flow_restrictor: 'Flow Restrictor (FR)',
  fittings_tubing: 'Fittings & Tubing',
  other: 'Other Spare Parts',
};

export function isInventoryCategory(value: unknown): value is InventoryCategory {
  return typeof value === 'string' && INVENTORY_CATEGORIES.includes(value as InventoryCategory);
}

export interface InventoryItem {
  id: string;
  name: string;
  category: InventoryCategory;
  quantity: number;
  lowStockThreshold: number;
  unitCost: number;       // Purchase / procurement price in INR (₹)
  sellingPrice: number;   // Retail / service price charged to customer in INR (₹)
  storageLocation?: string; // Bin / shelf / rack identifier e.g. "Bin A-01"
  notes?: string;         // Technical specifications, compatibility notes
  isSampleData?: boolean; // True for demo/seed fixtures
  ownerId: string;        // Business owner / tenant identifier
  createdAt: string;      // ISO 8601 UTC timestamp
  updatedAt: string;      // ISO 8601 UTC timestamp
}

export type InventoryItemInput = Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt' | 'ownerId'>;

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  in_stock: 'In Stock',
  low_stock: 'Low Stock',
  out_of_stock: 'Out of Stock',
};

/**
 * Calculates stock status based on current quantity and low-stock threshold.
 *
 * Rules:
 * - quantity <= 0: 'out_of_stock'
 * - quantity <= lowStockThreshold: 'low_stock'
 * - quantity > lowStockThreshold: 'in_stock'
 *
 * Defensive: safely converts NaN, null, or undefined to 0 to prevent silent false-positives.
 */
export function getStockStatus(
  item:
    | Pick<InventoryItem, 'quantity' | 'lowStockThreshold'>
    | { quantity?: number | null; lowStockThreshold?: number | null }
): StockStatus {
  const qty = typeof item?.quantity === 'number' && !Number.isNaN(item.quantity) ? item.quantity : 0;
  const threshold =
    typeof item?.lowStockThreshold === 'number' && !Number.isNaN(item.lowStockThreshold)
      ? item.lowStockThreshold
      : 0;

  if (qty <= 0) return 'out_of_stock';
  if (qty <= threshold) return 'low_stock';
  return 'in_stock';
}

export type VisionConfidence = 'high' | 'medium' | 'low';
export type InventoryScanType = 'physical_parts' | 'supplier_invoice' | 'unrecognized';

export interface ScannedItemSuggestion {
  name: string;
  category: InventoryCategory;
  quantity: number;
  unitCost?: number;
  sellingPrice?: number;
  confidence?: VisionConfidence;
  notes?: string;
  matchedItemId?: string;
  action?: 'add_new' | 'increment_existing' | 'skip';
}

export interface InventoryScanResult {
  scanType: InventoryScanType;
  supplierName?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  items: ScannedItemSuggestion[];
  rawSummary?: string;
  error?: string;
}

export interface InventoryScanRequest {
  imageBase64: string;
  mimeType: string;
}

export interface UsedPartEntry {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface StockAdjustment {
  itemId: string;
  delta: number;
  reason?: string;
  newQuantity?: number;
}

export interface InventorySummaryMetrics {
  totalSkus: number;
  totalUnits: number;
  totalCostValue: number;
  totalRetailValue: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export interface InventoryValidationResult {
  isValid: boolean;
  errors: Partial<Record<keyof InventoryItemInput, string>>;
}

export function validateInventoryItem(data: Partial<InventoryItemInput>): InventoryValidationResult {
  const errors: Partial<Record<keyof InventoryItemInput, string>> = {};

  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.name = 'Item name is required.';
  } else if (data.name.trim().length > 120) {
    errors.name = 'Item name cannot exceed 120 characters.';
  }

  if (!data.category || !isInventoryCategory(data.category)) {
    errors.category = 'A valid inventory category must be selected.';
  }

  if (typeof data.quantity !== 'number' || Number.isNaN(data.quantity) || data.quantity < 0) {
    errors.quantity = 'Quantity must be 0 or greater.';
  } else if (data.quantity > 100000) {
    errors.quantity = 'Quantity exceeds maximum allowable limit (100,000).';
  }

  if (
    typeof data.lowStockThreshold !== 'number' ||
    Number.isNaN(data.lowStockThreshold) ||
    data.lowStockThreshold < 0
  ) {
    errors.lowStockThreshold = 'Low stock threshold must be 0 or greater.';
  } else if (data.lowStockThreshold > 100000) {
    errors.lowStockThreshold = 'Low stock threshold exceeds maximum allowable limit (100,000).';
  }

  if (typeof data.unitCost !== 'number' || Number.isNaN(data.unitCost) || data.unitCost < 0) {
    errors.unitCost = 'Unit cost must be ₹0 or greater.';
  } else if (data.unitCost > 1000000) {
    errors.unitCost = 'Unit cost exceeds maximum allowable limit (₹1,000,000).';
  }

  if (typeof data.sellingPrice !== 'number' || Number.isNaN(data.sellingPrice) || data.sellingPrice < 0) {
    errors.sellingPrice = 'Selling price must be ₹0 or greater.';
  } else if (data.sellingPrice > 1000000) {
    errors.sellingPrice = 'Selling price exceeds maximum allowable limit (₹1,000,000).';
  }

  if (data.storageLocation && data.storageLocation.length > 100) {
    errors.storageLocation = 'Storage location cannot exceed 100 characters.';
  }

  if (data.notes && data.notes.length > 500) {
    errors.notes = 'Notes cannot exceed 500 characters.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function calculateInventoryMetrics(items: InventoryItem[]): InventorySummaryMetrics {
  let totalUnits = 0;
  let totalCostValue = 0;
  let totalRetailValue = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  for (const item of items) {
    const qty = typeof item.quantity === 'number' && !Number.isNaN(item.quantity) ? item.quantity : 0;
    const cost = typeof item.unitCost === 'number' && !Number.isNaN(item.unitCost) ? item.unitCost : 0;
    const price = typeof item.sellingPrice === 'number' && !Number.isNaN(item.sellingPrice) ? item.sellingPrice : 0;

    totalUnits += qty;
    totalCostValue += qty * cost;
    totalRetailValue += qty * price;

    const status = getStockStatus(item);
    if (status === 'out_of_stock') {
      outOfStockCount++;
    } else if (status === 'low_stock') {
      lowStockCount++;
    }
  }

  return {
    totalSkus: items.length,
    totalUnits,
    totalCostValue,
    totalRetailValue,
    lowStockCount,
    outOfStockCount,
  };
}
