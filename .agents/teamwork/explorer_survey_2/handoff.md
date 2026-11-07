# Handoff Report: Backend, Database & AI Vision Exploration

**Agent:** `explorer_survey_2` (Backend, Database & AI Vision Explorer)  
**Task:** System Survey for AquaPlus Service OS Inventory Management  
**Status:** Hard Handoff (Exploration Complete)  
**Detailed Survey File:** `c:\Users\nisan\Downloads\aquaplus-service\.agents\teamwork\explorer_survey_2\survey_backend_ai.md`

---

## 1. Observation

1. **AI Vision SDK & Capability Declaration:**
   - In `package.json` line 25: `"@google/genai": "^2.4.0"` is installed.
   - In `metadata.json` line 5: `"majorCapabilities": ["MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API"]`.
   - In `.env.example` line 1–2: `# GEMINI_API_KEY: Required for Gemini AI API calls.\nGEMINI_API_KEY="MY_GEMINI_API_KEY"`.
   - In `server.ts` line 1: `import 'dotenv/config'`.
   - In `vite.config.ts` line 1: `import 'dotenv/config'`.
2. **Server Middleware & Request Body Limits:**
   - In `src/server/apiMiddleware.ts` line 25: `const BODY_LIMIT_BYTES = 16_384;` (16 KB).
   - In `src/server/apiMiddleware.ts` line 76: `if (size > BODY_LIMIT_BYTES) throw new Error('Request body is too large.');`.
   - In `src/server/apiMiddleware.ts` line 173: `const owner = await authenticateOwner(req);` checks Firebase Bearer ID tokens against `OWNER_EMAILS`.
3. **Persistence & Security Rules:**
   - In `src/lib/firebase.ts` lines 11–16: `firestore = initializeFirestore(app, { ignoreUndefinedProperties: true }, firebaseConfig.firestoreDatabaseId)`.
   - In `firestore.rules` line 7: `match /{document=**} { allow read, write: if false; }`.
   - In `firestore.rules` lines 46, 57, 69, 79, 88, 95: All document schemas strictly enforce whitelisted keys with `data.keys().hasOnly([...])`.
   - Currently defined collections: `customers`, `serviceRecords`, `reminders`, `messageAttempts`, `messageDeliveryStatus`, `ownerReports`, `settings`, `auditEvents`. There is no `inventory` collection yet.
4. **Camera & Image Handling:**
   - In `package.json`: `@capacitor/camera` is not in `dependencies` or `devDependencies`.
   - In `android/app/src/main/AndroidManifest.xml` line 41: only `<uses-permission android:name="android.permission.INTERNET" />` is declared (no camera permissions).
   - In `server.ts` line 20: `response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');`.
5. **Service Records & Spare Parts:**
   - In `src/types/index.ts` lines 72–75: `filtersReplaced?: string; serviceCharge: number; partsCharge: number; totalAmount: number;`.
   - In `src/components/RecordServiceModal.tsx` lines 354–382: `filtersReplaced` is a text field with quick-insert tags (`5µ Spun Filter`, `Carbon Block`, `TFC RO Membrane`, `Post-Carbon / Mineral`, `Flow Restrictor 450`, `Booster Pump SMPS`).
   - In `src/services/dbService.ts` lines 219–241: `recordCompletedService` performs an atomic Firestore `writeBatch(db)` writing `serviceRecords`, `customers`, and `reminders`.
6. **Existing Test Suite Baseline:**
   - Command `npm test` (`tsx --test tests/regressions.test.ts`) executed cleanly:
     `ℹ tests 16, ℹ pass 16, ℹ fail 0, ℹ duration_ms 523.5844`.

---

## 2. Logic Chain

1. **Persistence Strategy:**
   - From Observation 3, Firestore enforces strict default-deny and field whitelisting via `hasOnly`.
   - Therefore, introducing an `inventory` collection requires adding `isValidInventoryItem` and `match /inventory/{itemId}` to `firestore.rules`.
   - The data access layer in `src/services/dbService.ts` must provide real-time subscriptions (`subscribeInventory`), CRUD operations (`addInventoryItem`, `updateInventoryItem`, `deleteInventoryItem`), and stock adjustments (`adjustInventoryQuantity`) following the exact same `withTimeout` and `handleFirestoreError` patterns used for `customers`.
