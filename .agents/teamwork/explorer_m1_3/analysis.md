# Exploration Analysis: Firestore Security Rules & RO Inventory Seed Data

**Author**: Milestone 1 Explorer 3 (Security Rules & Seed Data Specialist)  
**Date**: 2026-11-07  
**Working Directory**: `.agents/teamwork/explorer_m1_3/`  
**Milestone**: M1 — Data Models, Firestore Persistence & Security Rules (Features 1, 2, 3, 4)

---

## 1. Executive Summary

This investigation analyzed the security architecture in `firestore.rules`, existing data models in `src/types/index.ts`, persistence patterns in `src/services/dbService.ts`, and test infrastructure in `tests/firestore.rules.test.ts`. 

Based on this analysis, we designed:
1. **The exact Firestore security rules additions** for the new `/inventory/{itemId}` collection, including the validator function `isValidInventoryItem(data)` using field whitelisting (`keys().hasOnly(...)`), strict type checks, positive numeric bounds, and category validation.
2. **A production-grade sample RO inventory seed dataset** containing 12 items spanning all 10 RO spare part categories, realistic Indian Rupee (INR) cost and retail prices for the Madurai RO service market, and balanced stock states (7 healthy stock, 3 low stock, 2 out of stock).
3. **An exact implementation plan** for the Worker with code snippets and test specifications.

---

## 2. Analysis of Existing Security Architecture

### 2.1 Owner Allowlist & Authentication (`firestore.rules` Lines 23–36)
Existing rules use a multi-layered identity check:
```javascript
function isSignedIn() {
  return request.auth != null;
}

function isAuthorizedOwnerAccount() {
  return isSignedIn() &&
    request.auth.token.email_verified == true &&
    request.auth.token.email in ['nisanth.t9c@gmail.com', 'aquaplusrosales@gmail.com', 'vishaalchinnan@gmail.com'];
}

function isOwner(ownerId) {
  // All authorized accounts belong to this one business and share its records.
  return isAuthorizedOwnerAccount();
}
```
- **Principle**: Default-deny (`match /{document=**} { allow read, write: if false; }`).
- **Enforcement**: No unauthenticated or non-allowlisted email can read, list, create, update, or delete records.
- **Tenant Isolation**: Authorized emails share business records under `ownerId` ('aquaplus-business').

### 2.2 Schema Whitelisting Pattern (`keys().hasOnly(...)`)
Every existing entity (`isValidCustomer`, `isValidServiceRecord`, `isValidReminder`, `isValidAuditEvent`, `isValidSettings`) enforces:
1. `data.keys().hasOnly([...])`: Strict rejection of unknown or malicious injected fields.
2. `data.ownerId is string && data.ownerId.size() <= 128`: Explicit ownership attribution.
3. String length upper bounds (e.g. `size() <= 120`, `size() <= 300`) to prevent storage exhaustion.
4. Value domain checks (`data.serviceCharge >= 0 && data.serviceCharge <= 1000000`, `data.status in [...]`).
5. Optional fields evaluated with short-circuiting: `(!('fieldName' in data) || (data.fieldName is string && data.fieldName.size() <= max))`.

### 2.3 Immutability Invariants on Update
In existing collections (`customers`, `serviceRecords`, `reminders`), `update` rules enforce:
- Ownership consistency: `incoming().ownerId == existing().ownerId`
- Sample data boundary: `incoming().get('isSampleData', false) == existing().get('isSampleData', false)` — preventing privilege escalation where a user marks a production document as sample data to delete it.

### 2.4 Deletion Policy Comparison
- `customers`, `serviceRecords`, `reminders`: Can only be deleted if `existing().isSampleData == true` (for audit and legal record retention).
- `ownerReports`: Can be deleted by any authorized owner (`allow delete: if isValidId(reportId) && isOwner(existing().ownerId);`).
- `inventory`: According to requirement **R2** ("Allow users to manually add new items, edit existing item details, adjust stock quantities, and remove items when necessary") and Feature 15 ("Item Deletion Safety Dialog: Safe deletion dialog to remove obsolete items with confirmation check"), owners must be permitted to delete obsolete or erroneously entered inventory items. Therefore, the delete rule should allow authorized owners to delete inventory items:
  `allow delete: if isValidId(itemId) && isOwner(existing().ownerId);`

---

## 3. Exact Specification for `firestore.rules`

