import { useEffect, useMemo, useState } from "react";
import {
  Search,
  FileSpreadsheet,
  MessageSquare,
  MapPin,
  PlusCircle,
  ChevronDown,
  Clock,
  Gauge,
  Route,
  Car,
  CalendarDays,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import { api } from "../services/api";

type Device = {
  id: number;
  name: string;
};

type Position = {
  id?: number;
  deviceId?: number;
  latitude: number;
  longitude: number;
  speed?: number;
  valid?: boolean;
  address?: string;
  fixTime: string;
  geofenceIds?: number[];
  attributes?: {
    ignition?: boolean;
    distance?: number;
    deviceDistance?: number;
    matarProblem?: boolean;
  };
};

type Geofence = {
  id: number;
  name: string;
};

type TimelineBlock = {
  icon: string;
  status: "حركة" | "توقف" | "إيقاف" | "تشويش";
  start: Date;
  end: Date;
  startText: string;
  endText: string;
  startTimeOnly: string;
  endTimeOnly: string;
  durationSec: number;
  durationText: string;
  distance: number;
  avgSpeed: number;
  maxSpeed: number;
  address: string;
  geofenceName: string;
  lat: number | null;
  lon: number | null;
};

type TimelineReportData = {
  summary: {
    selectedDeviceName: string;
    from: string;
    to: string;
    offDuration: string;
    movingDuration: string;
    idleDuration: string;
    movingDistance: number;
  };
  blocks: TimelineBlock[];
};

const AMMAN_TZ = "Asia/Amman";

function todayText() {
  return new Date().toISOString().slice(0, 10);
}

function toUtcIsoFromLocal(date: string, time: string) {
  return new Date(`${date}T${time || "00:00:00"}`).toISOString();
}

function formatAmmanDate(value: Date | string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);

  const dayName = new Intl.DateTimeFormat("ar", {
    weekday: "long",
    timeZone: AMMAN_TZ,
  }).format(d);

  const datePart = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: AMMAN_TZ,
  }).format(d);

  const timePart = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: AMMAN_TZ,
  }).format(d);

  return `${dayName} ${datePart} ${timePart}`;
}

function formatAmmanTime(value: Date | string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: AMMAN_TZ,
  }).format(d);
}

function formatDuration(sec: number) {
  sec = Number(sec || 0);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);

  if (h > 0) return `${h} ساعة ${m} دقيقة ${s} ثانية`;
  return `${m} دقيقة ${s} ثانية`;
}

function round2(n: number) {
  return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
}

function statusColor(status: string) {
  // Keep the exact original business colors
  if (status === "حركة") return "#b8f5b8";
  if (status === "توقف") return "#fffdf2";
  if (status === "إيقاف") return "#f5f5f2";
  if (status === "تشويش") return "#f4cccc";
  return "#ddd";
}

function statusBadgeClass(status: string) {
  if (status === "حركة") return "bg-green-100 text-green-800 border-green-200";
  if (status === "توقف") return "bg-yellow-100 text-yellow-800 border-yellow-200";
  if (status === "إيقاف") return "bg-gray-100 text-gray-800 border-gray-200";
  if (status === "تشويش") return "bg-red-100 text-red-800 border-red-200";
  return "bg-slate-100 text-slate-800 border-slate-200";
}

