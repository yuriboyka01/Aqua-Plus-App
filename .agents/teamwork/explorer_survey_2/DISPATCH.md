## 2026-11-07T04:36:58Z
From: 82b388ef-0a5a-4885-aa62-c369f2983e1b
Priority: MESSAGE_PRIORITY_HIGH

You are the Backend, Database & AI Vision Explorer for the AquaPlus Service OS Inventory Management feature.

MANDATORY FIRST STEP:
Read the authoritative user request at:
c:\Users\nisan\Downloads\aquaplus-service\.agents\teamwork\ORIGINAL_REQUEST.md

Your Working Directory:
c:\Users\nisan\Downloads\aquaplus-service\.agents\teamwork\explorer_survey_2\

Objective:
Investigate the data layer, persistence strategy, AI vision service integration, camera/file upload mechanisms, and service record linkage in AquaPlus Service OS.

Scope Boundaries:
- READ-ONLY investigation. DO NOT modify or write any application code or test files.
- Write your findings, plans, progress, and handoff report ONLY in your working directory.

Tasks:
1. Examine data storage and persistence: How are entities (customers, jobs/services, settings) currently stored and accessed? (Firebase/Firestore, local storage, indexedDB, or in-memory mock services/repositories). What is the existing data access pattern?
2. Examine AI Vision & Gemini integration: Are there existing AI or Gemini API calls? What SDK is installed (`@google/genai` or `@google/generative-ai` or Firebase AI Logic or custom REST)? How are API keys configured (e.g. `VITE_GEMINI_API_KEY` or backend proxy)? How should Gemini Vision prompts and schemas be structured for parsing spare parts and supplier invoices?
3. Examine Image Capture / Upload: How does the app handle images? Does it use `@capacitor/camera`, standard HTML file input (`<input type="file" accept="image/*" capture />`), drag-and-drop, or base64 data URLs? How does it function across web browser and Capacitor mobile shell?
4. Examine Service Records / Jobs linkage: How do service records or work orders track used spare parts or replacement parts? How can inventory deduction or spare parts linkage be associated with services?
5. Identify existing sample files, fixtures, or mocks in the repository (e.g. sample images, test mocks).

Output Requirements:
- Update progress.md with your liveness and status.
- Write a detailed survey report to `c:\Users\nisan\Downloads\aquaplus-service\.agents\teamwork\explorer_survey_2\survey_backend_ai.md`.
- Write your final `handoff.md` in your working directory following the Handoff Protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method).
- Send a message to the orchestrator when completed with the path to your handoff report.

Completion Criteria:
Data models, persistence architecture, Gemini Vision AI implementation pathway, image capture approach, and service record connection points thoroughly analyzed and documented in survey_backend_ai.md and handoff.md.
