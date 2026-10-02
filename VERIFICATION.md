# Verification record

Final functional checkpoint: 2 October 2026 (Africa/Johannesburg).

The existing React/Express/PostgreSQL architecture, official Anthropic SDK, sample documents, deterministic engine and routed frontend were retained. No UI redesign or deployment infrastructure was added.

## Repairs

- Re-extraction previously deleted terms referenced by saved analysis evidence, violating PostgreSQL foreign keys. Migration `002_term_history.sql` adds active/superseded terms; current comparison excludes superseded facts while historical evidence remains inspectable.
- Supplier creation and document upload now commit their data, event revision and audit together under the event lock. Comparison rejects changed revisions before persisting calculated results. Supplier editing uses the same revision/transaction boundary.
- Each AI tool validates its own exact arguments and stays event scoped. Requirement-only scenario assumptions and event revisions are now audited.
- Invalid UTF-8 and corrupt/unreadable documents return useful errors. Failed uploads roll back metadata and remove files; failed extraction retains prior valid terms.
- Frontend evidence references resolve historical term IDs. Workspace loads ignore responses for previously opened events. Scenarios clear after input revisions or failed requests; stale acceptance is disabled. Comparison includes setup, duration, support and unknown fields and does not label foreign currency annual prices as ZAR. Event listing has a loading state.
- Integration tests use isolated events instead of changing the demo. Verification cleans uploaded files and checks real API restart persistence.

## Executed checks

| Check | Result |
| --- | --- |
| Additive migration and idempotent sample seed | Passed against Docker PostgreSQL on port 5433; existing demo retained |
| Backend and frontend build | Passed |
| Existing tests with `TEST_DATABASE=1` | 20 passed, including test-only mocked extraction/analysis, historical evidence retention and stale acceptance rejection |
| `npm run verify` | Passed: event creation, supplier edit/revision, real TXT upload/text/download, source excerpts, three-supplier comparison, persisted scores, scenario without original-fact changes, human defer decision and audit |
| Direct supported-file checks | Passed: genuine text-bearing PDF and DOCX uploads/text storage; corrupt DOCX returns 422, invalid UTF-8 returns 415; failed uploads retain document count and revision |
| API restart persistence | Passed: event, source text/file, decision and comparison read through two separately started API processes |
| Missing-key behavior | Passed: extraction and analysis return 503; no fabricated success |
| Fresh browser automation | Blocked by browser tool: in-app tab attachment failed, Chrome unavailable, Safari automation timed out. Frontend inspected and compiled; earlier browser checks from 30 September are not claimed as a fresh pass |
| Live Anthropic extraction/tool calling/analysis | **Blocked: no `ANTHROPIC_API_KEY` configured**. Mocked tests do not establish real model behavior |

No temporary synthetic analysis is retained, and no real supplier was accepted/rejected on the user's behalf. TXT processing and source download were exercised through integrated verification. PDF/DOCX uploads were checked separately through the real API with disposable fixtures (a generated text-bearing PDF and Mammoth's table DOCX fixture), not through live Claude. Scanned PDFs require external OCR; this remains a single-user local application without production authentication or multi-currency conversion.

## Start and demonstrate

```sh
# From the repository root; start Docker Desktop first.
# On a fresh checkout only: cp .env.example .env && npm ci

docker compose up -d --wait
npm run db:migrate
npm run db:seed
npm run dev
```

Open http://127.0.0.1:5173 and select **Enterprise Infrastructure Support Procurement**. Inspect Supplier A/B/C documents, current facts and comparison. In Financial analysis, set Supplier B escalation to 5%; deterministic five-year savings should be R716,036.39. Original terms remain unchanged. Human decisions and audit are persisted.

Required local configuration is described in README: `DATABASE_URL` (Compose host port 5433), `POSTGRES_PORT`, `PORT` (3001), `FRONTEND_URL`, `DOCUMENT_STORAGE`, and `ANTHROPIC_MODEL` (default `claude-sonnet-4-6`). AI requires a server-side `ANTHROPIC_API_KEY` in the ignored root `.env`. Never put it in a frontend/Vite variable.

To finish the live acceptance checkpoint:

```sh
# Add ANTHROPIC_API_KEY to .env and restart the development backend.
VERIFY_REAL_AI=1 npm run verify
npm run evaluate
```

The live verification incurs API usage, re-extracts all six demo documents, and persists a real analysis/tool trace. It never substitutes a mock. Review recommendation evidence, risks, playbook and negotiation proposals; record your own human decision, reload, then edit requirements and confirm analysis becomes stale. Port 3002 must be free for verification's temporary restart check. Fresh browser interaction remains a manual check to finish alongside live AI.

**Verdict: NOT READY for unconditional full-lifecycle sign-off.** Feasible repairs and local backend verification are complete, but the central live Claude lifecycle has not been demonstrated without credentials. This is an external verification blocker, not a recommendation to rebuild the backend. No production/multi-user security claim is made.
