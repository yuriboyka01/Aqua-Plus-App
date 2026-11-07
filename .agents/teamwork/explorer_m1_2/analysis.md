# Exploration Report & Architectural Design: Firestore Service Layer for Inventory Management

**Specialist Role:** Milestone 1 Explorer 2 (Firestore Service Layer Specialist)  
**Target Codebase:** AquaPlus Service OS (`src/services/dbService.ts`)  
**Scope:** Milestone 1 (Features 1, 2, 3, 4) — Data Models, Persistence & Security Rules  
**Date:** 2026-11-07  

---

## 1. Executive Summary

This investigation designs the production-grade Firestore data access layer in `src/services/dbService.ts` for AquaPlus Service OS Inventory & Storage Management. The design satisfies all requirements from `ORIGINAL_REQUEST.md` and `PROJECT.md` (Features 1, 2, 3, 4).

Key architectural achievements:
1. **Zero-Latency Real-Time Subscriptions:** `subscribeInventory` establishes an `onSnapshot` listener on the Firestore `inventory` collection with automatic in-memory alphabetical sorting, graceful error handling via `handleFirestoreError`, and offline/guest-owner preview support.
2. **Deterministic CRUD Operations:** `addInventoryItem`, `updateInventoryItem`, and `deleteInventoryItem` implement strict non-negative number clamping, automatic ISO timestamping (`createdAt`, `updatedAt`), network timeout protection via `withTimeout` (12s), and immutable doc ID generation.
3. **Atomic Stock Adjustments:** `adjustInventoryQuantity` leverages Firestore's `runTransaction` to eliminate race conditions between concurrent technicians, enforce a strict lower bound of `quantity >= 0` (preventing negative inventory), and append structured audit log entries (`INVENTORY_STOCK_ADJUSTED`) with delta, old/new balance, and reason.
4. **Seamless Demo & Sample Data Lifecycle:** Realistic Madurai RO spare parts seed data (spun filters, RO membranes, carbon blocks, booster pumps, SMPS adapters) integrated into `getInitialSampleDataSet`, `seedSampleData`, and `purgeSampleData`.
5. **Full Backward Compatibility:** Dual-signature support (allowing both `(callback, onError)` and `(ownerId, callback, onError)`) ensures drop-in compatibility across current desktop and mobile consumers.

---

## 2. Examination of Existing Service Layer (`src/services/dbService.ts`)

A detailed code review of `src/services/dbService.ts` (1,053 lines) revealed four consistent design conventions that must be mirrored:

### 2.1 Subscription Pattern
- Existing subscriptions (`subscribeCustomers`, `subscribeServiceRecords`, `subscribeReminders`, `subscribeMessageAttempts`) query a top-level Firestore collection using `collection(db, path)`.
- If `ownerId` is empty or `'guest_owner'`, the subscription immediately returns a no-op unsubscription function `() => {}`.
- Errors in snapshots trigger a `console.warn` and delegate to an optional `onError?: (err: any) => void` callback.
- Client-side sorting is applied in-memory before invoking `callback(data)` (e.g., customers sorted by `createdAt` desc, reminders by `reminderDate` asc).

### 2.2 Network Timeout Wrapper (`withTimeout`)
- Defined at line 68:
  ```typescript
  function withTimeout<T>(
    promise: Promise<T>,
    ms = 12000,
    errorMsg = 'Database operation timed out. Please check your network connection or sign in again.'
  ): Promise<T>
  ```
- All writes (`setDoc`, `updateDoc`, `deleteDoc`, and transactions) must be wrapped in `withTimeout(...)` to prevent hanging promises on mobile networks (Capacitor Android) or unstable connections.

### 2.3 Centralized Error Handling (`handleFirestoreError`)
- All rejected Firestore promises are caught and passed to `handleFirestoreError(err, operationType, path)` imported from `src/lib/firebase.ts`.
- `OperationType` enum values: `CREATE`, `UPDATE`, `DELETE`, `LIST`, `GET`, `WRITE`.
- The handler captures current auth state, serializes the error context, and re-throws a structured error.

