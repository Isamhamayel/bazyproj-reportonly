import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { api } from "../services/api";

type Device = {
  id: number;
  name?: string;
};

type TimelineRow = {
  date: string;
  vehicleName: string;
  durationMinutes: number;
  startTime: string;
  endTime: string;
  startAddress: string;
  map: string;
};

type SortConfig = {
  key: keyof TimelineRow;
  direction: "asc" | "desc";
};

const PARALLEL_BATCH_SIZE = 5;

function toDateTimeLocalValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

function getTodayDateRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 0, 0);

  return {
    from: toDateTimeLocalValue(start),
    to: toDateTimeLocalValue(end),
  };
}

function formatAmmanDateTime(value: string) {
  if (!value) return "";

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Amman",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(new Date(value))
    .replace(",", "");
}

function formatDateOnly(value: string) {
  return formatAmmanDateTime(value).slice(0, 10);
}

function sortRows(rows: TimelineRow[], config: SortConfig | null) {
  if (!config) return rows;

  return [...rows].sort((a, b) => {
    const aValue = a[config.key];
    const bValue = b[config.key];
    const multiplier = config.direction === "asc" ? 1 : -1;

    if (typeof aValue === "number" && typeof bValue === "number") {
      return (aValue - bValue) * multiplier;
    }

    return String(aValue ?? "").localeCompare(String(bValue ?? "")) * multiplier;
  });
}

const getSession = () => {
  const stored = localStorage.getItem("traccar_session");
  if (!stored) return null;

  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
};

const fetchIdleTrips = async (
  deviceId: number,
  fromISO: string,
  toISO: string
): Promise<any[]> => {
  const session = getSession();

  if (!session || !session.token || !session.serverUrl) {
    console.debug("No valid session found");
    return [];
  }

  try {
    const url =
      `${session.serverUrl}/api/reports/trips/customkey` +
      `?deviceId=${deviceId}` +
      `&from=${encodeURIComponent(fromISO)}` +
      `&to=${encodeURIComponent(toISO)}` +
      `&key=idilingFlag`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${session.token}`,
        "Content-Type": "application/json",
      },
      mode: "cors",
    });

    if (!response.ok) {
      console.warn(`API Error for device ${deviceId}: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`Failed to fetch idle trips for device ${deviceId}:`, error);
    return [];
  }
};

function buildTimelineRows(vehicle: Device, trips: any[], minIdleMinutes: number): TimelineRow[] {
  return trips.flatMap((trip) => {
    const firstPosition = trip?.positions?.[0];
    const idleFlag =
      firstPosition?.attributes?.idilingFlag ??
      trip?.idilingFlag ??
      false;

    const idleDuration = Number(trip?.idilingDuration || 0);
    if (!idleFlag || idleDuration < minIdleMinutes) return [];

    const lat = firstPosition?.latitude;
    const lon = firstPosition?.longitude;

    return [
      {
        date: trip.startTime ? formatDateOnly(trip.startTime) : "",
        vehicleName: vehicle.name || "Unnamed",
        durationMinutes: Math.round((trip.duration || 0) / 60000),
        startTime: trip.startTime ? formatAmmanDateTime(trip.startTime) : "",
        endTime: trip.endTime ? formatAmmanDateTime(trip.endTime) : "",
        startAddress: trip.startAddress || "",
        map:
          lat && lon
            ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
            : "",
      },
    ];
  });
}

