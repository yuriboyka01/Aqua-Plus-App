# AquaPlus Service OS — Inventory & Storage Management Specification

**Document Version:** 1.0.0  
**Status:** Authoritative Specification  
**Author:** Teamwork Specification Miner  
**Integrity Mode:** Development  
**Base Requirements Reference:** `ORIGINAL_REQUEST.md` (R1, R2, R3, R4)  
**Target Environment:** React 19 (Desktop Web) + Capacitor 8 Android Mobile Shell  

---

## 1. Executive Summary & Domain Context

AquaPlus Service OS is the dedicated operational platform for **Aqua Plus RO Tech**, a premier water purification sales and service enterprise based in **Madurai, Tamil Nadu, India** (Thirunagar, Anna Nagar, KK Nagar, etc.). 

The **Inventory & Storage Management** system enables service business owners and technicians to:
1. Maintain real-time oversight of all RO purifier spare parts, filter cartridges, membranes, electrical components, and plumbing hardware across shop storage and service vans.
2. Prevent service delays through automatic **Low-Stock Alerting** and reorder indicators.
3. Rapidly digitize inventory intake using **Gemini Vision AI**, transforming physical photos of spare parts or supplier wholesale bills/invoices into structured, verified inventory entries.
4. Seamlessly integrate parts tracking with technician service visits (`ServiceRecord`), linking parts replaced with customer job orders and billing.

---

## 2. Requirements Traceability Matrix

| Original Request | Requirement Name | Key Capabilities Specified | Primary System Touchpoints |
|---|---|---|---|
| **R1** | Inventory Storage and Tracking | Stock catalog view, item categorization, quantity on hand, unit cost, selling price, low-stock threshold monitoring, KPI valuation widgets. | `InventoryPage`, `InventoryCard`, `dbService.ts`, Firestore collection `inventoryItems` |
| **R2** | Manual Entry and Stock Management | Add new item modal, edit item drawer, quick +1/-1 stock adjustment, bulk restock, soft/hard deletion with confirmation, inventory audit log. | `InventoryModal`, `AdjustStockModal`, `dbService.ts`, `auditEvents` |
| **R3** | Image Scanning for Inventory Entry | Photo capture (camera/upload), pre-processing & compression, Gemini Vision API analysis (`@google/genai`), structured extraction of physical parts or supplier invoices, editable review confirmation modal, stock increment vs new item modes, robust fallback handling. | `ScanInventoryModal`, `geminiVisionService.ts`, `ReviewScannedItemsModal`, Settings API key config |
| **R4** | Application & Navigation Integration | Desktop Sidebar tab with low-stock badge, Mobile bottom navigation item, service visit parts linkage in `RecordServiceModal`, backward-compatible schema alignment. | `Sidebar.tsx`, `MobileNav.tsx`, `App.tsx`, `RecordServiceModal.tsx`, `firestore.rules` |

---

