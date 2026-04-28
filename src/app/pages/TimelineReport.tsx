import { useEffect, useMemo, useState } from "react";
import { Search, FileSpreadsheet, MessageSquare, MapPin, PlusCircle } from "lucide-react";
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
  if (status === "حركة") return "#b8f5b8";
  if (status === "توقف") return "#fffdf2";
  if (status === "إيقاف") return "#f5f5f2";
  if (status === "تشويش") return "#f4cccc";
  return "#ddd";
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
    const isInvalid = p.valid === false || deviceDistance > 15 || distance > 10;

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

    const geofenceId =
      Array.isArray(p.geofenceIds) && p.geofenceIds.length > 0
        ? String(p.geofenceIds[0])
        : "";

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
      (((last.status === "إيقاف" || last.status === "تشويش") &&
        (item.status === "إيقاف" || item.status === "تشويش")) ||
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

  const sorted = [...positions].sort(
    (a, b) => new Date(a.fixTime).getTime() - new Date(b.fixTime).getTime()
  );

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

export default function TimelineReport() {
  const [devices, setDevices] = useState<Device[]>([]);
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
        if (result?.length) setSelectedDeviceId(String(result[0].id));
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

      const result = buildReportResult(
        selectedDeviceName,
        fromIso,
        toIso,
        positions,
        geofences || []
      );

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
      `الجهاز: ${report.summary.selectedDeviceName}`,
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
    rows.push(["الجهاز", report.summary.selectedDeviceName]);
    rows.push(["من", report.summary.from]);
    rows.push(["إلى", report.summary.to]);
    rows.push(["مدة الإيقاف", report.summary.offDuration]);
    rows.push(["مدة الحركة", report.summary.movingDuration]);
    rows.push(["مدة التوقف", report.summary.idleDuration]);
    rows.push(["المسافة المقطوعة (كم)", report.summary.movingDistance]);
    rows.push([]);
    rows.push([
      "#",
      "رمز",
      "الحالة",
      "بداية",
      "نهاية",
      "المدة",
      "المسافة (كم)",
      "متوسط السرعة",
      "أقصى سرعة",
      "الموقع",
    ]);

    report.blocks.forEach((b, i) => {
      rows.push([
        i + 1,
        b.icon,
        b.status,
        b.startText,
        b.endText,
        b.durationText,
        b.distance,
        b.avgSpeed,
        b.maxSpeed,
        b.address,
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Timeline");
    XLSX.writeFile(wb, `timeline_${selectedDeviceName || "report"}.xlsx`);
  }

  async function createGeofence(block: TimelineBlock) {
    if (block.lat == null || block.lon == null) {
      setMessage("لا توجد إحداثيات لهذا البلوك");
      return;
    }

    const name = window.prompt("اسم الجيوفنس", block.address ? `GF - ${block.address}` : "GF - Timeline");
    if (!name) return;

    const radiusText = window.prompt("نصف القطر بالمتر", "100");
    const radius = Number(radiusText || 0);

    if (!radius || radius <= 0) {
      setMessage("نصف قطر غير صحيح");
      return;
    }

    try {
      await api.createGeofence({
        name,
        area: `CIRCLE (${block.lat} ${block.lon}, ${radius})`,
        attributes: { color: "#0b57d0" },
      });

      setMessage("تم حفظ الجيوفنس بنجاح");
    } catch (e: any) {
      setMessage(e?.message || "فشل حفظ الجيوفنس");
    }
  }

  const totalDuration = report?.blocks.reduce((sum, b) => sum + Math.max(1, b.durationSec), 0) || 0;

  return (
    <div dir="rtl" className="min-h-screen bg-[#f6f7fb] p-4 text-[#172033]">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100 sticky top-0 z-20">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
            <div className="md:col-span-2">
              <label className="text-sm font-semibold">الجهاز</label>
              <select
                className="w-full rounded-xl border px-3 py-2 bg-white"
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
              >
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold">من تاريخ</label>
              <input
                type="date"
                className="w-full rounded-xl border px-3 py-2"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-semibold">من وقت</label>
              <input
                type="time"
                step="1"
                className="w-full rounded-xl border px-3 py-2"
                value={fromTime}
                onChange={(e) => setFromTime(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-semibold">إلى تاريخ</label>
              <input
                type="date"
                className="w-full rounded-xl border px-3 py-2"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-semibold">إلى وقت</label>
              <input
                type="time"
                step="1"
                className="w-full rounded-xl border px-3 py-2"
                value={toTime}
                onChange={(e) => setToTime(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            <button onClick={generateReport} className="rounded-xl bg-blue-600 text-white px-4 py-2 flex gap-2 items-center">
              <Search size={18} />
              إنشاء التقرير
            </button>

            <button onClick={prepareCheckedText} className="rounded-xl bg-slate-700 text-white px-4 py-2 flex gap-2 items-center">
              <MessageSquare size={18} />
              تحضير النص
            </button>

            <button onClick={exportExcel} className="rounded-xl bg-emerald-600 text-white px-4 py-2 flex gap-2 items-center">
              <FileSpreadsheet size={18} />
              Excel
            </button>
          </div>

          {report && (
            <div className="mt-4 rounded-xl bg-gray-50 border p-3 text-sm font-semibold leading-8">
              الجهاز: {report.summary.selectedDeviceName || "-"} | من: {report.summary.from} | إلى:{" "}
              {report.summary.to} | الإيقاف: {report.summary.offDuration} | الحركة:{" "}
              {report.summary.movingDuration} | التوقف: {report.summary.idleDuration} | المسافة:{" "}
              {report.summary.movingDistance} كم
            </div>
          )}

          {loading && <div className="mt-3 text-blue-600 font-semibold">جاري التنفيذ...</div>}
          {message && <div className="mt-3 text-sm font-semibold">{message}</div>}
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
          <h2 className="font-bold mb-3">المخطط الزمني</h2>

          {!report?.blocks?.length ? (
            <div className="text-gray-500">لا توجد بيانات بعد.</div>
          ) : (
            <>
              <div className="flex h-9 overflow-hidden rounded-xl border bg-gray-50">
                {report.blocks.map((b, i) => {
                  const width = totalDuration > 0 ? (Math.max(1, b.durationSec) / totalDuration) * 100 : 0;
                  return (
                    <button
                      key={i}
                      title={`${b.status} | من: ${b.startText} | إلى: ${b.endText} | ${b.durationText}`}
                      style={{
                        flex: `0 0 ${width}%`,
                        background: statusColor(b.status),
                      }}
                      className="border-l border-white hover:opacity-80"
                      onClick={() => document.getElementById(`timeline-row-${i}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                    />
                  );
                })}
              </div>

              <div className="flex justify-between mt-2 text-xs text-gray-500">
                <span>{report.blocks[0]?.startText}</span>
                <span>{report.blocks[report.blocks.length - 1]?.endText}</span>
              </div>

              <div className="flex flex-wrap gap-4 mt-3 text-sm">
                <span>🟢 حركة</span>
                <span>🟡 توقف</span>
                <span>⚫️ إيقاف</span>
                <span>🔴 تشويش</span>
              </div>
            </>
          )}
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100 overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2">#</th>
                <th className="border p-2">اختيار</th>
                <th className="border p-2">رمز</th>
                <th className="border p-2">الحالة</th>
                <th className="border p-2">بداية</th>
                <th className="border p-2">نهاية</th>
                <th className="border p-2">المدة</th>
                <th className="border p-2">المسافة</th>
                <th className="border p-2">متوسط السرعة</th>
                <th className="border p-2">أقصى سرعة</th>
                <th className="border p-2">الموقع</th>
                <th className="border p-2">جيوفنس</th>
              </tr>
            </thead>

            <tbody>
              {!report?.blocks?.length && (
                <tr>
                  <td colSpan={12} className="border p-4 text-center text-gray-500">
                    لا توجد بيانات.
                  </td>
                </tr>
              )}

              {report?.blocks.map((b, i) => (
                <tr key={i} id={`timeline-row-${i}`} style={{ background: statusColor(b.status) }}>
                  <td className="border p-2">{i + 1}</td>
                  <td className="border p-2 text-center">
                    <input
                      type="checkbox"
                      checked={!!checkedRows[i]}
                      onChange={(e) => setCheckedRows((old) => ({ ...old, [i]: e.target.checked }))}
                    />
                  </td>
                  <td className="border p-2">{b.icon}</td>
                  <td className="border p-2 font-semibold">{b.status}</td>
                  <td className="border p-2">{b.startText}</td>
                  <td className="border p-2">{b.endText}</td>
                  <td className="border p-2">{b.durationText}</td>
                  <td className="border p-2">{b.distance}</td>
                  <td className="border p-2">{b.avgSpeed}</td>
                  <td className="border p-2">{b.maxSpeed}</td>
                  <td className="border p-2">
                    {b.lat != null && b.lon != null ? (
                      <a
                        href={`https://www.google.com/maps?q=${b.lat},${b.lon}&t=k`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-700 underline inline-flex gap-1 items-center"
                      >
                        <MapPin size={15} />
                        {b.address || "عرض الموقع"}
                      </a>
                    ) : (
                      b.address || "-"
                    )}
                  </td>
                  <td className="border p-2">
                    <button
                      onClick={() => createGeofence(b)}
                      className="rounded-lg bg-blue-600 text-white px-2 py-1 inline-flex gap-1 items-center"
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

        <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
          <h2 className="font-bold mb-2">النص الناتج من الصفوف المحددة</h2>
          <textarea
            className="w-full min-h-[150px] rounded-xl border p-3"
            readOnly
            value={checkedText}
          />
        </div>
      </div>
    </div>
  );
}
