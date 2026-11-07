# Project: AquaPlus Service OS — Production Inventory & Storage Management

## Architecture
- **Overview**: Full-stack inventory management feature for AquaPlus Service OS field technicians and owners. Tracks spare parts and supplies (e.g. RO spun filters, membranes, carbon blocks, booster pumps), monitors low-stock thresholds, supports manual CRUD operations, integrates AI vision scanning of parts and supplier invoices via Gemini Vision AI, links parts usage with service records, and provides seamless navigation across desktop web and Capacitor mobile shells.
- **Frontend Layer**: React 19 + TypeScript + Vite 8 + Tailwind CSS v4. State-driven navigation via `ActiveTab` in `src/App.tsx`, desktop `Sidebar.tsx` with alert badges, and fixed bottom `MobileNav.tsx`.
- **Data & Persistence Layer**: Google Cloud Firestore (`inventory` collection). Field whitelisting enforced in `firestore.rules` via `isValidInventoryItem(data)`. Real-time `onSnapshot` subscriptions and atomic transactions in `src/services/dbService.ts`.
- **AI Vision Pipeline**: Server-side proxy endpoint `POST /api/inventory/scan` in `src/server/apiMiddleware.ts` using official `@google/genai` (v2.4.0) with structured JSON response schema (`responseJsonSchema`). Client-side HTML canvas compression reduces camera captures to <1.2MB before transmission.
- **Image Capture Mechanism**: Universal HTML5 `<input type="file" accept="image/*" capture="environment">` with drag-and-drop, running natively across mobile browsers, Capacitor Android WebView, and desktop without requiring extra native plugins or Android permissions.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Inventory Data Model & Types | Define `InventoryItem`, `InventoryCategory`, `StockStatus`, and audit types in `src/types/index.ts` | M1 | Survey (all) |
| 2 | Firestore Data Access Layer | Real-time `subscribeInventory`, CRUD operations (`addInventoryItem`, `updateInventoryItem`, `deleteInventoryItem`), and atomic stock adjustments in `src/services/dbService.ts` | M1 | Survey 2 & 3 |
| 3 | Firestore Security Rules | Implement `isValidInventoryItem` with `keys().hasOnly(...)` and match rule `/inventory/{itemId}` in `firestore.rules` | M1 | Survey 2 & 3 |
| 4 | Sample Inventory Seed Data | Provide rich sample inventory dataset in `dbService.ts` for demo/development mode | M1 | Survey 2 & 3 |
| 5 | Server-Side Gemini Vision Scan Endpoint | Implement `POST /api/inventory/scan` in `src/server/apiMiddleware.ts` with 10MB body buffer and `@google/genai` adapter | M2 | Survey 1, 2, 3 |
| 6 | Multimodal Vision Prompt & JSON Schema | Prompt distinguishing physical spare parts vs supplier invoices with structured JSON schema (`responseJsonSchema`) | M2 | Survey 2 & 3 |
| 7 | Client-Side Image Pre-processor | Canvas resize to max 1600px with 85% JPEG compression to ensure fast mobile upload and low latency | M2 | Survey 2 & 3 |
| 8 | Vision API Client & Error Fallback | Client service `scanInventoryImage` in `src/services/apiService.ts` with error categorization and manual fallback | M2 | Survey 2 & 3 |
| 9 | Inventory Catalog & Status View | Full-featured inventory view in `src/pages/InventoryPage.tsx` with responsive table (desktop) and card list (mobile) | M3 | Survey (all) |
| 10 | Stock Status Calculation & Badges | Dynamic stock status calculation (`in_stock`, `low_stock`, `out_of_stock`) with color-coded warning badges | M3 | Survey 1 & 3 |
| 11 | Inventory KPI Summary Cards | Header metrics displaying Total SKUs, Total Units, Total Value (₹), Low Stock Count, and Out of Stock Count | M3 | Survey 3 |
| 12 | Catalog Search & Category Filters | Real-time search across item name, category, and storage bin, plus category and stock status filter pills | M3 | Survey 1 & 3 |
| 13 | Manual Item Creation & Edit Modals | Modal dialogs to add new spare parts and edit item details, pricing, thresholds, and bin locations | M3 | Survey 1 & 3 |
| 14 | Quick Stock Adjust Steppers | Inline "+1" / "-1" quantity controls and custom stock adjust modal preventing negative inventory | M3 | Survey 2 & 3 |
| 15 | Item Deletion Safety Dialog | Safe deletion dialog to remove obsolete items with confirmation check | M3 | Survey 3 |
| 16 | Camera & Image Capture UI | Clean modal interface supporting direct camera photo capture, file picker, and drag-and-drop | M3 | Survey 1, 2, 3 |
| 17 | Interactive Review & Confirmation Modal | Staging table allowing user to review/edit parsed item name, category, quantity, unit cost, and select "Add New" vs "Increment Existing" | M3 | Survey 2 & 3 |
| 18 | Desktop Sidebar Navigation Integration | Extend `ActiveTab` with `'inventory'`, add `Package` icon in `src/components/Sidebar.tsx`, and display dynamic low-stock badge | M4 | Survey 1 |
| 19 | Mobile Bottom Navigation Integration | Add Inventory access in `src/components/MobileNav.tsx` with touch layout and badge indicator | M4 | Survey 1 |
| 20 | Main App Routing & Tab State | Connect `inventory` tab in `src/App.tsx`, lazy-load `InventoryPage`, and pass inventory state and callbacks | M4 | Survey 1 |
| 21 | Service Record Parts Usage Linkage | Enhance `RecordServiceModal.tsx` to select spare parts from inventory, auto-populate `partsCharge` and `filtersReplaced`, and deduct stock | M4 | Survey 1, 2, 3 |
| 22 | Automated Regression & Unit Tests | Automated test suite in `tests/regressions.test.ts` verifying CRUD, low-stock alerts, vision parsing, and fallback handling | M5 | Survey (all) |
| 23 | In-App Test Runner Verification | Interactive test suite in `src/utils/testRunner.ts` verifying business logic on `AutomatedTestsPage.tsx` | M5 | Survey 1 & 3 |
| 24 | Sample Photos & Invoices Verification | E2E verification using sample photos of spare parts and supplier bills/invoices provided for testing | M5 | ORIGINAL_REQUEST |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Data Models, Firestore & Security Rules | Features 1, 2, 3, 4: TypeScript types, Firestore CRUD, security rules, sample data | none | DONE |
| M2 | Gemini Vision AI Service & Image Pipeline | Features 5, 6, 7, 8: Server scan endpoint, `@google/genai` adapter, canvas pre-processor, error handling | M1 | IN_PROGRESS |
| M3 | Inventory Catalog Page & Vision Review Modal | Features 9, 10, 11, 12, 13, 14, 15, 16, 17: UI catalog, KPI cards, filters, modals, scanner & confirmation workflow | M1, M2 | PLANNED |
| M4 | Navigation Integration & Service Record Linkage | Features 18, 19, 20, 21: Sidebar, MobileNav, App.tsx routing, RecordServiceModal parts deduction | M1, M3 | PLANNED |
| M5 | Final Milestone: E2E Test Pass & Adversarial Hardening | Features 22, 23, 24: 100% E2E test pass (Tiers 1-4), adversarial test hardening (Tier 5), sample parts/invoices verification | M1, M2, M3, M4 | PLANNED |

