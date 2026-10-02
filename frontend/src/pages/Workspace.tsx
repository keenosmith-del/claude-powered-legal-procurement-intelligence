import type {
  ComparisonResponse,
  AnalysisRecord,
  ContractTerm,
  AuditRecord,
  DecisionRecord,
} from "../types";
import { useState, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { api, label } from "../api";
import { Badge, Empty } from "../components/ui";
import { useEffect } from "react";
import { NavLink, Routes, Route } from "react-router-dom";
import SupplierDetail from "./SupplierDetail";
import Documents from "./Documents";
import OverviewView from "./OverviewView";
import ComparisonView from "./ComparisonView";
import SuppliersView from "./SuppliersView";
import TermsView from "./TermsView";
import FinancialView from "./FinancialView";
import RisksView from "./RisksView";
import RecommendationView from "./RecommendationView";
import NegotiationView from "./NegotiationView";
import EvidenceView from "./EvidenceView";
import DecisionView from "./DecisionView";
const tabs = [
  ["overview", "Event"],
  ["comparison", "Comparison"],
  ["suppliers", "Suppliers"],
  ["documents", "Documents"],
  ["terms", "Contract terms"],
  ["financial", "Financial analysis"],
  ["risks", "Risks"],
  ["recommendation", "AI recommendation"],
  ["negotiation", "Negotiation strategy"],
  ["evidence", "Evidence"],
  ["decision", "Decision"],
];
export default function Workspace() {
  const { id } = useParams();
  const currentId = useRef(id);
  currentId.current = id;
  const [data, setData] = useState<ComparisonResponse | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisRecord | null>(null);
  const [historicalTerms, setHistoricalTerms] = useState<ContractTerm[]>([]);
  const [terms, setTerms] = useState<ContractTerm[]>([]);
  const [audit, setAudit] = useState<AuditRecord[]>([]);
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    const loadedId = id;
    const [c, a, t, u, d, h] = await Promise.all([
      api<ComparisonResponse>(`/procurement-events/${id}/comparison`),
      api<AnalysisRecord | null>(`/procurement-events/${id}/analysis`),
      api<ContractTerm[]>(`/procurement-events/${id}/terms`),
      api<AuditRecord[]>(`/procurement-events/${id}/audit`),
      api<DecisionRecord[]>(`/procurement-events/${id}/decisions`),
      api<ContractTerm[]>(`/procurement-events/${id}/terms?history=1`),
    ]);
    if (currentId.current !== loadedId) return;
    setHistoricalTerms(h);
    setData(c);
    setAnalysis(a);
    setTerms(t);
    setAudit(u);
    setDecisions(d);
  }
  useEffect(() => {
    setData(null);
    setError("");
    setNotice("");
    const loadedId = id;
    load().catch((e) => {
      if (currentId.current === loadedId) setError(e.message);
    });
  }, [id]);
  async function action(fn: () => Promise<unknown>, message = "Saved") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      await load();
      setNotice(message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <main className="home">
        {error ? (
          <div role="alert" className="error">
            {error}
          </div>
        ) : (
          <Empty>Loading procurement workspace…</Empty>
        )}
        <Link to="/">Back to overview</Link>
      </main>
    );
  const { event, suppliers } = data;
  const names = (supplierId: string) =>
    suppliers.find((s: any) => s.id === supplierId)?.name ?? supplierId;
  const result = analysis?.result;
  const refs = (ids: string[]) => (
    <div className="refs">
      {ids.map((ref) => {
        const t = historicalTerms.find((t) => t.id === ref);
        return t ? (
          <details key={ref}>
            <summary>
              {t.supplier_name} · {label(t.term)} · {t.source_location}
            </summary>
            <blockquote>{t.excerpt}</blockquote>
            <Link to={`/events/${id}/evidence`}>
              {t.filename} · {t.origin}
            </Link>
          </details>
        ) : (
          <span key={ref}>Insufficient evidence</span>
        );
      })}
    </div>
  );
  const viewProps = {
    event,
    suppliers,
    terms,
    result,
    analysis,
    audit,
    decisions,
    id: id!,
    action,
    busy,
    refs,
    names,
  };
  return (
    <div className="workspace">
      <aside>
        <Link className="back" to="/">
          ← All events
        </Link>
        <p className="eyebrow">EVALUATION WORKFLOW</p>
        <nav>
          {tabs.map(([path, title]) => (
            <NavLink key={path} to={`/events/${id}/${path}`}>
              {title}
            </NavLink>
          ))}
        </nav>
        <div className="aside-note">
          Human review required.
          <br />
          This workspace supports procurement decisions and does not provide
          legal advice.
        </div>
      </aside>
      <main>
        <div className="heading">
          <div>
            <p className="eyebrow">{event.category}</p>
            <h1>{event.title}</h1>
            <p>{event.description}</p>
          </div>
          <Badge>{event.status}</Badge>
        </div>
        <div className="toolbar">
          <span>
            {suppliers.length} suppliers · {terms.length} evidence-backed terms
          </span>
          <button
            disabled={busy}
            onClick={() =>
              action(
                () => api(`/procurement-events/${id}/analyse`, "POST"),
                "Claude analysis saved",
              )
            }
          >
            {busy ? "Processing…" : "Run Claude analysis"}
          </button>
        </div>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="notice" role="status">
            {notice}
          </div>
        )}
        {analysis?.stale && (
          <div className="warning">
            Requirements or evidence changed since this analysis. Run Claude
            analysis again before relying on it.
          </div>
        )}
        <Routes>
          <Route path="overview" element={<OverviewView {...viewProps} />} />
          <Route
            path="comparison"
            element={<ComparisonView {...viewProps} />}
          />
          <Route path="suppliers" element={<SuppliersView {...viewProps} />} />
          <Route
            path="suppliers/:supplierId"
            element={
              <SupplierDetail suppliers={suppliers} eventId={id!} refs={refs} />
            }
          />
          <Route
            path="documents"
            element={
              <Documents
                key={id}
                suppliers={suppliers}
                action={action}
                busy={busy}
              />
            }
          />
          <Route path="terms" element={<TermsView {...viewProps} />} />
          <Route path="financial" element={<FinancialView {...viewProps} />} />
          <Route path="risks" element={<RisksView {...viewProps} />} />
          <Route
            path="recommendation"
            element={<RecommendationView {...viewProps} />}
          />
          <Route
            path="negotiation"
            element={<NegotiationView {...viewProps} />}
          />
          <Route path="evidence" element={<EvidenceView {...viewProps} />} />
          <Route path="decision" element={<DecisionView {...viewProps} />} />
          <Route
            path="*"
            element={
              <Empty>
                <Link to={`/events/${id}/overview`}>Open event overview</Link>
              </Empty>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
