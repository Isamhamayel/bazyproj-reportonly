import { useEffect, useState } from "react";
import { TrendingUp, Activity, Zap, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { api } from "../services/api";
import { Device } from "../services/mockTraccarApi";

const COLORS = ["#3b82f6", "#10b981", "#eab308", "#ef4444", "#8b5cf6", "#f97316"];

export function Analytics() {
  const [timeRange, setTimeRange] = useState("7days");
  const [chartData, setChartData] = useState<any[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const days = timeRange === "7days" ? 7 : timeRange === "30days" ? 30 : 90;
      const [historicalData, devicesData] = await Promise.all([
        api.getHistoricalData(days),
        api.getDevices(),
      ]);
      setChartData(historicalData);
      setDevices(devicesData);
    } catch (error) {
      console.error("Failed to load analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  // Device status distribution
  const statusData = [
    { name: "Online", value: devices.filter((d) => d.status === "online").length },
    { name: "Idle", value: devices.filter((d) => d.status === "idle").length },
    { name: "Offline", value: devices.filter((d) => d.status === "offline").length },
  ];

  // Device category distribution
  const categoryData = devices.reduce((acc, device) => {
    const categoryName = device.category || "Unknown";
    const existing = acc.find((item) => item.name === categoryName);
    if (existing) {
      existing.value += 1;
    } else {
      acc.push({ name: categoryName, value: 1 });
    }
    return acc;
  }, [] as { name: string; value: number }[]);

  // Performance metrics
  const totalDistance = chartData.reduce((sum, day) => sum + day.distance, 0);
  const totalTrips = chartData.reduce((sum, day) => sum + day.trips, 0);
  const totalFuel = chartData.reduce((sum, day) => sum + day.fuel, 0);
  const totalAlerts = chartData.reduce((sum, day) => sum + day.alerts, 0);

  const avgDailyDistance = chartData.length > 0 ? totalDistance / chartData.length : 0;
  const avgDailyTrips = chartData.length > 0 ? totalTrips / chartData.length : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading analytics...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-semibold mb-2">Analytics</h1>
          <p className="text-gray-600">In-depth fleet performance analysis</p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7days">Last 7 Days</SelectItem>
            <SelectItem value="30days">Last 30 Days</SelectItem>
            <SelectItem value="90days">Last 90 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Avg Daily Distance</p>
                <p className="text-2xl font-semibold">{avgDailyDistance.toFixed(1)} km</p>
              </div>
              <div className="bg-blue-500 p-3 rounded-lg">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Avg Daily Trips</p>
                <p className="text-2xl font-semibold">{avgDailyTrips.toFixed(1)}</p>
              </div>
              <div className="bg-green-500 p-3 rounded-lg">
                <Activity className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Fuel Used</p>
                <p className="text-2xl font-semibold">{totalFuel.toFixed(0)} L</p>
              </div>
              <div className="bg-orange-500 p-3 rounded-lg">
                <Zap className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Alerts</p>
                <p className="text-2xl font-semibold">{totalAlerts}</p>
              </div>
              <div className="bg-red-500 p-3 rounded-lg">
                <AlertCircle className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distance & Fuel Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Distance & Fuel Consumption</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="distance"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: "#3b82f6" }}
                  name="Distance (km)"
                  key="distance-line"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="fuel"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={{ fill: "#f97316" }}
                  name="Fuel (L)"
                  key="fuel-line"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Device Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Device Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`status-cell-${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Trips */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Trip Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="trips" fill="#10b981" name="Trips" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Vehicle Category Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Vehicle Category Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name.toUpperCase()}: ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`category-cell-${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 3 */}
      <Card>
        <CardHeader>
          <CardTitle>Alert Trend Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="alerts"
                stroke="#ef4444"
                fill="#ef4444"
                fillOpacity={0.3}
                name="Alerts"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-gray-600 mb-2">Total Distance</div>
              <div className="text-2xl font-semibold mb-1">{totalDistance.toFixed(1)} km</div>
              <div className="text-xs text-gray-500">
                Over {chartData.length} days
              </div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-gray-600 mb-2">Total Trips</div>
              <div className="text-2xl font-semibold mb-1">{totalTrips}</div>
              <div className="text-xs text-gray-500">
                Avg {avgDailyTrips.toFixed(1)} per day
              </div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-gray-600 mb-2">Fuel Efficiency</div>
              <div className="text-2xl font-semibold mb-1">
                {totalDistance > 0 ? (totalDistance / totalFuel).toFixed(2) : 0} km/L
              </div>
              <div className="text-xs text-gray-500">
                Fleet average
              </div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-gray-600 mb-2">Alert Rate</div>
              <div className="text-2xl font-semibold mb-1">
                {totalTrips > 0 ? ((totalAlerts / totalTrips) * 100).toFixed(1) : 0}%
              </div>
              <div className="text-xs text-gray-500">
                Alerts per trip
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}