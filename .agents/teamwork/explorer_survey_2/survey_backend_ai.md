# Backend, Database & AI Vision Survey Report: AquaPlus Service OS Inventory Management

**Date:** 2026-11-07  
**Author:** Backend, Database & AI Vision Explorer (`explorer_survey_2`)  
**Mission:** Investigate the data layer, persistence strategy, AI vision service integration, camera/file upload mechanisms, and service record linkage in AquaPlus Service OS to inform the production implementation of the Inventory Management feature.

---

## 1. Executive Summary

AquaPlus Service OS is a production TypeScript/React single-page application bundled with Vite and styled with Tailwind CSS, supporting both web browsers and a native Android Capacitor wrapper. Data persistence is backed by Google Cloud Firestore with real-time reactive subscriptions on the client and `firebase-admin` on the Node.js Express server. 

The application architecture strictly isolates third-party API credentials (`GEMINI_API_KEY`, `WHATSAPP_ACCESS_TOKEN`, `RESEND_API_KEY`) on the server side (`src/server/`). The official Google GenAI SDK (`@google/genai` v2.4.0) is already installed in `package.json`, and `metadata.json` explicitly mandates `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`.

To implement the Inventory Management feature cleanly and securely:
1. **Persistence:** Introduce a new Firestore collection `inventory` with an `isValidInventoryItem` rule added to `firestore.rules` (which strictly enforces `hasOnly` schema validation).
2. **AI Vision:** Implement a server-side endpoint `POST /api/inventory/scan` utilizing `@google/genai` with model `gemini-3.8-flash` and structured JSON schema (`responseJsonSchema`). Critically, the current 16 KB request body limit (`BODY_LIMIT_BYTES`) in `src/server/apiMiddleware.ts` must be bypassed for this endpoint to accommodate base64 image payloads (up to 10 MB).
3. **Image Capture:** Use standard HTML5 `<input type="file" accept="image/*">` (with mobile camera capture attribute and drag-and-drop on desktop) coupled with client-side canvas resizing/compression. This avoids adding native `@capacitor/camera` plugins, avoids modifying Android permissions, works seamlessly across desktop/mobile web and Capacitor WebView, and circumvents the `Permissions-Policy: camera=()` header in `server.ts`.
4. **Service Records Linkage:** Enhance `RecordServiceModal` to allow technicians to select parts from inventory, automatically populate `filtersReplaced` and `partsCharge`, and deduct inventory counts in a Firestore `writeBatch` during `recordCompletedService`.

---

## 2. Data Storage & Persistence Architecture

### 2.1 Existing Persistence Infrastructure
- **Client Firestore Client (`src/lib/firebase.ts`):**
  - Initialized with `initializeFirestore(app, { ignoreUndefinedProperties: true }, firebaseConfig.firestoreDatabaseId)`.
  - Database ID is specified in `firebase-applet-config.json` (`ai-studio-4b6f33c0-20b1-4c18-b179-368ff6878ffb`) and project ID `positive-drake-n4mm2`.
- **Server Firestore Admin (`src/server/firebaseAdmin.ts`):**
  - Uses `firebase-admin/firestore` (`getFirestore(app, FIRESTORE_DATABASE_ID)`).
- **Security Rules (`firestore.rules`):**
  - Global default-deny safety net:
    ```cel
    match /{document=**} {
      allow read, write: if false;
    }
    ```
  - Authorization check:
    ```cel
    function isAuthorizedOwnerAccount() {
      return isSignedIn() &&
        request.auth.token.email_verified == true &&
        request.auth.token.email in ['nisanth.t9c@gmail.com', 'aquaplusrosales@gmail.com', 'vishaalchinnan@gmail.com'];
    }
    ```
  - Existing Collections governed by rules:
    - `customers`: Client CRUD with validation `isValidCustomer` (lines 46–53, 108–120).
    - `serviceRecords`: Append/read/update with `isValidServiceRecord` (lines 56–65, 122–137). Deletion restricted to sample data only (`existing().isSampleData == true`).
    - `reminders`: Schedule tracking with `isValidReminder` (lines 68–75, 139–154).
    - `messageAttempts`: Idempotent audit logs, append-only (lines 78–84, 156–165).
    - `messageDeliveryStatus`: Webhook updates only (lines 167–171).
    - `ownerReports`: Daily digest reports (lines 87–91, 173–184).
    - `settings`: Business configuration singleton (lines 94–98, 186–198).
    - `auditEvents`: Append-only compliance log (lines 101–105, 200–208).
