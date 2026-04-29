import { useState, useEffect, useMemo, useRef } from "react";
import { 
  Calendar, 
  Download, 
  FileText, 
  MapPin, 
  Clock, 
  TrendingUp, 
  RefreshCw,
  LogIn,
  LogOut,
  AlertTriangle,
  Gauge,
  Play,
  Square,
  Filter,
  Plus,
  X,
  Power,
  PowerOff,
  Eye,
  Pause,
  RotateCcw
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import { Checkbox } from "../components/ui/checkbox";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { api } from "../services/api";
import { Trip, Event, Device, Position } from "../services/mockTraccarApi";
import * as XLSX from 'xlsx';

declare global {
  interface Window {
    L?: any;
  }
}

let leafletAssetsPromise: Promise<any> | null = null;

const loadLeafletAssets = async () => {
  if (typeof window === 'undefined') return null;
  if (window.L) return window.L;

  if (!leafletAssetsPromise) {
    leafletAssetsPromise = new Promise((resolve, reject) => {
      const cssId = 'leaflet-cdn-css';
      if (!document.getElementById(cssId)) {
        const link = document.createElement('link');
        link.id = cssId;
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      const existing = document.getElementById('leaflet-cdn-js') as HTMLScriptElement | null;
      if (existing) {
        if (window.L) {
          resolve(window.L);
          return;
        }
        existing.addEventListener('load', () => resolve(window.L));
        existing.addEventListener('error', () => reject(new Error('Failed to load Leaflet script')));
        return;
      }

      const script = document.createElement('script');
      script.id = 'leaflet-cdn-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = () => resolve(window.L);
      script.onerror = () => reject(new Error('Failed to load Leaflet script'));
      document.body.appendChild(script);
    });
  }

  return leafletAssetsPromise;
};



// Helper functions for Traccar unit conversions
const convertDistance = (meters: number) => meters / 1000; // meters to km
const convertSpeed = (knots: number) => knots * 1.852; // knots to km/h
const formatDuration = (milliseconds: number) => {
  const totalMinutes = Math.floor(milliseconds / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
};

// Convert UTC to UTC+3 (Amman timezone)
const convertToUTC3 = (utcDateString: string): string => {
  const date = new Date(utcDateString);
  if (isNaN(date.getTime())) return 'Unknown';
  
  // Use toLocaleString with Asia/Amman timezone to properly convert
  return date.toLocaleString('en-US', { timeZone: 'Asia/Amman' });
};

// Convert UTC to UTC+3 and split into date and time
const convertToUTC3Split = (utcDateString: string): { date: string; time: string } => {
  const dateObj = new Date(utcDateString);
  if (isNaN(dateObj.getTime())) return { date: 'Unknown', time: '' };
  
  // Use toLocaleString with Asia/Amman timezone
  const fullString = dateObj.toLocaleString('en-US', { timeZone: 'Asia/Amman' });
  const [date, time] = fullString.split(', ');
  
  return { date, time };
};

// Format speed with limit as "120/100"
const formatSpeedWithLimit = (speed: number, limit?: number): string => {
  const speedKmh = Math.round(convertSpeed(speed));
  if (limit) {
    const limitKmh = Math.round(convertSpeed(limit));
    return `${speedKmh}/${limitKmh}`;
  }
  return `${speedKmh}`;
};

// Convert values shown in Amman time to UTC ISO for Traccar positions API
const getTimeZoneOffsetMillis = (date: Date, timeZone: string): number => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const values: Record<string, number> = {};

  parts.forEach((part) => {
    if (part.type !== 'literal') {
      values[part.type] = parseInt(part.value, 10);
    }
  });

  const asUTC = Date.UTC(
    values.year,
    (values.month || 1) - 1,
    values.day || 1,
    values.hour || 0,
    values.minute || 0,
    values.second || 0
  );

  return asUTC - date.getTime();
};

const parseAmmanDateTimeParts = (value: string): Date | null => {
  const trimmed = value.trim();

  if (!trimmed) return null;

  const nativeParsed = new Date(trimmed);
  if (!isNaN(nativeParsed.getTime()) && /(Z|[+-]\d{2}:?\d{2})$/i.test(trimmed)) {
    return nativeParsed;
  }

  const isoLocalMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (isoLocalMatch) {
    const [, y, m, d, hh, mm, ss] = isoLocalMatch;
    const utcGuess = Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss || '0'));
    const firstOffset = getTimeZoneOffsetMillis(new Date(utcGuess), 'Asia/Amman');
    const correctedUtc = utcGuess - firstOffset;
    const secondOffset = getTimeZoneOffsetMillis(new Date(correctedUtc), 'Asia/Amman');
    return new Date(utcGuess - secondOffset);
  }

  const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (usMatch) {
    let [, month, day, year, hour, minute, second, meridiem] = usMatch;
    let h = Number(hour);

    if (meridiem) {
      const upper = meridiem.toUpperCase();
      if (upper === 'PM' && h < 12) h += 12;
      if (upper === 'AM' && h === 12) h = 0;
    }

    const utcGuess = Date.UTC(Number(year), Number(month) - 1, Number(day), h, Number(minute), Number(second || '0'));
    const firstOffset = getTimeZoneOffsetMillis(new Date(utcGuess), 'Asia/Amman');
    const correctedUtc = utcGuess - firstOffset;
    const secondOffset = getTimeZoneOffsetMillis(new Date(correctedUtc), 'Asia/Amman');
    return new Date(utcGuess - secondOffset);
  }

  return isNaN(nativeParsed.getTime()) ? null : nativeParsed;
};

const convertAmmanLocalToUtcIso = (value: string): string => {
  const parsed = parseAmmanDateTimeParts(value);
  return parsed && !isNaN(parsed.getTime()) ? parsed.toISOString() : value;
};

interface TripPositionPoint extends Position {
  latitude: number;
  longitude: number;
  course?: number;
  speed?: number;
  fixTime?: string;
  address?: string;
  displayCourse?: number;
}