export default function TimelineIdleReport({ lang = "ar" }: { lang?: "ar" | "en" }) {
  const isArabic = lang === "ar";

  const defaultDateRange = useMemo(() => getTodayDateRange(), []);
  const [from, setFrom] = useState(defaultDateRange.from);
  const [to, setTo] = useState(defaultDateRange.to);
  const [minIdleMinutes, setMinIdleMinutes] = useState(10);
  const [vehicles, setVehicles] = useState<Device[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState("all");
  const [rows, setRows] = useState<TimelineRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [message, setMessage] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({
    key: "startTime",
    direction: "asc",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadVehicles() {
      setLoadingVehicles(true);
      try {
        const devices = await api.getDevices();
        if (!cancelled) setVehicles(Array.isArray(devices) ? devices : []);
      } catch (error) {
        console.error("Failed to load vehicles:", error);
        if (!cancelled) {
          setMessage(isArabic ? "حدث خطأ في تحميل المركبات" : "Error loading vehicles");
        }
      } finally {
        if (!cancelled) setLoadingVehicles(false);
      }
    }

    loadVehicles();

    return () => {
      cancelled = true;
    };
  }, [isArabic]);

  const sortedRows = useMemo(() => sortRows(rows, sortConfig), [rows, sortConfig]);

  async function generateReport() {
    if (!from || !to) {
      setMessage(isArabic ? "الرجاء تحديد التاريخ" : "Please select dates");
      return;
    }

    setLoading(true);
    setMessage("");
    setRows([]);

    try {
      const fromISO = new Date(from).toISOString();
      const toISO = new Date(to).toISOString();
      const allVehicles = vehicles.length ? vehicles : await api.getDevices();

      const targetVehicles =
        selectedVehicleId === "all"
          ? allVehicles
          : allVehicles.filter((vehicle) => String(vehicle.id) === selectedVehicleId);

      if (!targetVehicles.length) {
        setMessage(isArabic ? "لم يتم العثور على مركبات" : "No vehicles found");
        return;
      }

      const reportRows: TimelineRow[] = [];

      for (let i = 0; i < targetVehicles.length; i += PARALLEL_BATCH_SIZE) {
        const batch = targetVehicles.slice(i, i + PARALLEL_BATCH_SIZE);

        setMessage(
          isArabic
            ? `جاري تحميل ${Math.min(i + batch.length, targetVehicles.length)} من ${targetVehicles.length} مركبة...`
            : `Loading ${Math.min(i + batch.length, targetVehicles.length)} of ${targetVehicles.length} vehicles...`
        );

        const batchResults = await Promise.all(
          batch.map(async (vehicle) => ({
            vehicle,
            trips: await fetchIdleTrips(vehicle.id, fromISO, toISO),
          }))
        );

        for (const { vehicle, trips } of batchResults) {
          reportRows.push(...buildTimelineRows(vehicle, trips, minIdleMinutes));
        }
      }

      setRows(reportRows);
      setMessage(
        isArabic
          ? `تم العثور على ${reportRows.length} سجل`
          : `Found ${reportRows.length} records`
      );
    } catch (error) {
      console.error("Timeline idle report error:", error);
      setMessage(
        isArabic ? "حدث خطأ في التقرير" : "An error occurred generating the report"
      );
    } finally {
      setLoading(false);
    }
  }

  function exportExcel() {
    if (!sortedRows.length) {
      setMessage(isArabic ? "لا توجد بيانات للتصدير" : "No data to export");
      return;
    }

    try {
      const exportRows = sortedRows.map((row) => ({
        Date: row.date,
        "Vehicle Name": row.vehicleName,
        "Start Time": row.startTime,
        "End Time": row.endTime,
        "Duration (m)": row.durationMinutes,
        "Start Address": row.startAddress,
        Map: row.map,
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportRows, {
        header: [
          "Date",
          "Vehicle Name",
          "Start Time",
          "End Time",
          "Duration (m)",
          "Start Address",
          "Map",
        ],
      });

      worksheet["!cols"] = [
        { wch: 12 },
        { wch: 25 },
        { wch: 18 },
        { wch: 18 },
        { wch: 14 },
        { wch: 45 },
        { wch: 55 },
      ];
      worksheet["!autofilter"] = { ref: worksheet["!ref"] || "A1:G1" };

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Timeline Report");
      XLSX.writeFile(
        workbook,
        `timeline-idle-report_${formatDateOnly(new Date().toISOString())}.xlsx`,
        { bookType: "xlsx" }
      );

      setMessage(isArabic ? "تم التصدير بنجاح" : "Export successful");
    } catch (error) {
      console.error("Export error:", error);
      setMessage(isArabic ? "حدث خطأ في التصدير" : "Error during export");
    }
  }

  function handleSort(key: keyof TimelineRow) {
    setSortConfig((current) => ({
      key,
      direction: current?.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  }

  function SortableHeader({ label, sortKey }: { label: string; sortKey: keyof TimelineRow }) {
    const isActive = sortConfig?.key === sortKey;
    const indicator = isActive ? (sortConfig.direction === "asc" ? " ↑" : " ↓") : "";

    return (
      <th
        onClick={() => handleSort(sortKey)}
        className="p-2 cursor-pointer hover:bg-gray-100 select-none font-semibold whitespace-nowrap"
        title={isArabic ? "اضغط للفرز" : "Click to sort"}
      >
        {label}{indicator}
      </th>
    );
  }

  return (
    <div dir={isArabic ? "rtl" : "ltr"} className="p-4 space-y-4">
      <h1 className="text-xl font-bold">
        {isArabic ? "تقرير الخط الزمني للخمول" : "Idle Timeline Report"}
      </h1>

      <div className="flex flex-wrap gap-3 items-end bg-white p-4 rounded-xl border">
        <label className="space-y-1">
          <div>{isArabic ? "من" : "From"}</div>
          <input
            type="datetime-local"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border rounded-lg px-3 py-2"
          />
        </label>

        <label className="space-y-1">
          <div>{isArabic ? "إلى" : "To"}</div>
          <input
            type="datetime-local"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border rounded-lg px-3 py-2"
          />
        </label>

        <label className="space-y-1">
          <div>{isArabic ? "المركبة" : "Vehicle"}</div>
          <select
            value={selectedVehicleId}
            onChange={(e) => setSelectedVehicleId(e.target.value)}
            disabled={loadingVehicles || loading}
            className="border rounded-lg px-3 py-2 min-w-56 bg-white"
          >
            <option value="all">{isArabic ? "كل المركبات" : "All vehicles"}</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={String(vehicle.id)}>
                {vehicle.name || `Vehicle ${vehicle.id}`}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <div>{isArabic ? "أقل مدة خمول بالدقائق" : "Min idle minutes"}</div>
          <input
            type="number"
            min={0}
            value={minIdleMinutes}
            onChange={(e) => setMinIdleMinutes(Number(e.target.value))}
            className="border rounded-lg px-3 py-2 w-36"
          />
        </label>

        <button
          type="button"
          onClick={generateReport}
          disabled={loading || loadingVehicles}
          className="bg-blue-600 text-white rounded-lg px-4 py-2 disabled:opacity-60"
        >
          {loading
            ? isArabic
              ? "جاري التحميل..."
              : "Loading..."
            : isArabic
            ? "تشغيل التقرير"
            : "Run Report"}
        </button>

        <button
          type="button"
          onClick={exportExcel}
          disabled={!sortedRows.length}
          className="bg-green-600 text-white rounded-lg px-4 py-2 disabled:opacity-60 hover:bg-green-700"
        >
          Excel
        </button>
      </div>

      {message && (
        <div
          className={`p-3 rounded-lg text-sm ${
            message.includes("خطأ") || message.toLowerCase().includes("error")
              ? "bg-red-50 text-red-700"
              : "bg-blue-50 text-blue-700"
          }`}
        >
          {message}
        </div>
      )}

      <div className="bg-white rounded-xl border overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <SortableHeader label={isArabic ? "التاريخ" : "Date"} sortKey="date" />
              <SortableHeader label={isArabic ? "المركبة" : "Vehicle"} sortKey="vehicleName" />
              <SortableHeader label={isArabic ? "وقت البداية" : "Start Time"} sortKey="startTime" />
              <SortableHeader label={isArabic ? "وقت النهاية" : "End Time"} sortKey="endTime" />
              <SortableHeader label={isArabic ? "المدة (د)" : "Duration (m)"} sortKey="durationMinutes" />
              <SortableHeader label={isArabic ? "عنوان البداية" : "Start Address"} sortKey="startAddress" />
              <SortableHeader label={isArabic ? "الخريطة" : "Map"} sortKey="map" />
            </tr>
          </thead>

          <tbody>
            {sortedRows.map((row, index) => (
              <tr key={`${row.vehicleName}-${row.startTime}-${index}`} className="border-t hover:bg-gray-50">
                <td className="p-2 whitespace-nowrap">{row.date}</td>
                <td className="p-2 whitespace-nowrap">{row.vehicleName}</td>
                <td className="p-2 whitespace-nowrap">{row.startTime}</td>
                <td className="p-2 whitespace-nowrap">{row.endTime}</td>
                <td className="p-2 text-center">{row.durationMinutes}</td>
                <td className="p-2 min-w-72">{row.startAddress}</td>
                <td className="p-2 text-center">
                  {row.map ? (
                    <a
                      href={row.map}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:text-blue-800"
                    >
                      📍
                    </a>
                  ) : (
                    ""
                  )}
                </td>
              </tr>
            ))}

            {!sortedRows.length && !loading && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-gray-500">
                  {isArabic ? "لا توجد بيانات" : "No data"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