- **Field Whitelist Constraint:**
  All collections use `data.keys().hasOnly([...])`. Any unrecognized or extra field written to a document causes an immediate Firestore `PERMISSION_DENIED` error!

### 2.2 Data Access Patterns (`src/services/dbService.ts`)
- **Reactive Subscriptions:**
  The application utilizes Firestore `onSnapshot` queries wrapped in subscription functions (`subscribeCustomers`, `subscribeServiceRecords`, `subscribeReminders`).
  Subscriptions check:
  ```typescript
  if (!ownerId || ownerId === 'guest_owner') return () => {};
  ```
  In `src/App.tsx`, subscriptions are mounted within a `useEffect` triggered when `currentUser` is authenticated and `isOwner` is verified (lines 117–139).
- **Mutations:**
  Mutations use `setDoc`, `updateDoc`, and atomic `writeBatch(db)`. Operations are wrapped with `withTimeout(promise, 12000)` and routed through `handleFirestoreError` in `src/lib/firebase.ts`.
- **Sample Data Lifecycle:**
  `dbService.ts` contains `getInitialSampleDataSet(ownerId)` (lines 625–865), `seedSampleData(ownerId)` (lines 866–1025), and `purgeSampleData(ownerId)` (lines 1026–1052). All sample entities set `isSampleData: true`.

---

## 3. Proposed Inventory Data Model & Rules Specification

### 3.1 TypeScript Interface (`src/types/index.ts`)
```typescript
export type InventoryCategory =
  | 'spun_filter'
  | 'carbon_filter'
  | 'ro_membrane'
  | 'post_carbon'
  | 'booster_pump'
  | 'smps_power_supply'
  | 'solenoid_valve'
  | 'flow_restrictor'
  | 'fitting'
  | 'tubing'
  | 'accessory'
  | 'other';

export interface InventoryItem {
  id: string; // e.g. "inv_m1k3j_8f9a2"
  name: string; // e.g. "5-Micron Spun PP Filter 10 Inch"
  category: InventoryCategory;
  quantity: number; // Current stock on hand (integer >= 0)
  unitCost: number; // Purchase price in INR (number >= 0)
  sellingPrice?: number; // Standard charge to customer in INR
  lowStockThreshold: number; // Alert threshold, default e.g. 5
  unit: string; // "pcs", "set", "meters", "box"
  partNumber?: string; // Manufacturer part # or SKU
  brand?: string; // e.g. "Aqua Plus", "DOW Filmtec", "Kemflo"
  location?: string; // Shelf or bin location (e.g. "Shelf B-2")
  supplierName?: string; // Vendor name from invoice
  lastRestockedDate?: string; // YYYY-MM-DD
  notes?: string;
  isSampleData?: boolean;
  ownerId: string; // BUSINESS_OWNER_ID ("aquaplus-business")
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
```

### 3.2 Firestore Security Rule Additions (`firestore.rules`)
```cel
// Inventory Validation
function isValidInventoryItem(data) {
  return data.keys().hasOnly([
    'id', 'name', 'category', 'quantity', 'unitCost', 'sellingPrice',
    'lowStockThreshold', 'unit', 'partNumber', 'brand', 'location',
    'supplierName', 'lastRestockedDate', 'notes', 'isSampleData',
    'ownerId', 'createdAt', 'updatedAt'
  ]) &&
  data.name is string && data.name.size() >= 1 && data.name.size() <= 120 &&
  data.category is string && data.category.size() <= 60 &&
  data.quantity is number && data.quantity >= 0 &&
  data.unitCost is number && data.unitCost >= 0 &&
  data.lowStockThreshold is number && data.lowStockThreshold >= 0 &&
  data.ownerId is string && data.ownerId.size() <= 128;
}

// In match /databases/{database}/documents:
match /inventory/{itemId} {
  allow get: if isValidId(itemId) && isOwner(existing().ownerId);
  allow list: if isAuthorizedOwnerAccount();
  allow create: if isValidId(itemId) &&
                  isOwner(incoming().ownerId) &&
                  isValidInventoryItem(incoming());
  allow update: if isValidId(itemId) &&
                  isOwner(existing().ownerId) &&
                  incoming().ownerId == existing().ownerId &&
                  isValidInventoryItem(incoming());
  allow delete: if isValidId(itemId) && isOwner(existing().ownerId);
}
```