### 3.1 Field Schema for `InventoryItem`
| Field | Type | Required? | Constraints | Purpose |
|---|---|---|---|---|
| `id` | string | Optional (in payload) | `size() <= 128` | Document identifier |
| `name` | string | **Required** | `1 <= size() <= 120` | Spare part description / part name |
| `category` | string | **Required** | Must be in 10-category enum | Categorization for filtering & icons |
| `quantity` | number | **Required** | `0 <= quantity <= 100000` | Current units physically in stock |
| `lowStockThreshold` | number | **Required** | `0 <= threshold <= 100000` | Reorder warning threshold |
| `unitCost` | number | **Required** | `0 <= unitCost <= 1000000` | Purchase/procurement price in INR |
| `sellingPrice` | number | **Required** | `0 <= sellingPrice <= 1000000`| Retail/service price billed to customer |
| `storageLocation` | string | Optional | `size() <= 100` | Bin / shelf / rack identifier |
| `notes` | string | Optional | `size() <= 500` | Technical specifications or supplier notes |
| `isSampleData` | bool | Optional | `data.isSampleData is bool` | Flags demo/seed stock records |
| `ownerId` | string | **Required** | `size() <= 128` | Multi-tenant business identifier |
| `createdAt` | string | **Required** | `size() <= 35` | ISO 8601 creation timestamp |
| `updatedAt` | string | **Required** | `size() <= 35` | ISO 8601 modification timestamp |

### 3.2 Category Enumeration
The 10 valid category tokens per `PROJECT.md`:
1. `'spun_filter'`
2. `'ro_membrane'`
3. `'sediment_filter'`
4. `'carbon_block'`
5. `'post_carbon'`
6. `'booster_pump'`
7. `'smps_adapter'`
8. `'flow_restrictor'`
9. `'fittings_tubing'`
10. `'other'`

### 3.3 Validator Function: `isValidInventoryItem(data)`
```javascript
    // InventoryItem Validation
    function isValidInventoryItem(data) {
      return data.keys().hasOnly(['id', 'name', 'category', 'quantity', 'lowStockThreshold', 'unitCost', 'sellingPrice', 'storageLocation', 'notes', 'isSampleData', 'ownerId', 'createdAt', 'updatedAt']) &&
             data.name is string && data.name.size() >= 1 && data.name.size() <= 120 &&
             data.category in ['spun_filter', 'ro_membrane', 'sediment_filter', 'carbon_block', 'post_carbon', 'booster_pump', 'smps_adapter', 'flow_restrictor', 'fittings_tubing', 'other'] &&
             data.quantity is number && data.quantity >= 0 && data.quantity <= 100000 &&
             data.lowStockThreshold is number && data.lowStockThreshold >= 0 && data.lowStockThreshold <= 100000 &&
             data.unitCost is number && data.unitCost >= 0 && data.unitCost <= 1000000 &&
             data.sellingPrice is number && data.sellingPrice >= 0 && data.sellingPrice <= 1000000 &&
             data.ownerId is string && data.ownerId.size() <= 128 &&
             data.createdAt is string && data.createdAt.size() <= 35 &&
             data.updatedAt is string && data.updatedAt.size() <= 35 &&
             (!('id' in data) || (data.id is string && data.id.size() <= 128)) &&
             (!('storageLocation' in data) || (data.storageLocation is string && data.storageLocation.size() <= 100)) &&
             (!('notes' in data) || (data.notes is string && data.notes.size() <= 500)) &&
             (!('isSampleData' in data) || (data.isSampleData is bool));
    }
```