### 2.4 Audit Logging Pattern (`recordAuditEvent`)
- Critical state mutations call `recordAuditEvent(action, details, entityType, entityId, ownerId)`.
- Non-critical mutations call `.catch((e) => console.warn('Non-blocking audit log notice:', e))` so audit logging failures never abort the user's primary database operation.
- In `src/types/index.ts`, `AuditEvent.entityType` is defined as:
  ```typescript
  entityType: 'Customer' | 'ServiceRecord' | 'Reminder' | 'Settings' | 'BatchScheduler'
  ```
  *Recommendation:* Extend this union to include `'InventoryItem'`.

### 2.5 Sample Data Isolation
- Sample preview documents carry `isSampleData: true` and `ownerId: string`.
- `seedSampleData(ownerId)` uses `writeBatch(db)` to insert sample records.
- `purgeSampleData(customers, services, reminders, ownerId)` iterates and deletes all documents flagged with `isSampleData: true`.
- `getInitialSampleDataSet(ownerId)` provides static in-memory data for instant preview or offline demonstration without writing to Firestore.

---

## 3. Exact Inventory Service Layer Implementation Design

### 3.1 Imports to Update in `src/services/dbService.ts`
Line 1 of `src/services/dbService.ts` should be updated to import `runTransaction` and `getDoc`:
```typescript
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  getDocs,
  getDoc,
  runTransaction,
  query,
  where,
} from 'firebase/firestore';
```

Import `InventoryItem` from `../types`:
```typescript
import {
  Customer,
  ServiceRecord,
  Reminder,
  MessageAttempt,
  AppSettings,
  OwnerReport,
  AuditEvent,
  InventoryItem, // <-- Added
} from '../types';
```

Import `BUSINESS_OWNER_ID`:
```typescript
import { BUSINESS_OWNER_ID, DEFAULT_SETTINGS } from '../lib/constants';
```
*(Note: `DEFAULT_SETTINGS` is already imported from `../lib/constants`, so simply append `BUSINESS_OWNER_ID`).*

---

### 3.2 Function 1: `subscribeInventory`

Supports both overloaded caller conventions:
1. `subscribeInventory(callback, onError)` — for direct page/component use where `ownerId` defaults to `BUSINESS_OWNER_ID`.
2. `subscribeInventory(ownerId, callback, onError)` — for standard architectural consistency with `subscribeCustomers` and `subscribeServiceRecords`.

```typescript
// -------------------------------------------------------------
// INVENTORY
// -------------------------------------------------------------

export function subscribeInventory(
  ownerIdOrCallback: string | ((items: InventoryItem[]) => void),
  callbackOrOnError?: ((items: InventoryItem[]) => void) | ((err: any) => void),
  onErrorFn?: (err: any) => void
): () => void {
  let ownerId: string;
  let callback: (items: InventoryItem[]) => void;
  let onError: ((err: any) => void) | undefined;

  if (typeof ownerIdOrCallback === 'function') {
    ownerId = BUSINESS_OWNER_ID;
    callback = ownerIdOrCallback;
    onError = typeof callbackOrOnError === 'function' ? (callbackOrOnError as (err: any) => void) : undefined;
  } else {
    ownerId = ownerIdOrCallback || BUSINESS_OWNER_ID;
    callback = callbackOrOnError as (items: InventoryItem[]) => void;
    onError = onErrorFn;
  }

  // Support guest owner / offline demo preview
  if (!ownerId || ownerId === 'guest_owner') {
    if (callback) {
      callback(getInitialSampleInventory(ownerId || 'guest_owner'));
    }
    return () => {};
  }

  const path = 'inventory';
  const q = collection(db, path);

  return onSnapshot(
    q,
    (snapshot) => {
      const items: InventoryItem[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as InventoryItem);
      });
      // Sort alphabetically by spare part name
      items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      callback(items);
    },
    (error) => {
      console.warn(`Firestore subscription notice [${path}]:`, error.message);
      if (onError) onError(error);
    }
  );
}
```

---

### 3.3 Function 2: `addInventoryItem`

Creates a new document in the `inventory` collection. If `data.id` is not supplied, generates a Firestore document reference or ID (`generateDocId('inv')`). Sanitizes numerical values to non-negative numbers, stamps `createdAt` and `updatedAt`, and records an audit log.