## 3. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | **R1: Storage & Tracking** | Inventory Catalog View | Responsive data table (desktop) and card list (mobile) displaying all tracked items with real-time Firestore sync. | Active tenant `ownerId`, filter/sort state | Rendered list of items with badges, quantities, costs, locations | Empty state illustration with "Add First Item" or "Scan Invoice" CTA | R1, `App.tsx`, `dbService.ts` |
| 2 | **R1: Storage & Tracking** | Stock Level Status Computation | Evaluates item stock status (`in_stock`, `low_stock`, `out_of_stock`) based on `quantity` vs `lowStockThreshold`. | `quantity: number`, `lowStockThreshold: number` | `StockStatus` enum, color styling tokens, accessible badge | Defensive fallback to `in_stock` if threshold is undefined/invalid | R1, Low-Stock Logic Spec |
| 3 | **R1: Storage & Tracking** | KPI Inventory Metrics Cards | Computes aggregate inventory value, total stock units, items needing reorder, and out-of-stock items. | Array of `InventoryItem` | Summary cards: Total SKUs, Total Units, Inventory Value (₹), Low Stock, Out of Stock | Renders ₹0 and 0 counts for empty database | R1, `DashboardMetrics` convention |
| 4 | **R1: Storage & Tracking** | Multi-dimensional Filtering & Search | Filter items by category, stock status (In Stock, Low Stock, Out of Stock), and instant search across name, category, and storage bin. | `searchQuery: string`, `categoryFilter: string`, `statusFilter: string` | Filtered array of items | Shows "No items matching filter" with 1-click reset button | R1, `CustomersPage.tsx` search pattern |
| 5 | **R2: Manual Management** | Add New Inventory Item | Modal form to register a new spare part SKU with name, category, quantity, threshold, unit cost, selling price, and storage bin. | User form submission (`Omit<InventoryItem, 'id' \| 'createdAt' \| 'updatedAt'>`) | New document in `inventoryItems`, audit log event | Form validation error alerts on negative numbers or empty name | R2, `CustomerModal.tsx` pattern |
| 6 | **R2: Manual Management** | Edit Inventory Item Details | Drawer or modal allowing updates to pricing, threshold, storage bin, or item notes without altering historical logs. | `itemId: string`, updated partial fields | Updated document in `inventoryItems`, toast notification | Reverts on network timeout or Firestore security violation | R2, `CustomerDetailDrawer.tsx` pattern |
| 7 | **R2: Manual Management** | Quick Stock Increment / Decrement | Inline "+1" / "-1" steppers or quick adjust popover for rapid stock correction directly on the table/card. | `itemId: string`, `delta: number`, optional reason | Atomically updated `quantity`, `updatedAt` timestamp | Prevents quantity falling below 0; disables "-1" when quantity is 0 | R2, Quick Action UX |
| 8 | **R2: Manual Management** | Remove / Delete Inventory Item | Delete confirmation dialog allowing removal of discontinued or erroneous items with safety checks. | `itemId: string`, user confirmation | Document removed from `inventoryItems`, deletion audit log | Prevents accidental deletion without confirmation prompt | R2, `firestore.rules` delete policy |
| 9 | **R3: Vision AI Scanning** | Image Capture & Upload Handler | Supports photo capture from mobile camera (`capture="environment"`) or file selection from desktop/laptop file system. | Image file (`image/jpeg`, `image/png`, `image/webp`) | Base64 encoded string + MIME type + dimensions | Rejects non-image files (>15MB) with clear alert | R3, Capacitor WebView & Web compatibility |
| 10 | **R3: Vision AI Scanning** | Client-Side Image Pre-processor | Resizes high-resolution smartphone camera photos (e.g. 4000x3000, 8MB) to max 1600px width/height and 85% JPEG quality before base64 encoding. | Raw image `File` or `Blob` | Compressed image `Blob` (<1.2MB) and base64 string | Falls back to original buffer if canvas resize fails | R3, mobile performance optimization |
| 11 | **R3: Vision AI Scanning** | Gemini Vision Multimodal Analyzer | Sends compressed base64 image and domain prompt to Gemini Vision AI (`@google/genai`) using structured JSON schema. | Base64 image, API key, prompt configuration | Structured JSON object (`InventoryScanResult`) | Categorized errors: missing key, network timeout, rate limit | R3, `@google/genai` SDK v2.4.0 docs |
| 12 | **R3: Vision AI Scanning** | Dual Document Parsing (Parts vs Invoice) | Automatically distinguishes physical spare parts photos from supplier paper bills/invoices, extracting itemized lines, quantities, and rates. | Raw image contents | `scanType: "physical_parts" \| "supplier_invoice"`, supplier info, detected items | If unidentifiable, returns `scanType: "unrecognized"` with empty list | R3, ORIGINAL_REQUEST.md AC |
| 13 | **R3: Vision AI Scanning** | Review & Confirmation Modal | Interactive editable staging interface showing detected items with name, category, quantity, cost, and match selector before committing. | `InventoryScanResult`, existing `InventoryItem[]` | User-edited list of items ready to apply | User can edit, delete rows, or add missing rows manually | R3, User flow specification |
| 14 | **R3: Vision AI Scanning** | Stock Matching Mode (New vs Increment) | Allows user to either create a new SKU or increment existing stock count of an already registered item upon scan confirmation. | Selected action per row: `create_new` vs `increment_existing` (with item ID) | Batch writes to Firestore creating new items and updating existing quantities | Highlights matched existing items with fuzzy string comparison | R3, Dispatch instructions Task 3 |
| 15 | **R3: Vision AI Scanning** | Graceful AI Fallback & Key Discovery | Tiered Gemini API key resolution (`.env` -> `localStorage` -> inline prompt), plus 1-click fallback to Manual Entry if AI call fails or is unavailable. | API key state, network state, error responses | Explanatory error card, API key entry input, "Enter Manually Instead" button | Never leaves user stuck on a spinner or broken screen | R3, Task 3 Fallback Spec |
| 16 | **R4: Navigation Integration** | Desktop Sidebar Tab & Alert Badge | Adds "Inventory" navigation tab to desktop `Sidebar.tsx` with dynamic badge showing count of low-stock and out-of-stock items. | `activeTab`, `setActiveTab`, `lowStockItemCount` | Highlighted tab, badge indicator in amber/rose | Hides badge if `lowStockItemCount === 0` | R4, `Sidebar.tsx` |
| 17 | **R4: Navigation Integration** | Mobile Bottom Nav Integration | Adds inventory access to mobile navigation or mobile "More" menu with responsive touch layout. | `activeTab`, `setActiveTab`, `lowStockItemCount` | Touch-accessible navigation item | Preserves bottom padding `pb-20` for fixed nav bar | R4, `MobileNav.tsx` |
| 18 | **R4: Service Linkage** | Service Visit Parts Deductor | Enhances `RecordServiceModal.tsx` allowing technicians to select installed parts from inventory, automatically decrementing stock and auto-calculating `partsCharge`. | Selected inventory items, quantities used | Decremented stock in `inventoryItems`, populated `filtersReplaced` string, updated `partsCharge` | Warns if technician selects item with zero stock, but allows manual override | R4, `RecordServiceModal.tsx` |
| 19 | **Audit & Compliance** | Inventory Audit Ledger | Records every stock change (manual restock, AI scan intake, service usage, quantity adjustment) in `auditEvents`. | Action type, item ID, delta, previous/new count | Immutable audit document in Firestore `auditEvents` | Append-only security rules prevent tampering | `firestore.rules`, `AuditEvent` |
| 20 | **Testing & Verification** | In-Browser Business Logic Test Runner | Suite of automated unit tests embedded in `src/utils/testRunner.ts` displayed on `AutomatedTestsPage.tsx` for real-time verification. | In-browser test runner trigger | Test results table showing passed/failed assertions | Highlights regression failures in red | `AutomatedTestsPage.tsx`, `testRunner.ts` |

---

## 4. Detailed Data Schemas and Types

### 4.1 TypeScript Definitions (`src/types/index.ts`)

