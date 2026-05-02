import { useState } from "react";
import { BarChart3, Clock3, Radio, Menu, X, Timer } from "lucide-react";

import { Reports } from "./pages/Reports";
import TimelineReport from "./pages/TimelineReport";
import { Fleet } from "./pages/Fleet";
import IdleReport from "./pages/IdleReport";

type Page = "reports" | "timeline" | "idle" | "live";

export default function App() {
  const [page, setPage] = useState<Page>("reports");
  const [lang, setLang] = useState<"ar" | "en">("ar");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isArabic = lang === "ar";

  const labels = {
    ar: {
      reports: "التقارير",
      timeline: "الخط الزمني",
      idleReport: "الخمول",
      live: "المباشر",
      lang: "Eng",
    },
    en: {
      reports: "Reports",
      timeline: "Timeline",
      idleReport: "Idle",
      live: "Live",
      lang: "عربي",
    },
  };

  const tabClass = (target: Page) =>
    `flex items-center gap-2 rounded-xl px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition whitespace-nowrap ${
      page === target
        ? "bg-blue-600 text-white shadow-sm"
        : "bg-white text-gray-700 hover:bg-gray-100 border"
    }`;

  const handleTabClick = (tab: Page) => {
    setPage(tab);
    setMobileMenuOpen(false);
  };

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      className="h-screen flex flex-col bg-gray-50 overflow-hidden"
    >
      <header className="shrink-0 bg-white border-b px-3 sm:px-4 py-2 sm:py-3 flex items-center gap-2 justify-between sm:justify-start">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="sm:hidden p-2 hover:bg-gray-100 rounded-lg"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <div className="hidden sm:flex items-center gap-2">
          <button onClick={() => handleTabClick("reports")} className={tabClass("reports")}>
            <BarChart3 size={18} />
            {labels[lang].reports}
          </button>

          <button onClick={() => handleTabClick("timeline")} className={tabClass("timeline")}>
            <Clock3 size={18} />
            {labels[lang].timeline}
          </button>

          <button onClick={() => handleTabClick("idle")} className={tabClass("idle")}>
            <Timer size={18} />
            {labels[lang].idleReport}
          </button>

          <button onClick={() => handleTabClick("live")} className={tabClass("live")}>
            <Radio size={18} />
            {labels[lang].live}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setLang(isArabic ? "en" : "ar")}
          className="sm:ms-auto rounded-xl border px-2 sm:px-3 py-2 text-xs sm:text-sm hover:bg-gray-50 whitespace-nowrap"
        >
          {labels[lang].lang}
        </button>
      </header>

      {mobileMenuOpen && (
        <div className="sm:hidden bg-white border-b px-3 py-2 flex flex-col gap-2">
          <button onClick={() => handleTabClick("reports")} className={tabClass("reports")}>
            <BarChart3 size={18} />
            {labels[lang].reports}
          </button>

          <button onClick={() => handleTabClick("timeline")} className={tabClass("timeline")}>
            <Clock3 size={18} />
            {labels[lang].timeline}
          </button>

          <button onClick={() => handleTabClick("idle")} className={tabClass("idle")}>
            <Timer size={18} />
            {labels[lang].idleReport}
          </button>

          <button onClick={() => handleTabClick("live")} className={tabClass("live")}>
            <Radio size={18} />
            {labels[lang].live}
          </button>
        </div>
      )}

      <main className="min-h-0 flex-1 overflow-auto">
        <div className={page === "reports" ? "block h-full" : "hidden"}>
          <Reports lang={lang} />
        </div>

        <div className={page === "timeline" ? "block h-full" : "hidden"}>
          <TimelineReport lang={lang} />
        </div>

        <div className={page === "idle" ? "block h-full" : "hidden"}>
          <IdleReport lang={lang} />
        </div>

        <div className={page === "live" ? "block h-full" : "hidden"}>
          <Fleet lang={lang} />
        </div>
      </main>
    </div>
  );
}