const normalizeTripPosition = (position: any): TripPositionPoint | null => {
  const latitude = Number(position?.latitude ?? position?.lat);
  const longitude = Number(position?.longitude ?? position?.lon ?? position?.lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const normalizedCourse = Number(position?.course ?? position?.attributes?.course ?? position?.attributes?.bearing);
  const normalizedSpeed = Number(position?.speed ?? position?.attributes?.speed);

  return {
    ...position,
    latitude,
    longitude,
    course: Number.isFinite(normalizedCourse) ? normalizedCourse : undefined,
    speed: Number.isFinite(normalizedSpeed) ? normalizedSpeed : undefined,
    fixTime: position?.fixTime ?? position?.deviceTime ?? position?.serverTime ?? position?.eventTime,
    address: position?.address ?? position?.attributes?.address,
  };
};

const calculateBearing = (fromLat: number, fromLon: number, toLat: number, toLon: number): number => {
  const toRad = (value: number) => value * Math.PI / 180;
  const toDeg = (value: number) => value * 180 / Math.PI;

  const lat1 = toRad(fromLat);
  const lat2 = toRad(toLat);
  const dLon = toRad(toLon - fromLon);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
};

const enrichTripPositions = (positions: TripPositionPoint[]): TripPositionPoint[] => {
  if (positions.length <= 1) return positions;

  return positions.map((position, index) => {
    const prev = positions[Math.max(0, index - 1)];
    const next = positions[Math.min(positions.length - 1, index + 1)];

    let displayCourse: number | undefined;

    if (index > 0 && index < positions.length - 1) {
      displayCourse = calculateBearing(prev.latitude, prev.longitude, next.latitude, next.longitude);
    } else if (index < positions.length - 1) {
      displayCourse = calculateBearing(position.latitude, position.longitude, next.latitude, next.longitude);
    } else if (index > 0) {
      displayCourse = calculateBearing(prev.latitude, prev.longitude, position.latitude, position.longitude);
    }

    return {
      ...position,
      displayCourse: Number.isFinite(displayCourse as number)
        ? displayCourse
        : (Number.isFinite(position.course as number) ? position.course : undefined),
    };
  });
};

const buildArrowHtml = (course = 0, active = false) => `
  <div style="
    width:${active ? 24 : 18}px;
    height:${active ? 24 : 18}px;
    display:flex;
    align-items:center;
    justify-content:center;
    transform: rotate(${course}deg);
    transform-origin: center center;
    filter: drop-shadow(0 0 2px rgba(255,255,255,0.95));
  ">
    <svg width="${active ? 24 : 18}" height="${active ? 24 : 18}" viewBox="0 0 24 24" style="display:block; overflow:visible;">
      <path d="M12 2 L18 20 L12 16 L6 20 Z" fill="${'#ffffff'}" opacity="0.9"></path>
      <path d="M12 3 L17 19 L12 15.5 L7 19 Z" fill="${active ? '#2563eb' : '#dc2626'}"></path>
    </svg>
  </div>
`;

function LeafletTripMap({
  positions,
  playbackIndex,
  onSelectPosition,
  mapLayer,
}: {
  positions: TripPositionPoint[];
  playbackIndex: number;
  onSelectPosition: (index: number) => void;
  mapLayer: "osm" | "esri";
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);

  const fullRouteRef = useRef<any>(null);
  const playedRouteRef = useRef<any>(null);
  const currentMarkerRef = useRef<any>(null);
  const startMarkerRef = useRef<any>(null);
  const endMarkerRef = useRef<any>(null);
  const arrowMarkersRef = useRef<any[]>([]);
  const tileLayerRef = useRef<any>(null);

  // create map once
  useEffect(() => {
    let cancelled = false;

    const initMap = async () => {
      if (!containerRef.current || !positions.length) return;

      const L = await loadLeafletAssets();
      if (!L || cancelled || !containerRef.current) return;

      if (!mapRef.current) {
  const firstPoint = positions[0];

  mapRef.current = L.map(containerRef.current, {
    zoomControl: false,
    attributionControl: true,
    center: [firstPoint.latitude, firstPoint.longitude],
    zoom: 15,
  });

  L.control.zoom({ position: "bottomright" }).addTo(mapRef.current);

  // Add default basemap immediately on first open
  tileLayerRef.current = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution: "&copy; OpenStreetMap contributors",
    }
  ).addTo(mapRef.current);
}

      setTimeout(() => {
        mapRef.current?.invalidateSize();
      }, 0);
    };

    initMap();

    return () => {
      cancelled = true;
    };
  }, [positions]);

  // change basemap only when mapLayer changes
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
        }
      ).addTo(mapRef.current);
    } else {
      tileLayerRef.current = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          attribution: "&copy; OpenStreetMap contributors",
        }
      ).addTo(mapRef.current);
    }
  }, [mapLayer]);

  // draw static route layers only when positions change
  useEffect(() => {
    const L = window.L;
    if (!L || !mapRef.current || !positions.length) return;

    const map = mapRef.current;

    if (fullRouteRef.current) map.removeLayer(fullRouteRef.current);
    if (playedRouteRef.current) map.removeLayer(playedRouteRef.current);
    if (currentMarkerRef.current) map.removeLayer(currentMarkerRef.current);
    if (startMarkerRef.current) map.removeLayer(startMarkerRef.current);
    if (endMarkerRef.current) map.removeLayer(endMarkerRef.current);

    arrowMarkersRef.current.forEach((m) => {
      try {
        map.removeLayer(m);
      } catch {}
    });
    arrowMarkersRef.current = [];

    const latlngs = positions.map((p) => [p.latitude, p.longitude]);

    fullRouteRef.current = L.polyline(latlngs, {
      color: "#F5F227",
      weight: 6,
      opacity: 0.85,
    }).addTo(map);

    playedRouteRef.current = L.polyline(latlngs.slice(0, playbackIndex + 1), {
      color: "#2563eb",
      weight: 5,
      opacity: 1,
    }).addTo(map);

    const arrowStep = Math.max(8, Math.floor(positions.length / 20));

    positions.forEach((position, index) => {
      if (!(index % arrowStep === 0 || index === positions.length - 1)) return;

      const marker = L.marker([position.latitude, position.longitude], {
        icon: L.divIcon({
          className: "trip-arrow-icon",
          html: buildArrowHtml(position.displayCourse ?? position.course ?? 0, false),
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        }),
      }).addTo(map);

      marker.on("click", () => onSelectPosition(index));
      arrowMarkersRef.current.push(marker);
    });

    startMarkerRef.current = L.circleMarker(
      [positions[0].latitude, positions[0].longitude],
      {
        radius: 6,
        color: "#16a34a",
        fillColor: "#16a34a",
        fillOpacity: 1,
      }
    ).addTo(map);

    startMarkerRef.current.on("click", () => onSelectPosition(0));

    endMarkerRef.current = L.circleMarker(
      [positions[positions.length - 1].latitude, positions[positions.length - 1].longitude],
      {
        radius: 6,
        color: "#dc2626",
        fillColor: "#dc2626",
        fillOpacity: 1,
      }
    ).addTo(map);

    endMarkerRef.current.on("click", () => onSelectPosition(positions.length - 1));

    const currentPosition = positions[Math.min(playbackIndex, positions.length - 1)];
    if (currentPosition) {
      currentMarkerRef.current = L.marker([currentPosition.latitude, currentPosition.longitude], {
        icon: L.divIcon({
          className: "trip-arrow-icon-active",
          html: buildArrowHtml(currentPosition.displayCourse ?? currentPosition.course ?? 0, true),
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
      }).addTo(map);

      currentMarkerRef.current.on("click", () =>
        onSelectPosition(Math.min(playbackIndex, positions.length - 1))
      );
    }
  }, [positions, onSelectPosition]);

  // playback update only
  useEffect(() => {
    const L = window.L;
    if (!L || !mapRef.current || !positions.length) return;

    const currentIndex = Math.min(playbackIndex, positions.length - 1);
    const currentPosition = positions[currentIndex];

    if (playedRouteRef.current) {
      const playedLatLngs = positions
        .slice(0, currentIndex + 1)
        .map((p) => [p.latitude, p.longitude]);
      playedRouteRef.current.setLatLngs(playedLatLngs);
    }

    if (currentMarkerRef.current && currentPosition) {
      const latLng: [number, number] = [currentPosition.latitude, currentPosition.longitude];

      currentMarkerRef.current.setLatLng(latLng);
      currentMarkerRef.current.setIcon(
        L.divIcon({
          className: "trip-arrow-icon-active",
          html: buildArrowHtml(currentPosition.displayCourse ?? currentPosition.course ?? 0, true),
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        })
      );

      mapRef.current.panTo(latLng, { animate: true, duration: 0.5 });
    }
  }, [playbackIndex, positions]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      fullRouteRef.current = null;
      playedRouteRef.current = null;
      currentMarkerRef.current = null;
      startMarkerRef.current = null;
      endMarkerRef.current = null;
      arrowMarkersRef.current = [];
      tileLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
  if (!mapRef.current) return;

  const timer = setTimeout(() => {
    mapRef.current.invalidateSize();
  }, 200);

  return () => clearTimeout(timer);
}, [positions]);

  return <div ref={containerRef} className="h-full w-full" />;
}
// Helper function for numeric comparison
const compareNumbers = (value: number, filterValue: string, operator: string): boolean => {
  if (!filterValue) return true;
  const numFilter = parseFloat(filterValue);
  if (isNaN(numFilter)) return true;
  
  switch (operator) {
    case '=': return value === numFilter;
    case '>': return value > numFilter;
    case '<': return value < numFilter;
    case '>=': return value >= numFilter;
    case '<=': return value <= numFilter;
    case 'contains': return value.toString().includes(filterValue);
    default: return true;
  }
};

// Parse duration string "2h 30m" to minutes
const parseDurationToMinutes = (durationStr: string): number => {
  const hoursMatch = durationStr.match(/(\d+)h/);
  const minutesMatch = durationStr.match(/(\d+)m/);
  const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
  const minutes = minutesMatch ? parseInt(minutesMatch[1]) : 0;
  return hours * 60 + minutes;
};

// Visit type for geofence visits report
interface Visit {
  id: string;
  deviceId: number;
  deviceName: string;
  geofenceName: string;
  enterTime: string;
  exitTime: string | null;
  duration: number;
  }

// Extended Event with position data
interface ExtendedEvent extends Event {
  position?: Position;
}

// Get event display name
const getEventDisplayName = (event: Event): string => {
  if (event.type === 'alarm' && event.attributes?.alarm) {
    return event.attributes.alarm;
  }
  return event.type.replace(/([A-Z])/g, " $1").trim();
};

// Get geofence name from event
const getGeofenceName = (
  event: Event,
  geofenceMap?: Record<number, string>
): string | null => {
  if (event.type !== 'geofenceEnter' && event.type !== 'geofenceExit') {
    return null;
  }

  const geofenceId = event.geofenceId;
  if (!geofenceId) return null;

  return (
    event.attributes?.geofenceName ||
    geofenceMap?.[Number(geofenceId)] ||
    `Geofence ${geofenceId}`
  );
};

