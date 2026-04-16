import { createBrowserRouter, Navigate } from "react-router";
import { MainLayout } from "./components/MainLayout";
import { Dashboard } from "./pages/Dashboard";
import { Fleet } from "./pages/Fleet";
import { LiveMap } from "./pages/LiveMap";
import { Reports } from "./pages/Reports";
import { Analytics } from "./pages/Analytics";
import { Geofences } from "./pages/Geofences";
import { Settings } from "./pages/Settings";
import { Login } from "./pages/Login";

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/",
    Component: MainLayout,
    children: [
      { index: true, Component: Dashboard },
      { path: "fleet", Component: Fleet },
      { path: "map", Component: LiveMap },
      { path: "reports", Component: Reports },
      { path: "analytics", Component: Analytics },
      { path: "geofences", Component: Geofences },
      { path: "settings", Component: Settings },
    ],
  },
]);