```typescript
// =============================================================
// INVENTORY & SPARE PARTS MANAGEMENT TYPES
// =============================================================

export type InventoryCategory =
  | 'Spun Filter'
  | 'Wound Filter'
  | 'Sediment Filter'
  | 'Carbon Block'
  | 'Pre-Carbon Filter'
  | 'Post-Carbon / Mineral'
  | 'RO Membrane'
  | 'UF Membrane'
  | 'Booster Pump'
  | 'SMPS Power Supply'
  | 'Solenoid Valve'
  | 'Flow Restrictor'
  | 'Pressure Switch'
  | 'Housing & Fittings'
  | 'Tubing & Valves'
  | 'TDS / Testing Kit'
  | 'Other Spare';

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export interface InventoryItem {
  id: string;                      // e.g. "inv_k9x1z2_a8b"
  name: string;                    // e.g. "5-Micron PP Spun Cartridge 10-inch"
  category: InventoryCategory;     // Normalized category
  quantity: number;                // Current on-hand quantity (integer >= 0)
  lowStockThreshold: number;       // Trigger point for low-stock warning (integer >= 0, default 5)
  unitCost: number;                // Procurement / purchase cost in INR (₹)
  sellingPrice: number;            // Price charged to customer in INR (₹)
  storageLocation?: string;        // e.g. "Rack A-2", "Service Van 1", "Main Shelf"
  supplierNotes?: string;          // e.g. "Wholesale Madurai RO Spares, Box of 50"
  notes?: string;                  // Technical specifications or model compatibility
  lastRestockedDate?: string;      // YYYY-MM-DD
  isSampleData?: boolean;          // Flag for demo / sample datasets
  ownerId: string;                 // Multi-tenant isolation key (e.g. "aquaplus-business")
  createdAt: string;               // ISO 8601 string
  updatedAt: string;               // ISO 8601 string
}

export interface InventoryTransaction {
  id: string;                      // e.g. "itx_l2m3n4_c5d"
  itemId: string;                  // Reference to InventoryItem.id
  itemName: string;                // Denormalized name for ledger audit
  category: InventoryCategory;
  type: 'manual_create' | 'restock' | 'service_usage' | 'adjustment' | 'manual_delete';
  quantityChange: number;          // Positive for additions, negative for deductions
  previousQuantity: number;
  newQuantity: number;
  unitCostSnapshot?: number;
  serviceRecordId?: string;        // Linked service record if deducted during service
  invoiceNumber?: string;          // Linked invoice number if restocked via scan
  reason: string;                  // e.g. "Scanned Supplier Bill #AP-4019", "Used in Service SR-102"
  ownerId: string;
  timestamp: string;               // ISO 8601 string
}

export interface InventoryMetrics {
  totalSkus: number;
  totalQuantity: number;
  totalValuationCost: number;      // Sum of (quantity * unitCost)
  totalValuationRetail: number;    // Sum of (quantity * sellingPrice)
  inStockCount: number;
  lowStockCount: number;
  outOfStockCount: number;
}

// -------------------------------------------------------------
// GEMINI VISION SCANNING TYPES
// -------------------------------------------------------------

export type ScanDocumentType = 'physical_parts' | 'supplier_invoice' | 'unrecognized';

export interface ScannedDetectedItem {
  id: string;                      // Temporary UUID for review table key
  rawDetectedName: string;         // Raw text from vision model
  suggestedName: string;           // Cleaned RO part name
  category: InventoryCategory;     // Inferred category
  quantity: number;                // Detected quantity (defaults to 1 if uncertain)
  unitCost?: number;               // Detected unit price in INR
  confidence: number;              // 0.0 to 1.0 confidence score
  notes?: string;                  // Parsing notes / bounding details
  
  // User review state
  selectedAction: 'create_new' | 'increment_existing' | 'discard';
  matchedExistingItemId?: string;  // If matched to an existing InventoryItem
  userEditedName: string;
  userEditedCategory: InventoryCategory;
  userEditedQuantity: number;
  userEditedUnitCost: number;
  userEditedSellingPrice: number;
  userEditedLocation: string;
  includedInImport: boolean;       // Checkbox state in review UI
}

export interface InventoryScanResult {
  scanType: ScanDocumentType;
  supplierName?: string;           // Extracted supplier/vendor name from invoice
  invoiceNumber?: string;          // Extracted bill number
  invoiceDate?: string;            // Extracted date in YYYY-MM-DD
  totalInvoiceAmount?: number;     // Grand total printed on invoice
  detectedItems: ScannedDetectedItem[];
  confidenceSummary?: string;
  processingTimeMs: number;
}
```

---

### 4.2 Firestore Collection & Security Rules Specification

#### Document Path: `/inventoryItems/{itemId}`
```javascript
// Firestore Rule Validator
function isValidInventoryItem(data) {
  return data.keys().hasOnly([
    'id', 'name', 'category', 'quantity', 'lowStockThreshold', 
    'unitCost', 'sellingPrice', 'storageLocation', 'supplierNotes', 
    'notes', 'lastRestockedDate', 'isSampleData', 'ownerId', 
    'createdAt', 'updatedAt'
  ]) &&
  data.name is string && data.name.size() >= 1 && data.name.size() <= 150 &&
  data.category is string && data.category.size() <= 60 &&
  data.quantity is number && data.quantity >= 0 && data.quantity <= 100000 &&
  data.lowStockThreshold is number && data.lowStockThreshold >= 0 && data.lowStockThreshold <= 10000 &&
  data.unitCost is number && data.unitCost >= 0 && data.unitCost <= 1000000 &&
  data.sellingPrice is number && data.sellingPrice >= 0 && data.sellingPrice <= 1000000 &&
  data.ownerId is string && data.ownerId.size() <= 128 &&
  (!('storageLocation' in data) || (data.storageLocation is string && data.storageLocation.size() <= 100)) &&
  (!('notes' in data) || (data.notes is string && data.notes.size() <= 500));
}

// Collection Rule in firestore.rules
match /inventoryItems/{itemId} {
  allow get: if isValidId(itemId) && isOwner(existing().ownerId);
  allow list: if isAuthorizedOwnerAccount();
  allow create: if isValidId(itemId) &&
                  isOwner(incoming().ownerId) &&
                  isValidInventoryItem(incoming());
  allow update: if isValidId(itemId) &&
                  isOwner(existing().ownerId) &&
                  incoming().ownerId == existing().ownerId &&
                  incoming().get('isSampleData', false) == existing().get('isSampleData', false) &&
                  isValidInventoryItem(incoming());
  allow delete: if isValidId(itemId) && isOwner(existing().ownerId);
}
```

---

## 5. Low-Stock Alerting & Inventory Analytics Logic

### 5.1 Status Calculation Formula

For any `item: InventoryItem`:
```typescript
export function computeStockStatus(quantity: number, threshold: number): StockStatus {
  const safeQuantity = Number.isFinite(quantity) ? Math.max(0, quantity) : 0;
  const safeThreshold = Number.isFinite(threshold) ? Math.max(0, threshold) : 5;
  
  if (safeQuantity === 0) {
    return 'out_of_stock';
  }
  if (safeQuantity <= safeThreshold) {
    return 'low_stock';
  }
  return 'in_stock';
}
```

