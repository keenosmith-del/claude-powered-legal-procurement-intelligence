import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { Badge, Empty, Panel } from "../components/ui";
import { useEffect } from "react";
import EventEditor from "../components/EventEditor";
export default function Home() {
  const [events, setEvents] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [create, setCreate] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    api("/procurement-events")
      .then(setEvents)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <main className="home">
      <div className="heading">
        <div>
          <p className="eyebrow">PROCUREMENT WORKSPACE</p>
          <h1>Procurement overview</h1>
          <p>
            Compare commercial exposure, inspect contract evidence and prepare
            your negotiation.
          </p>
        </div>
        <button onClick={() => setCreate(!create)}>
          {create ? "Close form" : "+ New event"}
        </button>
      </div>
      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}
      {create && (
        <Panel title="Create event">
          <EventEditor
            onSave={async (v) => {
              const e = await api("/procurement-events", "POST", v);
              navigate(`/events/${e.id}/overview`);
            }}
          />
        </Panel>
      )}
      <div className="event-list">
        {events.map((e) => (
          <Link
            key={e.id}
            to={`/events/${e.id}/overview`}
            className="event-card"
          >
            <div>
              <Badge>{e.status}</Badge>
              <h2>{e.title}</h2>
              <p>{e.description}</p>
              <small>
                {e.category} · Updated{" "}
                {new Date(e.updated_at).toLocaleDateString()}
              </small>
            </div>
            <span>Open workspace →</span>
          </Link>
        ))}
      </div>
      {!events.length && !error && (
        <Empty>No procurement events yet. Create one to begin.</Empty>
      )}
    </main>
  );
}
