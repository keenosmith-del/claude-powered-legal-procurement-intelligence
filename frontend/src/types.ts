import type { ReactNode } from "react";
import type { AnalysisResult, Requirements } from "../../backend/src/schemas";
export interface Criterion {
  id?: string;
  category: string;
  weight: number | string;
  description: string;
}
export interface ProcurementEvent {
  id: string;
  title: string;
  description: string;
  category: string;
  requirements: Requirements;
  criteria: Criterion[];
  revision: number;
  status: string;
  created_at: string;
  updated_at: string;
}
export interface ContractTerm {
  id: string;
  supplier_id: string;
  category: string;
  term: string;
  structured_value: string | number | boolean | null;
  unit: string;
  source_document_id: string;
  source_location: string;
  excerpt: string;
  confidence: number | string;
  origin: string;
  filename: string;
  supplier_name?: string;
}
export interface SupplierDocument {
  id: string;
  filename: string;
  processing_status: string;
  document_type: string;
  error: string | null;
}
export interface FinancialProjection {
  schedule: { year: number; cost: number }[];
  total: number;
  recurring: number;
  setup: number;
  escalationImpact: number;
}
export interface SupplierComparison {
  id: string;
  name: string;
  description: string;
  event_id: string;
  terms: Record<string, string | number | boolean | null>;
  contractTerms: ContractTerm[];
  documents: SupplierDocument[];
  financial: FinancialProjection | null;
  contractValue: number | null;
  criterionScores: Record<string, number | null>;
  deterministicScore: number | null;
  deviations: {
    field: string;
    actual: unknown;
    target: unknown;
    reason: string;
  }[];
  missing: string[];
  conflicts: string[];
  costDifference: number | null;
  percentageDifference: number | null;
}
export interface ComparisonResponse {
  event: ProcurementEvent;
  suppliers: SupplierComparison[];
}
export interface AnalysisRecord {
  id: string;
  result: AnalysisResult;
  revision: number;
  stale: boolean;
  model: string;
  generated_at: string;
  trace: {
    stage: string;
    tool?: string;
    durationMs: number;
    inputTokens?: number;
    outputTokens?: number;
  }[];
}
export interface AuditRecord {
  id: string;
  event_type: string;
  created_at: string;
  metadata: unknown;
}
export interface DecisionRecord {
  id: string;
  selected_supplier_id: string | null;
  outcome: string;
  notes: string;
  negotiation_required: boolean;
  decided_at: string;
}
export interface WorkspaceViewProps {
  event: ProcurementEvent;
  suppliers: SupplierComparison[];
  terms: ContractTerm[];
  result: AnalysisResult | undefined;
  analysis: AnalysisRecord | null;
  audit: AuditRecord[];
  decisions: DecisionRecord[];
  id: string;
  action: (fn: () => Promise<unknown>, message?: string) => Promise<void>;
  busy: boolean;
  refs: (ids: string[]) => ReactNode;
  names: (id: string) => string;
}
