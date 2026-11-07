## 2026-11-07T04:48:16Z
[Message] timestamp=2026-11-07T04:48:16Z sender=82b388ef-0a5a-4885-aa62-c369f2983e1b priority=MESSAGE_PRIORITY_HIGH
You are Milestone 1 Explorer 3 (Security Rules & Seed Data Specialist) for AquaPlus Service OS Inventory Management.

MANDATORY FIRST STEP:
Read the authoritative user request at:
c:\Users\nisan\Downloads\aquaplus-service\.agents\teamwork\ORIGINAL_REQUEST.md

Also read the project architecture, milestone breakdown, and interface contracts at:
c:\Users\nisan\Downloads\aquaplus-service\PROJECT.md

Your Working Directory:
c:\Users\nisan\Downloads\aquaplus-service\.agents\teamwork\explorer_m1_3\

Milestone 1 Scope:
Data Models, Firestore Persistence & Security Rules (Features 1, 2, 3, 4).

Your Specific Objective:
Investigate and design the exact Firestore security rules in `firestore.rules` and realistic sample RO inventory seed data.

Scope Boundaries:
- READ-ONLY exploration. DO NOT modify any production or test code.
- Write your findings and reports ONLY in your working directory.

Tasks:
1. Examine `firestore.rules` to inspect existing helper functions (`isAuthorizedOwnerAccount`, `isValidCustomer`, `isValidServiceRecord`, `keys().hasOnly(...)`).
2. Design the exact rule additions for the new `inventory` collection:
   - Helper function `isValidInventoryItem(data)`: validates all required and optional keys, types (string, number, timestamp/ISO string), constraints (`quantity >= 0`, `lowStockThreshold >= 0`, `unitCost >= 0`, `sellingPrice >= 0`, category validation).
   - Match rule `/inventory/{itemId}`: allows read, create, update, delete only for authorized owner accounts.
3. Design realistic sample RO inventory items (e.g. 5µ Spun Filter, 75 GPD TFC RO Membrane, Carbon Block Filter, Post Carbon Filter, 100 GPD Booster Pump, 24V SMPS Adapter, Flow Restrictor 450, 1/4" RO Tubing) with various stock states (healthy stock, low stock, out of stock) for initial demo seed.
4. Recommend exact implementation plan for the Worker.

Output Requirements:
- Update progress.md with your liveness and status.
- Write your exploration report and recommendation to `c:\Users\nisan\Downloads\aquaplus-service\.agents\teamwork\explorer_m1_3\analysis.md`.
- Write your final `handoff.md` following the Handoff Protocol.
- Send a message to the orchestrator when completed.
