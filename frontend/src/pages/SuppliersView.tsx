import { Link } from "react-router-dom";
import { api } from "../api";
import { Panel } from "../components/ui";

import type { WorkspaceViewProps } from "../types";
export default function SuppliersView({
  suppliers,
  id,
  action,
  busy,
}: WorkspaceViewProps) {
  return (
    <Panel title="Supplier submissions">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void action(
            () =>
              api(`/procurement-events/${id}/suppliers`, "POST", {
                name: f.get("name"),
                description: f.get("description"),
              }),
            "Supplier added",
          );
        }}
        className="inline-form"
      >
        <input name="name" placeholder="Supplier name" required />
        <input name="description" placeholder="Submission description" />
        <button disabled={busy}>Add supplier</button>
      </form>
      {suppliers.map((s: any) => (
        <div className="row" key={s.id}>
          <div>
            <h3>{s.name}</h3>
            <p>{s.description}</p>
            <details>
              <summary>Edit supplier</summary>
              <form
                key={`${s.name}:${s.description}`}
                className="inline-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  void action(
                    () =>
                      api(`/suppliers/${s.id}`, "PUT", {
                        name: form.get("name"),
                        description: form.get("description"),
                      }),
                    "Supplier updated; previous analysis must be rerun",
                  );
                }}
              >
                <input
                  name="name"
                  aria-label="Supplier name"
                  required
                  maxLength={100}
                  defaultValue={s.name}
                />
                <input
                  name="description"
                  aria-label="Supplier description"
                  maxLength={2000}
                  defaultValue={s.description}
                />
                <button disabled={busy}>Save supplier</button>
              </form>
            </details>
          </div>
          <Link to={`/events/${id}/suppliers/${s.id}`}>
            Inspect submission →
          </Link>
        </div>
      ))}
    </Panel>
  );
}
