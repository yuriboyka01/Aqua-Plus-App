# Domain Types & Validation Specification — Inventory Management

**Specialist Role**: Milestone 1 Explorer 1 (Domain Types & Validation Specialist)  
**Date**: 2026-11-07  
**Scope**: Milestone 1 — Feature 1 (`Inventory Data Model & Types`) and system-wide type contracts  
**Status**: Read-Only Investigation Complete

---

## 1. Executive Summary

AquaPlus Service OS requires a production-grade Inventory Management domain model to track water purifier spare parts, consumables, stock levels, low-stock alerts, AI vision scan intake, and service record parts deduction.

This investigation examined the existing codebase patterns in `src/types/index.ts`, `src/services/dbService.ts`, `firestore.rules`, `src/lib/constants.ts`, and test suites. We have designed:
1. Exact TypeScript types for `InventoryCategory`, `InventoryItem`, and `StockStatus`.
2. Pure, deterministic status calculation helper `getStockStatus` with edge-case hardening (0 quantity, negative quantity, threshold equality, `NaN` resilience).
3. Vision AI scan types (`ScannedItemSuggestion`, `InventoryScanResult`, `InventoryScanRequest`) aligned with Gemini Vision AI (v2.4.0) response schema.
4. Auxiliary service linkage (`UsedPartEntry`), stock adjustment (`StockAdjustment`), and KPI summary metrics (`InventorySummaryMetrics`).
5. Extension to `AuditEvent.entityType` supporting `'InventoryItem'` and inventory audit actions.
6. Type guards (`isInventoryCategory`) and validation rules matching `firestore.rules` field whitelists (`hasOnly`).

All designed types are 100% backward-compatible. No existing interfaces or imports will break.

---

## 2. Analysis of Existing Codebase & Type Patterns

### 2.1 Existing Pattern in `src/types/index.ts`
- **String Literal Unions**: Statuses and categories are strongly typed string unions (e.g., `ServiceCategory`, `PaymentStatus`, `ReminderStatus`, `GatewayConfigStatus`).
- **Entity Interfaces**: All Firestore documents follow a strict standard:
  - `id: string` (generated via `generateDocId('prefix')`)
  - `ownerId: string` (tenant isolation key, typically `aquaplus-business` or authenticated user UID)
  - `createdAt: string` (ISO 8601 UTC timestamp)
  - `updatedAt: string` (ISO 8601 UTC timestamp)
  - `isSampleData?: boolean` (flag separating demonstration fixtures from immutable production data)
- **Zero Extraneous Classes**: All models are plain TypeScript interfaces suitable for JSON serialization over Firestore and REST APIs.

### 2.2 Firestore Security Rules Alignment
`firestore.rules` heavily uses `hasOnly([...])` field whitelisting. For `customers`, `serviceRecords`, `reminders`, and `auditEvents`, passing any unwhitelisted field causes a rule rejection.
Therefore, `InventoryItem` in TypeScript must match the exact field names whitelisted in `isValidInventoryItem(data)`:
```
['id', 'name', 'category', 'quantity', 'lowStockThreshold', 'unitCost', 'sellingPrice', 'storageLocation', 'notes', 'isSampleData', 'ownerId', 'createdAt', 'updatedAt']
```
Crucially, `ownerId: string` and `isSampleData?: boolean` must be present on `InventoryItem` so that:
1. Multi-tenant rule `isOwner(incoming().ownerId)` succeeds.
2. Demo data seeding and purge operations (`purgeSampleInventory`) can delete only items with `existing().isSampleData == true`.

---

## 3. Exact Domain Type Specifications

### 3.1 Inventory Categories (`InventoryCategory`)
10 distinct categories covering RO water purifier servicing and assembly:

```typescript
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
```

#### Category Constants & Labels
To support UI filter pills, dropdown menus, and validation without duplicating string literals across components:

```typescript
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
```

---

