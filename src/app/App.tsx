import { Reports } from "./pages/Reports";
import TimelineReport from "./pages/TimelineReport";

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const page = params.get("page");

  if (page === "timeline") {
    return <TimelineReport />;
  }

  return <Reports />;
}
