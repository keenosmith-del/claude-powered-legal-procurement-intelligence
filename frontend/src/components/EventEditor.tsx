import { useState, type FormEvent } from "react";
import { defaultRequirements, defaultCriteria, label } from "../api";
export default function EventEditor({
  initial,
  onSave,
}: {
  initial?: any;
  onSave: (v: any) => Promise<void>;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(
    initial?.category ?? "Infrastructure support",
  );
  const [requirements, setRequirements] = useState<any>(
    initial?.requirements ?? defaultRequirements,
  );
  const [criteria, setCriteria] = useState<any[]>(
    (initial?.criteria ?? defaultCriteria).map((c: any) => ({
      ...c,
      weight: Number(c.weight),
    })),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave({
        title,
        description,
        category,
        requirements,
        criteria: criteria.map((c) => ({
          category: c.category,
          weight: Number(c.weight),
          description: c.description,
        })),
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="form">
      <label>
        Event title
        <input
          required
          minLength={3}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label>
        Category
        <input
          required
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
      </label>
      <label>
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <h3>Requirements</h3>
      <div className="grid3">
        {Object.entries(requirements).map(([key, value]) => (
          <label key={key}>
            {label(key)}
            {typeof value === "boolean" ? (
              <input
                type="checkbox"
                checked={value}
                onChange={(e) =>
                  setRequirements({ ...requirements, [key]: e.target.checked })
                }
              />
            ) : (
              <input
                type="number"
                step="any"
                required
                value={String(value)}
                onChange={(e) =>
                  setRequirements({
                    ...requirements,
                    [key]: Number(e.target.value),
                  })
                }
              />
            )}
          </label>
        ))}
      </div>
      <h3>
        Evaluation weights · total{" "}
        {criteria.reduce((n, c) => n + Number(c.weight), 0)}%
      </h3>
      <div className="grid3">
        {criteria.map((c, i) => (
          <label key={c.category}>
            {label(c.category)} (%)
            <input
              type="number"
              min="0"
              max="100"
              value={c.weight}
              onChange={(e) =>
                setCriteria(
                  criteria.map((v, j) =>
                    j === i ? { ...v, weight: Number(e.target.value) } : v,
                  ),
                )
              }
            />
          </label>
        ))}
      </div>
      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}
      <button disabled={busy}>
        {busy
          ? "Saving…"
          : initial
            ? "Save requirements and criteria"
            : "Create procurement event"}
      </button>
    </form>
  );
}