### 3.3 Data Access Functions (`src/services/dbService.ts`)
The following helper functions should be added to `dbService.ts`:
- `subscribeInventory(ownerId: string, callback: (items: InventoryItem[]) => void, onError?: (err: any) => void)`
- `addInventoryItem(data: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>, ownerId: string): Promise<string>`
- `updateInventoryItem(itemId: string, updates: Partial<InventoryItem>, ownerId: string): Promise<void>`
- `adjustInventoryQuantity(itemId: string, delta: number, ownerId: string): Promise<void>`
- `deleteInventoryItem(itemId: string, ownerId: string): Promise<void>`
- `deductInventoryForService(parts: { itemId: string; quantity: number }[], ownerId: string): Promise<void>`

---

## 4. AI Vision & Gemini Integration Pathway

### 4.1 Architecture & Current Status
- **Installed SDK:** `@google/genai` (v2.4.0) in `package.json`.
- **Environment Variables:**
  - `.env.example` line 2: `GEMINI_API_KEY="MY_GEMINI_API_KEY"`.
  - Loaded via `import 'dotenv/config'` in `server.ts` and `vite.config.ts`.
- **Architectural Policy:**
  - `metadata.json` line 5 specifies: `"majorCapabilities": ["MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API"]`.
  - API keys must NEVER be bundled in the client code or exposed through `VITE_*` env vars. All AI processing must occur on the Express/Vite server backend.
- **Client Service Wrapper:**
  - `src/services/apiService.ts` handles communication with the backend via `resolveApiUrl(...)` and passes the Firebase ID token in `Authorization: Bearer ${token}`.

### 4.2 Critical Finding: Request Body Limit in `apiMiddleware.ts`
In `src/server/apiMiddleware.ts`:
```typescript
const BODY_LIMIT_BYTES = 16_384; // 16 KB!
```
And in `readJsonBody`:
```typescript
if (size > BODY_LIMIT_BYTES) throw new Error('Request body is too large.');
```
Base64 images are typically 200 KB to 5 MB in size. A POST to `/api/inventory/scan` using the default `readJsonBody` will fail immediately with HTTP 413 `Request body is too large`.
**Resolution:**
Define a dedicated constant in `apiMiddleware.ts`:
```typescript
const SCAN_BODY_LIMIT_BYTES = 10 * 1024 * 1024; // 10 MB limit for vision uploads
```
Use `readRawBody(req, SCAN_BODY_LIMIT_BYTES)` for the `/api/inventory/scan` endpoint.

### 4.3 Server-Side Scan Handler Implementation Design
Create `src/server/geminiVisionAdapter.ts`:
```typescript
import { GoogleGenAI, Type } from '@google/genai';

export interface ScannedInventoryItem {
  name: string;
  category: string;
  quantity: number;
  unitCost?: number;
  partNumber?: string;
  brand?: string;
  confidence: number;
  notes?: string;
}

export interface InventoryScanResult {
  documentType: 'spare_part' | 'supplier_invoice' | 'unrecognized';
  confidence: number;
  supplier?: {
    name?: string;
    invoiceNumber?: string;
    invoiceDate?: string;
    totalAmount?: number;
  };
  items: ScannedInventoryItem[];
  rawSummary?: string;
}

export async function parseInventoryImageWithGemini(
  base64Data: string,
  mimeType: string = 'image/jpeg'
): Promise<InventoryScanResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `You are an expert parts and billing assistant for Aqua Plus RO Tech, a water purifier service business in Madurai, India.
Analyze this image carefully. The image is either:
1. A physical spare part or filter cartridge used in domestic or commercial RO water purifiers (e.g. Spun filter, RO membrane, carbon block, booster pump, SMPS, flow restrictor, solenoid valve).
2. A supplier bill, purchase invoice, or receipt listing spare parts, filters, quantities, and prices in Indian Rupees (INR).
3. An unrelated or unrecognized image.

