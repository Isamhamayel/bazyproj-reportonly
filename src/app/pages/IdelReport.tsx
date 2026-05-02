import { useState } from "react";
import * as XLSX from "xlsx";

const API_KEY = "PUT_API_KEY_HERE";
const BASE_URL = "https://go.bazytrack.jo/api";

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

function toAmmanDateTime(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Amman",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value)).replace(",", "");
}

function toDateOnly(value: string) {
  return toAmmanDateTime(value).slice(0, 10);
}

export default function IdleReport({ lang = "ar" }: { lang?: "ar" | "en" }) {
  const isArabic = lang === "ar";

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [minIdleMinutes, setMinIdleMinutes] = useState(10);
  const [rows, setRows] = useState<IdleRow[]>([]);
  const [loading, setLoading] = useState(false);

  async function fetchDevices(): Promise<Device[]> {
    const res = await fetch(`${BASE_URL}/devices`, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();
    return Array.isArray(data.devices) ? data.devices : data;
  }

  async function fetchTrips(deviceId: number, fromISO: string, toISO: string) {
    const url =
      `${BASE_URL}/reports/trips/customkey` +
      `?deviceId=${deviceId}` +
      `&from=${encodeURIComponent(fromISO)}` +
      `&to=${encodeURIComponent(toISO)}` +
      `&key=idilingFlag`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  async function generateReport() {
    if (!from || !to) return;

    setLoading(true);
    setRows([]);

    try {
      const fromISO = new Date(from).toISOString();
      const toISO = new Date(to).toISOString();

      const devices = await fetchDevices();
      const output: IdleRow[] = [];

      for (const vehicle of devices) {
        const trips = await fetchTrips(vehicle.id, fromISO, toISO);

        for (const trip of trips) {
          const firstPosition = trip?.positions?.[0];
          const idleFlag = firstPosition?.attributes?.idilingFlag ?? false;
          const idleDuration = Number(trip.idilingDuration || 0);

          if (idleFlag && idleDuration >= minIdleMinutes) {
            const lat = firstPosition?.latitude;
            const lon = firstPosition?.longitude;

            output.push({
              date: trip.startTime ? toDateOnly(trip.startTime) : "",
              vehicleId: vehicle.id,
              vehicleName: vehicle.name || "Unnamed",
              durationMinutes: Math.round((trip.duration || 0) / 60000),
              startTime: trip.startTime ? toAmmanDateTime(trip.startTime) : "",
              startAddress: trip.startAddress || "",
              map: lat && lon
                ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
                : "",
              endTime: trip.endTime ? toAmmanDateTime(trip.endTime) : "",
              endAddress: trip.endAddress || "",
            });
          }
        }
      }

      setRows(output);
    } finally {
      setLoading(false);
    }
  }

  function exportExcel() {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Idle Report");
    XLSX.writeFile(workbook, "idle-report.xlsx");
  }

  return (
    <div dir={isArabic ? "rtl" : "ltr"} className="p-4 space-y-4">
      <h1 className="text-xl font-bold">
        {isArabic ? "تقرير التوقف / التشغيل الخامل" : "Idle Report"}
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
          <div>{isArabic ? "أقل مدة بالدقائق" : "Minimum idle minutes"}</div>
          <input
            type="number"
            value={minIdleMinutes}
            onChange={(e) => setMinIdleMinutes(Number(e.target.value))}
            className="border rounded-lg px-3 py-2 w-32"
          />
        </label>

        <button
          onClick={generateReport}
          disabled={loading}
          className="bg-blue-600 text-white rounded-lg px-4 py-2"
        >
          {loading ? "Loading..." : isArabic ? "تشغيل التقرير" : "Run Report"}
        </button>

        <button
          onClick={exportExcel}
          disabled={!rows.length}
          className="border rounded-lg px-4 py-2"
        >
          Excel
        </button>
      </div>

      <div className="bg-white rounded-xl border overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2">Date</th>
              <th className="p-2">Vehicle ID</th>
              <th className="p-2">Vehicle Name</th>
              <th className="p-2">Duration m</th>
              <th className="p-2">Start Time</th>
              <th className="p-2">Start Address</th>
              <th className="p-2">Map</th>
              <th className="p-2">End Time</th>
              <th className="p-2">End Address</th>
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
                  {row.map && (
                    <a href={row.map} target="_blank" className="text-blue-600">
                      📍
                    </a>
                  )}
                </td>
                <td className="p-2">{row.endTime}</td>
                <td className="p-2">{row.endAddress}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
