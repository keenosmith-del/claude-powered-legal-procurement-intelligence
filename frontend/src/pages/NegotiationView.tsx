import { Badge, Empty, Panel } from "../components/ui";

import type { WorkspaceViewProps } from "../types";
export default function NegotiationView({
  result,
  refs,
  names,
}: WorkspaceViewProps) {
  return (
    <>
      {!result ? (
        <Empty>
          Run Claude analysis to produce a grounded negotiation playbook.
        </Empty>
      ) : (
        <>
          <Panel title="Negotiation opportunities">
            {result.negotiationOpportunities.map((n: any, i: number) => (
              <article key={i} className="item">
                <Badge>{n.priority}</Badge>
                <h3>
                  {n.issue} · {names(n.supplierId)}
                </h3>
                <div className="grid3">
                  <p>
                    <strong>Current</strong>
                    <br />
                    {n.currentPosition}
                  </p>
                  <p>
                    <strong>Proposed target</strong>
                    <br />
                    {n.targetPosition}
                  </p>
                  <p>
                    <strong>Fallback</strong>
                    <br />
                    {n.fallbackPosition}
                  </p>
                </div>
                <p>{n.rationale}</p>
                <p>
                  <strong>Expected impact:</strong> {n.expectedImpact}
                </p>
                {refs(n.evidenceReferences)}
              </article>
            ))}
          </Panel>
          <Panel title="Negotiation playbook">
            <p>{result.playbook.commercialRationale}</p>
            {[
              ["Leverage points", "leveragePoints"],
              ["Priority issues", "priorityIssues"],
              ["Requested concessions", "requestedConcessions"],
              ["Fallback positions", "fallbackPositions"],
              ["Risks to avoid", "risksToAvoid"],
            ].map(([title, key]) => (
              <div key={key}>
                <h3>{title}</h3>
                <ul>
                  {result.playbook[
                    key as
                      | "leveragePoints"
                      | "priorityIssues"
                      | "requestedConcessions"
                      | "fallbackPositions"
                      | "risksToAvoid"
                  ].map((v: string, i: number) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
              </div>
            ))}
            <h3>Suggested sequence</h3>
            {result.playbook.sequence.map((s: any, i: number) => (
              <article className="item" key={i}>
                <h3>
                  {s.step}. {s.action}
                </h3>
                <p>{s.concessionLogic}</p>
                {refs(s.evidenceReferences)}
              </article>
            ))}
          </Panel>
        </>
      )}
    </>
  );
}