### 3.2 Inventory Item (`InventoryItem`)
Represents an individual stock keeping unit (SKU) in the `inventory` Firestore collection:

```typescript
export interface InventoryItem {
  id: string;
  name: string;
  category: InventoryCategory;
  quantity: number;
  lowStockThreshold: number;
  unitCost: number;       // Purchase / cost price in INR (₹)
  sellingPrice: number;   // Selling price charged to customer in INR (₹)
  storageLocation?: string; // Bin / shelf / vehicle e.g. "Shelf A-2", "Service Van 1"
  notes?: string;         // Technical specifications, brand compatibility
  isSampleData?: boolean; // True for mock/demo seed items
  ownerId: string;        // Business owner / tenant ID (BUSINESS_OWNER_ID)
  createdAt: string;      // ISO 8601 UTC timestamp
  updatedAt: string;      // ISO 8601 UTC timestamp
}

/** Form data representation used during item creation and editing before system metadata is attached */
export type InventoryItemInput = Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt' | 'ownerId'>;
```

---

### 3.3 Stock Status & Calculation (`StockStatus`, `getStockStatus`)

```typescript
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
 * Defensive: converts NaN, null, or undefined values to 0 to prevent silent false-positives.
 */
export function getStockStatus(
  item: Pick<InventoryItem, 'quantity' | 'lowStockThreshold'> | { quantity?: number | null; lowStockThreshold?: number | null }
): StockStatus {
  const qty = typeof item?.quantity === 'number' && !Number.isNaN(item.quantity) ? item.quantity : 0;
  const threshold = typeof item?.lowStockThreshold === 'number' && !Number.isNaN(item.lowStockThreshold) ? item.lowStockThreshold : 0;

  if (qty <= 0) return 'out_of_stock';
  if (qty <= threshold) return 'low_stock';
  return 'in_stock';
}
```

#### Truth Table for `getStockStatus`:
| Quantity (`quantity`) | Threshold (`lowStockThreshold`) | Calculated Status | Rationale |
|---|---|---|---|
| `-5` | `10` | `'out_of_stock'` | Any non-positive count is out of stock |
| `0` | `10` | `'out_of_stock'` | Depleted inventory |
| `0` | `0` | `'out_of_stock'` | Out of stock takes precedence over threshold |
| `3` | `10` | `'low_stock'` | Quantity <= threshold |
| `10` | `10` | `'low_stock'` | Exactly at threshold triggers low stock alert |
| `11` | `10` | `'in_stock'` | Quantity strictly greater than threshold |
| `undefined` / `NaN` | `5` | `'out_of_stock'` | Defensive fallback defaults to 0 |

---

## 4. Exact Auxiliary Types Specification

### 4.1 Gemini Vision AI Scanning Types (M2 & M3)
Used by `POST /api/inventory/scan`, `@google/genai` vision adapter, and `InventoryScanModal.tsx`:

```typescript
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
  matchedItemId?: string;                       // ID of existing catalog item if name/category matches
  action?: 'add_new' | 'increment_existing' | 'skip'; // Technician decision in review modal
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
```

---

### 4.2 Service Record Parts Usage Linkage (M4)
Used by `RecordServiceModal.tsx` and `recordCompletedService`:

```typescript
export interface UsedPartEntry {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number; // Selling price per unit billed to customer
}
```

---

### 4.3 Stock Adjustments & KPI Summary Types (M3)
Used by `InventoryPage.tsx` for header KPI cards and stock step adjusters:

```typescript
export interface StockAdjustment {
  itemId: string;
  delta: number;   // +1, -1, or custom delta (+5, -2)
  reason?: string; // e.g. "Damaged in transit", "Physical count audit", "Stock delivery"
  newQuantity?: number;
}

export interface InventorySummaryMetrics {
  totalSkus: number;
  totalUnits: number;
  totalCostValue: number;    // sum(quantity * unitCost)
  totalRetailValue: number;  // sum(quantity * sellingPrice)
  lowStockCount: number;
  outOfStockCount: number;
}
```

