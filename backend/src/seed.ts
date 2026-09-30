import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { root } from "./config.js";
import { query, pool, transaction } from "./db.js";
import { chunkText } from "./documents.js";
export const requirements = {
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
  ["cost", 30, "Five-year nominal total cost including setup"],
  [
    "flexibility",
    15,
    "Notice period and payment days; clause qualification requires review",
  ],
  [
    "sla",
    20,
    "Availability against required minimum; credits reviewed qualitatively",
  ],
  ["liability", 15, "Liability cap in months of annual fees"],
  ["warranty", 10, "Warranty duration against required minimum"],
  ["support", 10, "Continuous support availability"],
];
const specs = [
  {
    name: "Supplier A",
    price: 2400000,
    escalation: 6,
    cancel: 90,
    payment: 30,
    availability: 99.5,
    warranty: 12,
    liability: 18,
    setup: 120000,
    response: 60,
    resolution: 12,
    auto: false,
    exclusions: "Consumables and unauthorised modifications are excluded.",
    liabilityText:
      "Fraud and wilful misconduct are excluded from the liability cap.",
    credits:
      "5% of monthly fees for each 0.5 percentage point availability shortfall, capped at 15%.",
    support:
      "Business hours 08:00–18:00 weekdays; critical incidents have an on-call telephone channel.",
    hours: "business hours",
    duration: 36,
    renewal: "Renewal requires written agreement.",
    termination:
      "Termination for convenience is allowed with 90 days written notice after the initial twelve months; no further recurring fees are payable.",
  },
  {
    name: "Supplier B",
    price: 2100000,
    escalation: 8,
    cancel: 30,
    payment: 60,
    availability: 99.95,
    warranty: 24,
    liability: 6,
    setup: 220000,
    response: 15,
    resolution: 4,
    auto: true,
    exclusions:
      "Third-party components, power faults and consequential loss are excluded.",
    liabilityText:
      "The cap applies to all claims including data loss; fraud is excluded. No data security indemnity is offered.",
    credits:
      "10% of monthly fees for each 0.1 percentage point shortfall, capped at 30%; credits are the exclusive remedy for SLA breaches.",
    support: "24x7 telephone, email and portal support for all severities.",
    hours: "24x7",
    duration: 36,
    renewal:
      "Automatically renews for twelve months unless notice is given 60 days before expiry.",
    termination:
      "Termination permitted upon thirty days prior written notification. During the initial twelve months, 50% of the remaining annual fees become payable.",
  },
  {
    name: "Supplier C",
    price: 2600000,
    escalation: 5,
    cancel: 90,
    payment: 30,
    availability: 99.99,
    warranty: 36,
    liability: 24,
    setup: 80000,
    response: 10,
    resolution: 2,
    auto: false,
    exclusions:
      "Only deliberate misuse is excluded; third-party components remain covered.",
    liabilityText:
      "Fraud, wilful misconduct, confidentiality breaches and IP infringement indemnities are uncapped.",
    credits:
      "15% of monthly fees for each 0.1 percentage point shortfall, capped at 50%; repeated failures permit termination without penalty.",
    support:
      "24x7 telephone, portal and dedicated engineer support for all severities.",
    hours: "24x7",
    duration: 36,
    renewal: "Renewal requires express written agreement with both parties.",
    termination:
      "Termination for convenience requires 90 days written notice, with no early exit fee.",
  },
];
async function seed() {
  if (
    (
      await query(
        "SELECT id FROM procurement_events WHERE title='Enterprise Infrastructure Support Procurement'",
      )
    ).length
  ) {
    console.log("Demo already seeded; no data overwritten");
    return;
  }
  await mkdir(path.join(root, "documents/sample"), { recursive: true });
  await transaction(async (c) => {
    const [e] = (
      await c.query(
        "INSERT INTO procurement_events(title,description,category,requirements,status) VALUES($1,$2,$3,$4,$5) RETURNING *",
        [
          "Enterprise Infrastructure Support Procurement",
          "Evaluate three infrastructure support proposals over five years. Budget discipline, uptime, exit flexibility and contractual protection matter.",
          "Infrastructure support",
          JSON.stringify(requirements),
          "review",
        ],
      )
    ).rows;
    for (const [category, weight, description] of criteria)
      await c.query(
        "INSERT INTO evaluation_criteria(event_id,category,weight,description) VALUES($1,$2,$3,$4)",
        [e.id, category, weight, description],
      );
    for (const s of specs) {
      const [supplier] = (
        await c.query(
          "INSERT INTO suppliers(event_id,name,description) VALUES($1,$2,$3) RETURNING *",
          [
            e.id,
            s.name,
            "Demonstration submission; review contractual qualifications.",
          ],
        )
      ).rows;
      const records: [
        string,
        string,
        string | number | boolean,
        string,
        string,
      ][] = [
        [
          "pricing",
          "annualPrice",
          s.price,
          "ZAR/year",
          `Annual recurring price: ZAR ${s.price}. VAT is excluded.`,
        ],
        [
          "pricing",
          "currency",
          "ZAR",
          "ISO currency",
          "All quoted amounts are in South African rand (ZAR).",
        ],
        [
          "pricing",
          "setupFees",
          s.setup,
          "ZAR",
          `One-time implementation fee: ZAR ${s.setup}.`,
        ],
        [
          "pricing",
          "additionalCharges",
          "Out-of-scope work requires a separately approved quotation.",
          "text",
          "Out-of-scope work requires a separately approved quotation.",
        ],
        [
          "payment",
          "paymentDays",
          s.payment,
          "days",
          `Invoices are payable within ${s.payment} days of receipt.`,
        ],
        [
          "payment",
          "invoicing",
          "Monthly in arrears",
          "text",
          "Recurring services are invoiced monthly in arrears.",
        ],
        [
          "payment",
          "deposit",
          "No deposit required",
          "text",
          "No deposit is required.",
        ],
        [
          "contract",
          "durationMonths",
          s.duration,
          "months",
          `The initial term is ${s.duration} months.`,
        ],
        ["contract", "cancellationDays", s.cancel, "days", s.termination],
        ["contract", "autoRenewal", s.auto, "boolean", s.renewal],
        ["contract", "renewal", s.renewal, "text", s.renewal],
        [
          "escalation",
          "escalationPercent",
          s.escalation,
          "percent",
          `Recurring fees increase by ${s.escalation}% on each anniversary; the first adjustment occurs at the start of year two.`,
        ],
        [
          "escalation",
          "escalationBasis",
          "Fixed annual percentage",
          "text",
          `Escalation is a fixed ${s.escalation}% annual percentage, not CPI-linked.`,
        ],
        [
          "escalation",
          "escalationCap",
          s.escalation,
          "percent",
          `The annual escalation is capped at ${s.escalation}%.`,
        ],
        [
          "sla",
          "availabilityPercent",
          s.availability,
          "percent",
          `Monthly service availability commitment: ${s.availability}%, excluding scheduled maintenance of up to four hours monthly.`,
        ],
        [
          "sla",
          "responseMinutes",
          s.response,
          "minutes",
          `Critical incident response within ${s.response} minutes.`,
        ],
        [
          "sla",
          "resolutionHours",
          s.resolution,
          "hours",
          `Target critical incident resolution: ${s.resolution} hours; this is a target rather than a guarantee.`,
        ],
        ["sla", "serviceCredits", s.credits, "text", s.credits],
        [
          "warranty",
          "warrantyMonths",
          s.warranty,
          "months",
          `Workmanship and replacement parts warranty lasts ${s.warranty} months.`,
        ],
        [
          "warranty",
          "warrantyCoverage",
          "Workmanship and replacement parts",
          "text",
          "Warranty covers workmanship and replacement parts.",
        ],
        ["warranty", "warrantyExclusions", s.exclusions, "text", s.exclusions],
        [
          "liability",
          "liabilityCapMonths",
          s.liability,
          "months of annual fees",
          `Aggregate liability is capped at ${s.liability} months of recurring fees.`,
        ],
        [
          "liability",
          "liabilityExclusions",
          s.liabilityText,
          "text",
          s.liabilityText,
        ],
        [
          "liability",
          "indemnities",
          s.name === "Supplier C"
            ? "IP infringement indemnity"
            : "No express IP infringement indemnity",
          "text",
          s.name === "Supplier C"
            ? "Supplier indemnifies the customer against IP infringement claims."
            : "No express IP infringement indemnity is provided.",
        ],
        ["support", "supportHours", s.hours, "text", s.support],
        [
          "support",
          "supportChannels",
          "Telephone, email and portal",
          "text",
          "Support channels include telephone, email and portal.",
        ],
        [
          "support",
          "supportCommitments",
          "Escalation manager assigned to critical incidents",
          "text",
          "An escalation manager is assigned to critical incidents.",
        ],
        [
          "penalties",
          "penalties",
          "No additional monetary penalties beyond service credits",
          "text",
          "No additional monetary penalties apply beyond the specified service credits.",
        ],
        [
          "penalties",
          "breachConsequences",
          "Material breach cure period of 30 days",
          "text",
          "Material breach is subject to a 30-day cure period before termination for cause.",
        ],
      ];
      for (const type of ["contract", "sla"]) {
        const selected = records.filter((r) =>
          type === "sla"
            ? ["sla", "support"].includes(r[0])
            : !["sla", "support"].includes(r[0]),
        );
        const content =
          `${s.name} — ${type === "contract" ? "Commercial agreement" : "Service and support schedule"}\nDemonstration document. No actual supplier offer.\n\n` +
          selected
            .map((r, i) => `${i + 1}. ${r[0]} / ${r[1]}\n${r[4]}\n`)
            .join("\n");
        const filename = `${s.name.replace(" ", "-")}-${type}.txt`;
        const file = path.join(root, "documents/sample", filename);
        await writeFile(file, content);
        const [doc] = (
          await c.query(
            "INSERT INTO supplier_documents(supplier_id,document_type,filename,mime_type,storage_path,extracted_text,processing_status) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
            [
              supplier.id,
              type,
              filename,
              "text/plain",
              file,
              content,
              "seed_reviewed",
            ],
          )
        ).rows;
        const chunks: any[] = [];
        for (const chunk of chunkText(content))
          chunks.push(
            (
              await c.query(
                "INSERT INTO document_chunks(document_id,location,content) VALUES($1,$2,$3) RETURNING *",
                [doc.id, chunk.location, chunk.content],
              )
            ).rows[0],
          );
        for (const r of selected) {
          const chunk = chunks.find((c) => c.content.includes(r[4]));
          await c.query(
            "INSERT INTO contract_terms(supplier_id,category,term,structured_value,unit,source_document_id,chunk_id,source_location,excerpt,confidence,origin) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
            [
              supplier.id,
              r[0],
              r[1],
              JSON.stringify(r[2]),
              r[3],
              doc.id,
              chunk.id,
              chunk.location,
              r[4],
              1,
              "seed-reviewed",
            ],
          );
        }
      }
    }
    await c.query(
      "INSERT INTO audit_events(event_id,event_type,metadata) VALUES($1,'demo.seeded',$2)",
      [
        e.id,
        JSON.stringify({
          note: "Seed terms are curated facts traced to exact sample clauses, not AI output. Re-extract to use Claude.",
        }),
      ],
    );
    console.log("Seeded event", e.id);
  });
}
await seed();
await pool.end();