2. **AI Vision & Gemini Security:**
   - From Observation 1, `@google/genai` is installed and `metadata.json` explicitly mandates `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`.
   - From Observation 2, all API calls (`/api/*`) are authenticated with Firebase ID tokens, keeping `GEMINI_API_KEY` strictly on the server.
   - However, from Observation 2, `BODY_LIMIT_BYTES` is 16 KB. An image scan endpoint (`POST /api/inventory/scan`) will fail with HTTP 413 unless it reads the request body using a larger buffer limit (`10 * 1024 * 1024` bytes).
   - The vision adapter should use `@google/genai` with model `gemini-3.8-flash` and typed JSON schema (`responseJsonSchema`) to extract line items (item name, category, quantity, unit cost) for spare parts and supplier bills.
3. **Camera & Cross-Platform File Capture:**
   - From Observation 4, native camera plugins and Android permissions are absent, and `server.ts` sets `Permissions-Policy: camera=()`.
   - Standard HTML5 `<input type="file" accept="image/*" capture="environment">` with drag-and-drop does NOT rely on browser `getUserMedia()` and does NOT require native plugins or manifest permissions.
   - Android's WebView (`WebChromeClient`) automatically handles `<input type="file">` by launching the system intent allowing the user to either capture with the device camera or choose from gallery/files.
   - Resizing images via HTML `<canvas>` before upload to ~1600px reduces image size to 200–400 KB, ensuring rapid upload on mobile connections.
4. **Service Records Linkage:**
   - From Observation 5, `ServiceRecord` already has `filtersReplaced` (string) and `partsCharge` (number) whitelisted in `firestore.rules`.
   - In `RecordServiceModal`, technicians can select spare parts from inventory. The UI will automatically calculate `partsCharge` and generate a structured description in `filtersReplaced`.
   - During `recordCompletedService`, the selected part quantities can be deducted atomically from the `inventory` collection inside the existing `writeBatch(db)` transaction.
5. **Fixtures & Testing:**
   - From Observation 6, regression tests run synchronously with Node's native test runner (`tsx --test`).
   - Mock fixtures for inventory items, low-stock threshold triggers, and mock Gemini responses can be added directly to `tests/regressions.test.ts` to ensure automated test coverage without relying on external live API calls during CI.

---

## 3. Caveats

1. **Live Firestore Security Rule Deployment:**
   - In local development (`npm run dev`), the client talks directly to Cloud Firestore (`ai-studio-4b6f33c0-20b1-4c18-b179-368ff6878ffb`).
   - If security rules in `firestore.rules` are edited locally, they must be deployed to Google Cloud Firestore (`firebase deploy --only firestore:rules`) or tested in the emulator (`npm run test:rules`) before live client writes will succeed against the live cloud instance.
2. **Gemini API Key Availability:**
   - When running locally, `GEMINI_API_KEY` must be populated in `.env`. If not provided or set to a placeholder, the scan endpoint must fail gracefully and return a descriptive error message to the user while allowing manual entry.
3. **No Caveats on Application Code Alteration:**
   - No application code or test files were altered during this survey.

---

## 4. Conclusion

The architecture of AquaPlus Service OS is clean, modular, and ideally suited for the Inventory Management feature:
1. **Database:** Firestore with a new `inventory` collection, `isValidInventoryItem` security rule, and reactive client subscription in `dbService.ts`.
2. **AI Vision:** Server-side proxy in `src/server/geminiVisionAdapter.ts` using `@google/genai` v2.4.0 (`gemini-3.8-flash`) behind `POST /api/inventory/scan`, with an increased body limit for the scan endpoint.
3. **Capture:** HTML5 `<input type="file" accept="image/*" capture="environment">` + canvas compression + drag-and-drop.
4. **Linkage:** Direct integration with `RecordServiceModal` and atomic stock deduction in `dbService.recordCompletedService`.
5. **Validation:** Full unit and regression test suite runnable via `npm test`.

---

## 5. Verification Method

To independently verify the observations and conclusions:
1. **Inspect Dependencies & Config:**
   - `view_file` on `package.json` lines 21–25: confirm `@google/genai` is present.
   - `view_file` on `metadata.json` line 5: confirm `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`.
   - `view_file` on `src/server/apiMiddleware.ts` lines 25–26: confirm 16 KB `BODY_LIMIT_BYTES`.
2. **Inspect Firestore Rules Schema Whitelist:**
   - `view_file` on `firestore.rules` lines 46, 57, 69: confirm `data.keys().hasOnly(...)`.
3. **Run Existing Test Suite:**
   - Command: `npm test`
   - Expected Output: 16 passing tests, 0 failures.