### 5.2 UI Presentation & Visual Design Tokens

| Status | Badge Background | Badge Text | Border | Icon | Label | Semantic Meaning |
|---|---|---|---|---|---|---|
| `out_of_stock` | `bg-[#FFF0F0]` / `bg-rose-50` | `text-[#D9383A]` / `text-rose-700` | `border-[#FBC4C4]` / `border-rose-200` | `AlertOctagon` | **Out of Stock** (0 left) | Immediate reorder required; blocking service visits |
| `low_stock` | `bg-[#FFF9EB]` / `bg-amber-50` | `text-[#B45309]` / `text-amber-800` | `border-[#FDE68A]` / `border-amber-200` | `AlertTriangle` | **Low Stock** (≤ threshold) | Buffer inventory consumed; reorder advised |
| `in_stock` | `bg-[#F0FDF4]` / `bg-emerald-50` | `text-[#15803D]` / `text-emerald-800` | `border-[#BBF7D0]` / `border-emerald-200` | `CheckCircle2` | **In Stock** | Healthy operational inventory |

### 5.3 KPI Summary Widgets Specification

Rendered at top of `InventoryPage`:
1. **Total Stock Valuation (Cost vs Retail):**
   - Cost Valuation: `Σ (quantity * unitCost)` displayed formatted in INR (e.g. `₹48,250`)
   - Retail Realization: `Σ (quantity * sellingPrice)` displayed formatted in INR (e.g. `₹82,400`)
2. **Total Quantity on Hand:** Total physical components count (`Σ quantity`).
3. **Reorder Alerts Indicator:** Highlighted card showing `lowStockCount + outOfStockCount`. If `> 0`, card displays an amber/red border with quick-filter click handler: *"Filter Needs Reorder"*.

---

## 6. Gemini Vision AI Image Scanning Specification

### 6.1 Architecture & Multimodal Pipeline

```
[Camera Capture / Photo Upload]
             │
             ▼
[Canvas Pre-Processor]
  - Max dimensions: 1600px x 1600px
  - JPEG compression: 0.85 quality
  - Output: Base64 data string (<1.2MB)
             │
             ▼
[API Key Discovery Service]
  - Tier 1: import.meta.env.VITE_GEMINI_API_KEY
  - Tier 2: localStorage('aquaplus_gemini_api_key')
  - Tier 3: User interactive key input modal
             │
             ▼
[Gemini Vision Client (@google/genai)]
  - Model: gemini-2.5-flash (fast, multimodal, structured JSON)
  - Config: responseMimeType="application/json", responseJsonSchema
             │
             ▼
[Structured Response Extraction & Fuzzy Matcher]
  - Matches detected names against existing items in DB (Levenshtein / Token similarity)
  - Pre-populates matched existing item ID and suggested action
             │
             ▼
[Review & Confirmation Modal]
  - User reviews side-by-side with photo thumbnail
  - Edits quantities, prices, categories, or toggles action
             │
             ▼
[Batch Inventory Commit]
  - Increments stock of existing items
  - Creates newly discovered SKUs
  - Records transaction in audit log
```

### 6.2 Pre-processing & Canvas Resizing Specification

```typescript
export async function prepareImageForGemini(file: File): Promise<{ base64Data: string; mimeType: string }> {
  // Validate MIME type
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
  if (!validTypes.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|webp|heic)$/i)) {
    throw new Error('Unsupported image format. Please upload a JPEG, PNG, or WebP photo.');
  }

  // File size guard
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('Image size is too large (max 20MB).');
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));

    img.onload = () => {
      const maxDim = 1600;
      let { width, height } = img;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to obtain canvas rendering context.'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const base64Data = dataUrl.split(',')[1];
      resolve({ base64Data, mimeType: 'image/jpeg' });
    };

    img.onerror = () => reject(new Error('Failed to decode image. Please check the file.'));
    reader.readAsDataURL(file);
  });
}
```

### 6.3 Gemini Vision AI Prompt & Structured Schema

Using the official `@google/genai` SDK:

```typescript
import { GoogleGenAI, Type } from '@google/genai';

const INVENTORY_VISION_SYSTEM_INSTRUCTION = `
You are the expert RO Water Purifier Parts & Invoice Scanner for AquaPlus Service OS in Madurai, India.
Your task is to analyze photos of either:
1. Physical RO water purifier spare parts laid out on a workshop bench, floor, or shelf.
2. Printed or handwritten wholesale supplier invoices, tax invoices, purchase orders, or delivery challans from RO spare suppliers (often in English or English/Tamil bilingual bills).

