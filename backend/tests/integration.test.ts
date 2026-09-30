import { it, expect, vi, afterAll } from "vitest";
import request from "supertest";
const create = vi.hoisted(() => vi.fn());
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create };
  },
}));
import { app } from "../src/app.js";
import { query, pool } from "../src/db.js";
import { comparison } from "../src/procurement.js";
import { analysisSchema } from "../src/schemas.js";
import { validateGrounding } from "../src/analysis.js";
const enabled = process.env.TEST_DATABASE === "1";
afterAll(async () => pool.end());
it.skipIf(!enabled)(
  "persists structured Claude results, risks, negotiations and evidence atomically using a mocked transport",
  async () => {
    const [event] = await query(
      "SELECT id FROM procurement_events WHERE title='Enterprise Infrastructure Support Procurement'",
    );
    expect(event).toBeTruthy();
    const ctx = await comparison(event.id);
    const s = ctx.suppliers[0],
      other = ctx.suppliers[1];
    const ref = s.contractTerms[0].id;
    let id: string | undefined;
    const result = analysisSchema.parse({
      recommendation: {
        recommendedSupplierId: s.id,
        recommendationSummary:
          "Test fixture: conditional review recommendation",
        confidence: "low",
        keyReasons: ["Test fixture grounded in submitted evidence"],
      },
      supplierAssessments: ctx.suppliers.map((p: any) => ({
        supplierId: p.id,
        overallAssessment: "Test fixture",
        strengths: [],
        weaknesses: [],
        materialRisks: [],
        commercialPosition: "Test fixture",
        requirementAlignment: "Test fixture",
      })),
      tradeoffs: [
        {
          tradeoff: "Test fixture",
          supplierA: s.id,
          supplierB: other.id,
          significance: "Test fixture",
          conclusion: "Test fixture",
        },
      ],
      risks: [
        {
          supplierId: s.id,
          category: "pricing",
          severity: "high",
          title: "Test fixture",
          explanation: "Test fixture",
          businessImpact: "Test fixture",
          evidenceReferences: [ref],
          mitigation: "Review",
        },
      ],
      negotiationOpportunities: [
        {
          supplierId: s.id,
          issue: "Test fixture",
          priority: "high",
          currentPosition: "Test fixture",
          targetPosition: "Test fixture",
          fallbackPosition: "Test fixture",
          rationale: "Test fixture",
          expectedImpact: "Test fixture",
          evidenceReferences: [ref],
        },
      ],
      decisionFactors: [
        {
          factor: "Test fixture",
          importance: "High",
          evidenceReferences: [ref],
          conclusion: "Test fixture",
        },
      ],
      claims: [
        {
          supplierId: s.id,
          claim: "Test fixture",
          evidenceReferences: [ref],
          evidenceType: "interpretation",
        },
      ],
      playbook: {
        leveragePoints: [],
        priorityIssues: [],
        requestedConcessions: [],
        fallbackPositions: [],
        commercialRationale: "Test fixture",
        risksToAvoid: [],
        sequence: [
          {
            step: 1,
            action: "Review",
            concessionLogic: "Test fixture",
            evidenceReferences: [ref],
          },
        ],
      },
      limitations: ["Mock transport; not an actual AI analysis"],
    });
    expect(() =>
      validateGrounding(
        { ...result, claims: [{ ...result.claims[0], supplierId: other.id }] },
        ctx,
      ),
    ).toThrow("cross-supplier");
    process.env.ANTHROPIC_API_KEY = "test-transport-only";
    create
      .mockResolvedValueOnce({
        content: [
          {
            type: "tool_use",
            name: "get_contract_evidence",
            input: { termId: ref },
            id: "tool1",
          },
        ],
        stop_reason: "tool_use",
        usage: { input_tokens: 1, output_tokens: 1 },
      })
      .mockResolvedValueOnce({
        content: [{ type: "text", text: JSON.stringify(result) }],
        stop_reason: "end_turn",
        usage: { input_tokens: 1, output_tokens: 1 },
      });
    try {
      const response = await request(app).post(
        `/api/procurement-events/${event.id}/analyse`,
      );
      expect(response.status, response.body.error).toBe(200);
      id = response.body.id;
      expect(
        (await query("SELECT * FROM risks WHERE analysis_id=$1", [id])).length,
      ).toBe(1);
      expect(
        (
          await query(
            "SELECT * FROM negotiation_opportunities WHERE analysis_id=$1",
            [id],
          )
        ).length,
      ).toBe(1);
      expect(
        (
          await query("SELECT * FROM analysis_evidence WHERE analysis_id=$1", [
            id,
          ])
        ).length,
      ).toBe(1);
      expect(
        response.body.trace.some(
          (t: any) => t.tool === "get_contract_evidence",
        ),
      ).toBe(true);
      expect(
        (await request(app).get(`/api/procurement-events/${event.id}/analysis`))
          .body.id,
      ).toBe(id);
    } finally {
      if (id) await query("DELETE FROM analyses WHERE id=$1", [id]);
      await query(
        "DELETE FROM audit_events WHERE event_id=$1 AND (metadata->>'analysisId'=$2 OR event_type='analysis.started' AND created_at>now()-interval '1 minute')",
        [event.id, id ?? ""],
      );
      await query("UPDATE procurement_events SET status='review' WHERE id=$1", [
        event.id,
      ]);
      await query(
        "UPDATE supplier_evaluations SET qualitative_assessment=NULL WHERE event_id=$1",
        [event.id],
      );
      delete process.env.ANTHROPIC_API_KEY;
    }
  },
);