```typescript
export async function addInventoryItem(
  data: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  ownerId: string = BUSINESS_OWNER_ID
): Promise<string> {
  const path = 'inventory';
  const nowIso = new Date().toISOString();

  // Create document reference with auto ID or caller-provided ID
  const docRef = data.id
    ? doc(db, path, data.id)
    : doc(collection(db, path));
  const docId = docRef.id;

  const newItem: InventoryItem = {
    ...data,
    id: docId,
    ownerId,
    quantity: Math.max(0, Number(data.quantity) || 0),
    lowStockThreshold: Math.max(0, Number(data.lowStockThreshold) || 0),
    unitCost: Math.max(0, Number(data.unitCost) || 0),
    sellingPrice: Math.max(0, Number(data.sellingPrice) || 0),
    storageLocation: data.storageLocation?.trim() || undefined,
    notes: data.notes?.trim() || undefined,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  try {
    await withTimeout(setDoc(docRef, newItem));
    recordAuditEvent(
      'INVENTORY_ITEM_CREATED',
      `Registered spare part "${newItem.name}" (${newItem.category}) with initial quantity of ${newItem.quantity} (unit cost: ₹${newItem.unitCost}, selling: ₹${newItem.sellingPrice})`,
      'InventoryItem' as any,
      docId,
      ownerId
    ).catch((e) => console.warn('Non-blocking audit log notice:', e));
    return docId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `${path}/${docId}`);
  }
}
```

---

### 3.4 Function 3: `updateInventoryItem`

Updates mutable attributes of an existing item. Strips `id` and `createdAt` from updates to preserve document identity and historical creation timestamp. Enforces non-negative constraints on numeric fields and refreshes `updatedAt`.

```typescript
export async function updateInventoryItem(
  itemId: string,
  updates: Partial<Omit<InventoryItem, 'id' | 'createdAt'>>,
  ownerId: string = BUSINESS_OWNER_ID
): Promise<void> {
  const path = 'inventory';
  const fullPath = `${path}/${itemId}`;
  const nowIso = new Date().toISOString();

  const sanitized: Record<string, any> = { ...updates };
  delete sanitized.id;
  delete sanitized.createdAt;

  if (sanitized.quantity !== undefined) {
    sanitized.quantity = Math.max(0, Number(sanitized.quantity) || 0);
  }
  if (sanitized.lowStockThreshold !== undefined) {
    sanitized.lowStockThreshold = Math.max(0, Number(sanitized.lowStockThreshold) || 0);
  }
  if (sanitized.unitCost !== undefined) {
    sanitized.unitCost = Math.max(0, Number(sanitized.unitCost) || 0);
  }
  if (sanitized.sellingPrice !== undefined) {
    sanitized.sellingPrice = Math.max(0, Number(sanitized.sellingPrice) || 0);
  }
  if (sanitized.storageLocation !== undefined) {
    sanitized.storageLocation = sanitized.storageLocation?.trim() || undefined;
  }
  if (sanitized.notes !== undefined) {
    sanitized.notes = sanitized.notes?.trim() || undefined;
  }

  try {
    await withTimeout(
      updateDoc(doc(db, path, itemId), {
        ...sanitized,
        updatedAt: nowIso,
      })
    );
    recordAuditEvent(
      'INVENTORY_ITEM_UPDATED',
      `Updated inventory details for spare part "${updates.name || itemId}"`,
      'InventoryItem' as any,
      itemId,
      ownerId
    ).catch((e) => console.warn('Non-blocking audit log notice:', e));
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, fullPath);
  }
}
```

---

### 3.5 Function 4: `adjustInventoryQuantity`

Performs an atomic, transaction-based quantity adjustment.
- **Race Condition Prevention:** Multiple technicians or browser tabs updating stock concurrently cannot overwrite or corrupt the count.
- **Lower-Bound Clamping:** Automatically clamps the resulting quantity to `>= 0`, preventing negative inventory.
- **Detailed Audit Trail:** Awaits `recordAuditEvent` documenting `previousQuantity`, `newQuantity`, `delta` (`+N` or `-N`), and `reason` (e.g. `"Manual stepper increment"`, `"Service usage for #srv_123"`, `"Stock intake from supplier invoice"`).

