# Focused AI evaluations

The runner uses actual stored Claude analysis. No sample AI answer is accepted as the application result.

| Scenario | Expected behavior |
| --- | --- |
| B is cheapest but escalates 8% | Identify escalation exposure and a target/fallback negotiation |
| C has stronger protections at a premium | Explain cost/protection trade-off |
| Any supplier is recommended | Preserve supplier-specific source evidence |
| Analysis needs clause/scenario context | Use real application tools |

Run `npm run evaluate` after analysis, or `EVALUATE_REAL_AI=1 npm run evaluate` to invoke Claude. Use `VERIFY_REAL_AI=1 npm run verify` for the complete extraction-to-analysis path. Both require configured PostgreSQL and an Anthropic API key for new AI calls. The runner exits nonzero when expectations fail. Keyword checks are a small regression mechanism, not an evaluation of legal accuracy.