---

### 4.4 Audit Event Extensions
Extending `AuditEvent` entity types to enable structured inventory audit logs:

```typescript
export type AuditEntityType =
  | 'Customer'
  | 'ServiceRecord'
  | 'Reminder'
  | 'Settings'
  | 'BatchScheduler'
  | 'InventoryItem';

export type InventoryAuditAction =
  | 'INVENTORY_ITEM_CREATED'
  | 'INVENTORY_ITEM_UPDATED'
  | 'INVENTORY_ITEM_DELETED'
  | 'INVENTORY_STOCK_ADJUSTED'
  | 'INVENTORY_PARTS_DEDUCTED'
  | 'INVENTORY_SCAN_PROCESSED'
  | 'SAMPLE_INVENTORY_SEEDED'
  | 'SAMPLE_INVENTORY_PURGED';
```

And in `AuditEvent`:
```typescript
export interface AuditEvent {
  id: string;
  action: string;
  details: string;
  entityType: AuditEntityType; // Replaces 'Customer' | 'ServiceRecord' | ... | 'InventoryItem'
  entityId?: string;
  ownerId: string;
  timestamp: string;
}
```

---

## 5. Input Validation Rules & Schema

To guarantee data integrity across UI modals, Gemini scan ingestion, and Firestore persistence, the following validation constraints are defined:

| Field | Type | Required | Constraints | Rationale |
|---|---|---|---|---|
| `name` | string | Yes | Min 1 char, Max 120 chars, trimmed | Matches customer name length and mobile card layouts |
| `category` | `InventoryCategory` | Yes | Must be one of the 10 defined categories | Matches Firestore rules `data.category in [...]` |
| `quantity` | number | Yes | Min 0, Max 1,000,000, integer | Negative stock is disallowed in production |
| `lowStockThreshold` | number | Yes | Min 0, Max 100,000, integer | Must not be negative; alerts trigger when stock <= threshold |
| `unitCost` | number | Yes | Min 0, Max 1,000,000 | Purchase price in ₹; matches Firestore serviceCharge cap |
| `sellingPrice` | number | Yes | Min 0, Max 1,000,000 | Retail price in ₹; typically >= unitCost |
| `storageLocation` | string | No | Max 100 chars | Bin / shelf / vehicle label |
| `notes` | string | No | Max 500 chars | Technical notes, compatibility notes |
| `ownerId` | string | Yes | Max 128 chars | Tenant isolation key |

### Validation Function
Can be placed in `src/utils/businessLogic.ts` (or exported alongside types):

```typescript
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
  } else if (data.quantity > 1000000) {
    errors.quantity = 'Quantity exceeds maximum allowable limit (1,000,000).';
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
```

---

## 6. Backward Compatibility Analysis

We analyzed all 18 files importing from `src/types/index.ts`:
- `src/lib/constants.ts`
- `src/services/dbService.ts`
- `src/utils/businessLogic.ts`
- `src/server/schedulerAdapter.ts`
- `src/server/productionScheduler.ts`
- `src/utils/csvExport.ts`
- `src/utils/testRunner.ts`
- `src/pages/*` (Settings, Customers, RemindersQueue, ServiceHistory, Dashboard, DailyReports)
- `src/components/*` (CustomerModal, CustomerDetailDrawer, RecordServiceModal, ReminderActionModal, DirectWhatsAppPreviewModal, DailyReportModal, SeedDataModal)

