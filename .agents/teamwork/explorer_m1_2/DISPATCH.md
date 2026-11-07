## 2026-11-07T04:48:09Z
You are Milestone 1 Explorer 2 (Firestore Service Layer Specialist) for AquaPlus Service OS Inventory Management.

MANDATORY FIRST STEP:
Read the authoritative user request at:
c:\Users\nisan\Downloads\aquaplus-service\.agents\teamwork\ORIGINAL_REQUEST.md

Also read the project architecture, milestone breakdown, and interface contracts at:
c:\Users\nisan\Downloads\aquaplus-service\PROJECT.md

Your Working Directory:
c:\Users\nisan\Downloads\aquaplus-service\.agents\teamwork\explorer_m1_2\

Milestone 1 Scope:
Data Models, Firestore Persistence & Security Rules (Features 1, 2, 3, 4).

Your Specific Objective:
Investigate and design the exact Firestore data access layer in `src/services/dbService.ts` for Inventory Management.

Scope Boundaries:
- READ-ONLY exploration. DO NOT modify any production or test code.
- Write your findings and reports ONLY in your working directory.

Tasks:
1. Examine `src/services/dbService.ts` to inspect how customer, service record, and reminder operations are implemented (`onSnapshot` subscriptions, `withTimeout`, error handling via `handleFirestoreError`, batch writes, offline/sample data fallbacks).
2. Design exact functions to add:
   - `subscribeInventory(callback, onError)`: real-time `onSnapshot` listener on `inventory` collection (or `isSampleData` state).
   - `addInventoryItem(itemData)`: creates document with `doc(collection(db, 'inventory'))`, sets `createdAt`, `updatedAt`.
   - `updateInventoryItem(id, updates)`: updates fields and `updatedAt`.
   - `adjustInventoryQuantity(id, delta, reason)`: atomically increments/decrements quantity (clamps to >= 0) and records audit log.
   - `deleteInventoryItem(id)`: deletes item document.
3. Determine how sample/demo inventory data should be initialized and served when in sample data mode (`isSampleData: true`).
4. Recommend exact implementation plan for the Worker.

Output Requirements:
- Update progress.md with your liveness and status.
- Write your exploration report and recommendation to `c:\Users\nisan\Downloads\aquaplus-service\.agents\teamwork\explorer_m1_2\analysis.md`.
- Write your final `handoff.md` following the Handoff Protocol.
- Send a message to the orchestrator when completed.