### 3.4 Collection Match Rule: `/inventory/{itemId}`
```javascript
    match /inventory/{itemId} {
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

## 4. Realistic Sample RO Inventory Seed Dataset

### 4.1 Domain Context & Market Realism
AquaPlus Service OS operates in Madurai, Tamil Nadu. The local market handles domestic and light commercial RO purifiers (Kent, Aquaguard, Pureit, Livpure, and local assembled systems). Typical borewell input TDS ranges from 600 ppm to 1800 ppm, requiring routine replacements of spun pre-filters (every 3 months), carbon blocks, and membranes (every 12–18 months).

### 4.2 Seed Dataset Table

| # | Item Name | Category | Stock | Threshold | Unit Cost (₹) | Selling Price (₹) | Storage Bin | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 5µ PP Spun Filter Cartridge (10-inch) | `spun_filter` | **42** | 15 | ₹45 | ₹120 | Bin A-01 | `in_stock` | 10" melt-blown polypropylene outer pre-filter cartridge. Replaced quarterly. |
| 2 | 75 GPD TFC Residential RO Membrane | `ro_membrane` | **4** | 6 | ₹680 | ₹1,450 | Cabinet B-01 | `low_stock` | High rejection thin-film composite membrane for domestic units. Low stock! |
| 3 | 100 GPD Hi-TDS Commercial RO Membrane | `ro_membrane` | **8** | 3 | ₹890 | ₹1,850 | Cabinet B-01 | `in_stock` | Heavy-duty membrane for borewell water areas with input TDS > 1500 ppm. |
| 4 | 10" Inline Sediment Filter (Push-Fit) | `sediment_filter` | **24** | 8 | ₹110 | ₹260 | Bin A-02 | `in_stock` | 5-micron inline pre-treatment filter inside cabinet. Removes sand and rust. |
| 5 | 10" CTO Carbon Block Filter Cartridge | `carbon_block` | **19** | 8 | ₹135 | ₹290 | Bin A-03 | `in_stock` | Activated coconut shell carbon block. Removes chlorine and bad odors. |
| 6 | Post Carbon & Silver Nano Taste Polisher | `post_carbon` | **15** | 5 | ₹155 | ₹320 | Bin A-04 | `in_stock` | Final stage polishing cartridge for sweet taste and bacteriostatic protection. |
| 7 | 100 GPD 24V DC Diaphragm Booster Pump | `booster_pump` | **0** | 3 | ₹1,150 | ₹2,200 | Shelf C-01 | `out_of_stock` | Kemflo/BNQS heavy duty booster pump. OUT OF STOCK - urgent distributor PO needed. |
| 8 | 24V 2.5A SMPS DC Power Adapter | `smps_adapter` | **2** | 4 | ₹320 | ₹650 | Shelf C-02 | `low_stock` | 140V-300V AC wide-range SMPS with built-in surge suppressor. Low stock! |
| 9 | Flow Restrictor FR-450 (Push-Fit 1/4") | `flow_restrictor` | **5** | 6 | ₹35 | ₹110 | Drawer D-01 | `low_stock` | 450 cc/min reject water restrictor for 75 GPD RO membranes. Low stock! |
| 10 | 1/4" Food-Grade PE RO Tubing (100m Roll) | `fittings_tubing` | **6** | 2 | ₹420 | ₹800 | Rack E-01 | `in_stock` | NSF certified high-pressure food-grade polyethylene tubing in blue/white. |
| 11 | 1/4" Quick-Connect Elbow & Tee Fittings (Pack of 20) | `fittings_tubing` | **14** | 5 | ₹180 | ₹360 | Drawer D-02 | `in_stock` | Push-fit connectors with stainless steel teeth and food-grade EPDM O-rings. |
| 12 | Copper + Alkaline Mineralizer Infuser Cartridge | `other` | **0** | 3 | ₹380 | ₹750 | Bin A-05 | `out_of_stock` | Infuses Ca, Mg, Cu ions and balances pH to 7.5-8.5. OUT OF STOCK. |

### 4.3 Aggregate KPI Metrics for Seed Data
- **Total SKUs**: 12
- **Total Physical Units in Stock**: 139 units
- **Total Inventory Cost Valuation**: ₹25,115
- **Total Retail Selling Valuation**: ₹53,880
- **Stock Status Breakdown**:
  - `in_stock`: 7 items (58.3%)
  - `low_stock`: 3 items (25.0%)
  - `out_of_stock`: 2 items (16.7%)

### 4.4 Sample Data Code Structure for `src/services/dbService.ts`
```typescript
export const SAMPLE_INVENTORY_ITEMS: Omit<InventoryItem, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'inv_sample_spun_5u',
    name: '5µ PP Spun Filter Cartridge (10-inch)',
    category: 'spun_filter',
    quantity: 42,
    lowStockThreshold: 15,
    unitCost: 45,
    sellingPrice: 120,
    storageLocation: 'Bin A-01',
    notes: 'Standard 10" pre-filter cartridge for outer bowl. Fast-moving consumable; replaced quarterly.',
    isSampleData: true,
    ownerId: 'aquaplus-business',
  },
  {
    id: 'inv_sample_ro_mem_75',
    name: '75 GPD TFC Residential RO Membrane',
    category: 'ro_membrane',
    quantity: 4,
    lowStockThreshold: 6,
    unitCost: 680,
    sellingPrice: 1450,
    storageLocation: 'Cabinet B-01',
    notes: 'High-rejection thin-film composite membrane for domestic units. Low stock warning!',
    isSampleData: true,
    ownerId: 'aquaplus-business',
  },
  {
    id: 'inv_sample_ro_mem_100',
    name: '100 GPD Hi-TDS Commercial RO Membrane',
    category: 'ro_membrane',
    quantity: 8,
    lowStockThreshold: 3,
    unitCost: 890,
    sellingPrice: 1850,
    storageLocation: 'Cabinet B-01',
    notes: 'Heavy duty membrane for borewell water areas with input TDS exceeding 1500 ppm.',
    isSampleData: true,
    ownerId: 'aquaplus-business',
  },
  {
    id: 'inv_sample_sediment_10',
    name: '10" Inline Sediment Filter (Push-Fit)',
    category: 'sediment_filter',
    quantity: 24,
    lowStockThreshold: 8,
    unitCost: 110,
    sellingPrice: 260,
    storageLocation: 'Bin A-02',
    notes: 'Pre-treatment stage 1 filter inside cabinet. Removes sand, silt, and rust particles.',
    isSampleData: true,
    ownerId: 'aquaplus-business',
  },
  {
    id: 'inv_sample_carbon_cto',
    name: '10" CTO Carbon Block Filter Cartridge',
    category: 'carbon_block',
    quantity: 19,
    lowStockThreshold: 8,
    unitCost: 135,
    sellingPrice: 290,
    storageLocation: 'Bin A-03',
    notes: 'Activated coconut shell carbon block. Adsorbs chlorine, volatile organic compounds, and bad odor.',
    isSampleData: true,
    ownerId: 'aquaplus-business',
  },
  {
    id: 'inv_sample_post_carbon',
    name: 'Post Carbon & Silver Nano Taste Enhancer',
    category: 'post_carbon',
    quantity: 15,
    lowStockThreshold: 5,
    unitCost: 155,
    sellingPrice: 320,
    storageLocation: 'Bin A-04',
    notes: 'Final polishing cartridge for crisp sweet water taste and bacteriostatic protection.',
    isSampleData: true,
    ownerId: 'aquaplus-business',
  },
  {
    id: 'inv_sample_pump_100gpd',
    name: '100 GPD 24V DC Diaphragm Booster Pump',
    category: 'booster_pump',
    quantity: 0,
    lowStockThreshold: 3,
    unitCost: 1150,
    sellingPrice: 2200,
    storageLocation: 'Shelf C-01',
    notes: 'Kemflo/BNQS heavy duty diaphragm booster pump. OUT OF STOCK - urgent distributor PO needed.',
    isSampleData: true,
    ownerId: 'aquaplus-business',
  },
  {
    id: 'inv_sample_smps_24v',
    name: '24V 2.5A SMPS DC Power Adapter',
    category: 'smps_adapter',
    quantity: 2,
    lowStockThreshold: 4,
    unitCost: 320,
    sellingPrice: 650,
    storageLocation: 'Shelf C-02',
    notes: 'Wide voltage range (140V-300V AC) SMPS with built-in surge suppressor. Low stock warning!',
    isSampleData: true,
    ownerId: 'aquaplus-business',
  },
  {
    id: 'inv_sample_fr_450',
    name: 'Flow Restrictor FR-450 (Push-Fit 1/4")',
    category: 'flow_restrictor',
    quantity: 5,
    lowStockThreshold: 6,
    unitCost: 35,
    sellingPrice: 110,
    storageLocation: 'Drawer D-01',
    notes: '450 cc/min reject water restrictor for 75 GPD domestic RO membranes. Low stock warning!',
    isSampleData: true,
    ownerId: 'aquaplus-business',
  },
  {
    id: 'inv_sample_tubing_14',
    name: '1/4" Food-Grade PE RO Tubing (100m Roll)',
    category: 'fittings_tubing',
    quantity: 6,
    lowStockThreshold: 2,
    unitCost: 420,
    sellingPrice: 800,
    storageLocation: 'Rack E-01',
    notes: 'NSF certified high-pressure food grade polyethylene tubing for all connections.',
    isSampleData: true,
    ownerId: 'aquaplus-business',
  },
  {
    id: 'inv_sample_fittings_pack',
    name: '1/4" Quick-Connect Elbow & Equal Tee Fittings (Pack of 20)',
    category: 'fittings_tubing',
    quantity: 14,
    lowStockThreshold: 5,
    unitCost: 180,
    sellingPrice: 360,
    storageLocation: 'Drawer D-02',
    notes: 'Push-fit connectors with stainless steel grab ring and EPDM food grade O-rings.',
    isSampleData: true,
    ownerId: 'aquaplus-business',
  },
  {
    id: 'inv_sample_alkaline_copper',
    name: 'Copper + Alkaline pH Balancing Mineral Infuser',
    category: 'other',
    quantity: 0,
    lowStockThreshold: 3,
    unitCost: 380,
    sellingPrice: 750,
    storageLocation: 'Bin A-05',
    notes: 'Enriches RO permeate with essential minerals (Ca, Mg, Cu) and balances pH to 7.5-8.5. OUT OF STOCK.',
    isSampleData: true,
    ownerId: 'aquaplus-business',
  },
];
```

---

## 5. Security Audit Analysis (Red-Team Perspective)

We audited the designed rules against the 6 core criteria of the `firebase-security-rules-auditor` checklist:

1. **The Update Bypass**:
   - *Attack*: Can an attacker change `ownerId` to hijack records, or change `isSampleData: false` to `true` to delete a real document?
   - *Defense*: `incoming().ownerId == existing().ownerId` and `incoming().get('isSampleData', false) == existing().get('isSampleData', false)` completely block this vector.
   - *Attack*: Can an attacker update negative quantities or prices?
   - *Defense*: `isValidInventoryItem(incoming())` runs on `update` as well as `create`, preventing negative stock or corrupted types.
2. **Authority Source**:
   - Authority is derived from `request.auth.token.email_verified == true` and the email allowlist matching `isAuthorizedOwnerAccount()`.
   - Never trusts arbitrary client claims.
3. **Storage Abuse / Resource Exhaustion (DoS)**:
   - `name.size() <= 120`, `storageLocation.size() <= 100`, `notes.size() <= 500`.
   - Numeric fields are bounded: `quantity <= 100000`, `unitCost <= 1000000`, `sellingPrice <= 1000000`.
   - Unknown fields are strictly rejected via `keys().hasOnly(...)`.
4. **Type Safety**:
   - `is string`, `is number`, `is bool` applied to every field.
5. **Field-Level vs Identity-Level Security**:
   - Whitelist validation (`keys().hasOnly`) is paired with ownership checks (`isOwner(existing().ownerId)`).
6. **Audit Score**: **5 / 5 (Secure)**.

---

## 6. Test Infrastructure & Verification Plan

### 6.1 Test Matrix for `tests/firestore.rules.test.ts`
When the Firestore emulator is available (requires JDK 21+ per `firebase-tools` v15.34), the following unit tests should be added to `tests/firestore.rules.test.ts`:

```typescript
function validInventoryItem(id: string, isSampleData = false) {
  return {
    id,
    name: '5µ PP Spun Filter Cartridge (10-inch)',
    category: 'spun_filter',
    quantity: 42,
    lowStockThreshold: 15,
    unitCost: 45,
    sellingPrice: 120,
    storageLocation: 'Bin A-01',
    notes: 'Standard 10" pre-filter cartridge for outer bowl.',
    ownerId: OWNER_ID,
    isSampleData,
    createdAt: '2026-10-19T00:00:00.000Z',
    updatedAt: '2026-10-19T00:00:00.000Z',
  };
}