// Get icon and color for event type
const getEventIcon = (eventType: string, alarm?: string) => {
  switch (eventType) {
    case 'geofenceEnter':
      return { icon: LogIn, color: 'text-green-600', bg: 'bg-green-100' };
    case 'geofenceExit':
      return { icon: LogOut, color: 'text-red-600', bg: 'bg-red-100' };
    case 'alarm':
      return { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100' };
    case 'deviceOverspeed':
      return { icon: Gauge, color: 'text-orange-600', bg: 'bg-orange-100' };
    case 'deviceMoving':
      return { icon: Play, color: 'text-blue-600', bg: 'bg-blue-100' };
    case 'deviceStopped':
      return { icon: Square, color: 'text-gray-600', bg: 'bg-gray-100' };
    case 'ignitionOn':
      return { icon: Power, color: 'text-green-600', bg: 'bg-green-100' };
    case 'ignitionOff':
      return { icon: PowerOff, color: 'text-red-600', bg: 'bg-red-100' };
    default:
      return { icon: AlertTriangle, color: 'text-gray-600', bg: 'bg-gray-100' };
  }
};

export function Reports() {

  useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  const country = params.get("country");
  const serverUrl = "https://go.bazytrack."+country;

  if (!token) return;

  let existingSession = {};

  try {
    const stored = localStorage.getItem("traccar_session");
    existingSession = stored ? JSON.parse(stored) : {};
  } catch {
    existingSession = {};
  }

  localStorage.setItem(
    "traccar_session",
    JSON.stringify({
      ...existingSession,
      token,
      serverUrl,
    })
  );

  window.history.replaceState({}, document.title, window.location.pathname);
}, []);
  
  const [devices,setDevices] = useState<Device[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [allEvents, setAllEvents] = useState<ExtendedEvent[]>([]);
  const [mapLayer, setMapLayer] = useState<"osm" | "esri">("osm");
  const [visits, setVisits] = useState<Visit[]>([]);
  const [geofences, setGeofences] = useState<Array<{ id: number; name: string }>>([]);
  const [geofenceMap, setGeofenceMap] = useState<Record<number, string>>({});
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [vehicleSearch, setVehicleSearch] = useState<string>("");
  const [vehicleDropdownOpen, setVehicleDropdownOpen] = useState(false);
  const [dateRange, setDateRange] = useState<string>("today");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [eventTypeFilters, setEventTypeFilters] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("trips");

  // Dynamic filter system
  interface DynamicFilter {
    id: string;
    column: string;
    operator: 'contains' | '=' | '>' | '<' | '>=' | '<=';
    value: string;
  }

  const [tripDynamicFilters, setTripDynamicFilters] = useState<DynamicFilter[]>([]);
  const [eventDynamicFilters, setEventDynamicFilters] = useState<DynamicFilter[]>([]);
  const [visitDynamicFilters, setVisitDynamicFilters] = useState<DynamicFilter[]>([]);
  const [showTripFilters, setShowTripFilters] = useState(false);
  const [showEventFilters, setShowEventFilters] = useState(false);
  const [showVisitFilters, setShowVisitFilters] = useState(false);
  const [selectedTripForMap, setSelectedTripForMap] = useState<Trip | null>(null);
  const [tripPositions, setTripPositions] = useState<TripPositionPoint[]>([]);
  const [tripPositionsLoading, setTripPositionsLoading] = useState(false);
  const [tripPositionsError, setTripPositionsError] = useState<string>('');
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [selectedInfoIndex, setSelectedInfoIndex] = useState(0);
  const [isPlayingTrip, setIsPlayingTrip] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState('1');
  const vehicleDropdownRef = useRef<HTMLDivElement | null>(null);
  const [selectedVisitGeofences, setSelectedVisitGeofences] = useState<string[]>([]); // stores geofence ids as strings
  const [visitGeofenceSearch, setVisitGeofenceSearch] = useState("");
  const [visitGeofenceDropdownOpen, setVisitGeofenceDropdownOpen] = useState(false);
  const visitGeofenceDropdownRef = useRef<HTMLDivElement | null>(null);
  type TripSortColumn =
  | 'device'
  | 'startTime'
  | 'from'
  | 'endTime'
  | 'to'
  | 'distance'
  | 'duration'
  | 'maxSpeed';

const [tripSort, setTripSort] = useState<{
  column: TripSortColumn;
  direction: SortDirection;
}>({
  column: 'startTime',
  direction: 'desc',
});

const handleTripSort = (column: TripSortColumn) => {
  setTripSort((prev) => {
    if (prev.column === column) {
      return {
        column,
        direction: prev.direction === 'asc' ? 'desc' : 'asc',
      };
    }

    return {
      column,
      direction: 'asc',
    };
  });
};
  type VisitSortColumn = 'device' | 'geofenceName' | 'enterTime' | 'exitTime' | 'duration';
  type SortDirection = 'asc' | 'desc';
  
  const [visitSort, setVisitSort] = useState<{
    column: VisitSortColumn;
    direction: SortDirection;
  }>({
    column: 'enterTime',
    direction: 'desc',
  });

  


  useEffect(() => {
  if (!isPlayingTrip || tripPositions.length <= 1) return;

  const speedValue = Number(playbackSpeed) || 1;
  const step = Math.max(1, Math.floor(speedValue));

  const interval = window.setInterval(() => {
    setPlaybackIndex((current) => {
      const next = current + step;
      if (next >= tripPositions.length - 1) {
        setIsPlayingTrip(false);
        return tripPositions.length - 1;
      }
      return next;
    });
  }, 80);

  return () => window.clearInterval(interval);
}, [isPlayingTrip, tripPositions.length, playbackSpeed]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (vehicleDropdownRef.current && !vehicleDropdownRef.current.contains(event.target as Node)) {
        setVehicleDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        visitGeofenceDropdownRef.current &&
        !visitGeofenceDropdownRef.current.contains(event.target as Node)
      ) {
        setVisitGeofenceDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (playbackIndex >= tripPositions.length - 1 && tripPositions.length > 0) {
      setIsPlayingTrip(false);
    }
    if (tripPositions.length > 0) {
      setSelectedInfoIndex(Math.min(playbackIndex, tripPositions.length - 1));
    }
  }, [playbackIndex, tripPositions]);

  const closeTripMapDialog = () => {
    setSelectedTripForMap(null);
    setTripPositions([]);
    setTripPositionsError('');
    setTripPositionsLoading(false);
    setPlaybackIndex(0);
    setSelectedInfoIndex(0);
    setIsPlayingTrip(false);
  };

  const handleVisitSort = (column: VisitSortColumn) => {
    setVisitSort((prev) => {
      if (prev.column === column) {
        return {
          column,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        };
      }
  
      return {
        column,
        direction: 'asc',
      };
    });
  };

  const openTripMapDialog = async (trip: Trip) => {
    setSelectedTripForMap(trip);
    setTripPositions([]);
    setTripPositionsError('');
    setTripPositionsLoading(true);
    setPlaybackIndex(0);
    setIsPlayingTrip(false);

    try {
      const apiAny = api as any;
      if (typeof apiAny.getTripPositions !== 'function') {
        throw new Error('Trip positions API method was not found on api service.');
      }

      const from = convertAmmanLocalToUtcIso(trip.startTime);
      const to = convertAmmanLocalToUtcIso(trip.endTime);
      const deviceId = (trip as any).deviceId;

      if (deviceId == null || Number.isNaN(deviceId)) {
        throw new Error('Trip deviceId is missing.');
      }

      const rawPositions = await apiAny.getTripPositions(deviceId, from, to);
      const positionList = Array.isArray(rawPositions)
        ? rawPositions
        : Array.isArray(rawPositions?.data)
          ? rawPositions.data
          : Array.isArray(rawPositions?.positions)
            ? rawPositions.positions
            : [];

      const normalizedPositions = enrichTripPositions(
        positionList
          .map(normalizeTripPosition)
          .filter((position): position is TripPositionPoint => position !== null)
          .sort((a, b) => new Date(a.fixTime || '').getTime() - new Date(b.fixTime || '').getTime())
      );

      setTripPositions(normalizedPositions);
      setSelectedInfoIndex(0);

      if (normalizedPositions.length === 0) {
        setTripPositionsError('No positions were returned for this trip.');
      }
    } catch (error) {
      console.error('Failed to load trip positions:', error);
      setTripPositionsError(error instanceof Error ? error.message : 'Failed to load trip positions.');
    } finally {
      setTripPositionsLoading(false);
    }
  };

  // Column definitions for each report type
  const tripColumns = [
    { key: 'device', value: 'device', label: 'Device', type: 'text' },
    { key: 'startTime', value: 'startTime', label: 'Start Time', type: 'text' },
    { key: 'from', value: 'from', label: 'From', type: 'text' },
    { key: 'endTime', value: 'endTime', label: 'End Time', type: 'text' },
    { key: 'to', value: 'to', label: 'To', type: 'text' },
    { key: 'distance', value: 'distance', label: 'Distance (km)', type: 'number' },
    { key: 'duration', value: 'duration', label: 'Duration (minutes)', type: 'number' },
    { key: 'maxSpeed', value: 'maxSpeed', label: 'Max Speed (km/h)', type: 'number' },
  ];

  const eventColumns = [
    { key: 'device', value: 'device', label: 'Device', type: 'text' },
    { key: 'eventType', value: 'eventType', label: 'Event Type', type: 'text' },
    { key: 'eventTime', value: 'eventTime', label: 'Event Time', type: 'text' },
    { key: 'speed', value: 'speed', label: 'Speed (km/h)', type: 'number' },
    { key: 'geofence', value: 'geofence', label: 'Geofence', type: 'text' },
    { key: 'address', value: 'address', label: 'Address', type: 'text' },
  ];

  const visitColumns = [
    { key: 'device', value: 'device', label: 'Device', type: 'text' },
    { key: 'geofenceName', value: 'geofenceName', label: 'Geofence Name', type: 'text' },
    { key: 'enterTime', value: 'enterTime', label: 'Enter Time', type: 'text' },
    { key: 'exitTime', value: 'exitTime', label: 'Exit Time', type: 'text' },
    { key: 'duration', value: 'duration', label: 'Duration (minutes)', type: 'number' },

  ];

  // Add new filter
  const addFilter = (type: 'trip' | 'event' | 'visit') => {
    const newFilter: DynamicFilter = {
      id: `filter-${Date.now()}`,
      column: type === 'trip' ? 'device' : type === 'event' ? 'device' : 'device',
      operator: 'contains',
      value: ''
    };

    if (type === 'trip') {
      setTripDynamicFilters([...tripDynamicFilters, newFilter]);
    } else if (type === 'event') {
      setEventDynamicFilters([...eventDynamicFilters, newFilter]);
    } else {
      setVisitDynamicFilters([...visitDynamicFilters, newFilter]);
    }
  };

  // Remove filter
  const removeFilter = (type: 'trip' | 'event' | 'visit', id: string) => {
    if (type === 'trip') {
      setTripDynamicFilters(tripDynamicFilters.filter(f => f.id !== id));
    } else if (type === 'event') {
      setEventDynamicFilters(eventDynamicFilters.filter(f => f.id !== id));
    } else {
      setVisitDynamicFilters(visitDynamicFilters.filter(f => f.id !== id));
    }
  };

  // Update filter
  const updateFilter = (type: 'trip' | 'event' | 'visit', id: string, field: keyof DynamicFilter, value: string) => {
    const updateFn = (filters: DynamicFilter[]) =>
      filters.map(f => f.id === id ? { ...f, [field]: value } : f);

    if (type === 'trip') {
      setTripDynamicFilters(updateFn(tripDynamicFilters));
    } else if (type === 'event') {
      setEventDynamicFilters(updateFn(eventDynamicFilters));
    } else {
      setVisitDynamicFilters(updateFn(visitDynamicFilters));
    }
  };

  // Clear all filters
  const clearAllFilters = (type: 'trip' | 'event' | 'visit') => {
    if (type === 'trip') {
      setTripDynamicFilters([]);
    } else if (type === 'event') {
      setEventDynamicFilters([]);
    } else {
      setVisitDynamicFilters([]);
    }
  };

  const eventTypes = [
    { value: 'geofenceEnter', label: 'Geofence Enter' },
    { value: 'geofenceExit', label: 'Geofence Exit' },
    { value: 'alarm', label: 'Alarm' },
    { value: 'deviceOverspeed', label: 'Overspeed' },
    { value: 'deviceMoving', label: 'Device Moving' },
    { value: 'deviceStopped', label: 'Device Stopped' },
    { value: 'ignitionOn', label: 'Ignition On' },
    { value: 'ignitionOff', label: 'Ignition Off' },
  ];

  const loadGeofences = async () => {
  try {
    const geofenceList = await api.getGeofences();
    const normalizedGeofences = (geofenceList || [])
      .filter((g: any) => g?.id != null)
      .map((g: any) => ({
        id: Number(g.id),
        name: g.name || `Geofence ${g.id}`,
      }));

    const map: Record<number, string> = {};
    normalizedGeofences.forEach((g) => {
      map[g.id] = g.name;
    });

    setGeofences(normalizedGeofences);
    setGeofenceMap(map);
  } catch (error) {
    console.error("Failed to load geofences:", error);
    setGeofences([]);
    setGeofenceMap({});
  }
};
  // Load devices only on mount
  
useEffect(() => {
  loadDevices();
  loadGeofences();
}, []);

  const loadDevices = async () => {
    try {
      const devicesData = await api.getDevices();
      setDevices(devicesData);
    } catch (error) {
      console.error("Failed to load devices:", error);
    }
  };

  const toggleSelectedDevice = (deviceId: string) => {
    setSelectedDevices((prev) =>
      prev.includes(deviceId)
        ? prev.filter((id) => id !== deviceId)
        : [...prev, deviceId]
    );
  };

  const clearSelectedDevices = () => {
    setSelectedDevices([]);
  };

  const getSelectedDeviceIds = (): number[] | undefined => {
    if (selectedDevices.length === 0) return undefined;
    return selectedDevices
      .map((id) => parseInt(id, 10))
      .filter((id) => !Number.isNaN(id));
  };

  // Calculate date range based on selection (UI in Amman time, API in UTC ISO)
  const getDateRange = (): { from: string; to: string } => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();

    let fromDate: Date;
    let toDate: Date;

    switch (dateRange) {
      case 'today':
        fromDate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
        fromDate.setUTCHours(fromDate.getUTCHours() - 3);

        toDate = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
        toDate.setUTCHours(toDate.getUTCHours() - 3);
        return { from: fromDate.toISOString(), to: toDate.toISOString() };

      case 'yesterday':
        fromDate = new Date(Date.UTC(year, month, day - 1, 0, 0, 0, 0));
        fromDate.setUTCHours(fromDate.getUTCHours() - 3);

        toDate = new Date(Date.UTC(year, month, day - 1, 23, 59, 59, 999));
        toDate.setUTCHours(toDate.getUTCHours() - 3);
        return { from: fromDate.toISOString(), to: toDate.toISOString() };

      case '7days':
        fromDate = new Date(Date.UTC(year, month, day - 7, 0, 0, 0, 0));
        fromDate.setUTCHours(fromDate.getUTCHours() - 3);

        toDate = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
        toDate.setUTCHours(toDate.getUTCHours() - 3);
        return { from: fromDate.toISOString(), to: toDate.toISOString() };

      case '30days':
        fromDate = new Date(Date.UTC(year, month, day - 30, 0, 0, 0, 0));
        fromDate.setUTCHours(fromDate.getUTCHours() - 3);

        toDate = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
        toDate.setUTCHours(toDate.getUTCHours() - 3);
        return { from: fromDate.toISOString(), to: toDate.toISOString() };

      case 'custom':
        return {
          from: customFrom ? convertAmmanLocalToUtcIso(customFrom) : new Date().toISOString(),
          to: customTo ? convertAmmanLocalToUtcIso(customTo) : new Date().toISOString(),
        };

      default:
        fromDate = new Date(Date.UTC(year, month, day - 7, 0, 0, 0, 0));
        fromDate.setUTCHours(fromDate.getUTCHours() - 3);

        toDate = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
        toDate.setUTCHours(toDate.getUTCHours() - 3);
        return { from: fromDate.toISOString(), to: toDate.toISOString() };
    }
  };

  const enrichEventsWithPositions = async (events: Event[]): Promise<ExtendedEvent[]> => {
  const positionIds = Array.from(
    new Set(
      events
        .map((event: any) => event.positionId)
        .filter((id): id is number => typeof id === "number" && !Number.isNaN(id))
    )
  );

  if (positionIds.length === 0) {
    return events as ExtendedEvent[];
  }

  const positions = await (api as any).getPositionsByIds(positionIds);

  const positionMap = new Map<number, Position>();
  positions.forEach((position: any) => {
    if (position?.id != null) {
      positionMap.set(Number(position.id), position);
    }
  });

  return events.map((event: any) => ({
    ...event,
    position: event.positionId ? positionMap.get(Number(event.positionId)) : undefined,
  }));
};

  // Manual refresh function - only load data for active tab
  const loadData = async () => {
    if (dateRange === 'custom' && (!customFrom || !customTo)) {
      alert('Please select both From and To date/time in Amman time.');
      return;
    }

    setLoading(true);
    try {
      const deviceIds =
  selectedDevices.length === 0
    ? undefined
    : selectedDevices.map((id) => parseInt(id, 10));
      
      const { from, to } = getDateRange();
      
      // Only load data based on active tab
      if (activeTab === 'trips') {
        console.log('Loading trips data only...');
        const tripsData = await (api as any).getTrips(deviceIds, from, to);
        setTrips(tripsData);
      } else if (activeTab === 'events') {
        console.log('Loading events data only...');
        // Pass event type filters to API for server-side filtering
        const typesToFetch = eventTypeFilters.length > 0 ? eventTypeFilters : undefined;
        const eventsData = await (api as any).getEvents(deviceIds, from, to, typesToFetch);
        
        console.log('📊 Events loaded:', eventsData.length);
        console.log('📊 Sample event structure:', eventsData[0]);
        const enrichedEvents = await enrichEventsWithPositions(eventsData);
        
        // Events already contain address data - no need to fetch positions separately
        setAllEvents(enrichedEvents);
     } else if (activeTab === 'visits') {
        console.log('Loading geofence visits report from backend...');

        const geofenceIds =
          selectedVisitGeofences.length === 0
            ? undefined
            : selectedVisitGeofences
                .map((id) => parseInt(id, 10))
                .filter((id) => !Number.isNaN(id));

        const visitsData = await (api as any).getGeofenceVisitsReport({
          deviceIds,
          geofenceIds,
          from,
          to,
        });

        setVisits(Array.isArray(visitsData) ? visitsData : []);
} else if (activeTab === 'summary') {
        console.log('Loading all data for summary...');
        const [tripsData, eventsData] = await Promise.all([
          (api as any).getTrips(deviceIds, from, to),
          (api as any).getEvents(deviceIds, from, to),
        ]);
        setTrips(tripsData);
        setAllEvents(eventsData);
      }
    } catch (error) {
      console.error("Failed to load reports:", error);
    } finally {
      setLoading(false);
    }
  };

  // Process visits from enter/exit events
 const processVisitsFromEvents = (
  events: ExtendedEvent[],
  geofenceMap: Record<number, string>
): Visit[] => {
  const visits: Visit[] = [];
  const enterEvents = events.filter(e => e.type === 'geofenceEnter');
  const exitEvents = events.filter(e => e.type === 'geofenceExit');

  enterEvents.forEach(enterEvent => {
    const geofenceId = enterEvent.geofenceId;

    const geofenceName =
      getGeofenceName(enterEvent, geofenceMap) ||
      (geofenceId ? `Geofence ${geofenceId}` : 'Unknown Geofence');

    const exitEvent = exitEvents.find(e =>
      e.deviceId === enterEvent.deviceId &&
      e.geofenceId === geofenceId &&
      new Date(e.eventTime) > new Date(enterEvent.eventTime)
    );

    const enterTime = new Date(enterEvent.eventTime);
    const exitTime = exitEvent ? new Date(exitEvent.eventTime) : null;
    const duration = exitTime ? exitTime.getTime() - enterTime.getTime() : 0;



    visits.push({
      id: `visit-${enterEvent.id}`,
      deviceId: enterEvent.deviceId,
      deviceName: enterEvent.deviceName,
      geofenceName,
      enterTime: enterEvent.eventTime,
      exitTime: exitEvent?.eventTime || null,
      duration,
    });
  });

  return visits.sort(
    (a, b) => new Date(b.enterTime).getTime() - new Date(a.enterTime).getTime()
  );
};

  // Filter events based on selected types
  const filteredEvents = eventTypeFilters.length === 0
    ? allEvents
    : allEvents.filter(event => eventTypeFilters.includes(event.type));

  // Apply dynamic filters to trips
  const filteredTrips = trips.filter(trip => {
    if (tripDynamicFilters.length === 0) return true;
    
    return tripDynamicFilters.every(filter => {
      let value: string | number = '';
      
      switch (filter.column) {
        case 'device':
          value = trip.deviceName.toLowerCase();
          break;
        case 'startTime':
          value = convertToUTC3(trip.startTime).toLowerCase();
          break;
        case 'from':
          value = trip.startAddress.toLowerCase();
          break;
        case 'endTime':
          value = convertToUTC3(trip.endTime).toLowerCase();
          break;
        case 'to':
          value = trip.endAddress.toLowerCase();
          break;
        case 'distance':
          value = convertDistance(trip.distance);
          return compareNumbers(value, filter.value, filter.operator);
        case 'duration':
          value = parseDurationToMinutes(formatDuration(trip.duration));
          return compareNumbers(value, filter.value, filter.operator);
        case 'maxSpeed':
          value = convertSpeed(trip.maxSpeed);
          return compareNumbers(value, filter.value, filter.operator);
        default:
          return true;
      }
      
      if (typeof value === 'string') {
        return value.includes(filter.value.toLowerCase());
      }
      return true;
    });
  });

  const sortedTrips = useMemo(() => {
  const sorted = [...filteredTrips];

  sorted.sort((a, b) => {
    let aValue: string | number = '';
    let bValue: string | number = '';

    switch (tripSort.column) {
      case 'device':
        aValue = a.deviceName.toLowerCase();
        bValue = b.deviceName.toLowerCase();
        break;
      case 'startTime':
        aValue = new Date(a.startTime).getTime();
        bValue = new Date(b.startTime).getTime();
        break;
      case 'from':
        aValue = a.startAddress.toLowerCase();
        bValue = b.startAddress.toLowerCase();
        break;
      case 'endTime':
        aValue = new Date(a.endTime).getTime();
        bValue = new Date(b.endTime).getTime();
        break;
      case 'to':
        aValue = a.endAddress.toLowerCase();
        bValue = b.endAddress.toLowerCase();
        break;
      case 'distance':
        aValue = convertDistance(a.distance);
        bValue = convertDistance(b.distance);
        break;
      case 'duration':
        aValue = a.duration;
        bValue = b.duration;
        break;
      case 'maxSpeed':
        aValue = convertSpeed(a.maxSpeed);
        bValue = convertSpeed(b.maxSpeed);
        break;
    }

    if (aValue < bValue) return tripSort.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return tripSort.direction === 'asc' ? 1 : -1;
    return 0;
  });

  return sorted;
}, [filteredTrips, tripSort]);
  
  // Apply dynamic filters to events
  const filteredEventsWithColumns = filteredEvents.filter(event => {
    if (eventDynamicFilters.length === 0) return true;
    
    return eventDynamicFilters.every(filter => {
      let value: string | number = '';
      
      const speed = event.position?.speed;
      const address = event.position?.address || '';
      const geofence = getGeofenceName(event, geofenceMap) || '';
      const eventTime = convertToUTC3(event.eventTime);
      
      switch (filter.column) {
        case 'device':
          value = event.deviceName.toLowerCase();
          break;
        case 'eventType':
          value = getEventDisplayName(event).toLowerCase();
          break;
        case 'eventTime':
          value = eventTime.toLowerCase();
          break;
        case 'speed':
          if (speed) {
            value = convertSpeed(speed);
            return compareNumbers(value, filter.value, filter.operator);
          }
          return true;
        case 'geofence':
          value = geofence.toLowerCase();
          break;
        case 'address':
          value = address.toLowerCase();
          break;
        default:
          return true;
      }
      
      if (typeof value === 'string') {
        return value.includes(filter.value.toLowerCase());
      }
      return true;
    });
  });

  // Apply dynamic filters to visits
