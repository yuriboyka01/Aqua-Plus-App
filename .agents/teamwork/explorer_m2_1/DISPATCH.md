## 2026-11-07T05:16:55Z
You are Milestone 2 Explorer 1 (Gemini Vision Server Adapter & API Endpoint Specialist) for AquaPlus Service OS Inventory Management.

MANDATORY FIRST STEP:
Read the authoritative user request at:
c:\Users\nisan\Downloads\aquaplus-service\.agents\teamwork\ORIGINAL_REQUEST.md

Also read the project architecture, milestone breakdown, and interface contracts at:
c:\Users\nisan\Downloads\aquaplus-service\PROJECT.md

Your Working Directory:
c:\Users\nisan\Downloads\aquaplus-service\.agents\teamwork\explorer_m2_1\

Milestone 2 Scope:
Gemini Vision AI Service & Image Pipeline (Features 5, 6, 7, 8).

Your Specific Objective:
Investigate and design the server-side Gemini Vision adapter in `src/server/geminiVisionAdapter.ts` and the endpoint `POST /api/inventory/scan` in `src/server/apiMiddleware.ts`.

Scope Boundaries:
- READ-ONLY exploration. DO NOT modify any production or test code.
- Write your findings and reports ONLY in your working directory.

Tasks:
1. Examine `src/server/apiMiddleware.ts`:
   - Inspect existing `/api/*` endpoints, authentication via `authenticateOwner(req)`, error handling, and `BODY_LIMIT_BYTES = 16_384`.
   - Design how to handle `POST /api/inventory/scan` with a 10MB body limit (`10 * 1024 * 1024` bytes) without breaking existing endpoints.
2. Examine `@google/genai` (v2.4.0) SDK installed in `package.json`:
   - How to initialize `GoogleGenAI` using `process.env.GEMINI_API_KEY`.
   - Which model to call (e.g. `gemini-2.5-flash` or `gemini-3.8-flash` / `gemini-2.5-flash-preview`).
   - How to pass inline image data: `{ inlineData: { mimeType, data: imageBase64 } }`.
   - How to specify structured output with `responseMimeType: "application/json"` and `responseJsonSchema` matching `InventoryScanResult` contract from `PROJECT.md`.
3. Design prompt instructions for dual document types:
   - Physical spare parts: identify part type (spun filter, RO membrane, booster pump, etc.), count quantity visible, note condition/specs.
   - Supplier invoice/bill: extract supplier name, bill number, date, itemized table of spare parts, quantities, and unit costs.
   - Unrecognized images: return `scanType: 'unrecognized'` and empty items list with descriptive explanation.
4. Prepare detailed code diffs and implementation instructions for the Worker.

Output Requirements:
- Update progress.md with your liveness and status.
- Write your exploration report and recommendation to `c:\Users\nisan\Downloads\aquaplus-service\.agents\teamwork\explorer_m2_1\analysis.md`.
- Write your final `handoff.md` following the Handoff Protocol.
- Send a message to the orchestrator when completed.
