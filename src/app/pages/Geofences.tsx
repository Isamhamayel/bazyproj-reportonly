import { AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";

export function Geofences() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold mb-2">Geofences</h1>
        <p className="text-gray-600">Manage virtual boundaries for your fleet</p>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Feature Temporarily Unavailable</AlertTitle>
        <AlertDescription>
          The Geofences feature is temporarily disabled due to a compatibility issue with the mapping library in this environment.
          This feature will be available in a future update.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Total Geofences</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">8</div>
            <p className="text-sm text-gray-600 mt-1">Active boundaries</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Active Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">3</div>
            <p className="text-sm text-gray-600 mt-1">Geofence violations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">92%</div>
            <p className="text-sm text-gray-600 mt-1">Fleet coverage</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Geofence Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-4 py-2">
              <h3 className="font-semibold">Warehouse Zone</h3>
              <p className="text-sm text-gray-600">Main warehouse delivery area - Polygon</p>
            </div>
            <div className="border-l-4 border-green-500 pl-4 py-2">
              <h3 className="font-semibold">Delivery Zone A</h3>
              <p className="text-sm text-gray-600">Downtown delivery zone - Circle (500m radius)</p>
            </div>
            <div className="border-l-4 border-purple-500 pl-4 py-2">
              <h3 className="font-semibold">Restricted Area</h3>
              <p className="text-sm text-gray-600">No-entry zone for fleet - Polygon</p>
            </div>
            <div className="border-l-4 border-orange-500 pl-4 py-2">
              <h3 className="font-semibold">Service Zone B</h3>
              <p className="text-sm text-gray-600">Northern service area - Circle (750m radius)</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
