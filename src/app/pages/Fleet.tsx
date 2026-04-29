import { useEffect, useState, useRef } from "react";
import {
  Search,
  Filter,
  Download,
  Car,
  Phone,
  User,
  Gauge,
  MapPin,
  Clock, 
  Activity,
  Key,
  Calendar,
  RefreshCw,
  AlertTriangle,
  WifiOff,
  Star,
  ArrowUpDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { DeviceStatusBadge } from "../components/DeviceStatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { api } from "../services/api";
import { Device, Position } from "../services/mockTraccarApi";
import * as XLSX from "xlsx";

interface DeviceWithPosition extends Device {
  positionData?: Position;
  isDelayed?: boolean;
  isDisconnected?: boolean; // For devices with no update > 60 min
}

export function Fleet() {
  const [devices, setDevices] = useState<DeviceWithPosition[]>([]);
  const [filteredDevices, setFilteredDevices] = useState<DeviceWithPosition[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [ignitionFilter, setIgnitionFilter] = useState<string>("all");
  const [excludedStatuses, setExcludedStatuses] = useState<Set<string>>(new Set()); // Track EXCLUDED statuses
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"cards" | "table">("table");
  const [refreshInterval, setRefreshInterval] = useState<number>(30);
  const [isAutoRefresh, setIsAutoRefresh] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [refreshProgress, setRefreshProgress] = useState(0);
  const [sortBy, setSortBy] = useState<"name" | "speed" | "lastUpdate">("name");
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [tableMaximized, setTableMaximized] = useState(false);

  // Refs to preserve scroll position
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const savedScrollPosition = useRef({ top: 0, left: 0 });
  const hasLoadedOnceRef = useRef(false);

  

  // Load favorites from localStorage on mount
  useEffect(() => {
    const savedFavorites = localStorage.getItem("fleet_favorites");
    if (savedFavorites) {
      setFavorites(new Set(JSON.parse(savedFavorites)));
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, []);

  useEffect(() => {
    filterDevices();
  }, [devices, searchQuery, ignitionFilter, excludedStatuses, sortBy, favorites]);

  // Auto-refresh effect with progress tracking
  useEffect(() => {
    if (!isAutoRefresh) {
      setRefreshProgress(0);
      return;
    }

    setRefreshProgress(0);

    const progressInterval = setInterval(() => {
      setRefreshProgress((prev) => {
        const increment = 100 / ((refreshInterval * 1000) / 100);
        const newProgress = prev + increment;
        return newProgress >= 100 ? 100 : newProgress;
      });
    }, 100);

    const dataInterval = setInterval(() => {
      loadDevices();
      setRefreshProgress(0);
    }, refreshInterval * 1000);

    return () => {
      clearInterval(progressInterval);
      clearInterval(dataInterval);
    };
  }, [refreshInterval, isAutoRefresh]);

  // Save scroll position before data updates
  const saveScrollPosition = () => {
    if (scrollContainerRef.current) {
      savedScrollPosition.current = {
        top: window.scrollY,
        left: window.scrollX,
      };
    }
  };

  // Restore scroll position after data updates
  const restoreScrollPosition = () => {
    requestAnimationFrame(() => {
      window.scrollTo(savedScrollPosition.current.left, savedScrollPosition.current.top);
    });
  };

  // Manual refresh function
  const handleManualRefresh = () => {
    setRefreshProgress(0);
    loadDevices();
  };

 const loadDevices = async () => {
  // Show loading only before the first successful load
  if (!hasLoadedOnceRef.current && devices.length === 0) {
    setLoading(true);
  }

  try {
    const [devicesData, positionsData] = await Promise.all([
      api.getDevices(),
      api.getPositions(),
    ]);

    const positionsMap = new Map<number, Position>();
    positionsData.forEach((position) => {
      positionsMap.set(position.deviceId, position);
    });

    const devicesWithPositions = devicesData.map((device) => {
      const position = positionsMap.get(device.id);

      const isDelayed = device.lastUpdate
        ? Date.now() - new Date(device.lastUpdate).getTime() > 5 * 60 * 1000
        : true;

      const isDisconnected = device.lastUpdate
        ? Date.now() - new Date(device.lastUpdate).getTime() > 60 * 60 * 1000
        : true;

      return {
        ...device,
        positionData: position,
        isDelayed,
        isDisconnected,
      } as DeviceWithPosition;
    });

    setDevices((prevDevices) => {
      if (!hasLoadedOnceRef.current || prevDevices.length !== devicesWithPositions.length) {
        return devicesWithPositions;
      }

      return devicesWithPositions.map((newDevice) => {
        const oldDevice = prevDevices.find((d) => d.id === newDevice.id);

        if (!oldDevice) return newDevice;

        const positionChanged =
          JSON.stringify(oldDevice.positionData) !== JSON.stringify(newDevice.positionData);

        const statusChanged =
          oldDevice.isDelayed !== newDevice.isDelayed ||
          oldDevice.isDisconnected !== newDevice.isDisconnected ||
          oldDevice.lastUpdate !== newDevice.lastUpdate;

        if (!positionChanged && !statusChanged) {
          return oldDevice;
        }

        return newDevice;
      });
    });

    hasLoadedOnceRef.current = true;
    setLoading(false);
    setIsInitialLoad(false);
  } catch (error) {
    console.error("Failed to load devices:", error);

    if (!hasLoadedOnceRef.current) {
      setLoading(false);
    }
  }
};

  const filterDevices = () => {
    let filtered = devices;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter((device) =>
        device.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by ignition
    if (ignitionFilter !== "all") {
      if (ignitionFilter === "on") {
        filtered = filtered.filter((device) => device.positionData?.attributes.ignition === true);
      } else if (ignitionFilter === "off") {
        filtered = filtered.filter((device) => device.positionData?.attributes.ignition === false);
      } else if (ignitionFilter === "idle") {
        filtered = filtered.filter(
          (device) =>
            device.positionData?.attributes.ignition === true &&
            device.positionData?.speed === 0
        );
      }
    }

    // Filter by status cards (Moving, Idle, Off, Delayed, Disconnected)
    // Minimal fix: keep delayed vehicles visible even when moving/idle/off are hidden
    if (excludedStatuses.size > 0) {
      filtered = filtered.filter((device) => {
        const isDisconnected = !!device.isDisconnected;
        const isDelayed = !!device.isDelayed && !isDisconnected;
        const isMoving =
          device.positionData?.attributes.ignition === true &&
          (device.positionData?.speed ?? 0) > 0;
        const isIdle =
          device.positionData?.attributes.ignition === true &&
          (device.positionData?.speed ?? 0) === 0;
        const isOff =
          device.positionData?.attributes.ignition === false &&
          !isDisconnected;

        if (excludedStatuses.has("disconnected") && isDisconnected) {
          return false;
        }

        if (isDelayed) {
          return !excludedStatuses.has("delayed");
        }

        if (excludedStatuses.has("moving") && isMoving) {
          return false;
        }
        if (excludedStatuses.has("idle") && isIdle) {
          return false;
        }
        if (excludedStatuses.has("off") && isOff) {
          return false;
        }

        return true;
      });
    }

    // Sort filtered devices with multiple priorities
    filtered.sort((a, b) => {
      const aIsFav = favorites.has(a.id);
      const bIsFav = favorites.has(b.id);
      if (aIsFav && !bIsFav) return -1;
      if (!aIsFav && bIsFav) return 1;

      const aIgnitionOn = a.positionData?.attributes.ignition === true;
      const bIgnitionOn = b.positionData?.attributes.ignition === true;
      if (aIgnitionOn && !bIgnitionOn) return -1;
      if (!aIgnitionOn && bIgnitionOn) return 1;

      if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      } else if (sortBy === "speed") {
        return (b.positionData?.speed || 0) - (a.positionData?.speed || 0);
      } else if (sortBy === "lastUpdate") {
        return new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime();
      }
      return 0;
    });

    setFilteredDevices(filtered);
  };

  const toggleStatusFilter = (status: string) => {
    setExcludedStatuses((prev) => {
      const newFilters = new Set(prev);
      if (newFilters.has(status)) {
        newFilters.delete(status);
      } else {
        newFilters.add(status);
      }
      return newFilters;
    });
  };

  const toggleFavorite = (deviceId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(deviceId)) {
        newFavorites.delete(deviceId);
      } else {
        newFavorites.add(deviceId);
      }
      localStorage.setItem("fleet_favorites", JSON.stringify(Array.from(newFavorites)));
      return newFavorites;
    });
  };

  const exportToExcel = () => {
    const data = filteredDevices.map((device) => ({
      "Device Name": device.name,
      Speed: device.positionData ? `${device.positionData.speed.toFixed(0)} km/h` : "N/A",
      Location: device.positionData?.address || "Unknown",
      Battery: device.positionData?.attributes.battery
        ? `${device.positionData.attributes.battery}%`
        : "N/A",
      Fuel: device.positionData?.attributes.fuel ? `${device.positionData.attributes.fuel}%` : "N/A",
      Ignition: device.positionData?.attributes.ignition ? "On" : "Off",
      Odometer: device.positionData?.attributes.totalDistance
        ? `${(device.positionData.attributes.totalDistance / 1000).toFixed(2)} km`
        : "N/A",
      "Last Update":
        device.lastUpdate && !isNaN(new Date(device.lastUpdate).getTime())
          ? new Date(device.lastUpdate).toLocaleString()
          : "Unknown",
      Status: device.isDelayed ? "Delayed" : "Active",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Fleet");

    worksheet["!cols"] = [
      { wch: 20 },
      { wch: 12 },
      { wch: 30 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 15 },
      { wch: 20 },
      { wch: 10 },
    ];

    XLSX.writeFile(workbook, `fleet_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const getLastUpdateText = (lastUpdate: string) => {
    const minutes = Math.floor((Date.now() - new Date(lastUpdate).getTime()) / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const ignitionOnCount = devices.filter(
    (d) => d.positionData?.attributes.ignition === true && d.positionData?.speed > 0
  ).length;
  const ignitionIdleCount = devices.filter(
    (d) => d.positionData?.attributes.ignition === true && d.positionData?.speed === 0
  ).length;
  const ignitionOffCount = devices.filter(
    (d) => d.positionData?.attributes.ignition === false
  ).length;
  const delayedCount = devices.filter((d) => d.isDelayed && !d.isDisconnected).length;
  const disconnectedCount = devices.filter((d) => d.isDisconnected).length;

  return (
    <div className="space-y-2">
      {!tableMaximized && (
       <Card>
        <CardContent className="p-2">
          <div className="mb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-8 gap-2 mb-1">
            <Select value={ignitionFilter} onValueChange={setIgnitionFilter}>
              <SelectTrigger className="w-full">
                <div className="flex items-center gap-1 truncate">
                  <Filter className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate text-xs sm:text-sm">
                    {ignitionFilter === "all"
                      ? "All Vehicles"
                      : ignitionFilter === "on"
                      ? "Ignition On"
                      : ignitionFilter === "idle"
                      ? "Idle"
                      : "Ignition Off"}
                  </span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vehicles</SelectItem>
                <SelectItem value="on">Ignition On</SelectItem>
                <SelectItem value="idle">Idle</SelectItem>
                <SelectItem value="off">Ignition Off</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={sortBy}
              onValueChange={(v: "name" | "speed" | "lastUpdate") => setSortBy(v)}
            >
              <SelectTrigger className="w-full">
                <div className="flex items-center gap-1 truncate">
                  <ArrowUpDown className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate text-xs sm:text-sm">
                    {sortBy === "name" ? "Name" : sortBy === "speed" ? "Speed" : "Updated"}
                  </span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Sort: Name</SelectItem>
                <SelectItem value="speed">Sort: Speed</SelectItem>
                <SelectItem value="lastUpdate">Sort: Last Update</SelectItem>
              </SelectContent>
            </Select>

            <Select value={viewMode} onValueChange={(v: "cards" | "table") => setViewMode(v)}>
              <SelectTrigger className="w-full">
                <span className="truncate text-xs sm:text-sm">
                  {viewMode === "cards" ? "Cards" : "Table"}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cards">Card View</SelectItem>
                <SelectItem value="table">Table View</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={refreshInterval.toString()}
              onValueChange={(v) => setRefreshInterval(Number(v))}
            >
              <SelectTrigger className="w-full">
                <div className="flex items-center gap-1 truncate">
                  <RefreshCw className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate text-xs sm:text-sm">{refreshInterval}s</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">Refresh: 15 sec</SelectItem>
                <SelectItem value="30">Refresh: 30 sec</SelectItem>
                <SelectItem value="40">Refresh: 40 sec</SelectItem>
                <SelectItem value="50">Refresh: 50 sec</SelectItem>
                <SelectItem value="60">Refresh: 1 min</SelectItem>
              </SelectContent>
            </Select>

            <Button
              onClick={() => setIsAutoRefresh(!isAutoRefresh)}
              variant={isAutoRefresh ? "default" : "outline"}
              className="relative col-span-2 sm:col-span-1 h-9 px-2 sm:px-3"
              title={
                isAutoRefresh
                  ? "Auto-refresh is ON - Click to turn OFF"
                  : "Auto-refresh is OFF - Click to turn ON"
              }
            >
              {isAutoRefresh ? (
                <div className="flex items-center gap-2 justify-center w-full">
                  <div className="relative w-8 h-8 flex-shrink-0">
                    <svg
                      className="w-full h-full"
                      viewBox="0 0 32 32"
                      style={{ transform: "rotate(-90deg)" }}
                    >
                      <circle
                        cx="16"
                        cy="16"
                        r="14"
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.4)"
                        strokeWidth="3"
                      />
                      <circle
                        cx="16"
                        cy="16"
                        r="14"
                        fill="none"
                        stroke="#22d3ee"
                        strokeWidth="3"
                        strokeDasharray={2 * Math.PI * 14}
                        strokeDashoffset={2 * Math.PI * 14 * (1 - refreshProgress / 100)}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ transform: "rotate(90deg)" }}
                    >
                      <span className="text-xs font-bold text-white">
                        {Math.round(refreshInterval * (1 - refreshProgress / 100))}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-start">
                    <span className="text-xs sm:text-sm font-medium">Auto ON</span>
                    <span className="text-[10px] sm:text-xs opacity-80 hidden sm:inline">
                      Refreshing...
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 justify-center">
                  <RefreshCw className="w-4 h-4" />
                  <span className="text-xs sm:text-sm font-medium">Auto OFF</span>
                </div>
              )}
            </Button>

            <Button onClick={exportToExcel} variant="outline" className="h-9">
              <Download className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="text-xs sm:text-sm">Export</span>
            </Button>
              <Button
          onClick={handleManualRefresh}
          variant="outline"
          size="lg"
          className="h-9 w-full"
        >
          <RefreshCw className="w-5 h-5" />
          <span>Refresh Now</span>
        </Button>

            <Button
              onClick={() => setTableMaximized(true)}
              variant="outline"
              className="h-9 w-full"
            >
              Max Table
            </Button>
          </div>
        </CardContent>
      </Card>
      )}

      {tableMaximized && (
        <div className="flex items-center justify-between gap-2 rounded-xl border bg-white p-2 shadow-sm">
          <div className="text-sm font-semibold">
            Devices ({filteredDevices.length} of {devices.length})
          </div>
          <div className="flex gap-2">
            <Button onClick={handleManualRefresh} variant="outline" className="h-8 px-3 text-xs">
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
            <Button onClick={exportToExcel} variant="outline" className="h-8 px-3 text-xs">
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
            <Button onClick={() => setTableMaximized(false)} variant="outline" className="h-8 px-3 text-xs">
              Show Filters
            </Button>
          </div>
        </div>
      )}

      {!tableMaximized && (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        <Card
          className={`cursor-pointer transition-all hover:shadow-lg ${
            excludedStatuses.has("moving") ? "ring-2 ring-red-500 bg-red-50" : ""
          }`}
          onClick={() => toggleStatusFilter("moving")}
        >
          <CardContent className="p-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Moving</p>
                <p className="text-lg font-semibold text-green-600">{ignitionOnCount}</p>
              </div>
              <Activity className="w-5 h-5 text-green-500" />
            </div>
            {excludedStatuses.has("moving") && (
              <div className="mt-1 text-[10px] text-red-700 font-medium">✕ Hidden</div>
            )}
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all hover:shadow-lg ${
            excludedStatuses.has("idle") ? "ring-2 ring-red-500 bg-red-50" : ""
          }`}
          onClick={() => toggleStatusFilter("idle")}
        >
          <CardContent className="p-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Idle</p>
                <p className="text-lg font-semibold text-yellow-600">{ignitionIdleCount}</p>
              </div>
              <Clock className="w-5 h-5 text-yellow-500" />
            </div>
            {excludedStatuses.has("idle") && (
              <div className="mt-1 text-[10px] text-red-700 font-medium">✕ Hidden</div>
            )}
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all hover:shadow-lg ${
            excludedStatuses.has("off") ? "ring-2 ring-red-500 bg-red-50" : ""
          }`}
          onClick={() => toggleStatusFilter("off")}
        >
          <CardContent className="p-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Ignition Off</p>
                <p className="text-lg font-semibold text-gray-600">{ignitionOffCount}</p>
              </div>
              <Key className="w-5 h-5 text-gray-500" />
            </div>
            {excludedStatuses.has("off") && (
              <div className="mt-1 text-[10px] text-red-700 font-medium">✕ Hidden</div>
            )}
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all hover:shadow-lg ${
            excludedStatuses.has("delayed") ? "ring-2 ring-red-500 bg-red-50" : ""
          }`}
          onClick={() => toggleStatusFilter("delayed")}
        >
          <CardContent className="p-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Delayed</p>
                <p className="text-lg font-semibold text-red-600">{delayedCount}</p>
              </div>
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            {excludedStatuses.has("delayed") && (
              <div className="mt-1 text-[10px] text-red-700 font-medium">✕ Hidden</div>
            )}
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all hover:shadow-lg ${
            excludedStatuses.has("disconnected") ? "ring-2 ring-red-500 bg-red-50" : ""
          }`}
          onClick={() => toggleStatusFilter("disconnected")}
        >
          <CardContent className="p-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Disconnected</p>
                <p className="text-lg font-semibold text-gray-600">{disconnectedCount}</p>
              </div>
              <WifiOff className="w-5 h-5 text-gray-500" />
            </div>
            {excludedStatuses.has("disconnected") && (
              <div className="mt-1 text-[10px] text-red-700 font-medium">✕ Hidden</div>
            )}
          </CardContent>
        </Card>
      </div>
      )}

      {loading ? (
        <Card>
          <CardContent className="p-8">
            <div className="text-center text-gray-500">Loading devices...</div>
          </CardContent>
        </Card>
      ) : filteredDevices.length === 0 ? (
        <Card>
          <CardContent className="p-8">
            <div className="text-center text-gray-500">No devices found</div>
          </CardContent>
        </Card>
      ) : viewMode === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDevices.map((device) => (
            <Card
              key={device.id}
              className={`hover:shadow-lg transition-shadow ${
                device.isDelayed ? "border-red-500 border-2" : ""
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Car className="w-5 h-5" />
                      {device.name}
                      {device.isDelayed && <AlertTriangle className="w-4 h-4 text-red-500" />}
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => toggleFavorite(device.id, e)}
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                      title={
                        favorites.has(device.id) ? "Remove from favorites" : "Add to favorites"
                      }
                    >
                      <Star
                        className={`w-5 h-5 ${
                          favorites.has(device.id)
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-gray-400"
                        }`}
                      />
                    </button>
                    <div
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        device.positionData?.attributes.ignition
                          ? device.positionData?.speed > 0
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {device.positionData?.attributes.ignition
                        ? device.positionData?.speed > 0
                          ? "Moving"
                          : "Idle"
                        : "Off"}
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <Gauge className="w-4 h-4 text-blue-600" />
                    <div>
                      <p className="text-xs text-gray-600">Speed</p>
                      <p className="text-sm font-semibold">
                        {device.positionData ? `${device.positionData.speed.toFixed(0)} km/h` : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <Key
                      className={`w-4 h-4 ${
                        device.positionData?.attributes.ignition
                          ? "text-green-600"
                          : "text-gray-400"
                      }`}
                    />
                    <div>
                      <p className="text-xs text-gray-600">Ignition</p>
                      <p className="text-sm font-semibold">
                        {device.positionData?.attributes.ignition ? "On" : "Off"}
                      </p>
                    </div>
                  </div>
                </div>

                {device.positionData?.attributes.totalDistance && (
                  <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <Gauge className="w-4 h-4 text-purple-600" />
                    <div>
                      <p className="text-xs text-gray-600">Odometer</p>
                      <p className="text-sm font-semibold">
                        {(device.positionData.attributes.totalDistance / 1000).toFixed(2)} km
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-2 p-2 bg-gray-50 rounded">
                  <MapPin className="w-4 h-4 text-red-600 mt-1 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-600">Location</p>
                    <p className="text-sm font-semibold truncate">
                      {device.positionData?.address || "Unknown"}
                    </p>
                  </div>
                </div>

                {device.positionData?.attributes.driverName && (
                  <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <User className="w-4 h-4 text-indigo-600" />
                    <div>
                      <p className="text-xs text-gray-600">Driver</p>
                      <p className="text-sm font-semibold">
                        {device.positionData.attributes.driverName}
                      </p>
                    </div>
                  </div>
                )}

                {device.positionData?.attributes.phone && (
                  <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <Phone className="w-4 h-4 text-teal-600" />
                    <div>
                      <p className="text-xs text-gray-600">Phone</p>
                      <p className="text-sm font-semibold">
                        {device.positionData.attributes.phone}
                      </p>
                    </div>
                  </div>
                )}

                <div
                  className={`flex items-center gap-2 pt-2 border-t ${
                    device.isDisconnected
                      ? "text-gray-600"
                      : device.isDelayed
                      ? "text-red-600"
                      : ""
                  }`}
                >
                  <Calendar
                    className={`w-4 h-4 ${
                      device.isDisconnected
                        ? "text-gray-500"
                        : device.isDelayed
                        ? "text-red-500"
                        : "text-gray-400"
                    }`}
                  />
                  <p className="text-xs">
                    Last update: {getLastUpdateText(device.lastUpdate)}
                    {device.isDisconnected
                      ? " (Disconnected)"
                      : device.isDelayed
                      ? " (Delayed)"
                      : ""}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className={tableMaximized ? "h-[calc(100vh-72px)] overflow-hidden" : ""}>
          <CardHeader className="py-2">
            <CardTitle className="text-sm font-semibold">
              Devices ({filteredDevices.length} of {devices.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <div className={tableMaximized ? "h-[calc(100vh-130px)] overflow-auto" : "overflow-x-auto"}>
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky top-0 z-10 w-[220px] bg-white px-2 py-1 text-xs">Device Name</TableHead>
                    <TableHead className="sticky top-0 z-10 bg-white px-2 py-1 text-xs">Ignition</TableHead>
                    <TableHead className="sticky top-0 z-10 bg-white px-2 py-1 text-xs">Speed</TableHead>
                    <TableHead className="sticky top-0 z-10 bg-white px-2 py-1 text-xs">Location</TableHead>
                    <TableHead className="sticky top-0 z-10 bg-white px-2 py-1 text-xs">Last Update</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDevices.map((device) => (
                    <TableRow key={device.id} className={`h-8 ${device.isDelayed ? "bg-red-50" : ""}`}>
                      <TableCell className="max-w-[180px] whitespace-normal break-words px-2 py-1 text-xs font-medium leading-tight">
                        <div className="flex items-center gap-2">
                          {favorites.has(device.id) && (
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          )}
                          {device.name}
                          {device.isDelayed && <AlertTriangle className="w-4 h-4 text-red-500" />}
                        </div>
                      </TableCell>
                      <TableCell className="px-2 py-1 text-xs">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            device.positionData?.attributes.ignition
                              ? device.positionData?.speed > 0
                                ? "bg-green-100 text-green-700"
                                : "bg-yellow-100 text-yellow-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {device.positionData?.attributes.ignition
                            ? device.positionData?.speed > 0
                              ? "Moving"
                              : "Idle"
                            : "Off"}
                        </span>
                      </TableCell>
                      <TableCell className="px-2 py-1 text-xs">
                        {device.positionData ? `${device.positionData.speed.toFixed(0)} km/h` : "—"}
                      </TableCell>
                        <TableCell 
  className="max-w-xs whitespace-normal break-words px-2 py-1 text-right text-xs leading-snug" 
  dir="rtl"
>
  {device.positionData?.address || "Unknown"}
</TableCell>
                      <TableCell
                        className={
                          device.isDisconnected
                            ? "text-gray-600 font-semibold"
                            : device.isDelayed
                            ? "text-red-600 font-semibold"
                            : "text-gray-600"
                        }
                      >
                        {getLastUpdateText(device.lastUpdate)}
                        {device.isDisconnected
                          ? " (Disconnected)"
                          : device.isDelayed
                          ? " (Delayed)"
                          : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
