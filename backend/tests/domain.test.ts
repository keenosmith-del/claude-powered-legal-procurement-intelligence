import { describe, it, expect } from "vitest";
import {
  projectCost,
  normalise,
  evaluate,
  compare,
  availabilityScore,
} from "../src/financial.js";
import {
  eventSchema,
  extractionSchema,
  riskSchema,
  negotiationSchema,
  whatIfSchema,
} from "../src/schemas.js";
import { chunkText, validateExtraction } from "../src/documents.js";
import { executeTool, validateGrounding } from "../src/analysis.js";
const r = {
  maxAnnualBudget: 2500000,
  maxEscalationPercent: 5,
  preferredCancellationDays: 30,
  minAvailabilityPercent: 99.9,
  minWarrantyMonths: 24,
  minLiabilityCapMonths: 12,
  preferredPaymentDays: 60,
  support24x7: true,
  projectionYears: 5,
};
const criteria = [
  "cost",
  "flexibility",
  "sla",
  "liability",
  "warranty",
  "support",
].map((category) => ({
  category,
  weight: category === "cost" ? 30 : 14,
  description: "Criterion",
}));
const id = "11111111-1111-4111-8111-111111111111";
describe("financial and evaluation engine", () => {
  it("compounds anniversary escalation without asking AI", () => {
    const p = projectCost(2100000, 8, 5, 220000);
    expect(p.schedule.map((x) => x.cost)).toEqual([
      2100000, 2268000, 2449440, 2645395.2, 2857026.82,
    ]);
    expect(p.total).toBe(12539862.02);
    expect(p.escalationImpact).toBe(1819862.02);
  });
  it("quantifies savings when escalation is negotiated", () =>
    expect(
      projectCost(2100000, 8, 5).total - projectCost(2100000, 5, 5).total,
    ).toBeCloseTo(716036.39, 2));
  it("rejects invalid projections", () => {
    expect(() => projectCost(-1, 5, 5)).toThrow();
    expect(() => projectCost(1, 101, 5)).toThrow();
    expect(() => projectCost(1, 5, 0)).toThrow();
  });
  it("scores availability using downtime exposure rather than near-identical raw percentages", () => {
    expect(availabilityScore(99.5, 99.9)).toBe(20);
    expect(availabilityScore(99.95, 99.9)).toBe(100);
    expect(availabilityScore(null, 99.9)).toBeNull();
  });
  it("does not hide contradictory terms", () =>
    expect(
      normalise([
        { term: "paymentDays", structured_value: 30 },
        { term: "paymentDays", structured_value: 60 },
      ]),
    ).toEqual({ terms: { paymentDays: null }, conflicts: ["paymentDays"] }));
  it("does not assign an overall score when material facts are missing", () =>
    expect(evaluate({}, r, criteria, null).deterministicScore).toBeNull());
  it("uses weights and preserves requirement breaches", () => {
    const e = evaluate(
      {
        annualPrice: 2100000,
        escalationPercent: 8,
        setupFees: 0,
        currency: "ZAR",
        paymentDays: 60,
        cancellationDays: 30,
        availabilityPercent: 99.95,
        warrantyMonths: 24,
        liabilityCapMonths: 6,
        supportHours: "24x7",
        durationMonths: 36,
      },
      r,
      criteria,
      12319862.02,
    );
    expect(e.criterionScores.liability).toBe(50);
    expect(e.deterministicScore).toBe(93);
    expect(e.deviations.map((d) => d.field)).toEqual([
      "escalationPercent",
      "liabilityCapMonths",
    ]);
    expect(e.contractValue).toBe(6817440);
  });
  it("cannot compare different currencies as if all were ZAR", () =>
    expect(
      evaluate(
        {
          annualPrice: 100,
          escalationPercent: 5,
          setupFees: 0,
          currency: "USD",
        },
        r,
        criteria,
        100,
      ).financial,
    ).toBeNull());
  it("requires six unique criteria summing to 100", () =>
    expect(
      eventSchema.safeParse({
        title: "Test event",
        category: "IT",
        requirements: r,
        criteria: criteria.map((c) => ({ ...c, weight: 20 })),
      }).success,
    ).toBe(false));
});
describe("document and output reliability", () => {
  it("chunks long lines without losing their content", () => {
    const text = "a".repeat(14000);
    const chunks = chunkText(text, 6000);
    expect(chunks.map((c) => c.content).join("")).toBe(text);
    expect(chunks.every((c) => c.content.length <= 6000)).toBe(true);
  });
  it("rejects fabricated source excerpts", () =>
    expect(() =>
      validateExtraction(
        {
          terms: [
            {
              category: "pricing",
              term: "annualPrice",
              value: 10,
              unit: "ZAR",
              chunkId: id,
              excerpt: "invented",
              confidence: 1,
            },
          ],
          missingFields: [],
          limitations: [],
        },
        [{ id, content: "annual price 10" }],
      ),
    ).toThrow("unsupported"));
  it("rejects malformed risk and negotiation models", () => {
    expect(
      riskSchema.safeParse({ title: "Risk", severity: "severe" }).success,
    ).toBe(false);
    expect(
      negotiationSchema.safeParse({
        supplierId: id,
        priority: "high",
        evidenceReferences: [],
      }).success,
    ).toBe(false);
    expect(extractionSchema.safeParse({ terms: "text" }).success).toBe(false);
  });
  it("scopes tools to the event", async () => {
    await expect(
      executeTool({ event: {}, suppliers: [] }, "get_supplier_profile", {
        supplierId: id,
      }),
    ).rejects.toThrow("current event");
    await expect(
      executeTool({ event: {}, suppliers: [] }, "get_contract_evidence", {
        termId: id,
      }),
    ).rejects.toThrow("current event");
  });
});

it("accepts a requirement-only what-if but rejects an empty scenario", () => {
  expect(
    whatIfSchema.safeParse({
      supplierId: id,
      changes: {},
      requirements: { minAvailabilityPercent: 99.99 },
    }).success,
  ).toBe(true);
  expect(whatIfSchema.safeParse({ supplierId: id, changes: {} }).success).toBe(
    false,
  );
});