### Findings:
1. **Existing Types Untouched**: `Customer`, `ServiceRecord`, `Reminder`, `MessageAttempt`, `MessageDeliveryEvent`, `OwnerReport`, `AppSettings`, `DashboardMetrics` remain completely unchanged.
2. **`AuditEvent` Entity Widening**: Replacing the inline union in `AuditEvent.entityType` with `AuditEntityType = 'Customer' | 'ServiceRecord' | 'Reminder' | 'Settings' | 'BatchScheduler' | 'InventoryItem'` is purely additive. All existing calls to `recordAuditEvent` in `dbService.ts` and `productionScheduler.ts` remain strictly valid.
3. **TypeScript Module Resolution**: `src/types/index.ts` is imported both as `from '../types'` and `from '../types/index.ts'`. Exporting types, constants, and the `getStockStatus` function directly from `src/types/index.ts` is fully compliant with Vite's bundler and `isolatedModules: true`.
4. **Current Test Suite**: Ran `npm run lint` (`tsc --noEmit`) and `npm test` (`tsx --test tests/regressions.test.ts`). All 16 existing tests pass cleanly (325ms).

---

## 7. Recommended Implementation Plan for the Worker

### Step 1: Update `src/types/index.ts`
Add the new types, interfaces, category constants, and `getStockStatus` helper at the bottom of `src/types/index.ts`, and update `AuditEvent.entityType` to use `AuditEntityType`.

#### Exact Diff for `src/types/index.ts`:

```diff
--- a/src/types/index.ts
+++ b/src/types/index.ts
@@ -188,7 +188,15 @@ export interface AppSettings {
+export type AuditEntityType =
+  | 'Customer'
+  | 'ServiceRecord'
+  | 'Reminder'
+  | 'Settings'
+  | 'BatchScheduler'
+  | 'InventoryItem';
+
 export interface AuditEvent {
   id: string;
   action: string;
   details: string;
-  entityType: 'Customer' | 'ServiceRecord' | 'Reminder' | 'Settings' | 'BatchScheduler';
+  entityType: AuditEntityType;
   entityId?: string;
   ownerId: string;
   timestamp: string;
@@ -208,0 +216,104 @@ export interface DashboardMetrics {
+
+// ============================================================================
+// INVENTORY MANAGEMENT DOMAIN TYPES
+// ============================================================================
+
+export type InventoryCategory =
+  | 'spun_filter'
+  | 'ro_membrane'
+  | 'sediment_filter'
+  | 'carbon_block'
+  | 'post_carbon'
+  | 'booster_pump'
+  | 'smps_adapter'
+  | 'flow_restrictor'
+  | 'fittings_tubing'
+  | 'other';
+
+export const INVENTORY_CATEGORIES: readonly InventoryCategory[] = [
+  'spun_filter',
+  'ro_membrane',
+  'sediment_filter',
+  'carbon_block',
+  'post_carbon',
+  'booster_pump',
+  'smps_adapter',
+  'flow_restrictor',
+  'fittings_tubing',
+  'other',
+] as const;
+
+export const INVENTORY_CATEGORY_LABELS: Record<InventoryCategory, string> = {
+  spun_filter: 'Spun Filter (PP)',
+  ro_membrane: 'RO Membrane',
+  sediment_filter: 'Sediment Filter',
+  carbon_block: 'Carbon Block (CTO)',
+  post_carbon: 'Post Carbon / Mineral',
+  booster_pump: 'Booster Pump',
+  smps_adapter: 'SMPS Power Adapter',
+  flow_restrictor: 'Flow Restrictor (FR)',
+  fittings_tubing: 'Fittings & Tubing',
+  other: 'Other Spare Parts',
+};
+
+export function isInventoryCategory(value: unknown): value is InventoryCategory {
+  return typeof value === 'string' && INVENTORY_CATEGORIES.includes(value as InventoryCategory);
+}
+
+export interface InventoryItem {
+  id: string;
+  name: string;
+  category: InventoryCategory;
+  quantity: number;
+  lowStockThreshold: number;
+  unitCost: number;       // Purchase price in INR
+  sellingPrice: number;   // Retail price in INR
+  storageLocation?: string;
+  notes?: string;
+  isSampleData?: boolean;
+  ownerId: string;
+  createdAt: string;
+  updatedAt: string;
+}
+
+export type InventoryItemInput = Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt' | 'ownerId'>;
+
+export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';
+
+export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
+  in_stock: 'In Stock',
+  low_stock: 'Low Stock',
+  out_of_stock: 'Out of Stock',
+};
+
+export function getStockStatus(
+  item: Pick<InventoryItem, 'quantity' | 'lowStockThreshold'> | { quantity?: number | null; lowStockThreshold?: number | null }
+): StockStatus {
+  const qty = typeof item?.quantity === 'number' && !Number.isNaN(item.quantity) ? item.quantity : 0;
+  const threshold = typeof item?.lowStockThreshold === 'number' && !Number.isNaN(item.lowStockThreshold) ? item.lowStockThreshold : 0;
+  if (qty <= 0) return 'out_of_stock';
+  if (qty <= threshold) return 'low_stock';
+  return 'in_stock';
+}
+
+export type VisionConfidence = 'high' | 'medium' | 'low';
+export type InventoryScanType = 'physical_parts' | 'supplier_invoice' | 'unrecognized';
+
+export interface ScannedItemSuggestion {
+  name: string;
+  category: InventoryCategory;
+  quantity: number;
+  unitCost?: number;
+  sellingPrice?: number;
+  confidence?: VisionConfidence;
+  notes?: string;
+  matchedItemId?: string;
+  action?: 'add_new' | 'increment_existing' | 'skip';
+}
+
+export interface InventoryScanResult {
+  scanType: InventoryScanType;
+  supplierName?: string;
+  invoiceNumber?: string;
+  invoiceDate?: string;
+  items: ScannedItemSuggestion[];
+  rawSummary?: string;
+  error?: string;
+}
+
+export interface InventoryScanRequest {
+  imageBase64: string;
+  mimeType: string;
+}
+
+export interface UsedPartEntry {
+  itemId: string;
+  name: string;
+  quantity: number;
+  unitPrice: number;
+}
+
+export interface StockAdjustment {
+  itemId: string;
+  delta: number;
+  reason?: string;
+  newQuantity?: number;
+}
+
+export interface InventorySummaryMetrics {
+  totalSkus: number;
+  totalUnits: number;
+  totalCostValue: number;
+  totalRetailValue: number;
+  lowStockCount: number;
+  outOfStockCount: number;
+}
```

