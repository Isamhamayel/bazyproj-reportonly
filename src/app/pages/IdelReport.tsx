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
  const [deviceSearch, setDeviceSearch] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState("all");
  const [deviceDropdownOpen, setDeviceDropdownOpen] = useState(false);
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

  const filteredVehicles = useMemo(
    () =>
      vehicles.filter((vehicle) =>
        (vehicle.name || `Vehicle ${vehicle.id}`)
          .toLowerCase()
          .includes(deviceSearch.toLowerCase())
      ),
    [vehicles, deviceSearch]
  );

  const selectedVehicleName = useMemo(() => {
    if (selectedVehicleId === "all") return isArabic ? "كل المركبات" : "All vehicles";
    return (
      vehicles.find((vehicle) => String(vehicle.id) === selectedVehicleId)?.name ||
      ""
    );
  }, [vehicles, selectedVehicleId, isArabic]);

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

  function SortableHeader({
    label,
    sortKey,
    sticky = false,
    className = "",
  }: {
    label: string;
    sortKey: keyof TimelineRow;
    sticky?: boolean;
    className?: string;
  }) {
    const isActive = sortConfig?.key === sortKey;
    const indicator = isActive ? (sortConfig.direction === "asc" ? " ↑" : " ↓") : "";

    return (
      <th
        onClick={() => handleSort(sortKey)}
        className={`sticky top-0 z-20 bg-gray-50 p-2 text-xs font-semibold uppercase tracking-wide text-gray-600 cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap ${
          sticky
            ? isArabic
              ? "right-0 z-30 shadow-[-2px_0_4px_rgba(0,0,0,0.08)]"
              : "left-0 z-30 shadow-[2px_0_4px_rgba(0,0,0,0.08)]"
            : ""
        } ${className}`}
        title={isArabic ? "اضغط للفرز" : "Click to sort"}
      >
        {label}{indicator}
      </th>
    );
  }

  function MobileMeta({
    label,
    value,
  }: {
    label: string;
    value: string | number;
  }) {
    return (
      <div className="rounded-xl bg-gray-50 px-3 py-2">
        <div className="text-[11px] font-semibold text-gray-500">{label}</div>
        <div className="mt-0.5 text-sm font-semibold text-gray-800 break-words">{value || "-"}</div>
      </div>
    );
  }

  return (
    <div dir={isArabic ? "rtl" : "ltr"} className="min-h-screen bg-[#f6f7fb] p-3 md:p-4 text-[#172033]">
      <div className="mx-auto max-w-[1500px] space-y-3 md:space-y-4 pb-20 md:pb-4">
        <div className="rounded-2xl bg-white p-3 md:p-4 shadow-sm border border-gray-100 sticky top-0 z-40">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
            <label className="space-y-1">
              <div className="text-xs font-semibold text-gray-600">{isArabic ? "من" : "From"}</div>
              <input
                type="datetime-local"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <label className="space-y-1">
              <div className="text-xs font-semibold text-gray-600">{isArabic ? "إلى" : "To"}</div>
              <input
                type="datetime-local"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <label className="space-y-1 relative sm:col-span-2 lg:col-span-1 lg:w-72">
              <div className="text-xs font-semibold text-gray-600">{isArabic ? "المركبة" : "Vehicle"}</div>
              <input
                type="text"
                value={deviceDropdownOpen ? deviceSearch : selectedVehicleName}
                onChange={(e) => {
                  setDeviceSearch(e.target.value);
                  setSelectedVehicleId("all");
                  setDeviceDropdownOpen(true);
                }}
                onFocus={() => {
                  setDeviceSearch("");
                  setDeviceDropdownOpen(true);
                }}
                disabled={loadingVehicles || loading}
                placeholder={
                  loadingVehicles
                    ? isArabic
                      ? "جاري تحميل المركبات..."
                      : "Loading vehicles..."
                    : isArabic
                    ? "ابحث عن مركبة..."
                    : "Search vehicle..."
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50"
              />

              {deviceDropdownOpen && !loadingVehicles && !loading && (
                <div className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-start text-sm hover:bg-gray-100"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setSelectedVehicleId("all");
                      setDeviceSearch("");
                      setDeviceDropdownOpen(false);
                    }}
                  >
                    {isArabic ? "كل المركبات" : "All vehicles"}
                  </button>

                  {filteredVehicles.map((vehicle) => (
                    <button
                      key={vehicle.id}
                      type="button"
                      className="block w-full px-3 py-2 text-start text-sm hover:bg-gray-100"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setSelectedVehicleId(String(vehicle.id));
                        setDeviceSearch(vehicle.name || `Vehicle ${vehicle.id}`);
                        setDeviceDropdownOpen(false);
                      }}
                    >
                      {vehicle.name || `Vehicle ${vehicle.id}`}
                    </button>
                  ))}

                  {!filteredVehicles.length && (
                    <div className="px-3 py-2 text-sm text-gray-500">
                      {isArabic ? "لا توجد مركبات مطابقة" : "No matching vehicles"}
                    </div>
                  )}
                </div>
              )}
            </label>

            <label className="space-y-1 lg:w-40">
              <div className="text-xs font-semibold text-gray-600">{isArabic ? "أقل مدة خمول بالدقائق" : "Min idle minutes"}</div>
              <input
                type="number"
                min={0}
                value={minIdleMinutes}
                onChange={(e) => setMinIdleMinutes(Number(e.target.value))}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <div className="hidden md:flex gap-2 lg:ms-auto">
              <button
                type="button"
                onClick={generateReport}
                disabled={loading || loadingVehicles}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60 hover:bg-blue-700"
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
                className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60 hover:bg-green-700"
              >
                Excel
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-600">
            <span className="rounded-full bg-gray-100 px-3 py-1 font-semibold">
              {isArabic ? "المركبة" : "Vehicle"}: {selectedVehicleName}
            </span>
            <span className="rounded-full bg-gray-100 px-3 py-1 font-semibold">
              {isArabic ? "السجلات" : "Records"}: {sortedRows.length}
            </span>
            <span className="rounded-full bg-gray-100 px-3 py-1 font-semibold">
              {isArabic ? "أقل خمول" : "Min idle"}: {minIdleMinutes} {isArabic ? "د" : "m"}
            </span>
          </div>
        </div>

        {message && (
          <div
            className={`rounded-xl border p-3 text-sm font-semibold ${
              message.includes("خطأ") || message.toLowerCase().includes("error")
                ? "border-red-100 bg-red-50 text-red-700"
                : "border-blue-100 bg-blue-50 text-blue-700"
            }`}
          >
            {message}
          </div>
        )}

        {/* Mobile professional card view */}
        <div className="md:hidden space-y-3">
          {sortedRows.map((row, index) => (
            <div key={`${row.vehicleName}-${row.startTime}-mobile-${index}`} className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold text-gray-500">{isArabic ? "المركبة" : "Vehicle"}</div>
                  <div className="truncate text-base font-bold text-gray-900" title={row.vehicleName}>
                    {row.vehicleName}
                  </div>
                </div>
                <div className="shrink-0 rounded-full bg-amber-50 px-3 py-1 text-sm font-bold text-amber-700">
                  {row.durationMinutes} {isArabic ? "د" : "m"}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <MobileMeta label={isArabic ? "البداية" : "Start"} value={row.startTime} />
                <MobileMeta label={isArabic ? "النهاية" : "End"} value={row.endTime} />
              </div>

              <div className="mt-2 rounded-xl bg-gray-50 px-3 py-2">
                <div className="text-[11px] font-semibold text-gray-500">{isArabic ? "عنوان البداية" : "Start Address"}</div>
                <div className="mt-0.5 line-clamp-2 text-sm font-medium text-gray-800">
                  {row.startAddress || "-"}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="text-xs font-semibold text-gray-500">#{index + 1} · {row.date}</div>
                {row.map ? (
                  <a
                    href={row.map}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm"
                  >
                    {isArabic ? "عرض الخريطة 📍" : "Map 📍"}
                  </a>
                ) : (
                  <span className="text-xs text-gray-400">{isArabic ? "لا توجد خريطة" : "No map"}</span>
                )}
              </div>
            </div>
          ))}

          {!sortedRows.length && !loading && (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-gray-500">
              {isArabic ? "لا توجد بيانات" : "No data"}
            </div>
          )}
        </div>

        {/* Desktop / tablet table view */}
        <div className="hidden md:block rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-auto max-h-[70vh]">
            <table className="w-full table-fixed text-sm border-separate border-spacing-0">
              <thead>
                <tr>
                  <SortableHeader
                    label={isArabic ? "المركبة" : "Vehicle"}
                    sortKey="vehicleName"
                    sticky
                    className="w-[150px] lg:w-[190px]"
                  />
                  <SortableHeader label={isArabic ? "وقت البداية" : "Start Time"} sortKey="startTime" className="w-[150px]" />
                  <SortableHeader label={isArabic ? "وقت النهاية" : "End Time"} sortKey="endTime" className="w-[150px]" />
                  <SortableHeader label={isArabic ? "المدة (د)" : "Duration (m)"} sortKey="durationMinutes" className="w-[95px]" />
                  <SortableHeader label={isArabic ? "عنوان البداية" : "Start Address"} sortKey="startAddress" className="w-[360px]" />
                  <SortableHeader label={isArabic ? "الخريطة" : "Map"} sortKey="map" className="w-[80px]" />
                </tr>
              </thead>

              <tbody>
                {sortedRows.map((row, index) => (
                  <tr key={`${row.vehicleName}-${row.startTime}-${index}`} className="border-t odd:bg-white even:bg-gray-50 hover:bg-blue-50">
                    <td
                      className={`sticky z-10 p-2 text-xs lg:text-sm font-semibold ${
                        isArabic
                          ? "right-0 shadow-[-2px_0_4px_rgba(0,0,0,0.06)]"
                          : "left-0 shadow-[2px_0_4px_rgba(0,0,0,0.06)]"
                      } ${index % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                      title={row.vehicleName}
                    >
                      <div className="truncate">{row.vehicleName}</div>
                    </td>
                    <td className="p-2 whitespace-nowrap text-center">{row.startTime}</td>
                    <td className="p-2 whitespace-nowrap text-center">{row.endTime}</td>
                    <td className="p-2 text-center font-semibold">{row.durationMinutes}</td>
                    <td className="p-2 align-top">
                      <div className="line-clamp-2" title={row.startAddress}>{row.startAddress}</div>
                    </td>
                    <td className="p-2 text-center">
                      {row.map ? (
                        <a
                          href={row.map}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100"
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
                    <td colSpan={6} className="p-6 text-center text-gray-500">
                      {isArabic ? "لا توجد بيانات" : "No data"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white/95 p-2 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur md:hidden">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={generateReport}
            disabled={loading || loadingVehicles}
            className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
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
            className="rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
          >
            Excel
          </button>
        </div>
      </div>
    </div>
  );
}