function buildBlocks(positions: Position[], geofenceMap: Record<string, string>): TimelineBlock[] {
  const rawBlocks: any[] = [];

  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    const next = positions[i + 1];

    const attrs = p.attributes || {};
    const ignition = attrs.ignition === true;
    const speed = Number(p.speed || 0) * 1.852;

    const distance = Number(attrs.distance || 0) / 1000;
    const deviceDistance = Number(attrs.deviceDistance || 0) / 1000;
    const matarProblem = attrs.matarProblem === true;
    const isInvalid = p.valid === false || matarProblem || deviceDistance > 15 || distance > 10;

    let status: TimelineBlock["status"] = "إيقاف";
    let icon = "⚫️";

    if (isInvalid && ignition) {
      status = "تشويش";
      icon = "🔴";
    } else if (ignition && speed >= 0.01) {
      status = "حركة";
      icon = "🟢";
    } else if (ignition && speed < 0.01) {
      status = "توقف";
      icon = "🟡";
    }

    const geofenceId = Array.isArray(p.geofenceIds) && p.geofenceIds.length > 0 ? String(p.geofenceIds[0]) : "";
    const geofenceName = geofenceId ? geofenceMap[geofenceId] || "" : "";
    const address = geofenceName || p.address || "";

    const start = new Date(p.fixTime);
    const end = next ? new Date(next.fixTime) : new Date(p.fixTime);
    const durationSec = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));

    const item = {
      status,
      icon,
      start,
      end,
      durationSec,
      distance: status === "حركة" || status === "توقف" ? distance : 0,
      speedSum: speed,
      speedCount: 1,
      avgSpeed: speed,
      maxSpeed: speed,
      address,
      geofenceName,
      lat: Number(p.latitude),
      lon: Number(p.longitude),
    };

    const last = rawBlocks[rawBlocks.length - 1];
    if (
      last &&
      ((last.status === "إيقاف" && item.status === "إيقاف") ||
        (last.status === item.status && last.geofenceName === item.geofenceName))
    ) {
      last.end = item.end;
      last.durationSec += item.durationSec;
      last.distance += item.distance;
      last.speedSum += item.speedSum;
      last.speedCount += item.speedCount;
      last.avgSpeed = last.speedCount ? last.speedSum / last.speedCount : 0;
      last.maxSpeed = Math.max(last.maxSpeed, item.maxSpeed);
      if (!last.address && item.address) last.address = item.address;
      if (!Number.isFinite(last.lat) && Number.isFinite(item.lat)) last.lat = item.lat;
      if (!Number.isFinite(last.lon) && Number.isFinite(item.lon)) last.lon = item.lon;
    } else {
      rawBlocks.push(item);
    }
  }

  return rawBlocks.map((b) => ({
    icon: b.icon,
    status: b.status,
    start: b.start,
    end: b.end,
    startText: formatAmmanDate(b.start),
    endText: formatAmmanDate(b.end),
    startTimeOnly: formatAmmanTime(b.start),
    endTimeOnly: formatAmmanTime(b.end),
    durationSec: b.durationSec,
    durationText: formatDuration(b.durationSec),
    distance: round2(b.distance),
    avgSpeed: round2(b.avgSpeed),
    maxSpeed: round2(b.maxSpeed),
    address: b.address || "",
    geofenceName: b.geofenceName || "",
    lat: Number.isFinite(b.lat) ? b.lat : null,
    lon: Number.isFinite(b.lon) ? b.lon : null,
  }));
}

function buildReportResult(
  selectedDeviceName: string,
  fromIso: string,
  toIso: string,
  positions: Position[],
  geofences: Geofence[]
): TimelineReportData {
  const geofenceMap: Record<string, string> = {};
  geofences.forEach((g) => {
    geofenceMap[String(g.id)] = g.name || "";
  });

  const sorted = [...positions].sort((a, b) => new Date(a.fixTime).getTime() - new Date(b.fixTime).getTime());
  const blocks = buildBlocks(sorted, geofenceMap);

  let offDuration = 0;
  let movingDuration = 0;
  let idleDuration = 0;
  let movingDistance = 0;

  blocks.forEach((b) => {
    if (b.status === "إيقاف") offDuration += b.durationSec;
    if (b.status === "حركة") {
      movingDuration += b.durationSec;
      movingDistance += b.distance;
    }
    if (b.status === "توقف") {
      idleDuration += b.durationSec;
      movingDistance += b.distance;
    }
  });

  return {
    summary: {
      selectedDeviceName,
      from: formatAmmanDate(fromIso),
      to: formatAmmanDate(toIso),
      offDuration: formatDuration(offDuration),
      movingDuration: formatDuration(movingDuration),
      idleDuration: formatDuration(idleDuration),
      movingDistance: round2(movingDistance),
    },
    blocks,
  };
}

function SummaryItem({ label, value, icon }: { label: string; value: string | number; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-sm font-bold text-slate-900 md:text-base">{value}</div>
    </div>
  );
}

