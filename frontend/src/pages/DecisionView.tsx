import { api } from "../api";
import { Badge, Empty, Panel } from "../components/ui";

import type { WorkspaceViewProps } from "../types";
export default function DecisionView({
  suppliers,
  audit,
  decisions,
  id,
  action,
  busy,
  names,
  analysis,
}: WorkspaceViewProps) {
  return (
    <>
      <Panel title="Human procurement decision">
        <p>
          Record your review outcome. A recommendation does not approve a
          contract or bind a supplier.
        </p>
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void action(
              () =>
                api(`/procurement-events/${id}/decision`, "POST", {
                  outcome: f.get("outcome"),
                  selectedSupplierId: f.get("supplier") || null,
                  notes: f.get("notes"),
                  negotiationRequired: f.get("negotiation") === "on",
                }),
              "Decision recorded",
            );
          }}
        >
          <label>
            Outcome
            <select name="outcome">
              <option value="defer">Defer pending review</option>
              <option value="accept" disabled={analysis?.stale}>
                Accept / select supplier
              </option>
              <option value="reject">Reject recommendation</option>
            </select>
          </label>
          <label>
            Selected supplier
            <select name="supplier">
              <option value="">No selection</option>
              {suppliers.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Review rationale
            <textarea
              name="notes"
              minLength={10}
              required
              placeholder="Explain your decision and outstanding conditions"
            />
          </label>
          <label className="check">
            <input type="checkbox" name="negotiation" defaultChecked />
            Negotiation required before signing
          </label>
          <button disabled={busy}>Record decision</button>
        </form>
      </Panel>
      <Panel title="Decision history">
        {decisions.map((d) => (
          <article className="item" key={d.id}>
            <Badge>{d.outcome}</Badge>
            <h3>
              {d.selected_supplier_id
                ? names(d.selected_supplier_id)
                : "No supplier selected"}
            </h3>
            <p>{d.notes}</p>
            <p>
              Negotiation {d.negotiation_required ? "required" : "not required"}{" "}
              · {new Date(d.decided_at).toLocaleString()}
            </p>
          </article>
        ))}
        {!decisions.length && <Empty>No final decision recorded.</Empty>}
      </Panel>
      <Panel title="Audit trail">
        {audit.map((a) => (
          <details key={a.id}>
            <summary>
              {a.event_type} · {new Date(a.created_at).toLocaleString()}
            </summary>
            <pre>{JSON.stringify(a.metadata, null, 2)}</pre>
          </details>
        ))}
      </Panel>
    </>
  );
}
