import request from "supertest";
import assert from "node:assert/strict";
import { app } from "../src/app.js";
import { pool, query } from "../src/db.js";
import { root } from "../src/config.js";
import path from "node:path";
const api = request(app);
let created: string | undefined;
try {
  assert.equal((await api.get("/api/health")).status, 200);
  const events = (await api.get("/api/procurement-events")).body;
  assert(events.length > 0, "Run db:seed first");
  const id = events.find(
    (e: any) => e.title === "Enterprise Infrastructure Support Procurement",
  ).id;
  const event = (await api.get(`/api/procurement-events/${id}`)).body;
  assert.equal(
    (await api.post("/api/procurement-events").send({ title: "bad" })).status,
    400,
  );
  const made = await api.post("/api/procurement-events").send({
    title: "Backend verification event",
    category: "IT",
    description: "Temporary verification",
    requirements: event.requirements,
    criteria: event.criteria.map((c: any) => ({
      category: c.category,
      weight: Number(c.weight),
      description: c.description,
    })),
  });
  assert.equal(made.status, 201);
  created = made.body.id;
  const supplier = await api
    .post(`/api/procurement-events/${created}/suppliers`)
    .send({ name: "Verification supplier" });
  assert.equal(supplier.status, 201);
  const upload = await api
    .post(`/api/suppliers/${supplier.body.id}/documents`)
    .field("documentType", "contract")
    .attach(
      "file",
      path.join(root, "documents/sample/Supplier-A-contract.txt"),
    );
  assert.equal(upload.status, 201, JSON.stringify(upload.body));
  const document = (await api.get(`/api/documents/${upload.body.id}`)).body;
  assert(document.extracted_text.includes("Annual recurring price"));
  assert(document.chunks.length);
  assert.equal(
    (await api.get(`/api/documents/${upload.body.id}/download`)).status,
    200,
  );
  const suppliers = (await api.get(`/api/procurement-events/${id}/suppliers`))
    .body;
  assert.equal(suppliers.length, 3);
  const terms = (await api.get(`/api/procurement-events/${id}/terms`)).body;
  assert(terms.length >= 60);
  for (const t of terms) {
    const d = (await api.get(`/api/documents/${t.source_document_id}`)).body;
    assert(d.extracted_text.includes(t.excerpt));
  }
  const comp = (await api.get(`/api/procurement-events/${id}/comparison`)).body;
  assert(
    comp.suppliers.every(
      (s: any) => s.financial && s.deterministicScore !== null,
    ),
  );
  assert.equal(
    (await query("SELECT * FROM supplier_evaluations WHERE event_id=$1", [id]))
      .length,
    3,
  );
  const b = comp.suppliers.find((s: any) => s.name === "Supplier B");
  assert(b.deviations.some((d: any) => d.field === "escalationPercent"));
  const scenario = await api
    .post(`/api/procurement-events/${id}/what-if`)
    .send({ supplierId: b.id, changes: { escalationPercent: 5 } });
  assert.equal(scenario.status, 200, JSON.stringify(scenario.body));
  assert(scenario.body.projectedCostDelta < 0);
  assert.equal(
    (
      await api.get(`/api/procurement-events/${id}/comparison`)
    ).body.suppliers.find((s: any) => s.id === b.id).terms.escalationPercent,
    8,
  );
  assert.equal(
    (
      await api
        .post(`/api/procurement-events/${id}/what-if`)
        .send({ supplierId: b.id, changes: { escalationPercent: -5 } })
    ).status,
    400,
  );
  if (process.env.VERIFY_REAL_AI === "1") {
    assert(
      process.env.ANTHROPIC_API_KEY,
      "Set ANTHROPIC_API_KEY for real verification",
    );
    for (const s of suppliers) {
      const docs = (await api.get(`/api/suppliers/${s.id}/documents`)).body;
      for (const d of docs) {
        const ex = await api.post(`/api/documents/${d.id}/extract`);
        assert.equal(ex.status, 200, JSON.stringify(ex.body));
      }
    }
    const a = await api.post(`/api/procurement-events/${id}/analyse`);
    assert.equal(a.status, 200, JSON.stringify(a.body));
    assert(a.body.result.recommendation.recommendedSupplierId);
    assert(
      a.body.trace.some((t: any) => t.stage === "tool.completed"),
      "Real workflow must demonstrate tool use",
    );
    assert(
      (await api.get(`/api/procurement-events/${id}/evidence`)).body.length,
    );
    assert.equal(
      (await api.get(`/api/procurement-events/${id}/analysis`)).body.id,
      a.body.id,
    );
  } else if (!process.env.ANTHROPIC_API_KEY) {
    assert.equal(
      (await api.post(`/api/documents/${upload.body.id}/extract`)).status,
      503,
    );
    assert.equal(
      (await api.post(`/api/procurement-events/${id}/analyse`)).status,
      503,
    );
    console.log(
      "Real Claude verification skipped: no API key. No synthetic analysis inserted.",
    );
  }
  const decision = await api
    .post(`/api/procurement-events/${created}/decision`)
    .send({
      outcome: "defer",
      selectedSupplierId: null,
      notes: "Awaiting procurement review and supplier evidence.",
      negotiationRequired: true,
    });
  assert.equal(decision.status, 201);
  assert(
    (await api.get(`/api/procurement-events/${created}/audit`)).body.some(
      (a: any) => a.event_type === "decision.recorded",
    ),
  );
  assert.equal(
    (await api.get("/api/procurement-events/not-a-uuid")).status,
    400,
  );
  console.log(
    "PASS: real PostgreSQL, event creation, upload, text, evidence, calculations, evaluation, scenarios, decisions and audit.",
  );
} finally {
  if (created)
    await query("DELETE FROM procurement_events WHERE id=$1", [created]);
  await pool.end();
}
