import { useState } from "react";

import { api, money } from "../api";
import { Panel } from "../components/ui";
export default function WhatIf({
  eventId,
  suppliers,
}: {
  eventId: string;
  suppliers: any[];
}) {
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Panel title="What-if scenario">
      <p>
        Test proposed changes without modifying supplier facts. Optional Claude
        explanation uses the recalculated commercial position.
      </p>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          setResult(null);
          const f = new FormData(e.currentTarget);
          const changes: Record<string, number> = {};
          for (const key of [
            "annualPrice",
            "escalationPercent",
            "cancellationDays",
            "availabilityPercent",
          ])
            if (f.get(key) !== "") changes[key] = Number(f.get(key));
          const requirements =
            f.get("requiredAvailability") !== ""
              ? {
                  minAvailabilityPercent: Number(f.get("requiredAvailability")),
                }
              : undefined;
          try {
            setResult(
              await api(`/procurement-events/${eventId}/what-if`, "POST", {
                supplierId: f.get("supplier"),
                changes,
                requirements,
                explain: f.get("explain") === "on",
              }),
            );
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Supplier
          <select name="supplier">
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid3">
          {[
            ["annualPrice", "Proposed annual cost (ZAR)"],
            ["escalationPercent", "Proposed escalation (%)"],
            ["cancellationDays", "Proposed cancellation notice (days)"],
            ["availabilityPercent", "Proposed SLA availability (%)"],
            ["requiredAvailability", "Organisation required availability (%)"],
          ].map(([key, title]) => (
            <label key={key}>
              {title}
              <input
                name={key}
                type="number"
                step="any"
                placeholder="Keep current value"
              />
            </label>
          ))}
        </div>
        <label className="check">
          <input name="explain" type="checkbox" />
          Explain implications with Claude
        </label>
        <button disabled={busy || !suppliers.length}>
          {busy ? "Calculating…" : "Calculate scenario"}
        </button>
      </form>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {result && (
        <>
          <h3>Projected cost change: {money(result.projectedCostDelta)}</h3>
          <div className="grid3">
            {result.after.map((s: any) => (
              <div className="item" key={s.id}>
                <h3>{s.name}</h3>
                <p>
                  {money(s.financial?.total)} · score{" "}
                  {s.deterministicScore ?? "Incomplete"}
                </p>
                <p>{s.deviations.length} requirement deviations</p>
              </div>
            ))}
          </div>
          {result.explanation && (
            <>
              <p>{result.explanation.summary}</p>
              <ul>
                {result.explanation.implications.map((v: string, i: number) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
              <p className="muted">
                {result.explanation.limitations.join(" ")}
              </p>
            </>
          )}
        </>
      )}
    </Panel>
  );
}
