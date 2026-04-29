// src/app/App.tsx
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
      title: "Bazytrack Go",
      reports: "التقارير",
      timeline: "الخط الزمني",
      live: "المباشر",
      lang: "English",
    },
    en: {
      title: "Bazytrack Go",
      reports: "Reports",
      timeline: "Timeline",
      live: "Live",
      lang: "العربية",
    },
  };

  const menuItemClass = (target: Page) =>
    `w-full flex items-center gap-2 rounded-xl px-3 py-2 mb-2 text-start transition ${
      page === target
        ? "bg-blue-600 text-white shadow-sm"
        : "text-gray-700 hover:bg-gray-100"
    }`;

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      className="h-screen flex bg-gray-50 overflow-hidden"
    >
      <aside className="w-56 shrink-0 bg-white border shadow-sm p-4">
        <div className="font-bold mb-6 text-lg">
          {labels[lang].title}
        </div>

        <button
          type="button"
          onClick={() => setPage("reports")}
          className={menuItemClass("reports")}
        >
          <BarChart3 size={18} />
          {labels[lang].reports}
        </button>

        <button
          type="button"
          onClick={() => setPage("timeline")}
          className={menuItemClass("timeline")}
        >
          <Clock3 size={18} />
          {labels[lang].timeline}
        </button>

        <button
          type="button"
          onClick={() => setPage("live")}
          className={menuItemClass("live")}
        >
          <Radio size={18} />
          {labels[lang].live}
        </button>

        <button
          type="button"
          onClick={() => setLang(isArabic ? "en" : "ar")}
          className="mt-6 w-full rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
        >
          {labels[lang].lang}
        </button>
      </aside>

      <main className="flex-1 overflow-auto">
        {page === "reports" && <Reports />}
        {page === "timeline" && <TimelineReport />}
        {page === "live" && <Fleet />}
      </main>
    </div>
  );
}
