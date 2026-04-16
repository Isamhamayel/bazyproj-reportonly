import { Server, User, Globe, CheckCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Badge } from "../components/ui/badge";
import { useAuth } from "../contexts/AuthContext";

export function Settings() {
  const { user, serverUrl } = useAuth();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold mb-2">Settings</h1>
        <p className="text-gray-600">View your connection and preferences</p>
      </div>

      <Tabs defaultValue="connection" className="space-y-4">
        <TabsList>
          <TabsTrigger value="connection">Connection</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="connection" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Server Connection</CardTitle>
                  <CardDescription>
                    Your BazyTrackGo server connection details
                  </CardDescription>
                </div>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Connected
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="serverUrl">
                  <Globe className="w-4 h-4 inline mr-2" />
                  Server URL
                </Label>
                <Input
                  id="serverUrl"
                  value={serverUrl || ""}
                  disabled
                  className="bg-gray-50"
                />
                <p className="text-sm text-gray-500">
                  This is your connected BazyTrackGo server
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">
                  <User className="w-4 h-4 inline mr-2" />
                  Username
                </Label>
                <Input
                  id="username"
                  value={user?.email || ""}
                  disabled
                  className="bg-gray-50"
                />
              </div>

              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-900 font-medium mb-1">
                  <Server className="w-4 h-4 inline mr-2" />
                  Connection Status
                </p>
                <p className="text-sm text-blue-700">
                  You are connected to your BazyTrackGo server. All data is being fetched from your
                  Traccar instance.
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg border">
                <p className="text-sm text-gray-700 mb-2">
                  <strong>To connect to a different server:</strong>
                </p>
                <ol className="text-sm text-gray-600 space-y-1 ml-4 list-decimal">
                  <li>Log out from your current session</li>
                  <li>On the login page, enter your new server URL</li>
                  <li>Sign in with your credentials for that server</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API Information</CardTitle>
              <CardDescription>Traccar API endpoints being used</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-gray-600">
              <p>
                <strong>Base URL:</strong> {serverUrl}
              </p>
              <p className="mt-4">
                <strong>Active Endpoints:</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>/api/devices - Device management</li>
                <li>/api/positions - Real-time positions</li>
                <li>/api/reports/trips - Trip reports</li>
                <li>/api/reports/events - Event logs</li>
                <li>/api/reports/summary - Summary statistics</li>
                <li>/api/geofences - Geofence management</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Your account details from Traccar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={user?.name || ""}
                  disabled
                  className="bg-gray-50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.email || ""}
                  disabled
                  className="bg-gray-50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Input
                  id="role"
                  value={user?.administrator ? "Administrator" : "User"}
                  disabled
                  className="bg-gray-50"
                />
                {user?.administrator && (
                  <p className="text-sm text-gray-500">
                    You have full administrative access to this Traccar instance
                  </p>
                )}
              </div>

              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-sm text-amber-900">
                  <strong>Note:</strong> Profile settings are managed in your Traccar server. To
                  update your profile, please use the Traccar web interface or contact your
                  administrator.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Display Preferences</CardTitle>
              <CardDescription>Customize your dashboard experience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="units">Distance Units</Label>
                <select
                  id="units"
                  className="w-full px-3 py-2 border rounded-md"
                  defaultValue="km"
                >
                  <option value="km">Kilometers</option>
                  <option value="mi">Miles</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <select
                  id="timezone"
                  className="w-full px-3 py-2 border rounded-md"
                  defaultValue="UTC"
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                  <option value="Europe/London">London</option>
                  <option value="Asia/Dubai">Dubai</option>
                  <option value="Asia/Riyadh">Riyadh</option>
                  <option value="Asia/Amman">Amman</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="refresh">Auto-refresh Interval</Label>
                <select
                  id="refresh"
                  className="w-full px-3 py-2 border rounded-md"
                  defaultValue="30"
                >
                  <option value="10">10 seconds</option>
                  <option value="30">30 seconds</option>
                  <option value="60">1 minute</option>
                  <option value="300">5 minutes</option>
                </select>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-900">
                  <strong>Coming Soon:</strong> These preferences will be saved to your browser and
                  applied across all sessions.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
