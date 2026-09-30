import { Badge, Empty, Panel } from "../components/ui";

import type { WorkspaceViewProps } from "../types";
export default function RecommendationView({
  result,
  analysis,
  refs,
  names,
}: WorkspaceViewProps) {
  return (
    <>
      {!result || !analysis ? (
        <Empty>
          No AI recommendation yet. Run Claude analysis after reviewing supplier
          evidence.
        </Empty>
      ) : (
        <>
          <Panel
            title={`Recommendation · ${names(result.recommendation.recommendedSupplierId)}`}
          >
            <Badge>
              {result.recommendation.confidence} confidence · Claude
              interpretation
            </Badge>
            <p className="lead">
              {result.recommendation.recommendationSummary}
            </p>
            <ul>
              {result.recommendation.keyReasons.map((r: string, i: number) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
            <p className="muted">
              {analysis.model} ·{" "}
              {new Date(analysis.generated_at).toLocaleString()}
            </p>
          </Panel>
          <div className="grid3">
            {result.supplierAssessments.map((s: any) => (
              <Panel key={s.supplierId} title={names(s.supplierId)}>
                <p>{s.overallAssessment}</p>
                <h3>Strengths</h3>
                <ul>
                  {s.strengths.map((v: string, i: number) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
                <h3>Weaknesses</h3>
                <ul>
                  {s.weaknesses.map((v: string, i: number) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
                <h3>Material risks</h3>
                <ul>
                  {s.materialRisks.map((v: string, i: number) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
                <p>{s.commercialPosition}</p>
                <p>{s.requirementAlignment}</p>
              </Panel>
            ))}
          </div>
          <Panel title="Trade-off reasoning">
            {result.tradeoffs.map((t: any, i: number) => (
              <article className="item" key={i}>
                <h3>{t.tradeoff}</h3>
                <p>
                  {names(t.supplierA)} ↔ {names(t.supplierB)} · {t.significance}
                </p>
                <p>{t.conclusion}</p>
              </article>
            ))}
          </Panel>
          <Panel title="Decision factors">
            {result.decisionFactors.map((f: any, i: number) => (
              <article className="item" key={i}>
                <h3>
                  {f.factor} · {f.importance}
                </h3>
                <p>{f.conclusion}</p>
                {refs(f.evidenceReferences)}
              </article>
            ))}
          </Panel>
          <Panel title="Limitations and assumptions">
            <ul>
              {result.limitations.map((v: string, i: number) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
          </Panel>
          <Panel title="AI workflow trace">
            {analysis.trace.map((t: any, i: number) => (
              <p key={i}>
                <Badge>{t.stage}</Badge> {t.tool ?? ""} · {t.durationMs} ms{" "}
                {t.inputTokens != null
                  ? `· ${t.inputTokens} input / ${t.outputTokens} output tokens`
                  : ""}
              </p>
            ))}
          </Panel>
        </>
      )}
    </>
  );
}
