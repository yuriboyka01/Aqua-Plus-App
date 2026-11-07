# Handoff Report: Gemini Vision Server Adapter & API Endpoint Architecture

**Agent**: Milestone 2 Explorer 1 (Gemini Vision Server Adapter & API Endpoint Specialist)  
**Milestone**: M2 (Gemini Vision AI Service & Image Pipeline)  
**Handoff Type**: Hard (Task Complete)  
**Date**: 2026-11-07  

---

## 1. Observation

1. **API Server Stream Processing & Body Limits**:
   - `src/server/apiMiddleware.ts:25`: `const BODY_LIMIT_BYTES = 16_384;` (16KB) is hardcoded.
   - `src/server/apiMiddleware.ts:70–85`:
     ```typescript
     async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
       const chunks: Buffer[] = [];
       let size = 0;
       for await (const chunk of req) {
         const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
         size += buffer.length;
         if (size > BODY_LIMIT_BYTES) throw new Error('Request body is too large.');
         chunks.push(buffer);
       }
       const raw = Buffer.concat(chunks).toString('utf8');
       const parsed = JSON.parse(raw || '{}');
       if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
         throw new Error('Expected a JSON object.');
       }
       return parsed as Record<string, unknown>;
     }
     ```
   - `src/server/apiMiddleware.ts:333`:
     ```typescript
     const status = message.includes('Request body is too large') ? 413 : message.includes('JSON') ? 400 : 500;
     ```
   - Neither `server.ts` nor `vite.config.ts` configures an Express or Connect body parser prior to `createApiMiddleware()`. Raw streams arrive directly into `createApiMiddleware()`.

2. **Official `@google/genai` (v2.4.0) SDK**:
   - `package.json:26`: `"@google/genai": "^2.4.0"`.
   - Verified via `npx tsx`:
     - `GoogleGenAI` class initialized via `new GoogleGenAI({ apiKey })`.
     - `Type` enum provides `STRING`, `NUMBER`, `INTEGER`, `BOOLEAN`, `ARRAY`, `OBJECT`, `NULL`.
     - `ai.models.generateContent({ model, contents, config })` accepts:
       - `contents`: `[{ inlineData: { mimeType, data } }, { text }]` where `data` is pure base64.
       - `config`: `{ responseMimeType: 'application/json', responseJsonSchema: <schema> }`.
       - `response.text` is a getter returning the generated JSON string.

3. **Domain Contracts in `src/types/index.ts`**:
   - Lines 235–244: `INVENTORY_CATEGORIES` contains exactly 10 categories (`spun_filter`, `ro_membrane`, `sediment_filter`, `carbon_block`, `post_carbon`, `booster_pump`, `smps_adapter`, `flow_restrictor`, `fittings_tubing`, `other`).
   - Lines 315–338: `VisionConfidence` (`high | medium | low`), `InventoryScanType` (`physical_parts | supplier_invoice | unrecognized`), `ScannedItemSuggestion`, and `InventoryScanResult`.
   - Lines 340–343: `InventoryScanRequest` (`imageBase64: string; mimeType: string`).

4. **Existing Test Suite Baseline**:
   - `npm test` runs `tsx --test tests/regressions.test.ts`:
     - Result: `ℹ tests 20, ℹ pass 20, ℹ fail 0, duration: 963ms`.
   - `npm run lint` runs `tsc --noEmit`: 0 errors.

---

## 2. Logic Chain

1. **Observation 1 → Safe Body Limiting**:
   - `readJsonBody(req)` currently hardcodes `BODY_LIMIT_BYTES` (16,384 bytes). Client-side compressed images are between 400KB and 1.2MB, which would be rejected immediately with HTTP 413 if sent through the default limit.
   - By converting `readJsonBody(req, limit = BODY_LIMIT_BYTES)` to accept an optional parameter with default `BODY_LIMIT_BYTES`, all existing endpoints (`/api/whatsapp/test`, `/api/whatsapp/send-reminder`, `/api/email/test`) remain guarded by the 16KB limit.
   - For `POST /api/inventory/scan`, passing `INVENTORY_SCAN_BODY_LIMIT_BYTES = 10 * 1024 * 1024` (10MB) allows image uploads while rejecting oversized payloads with HTTP 413.