const filteredVisits = visits.filter((visit) => {
  if (visitDynamicFilters.length === 0) return true;

  return visitDynamicFilters.every((filter) => {
    let value: string | number = '';

    const enterTime = convertToUTC3(visit.enterTime);
    const exitTime = visit.exitTime ? convertToUTC3(visit.exitTime) : 'Still inside';

    switch (filter.column) {
      case 'device':
        value = visit.deviceName.toLowerCase();
        break;
      case 'geofenceName':
        value = visit.geofenceName.toLowerCase();
        break;
      case 'enterTime':
        value = enterTime.toLowerCase();
        break;
      case 'exitTime':
        value = exitTime.toLowerCase();
        break;
      case 'duration':
        value = parseDurationToMinutes(formatDuration(visit.duration));
        return compareNumbers(value, filter.value, filter.operator);
      default:
        return true;
    }

    if (typeof value === 'string') {
      return value.includes(filter.value.toLowerCase());
    }
    return true;
  });
});

  const sortedVisits = useMemo(() => {
  const sorted = [...filteredVisits];

  sorted.sort((a, b) => {
    let aValue: string | number = '';
    let bValue: string | number = '';

    switch (visitSort.column) {
      case 'device':
        aValue = a.deviceName.toLowerCase();
        bValue = b.deviceName.toLowerCase();
        break;
      case 'geofenceName':
        aValue = a.geofenceName.toLowerCase();
        bValue = b.geofenceName.toLowerCase();
        break;
      case 'enterTime':
        aValue = new Date(a.enterTime).getTime();
        bValue = new Date(b.enterTime).getTime();
        break;
      case 'exitTime':
        aValue = a.exitTime ? new Date(a.exitTime).getTime() : -1;
        bValue = b.exitTime ? new Date(b.exitTime).getTime() : -1;
        break;
      case 'duration':
        aValue = a.duration;
        bValue = b.duration;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return visitSort.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return visitSort.direction === 'asc' ? 1 : -1;
    return 0;
  });

  return sorted;
}, [filteredVisits, visitSort]);

  const exportTripReport = () => {
    // Prepare data for Excel
  const data = sortedTrips.map((trip) => ({
      'Device': trip.deviceName,
      'Start Time': convertToUTC3(trip.startTime),
      'From': trip.startAddress,
      'End Time': convertToUTC3(trip.endTime),
      'To': trip.endAddress,
      'Distance (km)': convertDistance(trip.distance).toFixed(2),
      'Duration': formatDuration(trip.duration),
      'Max Speed (km/h)': convertSpeed(trip.maxSpeed).toFixed(1),
    }));

    // Create worksheet and workbook
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Trips');

    // Auto-size columns
    const maxWidth = data.reduce((w, r) => Math.max(w, r['From']?.length || 0, r['To']?.length || 0), 10);
    worksheet['!cols'] = [
      { wch: 15 }, // Device
      { wch: 20 }, // Start Time
      { wch: Math.min(maxWidth, 50) }, // From
      { wch: 20 }, // End Time
      { wch: Math.min(maxWidth, 50) }, // To
      { wch: 12 }, // Distance
      { wch: 10 }, // Duration
      { wch: 15 }  // Max Speed
    ];

    // Export with proper UTF-8 encoding for Arabic
    XLSX.writeFile(workbook, `trip_report_${new Date().toISOString().split("T")[0]}.xlsx`, { bookType: 'xlsx' });
  };

  const exportEventReport = () => {
    // Prepare data for Excel
    const data = filteredEventsWithColumns.map((event) => {
      const speed = event.position?.speed;
      const speedKmh = speed !=null ? Math.round(convertSpeed(speed)) : '-';
      const address = event.position?.address || '-';
      
      return {
        'Device': event.deviceName,
        'Event Type': getEventDisplayName(event),
        'Event Time': convertToUTC3(event.eventTime),
        'Speed (km/h)': speedKmh,
        'Address': address,
        'Geofence': getGeofenceName(event, geofenceMap) || '-',
      };
    });

    // Create worksheet and workbook
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Events');

    // Auto-size columns
    worksheet['!cols'] = [
      { wch: 15 }, // Device
      { wch: 20 }, // Event Type
      { wch: 20 }, // Event Time
      { wch: 15 }, // Speed
      { wch: 50 }, // Address
      { wch: 20 }, // Geofence
    ];

    // Export with proper UTF-8 encoding for Arabic
    XLSX.writeFile(workbook, `event_report_${new Date().toISOString().split("T")[0]}.xlsx`, { bookType: 'xlsx' });
  };

  const exportVisitsReport = () => {
    // Prepare data for Excel
    const data = filteredVisits.map((visit) => ({
      'Device': visit.deviceName,
      'Geofence Name': visit.geofenceName,
      'Enter Time': convertToUTC3(visit.enterTime),
      'Exit Time': visit.exitTime ? convertToUTC3(visit.exitTime) : 'Still inside',
      'Duration': formatDuration(visit.duration),
  }));

    // Create worksheet and workbook
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Geofence Visits');

    // Auto-size columns
    worksheet['!cols'] = [
      { wch: 25 }, // Device
      { wch: 50 }, // Geofence Name
      { wch: 35 }, // Enter Time
      { wch: 35 }, // Exit Time
      { wch: 20 }, // Duration
      
    ];

    // Export with proper UTF-8 encoding for Arabic
    XLSX.writeFile(workbook, `visits_report_${new Date().toISOString().split("T")[0]}.xlsx`, { bookType: 'xlsx' });
  };

  const totalDistance = trips.reduce((sum, trip) => sum + convertDistance(trip.distance), 0);
  const totalDuration = trips.reduce((sum, trip) => sum + trip.duration, 0);
  const maxSpeed = trips.length > 0 ? Math.max(...trips.map((t) => t.maxSpeed)) : 0;

  const filteredDevices = useMemo(() => {
    const q = vehicleSearch.trim().toLowerCase();
    if (!q) return devices;
    return devices.filter((device) => device.name.toLowerCase().includes(q));
  }, [devices, vehicleSearch]);

  const visitGeofenceOptions = useMemo(() => {
    const q = visitGeofenceSearch.trim().toLowerCase();
    const source = geofences;

    if (!q) return source;
    return source.filter((g) => g.name.toLowerCase().includes(q));
  }, [geofences, visitGeofenceSearch]);

  const selectedVisitGeofenceSummary =
    selectedVisitGeofences.length === 0
      ? "All Geofences"
      : selectedVisitGeofences.length === 1
        ? geofences.find((g) => g.id.toString() === selectedVisitGeofences[0])?.name || "1 Geofence selected"
        : `${selectedVisitGeofences.length} Geofences selected`;

  const toggleSelectedVisitGeofence = (id: string) => {
    setSelectedVisitGeofences((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  const clearSelectedVisitGeofences = () => {
    setSelectedVisitGeofences([]);
  };

  const selectedDevicesCount = selectedDevices.length;

  const selectedVehicleSummary =
    selectedDevicesCount === 0
      ? "All Vehicles"
      : selectedDevicesCount === 1
        ? "1 Vehicle selected"
        : `${selectedDevicesCount} Vehicles selected`;

  const selectedDateLabel = useMemo(() => {
    switch (dateRange) {
      case "today":
        return "Today";
      case "yesterday":
        return "Yesterday";
      case "7days":
        return "Last 7 Days";
      case "30days":
        return "Last 30 Days";
      case "custom":
        if (customFrom && customTo) {
          return `${customFrom.replace("T", " ")} → ${customTo.replace("T", " ")}`;
        }
        if (customFrom) return `From ${customFrom.replace("T", " ")}`;
        if (customTo) return `To ${customTo.replace("T", " ")}`;
        return "Custom Range";
      default:
        return "Last 7 Days";
    }
  }, [dateRange, customFrom, customTo]);


  const toggleEventType = (eventType: string) => {
    setEventTypeFilters(prev =>
      prev.includes(eventType)
        ? prev.filter(t => t !== eventType)
        : [...prev, eventType]
    );
  };

  const topGeofenceVisits = useMemo(() => {
  if (!visits || visits.length === 0) return [];

  const map = new Map<string, number>();

  visits.forEach((v) => {
    const name = v.geofenceName || "Unknown";
    map.set(name, (map.get(name) || 0) + 1);
  });

  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}, [visits]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {/* <h1 className="text-3xl font-semibold mb-2">Reports</h1>*/}
          {/*<p className="text-gray-600">Generate and analyze fleet reports</p>*/}
        </div>
        
      </div>



      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div ref={vehicleDropdownRef} className="relative w-full sm:w-[320px]">
              <button
                type="button"
                onClick={() => setVehicleDropdownOpen((prev) => !prev)}
                className="w-full rounded-md border bg-white px-3 py-2 text-left min-h-[40px]"
              >
                <div className="text-sm font-medium">{selectedVehicleSummary}</div>
                {selectedDevicesCount > 0 && (
                  <div className="mt-1 text-xs text-gray-500 line-clamp-2">
                    {devices
                      .filter((device) => selectedDevices.includes(device.id.toString()))
                      .map((device) => device.name)
                      .join(", ")}
                  </div>
                )}
              </button>

              {vehicleDropdownOpen && (
                <div className="absolute z-50 mt-1 w-full rounded-md border bg-white p-2 shadow-lg">
                  <Input
                    value={vehicleSearch}
                    onChange={(e) => setVehicleSearch(e.target.value)}
                    placeholder="Search vehicle..."
                    className="mb-2"
                  />

                  <div className="mb-2 flex items-center justify-between border-b pb-2">
                    <button
                      type="button"
                      onClick={clearSelectedDevices}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      All Vehicles
                    </button>
                    {selectedDevicesCount > 0 && (
                      <button
                        type="button"
                        onClick={clearSelectedDevices}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="max-h-64 space-y-1 overflow-auto">
                    {filteredDevices.map((device) => {
                      const checked = selectedDevices.includes(device.id.toString());

                      return (
                        <label
                          key={device.id}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 hover:bg-gray-50"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleSelectedDevice(device.id.toString())}
                          />
                          <span className="text-sm">{device.name}</span>
                        </label>
                      );
                    })}

                    {filteredDevices.length === 0 && (
                      <div className="px-2 py-3 text-sm text-gray-500">No vehicles found.</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem key="date-today" value="today">Today</SelectItem>
                <SelectItem key="date-yesterday" value="yesterday">Yesterday</SelectItem>
                <SelectItem key="date-7days" value="7days">Last 7 Days</SelectItem>
                <SelectItem key="date-30days" value="30days">Last 30 Days</SelectItem>
                <SelectItem key="date-custom" value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {dateRange === "custom" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="custom-from">From (Amman Time)</Label>
                <Input
                  id="custom-from"
                  type="datetime-local"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="custom-to">To (Amman Time)</Label>
                <Input
                  id="custom-to"
                  type="datetime-local"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reports Tabs */}
      <Tabs defaultValue="trips" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="trips">Trip Reports</TabsTrigger>
          <TabsTrigger value="events">Event Reports</TabsTrigger>
          <TabsTrigger value="visits">Geofence Visits</TabsTrigger>
          <TabsTrigger value="summary">Summary Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="trips" className="space-y-4">
          <Card>
           <CardHeader className="flex flex-row items-start justify-between">
  <div>
    <CardTitle>Trip History</CardTitle>
  </div>

  <div className="flex items-center gap-2">
    <Button onClick={loadData} disabled={loading} variant="outline" size="sm">
      <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
      {loading ? 'Loading...' : 'Refresh'}
    </Button>

    <Button onClick={() => setShowTripFilters(true)} variant="outline" size="sm">
      <Filter className="w-4 h-4 mr-2" />
      Filters
      {tripDynamicFilters.length > 0 && (
        <span className="ml-2 bg-blue-500 text-white px-2 py-0.5 rounded-full text-xs">
          {tripDynamicFilters.length}
        </span>
      )}
    </Button>

    <Button onClick={exportTripReport} variant="outline" size="sm">
      <Download className="w-4 h-4 mr-2" />
      Export
    </Button>
  </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card key="trip-card-distance">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Distance</p>
                    <p className="text-2xl font-semibold">{totalDistance.toFixed(1)} km</p>
                    <p className="text-xs text-gray-500 mt-2">{selectedVehicleSummary}</p>
                    <p className="text-xs text-gray-500">{selectedDateLabel}</p>
                  </div>
                  <div className="bg-blue-500 p-3 rounded-lg">
                    <MapPin className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card key="trip-card-duration">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Duration</p>
                    <p className="text-2xl font-semibold">{formatDuration(totalDuration)}</p>
                    <p className="text-xs text-gray-500 mt-2">{selectedVehicleSummary}</p>
                    <p className="text-xs text-gray-500">{selectedDateLabel}</p>
                  </div>
                  <div className="bg-purple-500 p-3 rounded-lg">
                    <Clock className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card key="trip-card-speed">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Max Speed</p>
                    <p className="text-2xl font-semibold">{convertSpeed(maxSpeed).toFixed(1)} km/h</p>
                    <p className="text-xs text-gray-500 mt-2">{selectedVehicleSummary}</p>
                    <p className="text-xs text-gray-500">{selectedDateLabel}</p>
                  </div>
                  <div className="bg-green-500 p-3 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
</CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-gray-500">Loading trips...</div>
              ) : filteredTrips.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No trips found</p>
                  <p className="text-sm mt-2">Click "Refresh Data" to load trip reports</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHead className="cursor-pointer select-none" onClick={() => handleTripSort('device')}>
  Device {tripSort.column === 'device' ? (tripSort.direction === 'asc' ? '↑' : '↓') : ''}
</TableHead>

<TableHead className="cursor-pointer select-none" onClick={() => handleTripSort('startTime')}>
  Start Time {tripSort.column === 'startTime' ? (tripSort.direction === 'asc' ? '↑' : '↓') : ''}
</TableHead>

<TableHead className="cursor-pointer select-none" onClick={() => handleTripSort('from')}>
  From {tripSort.column === 'from' ? (tripSort.direction === 'asc' ? '↑' : '↓') : ''}
</TableHead>

<TableHead className="cursor-pointer select-none" onClick={() => handleTripSort('endTime')}>
  End Time {tripSort.column === 'endTime' ? (tripSort.direction === 'asc' ? '↑' : '↓') : ''}
</TableHead>

<TableHead className="cursor-pointer select-none" onClick={() => handleTripSort('to')}>
  To {tripSort.column === 'to' ? (tripSort.direction === 'asc' ? '↑' : '↓') : ''}
</TableHead>

<TableHead className="cursor-pointer select-none" onClick={() => handleTripSort('distance')}>
  Distance {tripSort.column === 'distance' ? (tripSort.direction === 'asc' ? '↑' : '↓') : ''}
</TableHead>

<TableHead className="cursor-pointer select-none" onClick={() => handleTripSort('duration')}>
  Duration {tripSort.column === 'duration' ? (tripSort.direction === 'asc' ? '↑' : '↓') : ''}
</TableHead>

<TableHead className="cursor-pointer select-none" onClick={() => handleTripSort('maxSpeed')}>
  Max Speed {tripSort.column === 'maxSpeed' ? (tripSort.direction === 'asc' ? '↑' : '↓') : ''}
</TableHead>

<TableHead>Map</TableHead>
                    <TableBody>
                      {sortedTrips.map((trip, index) => {
                        const startDateTime = convertToUTC3Split(trip.startTime);
                        const endDateTime = convertToUTC3Split(trip.endTime);
                        
                        return (
                          <TableRow key={trip.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <TableCell className="font-medium max-w-xs">
                              <div className="whitespace-normal">{trip.deviceName}</div>
                            </TableCell>
                            <TableCell>
                              <div className="whitespace-normal">
                                <div>{startDateTime.date}</div>
                                <div className="text-gray-600">{startDateTime.time}</div>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-xs">
                              <div className="text-sm text-gray-600 whitespace-normal">
                                {trip.startAddress}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="whitespace-normal">
                                <div>{endDateTime.date}</div>
                                <div className="text-gray-600">{endDateTime.time}</div>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-xs">
                              <div className="text-sm text-gray-600 whitespace-normal">
                                {trip.endAddress}
                              </div>
                            </TableCell>
                            <TableCell>{convertDistance(trip.distance).toFixed(2)} km</TableCell>
                            <TableCell>{formatDuration(trip.duration)}</TableCell>
                            <TableCell>{convertSpeed(trip.maxSpeed).toFixed(1)} km/h</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openTripMapDialog(trip)}
                                title="View trip on map"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

         

        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <Card>
           <CardHeader className="space-y-4">
  <div className="flex flex-row items-start justify-between">
    <CardTitle>Event History</CardTitle>

    <div className="flex items-center gap-2">
      <Button onClick={loadData} disabled={loading} variant="outline" size="sm">
        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
        {loading ? 'Loading...' : 'Refresh'}
      </Button>

      <Button onClick={() => setShowEventFilters(true)} variant="outline" size="sm">
        <Filter className="w-4 h-4 mr-2" />
        Filters
        {eventDynamicFilters.length > 0 && (
          <span className="ml-2 bg-blue-500 text-white px-2 py-0.5 rounded-full text-xs">
            {eventDynamicFilters.length}
          </span>
        )}
      </Button>

      <Button onClick={exportEventReport} variant="outline" size="sm">
        <Download className="w-4 h-4 mr-2" />
        Export
      </Button>
    </div>
  </div>

  <div className="space-y-2">
    <Label className="text-sm font-medium">Filter Event Types:</Label>
    <div className="flex flex-wrap gap-4">
      {eventTypes.map((type) => (
        <div key={type.value} className="flex items-center space-x-2">
          <Checkbox
            id={`event-tab-${type.value}`}
            checked={eventTypeFilters.includes(type.value)}
            onCheckedChange={() => toggleEventType(type.value)}
          />
          <label
            htmlFor={`event-tab-${type.value}`}
            className="text-sm font-medium leading-none cursor-pointer"
          >
            {type.label}
          </label>
        </div>
      ))}
    </div>
  </div>
</CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-gray-500">Loading events...</div>
              ) : filteredEventsWithColumns.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No events found</p>
                  <p className="text-sm mt-2">Click "Refresh Data" to load event reports</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow key="events-header">
                        <TableHead key="events-h-device">Device</TableHead>
                        <TableHead key="events-h-type">Event Type</TableHead>
                        <TableHead key="events-h-time">Event Time</TableHead>
                        <TableHead key="events-h-speed">Speed (km/h)</TableHead>
                        <TableHead key="events-h-geofence">Geofence</TableHead>
                        <TableHead key="events-h-address">Address</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEventsWithColumns.map((event, index) => {
                        const speed = event.position?.speed;
                        const address = event.position?.address;
                        const eventIcon = getEventIcon(event.type, event.attributes?.alarm);
                        const EventIconComponent = eventIcon.icon;
                        
                        return (
                          <TableRow key={event.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <TableCell className="font-medium max-w-xs">
                              <div className="whitespace-normal">{event.deviceName}</div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className={`p-1.5 rounded ${eventIcon.bg}`}>
                                  <EventIconComponent className={`w-4 h-4 ${eventIcon.color}`} />
                                </div>
                                <span className="capitalize">
                                  {getEventDisplayName(event)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {event.eventTime && !isNaN(new Date(event.eventTime).getTime())
                                ? convertToUTC3(event.eventTime)
                                : 'Unknown'}
                            </TableCell>
                            <TableCell>
                              {speed != null ? Math.round(convertSpeed(speed)) : '-'}
                            </TableCell>
                            <TableCell>
                              {getGeofenceName(event, geofenceMap) || '-'}
                            </TableCell>
                            <TableCell className="max-w-xs">
                              <div className="text-sm text-gray-600 whitespace-normal">
                                {address || '-'}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="visits" className="space-y-4">
          {topGeofenceVisits.length > 0 && (
  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
    {topGeofenceVisits.map((g, i) => (
      <Card key={`geo-top-${i}`} className="p-3">
        <div className="flex flex-col gap-1">
          <div className="text-xs text-gray-500 truncate">
            {g.name}
          </div>
          <div className="text-xl font-semibold text-blue-600">
            {g.count}
          </div>
        </div>
      </Card>
    ))}
  </div>
)}
          <Card>
            <CardHeader className="space-y-4">
  <div className="flex flex-row items-start justify-between">
    <CardTitle>Geofence Visits</CardTitle>

    <div className="flex items-center gap-2">
      <Button onClick={loadData} disabled={loading} variant="outline" size="sm">
        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
        {loading ? 'Loading...' : 'Refresh'}
      </Button>

      <Button onClick={() => setShowVisitFilters(true)} variant="outline" size="sm">
        <Filter className="w-4 h-4 mr-2" />
        Filters
        {visitDynamicFilters.length > 0 && (
          <span className="ml-2 bg-blue-500 text-white px-2 py-0.5 rounded-full text-xs">
            {visitDynamicFilters.length}
          </span>
        )}
      </Button>

      <Button onClick={exportVisitsReport} variant="outline" size="sm">
        <Download className="w-4 h-4 mr-2" />
        Export
      </Button>
    </div>
  </div>

  <div ref={visitGeofenceDropdownRef} className="relative w-full sm:w-[320px]">
    <button
      type="button"
      onClick={() => setVisitGeofenceDropdownOpen((prev) => !prev)}
      className="w-full rounded-md border bg-white px-3 py-2 text-left min-h-[40px]"
    >
      <div className="text-sm font-medium">{selectedVisitGeofenceSummary}</div>
      {selectedVisitGeofences.length > 0 && (
        <div className="mt-1 text-xs text-gray-500 line-clamp-2">
          {selectedVisitGeofences.map((id) => geofences.find((g) => g.id.toString() === id)?.name || id).join(", ")}
        </div>
      )}
    </button>

    {visitGeofenceDropdownOpen && (
      <div className="absolute z-50 mt-1 w-full rounded-md border bg-white p-2 shadow-lg">
        <Input
          value={visitGeofenceSearch}
          onChange={(e) => setVisitGeofenceSearch(e.target.value)}
          placeholder="Search geofence..."
          className="mb-2"
        />

        <div className="mb-2 flex items-center justify-between border-b pb-2">
          <button
            type="button"
            onClick={clearSelectedVisitGeofences}
            className="text-sm text-blue-600 hover:underline"
          >
            All Geofences
          </button>

          {selectedVisitGeofences.length > 0 && (
            <button
              type="button"
              onClick={clearSelectedVisitGeofences}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
          )}
        </div>

        <div className="max-h-64 space-y-1 overflow-auto">
          {visitGeofenceOptions.map((geofence) => {
            const checked = selectedVisitGeofences.includes(geofence.id.toString());

            return (
              <label
                key={geofence.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 hover:bg-gray-50"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggleSelectedVisitGeofence(geofence.id.toString())}
                />
                <span className="text-sm">{geofence.name}</span>
              </label>
            );
          })}

          {visitGeofenceOptions.length === 0 && (
            <div className="px-2 py-3 text-sm text-gray-500">No geofences found.</div>
          )}
        </div>
      </div>
    )}
  </div>
</CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-gray-500">Loading visits...</div>
              ) : filteredVisits.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No geofence visits found</p>
                  <p className="text-sm mt-2">Click "Refresh Data" to load geofence visit reports</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
  <TableRow key="visits-header">
    <TableHead
      key="visits-h-device"
      className="cursor-pointer select-none"
      onClick={() => handleVisitSort('device')}
    >
      Device {visitSort.column === 'device' ? (visitSort.direction === 'asc' ? '↑' : '↓') : ''}
    </TableHead>

    <TableHead
      key="visits-h-geofence"
      className="cursor-pointer select-none"
      onClick={() => handleVisitSort('geofenceName')}
    >
      Geofence Name {visitSort.column === 'geofenceName' ? (visitSort.direction === 'asc' ? '↑' : '↓') : ''}
    </TableHead>

    <TableHead
      key="visits-h-enter"
      className="cursor-pointer select-none"
      onClick={() => handleVisitSort('enterTime')}
    >
      Enter Time {visitSort.column === 'enterTime' ? (visitSort.direction === 'asc' ? '↑' : '↓') : ''}
    </TableHead>

    <TableHead
      key="visits-h-exit"
      className="cursor-pointer select-none"
      onClick={() => handleVisitSort('exitTime')}
    >
      Exit Time {visitSort.column === 'exitTime' ? (visitSort.direction === 'asc' ? '↑' : '↓') : ''}
    </TableHead>

    <TableHead
      key="visits-h-duration"
      className="cursor-pointer select-none"
      onClick={() => handleVisitSort('duration')}
    >
      Duration {visitSort.column === 'duration' ? (visitSort.direction === 'asc' ? '↑' : '↓') : ''}
    </TableHead>
  </TableRow>
</TableHeader>
                    <TableBody>
                      {sortedVisits.map((visit, index) => (
                        <TableRow key={visit.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <TableCell className="font-medium max-w-xs">
                            <div className="whitespace-normal">{visit.deviceName}</div>
                          </TableCell>
                          <TableCell className="font-medium text-blue-600">{visit.geofenceName}</TableCell>
                          <TableCell>
                            {visit.enterTime && !isNaN(new Date(visit.enterTime).getTime())
                              ? convertToUTC3(visit.enterTime)
                              : 'Unknown'}
                          </TableCell>
                          <TableCell>
                            {visit.exitTime && !isNaN(new Date(visit.exitTime).getTime())
                              ? convertToUTC3(visit.exitTime)
                              : <span className="text-orange-600">Still inside</span>}
                          </TableCell>
                          <TableCell>{visit.duration > 0 ? formatDuration(visit.duration) : '-'}</TableCell>
                          
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
  <CardTitle>Summary Statistics</CardTitle>

  <Button onClick={loadData} disabled={loading} variant="outline" size="sm">
    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
    {loading ? 'Loading...' : 'Refresh'}
  </Button>
</CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div key="summary-trips" className="p-4 border rounded-lg">
                    <div className="text-sm text-gray-600 mb-2">Total Trips</div>
                    <div className="text-3xl font-semibold">{trips.length}</div>
                  </div>
                  <div key="summary-events" className="p-4 border rounded-lg">
                    <div className="text-sm text-gray-600 mb-2">Total Events</div>
                    <div className="text-3xl font-semibold">{allEvents.length}</div>
                  </div>
                  <div key="summary-visits" className="p-4 border rounded-lg">
                    <div className="text-sm text-gray-600 mb-2">Geofence Visits</div>
                    <div className="text-3xl font-semibold">{visits.length}</div>
                  </div>
                  <div key="summary-max-speed" className="p-4 border rounded-lg">
                    <div className="text-sm text-gray-600 mb-2">Highest Speed Recorded</div>
                    <div className="text-3xl font-semibold">
                      {trips.length > 0 
                        ? convertSpeed(Math.max(...trips.map((t) => t.maxSpeed))).toFixed(1)
                        : 0} km/h
                    </div>
                  </div>
                  <div key="summary-active-vehicles" className="p-4 border rounded-lg">
                    <div className="text-sm text-gray-600 mb-2">Total Active Vehicles</div>
                    <div className="text-3xl font-semibold">
                      {devices.filter((d) => d.status === "online").length}
                    </div>
                  </div>
                  <div key="summary-total-distance" className="p-4 border rounded-lg">
                    <div className="text-sm text-gray-600 mb-2">Total Distance Covered</div>
                    <div className="text-3xl font-semibold">{totalDistance.toFixed(1)} km</div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <Button variant="outline" className="w-full">
                    <FileText className="w-4 h-4 mr-2" />
                    Generate Full PDF Report
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Trip Filters Dialog */}
      <Dialog open={showTripFilters} onOpenChange={setShowTripFilters}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Trip Filters</DialogTitle>
            <DialogDescription>
              Add filters to narrow down your trip results
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Active Filters */}
            {tripDynamicFilters.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Active Filters ({tripDynamicFilters.length})</Label>
                {tripDynamicFilters.map((filter) => (
                  <div key={filter.id} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                    <Select 
                      value={filter.column} 
                      onValueChange={(value) => updateFilter('trip', filter.id, 'column', value)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {tripColumns.map((col) => (
                          <SelectItem key={`${filter.id}-${col.key}`} value={col.value}>{col.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Select 
                      value={filter.operator} 
                      onValueChange={(value) => updateFilter('trip', filter.id, 'operator', value)}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem key={`${filter.id}-contains`} value="contains">Contains</SelectItem>
                        <SelectItem key={`${filter.id}-eq`} value="=">=</SelectItem>
                        <SelectItem key={`${filter.id}-gt`} value=">">{'>'}</SelectItem>
                        <SelectItem key={`${filter.id}-lt`} value="<">{'<'}</SelectItem>
                        <SelectItem key={`${filter.id}-gte`} value=">=">{'>='}</SelectItem>
                        <SelectItem key={`${filter.id}-lte`} value="<=">{'<='}</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Input
                      placeholder="Value..."
                      value={filter.value}
                      onChange={(e) => updateFilter('trip', filter.id, 'value', e.target.value)}
                      className="flex-1"
                    />
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFilter('trip', filter.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Add Filter Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => addFilter('trip')}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Filter
            </Button>
          </div>
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => clearAllFilters('trip')}>
              Clear All
            </Button>
            <Button onClick={() => setShowTripFilters(false)}>
              Apply Filters
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Event Filters Dialog */}
      <Dialog open={showEventFilters} onOpenChange={setShowEventFilters}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Event Filters</DialogTitle>
            <DialogDescription>
              Add filters to narrow down your event results
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Active Filters */}
            {eventDynamicFilters.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Active Filters ({eventDynamicFilters.length})</Label>
                {eventDynamicFilters.map((filter) => (
                  <div key={filter.id} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                    <Select 
                      value={filter.column} 
                      onValueChange={(value) => updateFilter('event', filter.id, 'column', value)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {eventColumns.map((col) => (
                          <SelectItem key={`${filter.id}-${col.key}`} value={col.value}>{col.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Select 
                      value={filter.operator} 
                      onValueChange={(value) => updateFilter('event', filter.id, 'operator', value)}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem key={`${filter.id}-contains`} value="contains">Contains</SelectItem>
                        <SelectItem key={`${filter.id}-eq`} value="=">=</SelectItem>
                        <SelectItem key={`${filter.id}-gt`} value=">">{'>'}</SelectItem>
                        <SelectItem key={`${filter.id}-lt`} value="<">{'<'}</SelectItem>
                        <SelectItem key={`${filter.id}-gte`} value=">=">{'>='}</SelectItem>
                        <SelectItem key={`${filter.id}-lte`} value="<=">{'<='}</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Input
                      placeholder="Value..."
                      value={filter.value}
                      onChange={(e) => updateFilter('event', filter.id, 'value', e.target.value)}
                      className="flex-1"
                    />
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFilter('event', filter.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Add Filter Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => addFilter('event')}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Filter
            </Button>
          </div>
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => clearAllFilters('event')}>
              Clear All
            </Button>
            <Button onClick={() => setShowEventFilters(false)}>
              Apply Filters
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Visit Filters Dialog */}
      <Dialog open={showVisitFilters} onOpenChange={setShowVisitFilters}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Visit Filters</DialogTitle>
            <DialogDescription>
              Add filters to narrow down your geofence visit results
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Active Filters */}
            {visitDynamicFilters.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Active Filters ({visitDynamicFilters.length})</Label>
                {visitDynamicFilters.map((filter) => (
                  <div key={filter.id} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                    <Select 
                      value={filter.column} 
                      onValueChange={(value) => updateFilter('visit', filter.id, 'column', value)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {visitColumns.map((col) => (
                          <SelectItem key={`${filter.id}-${col.key}`} value={col.value}>{col.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Select 
                      value={filter.operator} 
                      onValueChange={(value) => updateFilter('visit', filter.id, 'operator', value)}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem key={`${filter.id}-contains`} value="contains">Contains</SelectItem>
                        <SelectItem key={`${filter.id}-eq`} value="=">=</SelectItem>
                        <SelectItem key={`${filter.id}-gt`} value=">">{'>'}</SelectItem>
                        <SelectItem key={`${filter.id}-lt`} value="<">{'<'}</SelectItem>
                        <SelectItem key={`${filter.id}-gte`} value=">=">{'>='}</SelectItem>
                        <SelectItem key={`${filter.id}-lte`} value="<=">{'<='}</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Input
                      placeholder="Value..."
                      value={filter.value}
                      onChange={(e) => updateFilter('visit', filter.id, 'value', e.target.value)}
                      className="flex-1"
                    />
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFilter('visit', filter.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Add Filter Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => addFilter('visit')}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Filter
            </Button>
          </div>
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => clearAllFilters('visit')}>
              Clear All
            </Button>
            <Button onClick={() => setShowVisitFilters(false)}>
              Apply Filters
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Trip Map Dialog */}
{/* Trip Map Dialog */}
<Dialog open={!!selectedTripForMap} onOpenChange={closeTripMapDialog}>
  <DialogContent className="w-[95vw] max-w-7xl h-[95vh] p-0 overflow-hidden">
    <DialogHeader className="sr-only">
      <DialogTitle>Trip Playback</DialogTitle>
      <DialogDescription>Trip map playback dialog</DialogDescription>
    </DialogHeader>

    <div className="flex h-full w-full bg-slate-100">
      {/* Left Side Info */}
      <div className="w-[430px] min-w-[430px] border-r bg-white flex flex-col">
        <div className="border-b px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold">Trip Playback</div>
              <div className="text-sm text-slate-500">
                {selectedTripForMap?.deviceName || "Vehicle"}
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={closeTripMapDialog}
              className="rounded-full"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="border-b px-4 py-4 space-y-3">
          <div className="text-sm font-medium text-slate-900">Trip Summary</div>

          <div className="flex items-center justify-between rounded-xl border bg-white px-4 py-3 text-sm shadow-sm">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <span className="font-semibold text-slate-900">
                {selectedTripForMap ? formatDuration(selectedTripForMap.duration) : "-"}
              </span>
            </div>

            <div className="h-5 w-px bg-slate-200" />

            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-green-500" />
              <span className="font-semibold text-slate-900">
                {selectedTripForMap
                  ? `${convertDistance(selectedTripForMap.distance).toFixed(2)} km`
                  : "-"}
              </span>
            </div>

            <div className="h-5 w-px bg-slate-200" />

            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-orange-500" />
              <span className="font-semibold text-slate-900">
                {selectedTripForMap
                  ? `${convertSpeed(selectedTripForMap.maxSpeed).toFixed(1)} km/h`
                  : "-"}
              </span>
            </div>
          </div>
        </div>

        <div className="border-b px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="text-sm font-medium text-slate-900 whitespace-nowrap">Map Type</div>
            <Select value={mapLayer} onValueChange={(v: "osm" | "esri") => setMapLayer(v)}>
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="osm">OpenStreetMap</SelectItem>
                <SelectItem value="esri">Esri Satellite</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-4 py-4">
          <div className="space-y-3">
            <div className="text-sm font-medium text-slate-900">Current Point</div>

            <div className="rounded-xl border bg-slate-50 px-3 py-3">
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                <div className="text-sm font-medium text-slate-900 break-words leading-6">
                  {tripPositions[selectedInfoIndex]?.address || "-"}
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-white px-3 py-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-orange-500" />
                  <span className="font-semibold text-slate-900">
                    {tripPositions[selectedInfoIndex]?.speed != null
                      ? `${convertSpeed(tripPositions[selectedInfoIndex].speed!).toFixed(1)} km/h`
                      : "-"}
                  </span>
                </div>

                <div className="h-5 w-px bg-slate-200" />

                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-500" />
                  <span className="font-semibold text-slate-900">
                    {tripPositions[selectedInfoIndex]?.fixTime
                      ? convertToUTC3Split(tripPositions[selectedInfoIndex].fixTime!).date
                      : "-"}
                  </span>
                </div>

                <div className="h-5 w-px bg-slate-200" />

                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-purple-500" />
                  <span className="font-semibold text-slate-900">
                    {tripPositions[selectedInfoIndex]?.fixTime
                      ? convertToUTC3Split(tripPositions[selectedInfoIndex].fixTime!).time
                      : "-"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t px-4 py-4">
          <div className="flex items-center gap-3">
            <Button
              size="icon"
              className="rounded-full"
              onClick={() => {
                if (tripPositions.length > 1) {
                  setIsPlayingTrip(!isPlayingTrip);
                }
              }}
              disabled={tripPositions.length <= 1}
            >
              {isPlayingTrip ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="ml-0.5 h-5 w-5" />
              )}
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="rounded-full"
              onClick={() => {
                setPlaybackIndex(0);
                setSelectedInfoIndex(0);
                setIsPlayingTrip(false);
              }}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>

            <div className="w-[110px]">
              <Select value={playbackSpeed} onValueChange={setPlaybackSpeed}>
                <SelectTrigger className="h-9 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[9999]">
                  <SelectItem value="1">1x</SelectItem>
                  <SelectItem value="2">2x</SelectItem>
                  <SelectItem value="4">4x</SelectItem>
                  <SelectItem value="8">8x</SelectItem>
                  <SelectItem value="16">16x</SelectItem>
                  <SelectItem value="32">32x</SelectItem>
                  <SelectItem value="64">64x</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4">
            <input
              type="range"
              min={0}
              max={Math.max(tripPositions.length - 1, 0)}
              value={Math.min(playbackIndex, Math.max(tripPositions.length - 1, 0))}
              onChange={(e) => {
                const value = Number(e.target.value);
                setPlaybackIndex(value);
                setSelectedInfoIndex(value);
                setIsPlayingTrip(false);
              }}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Right Side Map */}
      <div className="relative flex-1">
        {tripPositionsLoading ? (
          <div className="flex h-full items-center justify-center bg-slate-100">
            <div className="text-sm text-slate-500">Loading trip map...</div>
          </div>
        ) : tripPositionsError ? (
          <div className="flex h-full items-center justify-center bg-slate-100 px-6 text-center">
            <div className="text-sm text-red-600">{tripPositionsError}</div>
          </div>
        ) : tripPositions.length === 0 ? (
          <div className="flex h-full items-center justify-center bg-slate-100">
            <div className="text-sm text-slate-500">No trip positions found.</div>
          </div>
        ) : (
          <LeafletTripMap
            positions={tripPositions}
            playbackIndex={Math.min(playbackIndex, Math.max(tripPositions.length - 1, 0))}
            onSelectPosition={(i) => {
              setSelectedInfoIndex(i);
              setPlaybackIndex(i);
              setIsPlayingTrip(false);
            }}
            mapLayer={mapLayer}
          />
        )}
      </div>
    </div>
  </DialogContent>
</Dialog>
    </div>
  );
}
