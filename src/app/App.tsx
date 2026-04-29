// src/app/App.tsx
import { useState } from "react";
import { Reports } from "./pages/Reports";
import { TimelineReport } from "./pages/TimelineReport";
import { LiveMap } from "./pages/LiveMap";

type Page = "reports" | "timeline" | "live";

export default function App() {
  const [page, setPage] = useState<Page>("reports");
  const [lang, setLang] = useState<"ar" | "en">("ar");

  const isArabic = lang === "ar";

  const labels = {
    ar: { reports: "التقارير", timeline: "الخط الزمني", live: "المباشر", lang: "English" },
    en: { reports: "Reports", timeline: "Timeline", live: "Live", lang: "العربية" },
  };

  return (
    <div dir={isArabic ? "rtl" : "ltr"} className="min-h-screen flex bg-gray-50">
      <aside className="w-56 bg-white border shadow-sm p-4">
        <div className="font-bold mb-6">Bazytrack Go</div>

        <button onClick={() => setPage("reports")} className="block w-full p-3 text-start">
          {labels[lang].reports}
        </button>

        <button onClick={() => setPage("timeline")} className="block w-full p-3 text-start">
          {labels[lang].timeline}
        </button>

        <button onClick={() => setPage("live")} className="block w-full p-3 text-start">
          {labels[lang].live}
        </button>

        <button onClick={() => setLang(isArabic ? "en" : "ar")} className="mt-6 p-2 border rounded">
          {labels[lang].lang}
        </button>
      </aside>

      <main className="flex-1 overflow-auto">
        {page === "reports" && <Reports />}
        {page === "timeline" && <TimelineReport />}
        {page === "live" && <LiveMap />}
      </main>
    </div>
  );
}
