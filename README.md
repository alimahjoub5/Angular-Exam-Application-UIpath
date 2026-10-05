# UiPath Automation Developer Associate Exam Trainer

Angular 22 practice application for the **UiPath Automation Developer Associate** certification.

The app now supports two question sources:

- **AI-generated practice exams**: fresh English scenario-based questions generated through the OpenAI Responses API.
- **Local fallback bank**: the existing question bank is used automatically if the AI API is unavailable.

The AI prompt is designed to emphasize realistic troubleshooting, design choices, selectors, Orchestrator, DataTables, exception handling, Object Repository, testing, Workflow Analyzer, Integration Service, REFramework, and other Associate-level topics. It explicitly avoids leaked/recalled exam questions and exam dumps.

## Secure architecture

The browser never receives the OpenAI API key.

Angular calls:

```text
POST /api/generate-exam
```

The local Node server in `server.mjs` calls OpenAI and returns structured questions to Angular.

## Setup

Install dependencies:

```bash
npm install
```

Set your OpenAI API key in your shell:

macOS / Linux:

```bash
export OPENAI_API_KEY="your-api-key"
```

PowerShell:

```powershell
$env:OPENAI_API_KEY="your-api-key"
```

Optional: choose a different model:

```bash
export OPENAI_MODEL="gpt-5.6"
```

## Run locally

Use two terminals.

Terminal 1 — AI API:

```bash
npm run api
```

Terminal 2 — Angular:

```bash
npm start
```

Then open:

```text
http://localhost:4200
```

The Angular development server proxies `/api` requests to `http://localhost:3000`.

## Exam modes

### AI Practice Sprint

- 10 questions
- 30 minutes
- Fresh scenario-based question set

### Full Mock Exam

- 60 questions
- 90 minutes
- Broader topic coverage
- Designed to emphasize certification-style reasoning rather than memorization

## Fallback behavior

If `OPENAI_API_KEY` is missing, OpenAI is unavailable, or question generation fails, the app automatically starts an exam from the existing local question bank instead.

## Build

```bash
npm run build
```

## Tests

```bash
npm test
```

> This is an independent practice tool. The generated questions are not official UiPath or Pearson VUE exam questions.
