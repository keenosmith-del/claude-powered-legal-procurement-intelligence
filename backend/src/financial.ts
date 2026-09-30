import { AppError, type Requirements, categories } from "./schemas.js";
export const round = (n: number) =>
  Math.round((n + Number.EPSILON) * 100) / 100;
export function projectCost(
  annual: number,
  escalation: number,
  years: number,
  setup = 0,
) {
  if (
    !Number.isFinite(annual) ||
    annual <= 0 ||
    !Number.isFinite(escalation) ||
    escalation < 0 ||
    escalation > 100 ||
    !Number.isInteger(years) ||
    years < 1 ||
    years > 10 ||
    setup < 0
  )
    throw new AppError(422, "Invalid financial inputs");
  const schedule = Array.from({ length: years }, (_, i) => ({
    year: i + 1,
    cost: round(annual * (1 + escalation / 100) ** i),
  }));
  const recurring = round(schedule.reduce((n, x) => n + x.cost, 0));
  return {
    schedule,
    recurring,
    total: round(recurring + setup),
    setup,
    escalationImpact: round(recurring - annual * years),
  };
}
export type Terms = Record<string, string | number | boolean | null>;
export function numeric(t: Terms, key: string) {
  return typeof t[key] === "number" && Number.isFinite(t[key])
    ? (t[key] as number)
    : null;
}
export function normalise(rows: any[]) {
  const terms: Terms = {};
  const conflicts: string[] = [];
  for (const row of rows) {
    if (row.structured_value === null) continue;
    if (row.term in terms && terms[row.term] !== row.structured_value)
      conflicts.push(row.term);
    else terms[row.term] = row.structured_value;
  }
  for (const key of conflicts) terms[key] = null;
  return { terms, conflicts: [...new Set(conflicts)] };
}
const percentScore = (actual: number | null, target: number, higher = true) =>
  actual === null
    ? null
    : higher && target === 0
      ? 100
      : round(
          Math.min(
            100,
            Math.max(
              0,
              (higher ? actual / target : target / Math.max(actual, 1)) * 100,
            ),
          ),
        );
export function availabilityScore(actual: number | null, target: number) {
  if (actual === null) return null;
  if (actual >= target) return 100;
  return round(
    Math.max(0, Math.min(100, ((100 - target) / (100 - actual)) * 100)),
  );
}
export function evaluate(
  terms: Terms,
  r: Requirements,
  criteria: any[],
  minCost: number | null,
) {
  const annual = numeric(terms, "annualPrice"),
    escalation = numeric(terms, "escalationPercent"),
    setup = numeric(terms, "setupFees");
  const currency = terms.currency;
  const financial =
    annual !== null &&
    escalation !== null &&
    setup !== null &&
    currency === "ZAR"
      ? projectCost(annual, escalation, r.projectionYears, setup)
      : null;
  const cancellation = numeric(terms, "cancellationDays"),
    duration = numeric(terms, "durationMonths");
  const payment = numeric(terms, "paymentDays");
  const scores: Record<string, number | null> = {
    cost:
      financial && minCost !== null
        ? round((minCost / financial.total) * 100)
        : null,
    flexibility:
      cancellation === null || payment === null
        ? null
        : round(
            (percentScore(cancellation, r.preferredCancellationDays, false)! +
              percentScore(payment, r.preferredPaymentDays)!) /
              2,
          ),
    sla: availabilityScore(
      numeric(terms, "availabilityPercent"),
      r.minAvailabilityPercent,
    ),
    liability: percentScore(
      numeric(terms, "liabilityCapMonths"),
      r.minLiabilityCapMonths,
    ),
    warranty: percentScore(
      numeric(terms, "warrantyMonths"),
      r.minWarrantyMonths,
    ),
    support:
      typeof terms.supportHours === "string"
        ? r.support24x7
          ? terms.supportHours === "24x7"
            ? 100
            : 40
          : 100
        : null,
  };
  const deviations: {
    field: string;
    actual: unknown;
    target: unknown;
    reason: string;
  }[] = [];
  const check = (
    field: string,
    target: number,
    higher: boolean,
    reason: string,
  ) => {
    const v = numeric(terms, field);
    if (v !== null && (higher ? v < target : v > target))
      deviations.push({ field, actual: v, target, reason });
  };
  check("annualPrice", r.maxAnnualBudget, false, "Annual price exceeds budget");
  check(
    "escalationPercent",
    r.maxEscalationPercent,
    false,
    "Escalation exceeds maximum",
  );
  check(
    "cancellationDays",
    r.preferredCancellationDays,
    false,
    "Longer cancellation notice",
  );
  check(
    "availabilityPercent",
    r.minAvailabilityPercent,
    true,
    "Availability below requirement",
  );
  check(
    "warrantyMonths",
    r.minWarrantyMonths,
    true,
    "Warranty below requirement",
  );
  check(
    "liabilityCapMonths",
    r.minLiabilityCapMonths,
    true,
    "Liability cap below requirement",
  );
  check(
    "paymentDays",
    r.preferredPaymentDays,
    true,
    "Less favourable payment terms",
  );
  if (r.support24x7 && terms.supportHours && terms.supportHours !== "24x7")
    deviations.push({
      field: "supportHours",
      actual: terms.supportHours,
      target: "24x7",
      reason: "Continuous support required",
    });
  const missing = categories.filter((k) => scores[k] === null);
  const deterministicScore = missing.some(
    (k) => criteria.find((c) => c.category === k)?.weight > 0,
  )
    ? null
    : round(
        criteria.reduce(
          (n, c) => n + ((scores[c.category] ?? 0) * Number(c.weight)) / 100,
          0,
        ),
      );
  const contractValue =
    annual !== null &&
    escalation !== null &&
    setup !== null &&
    duration !== null &&
    currency === "ZAR"
      ? round(
          Array.from(
            { length: Math.ceil(duration / 12) },
            (_, i) =>
              (annual *
                (1 + escalation / 100) ** i *
                Math.min(12, duration - i * 12)) /
              12,
          ).reduce((a, b) => a + b, 0) + setup,
        )
      : null;
  return {
    terms,
    financial,
    contractValue,
    criterionScores: scores,
    deterministicScore,
    deviations,
    missing,
    paymentDays: payment,
    limitations: [
      "Cost projections exclude tax, discounting, unquantified additional charges and service credits.",
      "Notice days do not establish an unconditional right to terminate; review the clause evidence.",
    ],
  };
}
export function compare(event: any, suppliers: any[]) {
  const normal = suppliers.map((s) => ({
    ...s,
    ...normalise(s.contractTerms),
  }));
  const totals = normal
    .map((s) => {
      const a = numeric(s.terms, "annualPrice"),
        e = numeric(s.terms, "escalationPercent"),
        f = numeric(s.terms, "setupFees");
      return a !== null &&
        e !== null &&
        f !== null &&
        s.terms.currency === "ZAR"
        ? projectCost(a, e, event.requirements.projectionYears, f).total
        : null;
    })
    .filter((n): n is number => n !== null);
  const min = totals.length ? Math.min(...totals) : null;
  return normal.map((s) => {
    const result = evaluate(s.terms, event.requirements, event.criteria, min);
    return {
      ...s,
      ...result,
      costDifference:
        result.financial && min !== null
          ? round(result.financial.total - min)
          : null,
      percentageDifference:
        result.financial && min !== null
          ? round(((result.financial.total - min) / min) * 100)
          : null,
    };
  });
}
