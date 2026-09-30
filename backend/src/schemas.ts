import { z } from "zod";
export const categories = [
  "cost",
  "flexibility",
  "sla",
  "liability",
  "warranty",
  "support",
] as const;
export const termKeys = [
  "annualPrice",
  "currency",
  "setupFees",
  "additionalCharges",
  "paymentDays",
  "invoicing",
  "deposit",
  "durationMonths",
  "renewal",
  "autoRenewal",
  "cancellationDays",
  "escalationPercent",
  "escalationBasis",
  "escalationCap",
  "responseMinutes",
  "resolutionHours",
  "availabilityPercent",
  "serviceCredits",
  "warrantyMonths",
  "warrantyCoverage",
  "warrantyExclusions",
  "liabilityCapMonths",
  "liabilityExclusions",
  "indemnities",
  "supportHours",
  "supportChannels",
  "supportCommitments",
  "penalties",
  "breachConsequences",
] as const;
export const requirementsSchema = z.object({
  maxAnnualBudget: z.number().positive(),
  maxEscalationPercent: z.number().min(0).max(100),
  preferredCancellationDays: z.number().int().positive(),
  minAvailabilityPercent: z.number().min(0).max(100),
  minWarrantyMonths: z.number().int().min(0),
  minLiabilityCapMonths: z.number().positive(),
  preferredPaymentDays: z.number().int().positive(),
  support24x7: z.boolean(),
  projectionYears: z.number().int().min(1).max(10),
});
export const criterionSchema = z.object({
  category: z.enum(categories),
  weight: z.number().min(0).max(100),
  description: z.string().min(1).max(1000),
});
export const eventSchema = z
  .object({
    title: z.string().min(3).max(200),
    description: z.string().max(5000).default(""),
    category: z.string().min(1).max(100),
    requirements: requirementsSchema,
    criteria: z.array(criterionSchema).length(6),
  })
  .superRefine((v, c) => {
    if (Math.abs(v.criteria.reduce((n, x) => n + x.weight, 0) - 100) > 0.001)
      c.addIssue({ code: "custom", message: "Weights must total 100%" });
    if (new Set(v.criteria.map((x) => x.category)).size !== 6)
      c.addIssue({
        code: "custom",
        message: "Each criterion category must occur once",
      });
  });
export const extractedTermSchema = z.object({
  category: z.enum([
    "pricing",
    "payment",
    "contract",
    "escalation",
    "sla",
    "warranty",
    "liability",
    "support",
    "penalties",
  ]),
  term: z.enum(termKeys),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  unit: z.string(),
  chunkId: z.string().uuid(),
  excerpt: z.string().min(1),
  confidence: z.number().min(0).max(1),
});
export const extractionSchema = z.object({
  terms: z.array(extractedTermSchema),
  missingFields: z.array(z.enum(termKeys)),
  limitations: z.array(z.string()),
});
const severity = z.enum(["low", "medium", "high", "critical"]);
const refs = z.array(z.string().uuid()).min(1);
export const riskSchema = z.object({
  supplierId: z.string().uuid(),
  category: z.string(),
  severity,
  title: z.string(),
  explanation: z.string(),
  businessImpact: z.string(),
  evidenceReferences: refs,
  mitigation: z.string(),
});
export const negotiationSchema = z.object({
  supplierId: z.string().uuid(),
  issue: z.string(),
  priority: severity,
  currentPosition: z.string(),
  targetPosition: z.string(),
  fallbackPosition: z.string(),
  rationale: z.string(),
  expectedImpact: z.string(),
  evidenceReferences: refs,
});
export const analysisSchema = z.object({
  recommendation: z.object({
    recommendedSupplierId: z.string().uuid(),
    recommendationSummary: z.string(),
    confidence: z.enum(["low", "medium", "high"]),
    keyReasons: z.array(z.string()),
  }),
  supplierAssessments: z.array(
    z.object({
      supplierId: z.string().uuid(),
      overallAssessment: z.string(),
      strengths: z.array(z.string()),
      weaknesses: z.array(z.string()),
      materialRisks: z.array(z.string()),
      commercialPosition: z.string(),
      requirementAlignment: z.string(),
    }),
  ),
  tradeoffs: z.array(
    z.object({
      tradeoff: z.string(),
      supplierA: z.string().uuid(),
      supplierB: z.string().uuid(),
      significance: z.string(),
      conclusion: z.string(),
    }),
  ),
  risks: z.array(riskSchema),
  negotiationOpportunities: z.array(negotiationSchema),
  decisionFactors: z.array(
    z.object({
      factor: z.string(),
      importance: z.string(),
      evidenceReferences: refs,
      conclusion: z.string(),
    }),
  ),
  claims: z
    .array(
      z.object({
        supplierId: z.string().uuid(),
        claim: z.string(),
        evidenceReferences: refs,
        evidenceType: z.enum(["fact", "interpretation", "recommendation"]),
      }),
    )
    .min(1),
  playbook: z.object({
    leveragePoints: z.array(z.string()),
    priorityIssues: z.array(z.string()),
    requestedConcessions: z.array(z.string()),
    fallbackPositions: z.array(z.string()),
    commercialRationale: z.string(),
    risksToAvoid: z.array(z.string()),
    sequence: z.array(
      z.object({
        step: z.number().int().positive(),
        action: z.string(),
        concessionLogic: z.string(),
        evidenceReferences: refs,
      }),
    ),
  }),
  limitations: z.array(z.string()),
});
export const whatIfSchema = z
  .object({
    supplierId: z.string().uuid(),
    changes: z
      .object({
        annualPrice: z.number().positive().optional(),
        escalationPercent: z.number().min(0).max(100).optional(),
        cancellationDays: z.number().int().min(1).max(365).optional(),
        availabilityPercent: z.number().min(0).max(100).optional(),
      })
      .strict(),
    requirements: requirementsSchema.partial().optional(),
    explain: z.boolean().default(false),
  })
  .refine(
    (v) =>
      Object.keys(v.changes).length > 0 ||
      Object.keys(v.requirements ?? {}).length > 0,
    "Provide a supplier or requirement change",
  );
export type Requirements = z.infer<typeof requirementsSchema>;
export type AnalysisResult = z.infer<typeof analysisSchema>;
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success)
    throw new AppError(
      400,
      r.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; "),
    );
  return r.data;
}