export default function TimelineReport() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceSearch, setDeviceSearch] = useState("");
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [fromDate, setFromDate] = useState(todayText());
  const [fromTime, setFromTime] = useState("00:00:00");
  const [toDate, setToDate] = useState(todayText());
  const [toTime, setToTime] = useState("23:59:59");

  const [report, setReport] = useState<TimelineReportData | null>(null);
  const [checkedRows, setCheckedRows] = useState<Record<number, boolean>>({});
  const [checkedText, setCheckedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [gfModal, setGfModal] = useState<TimelineBlock | null>(null);
  const [gfName, setGfName] = useState("");
  const [gfRadius, setGfRadius] = useState(100);
  const [gfColor, setGfColor] = useState("#0b57d0");
  const [deviceDropdownOpen, setDeviceDropdownOpen] = useState(false);

  const filteredDevices = devices.filter((d) => d.name.toLowerCase().includes(deviceSearch.toLowerCase()));

  const selectedDeviceName = useMemo(() => {
    return devices.find((d) => String(d.id) === selectedDeviceId)?.name || "";
  }, [devices, selectedDeviceId]);

  useEffect(() => {
    async function loadDevices() {
      setLoading(true);
      setMessage("");
      try {
        const result = await api.getDevices();
        setDevices(result || []);
        if (result?.length) {
          setSelectedDeviceId(String(result[0].id));
          setDeviceSearch(result[0].name);
        }
      } catch (e: any) {
        setMessage(e?.message || "فشل تحميل الأجهزة");
      } finally {
        setLoading(false);
      }
    }

    loadDevices();
  }, []);

  async function generateReport() {
    if (!selectedDeviceId) {
      setMessage("يرجى اختيار جهاز");
      return;
    }

    setLoading(true);
    setMessage("");
    setCheckedRows({});
    setCheckedText("");

    try {
      const fromIso = toUtcIsoFromLocal(fromDate, fromTime);
      const toIso = toUtcIsoFromLocal(toDate, toTime);

      const [positions, geofences] = await Promise.all([
        api.getTripPositions(Number(selectedDeviceId), fromIso, toIso),
        api.getGeofences(),
      ]);

      if (!positions || !positions.length) {
        setReport(null);
        setMessage("لا توجد بيانات خلال الفترة المحددة");
        return;
      }

      const result = buildReportResult(selectedDeviceName, fromIso, toIso, positions, geofences || []);
      setReport(result);
      setMessage("تم إنشاء التقرير بنجاح");
    } catch (e: any) {
      setMessage(e?.message || "حدث خطأ أثناء إنشاء التقرير");
    } finally {
      setLoading(false);
    }
  }

  function prepareCheckedText() {
    if (!report) {
      setMessage("قم بإنشاء التقرير أولاً");
      return;
    }

    const selected = report.blocks.filter((_, i) => checkedRows[i]);

    const lines = selected.map((row) =>
      [
        `${row.icon || ""} ${row.status || ""}`,
        `من: ${row.startTimeOnly || ""}`,
        `إلى: ${row.endTimeOnly || ""}`,
        `المدة: ${row.durationText || ""}`,
        row.address ? `الموقع: ${row.address}` : "",
      ]
        .filter(Boolean)
        .join(" | ")
    );

    const finalText = [
      `المركبة: ${report.summary.selectedDeviceName}`,
      `من: ${report.summary.from}`,
      `إلى: ${report.summary.to}`,
      "",
      lines.join("\n\n") || "لا توجد صفوف محددة",
    ].join("\n");

    setCheckedText(finalText);
    setMessage("تم تحضير النص");
  }

  function exportExcel() {
    if (!report?.blocks?.length) {
      setMessage("لا يوجد تقرير لتصديره");
      return;
    }

    const rows: any[][] = [];
    rows.push(["المركبة", report.summary.selectedDeviceName]);
    rows.push(["من", report.summary.from]);
    rows.push(["إلى", report.summary.to]);
    rows.push(["مدة الإيقاف", report.summary.offDuration]);
    rows.push(["مدة الحركة", report.summary.movingDuration]);
    rows.push(["مدة التوقف", report.summary.idleDuration]);
    rows.push(["المسافة المقطوعة (كم)", report.summary.movingDistance]);
    rows.push([]);
    rows.push(["#", "رمز", "الحالة", "بداية", "نهاية", "المدة", "المسافة (كم)", "متوسط السرعة", "أقصى سرعة", "الموقع"]);

    report.blocks.forEach((b, i) => {
      rows.push([i + 1, b.icon, b.status, b.startText, b.endText, b.durationText, b.distance, b.avgSpeed, b.maxSpeed, b.address]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Timeline");
    XLSX.writeFile(wb, `timeline_${selectedDeviceName || "report"}.xlsx`);
  }

  const totalDuration = report?.blocks.reduce((sum, b) => sum + Math.max(1, b.durationSec), 0) || 0;

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 pb-28 text-slate-900 md:pb-6">
      <div className="mx-auto max-w-[1500px] space-y-4 p-3 md:p-5">
        <div className="rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur md:sticky md:top-0 md:z-20 md:p-5">
          <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-xl font-black text-slate-950 md:text-2xl">تقرير خط الزمن</h1>
              <p className="text-sm text-slate-500">عرض احترافي للحركة، التوقف، الإيقاف، والتشويش</p>
            </div>
            {loading && <div className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700">جاري التنفيذ...</div>}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(260px,1.5fr)_repeat(4,minmax(120px,0.7fr))_auto] md:items-end">
            <div className="relative">
              <label className="mb-1 block text-xs font-bold text-slate-600">المركبة</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="ابحث عن المركبة..."
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 pe-10 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  value={deviceSearch}
                  onChange={(e) => {
                    setDeviceSearch(e.target.value);
                    setSelectedDeviceId("");
                    setDeviceDropdownOpen(true);
                  }}
                  onFocus={() => setDeviceDropdownOpen(true)}
                />
                <ChevronDown className="absolute left-3 top-3 text-slate-400" size={18} />
              </div>

              {deviceDropdownOpen && (
                <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                  <div className="max-h-64 overflow-auto p-1">
                    {filteredDevices.length ? (
                      filteredDevices.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          className="block w-full rounded-xl px-3 py-2 text-right text-sm hover:bg-slate-100"
                          onClick={() => {
                            setSelectedDeviceId(String(d.id));
                            setDeviceSearch(d.name);
                            setDeviceDropdownOpen(false);
                          }}
                        >
                          {d.name}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-3 text-sm text-slate-500">لا توجد نتائج</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">من تاريخ</label>
              <input type="date" className="h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">من وقت</label>
              <input type="time" step="1" className="h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" value={fromTime} onChange={(e) => setFromTime(e.target.value)} />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">إلى تاريخ</label>
              <input type="date" className="h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">إلى وقت</label>
              <input type="time" step="1" className="h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" value={toTime} onChange={(e) => setToTime(e.target.value)} />
            </div>

            <div className="hidden gap-2 md:flex">
              <button onClick={generateReport} disabled={loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60">
                <Search size={16} />
                إنشاء
              </button>
              <button onClick={prepareCheckedText} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-800 px-4 text-sm font-bold text-white hover:bg-slate-900">
                <MessageSquare size={16} />
              </button>
              <button onClick={exportExcel} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700">
                <FileSpreadsheet size={16} />
              </button>
            </div>
          </div>

          {message && <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700">{message}</div>}
        </div>

        {report && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            <SummaryItem label="المركبة" value={report.summary.selectedDeviceName || "-"} icon={<Car size={15} />} />
            <SummaryItem label="من" value={report.summary.from} icon={<CalendarDays size={15} />} />
            <SummaryItem label="إلى" value={report.summary.to} icon={<CalendarDays size={15} />} />
            <SummaryItem label="الإيقاف" value={report.summary.offDuration} icon={<Clock size={15} />} />
            <SummaryItem label="الحركة" value={report.summary.movingDuration} icon={<Clock size={15} />} />
            <SummaryItem label="التوقف" value={report.summary.idleDuration} icon={<Clock size={15} />} />
            <SummaryItem label="المسافة" value={`${report.summary.movingDistance} كم`} icon={<Route size={15} />} />
          </div>
        )}

        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          {!report?.blocks?.length ? (
            <div className="rounded-2xl bg-slate-50 p-8 text-center text-slate-500">لا توجد بيانات بعد.</div>
          ) : (
            <>
              <div className="overflow-x-auto pb-1">
                <div className="flex h-7 min-w-[640px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  {report.blocks.map((b, i) => {
                    const width = totalDuration > 0 ? (Math.max(1, b.durationSec) / totalDuration) * 100 : 0;
                    return (
                      <button
                        key={i}
                        title={`${b.status} | من: ${b.startText} | إلى: ${b.endText} | ${b.durationText}`}
                        style={{ flex: `0 0 ${width}%`, background: statusColor(b.status) }}
                        className="border-l border-white hover:opacity-80"
                        onClick={() => document.getElementById(`timeline-row-${i}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="mt-2 flex flex-col gap-1 text-xs text-slate-500 md:flex-row md:justify-between">
                <span>{report.blocks[0]?.startText}</span>
                <span>{report.blocks[report.blocks.length - 1]?.endText}</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
                <span className="rounded-full border px-3 py-1" style={{ background: statusColor("حركة") }}>🟢 حركة</span>
                <span className="rounded-full border px-3 py-1" style={{ background: statusColor("توقف") }}>🟡 توقف</span>
                <span className="rounded-full border px-3 py-1" style={{ background: statusColor("إيقاف") }}>⚫️ إيقاف</span>
                <span className="rounded-full border px-3 py-1" style={{ background: statusColor("تشويش") }}>🔴 تشويش</span>
              </div>
            </>
          )}
        </div>

        <div className="hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:block">
          <div className="max-h-[70vh] overflow-auto rounded-2xl border border-slate-200">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700">
                <tr>
                  <th className="border border-slate-200 p-2">#</th>
                  <th className="border border-slate-200 p-2">اختيار</th>
                  <th className="border border-slate-200 p-2">رمز</th>
                  <th className="border border-slate-200 p-2">الحالة</th>
                  <th className="border border-slate-200 p-2">بداية</th>
                  <th className="border border-slate-200 p-2">نهاية</th>
                  <th className="border border-slate-200 p-2">المدة</th>
                  <th className="border border-slate-200 p-2">المسافة</th>
                  <th className="border border-slate-200 p-2">متوسط السرعة</th>
                  <th className="border border-slate-200 p-2">أقصى سرعة</th>
                  <th className="border border-slate-200 p-2">الموقع</th>
                  <th className="border border-slate-200 p-2">جيوفنس</th>
                </tr>
              </thead>

              <tbody>
                {!report?.blocks?.length && (
                  <tr>
                    <td colSpan={12} className="border p-4 text-center text-slate-500">لا توجد بيانات.</td>
                  </tr>
                )}

                {report?.blocks.map((b, i) => (
                  <tr key={i} id={`timeline-row-${i}`} style={{ background: statusColor(b.status) }} className="hover:brightness-[0.98]">
                    <td className="border border-slate-200 p-2 font-bold">{i + 1}</td>
                    <td className="border border-slate-200 p-2 text-center">
                      <input type="checkbox" checked={!!checkedRows[i]} onChange={(e) => setCheckedRows((old) => ({ ...old, [i]: e.target.checked }))} />
                    </td>
                    <td className="border border-slate-200 p-2 text-center text-lg">{b.icon}</td>
                    <td className="border border-slate-200 p-2 font-bold">{b.status}</td>
                    <td className="border border-slate-200 p-2 whitespace-nowrap">{b.startText}</td>
                    <td className="border border-slate-200 p-2 whitespace-nowrap">{b.endText}</td>
                    <td className="border border-slate-200 p-2 whitespace-nowrap">{b.durationText}</td>
                    <td className="border border-slate-200 p-2">{b.distance}</td>
                    <td className="border border-slate-200 p-2">{b.avgSpeed}</td>
                    <td className="border border-slate-200 p-2">{b.maxSpeed}</td>
                    <td className="border border-slate-200 p-2 min-w-[260px]">
                      {b.lat != null && b.lon != null ? (
                        <a href={`https://www.google.com/maps?q=${b.lat},${b.lon}&t=k`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-blue-700 underline">
                          <MapPin size={15} />
                          {b.address || "عرض الموقع"}
                        </a>
                      ) : (
                        b.address || "-"
                      )}
                    </td>
                    <td className="border border-slate-200 p-2">
                      <button
                        className="inline-flex items-center gap-1 rounded-xl bg-white/70 px-3 py-1 text-xs font-bold text-slate-700 shadow-sm hover:bg-white"
                        onClick={() => {
                          setGfModal(b);
                          setGfName(b.address ? `GF - ${b.address}` : "GF - Timeline");
                          setGfRadius(100);
                          setGfColor("#0b57d0");
                        }}
                      >
                        <PlusCircle size={15} />
                        إضافة
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3 md:hidden">
          {!report?.blocks?.length ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center text-slate-500 shadow-sm">لا توجد بيانات.</div>
          ) : (
            report.blocks.map((b, i) => (
              <div key={i} id={`timeline-row-${i}`} className="rounded-3xl border border-slate-200 p-4 shadow-sm" style={{ background: statusColor(b.status) }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/80 px-3 py-1 text-sm font-black text-slate-800">
                      <span>{b.icon}</span>
                      <span>{b.status}</span>
                    </div>
                    <div className="mt-2 text-xs font-bold text-slate-500">#{i + 1}</div>
                  </div>
                  <label className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
                    اختيار
                    <input type="checkbox" checked={!!checkedRows[i]} onChange={(e) => setCheckedRows((old) => ({ ...old, [i]: e.target.checked }))} />
                  </label>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <div className="text-xs font-bold text-slate-500">من</div>
                    <div className="font-black">{b.startTimeOnly}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <div className="text-xs font-bold text-slate-500">إلى</div>
                    <div className="font-black">{b.endTimeOnly}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <div className="flex items-center gap-1 text-xs font-bold text-slate-500"><Clock size={13} /> المدة</div>
                    <div className="font-black">{b.durationText}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <div className="flex items-center gap-1 text-xs font-bold text-slate-500"><Route size={13} /> المسافة</div>
                    <div className="font-black">{b.distance} كم</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <div className="flex items-center gap-1 text-xs font-bold text-slate-500"><Gauge size={13} /> متوسط</div>
                    <div className="font-black">{b.avgSpeed}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <div className="flex items-center gap-1 text-xs font-bold text-slate-500"><Gauge size={13} /> أقصى</div>
                    <div className="font-black">{b.maxSpeed}</div>
                  </div>
                </div>

                <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm leading-6">
                  {b.lat != null && b.lon != null ? (
                    <a href={`https://www.google.com/maps?q=${b.lat},${b.lon}&t=k`} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 font-bold text-blue-700 underline">
                      <MapPin size={15} className="mt-1 shrink-0" />
                      {b.address || "عرض الموقع"}
                    </a>
                  ) : (
                    b.address || "-"
                  )}
                </div>

                <button
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm"
                  onClick={() => {
                    setGfModal(b);
                    setGfName(b.address ? `GF - ${b.address}` : "GF - Timeline");
                    setGfRadius(100);
                    setGfColor("#0b57d0");
                  }}
                >
                  <PlusCircle size={16} />
                  إضافة جيوفنس
                </button>
              </div>
            ))
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-base font-black">النص الناتج من الصفوف المحددة</h2>
          <textarea className="min-h-[150px] w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" readOnly value={checkedText} />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur md:hidden">
        <div className="grid grid-cols-3 gap-2">
          <button onClick={generateReport} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-3 py-3 text-sm font-black text-white disabled:opacity-60">
            <Search size={16} />
            إنشاء
          </button>
          <button onClick={prepareCheckedText} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-800 px-3 py-3 text-sm font-black text-white">
            <MessageSquare size={16} />
            النص
          </button>
          <button onClick={exportExcel} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-3 py-3 text-sm font-black text-white">
            <FileSpreadsheet size={16} />
            Excel
          </button>
        </div>
      </div>

      {gfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black">إضافة جيوفنس</h3>
              <button className="rounded-full bg-slate-100 p-2" onClick={() => setGfModal(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-600">اسم الجيوفنس</label>
                <input className="h-11 w-full rounded-2xl border border-slate-200 px-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" value={gfName} onChange={(e) => setGfName(e.target.value)} placeholder="اسم الجيوفنس" />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-600">نصف القطر بالمتر</label>
                <input type="number" className="h-11 w-full rounded-2xl border border-slate-200 px-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" value={gfRadius} onChange={(e) => setGfRadius(Number(e.target.value))} placeholder="نصف القطر بالمتر" />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-600">اللون</label>
                <select className="h-11 w-full rounded-2xl border border-slate-200 px-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" value={gfColor} onChange={(e) => setGfColor(e.target.value)}>
                  <option value="#0b57d0">أزرق</option>
                  <option value="#198754">أخضر</option>
                  <option value="#ff0000">أحمر</option>
                </select>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                className="rounded-2xl bg-blue-600 px-4 py-3 font-black text-white"
                onClick={async () => {
                  if (gfModal.lat == null || gfModal.lon == null) {
                    setMessage("لا توجد إحداثيات لهذا البلوك");
                    return;
                  }

                  try {
                    await api.createGeofence({
                      name: gfName,
                      area: `CIRCLE (${gfModal.lat} ${gfModal.lon}, ${gfRadius})`,
                      attributes: { color: gfColor },
                    });
                    setGfModal(null);
                    setMessage("تم حفظ الجيوفنس بنجاح");
                  } catch (e: any) {
                    setMessage(e?.message || "فشل حفظ الجيوفنس");
                  }
                }}
              >
                حفظ
              </button>

              <button className="rounded-2xl bg-slate-100 px-4 py-3 font-black text-slate-700" onClick={() => setGfModal(null)}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
