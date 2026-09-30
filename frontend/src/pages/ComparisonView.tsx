import { label, money } from "../api";
import { Badge, Panel } from "../components/ui";

import type { WorkspaceViewProps } from "../types";
export default function ComparisonView({ suppliers }: WorkspaceViewProps) {
  return (
    <>
      <Panel title="Supplier comparison">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                {suppliers.map((s: any) => (
                  <th key={s.id}>{s.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                [
                  "Annual recurring price",
                  (s: any) => money(s.terms.annualPrice),
                ],
                [
                  "Five-year / selected horizon cost",
                  (s: any) => money(s.financial?.total),
                ],
                [
                  "Cost above least expensive",
                  (s: any) =>
                    `${money(s.costDifference)} (${s.percentageDifference ?? "?"}%)`,
                ],
                [
                  "Escalation",
                  (s: any) =>
                    s.terms.escalationPercent == null
                      ? "Unknown"
                      : `${s.terms.escalationPercent}%`,
                ],
                [
                  "Cancellation notice",
                  (s: any) =>
                    s.terms.cancellationDays == null
                      ? "Unknown"
                      : `${s.terms.cancellationDays} days`,
                ],
                [
                  "Payment",
                  (s: any) =>
                    s.terms.paymentDays == null
                      ? "Unknown"
                      : `${s.terms.paymentDays} days`,
                ],
                [
                  "Availability",
                  (s: any) =>
                    s.terms.availabilityPercent == null
                      ? "Unknown"
                      : `${s.terms.availabilityPercent}%`,
                ],
                [
                  "Warranty",
                  (s: any) =>
                    s.terms.warrantyMonths == null
                      ? "Unknown"
                      : `${s.terms.warrantyMonths} months`,
                ],
                [
                  "Liability cap",
                  (s: any) =>
                    s.terms.liabilityCapMonths == null
                      ? "Unknown"
                      : `${s.terms.liabilityCapMonths} months fees`,
                ],
                [
                  "Weighted score",
                  (s: any) => s.deterministicScore ?? "Incomplete",
                ],
              ].map(([title, fn]) => (
                <tr key={String(title)}>
                  <td>{String(title)}</td>
                  {suppliers.map((s: any) => (
                    <td key={s.id}>{(fn as any)(s)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <div className="grid3">
        {suppliers.map((s: any) => (
          <Panel key={s.id} title={`${s.name} · requirement alignment`}>
            {s.deviations.map((d: any) => (
              <p key={d.field}>
                <Badge>Deviation</Badge> {d.reason}: {String(d.actual)} →{" "}
                {String(d.target)}
              </p>
            ))}
            {s.conflicts.length > 0 && (
              <p className="warning">
                Conflicting terms: {s.conflicts.join(", ")}
              </p>
            )}
            {s.missing.length > 0 && (
              <p>Insufficient evidence: {s.missing.join(", ")}</p>
            )}
            {Object.entries(s.criterionScores).map(([key, v]) => (
              <div className="score" key={key}>
                <span>{label(key)}</span>
                <meter min="0" max="100" value={Number(v ?? 0)} />
                <span>{v == null ? "Unknown" : String(v)}</span>
              </div>
            ))}
          </Panel>
        ))}
      </div>
      <p className="muted">
        Scores support comparison. They do not resolve clause exclusions,
        termination conditions or legal risk.
      </p>
    </>
  );
}