2. **Observation 2 → Structured Multimodal Generation**:
   - The `@google/genai` SDK natively supports multimodal generation with `inlineData` and enforces structured JSON via `responseJsonSchema`.
   - Using `model: process.env.GEMINI_MODEL || 'gemini-2.5-flash'` with `temperature: 0.1` ensures fast inference and reproducible extraction of inventory parts and invoice tables.

3. **Observation 3 → Domain Schema & Category Alignment**:
   - The JSON schema must restrict the `category` property to the 10 enum values in `INVENTORY_CATEGORIES`.
   - Because AI models may generate variations or aliases (e.g. "pre-filter", "pump", "membrane"), a defensive normalization layer (`CATEGORY_ALIASES`) is necessary to map synonyms into valid enum members and default unknown items to `'other'`.
   - When `scanType` is `'unrecognized'`, `items` must be deterministically forced to `[]` to prevent phantom items from entering the review modal.

4. **Observations 1, 2, 3 → Unified Adapter Architecture**:
   - Creating `src/server/geminiVisionAdapter.ts` encapsulates all Gemini API interaction, prompt engineering, configuration checks, and defensive post-processing into a single module.
   - The endpoint in `src/server/apiMiddleware.ts` delegates to `scanInventoryWithGeminiVision()`, keeping routing, authentication, and HTTP response handling modular and clean.

---

## 3. Caveats

1. **Gemini API Key Availability**:
   - In offline test environments or CI runners without a valid `GEMINI_API_KEY`, live API calls will fail. The adapter anticipates this by exporting pure parsing/normalization functions (`parseAndNormalizeVisionResponse`) and allowing a mocked `GoogleGenAI` client override for automated testing.
2. **Rate Limiting**:
   - `isRateLimited(ownerId)` allows 8 requests per minute per owner UID. For human mobile technicians scanning parts, 8 scans/minute is generous; however, automated E2E tests should not trigger more than 8 scan requests within 60 seconds unless the rate-limit window resets.
3. **Client-Side Compression**:
   - The server accepts up to 10MB to accommodate uncompressed high-resolution photos, but Explorer 2's client-side canvas pre-processor should compress images to <1.2MB before upload to minimize network latency on Indian 4G/5G mobile connections.

---

## 4. Conclusion

The server-side vision adapter and scan endpoint architecture is fully designed, verified, and ready for immediate implementation by the Worker:
1. `src/server/geminiVisionAdapter.ts` will provide `scanInventoryWithGeminiVision`, `parseAndNormalizeVisionResponse`, `INVENTORY_SCAN_JSON_SCHEMA`, and `INVENTORY_SCAN_SYSTEM_PROMPT`.
2. `src/server/apiMiddleware.ts` will support `POST /api/inventory/scan` with 10MB body buffering, owner authentication, and error handling.
3. Complete implementation blueprints, diffs, and test specifications are documented in `.agents/teamwork/explorer_m2_1/analysis.md`.

---

## 5. Verification Method

1. **Type Checking**:
   ```bash
   npm run lint
   ```
   Must pass with 0 errors (`tsc --noEmit`).

2. **Automated Regression Suite**:
   ```bash
   npm test
   ```
   Must pass all existing 20 tests and any new inventory vision regression tests.

3. **Endpoint & Adapter Verification**:
   - Test `parseAndNormalizeVisionResponse` with physical parts, invoices, unrecognized images, and corrupted inputs.
   - Verify that `POST /api/inventory/scan` rejects unauthorized requests with 401/403.
   - Verify that bodies > 10MB return 413, while bodies < 10MB are parsed cleanly.
   - Verify that non-scan endpoints still reject bodies > 16KB with 413.