test('allowlisted owner can read and list inventory items', async () => {
  const db = ownerDb();
  await assertSucceeds(getDoc(doc(db, 'inventory', 'inv-real')));
  await assertSucceeds(getDocs(collection(db, 'inventory')));
});

test('unauthenticated or non-allowlisted clients cannot read or write inventory', async () => {
  const unauthDb = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(unauthDb, 'inventory', 'inv-real')));
  await assertFails(getDocs(collection(unauthDb, 'inventory')));
  await assertFails(setDoc(doc(unauthDb, 'inventory', 'inv-new'), validInventoryItem('inv-new')));

  const attackerDb = testEnv.authenticatedContext('attacker', {
    email: 'attacker@example.com',
    email_verified: true,
  }).firestore();
  await assertFails(getDoc(doc(attackerDb, 'inventory', 'inv-real')));
  await assertFails(getDocs(collection(attackerDb, 'inventory')));
  await assertFails(setDoc(doc(attackerDb, 'inventory', 'inv-new'), validInventoryItem('inv-new')));
});

test('owner can create valid inventory item with all required fields', async () => {
  const db = ownerDb();
  await assertSucceeds(setDoc(doc(db, 'inventory', 'inv-create-test'), validInventoryItem('inv-create-test')));
});

test('inventory validation rejects negative stock, negative prices, or unknown categories', async () => {
  const db = ownerDb();
  await assertFails(setDoc(doc(db, 'inventory', 'inv-bad-qty'), { ...validInventoryItem('inv-bad-qty'), quantity: -5 }));
  await assertFails(setDoc(doc(db, 'inventory', 'inv-bad-thresh'), { ...validInventoryItem('inv-bad-thresh'), lowStockThreshold: -1 }));
  await assertFails(setDoc(doc(db, 'inventory', 'inv-bad-cost'), { ...validInventoryItem('inv-bad-cost'), unitCost: -50 }));
  await assertFails(setDoc(doc(db, 'inventory', 'inv-bad-price'), { ...validInventoryItem('inv-bad-price'), sellingPrice: -100 }));
  await assertFails(setDoc(doc(db, 'inventory', 'inv-bad-cat'), { ...validInventoryItem('inv-bad-cat'), category: 'invalid_category_xyz' }));
  await assertFails(setDoc(doc(db, 'inventory', 'inv-bad-keys'), { ...validInventoryItem('inv-bad-keys'), unknownMaliciousField: true }));
});

