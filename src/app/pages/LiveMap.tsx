import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { DeviceStatusBadge } from "../components/DeviceStatusBadge";
import { api } from "../services/api";
import { Device } from "../services/mockTraccarApi";
import { MapPin, Navigation, Gauge, Droplet, RefreshCw } from "lucide-react";

declare global {
  interface Window {
    L: any;
  }
}

export function LiveMap() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mapLayer, setMapLayer] = useState<"osm" | "esri">("osm");

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const markersRef = useRef<Map<number, any>>(new Map());

  useEffect(() => {
    loadDevices(true);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      loadDevices(false);
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedDevice]);

  const loadDevices = async (firstLoad = false) => {
    try {
      if (!firstLoad) setRefreshing(true);

      const data = await api.getDevices();
      setDevices(data);

      setSelectedDevice((prev) => {
        if (!prev && data.length > 0) return data[0];
        if (!prev) return null;

        const updated = data.find((d) => d.id === prev.id);
        return updated || prev;
      });
    } catch (error) {
      console.error("Failed to load devices:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const validDevices = useMemo(
    () =>
      devices.filter(
        (device) =>
          device.position &&
          typeof device.position.latitude === "number" &&
          typeof device.position.longitude === "number"
      ),
    [devices]
  );

  // Initialize map once
  useEffect(() => {
    const L = window.L;
    if (!L || !mapContainerRef.current || mapRef.current) return;

    mapRef.current = L.map(mapContainerRef.current, {
      zoomControl: true,
    }).setView([31.9539, 35.9106], 13);

    tileLayerRef.current = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }
    ).addTo(mapRef.current);
  }, []);

  // Change basemap only when mapLayer changes
  useEffect(() => {
    const L = window.L;
    if (!L || !mapRef.current) return;

    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }

    if (mapLayer === "esri") {
      tileLayerRef.current = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          attribution: "Tiles © Esri",
          maxZoom: 19,
        }
      ).addTo(mapRef.current);
    } else {
      tileLayerRef.current = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 19,
        }
      ).addTo(mapRef.current);
    }
  }, [mapLayer]);

  // Draw / update markers whenever devices or selected device changes
  useEffect(() => {
    const L = window.L;
    if (!L || !mapRef.current) return;

    // Remove all old markers
    markersRef.current.forEach((marker) => {
      mapRef.current.removeLayer(marker);
    });
    markersRef.current.clear();

    validDevices.forEach((device) => {
      if (!device.position) return;

      const isSelected = selectedDevice?.id === device.id;
      const course = Number(device.position.course || 0);

      const marker = L.marker(
        [device.position.latitude, device.position.longitude],
        {
          icon: createVehicleIcon(L, {
            selected: isSelected,
            course,
            status: device.status,
          }),
        }
      );

      marker.addTo(mapRef.current);

      marker.on("click", () => {
        setSelectedDevice(device);
      });

      marker.bindPopup(`
        <div style="min-width: 180px;">
          <div style="font-weight: 600; margin-bottom: 4px;">${escapeHtml(device.name)}</div>
          <div style="font-size: 12px; color: #666; margin-bottom: 8px;">${escapeHtml(
            device.uniqueId
          )}</div>
          <div style="font-size: 13px; line-height: 1.5;">
            <div><strong>Status:</strong> ${escapeHtml(device.status || "unknown")}</div>
            <div><strong>Speed:</strong> ${Number(device.position.speed || 0).toFixed(0)} km/h</div>
            <div><strong>Course:</strong> ${Number(device.position.course || 0).toFixed(0)}°</div>
            <div><strong>Fuel:</strong> ${
              device.position.attributes?.fuel ?? "--"
            }</div>
            <div style="margin-top: 6px; color: #666;">
              ${escapeHtml(device.position.address || "Unknown location")}
            </div>
          </div>
        </div>
      `);

      markersRef.current.set(device.id, marker);
    });

    // Keep selected marker popup open
    if (selectedDevice && markersRef.current.has(selectedDevice.id)) {
      const marker = markersRef.current.get(selectedDevice.id);
      marker.openPopup();
    }
  }, [validDevices, selectedDevice]);

  // Center map behavior
  useEffect(() => {
    const L = window.L;
    if (!L || !mapRef.current) return;

    if (selectedDevice?.position) {
      mapRef.current.flyTo(
        [selectedDevice.position.latitude, selectedDevice.position.longitude],
        16,
        { duration: 0.8 }
      );
      return;
    }

    if (validDevices.length === 1) {
      const d = validDevices[0];
      mapRef.current.setView([d.position!.latitude, d.position!.longitude], 14);
      return;
    }

    if (validDevices.length > 1) {
      const bounds = L.latLngBounds(
        validDevices.map((d) => [d.position!.latitude, d.position!.longitude])
      );
      mapRef.current.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [selectedDevice, validDevices]);

  const handleSelectDevice = (device: Device) => {
    setSelectedDevice(device);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading devices...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold mb-2">Live Map</h1>
          <p className="text-gray-600">Real-time vehicle tracking</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setMapLayer("osm")}
            className={`px-3 py-2 rounded-lg border text-sm ${
              mapLayer === "osm"
                ? "bg-blue-50 border-blue-300 text-blue-700"
                : "bg-white hover:bg-gray-50"
            }`}
          >
            OSM
          </button>

          <button
            onClick={() => setMapLayer("esri")}
            className={`px-3 py-2 rounded-lg border text-sm ${
              mapLayer === "esri"
                ? "bg-blue-50 border-blue-300 text-blue-700"
                : "bg-white hover:bg-gray-50"
            }`}
          >
            Satellite
          </button>

          <button
            onClick={() => loadDevices(false)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Device List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Active Vehicles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {devices.map((device) => (
                <button
                  key={device.id}
                  onClick={() => handleSelectDevice(device)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedDevice?.id === device.id
                      ? "bg-blue-50 border-blue-300"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div className="font-medium text-sm mb-1">{device.name}</div>
                  <div className="text-xs text-gray-600 mb-2">{device.uniqueId}</div>
                  <DeviceStatusBadge status={device.status} />

                  {device.position && (
                    <div className="mt-2 text-xs text-gray-600">
                      <div>Speed: {Number(device.position.speed || 0).toFixed(0)} km/h</div>
                      <div>Course: {Number(device.position.course || 0).toFixed(0)}°</div>
                      <div className="truncate">
                        {device.position.address || "Unknown location"}
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Device Details */}
        <div className="lg:col-span-3 space-y-6">
          {selectedDevice ? (
            <>
              {/* Real Map */}
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="relative">
                    <div ref={mapContainerRef} className="h-[500px] w-full" />

                    <div className="absolute left-4 top-4 z-[1000] bg-white/95 backdrop-blur rounded-lg shadow px-3 py-2 text-xs text-gray-700">
                      Showing {validDevices.length} vehicle{validDevices.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Device Info Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Speed</p>
                        <p className="text-2xl font-semibold">
                          {selectedDevice.position?.speed?.toFixed(0) || 0}
                        </p>
                        <p className="text-xs text-gray-500">km/h</p>
                      </div>
                      <Gauge className="w-10 h-10 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Course</p>
                        <p className="text-2xl font-semibold">
                          {selectedDevice.position?.course?.toFixed(0) || 0}°
                        </p>
                        <p className="text-xs text-gray-500">degrees</p>
                      </div>
                      <Navigation className="w-10 h-10 text-green-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Fuel</p>
                        <p className="text-2xl font-semibold">
                          {selectedDevice.position?.attributes?.fuel ?? "--"}
                        </p>
                        <p className="text-xs text-gray-500">percent</p>
                      </div>
                      <Droplet className="w-10 h-10 text-orange-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Altitude</p>
                        <p className="text-2xl font-semibold">
                          {selectedDevice.position?.altitude?.toFixed(0) || 0}
                        </p>
                        <p className="text-xs text-gray-500">meters</p>
                      </div>
                      <MapPin className="w-10 h-10 text-purple-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Device Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold text-sm mb-3">Basic Information</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Device ID:</span>
                          <span className="font-medium">{selectedDevice.uniqueId}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Name:</span>
                          <span className="font-medium">{selectedDevice.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Status:</span>
                          <span className="font-medium capitalize">{selectedDevice.status}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Category:</span>
                          <span className="font-medium capitalize">
                            {selectedDevice.category || "Unknown"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-sm mb-3">Position Information</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Latitude:</span>
                          <span className="font-medium">
                            {selectedDevice.position?.latitude?.toFixed(6) || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Longitude:</span>
                          <span className="font-medium">
                            {selectedDevice.position?.longitude?.toFixed(6) || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Last Update:</span>
                          <span className="font-medium">
                            {selectedDevice.lastUpdate &&
                            !isNaN(new Date(selectedDevice.lastUpdate).getTime())
                              ? new Date(selectedDevice.lastUpdate).toLocaleString()
                              : "Unknown"}
                          </span>
                        </div>
                        {selectedDevice.position?.address && (
                          <div className="pt-2">
                            <span className="text-gray-600">Address:</span>
                            <p className="font-medium mt-1">{selectedDevice.position.address}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-20">
                <div className="text-center text-gray-500">
                  <MapPin className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>Select a vehicle to view details</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function createVehicleIcon(
  L: any,
  options: {
    selected: boolean;
    course: number;
    status?: string;
  }
) {
  const color = getStatusColor(options.status);
  const size = options.selected ? 34 : 26;
  const glow = options.selected ? "0 0 0 6px rgba(37,99,235,0.20)" : "none";
  const border = options.selected ? "#2563eb" : "#ffffff";

  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    html: `
      <div style="
        width:${size}px;
        height:${size}px;
        display:flex;
        align-items:center;
        justify-content:center;
        transform: rotate(${Number(options.course || 0)}deg);
      ">
        <div style="
          width: 0;
          height: 0;
          border-left: ${Math.round(size * 0.28)}px solid transparent;
          border-right: ${Math.round(size * 0.28)}px solid transparent;
          border-bottom: ${Math.round(size * 0.7)}px solid ${color};
          filter: drop-shadow(0 2px 3px rgba(0,0,0,0.35));
          position: relative;
        "></div>
        <div style="
          position:absolute;
          width:${size}px;
          height:${size}px;
          border-radius:9999px;
          border:2px solid ${border};
          box-shadow:${glow};
          pointer-events:none;
        "></div>
      </div>
    `,
  });
}

function getStatusColor(status?: string) {
  switch ((status || "").toLowerCase()) {
    case "online":
      return "#16a34a";
    case "offline":
      return "#6b7280";
    case "unknown":
      return "#f59e0b";
    default:
      return "#ef4444";
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}