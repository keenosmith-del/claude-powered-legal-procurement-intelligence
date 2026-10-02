import { money } from "../api";
import { Panel } from "../components/ui";

import WhatIf from "./WhatIf";
import type { WorkspaceViewProps } from "../types";
export default function FinancialView({
  event,
  suppliers,
  id,
}: WorkspaceViewProps) {
  return (
    <>
      <Panel
        title={`${event.requirements.projectionYears}-year financial projection`}
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Year</th>
                {suppliers.map((s: any) => (
                  <th key={s.id}>{s.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from(
                { length: event.requirements.projectionYears },
                (_, i) => (
                  <tr key={i}>
                    <td>Year {i + 1}</td>
                    {suppliers.map((s: any) => (
                      <td key={s.id}>
                        {money(s.financial?.schedule[i]?.cost)}
                      </td>
                    ))}
                  </tr>
                ),
              )}
              {[
                ["Setup fee", (s: any) => s.financial?.setup],
                ["Total", (s: any) => s.financial?.total],
                [
                  "Cumulative escalation impact",
                  (s: any) => s.financial?.escalationImpact,
                ],
                ["Initial contract value", (s: any) => s.contractValue],
              ].map(([title, fn]) => (
                <tr key={String(title)}>
                  <th>{String(title)}</th>
                  {suppliers.map((s: any) => (
                    <td key={s.id}>{money((fn as any)(s))}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">
          Nominal ZAR costs; taxes, discounting, out-of-scope charges and
          service credits are excluded. Setup fees occur once. Contract value
          uses initial duration; scenario horizon is independent.
        </p>
      </Panel>
      <WhatIf
        key={`${id}:${event.revision}`}
        eventId={id!}
        suppliers={suppliers}
      />
    </>
  );
}
