import { label } from "../api";
import { Badge, Panel } from "../components/ui";

import type { WorkspaceViewProps } from "../types";
export default function EvidenceView({
  terms,
  result,
  refs,
  names,
}: WorkspaceViewProps) {
  return (
    <Panel title="Evidence register">
      <p>
        Facts retain verbatim source excerpts. Interpretation and
        recommendations require human verification against the complete clause.
      </p>
      {result?.claims.map((c: any, i: number) => (
        <article className="item" key={i}>
          <Badge>{c.evidenceType}</Badge>
          <h3>
            {names(c.supplierId)} · {c.claim}
          </h3>
          {refs(c.evidenceReferences)}
        </article>
      ))}
      <h3>All extracted source facts</h3>
      {terms.map((t) => (
        <article className="item" key={t.id}>
          <h3>
            {t.supplier_name} · {label(t.term)}
          </h3>
          {refs([t.id])}
          <a href={`/api/documents/${t.source_document_id}/download`}>
            Download source document
          </a>
        </article>
      ))}
    </Panel>
  );
}
