import { Badge, Empty, Panel } from "../components/ui";

import type { WorkspaceViewProps } from "../types";
export default function RisksView({ result, refs, names }: WorkspaceViewProps) {
  return (
    <>
      <Panel title="Contractual risk analysis">
        {!result ? (
          <Empty>
            Run Claude analysis to identify qualitative risks. Deterministic
            requirement deviations are available in Comparison.
          </Empty>
        ) : (
          result.risks.map((r: any, i: number) => (
            <article key={i} className="item">
              <Badge>{r.severity}</Badge>
              <h3>
                {r.title} · {names(r.supplierId)}
              </h3>
              <p>{r.explanation}</p>
              <p>
                <strong>Business impact:</strong> {r.businessImpact}
              </p>
              <p>
                <strong>Mitigation:</strong> {r.mitigation}
              </p>
              {refs(r.evidenceReferences)}
            </article>
          ))
        )}
      </Panel>
    </>
  );
}