Instructions:
- Identify whether this is a "spare_part", "supplier_invoice", or "unrecognized".
- For spare parts: detect the part name, category, model/specifications (e.g. 5-Micron, 75 GPD, 24V, 450cc), brand, and quantity visible (default 1). If unit price/cost is visible on packaging/label, extract it.
- For supplier invoices: extract the supplier/vendor name, invoice number, date, total amount, and all individual line items with item name, category, quantity, and unit cost.
- Standard categories: spun_filter, carbon_filter, ro_membrane, post_carbon, booster_pump, smps_power_supply, solenoid_valve, flow_restrictor, fitting, tubing, accessory, other.
- If the image cannot be identified as an RO spare part or bill, set documentType to "unrecognized", items to empty array, and explain in rawSummary.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType,
            },
          },
          { text: prompt },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: {
        type: Type.OBJECT,
        properties: {
          documentType: {
            type: Type.STRING,
            description: 'spare_part | supplier_invoice | unrecognized',
          },
          confidence: { type: Type.NUMBER, description: 'Confidence between 0 and 1' },
          supplier: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              invoiceNumber: { type: Type.STRING },
              invoiceDate: { type: Type.STRING },
              totalAmount: { type: Type.NUMBER },
            },
          },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                category: { type: Type.STRING },
                quantity: { type: Type.INTEGER },
                unitCost: { type: Type.NUMBER },
                partNumber: { type: Type.STRING },
                brand: { type: Type.STRING },
                confidence: { type: Type.NUMBER },
                notes: { type: Type.STRING },
              },
              required: ['name', 'category', 'quantity'],
            },
          },
          rawSummary: { type: Type.STRING },
        },
        required: ['documentType', 'confidence', 'items'],
      },
    },
  });

  const parsed = JSON.parse(response.text || '{}');
  return parsed as InventoryScanResult;
}
```

### 4.4 Express Endpoint (`src/server/apiMiddleware.ts`)
```typescript
if (url.pathname === '/api/inventory/scan' && req.method === 'POST') {
  if (!owner) {
    sendJson(res, 401, { error: 'An authorized owner account is required to scan inventory.' });
    return;
  }
  const rawBody = await readRawBody(req, SCAN_BODY_LIMIT_BYTES);
  let payload: { image: string; mimeType?: string };
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    sendJson(res, 400, { error: 'Malformed JSON payload.' });
    return;
  }
  if (!payload.image || typeof payload.image !== 'string') {
    sendJson(res, 400, { error: 'Image base64 data is required.' });
    return;
  }
  // Strip data URL header if present (e.g. "data:image/jpeg;base64,")
  const base64Data = payload.image.replace(/^data:[^;]+;base64,/, '');
  const mimeType = payload.mimeType || 'image/jpeg';

  try {
    const result = await parseInventoryImageWithGemini(base64Data, mimeType);
    sendJson(res, 200, result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ severity: 'ERROR', message: 'Gemini vision scan failed', error: msg }));
    sendJson(res, 500, { error: msg });
  }
  return;
}
```

---

## 5. Image Capture & Upload Analysis

### 5.1 Evaluation of Approaches

| Approach | Web Browser | Mobile Browser | Capacitor Android Shell | Native Permissions Required | Dependencies |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`@capacitor/camera`** | Fallback requires `@ionic/pwa-elements` | Broken or extra setup | Works, but requires plugin install + sync | `CAMERA`, `READ_MEDIA_IMAGES` in `AndroidManifest.xml` | Adds `@capacitor/camera` + Gradle changes |
| **`navigator.mediaDevices.getUserMedia`** | Blocked by `Permissions-Policy: camera=()` in `server.ts` | Blocked if served over production Express | Blocked / requires complex camera viewfinder UI | `CAMERA` | Zero new npm packages, but high UI complexity |
| **Standard HTML5 `<input type="file" accept="image/*" capture="environment">` + Drag & Drop** | Native file picker + drag-and-drop dropzone | Opens native camera or gallery chooser | WebView `onShowFileChooser` opens system Camera/Gallery intent | None (OS handles picker) | Zero dependencies. Works identically everywhere |

### 5.2 Recommendation: HTML5 File Input with Client-Side Canvas Compression
Using standard HTML file input:
```html
<input
  type="file"
  accept="image/*"
  capture="environment"
  onChange={handleFileSelect}
  ref={fileInputRef}
  className="hidden"
