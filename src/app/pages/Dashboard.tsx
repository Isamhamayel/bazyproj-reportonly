import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  Car,
  Zap,
  XCircle,
  Pause,
  Route,
  MapPin,
  AlertTriangle,
  Fuel,
} from "lucide-react";
import { StatCard } from "../components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { DeviceStatusBadge } from "../components/DeviceStatusBadge";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { api } from "../services/api";
import { Summary, Device, Event } from "../services/mockTraccarApi";

export function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [summaryData, devicesData, eventsData, historicalData] = await Promise.all([
        api.getSummary(),
        api.getDevices(),
        api.getEvents(),
        api.getHistoricalData(7),
      ]);
      setSummary(summaryData);
      setDevices(devicesData.slice(0, 5)); // Show top 5
      setEvents(eventsData.slice(0, 5)); // Show latest 5
      // Ensure chart data has unique keys by adding an index
      setChartData(historicalData.map((item: any, index: number) => ({
        ...item,
        id: `day-${index}`,
        date: item.date || `Day ${index + 1}`,
      })));
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
      // Set empty data instead of leaving in loading state
      setSummary({
        totalDevices: 0,
        onlineDevices: 0,
        offlineDevices: 0,
        idleDevices: 0,
        todayDistance: 0,
        todayTrips: 0,
        activeAlerts: 0,
        fuelConsumed: 0,
      });
      setDevices([]);
      setEvents([]);
      setChartData([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !summary) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold mb-2">Dashboard</h1>
        <p className="text-gray-600">Fleet overview and real-time monitoring</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Devices"
          value={summary.totalDevices}
          icon={Car}
          iconColor="bg-blue-500"
        />
        <StatCard
          title="Online"
          value={summary.onlineDevices}
          icon={Zap}
          trend={{ value: 12, isPositive: true }}
          iconColor="bg-green-500"
        />
        <StatCard
          title="Idle"
          value={summary.idleDevices}
          icon={Pause}
          iconColor="bg-yellow-500"
        />
        <StatCard
          title="Offline"
          value={summary.offlineDevices}
          icon={XCircle}
          iconColor="bg-gray-500"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Today's Distance"
          value={`${summary.todayDistance.toFixed(1)} km`}
          icon={Route}
          trend={{ value: 8, isPositive: true }}
          iconColor="bg-purple-500"
        />
        <StatCard
          title="Today's Trips"
          value={summary.todayTrips}
          icon={MapPin}
          iconColor="bg-indigo-500"
        />
        <StatCard
          title="Active Alerts"
          value={summary.activeAlerts}
          icon={AlertTriangle}
          iconColor="bg-red-500"
        />
        <StatCard
          title="Fuel Consumed"
          value={`${summary.fuelConsumed.toFixed(1)} L`}
          icon={Fuel}
          iconColor="bg-orange-500"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distance Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Distance Trend (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" key="grid-distance" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} key="xaxis-distance" />
                  <YAxis tick={{ fontSize: 12 }} key="yaxis-distance" />
                  <Tooltip key="tooltip-distance" />
                  <Area
                    type="monotone"
                    dataKey="distance"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.2}
                    name="Distance (km)"
                    key="area-distance"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-500">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Trips & Alerts */}
        <Card>
          <CardHeader>
            <CardTitle>Trips & Alerts (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" key="grid-activity" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} key="xaxis-activity" />
                  <YAxis tick={{ fontSize: 12 }} key="yaxis-activity" />
                  <Tooltip key="tooltip-activity" />
                  <Legend key="legend-activity" />
                  <Bar dataKey="trips" fill="#10b981" name="Trips" key="bar-trips" />
                  <Bar dataKey="alerts" fill="#ef4444" name="Alerts" key="bar-alerts" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-500">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Devices */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Active Devices</CardTitle>
            <Link to="/fleet" className="text-sm text-blue-600 hover:underline">
              View All
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {devices.map((device) => (
                <div key={device.id} className="flex items-center justify-between py-3 border-b last:border-0">
                  <div className="flex-1">
                    <p className="font-medium">{device.name}</p>
                    <p className="text-sm text-gray-500">{device.uniqueId}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    {device.position && (
                      <div className="text-sm text-gray-600">
                        {device.position.speed.toFixed(0)} km/h
                      </div>
                    )}
                    <DeviceStatusBadge status={device.status} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Events */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Events</CardTitle>
            <Link to="/reports" className="text-sm text-blue-600 hover:underline">
              View All
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {events.map((event) => (
                <div key={event.id} className="flex items-start gap-3 py-3 border-b last:border-0">
                  <div className={`p-2 rounded-lg ${
                    event.type === 'alarm' || event.type === 'deviceOverspeed'
                      ? 'bg-red-100'
                      : 'bg-blue-100'
                  }`}>
                    <AlertTriangle className={`w-4 h-4 ${
                      event.type === 'alarm' || event.type === 'deviceOverspeed'
                        ? 'text-red-600'
                        : 'text-blue-600'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{event.deviceName}</p>
                    <p className="text-sm text-gray-600 capitalize">
                      {event.type.replace(/([A-Z])/g, ' $1').trim()}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {event.eventTime && !isNaN(new Date(event.eventTime).getTime())
                        ? new Date(event.eventTime).toLocaleString()
                        : 'Invalid date'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fuel Consumption Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Fuel Consumption (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" key="grid-fuel" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} key="xaxis-fuel" />
              <YAxis tick={{ fontSize: 12 }} key="yaxis-fuel" />
              <Tooltip key="tooltip-fuel" />
              <Line
                type="monotone"
                dataKey="fuel"
                stroke="#f97316"
                strokeWidth={2}
                dot={{ fill: "#f97316" }}
                name="Fuel (L)"
                key="line-fuel"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}