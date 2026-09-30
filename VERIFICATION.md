# Verification record

Verified locally on 30 September 2026.

| Check | Result |
| --- | --- |
| Backend TypeScript build | Passed |
| Frontend TypeScript + Vite production build | Passed, including unused import/parameter checks |
| Unit tests without credentials/database | 18 passing; database-only cases skipped |
| PostgreSQL-inclusive suite with mocked Anthropic transport | 20 passing |
| Real PostgreSQL API workflow | Passed: create event, add supplier, upload/read/download source, trace seed facts, calculate projections, persist scores, recalculate scenarios, record decision and audit |
| Structured AI persistence using test-only mocked transport | Passed: tool dispatch, validation, analysis/risk/opportunity/evidence storage and retrieval |
| Extraction using test-only mocked transport | Passed: source validation, term persistence and retention of earlier terms after invalid re-extraction |
| Browser checks | Passed: demo navigation, comparison, financial table, 8%-to-5% escalation scenario and clear missing-key error |
| Dependency audit after Vitest update | Zero known vulnerabilities reported |
| Actual Anthropic extraction/reasoning/evaluation | **Not verified: no API key configured** |
| Docker Compose execution | Passed after opening Docker Desktop; container is healthy on host port 5433, existing project data was preserved and the API workflow was verified against Docker PostgreSQL |

No synthetic recommendations remain in the application. Test analysis records are removed by test cleanup. Seed terms are labelled reviewed sample facts, not AI output. No procurement supplier decision was made for the user.

The unverified live AI acceptance path is executable with:

```sh
# Set ANTHROPIC_API_KEY in .env, then:
VERIFY_REAL_AI=1 npm run verify
npm run evaluate
```

This performs actual extraction on the six demonstration documents, runs actual Claude reasoning/tools, stores the analysis and checks the focused evaluation scenarios. It incurs API usage and changes the demo's extracted terms and analysis. Restart the development backend after changing its environment configuration.
