import { useState } from "react";

import { api } from "../api";
import { Badge, Panel } from "../components/ui";
export default function Documents({
  suppliers,
  action,
  busy,
}: {
  suppliers: any[];
  action: (fn: () => Promise<unknown>, message?: string) => Promise<void>;
  busy: boolean;
}) {
  const [preview, setPreview] = useState<any>(null);
  return (
    <>
      <Panel title="Supplier documents">
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const id = String(f.get("supplier"));
            f.delete("supplier");
            void action(
              () => api(`/suppliers/${id}/documents`, "POST", f),
              "Document text processed; trigger Claude extraction to extract terms",
            );
          }}
        >
          <select name="supplier" required>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select name="documentType">
            {[
              "contract",
              "proposal",
              "pricing",
              "sla",
              "warranty",
              "commercial",
            ].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <input type="file" name="file" accept=".txt,.pdf,.docx" required />
          <button disabled={busy || !suppliers.length}>Upload document</button>
        </form>
        <p className="muted">
          PDF, DOCX or TXT · up to 10 MB. Scanned PDFs require prior OCR.
          Seed-reviewed terms are sample facts, not Claude output.
        </p>
        {suppliers.map((s) => (
          <div key={s.id}>
            <h3>{s.name}</h3>
            {s.documents.map((d: any) => (
              <div className="row" key={d.id}>
                <div>
                  <strong>{d.filename}</strong>
                  <p>
                    <Badge>{d.processing_status}</Badge> {d.error}
                  </p>
                </div>
                <div className="actions">
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      action(async () => {
                        setPreview(await api(`/documents/${d.id}`));
                      }, "Source opened")
                    }
                  >
                    View text
                  </button>
                  <a href={`/api/documents/${d.id}/download`}>Download</a>
                  <button
                    disabled={busy || d.processing_status === "extracting"}
                    onClick={() =>
                      action(
                        () => api(`/documents/${d.id}/extract`, "POST"),
                        "Claude contract extraction saved",
                      )
                    }
                  >
                    Extract with Claude
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </Panel>
      {preview && (
        <Panel title={preview.filename}>
          <pre className="source">{preview.extracted_text}</pre>
        </Panel>
      )}
    </>
  );
}