/>
```
Coupled with a modern drag-and-drop upload zone and a "Take Photo / Camera" button that programmatically clicks the input.

### 5.3 Client-Side Canvas Pre-processing Pipeline
Modern smartphone photos are 12–50 megapixels (5 MB–18 MB). Sending uncompressed raw images causes:
1. Mobile network upload latency (5–20 seconds on 4G).
2. Memory pressure on the Node.js server.
3. Exceeding token/payload limits.

A client-side utility `src/utils/imageUtils.ts` should resize images before sending:
- Max bounding box: `1600 x 1600` pixels (optimal for Gemini Vision OCR while retaining fine text details on small component labels).
- Output format: `image/jpeg` with quality `0.85`.
- Resulting file size: 150 KB – 400 KB (fast 300ms upload).

```typescript
export async function compressImageFile(file: File, maxDim = 1600, quality = 0.85): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
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
        reject(new Error('Canvas context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve({
        base64: dataUrl.split(',')[1],
        mimeType: 'image/jpeg',
      });
    };
    img.onerror = () => reject(new Error('Failed to load image for compression'));
    img.src = URL.createObjectURL(file);
  });
}
```

---

## 6. Service Records & Inventory Linkage

### 6.1 Current Service Record Structure
In `src/types/index.ts`:
```typescript
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
  filtersReplaced?: string; // e.g. "5-Micron Spun PP, Pre-Carbon 10 inch, FR 450"
  serviceCharge: number;
  partsCharge: number;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  technicianNotes?: string;
  recommendedIntervalDays: number;
  calculatedNextReminderDate: string;
  nextReminderDate: string;
  isDateOverridden: boolean;
  internalNotes?: string;
  isSampleData?: boolean;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}
```

In `src/components/RecordServiceModal.tsx`:
- Step 2 contains `filtersReplaced` input with "Quick insert" buttons (`5µ Spun Filter`, `Carbon Block`, `TFC RO Membrane`, `Post-Carbon / Mineral`, `Flow Restrictor 450`, `Booster Pump SMPS`).
- Step 3 contains `serviceCharge` (default 350) and `partsCharge` (default 600), totaling 950 INR.

### 6.2 Recommended Linkage Pattern
To maintain full backwards compatibility with `firestore.rules` (which checks `data.keys().hasOnly(...)` on `serviceRecords`):
1. **Interactive Part Selector in `RecordServiceModal`:**
   Technicians can select parts directly from the loaded `inventory` collection (with live stock counts visible and warnings if quantity is 0).
2. **Auto-Calculation:**
   Selecting an item adds its selling price to `partsCharge` and updates `totalAmount`.
3. **Format `filtersReplaced` String:**
   The human-readable string is formatted automatically: e.g. `"5-Micron Spun Filter (x1), TFC RO Membrane (x1)"`.
4. **Atomic Stock Deduction in `dbService.recordCompletedService`:**
   When the service is submitted, `recordCompletedService` accepts an optional `usedParts?: { itemId: string; quantity: number }[]`.
   Using `batch.update(doc(db, 'inventory', part.itemId), { quantity: increment(-part.quantity), updatedAt: nowIso })` inside the existing `writeBatch(db)`:
   - 1. Service record created
   - 2. Customer updated
   - 3. Reminder created
   - 4. Inventory counts atomically deducted
   - 5. Audit event logged ("SERVICE_RECORDED: Parts deducted from inventory")

---

## 7. Existing Sample Files, Fixtures & Mocks

### 7.1 Existing In-Code Datasets
- **Sample Customers & Service History:**
  `src/services/dbService.ts` lines 625–865 define 8 realistic Madurai customers (AP-1001 to AP-1008) covering areas such as Thirunagar, KK Nagar, Anna Nagar, and Villapuram, along with associated `serviceRecords` and `reminders`.
- **Sample Inventory Seed Dataset to Add:**
  When `seedSampleData(ownerId)` runs, it should also seed realistic initial RO inventory items:
  1. `5-Micron Spun Filter Cartridge 10"` (Category: `spun_filter`, Qty: 24, Cost: ₹45, Selling: ₹150, LowStockThreshold: 10)
  2. `DOW Filmtec 75 GPD TFC RO Membrane` (Category: `ro_membrane`, Qty: 6, Cost: ₹1,200, Selling: ₹2,200, LowStockThreshold: 4)
  3. `Kemflo Pre-Carbon Block Filter 10"` (Category: `carbon_filter`, Qty: 12, Cost: ₹180, Selling: ₹350, LowStockThreshold: 5)
  4. `Post-Carbon & Mineral Inline Cartridge` (Category: `post_carbon`, Qty: 8, Cost: ₹220, Selling: ₹450, LowStockThreshold: 4)
  5. `BNQS 100 GPD Booster Pump 24V` (Category: `booster_pump`, Qty: 3, Cost: ₹1,450, Selling: ₹2,400, LowStockThreshold: 2)
  6. `24V 2.5A Heavy Duty SMPS Power Supply` (Category: `smps_power_supply`, Qty: 5, Cost: ₹380, Selling: ₹750, LowStockThreshold: 3)
  7. `Flow Restrictor (FR 450)` (Category: `flow_restrictor`, Qty: 15, Cost: ₹35, Selling: ₹100, LowStockThreshold: 5)
  8. `SLX Push-Fit Elbow & Union Connectors Set` (Category: `fitting`, Qty: 30, Cost: ₹15, Selling: ₹40, LowStockThreshold: 10)

