import { query, pool } from "../backend/src/db.js";
import { latestAnalysis, comparison } from "../backend/src/procurement.js";
import { analyse } from "../backend/src/analysis.js";
const [event] = await query(
  "SELECT id FROM procurement_events WHERE title='Enterprise Infrastructure Support Procurement'",
);
if (!event) throw new Error("Seed the demonstration first");
try {
  const a =
    process.env.EVALUATE_REAL_AI === "1"
      ? await analyse(event.id)
      : await latestAnalysis(event.id);
  if (!a)
    throw new Error(
      "No analysis available. Run real Claude analysis first, or EVALUATE_REAL_AI=1 npm run evaluate.",
    );
  if (a.stale) throw new Error("Analysis is stale. Re-run analysis.");
  const ctx = await comparison(event.id, false);
  const b = ctx.suppliers.find((s: any) => s.name === "Supplier B")!;
  const c = ctx.suppliers.find((s: any) => s.name === "Supplier C")!;
  const result = a.result;
  const checks = [
    {
      scenario: "Cheapest supplier carries escalation exposure",
      pass: result.risks.some(
        (r: any) =>
          r.supplierId === b.id &&
          /escalat|price increase/i.test(r.title + " " + r.explanation),
      ),
    },
    {
      scenario: "Escalation negotiation includes target and fallback",
      pass: result.negotiationOpportunities.some(
        (n: any) =>
          n.supplierId === b.id &&
          /escalat/i.test(n.issue) &&
          n.targetPosition &&
          n.fallbackPosition,
      ),
    },
    {
      scenario: "Premium supplier cost/protection trade-off is explained",
      pass: result.tradeoffs.some(
        (t: any) =>
          (t.supplierA === c.id || t.supplierB === c.id) &&
          /cost|price|premium|budget/i.test(t.tradeoff + " " + t.conclusion),
      ),
    },
    {
      scenario: "Recommendation remains evidence-backed",
      pass: result.claims.some(
        (r: any) =>
          r.supplierId === result.recommendation.recommendedSupplierId &&
          r.evidenceReferences.length,
      ),
    },
    {
      scenario: "Claude uses real application tools",
      pass: a.trace.some((t: any) => t.stage === "tool.completed"),
    },
  ];
  console.table(checks);
  if (checks.some((c) => !c.pass)) process.exitCode = 1;
} finally {
  await pool.end();
}
