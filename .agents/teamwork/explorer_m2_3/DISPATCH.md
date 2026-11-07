## 2026-11-07T05:17:15Z
You are Milestone 2 Explorer 3 (Frontend API Client & Fallback Error Strategy Specialist) for AquaPlus Service OS Inventory Management.

MANDATORY FIRST STEP:
Read the authoritative user request at:
c:\Users\nisan\Downloads\aquaplus-service\.agents\teamwork\ORIGINAL_REQUEST.md

Also read the project architecture, milestone breakdown, and interface contracts at:
c:\Users\nisan\Downloads\aquaplus-service\PROJECT.md

Your Working Directory:
c:\Users\nisan\Downloads\aquaplus-service\.agents\teamwork\explorer_m2_3\

Milestone 2 Scope:
Gemini Vision AI Service & Image Pipeline (Features 5, 6, 7, 8).

Your Specific Objective:
Investigate and design the client API service function `scanInventoryImage` in `src/services/apiService.ts`, error response normalization, 429 rate limit handling, and manual entry fallback flows.

Scope Boundaries:
- READ-ONLY exploration. DO NOT modify any production or test code.
- Write your findings and reports ONLY in your working directory.

Tasks:
1. Examine `src/services/apiService.ts`:
   - Inspect existing API calls (`sendWhatsAppMessage`, `fetchGatewayHealth`, `updateGatewaySettings`, etc.) and auth token handling (`getIdToken`).
   - Design `scanInventoryImage(imageBase64: string, mimeType: string): Promise<InventoryScanResult>`:
     - Attaches Authorization Bearer token from Firebase Auth.
     - Sends JSON `{ imageBase64, mimeType }` to `/api/inventory/scan`.
     - Parses `InventoryScanResult`.
2. Error Handling & Fallback Design:
   - Handle 401 Unauthorized (not authenticated as owner).
   - Handle 429 Quota Exceeded (friendly message: "AI scan quota temporarily exhausted. Please wait a moment or enter manually.").
   - Handle 500 / 503 / Missing GEMINI_API_KEY (friendly message with manual entry prompt).
   - Handle unreadable/blurry images (`scanType: 'unrecognized'`).
   - Network timeouts (25-second client abort controller).
3. Design mock fixtures for testing without calling live Gemini in CI.
4. Prepare detailed code implementation instructions for the Worker.

Output Requirements:
- Update progress.md with your liveness and status.
- Write your exploration report and recommendation to `c:\Users\nisan\Downloads\aquaplus-service\.agents\teamwork\explorer_m2_3\analysis.md`.
- Write your final `handoff.md` following the Handoff Protocol.
- Send a message to the orchestrator when completed.
