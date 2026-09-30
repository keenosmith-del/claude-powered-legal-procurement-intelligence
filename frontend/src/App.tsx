import { Link, Routes, Route } from "react-router-dom";
import { Empty } from "./components/ui";
import Home from "./pages/Home";
import Workspace from "./pages/Workspace";
export default function App() {
  return (
    <>
      <header className="topbar">
        <Link to="/">Legal & Procurement Intelligence</Link>
        <span>AI-assisted decision support</span>
      </header>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/events/:id/*" element={<Workspace />} />
        <Route
          path="*"
          element={
            <Empty>
              Page not found. <Link to="/">Open procurement overview</Link>
            </Empty>
          }
        />
      </Routes>
    </>
  );
}