test('owner can update inventory quantity and details while preserving ownerId', async () => {
  const db = ownerDb();
  await assertSucceeds(updateDoc(doc(db, 'inventory', 'inv-real'), { quantity: 50, sellingPrice: 130 }));
  await assertFails(updateDoc(doc(db, 'inventory', 'inv-real'), { ownerId: 'attacker-business' }));
  await assertFails(updateDoc(doc(db, 'inventory', 'inv-real'), { isSampleData: true }));
});

test('owner can delete inventory items', async () => {
  const db = ownerDb();
  await assertSucceeds(deleteDoc(doc(db, 'inventory', 'inv-real')));
});
```

### 6.2 Regression / Pure-Logic Tests for `tests/regressions.test.ts`
Because `npm test` runs immediately without needing external JVM emulators, pure business logic validations for stock status calculations and seed data integrity should be added to `tests/regressions.test.ts`:
- Calculating stock status:
  - `quantity <= 0` returns `'out_of_stock'`
  - `0 < quantity <= lowStockThreshold` returns `'low_stock'`
  - `quantity > lowStockThreshold` returns `'in_stock'`
- Validating all 12 items in `SAMPLE_INVENTORY_ITEMS` conform to category types and positive price/quantity bounds.

---

## 7. Step-by-Step Implementation Plan for the Worker

### Step 1: Update `firestore.rules`
1. At line 105 (after `isValidAuditEvent` function), insert the `isValidInventoryItem(data)` helper function.
2. At line 208 (after `match /auditEvents/{eventId}` block), insert the `match /inventory/{itemId}` block.
3. Validate formatting and syntax.

### Step 2: Update `src/services/dbService.ts`
1. Import `InventoryItem`, `InventoryCategory`, `StockStatus` from `'../types'`.
2. Export `SAMPLE_INVENTORY_ITEMS` array containing the 12 realistic RO items.
3. In `seedSampleData(ownerId: string)`:
   - Loop over `SAMPLE_INVENTORY_ITEMS` and batch-write them to `collection(db, 'inventory')` with `ownerId`, `createdAt: nowIso`, `updatedAt: nowIso`.
4. In `purgeSampleData(...)`:
   - Query or filter `inventory` collection where `isSampleData == true` and delete them in batch.
5. In `subscribeInventory`, `addInventoryItem`, `updateInventoryItem`, `adjustInventoryQuantity`, `deleteInventoryItem`:
   - Implement the CRUD and subscription logic per Explorer 2's design.

### Step 3: Update `tests/regressions.test.ts`
1. Add regression test for `getStockStatus` logic across healthy, low stock, and zero stock boundary conditions.
2. Add regression test verifying all `SAMPLE_INVENTORY_ITEMS` conform to schema bounds, categories, and non-negative constraints.
3. Run `npm test` to verify 100% green pass.

### Step 4: Update `tests/firestore.rules.test.ts`
1. Add `validInventoryItem` helper and inventory test cases.
2. Set up initial test documents in `beforeEach` (`inv-real`, `inv-sample`).
