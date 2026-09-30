import { Link } from "react-router-dom";
import { api, money } from "../api";
import { Badge, Panel } from "../components/ui";
import EventEditor from "../components/EventEditor";

import type { WorkspaceViewProps } from "../types";
export default function OverviewView({
  event,
  suppliers,
  audit,
  id,
  action,
}: WorkspaceViewProps) {
  return (
    <>
      <div className="grid3">
        {suppliers.map((s: any) => (
          <Panel key={s.id} title={s.name}>
            <p className="stat">{money(s.terms.annualPrice)}</p>
            <p>Annual recurring price</p>
            <Badge>
              {s.deterministicScore == null
                ? "Incomplete evidence"
                : `${s.deterministicScore}/100 deterministic score`}
            </Badge>
            <p>{s.deviations.length} requirement deviations</p>
            <Link to={`/events/${id}/suppliers/${s.id}`}>
              Inspect supplier →
            </Link>
          </Panel>
        ))}
      </div>
      <Panel title="Requirements and evaluation criteria">
        <EventEditor
          key={event.revision}
          initial={event}
          onSave={(v) =>
            action(
              () => api(`/procurement-events/${id}`, "PUT", v),
              "Requirements saved; existing analysis is now stale",
            )
          }
        />
      </Panel>
      <Panel title="Recent activity">
        {audit.slice(0, 8).map((a) => (
          <p key={a.id}>
            <Badge>{a.event_type}</Badge>{" "}
            {new Date(a.created_at).toLocaleString()}
          </p>
        ))}
      </Panel>
    </>
  );
}
