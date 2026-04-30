import { useState } from "react";
import { BarChart3, Clock3, Radio } from "lucide-react";

import { Reports } from "./pages/Reports";
import TimelineReport from "./pages/TimelineReport";
import { Fleet } from "./pages/Fleet";

type Page = "reports" | "timeline" | "live";

export default function App() {
  const [page, setPage] = useState<Page>("reports");
  const [lang, setLang] = useState<"ar" | "en">("ar");

  const isArabic = lang === "ar";

  const labels = {
    ar: {
      reports: "التقارير",
      timeline: "الخط الزمني",
      live: "المباشر",
      lang: "English",
    },
    en: {
      reports: "Reports",
      timeline: "Timeline",
      live: "Live",
      lang: "العربية",
    },
  };

  const tabClass = (target: Page) =>
    `flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
      page === target
        ? "bg-blue-600 text-white shadow-sm"
        : "bg-white text-gray-700 hover:bg-gray-100 border"
    }`;

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      className="h-screen flex flex-col bg-gray-50 overflow-hidden"
    >
      <header className="shrink-0 bg-white border-b px-3 py-2 flex items-center gap-2">
       <button
          type="button"
          onClick={() => setPage("reports")}
          className={tabClass("reports")}
        >
          <BarChart3 size={18} />
          {labels[lang].reports}
        </button>

        <button
          type="button"
          onClick={() => setPage("timeline")}
          className={tabClass("timeline")}
        >
          <Clock3 size={18} />
          {labels[lang].timeline}
        </button>

        <button
          type="button"
          onClick={() => setPage("live")}
          className={tabClass("live")}
        >
          <Radio size={18} />
          {labels[lang].live}
        </button>

        <button
          type="button"
          onClick={() => setLang(isArabic ? "en" : "ar")}
          className="ms-auto rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
        >
          {labels[lang].lang}
        </button>
      </header>

      <main className="min-h-0 flex-1 overflow-auto">
        <div className={page === "reports" ? "block h-full" : "hidden"}>
          <Reports lang={lang} />
        </div>

        <div className={page === "timeline" ? "block h-full" : "hidden"}>
          <TimelineReport lang={lang} />
        </div>

        <div className={page === "live" ? "block h-full" : "hidden"}>
          <Fleet lang={lang} />
        </div>
      </main>
    </div>
  );
}
