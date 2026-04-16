// BazyTrackGo / Traccar API Integration
// This service handles all API calls to the Traccar backend

import { traccarApi as mockApi } from "./mockTraccarApi";

// Format date to ISO string without milliseconds (Traccar requirement)
const formatDateForTraccar = (date: Date): string => {
  return date.toISOString().split('.')[0] + 'Z';
};


// Get session from localStorage
const getSession = () => {
  const stored = localStorage.getItem('traccar_session');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
};

// Base API caller with authentication
const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const session = getSession();

  if (!session || !session.token || !session.serverUrl) {
    console.debug('No valid session found, using mock data');
    return null;
  }

  console.log('📡 API Call:', {
    endpoint,
    serverUrl: session.serverUrl,
    fullUrl: `${session.serverUrl}${endpoint}`,
    hasToken: !!session.token
  });

  const headers = new Headers(options.headers);

  headers.set('Authorization', `Bearer ${session.token}`);
  headers.set('Accept', 'application/json');

  if (options.method && ['POST', 'PUT', 'PATCH'].includes(options.method)) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
  }

  try {
    const response = await fetch(`${session.serverUrl}${endpoint}`, {
      ...options,
      headers,
      mode: 'cors',
    });

    console.log('📥 API Response:', {
      endpoint,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      if (response.status === 401) {
        console.warn('⚠️ Session expired (401)');
        localStorage.removeItem('traccar_session');
        throw new Error('Session expired');
      }

      console.warn(`⚠️ API Error on ${endpoint}: ${response.status} ${response.statusText}`);

      if (response.status === 400) {
        console.debug(`Bad Request on ${endpoint}, falling back to mock data`);
        return null;
      }

      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.debug(`Network error on ${endpoint}, using mock data`);
    } else {
      console.warn(`⚠️ API call failed on ${endpoint}:`, error);
    }

    return null;
  }
};