```typescript
export async function adjustInventoryQuantity(
  itemId: string,
  delta: number,
  reason: string = 'Manual stock adjustment',
  ownerId: string = BUSINESS_OWNER_ID
): Promise<{ previousQuantity: number; newQuantity: number; clamped: boolean }> {
  const path = 'inventory';
  const docRef = doc(db, path, itemId);
  const nowIso = new Date().toISOString();

  let prevQty = 0;
  let newQty = 0;
  let itemName = itemId;
  let wasClamped = false;

  try {
    await withTimeout(
      runTransaction(db, async (transaction) => {
        const itemSnap = await transaction.get(docRef);
        if (!itemSnap.exists()) {
          throw new Error(`Inventory item with ID "${itemId}" was not found.`);
        }
        const data = itemSnap.data() as InventoryItem;
        itemName = data.name || itemId;
        prevQty = Number(data.quantity) || 0;
        
        const rawNewQty = prevQty + delta;
        newQty = Math.max(0, rawNewQty);
        wasClamped = rawNewQty < 0;

        transaction.update(docRef, {
          quantity: newQty,
          updatedAt: nowIso,
        });
      })
    );

    const sign = delta >= 0 ? `+${delta}` : `${delta}`;
    const clampNote = wasClamped ? ' (clamped to 0 minimum)' : '';
    await recordAuditEvent(
      'INVENTORY_STOCK_ADJUSTED',
      `Stock adjusted for "${itemName}": ${prevQty} -> ${newQty} (${sign})${clampNote}. Reason: ${reason}`,
      'InventoryItem' as any,
      itemId,
      ownerId
    );

    return { previousQuantity: prevQty, newQuantity: newQty, clamped: wasClamped };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${path}/${itemId}`);
  }
}
```

---

### 3.6 Function 5: `deleteInventoryItem`

Safely deletes an obsolete or decommissioned inventory item from the `inventory` collection and writes a corresponding audit log.

```typescript
export async function deleteInventoryItem(
  itemId: string,
  ownerId: string = BUSINESS_OWNER_ID
): Promise<void> {
  const path = 'inventory';
  const fullPath = `${path}/${itemId}`;

  try {
    await withTimeout(deleteDoc(doc(db, path, itemId)));
    recordAuditEvent(
      'INVENTORY_ITEM_DELETED',
      `Deleted inventory spare part record ${itemId}`,
      'InventoryItem' as any,
      itemId,
      ownerId
    ).catch((e) => console.warn('Non-blocking audit log notice:', e));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, fullPath);
  }
}
```

---

### 3.7 Auxiliary Helper: `getInventoryItem`

A utility function for single item lookups, useful for service record linkage or verification:

```typescript
export async function getInventoryItem(
  itemId: string
): Promise<InventoryItem | null> {
  const path = 'inventory';
  try {
    const snap = await withTimeout(getDoc(doc(db, path, itemId)));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as InventoryItem;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `${path}/${itemId}`);
  }
}
```

---

## 4. Sample & Demo Data Architecture

In accordance with AquaPlus production data integrity principles, demo items carry `isSampleData: true`.

### 4.1 Realistic Madurai RO Spare Parts Seed Dataset

We design a comprehensive seed set containing 10 authentic spare parts reflecting typical RO technician operations in Madurai:

```typescript
export function getInitialSampleInventory(ownerId = 'guest_owner'): InventoryItem[] {
  const nowIso = new Date().toISOString();

  return [
    {
      id: 'inv_sample_spun_1',
      name: '5µ PP Spun Filter Cartridge (10-inch)',
      category: 'spun_filter',
      quantity: 45,
      lowStockThreshold: 15,
      unitCost: 45,
      sellingPrice: 150,
      storageLocation: 'Rack A-1 (Main Workshop)',
      notes: 'Standard 10-inch pre-filter spun candle for high-turbidity Madurai borewell water',
      isSampleData: true,
      ownerId,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'inv_sample_ro_mem_1',
      name: '75 GPD TFC RO Membrane (Filmtec Type)',
      category: 'ro_membrane',
      quantity: 8,
      lowStockThreshold: 5,
      unitCost: 650,
      sellingPrice: 1400,
      storageLocation: 'Rack B-2 (Secure Cabinet)',
      notes: 'High-rejection 75 GPD thin-film composite membrane suitable for TDS up to 2000 ppm',
      isSampleData: true,
      ownerId,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'inv_sample_carbon_block_1',
      name: '10-inch CTO Carbon Block Filter',
      category: 'carbon_block',
      quantity: 4, // LOW STOCK! (Threshold is 8)
      lowStockThreshold: 8,
      unitCost: 120,
      sellingPrice: 350,
      storageLocation: 'Rack A-2',
      notes: 'Chlorine and volatile organic chemical adsorption cartridge',
      isSampleData: true,
      ownerId,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'inv_sample_sediment_1',
      name: '10-inch In-line Sediment Filter (5 Micron)',
      category: 'sediment_filter',
      quantity: 12,
      lowStockThreshold: 10,
      unitCost: 95,
      sellingPrice: 280,
      storageLocation: 'Rack A-3',
      notes: 'In-line sediment filter for internal cabinet assembly',
      isSampleData: true,
      ownerId,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'inv_sample_post_carbon_1',
      name: 'Post-Carbon Taste Enhancer & Mineral Polisher',
      category: 'post_carbon',
      quantity: 6, // LOW STOCK! (Threshold is 6)
      lowStockThreshold: 6,
      unitCost: 140,
      sellingPrice: 380,
      storageLocation: 'Rack B-1',
      notes: 'Bacteriostatic silver-impregnated post carbon cartridge for polishing output taste',
      isSampleData: true,
      ownerId,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'inv_sample_pump_1',
      name: '100 GPD RO Booster Pump (24V DC)',
      category: 'booster_pump',
      quantity: 2, // LOW STOCK! (Threshold is 3)
      lowStockThreshold: 3,
      unitCost: 1150,
      sellingPrice: 2200,
      storageLocation: 'Shelf C-1 (Heavy Parts)',
      notes: 'Diaphragm booster pump delivering 80-100 PSI operating pressure',
      isSampleData: true,
      ownerId,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'inv_sample_smps_1',
      name: '24V 2.5A SMPS Power Supply Adapter',
      category: 'smps_adapter',
      quantity: 0, // OUT OF STOCK! (Threshold is 4)
      lowStockThreshold: 4,
      unitCost: 320,
      sellingPrice: 750,
      storageLocation: 'Shelf C-2',
      notes: 'Shockproof switched-mode power supply for booster pump and solenoid',
      isSampleData: true,
      ownerId,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'inv_sample_fr_1',
      name: 'Flow Restrictor FR-450 (Push-Fit)',
      category: 'flow_restrictor',
      quantity: 18,
      lowStockThreshold: 10,
      unitCost: 35,
      sellingPrice: 120,
      storageLocation: 'Bin D-1',
      notes: '450 ml/min drain flow restrictor for 75 GPD membranes',
      isSampleData: true,
      ownerId,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'inv_sample_tubing_1',
      name: '1/4-inch Food-Grade RO Tubing (White, 50m Roll)',
      category: 'fittings_tubing',
      quantity: 3,
      lowStockThreshold: 2,
      unitCost: 420,
      sellingPrice: 850,
      storageLocation: 'Bin D-3',
      notes: 'NSF certified food-grade polyethylene tubing',
      isSampleData: true,
      ownerId,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'inv_sample_fittings_1',
      name: '1/4-inch Equal Elbow Quick-Connect Fittings (Pack of 10)',
      category: 'fittings_tubing',
      quantity: 1, // LOW STOCK! (Threshold is 5)
      lowStockThreshold: 5,
      unitCost: 110,
      sellingPrice: 250,
      storageLocation: 'Bin D-2',
      notes: 'Leak-proof push-fit 90 degree elbows',
      isSampleData: true,
      ownerId,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];
}
```

### 4.2 Seed Data Lifecycle Integration

1. **`getInitialSampleDataSet` Extension:**
   Return `inventory` alongside `customers`, `serviceRecords`, and `reminders`:
   ```typescript
   export function getInitialSampleDataSet(ownerId = 'guest_owner'): {
     customers: Customer[];
     serviceRecords: ServiceRecord[];
     reminders: Reminder[];
     inventory: InventoryItem[];
   } {
     ...
     const inventory = getInitialSampleInventory(ownerId);
     return { customers, serviceRecords, reminders, inventory };
   }
   ```

2. **`seedSampleData` Extension:**
   In `seedSampleData(ownerId: string)`:
   Load the sample inventory items and write them in the Firestore batch:
   ```typescript
   const sampleInventory = getInitialSampleInventory(ownerId);
   for (const inv of sampleInventory) {
     batch.set(doc(db, 'inventory', inv.id), inv);
   }
   ...
   await recordAuditEvent('SAMPLE_DATA_LOADED', 'Seeded Madurai sample customers, service history, and spare parts inventory', 'Customer', 'sample', ownerId);
   ```

3. **`purgeSampleData` Extension:**
   Add optional `inventory?: InventoryItem[]` parameter with safe default so existing callers don't break:
   ```typescript
   export async function purgeSampleData(
     customers: Customer[],
     services: ServiceRecord[],
     reminders: Reminder[],
     ownerId: string,
     inventory?: InventoryItem[]
   ): Promise<number> {
     ...
     const sampleInvIds = (inventory || []).filter(i => i.isSampleData).map(i => i.id);
     for (const invId of sampleInvIds) {
       await deleteDoc(doc(db, 'inventory', invId));
       deletedCount++;
     }
     ...
     await recordAuditEvent('SAMPLE_DATA_PURGED', `Removed ${deletedCount} sample test documents`, 'Customer', 'sample', ownerId);
     return deletedCount;
   }
   ```

---

## 5. Security Rules & Domain Types Alignment

### 5.1 Domain Types (`src/types/index.ts`) Alignment (with Explorer M1-1)
- `InventoryCategory`: `'spun_filter' | 'ro_membrane' | 'sediment_filter' | 'carbon_block' | 'post_carbon' | 'booster_pump' | 'smps_adapter' | 'flow_restrictor' | 'fittings_tubing' | 'other'`
- `InventoryItem`: Interface matches all persisted fields (`id`, `name`, `category`, `quantity`, `lowStockThreshold`, `unitCost`, `sellingPrice`, `storageLocation`, `notes`, `isSampleData`, `ownerId`, `createdAt`, `updatedAt`).
- `AuditEvent.entityType`: Union updated to include `'InventoryItem'`.

### 5.2 Firestore Security Rules (`firestore.rules`) Alignment (with Explorer M1-3)
The collection match rule for `/inventory/{itemId}`:
- `get`: `isValidId(itemId) && isOwner(existing().ownerId)`
- `list`: `isAuthorizedOwnerAccount()`
- `create`: `isValidId(itemId) && isOwner(incoming().ownerId) && isValidInventoryItem(incoming())`
- `update`: `isValidId(itemId) && isOwner(existing().ownerId) && incoming().ownerId == existing().ownerId && isValidInventoryItem(incoming())`
- `delete`: `isValidId(itemId) && isOwner(existing().ownerId)`

All fields generated by `addInventoryItem` and `updateInventoryItem` conform strictly to these rules.

---

## 6. Implementation Plan for the Worker

The implementing Worker should execute changes in the following sequence:

1. **Step 1: Update Imports in `src/services/dbService.ts`**
   - Add `getDoc`, `runTransaction` to `'firebase/firestore'` import.
   - Add `InventoryItem` to `'../types'` import.
   - Add `BUSINESS_OWNER_ID` to `'../lib/constants'` import.

2. **Step 2: Add Inventory Functions to `src/services/dbService.ts`**
   - Insert `subscribeInventory`, `addInventoryItem`, `updateInventoryItem`, `adjustInventoryQuantity`, `deleteInventoryItem`, and `getInventoryItem`.

3. **Step 3: Add Sample Inventory Data & Update Seed/Purge**
   - Add `getInitialSampleInventory(ownerId)`.
   - Update `getInitialSampleDataSet` to include `inventory`.
   - Update `seedSampleData` to batch-write sample inventory items.
   - Update `purgeSampleData` to delete sample inventory items.

4. **Step 4: Verify Compilation & Zero Regressions**
   - Run TypeScript type check: `npx tsc --noEmit`
   - Run regression test suite: `node --test tests/regressions.test.ts`
   - Verify all existing business logic tests pass (11/11).