it.skipIf(!enabled)(
  "extracts and persists source-grounded terms and preserves them when later extraction is invalid",
  async () => {
    const [demo] = await query(
      "SELECT id FROM procurement_events WHERE title='Enterprise Infrastructure Support Procurement'",
    );
    const ctx = await comparison(demo.id);
    const made = await request(app)
      .post("/api/procurement-events")
      .send({
        title: "Extraction integration test",
        category: "Test",
        requirements: ctx.event.requirements,
        criteria: ctx.event.criteria.map((c: any) => ({
          category: c.category,
          weight: Number(c.weight),
          description: c.description,
        })),
      });
    expect(made.status).toBe(201);
    const eventId = made.body.id;
    let stored: string | undefined;
    try {
      const supplier = await request(app)
        .post(`/api/procurement-events/${eventId}/suppliers`)
        .send({ name: "Test supplier" });
      const up = await request(app)
        .post(`/api/suppliers/${supplier.body.id}/documents`)
        .attach(
          "file",
          Buffer.from(
            "Section 1. Pricing\nAnnual recurring price: ZAR 100000.\nNo one-time implementation fee applies.",
          ),
          { filename: "test-contract.txt", contentType: "text/plain" },
        );
      expect(up.status).toBe(201);
      const [chunk] = await query(
        "SELECT * FROM document_chunks WHERE document_id=$1",
        [up.body.id],
      );
      const [doc] = await query(
        "SELECT storage_path FROM supplier_documents WHERE id=$1",
        [up.body.id],
      );
      stored = doc.storage_path;
      process.env.ANTHROPIC_API_KEY = "test-transport-only";
      const output = {
        terms: [
          {
            category: "pricing",
            term: "annualPrice",
            value: 100000,
            unit: "ZAR/year",
            chunkId: chunk.id,
            excerpt: "Annual recurring price: ZAR 100000.",
            confidence: 0.99,
          },
        ],
        missingFields: ["escalationPercent"],
        limitations: ["Other fields not found"],
      };
      create.mockResolvedValueOnce({
        content: [{ type: "text", text: JSON.stringify(output) }],
        stop_reason: "end_turn",
        usage: { input_tokens: 1, output_tokens: 1 },
      });
      const extracted = await request(app).post(
        `/api/documents/${up.body.id}/extract`,
      );
      expect(extracted.status, extracted.body.error).toBe(200);
      const terms = await query(
        "SELECT * FROM contract_terms WHERE source_document_id=$1",
        [up.body.id],
      );
      expect(terms[0].structured_value).toBe(100000);
      expect(terms[0].origin).toBe("claude");
      expect(terms[0].excerpt).toBe(output.terms[0].excerpt);
      create.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              ...output,
              terms: [{ ...output.terms[0], excerpt: "Fabricated clause" }],
            }),
          },
        ],
        stop_reason: "end_turn",
        usage: { input_tokens: 1, output_tokens: 1 },
      });
      expect(
        (await request(app).post(`/api/documents/${up.body.id}/extract`))
          .status,
      ).toBe(422);
      expect(
        (
          await query(
            "SELECT id FROM contract_terms WHERE source_document_id=$1",
            [up.body.id],
          )
        )[0].id,
      ).toBe(terms[0].id);
    } finally {
      await query("DELETE FROM procurement_events WHERE id=$1", [eventId]);
      if (stored) await (await import("node:fs/promises")).unlink(stored);
      delete process.env.ANTHROPIC_API_KEY;
    }
  },
);
