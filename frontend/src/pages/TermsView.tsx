import { label } from "../api";
import { Badge, Empty, Panel } from "../components/ui";

import type { WorkspaceViewProps } from "../types";
export default function TermsView({ terms, refs }: WorkspaceViewProps) {
  return (
    <Panel title="Normalised contract terms">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Category / term</th>
              <th>Value</th>
              <th>Provenance</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {terms.map((t) => (
              <tr key={t.id}>
                <td>{t.supplier_name}</td>
                <td>
                  {label(t.category)}
                  <br />
                  {label(t.term)}
                </td>
                <td>
                  {t.structured_value === null
                    ? "Information not found"
                    : String(t.structured_value)}{" "}
                  <small>{t.unit}</small>
                </td>
                <td>
                  <Badge>{t.origin}</Badge>
                  <br />
                  {Math.round(Number(t.confidence) * 100)}% extraction
                  confidence
                </td>
                <td>{refs([t.id])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!terms.length && (
        <Empty>Upload and extract documents to see terms.</Empty>
      )}
    </Panel>
  );
}
