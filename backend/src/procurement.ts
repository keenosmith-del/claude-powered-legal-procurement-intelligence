import { query, transaction } from "./db.js";
import { AppError } from "./schemas.js";
import { compare } from "./financial.js";
export async function eventById(id: string) {
  const [event] = await query("SELECT * FROM procurement_events WHERE id=$1", [
    id,
  ]);
  if (!event) throw new AppError(404, "Procurement event not found");
  event.criteria = await query(
    "SELECT * FROM evaluation_criteria WHERE event_id=$1 ORDER BY category",
    [id],
  );
  return event;
}
export async function supplierById(id: string) {
  const [s] = await query("SELECT * FROM suppliers WHERE id=$1", [id]);
  if (!s) throw new AppError(404, "Supplier not found");
  return s;
}
export async function context(id: string) {
  const event = await eventById(id);
  const suppliers = await query(
    "SELECT * FROM suppliers WHERE event_id=$1 ORDER BY name",
    [id],
  );
  for (const s of suppliers) {
    s.contractTerms = await query(
      "SELECT t.*,d.filename FROM contract_terms t JOIN supplier_documents d ON d.id=t.source_document_id WHERE t.supplier_id=$1 ORDER BY t.created_at",
      [s.id],
    );
    s.documents = await query(
      "SELECT id,filename,processing_status,error,document_type FROM supplier_documents WHERE supplier_id=$1",
      [s.id],
    );
  }
  return { event, suppliers };
}
export async function comparison(id: string, persist = true) {
  const ctx = await context(id);
  const suppliers = compare(ctx.event, ctx.suppliers);
  if (persist)
    await transaction(async (c) => {
      for (const s of suppliers) {
        await c.query(
          "INSERT INTO supplier_evaluations(event_id,supplier_id,criterion_scores,deterministic_score) VALUES($1,$2,$3,$4) ON CONFLICT(event_id,supplier_id) DO UPDATE SET criterion_scores=excluded.criterion_scores,deterministic_score=excluded.deterministic_score",
          [id, s.id, JSON.stringify(s.criterionScores), s.deterministicScore],
        );
        for (const [type, value] of Object.entries({
          projectedTotal: s.financial?.total ?? null,
          contractValue: s.contractValue,
          paymentDays: s.paymentDays,
        }))
          await c.query(
            "INSERT INTO supplier_metrics(supplier_id,metric_type,value,unit,source) VALUES($1,$2,$3,$4,$5) ON CONFLICT(supplier_id,metric_type) DO UPDATE SET value=excluded.value,source=excluded.source",
            [
              s.id,
              type,
              JSON.stringify(value),
              type === "paymentDays" ? "days" : "ZAR",
              "deterministic financial engine",
            ],
          );
      }
    });
  return { event: ctx.event, suppliers };
}
export async function latestAnalysis(id: string) {
  const [a] = await query(
    "SELECT * FROM analyses WHERE event_id=$1 ORDER BY generated_at DESC LIMIT 1",
    [id],
  );
  if (!a) return null;
  const e = await eventById(id);
  return { ...a, stale: a.revision !== e.revision };
}