---

### Step 2: Add Helper Functions to `src/utils/businessLogic.ts`
Implement:
1. `validateInventoryItem(data: Partial<InventoryItemInput>)`
2. `calculateInventoryMetrics(items: InventoryItem[]): InventorySummaryMetrics`

```typescript
export function calculateInventoryMetrics(items: InventoryItem[]): InventorySummaryMetrics {
  let totalUnits = 0;
  let totalCostValue = 0;
  let totalRetailValue = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  for (const item of items) {
    totalUnits += item.quantity;
    totalCostValue += item.quantity * item.unitCost;
    totalRetailValue += item.quantity * item.sellingPrice;
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
```

---

### Step 3: Add Unit Tests to `tests/regressions.test.ts`
Add unit tests verifying:
1. `getStockStatus` returns `'out_of_stock'` for `0` and negative values.
2. `getStockStatus` returns `'low_stock'` when `quantity == lowStockThreshold`.
3. `getStockStatus` returns `'low_stock'` when `quantity < lowStockThreshold && quantity > 0`.
4. `getStockStatus` returns `'in_stock'` when `quantity > lowStockThreshold`.
5. `isInventoryCategory` accepts all 10 valid categories and rejects invalid strings.
6. `validateInventoryItem` validates required fields, negative values, and caps.

---

### Step 4: Verification Commands for Worker
```bash
# 1. Typecheck and ensure no compiler errors
npm run lint

# 2. Run existing and new regression tests
npm test
```