### 7.2 Verification Resources & Test Fixtures
- `ORIGINAL_REQUEST.md` notes: *"The user will provide sample photos of spare parts and supplier bills/invoices for testing the scanning feature."*
- For automated CI regression testing (`tests/regressions.test.ts`):
  - Add synthetic test fixtures:
    - Base64 dummy image fixtures for unit testing.
    - Mock Gemini response fixtures simulating successful spare parts identification, supplier invoice parsing with line items, and unrecognized image rejection.
  - Test suites to add:
    - CRUD operation validation for inventory items.
    - Low-stock threshold logic and alerts.
    - Service record inventory deduction and negative stock prevention.
    - Gemini vision response JSON schema validation and error fallback.

---

## 8. Summary of Findings & Action Items for Implementation

| Investigation Dimension | Finding | Implementation Action |
| :--- | :--- | :--- |
| **Data Storage** | Firestore with strict `data.keys().hasOnly(...)` security rules. | Add `isValidInventoryItem` and `/inventory/{itemId}` match rules to `firestore.rules`. Update rules tests in `tests/firestore.rules.test.ts`. |
| **AI Vision SDK** | `@google/genai` v2.4.0 installed. Must execute on server side. | Build `src/server/geminiVisionAdapter.ts` with model `gemini-3.8-flash` and typed JSON schema. Mount `/api/inventory/scan` in `apiMiddleware.ts`. |
| **Request Body Limit** | `BODY_LIMIT_BYTES = 16_384` (16 KB) in `apiMiddleware.ts` will block image uploads. | Increase body limit for `/api/inventory/scan` to 10 MB using `readRawBody`. |
| **Camera & Upload** | No `@capacitor/camera` installed; `Permissions-Policy: camera=()` in `server.ts`. | Use HTML5 `<input type="file" accept="image/*" capture="environment">` with client-side canvas resizing. Universal compatibility across web & mobile. |
| **Service Linkage** | `ServiceRecord` has `filtersReplaced` (string) and `partsCharge` (number). | Connect `RecordServiceModal` to inventory for item picking, auto-pricing, and atomic stock decrement in `recordCompletedService`. |
| **Sample Data** | Comprehensive sample data exists for customers/services/reminders in `dbService.ts`. | Add initial sample inventory items to `getInitialSampleDataSet`, `seedSampleData`, and `purgeSampleData`. |
