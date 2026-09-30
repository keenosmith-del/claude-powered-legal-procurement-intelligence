export async function api<T = any>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const res = await fetch("/api" + path, {
    method,
    ...(body instanceof FormData
      ? { body }
      : {
          headers: { "Content-Type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
        }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}
export const money = (n: number | null | undefined) =>
  n == null
    ? "Information not found"
    : new Intl.NumberFormat("en-ZA", {
        style: "currency",
        currency: "ZAR",
        maximumFractionDigits: 0,
      }).format(n);
export const label = (s: string) =>
  s
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
export const defaultRequirements = {
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
export const defaultCriteria = [
  ["cost", 30],
  ["flexibility", 15],
  ["sla", 20],
  ["liability", 15],
  ["warranty", 10],
  ["support", 10],
].map(([category, weight]) => ({
  category: String(category),
  weight: Number(weight),
  description: label(String(category)) + " evaluation",
}));