## Interface Contracts

### M1 ↔ M2/M3: Inventory Item Data Contract
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

export interface InventoryItem {
  id: string;
  name: string;
  category: InventoryCategory;
  quantity: number;
  lowStockThreshold: number;
  unitCost: number;       // Purchase / cost price
  sellingPrice: number;   // Price charged to customer
  storageLocation?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export function getStockStatus(item: Pick<InventoryItem, 'quantity' | 'lowStockThreshold'>): StockStatus {
  if (item.quantity <= 0) return 'out_of_stock';
  if (item.quantity <= item.lowStockThreshold) return 'low_stock';
  return 'in_stock';
}
```

### M2 ↔ M3: Gemini Vision Scan Contract
```typescript
export interface ScannedItemSuggestion {
  name: string;
  category: InventoryCategory;
  quantity: number;
  unitCost?: number;
  confidence?: 'high' | 'medium' | 'low';
  notes?: string;
}

export interface InventoryScanResult {
  scanType: 'physical_parts' | 'supplier_invoice' | 'unrecognized';
  supplierName?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  items: ScannedItemSuggestion[];
  rawSummary?: string;
  error?: string;
}

// Endpoint: POST /api/inventory/scan
// Request: { imageBase64: string, mimeType: string }
// Response: InventoryScanResult
```

### M1/M3 ↔ M4: Service Record Linkage Contract
```typescript
export interface UsedPartEntry {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

// In RecordServiceModal & dbService:
// Deducts quantity atomically from inventoryItems during recordCompletedService
```

## Code Layout
- `src/types/index.ts` — Shared domain interfaces (`InventoryItem`, `InventoryCategory`, `InventoryScanResult`)
- `firestore.rules` — Firestore document security rules (`isValidInventoryItem`, `/inventory/{itemId}`)
- `src/services/dbService.ts` — Firestore CRUD operations, real-time snapshot listeners, sample inventory seed
- `src/services/apiService.ts` — Frontend client calls including `scanInventoryImage`
- `src/server/apiMiddleware.ts` — Server middleware with `POST /api/inventory/scan` and body buffer handling
- `src/server/geminiVisionAdapter.ts` — Gemini Vision adapter using `@google/genai` v2.4.0
- `src/utils/imageCompressor.ts` — Client-side canvas image resizing and compression
- `src/pages/InventoryPage.tsx` — Main Inventory Management view (desktop & mobile responsive)
- `src/components/inventory/InventoryItemModal.tsx` — Add/Edit inventory item modal
- `src/components/inventory/InventoryScanModal.tsx` — Camera/File capture and review/confirmation interface
- `src/components/Sidebar.tsx` — Desktop sidebar with Inventory navigation and low-stock badge
- `src/components/MobileNav.tsx` — Mobile bottom navigation with Inventory item
- `src/components/RecordServiceModal.tsx` — Service recording modal with inventory spare parts picker
- `src/App.tsx` — Application tab navigation and inventory state propagation
- `tests/regressions.test.ts` — Automated test suites for regressions, CRUD, and vision parsing
- `src/utils/testRunner.ts` — In-browser automated test runner
