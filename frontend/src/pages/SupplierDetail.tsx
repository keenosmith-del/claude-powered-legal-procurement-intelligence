import { type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { label, money } from "../api";
import { Empty, Panel } from "../components/ui";
export default function SupplierDetail({
  suppliers,
  eventId,
  refs,
}: {
  suppliers: any[];
  eventId: string;
  refs: (ids: string[]) => ReactNode;
}) {
  const { supplierId } = useParams();
  const s = suppliers.find((s) => s.id === supplierId);
  if (!s) return <Empty>Supplier not found.</Empty>;
  return (
    <>
      <Panel title={s.name}>
        <p>{s.description}</p>
        <p className="stat">{money(s.financial?.total)}</p>
        <p>
          Projected total · weighted score{" "}
          {s.deterministicScore ?? "Incomplete"}
        </p>
        {s.deviations.map((d: any) => (
          <p key={d.field}>
            {d.reason}: {String(d.actual)} (target {String(d.target)})
          </p>
        ))}
        <Link to={`/events/${eventId}/documents`}>Manage documents →</Link>
      </Panel>
      <Panel title="Contract evidence">
        {s.contractTerms.map((t: any) => (
          <article key={t.id} className="item">
            <h3>
              {label(t.term)} ·{" "}
              {t.structured_value === null
                ? "Unknown"
                : String(t.structured_value)}
            </h3>
            {refs([t.id])}
          </article>
        ))}
      </Panel>
    </>
  );
}