// Check if we should use real API or mock data
const shouldUseMockData = () => {
  const session = getSession();
  return !session || !session.token || !session.serverUrl;
};
// Unified API that switches between real and mock
export const api = {
  // Get all devices
  getDevices: async () => {
    if (shouldUseMockData()) {
      return mockApi.getDevices();
    }
    const result = await apiCall('/api/devices');
    // Fallback to mock data if API call failed
    return result || mockApi.getDevices();
  },

  // Get single device
  getDevice: async (id: number) => {
    if (shouldUseMockData()) {
      return mockApi.getDevice(id);
    }
    const result = await apiCall(`/api/devices/${id}`);
    return result || mockApi.getDevice(id);
  },

  

  // Get positions for all devices or specific device
   getPositionsByIds: async (ids: number[]) => {
    if (shouldUseMockData()) {
      const allPositions = await mockApi.getPositions();
      return allPositions.filter((p: any) => ids.includes(Number(p.id)));
    }

    if (!ids.length) return [];

    const uniqueIds = [...new Set(ids)].filter(
      (id): id is number => typeof id === "number" && !Number.isNaN(id)
    );

    const chunkSize = 10;
    const chunks: number[][] = [];

    for (let i = 0; i < uniqueIds.length; i += chunkSize) {
      chunks.push(uniqueIds.slice(i, i + chunkSize));
    }

    try {
      const results = await Promise.all(
        chunks.map(async (chunk) => {
          const query = chunk
            .map((id) => `id=${encodeURIComponent(String(id))}`)
            .join("&");

          const result = await apiCall(`/api/positions?${query}`);

          if (Array.isArray(result)) {
            return result;
          }

          return [];
        })
      );

      return results.flat();
    } catch (error) {
      console.warn("⚠️ getPositionsByIds failed:", error);
      const allPositions = await mockApi.getPositions();
      return allPositions.filter((p: any) => uniqueIds.includes(Number(p.id)));
    }
  },

  getPositions: async () => {
  if (shouldUseMockData()) {
    return await mockApi.getPositions();
  }

  const result = await apiCall('/api/positions');
  return Array.isArray(result) ? result : await mockApi.getPositions();
},

  // Get trip positions for a device within a time range
  getTripPositions: async (deviceId: number, from: string, to: string) => {
    if (shouldUseMockData()) {
      return mockApi.getPositions().filter((p: any) => p.deviceId === deviceId);
    }

    const endpoint = `/api/positions?deviceId=${deviceId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

    console.log('🛣️ Fetching trip positions from:', endpoint);

    const result = await apiCall(endpoint);

    if (result === null) {
      console.log('⚠️ Trip positions API failed, using filtered mock data');
      return mockApi.getPositions().filter((p: any) => p.deviceId === deviceId);
    }

    if (Array.isArray(result)) {
      console.log(`✅ Received ${result.length} trip positions from Traccar API`);
      return result;
    }

    console.log('⚠️ Trip positions API returned non-array, using filtered mock data');
    return mockApi.getPositions().filter((p: any) => p.deviceId === deviceId);
  },

  // Get position by ID
  getPosition: async (id: number) => {
    if (shouldUseMockData()) {
      return mockApi.getPositions().find(p => p.id === id) || null;
    }
    const result = await apiCall(`/api/positions?id=${id}`);
    return result ? result[0] : null;
  },

  getEvents: async (deviceIds?: number[], from?: string, to?: string, types?: string[]) => {
  if (shouldUseMockData()) {
    return mockApi.getEvents(deviceIds?.[0]);
  }

  if (!from || !to) {
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 7);
    from = formatDateForTraccar(fromDate);
    to = formatDateForTraccar(toDate);
  }

  const safeFrom = encodeURIComponent(from);
  const safeTo = encodeURIComponent(to);

  const typeQuery =
    types && types.length > 0
      ? '&' + types.map((t) => `type=${encodeURIComponent(t)}`).join('&')
      : '';

  const devices = await apiCall('/api/devices');
  const deviceMap = new Map<number, string>(
    (devices || []).map((d: any) => [Number(d.id), d.name])
  );

  let events: any[] = [];

  if (!deviceIds || deviceIds.length === 0) {
    if (!devices || devices.length === 0) {
      return mockApi.getEvents(undefined);
    }

    const eventsPromises = devices.map((device: any) =>
      apiCall(`/api/reports/events?deviceId=${device.id}&from=${safeFrom}&to=${safeTo}${typeQuery}`)
        .then((res) => Array.isArray(res) ? res : [])
        .catch(() => [])
    );

    const allEvents = await Promise.all(eventsPromises);
    events = allEvents.flat();
  } else {
    const eventsPromises = deviceIds.map((id) =>
      apiCall(`/api/reports/events?deviceId=${id}&from=${safeFrom}&to=${safeTo}${typeQuery}`)
        .then((res) => Array.isArray(res) ? res : [])
        .catch(() => [])
    );

    const selectedEvents = await Promise.all(eventsPromises);
    events = selectedEvents.flat();
  }

  if (!events.length) {
    events = mockApi.getEvents(deviceIds?.[0]);
  }

  return events.map((event: any) => ({
    ...event,
    deviceName:
      event.deviceName ||
      deviceMap.get(Number(event.deviceId)) ||
      `Device ${event.deviceId}`,
  }));
},

  // Get trips for a device
// Get trips for one or more devices
getTrips: async (deviceIds?: number[], from?: string, to?: string) => {
  if (shouldUseMockData()) {
    return mockApi.getTrips(deviceIds?.[0]);
  }

  // If no dates provided, use last 7 days
  if (!from || !to) {
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 7);
    from = formatDateForTraccar(fromDate);
    to = formatDateForTraccar(toDate);
  }

  // No devices selected = get trips for all devices
  if (!deviceIds || deviceIds.length === 0) {
    const devices = await apiCall('/api/devices');
    if (!devices) {
      return mockApi.getTrips(undefined);
    }

    const tripsPromises = devices.map((device: any) =>
      apiCall(`/api/reports/trips?deviceId=${device.id}&from=${from}&to=${to}`)
        .catch(() => [])
    );

    const allTrips = await Promise.all(tripsPromises);
    return allTrips.flat();
  }

  // One or more selected devices
  const deviceQuery = deviceIds.map((id) => `deviceId=${id}`).join('&');
  const result = await apiCall(`/api/reports/trips?${deviceQuery}&from=${from}&to=${to}`);

  return result || mockApi.getTrips(deviceIds[0]);
},

  // Get events
if (!deviceIds || deviceIds.length === 0) {
  const devices = await apiCall('/api/devices');

  const tripsPromises = devices.map((device: any) =>
    apiCall(`/api/reports/trips?deviceId=${device.id}&from=${from}&to=${to}`)
      .catch(() => [])
  );

  const allTrips = await Promise.all(tripsPromises);
  return allTrips.flat();
},
  // Get summary statistics
  getSummary: async (deviceId?: number, from?: string, to?: string) => {
    if (shouldUseMockData()) {
      return mockApi.getSummary();
    }
    
    // Traccar requires both from and to for reports
    if (!from || !to) {
      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 7);
      from = formatDateForTraccar(fromDate);
      to = formatDateForTraccar(toDate);
    }
    
    // Summary endpoint requires deviceId
    if (!deviceId) {
      return mockApi.getSummary();
    }
    
    const endpoint = `/api/reports/summary?deviceId=${deviceId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    const result = await apiCall(endpoint);
    return result || mockApi.getSummary();
  },

  // Get historical data for charts
  getHistoricalData: async (days: number = 7) => {
    if (shouldUseMockData()) {
      return mockApi.getHistoricalData(days);
    }
    
    // Calculate date range
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    
    const fromStr = formatDateForTraccar(from);
    const toStr = formatDateForTraccar(to);
    
    // Get all devices first
    const devices = await apiCall('/api/devices');
    
    if (!devices || devices.length === 0) {
      return mockApi.getHistoricalData(days);
    }
    
    // Fetch summary for all devices
    const summaryPromises = devices.map((device: any) =>
      apiCall(`/api/reports/summary?deviceId=${device.id}&from=${fromStr}&to=${toStr}`)
        .catch(() => null)
    );
    
    const summaries = await Promise.all(summaryPromises);
    
    // Aggregate by day with unique keys
    const dataByDay: { [key: string]: any } = {};
    
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      const dateKey = date.toISOString().split('T')[0];
      
      dataByDay[dateKey] = {
        date: dateKey,
        distance: 0,
        trips: 0,
        fuel: 0,
        alerts: 0,
      };
    }
    
    // Aggregate data from summaries
    summaries.forEach((summary) => {
      if (summary && Array.isArray(summary) && summary.length > 0) {
        summary.forEach((item: any) => {
          // Safely handle date parsing
          const dateStr = item.date || item.deviceTime || item.startTime;
          if (!dateStr) return; // Skip if no date
          
          try {
            const date = new Date(dateStr);
            // Check if date is valid
            if (isNaN(date.getTime())) return;
            
            const dateKey = date.toISOString().split('T')[0];
            if (dataByDay[dateKey]) {
              dataByDay[dateKey].distance += (item.distance || 0) / 1000; // Convert to km
              dataByDay[dateKey].trips += 1;
              dataByDay[dateKey].fuel += item.spentFuel || 0;
            }
          } catch (error) {
            console.warn('Invalid date in summary:', dateStr, error);
          }
        });
      }
    });
    
    // Convert to array and ensure it has data
    const result = Object.values(dataByDay);
    // If no real data was aggregated, fallback to mock
    const hasData = result.some(day => day.distance > 0 || day.trips > 0);
    return hasData ? result : mockApi.getHistoricalData(days);
  },

  // Get geofences
  getGeofences: async () => {
    if (shouldUseMockData()) {
      // Return empty for mock data
      return [];
    }
    const result = await apiCall('/api/geofences');
    return result || [];
  },

  // Create geofence
  createGeofence: async (geofence: any) => {
    if (shouldUseMockData()) {
      return geofence;
    }
    const result = await apiCall('/api/geofences', {
      method: 'POST',
      body: JSON.stringify(geofence),
    });
    return result || geofence;
  },

  // Update geofence
  updateGeofence: async (id: number, geofence: any) => {
    if (shouldUseMockData()) {
      return geofence;
    }
    const result = await apiCall(`/api/geofences/${id}`, {
      method: 'PUT',
      body: JSON.stringify(geofence),
    });
    return result || geofence;
  },

  // Delete geofence
  deleteGeofence: async (id: number) => {
    if (shouldUseMockData()) {
      return null;
    }
    return apiCall(`/api/geofences/${id}`, {
      method: 'DELETE',
    });
  },

  // Get server info
  getServer: async () => {
    if (shouldUseMockData()) {
      return {
        id: 1,
        registration: true,
        readonly: false,
        map: 'osm',
        latitude: 0,
        longitude: 0,
        zoom: 0,
      };
    }
    const result = await apiCall('/api/server');
    return result || {
      id: 1,
      registration: true,
      readonly: false,
      map: 'osm',
      latitude: 0,
      longitude: 0,
      zoom: 0,
    };
  },
};