Standard RO spare parts include:
- Spun Filter (PP Spun 5µ 10-inch, 20-inch, Jumbo)
- Wound Filter (Sediment yarn wound)
- Sediment Filter (Inline sediment cartridge)
- Carbon Block (CTO Carbon block 10")
- Pre-Carbon Filter (GAC inline carbon)
- Post-Carbon / Mineral (Post-carbon, mineral cartridge, alkaline bio)
- RO Membrane (TFC 75 GPD, 80 GPD, 100 GPD, 150 GPD, 300 GPD)
- UF Membrane (Hollow fiber ultrafiltration)
- Booster Pump (24V, 36V, 48V, 75 GPD, 100 GPD e.g. Kemflo, E-Chen, Deng Yuan, Aqua Plus)
- SMPS Power Supply (24V 2.5A, 36V 3A power adapters)
- Solenoid Valve (SV 24V / 36V DC push-fit)
- Flow Restrictor (FR 450, FR 600, FR 800)
- Pressure Switch (Low pressure switch LPS, high pressure switch HPS)
- Housing & Fittings (10" pre-filter bowl, elbow connectors, tees)
- Tubing & Valves (1/4" and 3/8" RO tubes, brass inlet ball valve)
- TDS / Testing Kit (Digital TDS meter, pH testing reagent)

Instructions:
- If analyzing physical parts: count each visible distinct unit or package. Deduce the exact category and provide a descriptive name.
- If analyzing an invoice/bill: extract line items with item name, quantity, unit rate/cost in INR. Extract supplier name, invoice number, and date if visible.
- If the image does not show RO spare parts or a supplier bill: mark scanType as "unrecognized" and return an empty list.
`;

export const GEMINI_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    scanType: {
      type: Type.STRING,
      description: 'One of: "physical_parts", "supplier_invoice", or "unrecognized"',
    },
    supplierName: {
      type: Type.STRING,
      description: 'Name of the supplier or wholesale vendor if scanned from an invoice',
    },
    invoiceNumber: {
      type: Type.STRING,
      description: 'Invoice number, bill number, or challan number if visible',
    },
    invoiceDate: {
      type: Type.STRING,
      description: 'Date printed on invoice in YYYY-MM-DD or string',
    },
    totalInvoiceAmount: {
      type: Type.NUMBER,
      description: 'Grand total bill amount in INR if visible',
    },
    detectedItems: {
      type: Type.ARRAY,
      description: 'List of detected parts or line items',
      items: {
        type: Type.OBJECT,
        properties: {
          rawDetectedName: {
            type: Type.STRING,
            description: 'Verbatim text or visual description from photo',
          },
          suggestedName: {
            type: Type.STRING,
            description: 'Standardized name of the spare part',
          },
          category: {
            type: Type.STRING,
            description: 'Standard category of the spare part',
          },
          quantity: {
            type: Type.NUMBER,
            description: 'Count or quantity (integer >= 1)',
          },
          unitCost: {
            type: Type.NUMBER,
            description: 'Unit procurement cost in INR if specified on invoice',
          },
          confidence: {
            type: Type.NUMBER,
            description: 'Confidence score from 0.0 to 1.0',
          },
          notes: {
            type: Type.STRING,
            description: 'Specifications like 75 GPD, 24V, 5 micron, etc.',
          },
        },
        required: ['rawDetectedName', 'suggestedName', 'category', 'quantity'],
      },
    },
  },
  required: ['scanType', 'detectedItems'],
};
```

---

## 7. Review & Confirmation Modal Specification

When Gemini Vision completes its analysis, the application presents the **Review & Confirmation Modal**:

### 7.1 Layout & Components
1. **Header Banner:**
   - Scan Type badge: "Supplier Invoice Detected" or "Physical Spare Parts Detected".
   - Invoice Metadata (if applicable): Supplier Name, Invoice #, Invoice Date, Total ₹.
2. **Side-by-Side / Stacked Image Preview:**
   - Thumbnail of the uploaded photo with expand/zoom capability so the user can cross-verify printed lines or part labels against the form.
3. **Editable Items Table (Desktop) / Cards (Mobile):**
   Each detected item contains:
   - **Selection Checkbox:** Checked by default. Unchecking excludes the item from intake.
   - **Item Name:** Text input pre-filled with `suggestedName`.
   - **Category:** Dropdown pre-selected with `category`.
   - **Quantity:** Numeric input pre-filled with `quantity`. Minimum 1.
   - **Unit Cost (₹):** Numeric input pre-filled with extracted `unitCost` (or default ₹0).
   - **Selling Price (₹):** Auto-suggested based on unit cost with standard markup (e.g. `unitCost * 1.5` rounded) or manually entered.
   - **Action Mode Selector:**
     - `Create as New Item`: Adds a new SKU to inventory.
     - `Increment Existing Item`: Select existing SKU from searchable dropdown. The scanned quantity is added to the current on-hand quantity.
   - **Discard Button (`Trash2` icon):** Deletes row from staging table.
4. **Footer Actions:**
   - `+ Add Another Item Manually` button.
   - `Cancel / Discard All` button.
   - `Apply to Inventory (X items)` primary button: Executes batch transaction, presents success summary toast, and navigates to inventory catalog.

---

## 8. Error Handling, Fallback & Resilience Matrix

| Error Condition | Trigger Event | Observable UI Behavior | Fallback / Recovery Action |
|---|---|---|---|
| **Missing API Key** | `GEMINI_API_KEY` not in env and not in `localStorage` | Modal displays an amber configuration warning: *"Gemini API Key Required"*. | Provides inline password-masked input to save API key into `localStorage` with 1-click test, PLUS an immediate *"Enter Items Manually"* fallback button. |
| **Invalid API Key (401/403)** | API key expired, invalid, or lacks Generative Language API enablement | Alert banner: *"Authentication Error: Invalid Gemini API key"*. | Option to update API key; manual entry button. |
| **Network Timeout / Disconnected** | Device offline, mobile signal lost, or API timeout (>25s) | Loading spinner ceases; error toast: *"Network connection timed out while reaching Gemini Vision. Please check your connection."* | Offers *"Retry"* button and *"Switch to Manual Entry"* button. |
| **Rate Limit Exceeded (429)** | Exceeded Gemini free tier quota (RPM or TPM) | Error notification: *"Gemini API rate limit reached. Please wait a moment before trying again."* | 30-second backoff timer with countdown, plus manual entry fallback. |
| **Blurry / Dark / Unrecognized Photo** | Camera out of focus, poor lighting, or photo unrelated to RO equipment | Informative banner: *"Unable to recognize RO parts or invoice in this image. Please take a clearer photo with better lighting or enter items manually."* | Prompts user to take a fresh photo or click *"Enter Manually"*. |
| **Camera Permission Denied (Mobile/Capacitor)** | User rejects camera permission in Android / iOS / Browser prompt | Toast notification: *"Camera permission is required to capture photos. You can also select an existing photo from your file manager."* | Triggers file picker fallback input `<input type="file" accept="image/*">` without the `capture` attribute. |
| **Oversized / Non-Image File** | User selects a PDF, video, or >20MB raw file | Immediate client-side validation error before network call: *"Please select a valid image file (JPEG, PNG, WebP) under 20MB."* | Clears file selection; no API call initiated. |

---

## 9. Service Record Integration Specification (Parts Usage Linkage)

Requirement **R4** mandates navigation and service integration:
*"The team may decide how parts usage links with service records."*

### 9.1 Linkage Architecture & Workflow

1. **In `RecordServiceModal.tsx`:**
   - When technician records a completed visit, an interactive **"Inventory Parts Used"** section allows selecting one or more items from the current `inventoryItems` catalog.
   - Each selected part row allows specifying:
     - Part SKU (dropdown with real-time stock indicator, e.g. *"5µ Spun Filter (14 in stock)"*).
     - Quantity used (default 1).
     - Selling price (auto-populated from `sellingPrice` of selected item).
2. **Auto-Population of Service Charges & Description:**
   - `partsCharge` in `RecordServiceModal` automatically sums `Σ (quantityUsed * sellingPrice)`.
   - `filtersReplaced` string is automatically generated or appended with selected parts (e.g. *"5µ Spun Filter (x1), Pre-Carbon Block (x1)"*).
   - `totalAmount` automatically updates (`serviceCharge + partsCharge`).
3. **Stock Decrement & Audit Integrity:**
   - Upon form submission, each used item's `quantity` is decremented in Firestore:
     ```typescript
     newQuantity = Math.max(0, currentQuantity - quantityUsed);
     ```
   - An `inventoryTransaction` record is written linking `serviceRecordId`, capturing audit traceability.
4. **Backward Compatibility Guarantee:**
   - Because `filtersReplaced: string` and `partsCharge: number` remain standard fields on `ServiceRecord`, existing Firestore rules (`isValidServiceRecord`) and audit tests pass with 100% compatibility.

---

## 10. Multi-Platform & Mobile Shell Compatibility

### 10.1 Web Browser vs Capacitor Mobile Matrix

| Dimension | Desktop Web Browser (Chrome, Firefox, Safari) | Capacitor Android Mobile Shell |
|---|---|---|
| **Primary Layout** | Multi-column table with sticky table headers and sortable columns | Touch-friendly cards with tap-to-expand details and bottom action sheets |
| **Navigation** | Left-hand desktop `Sidebar.tsx` with expanded/collapsed state | Fixed bottom `MobileNav.tsx` with dedicated inventory icon + badge |
| **Touch Targets** | Standard mouse cursor targets (32px-36px) | Minimum touch target size 48px x 48px; active scale micro-interactions |
| **Camera Capture** | Standard OS file upload dialog or webcam stream | Opens native Android camera or Gallery via `<input type="file" accept="image/*" capture="environment">` |
| **Scroll & Overlap** | Standard desktop scrolling with customized thin scrollbar | Layout container includes `pb-24` ensuring fixed bottom navigation bar never obscures content or action buttons |
| **Number Inputs** | Mouse steppers / keyboard entry | `inputMode="numeric"` or `inputMode="decimal"` to invoke native mobile number pad |

---

## 11. Initial Seed Data Catalog (Madurai RO Market)

To provide instant usability in demo and development modes:

```typescript
export const INITIAL_INVENTORY_SEEDS: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt' | 'ownerId'>[] = [
  {
    name: '5-Micron PP Spun Filter Cartridge (10-inch)',
    category: 'Spun Filter',
    quantity: 24,
    lowStockThreshold: 10,
    unitCost: 45,
    sellingPrice: 150,
    storageLocation: 'Rack A-1 (Main Shelf)',
    notes: 'Standard pre-filter for all domestic RO units. Replace every 60-90 days in Madurai water.',
    lastRestockedDate: '2026-11-01',
    isSampleData: true,
  },
  {
    name: 'Granular Activated Pre-Carbon Filter (10-inch)',
    category: 'Pre-Carbon Filter',
    quantity: 12,
    lowStockThreshold: 5,
    unitCost: 110,
    sellingPrice: 280,
    storageLocation: 'Rack A-2',
    notes: 'Chlorine and odor removal before RO membrane.',
    lastRestockedDate: '2026-10-25',
    isSampleData: true,
  },
  {
    name: 'Extruded Carbon Block Filter (CTO 10-inch)',
    category: 'Carbon Block',
    quantity: 8,
    lowStockThreshold: 5,
    unitCost: 130,
    sellingPrice: 320,
    storageLocation: 'Rack A-3',
    notes: 'High-density post-sediment carbon filter.',
    lastRestockedDate: '2026-10-20',
    isSampleData: true,
  },
  {
    name: '75 GPD TFC RO Membrane Cartridge (Aqua Plus / Dow)',
    category: 'RO Membrane',
    quantity: 4,
    lowStockThreshold: 5,
    unitCost: 650,
    sellingPrice: 1450,
    storageLocation: 'Secured Cabinet B-1',
    notes: 'Thin Film Composite membrane for TDS up to 1500 ppm. 90-95% salt rejection.',
    lastRestockedDate: '2026-10-15',
    isSampleData: true,
  },
  {
    name: '100 GPD High-TDS RO Membrane (Commercial / Hard Water)',
    category: 'RO Membrane',
    quantity: 2,
    lowStockThreshold: 3,
    unitCost: 850,
    sellingPrice: 1850,
    storageLocation: 'Secured Cabinet B-2',
    notes: 'Specialized for high TDS borewell water in Madurai rural areas (>2000 ppm).',
    lastRestockedDate: '2026-09-30',
    isSampleData: true,
  },
  {
    name: 'RO Booster Pump 24V DC 75 GPD (Aqua Plus / Kemflo)',
    category: 'Booster Pump',
    quantity: 3,
    lowStockThreshold: 2,
    unitCost: 1150,
    sellingPrice: 2200,
    storageLocation: 'Heavy Storage Rack C-1',
    notes: 'High pressure diaphragm pump for domestic RO.',
    lastRestockedDate: '2026-10-10',
    isSampleData: true,
  },
  {
    name: 'SMPS Power Adapter 24V 2.5A',
    category: 'SMPS Power Supply',
    quantity: 5,
    lowStockThreshold: 3,
    unitCost: 280,
    sellingPrice: 650,
    storageLocation: 'Electrical Shelf D-1',
    notes: 'Universal power supply for booster pump and SV.',
    lastRestockedDate: '2026-10-12',
    isSampleData: true,
  },
  {
    name: 'Push-Fit Solenoid Valve (SV) 24V DC 1/4-inch',
    category: 'Solenoid Valve',
    quantity: 6,
    lowStockThreshold: 4,
    unitCost: 160,
    sellingPrice: 380,
    storageLocation: 'Bin E-1',
    notes: 'Inlet water cut-off solenoid valve.',
    lastRestockedDate: '2026-10-18',
    isSampleData: true,
  },
  {
    name: 'Flow Restrictor FR-450 (Push-Fit)',
    category: 'Flow Restrictor',
    quantity: 15,
    lowStockThreshold: 5,
    unitCost: 40,
    sellingPrice: 120,
    storageLocation: 'Bin E-2',
    notes: 'Waste water flow restrictor matched for 75 GPD membrane.',
    lastRestockedDate: '2026-11-02',
    isSampleData: true,
  },
  {
    name: 'Post-Carbon Mineral & Alkaline Cartridge',
    category: 'Post-Carbon / Mineral',
    quantity: 5,
    lowStockThreshold: 4,
    unitCost: 190,
    sellingPrice: 450,
    storageLocation: 'Rack A-4',
    notes: 'Restores essential minerals (Ca, Mg) and adjusts pH to 7.5-8.2.',
    lastRestockedDate: '2026-10-28',
    isSampleData: true,
  },
  {
    name: 'Digital Handheld TDS Meter (0-9999 ppm)',
    category: 'TDS / Testing Kit',
    quantity: 1,
    lowStockThreshold: 2,
    unitCost: 220,
    sellingPrice: 450,
    storageLocation: 'Technician Tool Kit Locker',
    notes: 'Digital tester used for customer water testing during visits.',
    lastRestockedDate: '2026-09-15',
    isSampleData: true,
  },
  {
    name: 'Pre-Filter Housing Bowl 10-inch Heavy Duty',
    category: 'Housing & Fittings',
    quantity: 0,
    lowStockThreshold: 2,
    unitCost: 240,
    sellingPrice: 550,
    storageLocation: 'Rack C-2',
    notes: 'Transparent or white food-grade PP housing for external spun filter.',
    lastRestockedDate: '2026-08-20',
    isSampleData: true,
  },
];
```

---

## 12. Edge Cases & Observed Failure Behaviors

| # | Feature | Input / Condition | Observed / Specified Behavior |
|---|---|---|---|
| 1 | Low-Stock Logic | `quantity = 0` and `lowStockThreshold = 0` | Evaluated strictly as `out_of_stock` because quantity is zero, displaying the red badge and alerting reorder. |
| 2 | Low-Stock Logic | `quantity = 5` and `lowStockThreshold = 5` | Evaluated as `low_stock` (since `quantity <= lowStockThreshold`), displaying the amber badge. |
| 3 | Stock Adjustment | User attempts to decrement stock when `quantity = 0` | UI disables the "-1" button; manual entry validation prevents negative values and clamps minimum to 0. |
| 4 | Manual Item Entry | Negative numbers entered for `quantity`, `unitCost`, or `sellingPrice` | Form validation rejects submit, displays inline red message: *"Value cannot be negative"*. |
| 5 | Vision Scanning | Blurry / out-of-focus photo where text/labels cannot be read | Model returns `scanType: "unrecognized"` with empty list. Modal shows friendly notice: *"No items clearly detected. Please retake photo with better lighting or enter manually."* |
| 6 | Vision Scanning | Photo of non-RO object (e.g. car, coffee mug, cat) | Model identifies lack of RO spare parts or invoice, returns `scanType: "unrecognized"`. Clear error notification shown with manual entry prompt. |
| 7 | Vision Scanning | Tamil handwritten wholesale bill / challan with mixed English terms | Gemini Vision prompt extracts items using bilingual awareness (e.g. "ஸ்பன் பில்டர் / Spun Filter", "மோட்டார் / Motor"). Line item names normalized to standard English category. |
| 8 | Vision Scanning | Duplicate line items on scanned supplier bill | Staging table groups items by suggested SKU or presents distinct rows with clear quantities, allowing user to merge or keep separate. |
| 9 | Vision Scanning | Gemini API quota exhausted (HTTP 429) | UI catches error code 429, displays non-technical notice: *"AI service is temporarily busy. Please wait 30 seconds or click Enter Manually."* |
| 10 | Vision Scanning | Image orientation upside-down or sideways | Canvas pre-processor preserves EXIF orientation; Gemini multimodal vision handles rotated text natively. |
| 11 | Vision Scanning | Network drops mid-upload / request timeout | Promise timeout aborts after 25s, shows: *"Network request timed out. Please check your connection."* Offers Retry and Manual Entry. |
| 12 | Service Visit Linkage | Technician selects an item that is currently Out of Stock (`quantity = 0`) | System displays amber warning: *"Warning: This part is listed as Out of Stock in your inventory"*, but permits technician to record usage (setting inventory to 0 or notifying stock discrepancy). |
| 13 | Service Visit Linkage | Deleting a historical service record | Does NOT automatically restore inventory unless explicit inventory reconciliation is requested, preventing historic financial ledger corruption. |
| 14 | Multi-Tenant Data | Switching owner accounts or logging out | Real-time snapshot listener unsubscribes immediately; inventory state resets to empty array. No cross-tenant data leakage. |
| 15 | Mobile Offline / PWA | User opens Inventory tab while offline | Firestore offline cache serves last synced inventory items with a visual banner: *"Offline — Viewing cached inventory"*. |

---

## 13. Acceptance Criteria & Test Matrix

### 13.1 Automated Test Suites (Node.js & In-Browser)

To be added to `tests/regressions.test.ts` and `src/utils/testRunner.ts`:

```typescript
// Test 1: Stock Status Computation Invariants
test('computeStockStatus correctly categorizes in_stock, low_stock, and out_of_stock', () => {
  assert.equal(computeStockStatus(0, 5), 'out_of_stock');
  assert.equal(computeStockStatus(1, 5), 'low_stock');
  assert.equal(computeStockStatus(5, 5), 'low_stock');
  assert.equal(computeStockStatus(6, 5), 'in_stock');
  assert.equal(computeStockStatus(100, 10), 'in_stock');
  assert.equal(computeStockStatus(-2, 5), 'out_of_stock'); // Defensive handling
});

// Test 2: Inventory Metrics Calculation
test('computeInventoryMetrics aggregates total quantity, costs, and alert counts', () => {
  const items: InventoryItem[] = [
    { id: '1', name: 'Item 1', category: 'Spun Filter', quantity: 10, lowStockThreshold: 5, unitCost: 50, sellingPrice: 100, ownerId: 'o1', createdAt: '', updatedAt: '' },
    { id: '2', name: 'Item 2', category: 'RO Membrane', quantity: 2, lowStockThreshold: 5, unitCost: 500, sellingPrice: 1000, ownerId: 'o1', createdAt: '', updatedAt: '' },
    { id: '3', name: 'Item 3', category: 'Booster Pump', quantity: 0, lowStockThreshold: 2, unitCost: 1000, sellingPrice: 2000, ownerId: 'o1', createdAt: '', updatedAt: '' },
  ];
  const metrics = computeInventoryMetrics(items);
  assert.equal(metrics.totalSkus, 3);
  assert.equal(metrics.totalQuantity, 12);
  assert.equal(metrics.totalValuationCost, 10 * 50 + 2 * 500 + 0 * 1000); // 1500
  assert.equal(metrics.totalValuationRetail, 10 * 100 + 2 * 1000 + 0 * 2000); // 3000
  assert.equal(metrics.inStockCount, 1);
  assert.equal(metrics.lowStockCount, 1);
  assert.equal(metrics.outOfStockCount, 1);
});

// Test 3: Search and Filter Functionality
test('filterInventoryItems filters accurately by search term, category, and status', () => {
  const items: InventoryItem[] = [
    { id: '1', name: '5-Micron Spun Filter', category: 'Spun Filter', quantity: 10, lowStockThreshold: 5, unitCost: 45, sellingPrice: 150, storageLocation: 'Rack A1', ownerId: 'o1', createdAt: '', updatedAt: '' },
    { id: '2', name: '75 GPD Membrane', category: 'RO Membrane', quantity: 3, lowStockThreshold: 5, unitCost: 650, sellingPrice: 1450, storageLocation: 'Rack B2', ownerId: 'o1', createdAt: '', updatedAt: '' },
  ];
  
  // Search query match
  assert.equal(filterInventoryItems(items, 'spun', 'all', 'all').length, 1);
  assert.equal(filterInventoryItems(items, 'rack b2', 'all', 'all').length, 1);
  
  // Status filter match
  assert.equal(filterInventoryItems(items, '', 'all', 'low_stock').length, 1);
  assert.equal(filterInventoryItems(items, '', 'all', 'in_stock').length, 1);
  
  // Category filter match
  assert.equal(filterInventoryItems(items, '', 'Spun Filter', 'all').length, 1);
  assert.equal(filterInventoryItems(items, '', 'Booster Pump', 'all').length, 0);
});

// Test 4: Vision Response Parsing & Normalization
test('parseGeminiScanResponse normalizes structured JSON and provides fallback for malformed response', () => {
  const validJson = JSON.stringify({
    scanType: 'supplier_invoice',
    supplierName: 'Madurai RO Spares',
    invoiceNumber: 'INV-1092',
    detectedItems: [
      { rawDetectedName: 'Spun 5M', suggestedName: '5-Micron Spun Filter', category: 'Spun Filter', quantity: 20, unitCost: 42 }
    ]
  });
  const parsed = parseGeminiScanResponse(validJson);
  assert.equal(parsed.scanType, 'supplier_invoice');
  assert.equal(parsed.detectedItems.length, 1);
  assert.equal(parsed.detectedItems[0].quantity, 20);
  assert.equal(parsed.detectedItems[0].suggestedName, '5-Micron Spun Filter');

  // Fallback for markdown wrapped JSON
  const markdownJson = `\`\`\`json\n${validJson}\n\`\`\``;
  const parsedMd = parseGeminiScanResponse(markdownJson);
  assert.equal(parsedMd.detectedItems.length, 1);

  // Fallback for invalid JSON string
  const invalidResult = parseGeminiScanResponse('not-json');
  assert.equal(invalidResult.scanType, 'unrecognized');
  assert.equal(invalidResult.detectedItems.length, 0);
});
```

---

## 14. Verification & Validation Protocol

The feature implementation must be verified against the following test checklist:
1. **CRUD Testing:**
   - Create a new inventory item with custom category, location, and cost. Verify real-time presence in Firestore.
   - Edit item selling price and low-stock threshold. Verify update reflection.
   - Quick +1 and -1 stock steppers update quantity and fire Firestore updates.
   - Delete item with confirmation dialog.
2. **Low-Stock Alert Verification:**
   - Set item quantity equal to low-stock threshold; verify amber badge renders.
   - Set item quantity to 0; verify red out-of-stock badge renders.
   - Verify Sidebar and MobileNav badge reflects the count of low-stock + out-of-stock items.
3. **Image Scanning with Gemini Vision:**
   - Test with sample photo of physical spare parts (e.g. 3 filters on bench); verify correct item detection and quantities.
   - Test with sample photo of supplier bill/invoice; verify invoice number, vendor name, item rows, quantities, and rates are extracted.
   - Test with blank/unrelated image; verify graceful fallback notification appears without crashing.
   - Test with missing API key; verify configuration prompt and 1-click manual entry button.
   - Verify review modal allows editing values, toggling "Add as New" vs "Increment Existing", and applying changes to inventory.
4. **Service Visit Linkage:**
   - Open Record Service modal. Select installed parts from inventory.
   - Verify `partsCharge` auto-calculates from item price * quantity.
   - Verify `filtersReplaced` auto-populates.
   - Submit service visit; verify selected inventory items have their stock decremented by the recorded quantity.
5. **Mobile Responsiveness:**
   - Verify layout on 375px mobile viewport and Capacitor Android shell. Verify bottom navigation does not overlap modal or action buttons.
