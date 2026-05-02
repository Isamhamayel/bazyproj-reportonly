import { useState } from "react";
import * as XLSX from "xlsx";
import { api } from "../services/api";

type Device = {
  id: number;
  name?: string;
};

type IdleRow = {
  date: string;
  vehicleId: number;
  vehicleName: string;
  durationMinutes: number;
  startTime: string;
  startAddress: string;
  map: string;
  endTime: string;
  endAddress: string;
};

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

// Get session from localStorage
const getSession = () => {
  const stored = localStorage.getItem("traccar_session");
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
};

// Fetch idle trips with custom key
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
      console.warn(`API Error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Failed to fetch idle trips:", error);
    return [];
  }
};

export default function IdleReport({ lang = "ar" }: { lang?: "ar" | "en" }) {
  const isArabic = lang === "ar";

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [minIdleMinutes, setMinIdleMinutes] = useState(10);
  const [rows, setRows] = useState<IdleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

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

      const vehicles = await api.getDevices();
      if (!vehicles || vehicles.length === 0) {
        setMessage(
          isArabic ? "لم يتم العثور على مركبات" : "No vehicles found"
        );
        return;
      }

      const reportRows: IdleRow[] = [];

      for (const vehicle of vehicles) {
        const trips = await fetchIdleTrips(vehicle.id, fromISO, toISO);

        for (const trip of trips) {
          const firstPosition = trip?.positions?.[0];

          const idleFlag =
            firstPosition?.attributes?.idilingFlag ??
            trip?.idilingFlag ??
            false;

          const idleDuration = Number(trip?.idilingDuration || 0);

          if (idleFlag && idleDuration >= minIdleMinutes) {
            const lat = firstPosition?.latitude;
            const lon = firstPosition?.longitude;

            reportRows.push({
              date: trip.startTime ? formatDateOnly(trip.startTime) : "",
              vehicleId: vehicle.id,
              vehicleName: vehicle.name || "Unnamed",
              durationMinutes: Math.round((trip.duration || 0) / 60000),
              startTime: trip.startTime ? formatAmmanDateTime(trip.startTime) : "",
              startAddress: trip.startAddress || "",
              map:
                lat && lon
                  ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
                  : "",
              endTime: trip.endTime ? formatAmmanDateTime(trip.endTime) : "",
              endAddress: trip.endAddress || "",
            });
          }
        }
      }

      setRows(reportRows);
      setMessage(
        isArabic
          ? `تم العثور على ${reportRows.length} سجل`
          : `Found ${reportRows.length} records`
      );
    } catch (error) {
      console.error("Idle report error:", error);
      setMessage(
        isArabic ? "حدث خطأ في التقرير" : "An error occurred generating the report"
      );
    } finally {
      setLoading(false);
    }
  }

  function exportExcel() {
    if (!rows.length) {
      setMessage(
        isArabic ? "لا توجد بيانات للتصدير" : "No data to export"
      );
      return;
    }

    const exportRows = rows.map((row) => ({
      Date: row.date,
      "Vehicle ID": row.vehicleId,
      "Vehicle Name": row.vehicleName,
      "Duration (m)": row.durationMinutes,
      "Start Time": row.startTime,
      "Start Address": row.startAddress,
      Map: row.map,
      "End Time": row.endTime,
      "End Address": row.endAddress,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Idle Report");
    XLSX.writeFile(
      workbook,
      `idle-report_${new Date().toISOString().split("T")[0]}.xlsx`
    );

    setMessage(isArabic ? "تم التصدير بنجاح" : "Export successful");
  }

  return (
    <div dir={isArabic ? "rtl" : "ltr"} className="p-4 space-y-4">
      <h1 className="text-xl font-bold">
        {isArabic ? "تقرير الخمول" : "Idle Report"}
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
          <div>
            {isArabic ? "أقل مدة خمول بالدقائق" : "Min idle minutes"}
          </div>
          <input
            type="number"
            value={minIdleMinutes}
            onChange={(e) => setMinIdleMinutes(Number(e.target.value))}
            className="border rounded-lg px-3 py-2 w-36"
          />
        </label>

        <button
          onClick={generateReport}
          disabled={loading}
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
          onClick={exportExcel}
          disabled={!rows.length}
          className="border rounded-lg px-4 py-2 disabled:opacity-60"
        >
          Excel
        </button>
      </div>

      {message && (
        <div
          className={`p-3 rounded-lg text-sm ${
            message.includes("خطأ") || message.includes("error")
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
              <th className="p-2">{isArabic ? "التاريخ" : "Date"}</th>
              <th className="p-2">
                {isArabic ? "معرف المركبة" : "Vehicle ID"}
              </th>
              <th className="p-2">
                {isArabic ? "اسم المركبة" : "Vehicle Name"}
              </th>
              <th className="p-2">{isArabic ? "المدة (د)" : "Duration (m)"}</th>
              <th className="p-2">{isArabic ? "وقت البداية" : "Start Time"}</th>
              <th className="p-2">
                {isArabic ? "عنوان البداية" : "Start Address"}
              </th>
              <th className="p-2">{isArabic ? "الخريطة" : "Map"}</th>
              <th className="p-2">{isArabic ? "وقت النهاية" : "End Time"}</th>
              <th className="p-2">
                {isArabic ? "عنوان النهاية" : "End Address"}
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-t">
                <td className="p-2">{row.date}</td>
                <td className="p-2">{row.vehicleId}</td>
                <td className="p-2">{row.vehicleName}</td>
                <td className="p-2">{row.durationMinutes}</td>
                <td className="p-2">{row.startTime}</td>
                <td className="p-2">{row.startAddress}</td>
                <td className="p-2">
                  {row.map ? (
                    <a
                      href={row.map}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600"
                    >
                      📍
                    </a>
                  ) : (
                    ""
                  )}
                </td>
                <td className="p-2">{row.endTime}</td>
                <td className="p-2">{row.endAddress}</td>
              </tr>
            ))}

            {!rows.length && !loading && (
              <tr>
                <td colSpan={9} className="p-4 text-center text-gray-500">
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
