import { useState } from "react";
import { useNavigate } from "react-router";
import { Map, AlertCircle, Globe } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Alert, AlertDescription } from "../components/ui/alert";
import { useAuth } from "../contexts/AuthContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

const COMMON_SERVERS = [
  { label: "Jordan (go.bazytrack.jo)", value: "https://go.bazytrack.jo" },
  { label: "Saudi Arabia (go.bazytrack.sa)", value: "https://go.bazytrack.sa" },
  { label: "Demo Server (demo.traccar.org)", value: "https://demo.traccar.org" },
  { label: "Custom Server", value: "custom" },
];

export function Login() {
  const [serverUrl, setServerUrl] = useState("");
  const [serverPreset, setServerPreset] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleServerPresetChange = (value: string) => {
    setServerPreset(value);
    if (value !== "custom") {
      setServerUrl(value);
    } else {
      setServerUrl("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!serverUrl.trim()) {
      setError("Please enter or select a server URL");
      return;
    }

    if (!email.trim() || !password.trim()) {
      setError("Please enter your username/email and password");
      return;
    }

    setLoading(true);

    try {
      const result = await login(serverUrl, email, password);
      if (result.success) {
        navigate("/");
      } else {
        setError(result.error || "Login failed");
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center">
              <Map className="w-10 h-10 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl">Welcome to BazyTrackGo</CardTitle>
          <CardDescription>
            Sign in with your BazyTrackGo credentials
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="whitespace-pre-line">{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="serverPreset">Server Location</Label>
              <Select value={serverPreset} onValueChange={handleServerPresetChange}>
                <SelectTrigger id="serverPreset">
                  <Globe className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Select your server" />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_SERVERS.map((server) => (
                    <SelectItem key={server.value} value={server.value}>
                      {server.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(serverPreset === "custom" || !serverPreset) && (
              <div className="space-y-2">
                <Label htmlFor="serverUrl">Server URL</Label>
                <Input
                  id="serverUrl"
                  type="url"
                  placeholder="https://your-server.com"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  required
                />
                <p className="text-xs text-gray-500">
                  Enter your BazyTrackGo server URL (e.g., https://go.bazytrack.jo)
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Username or Email</Label>
              <Input
                id="email"
                type="text"
                placeholder="username or email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm font-medium text-blue-900 mb-2">Quick Start:</p>
            <div className="space-y-1 text-sm text-blue-700">
              <p>1. Select your server location from the dropdown</p>
              <p>2. Enter your BazyTrackGo username/email and password</p>
              <p>3. Click Sign In to access your fleet dashboard</p>
            </div>
          </div>

          <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-xs font-medium text-amber-900 mb-1">Demo Server Access:</p>
            <div className="space-y-1 text-xs text-amber-700">
              <p>Server: https://demo.traccar.org</p>
              <p>Username: demo / Password: demo</p>
              <p className="text-amber-600 mt-2">Note: Demo server is for testing only</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}