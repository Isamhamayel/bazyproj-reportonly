// Mock data representing Traccar API responses
// Replace with actual API calls to your BazyTrackGo backend

export interface Device {
  id: number;
  name: string;
  uniqueId: string;
  status: 'online' | 'offline' | 'idle';
  lastUpdate: string;
  position?: Position;
  category: string;
}

export interface Position {
  id: number;
  deviceId: number;
  latitude: number;
  longitude: number;
  speed: number;
  course: number;
  address?: string;
  attributes: {
    ignition?: boolean;
    fuel?: number;
    battery?: number;
    odometer?: number;
  };
  fixTime: string;
}

export interface Trip {
  id: number;
  deviceId: number;
  deviceName: string;
  startTime: string;
  endTime: string;
  distance: number;
  duration: number;
  maxSpeed: number;
  avgSpeed: number;
  startAddress: string;
  endAddress: string;
}

export interface Event {
  id: number;
  deviceId: number;
  deviceName: string;
  type: 'geofenceEnter' | 'geofenceExit' | 'alarm' | 'deviceOverspeed' | 'deviceMoving' | 'deviceStopped';
  eventTime: string;
  positionId?: number; // Reference to the position
  position?: Position; // The full position object with speed, address, etc.
  attributes?: any;
}

export interface Summary {
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  idleDevices: number;
  todayDistance: number;
  todayTrips: number;
  activeAlerts: number;
  fuelConsumed: number;
}

// Mock devices data
const mockDevices: Device[] = [
  {
    id: 1,
    name: "Vehicle-001 (Delivery Van)",
    uniqueId: "VEH001",
    status: "online",
    lastUpdate: new Date(Date.now() - 5 * 60000).toISOString(),
    category: "van",
    position: {
      id: 1,
      deviceId: 1,
      latitude: 40.7128,
      longitude: -74.0060,
      speed: 45,
      course: 135,
      address: "Broadway, New York, NY",
      attributes: { ignition: true, fuel: 75, battery: 98, odometer: 45230 },
      fixTime: new Date(Date.now() - 5 * 60000).toISOString(),
    }
  },
  {
    id: 2,
    name: "Vehicle-002 (Truck)",
    uniqueId: "VEH002",
    status: "idle",
    lastUpdate: new Date(Date.now() - 15 * 60000).toISOString(),
    category: "truck",
    position: {
      id: 2,
      deviceId: 2,
      latitude: 40.7580,
      longitude: -73.9855,
      speed: 0,
      course: 0,
      address: "Times Square, New York, NY",
      attributes: { ignition: true, fuel: 60, battery: 95, odometer: 67890 },
      fixTime: new Date(Date.now() - 15 * 60000).toISOString(),
    }
  },
  {
    id: 3,
    name: "Vehicle-003 (Sedan)",
    uniqueId: "VEH003",
    status: "online",
    lastUpdate: new Date(Date.now() - 2 * 60000).toISOString(),
    category: "car",
    position: {
      id: 3,
      deviceId: 3,
      latitude: 40.6782,
      longitude: -73.9442,
      speed: 35,
      course: 270,
      address: "Brooklyn, NY",
      attributes: { ignition: true, fuel: 40, battery: 92, odometer: 34567 },
      fixTime: new Date(Date.now() - 2 * 60000).toISOString(),
    }
  },
  {
    id: 4,
    name: "Vehicle-004 (SUV)",
    uniqueId: "VEH004",
    status: "offline",
    lastUpdate: new Date(Date.now() - 120 * 60000).toISOString(),
    category: "suv",
  },
  {
    id: 5,
    name: "Vehicle-005 (Van)",
    uniqueId: "VEH005",
    status: "online",
    lastUpdate: new Date(Date.now() - 1 * 60000).toISOString(),
    category: "van",
    position: {
      id: 5,
      deviceId: 5,
      latitude: 40.7489,
      longitude: -73.9680,
      speed: 28,
      course: 90,
      address: "Queens, NY",
      attributes: { ignition: true, fuel: 85, battery: 100, odometer: 23456 },
      fixTime: new Date(Date.now() - 1 * 60000).toISOString(),
    }
  },
];

const mockTrips: Trip[] = [
  {
    id: 1,
    deviceId: 1,
    deviceName: "Vehicle-001 (Delivery Van)",
    startTime: new Date(Date.now() - 180 * 60000).toISOString(),
    endTime: new Date(Date.now() - 60 * 60000).toISOString(),
    distance: 45.5,
    duration: 120,
    maxSpeed: 85,
    avgSpeed: 42,
    startAddress: "Warehouse A, Industrial Park",
    endAddress: "Customer Location, Manhattan",
  },
  {
    id: 2,
    deviceId: 2,
    deviceName: "Vehicle-002 (Truck)",
    startTime: new Date(Date.now() - 240 * 60000).toISOString(),
    endTime: new Date(Date.now() - 90 * 60000).toISOString(),
    distance: 67.8,
    duration: 150,
    maxSpeed: 75,
    avgSpeed: 38,
    startAddress: "Distribution Center",
    endAddress: "Retail Store, Brooklyn",
  },
  {
    id: 3,
    deviceId: 3,
    deviceName: "Vehicle-003 (Sedan)",
    startTime: new Date(Date.now() - 120 * 60000).toISOString(),
    endTime: new Date(Date.now() - 30 * 60000).toISOString(),
    distance: 28.3,
    duration: 90,
    maxSpeed: 65,
    avgSpeed: 35,
    startAddress: "Office Building",
    endAddress: "Client Meeting Point",
  },
];

const mockEvents: Event[] = [
  {
    id: 1,
    deviceId: 1,
    deviceName: "Vehicle-001 (Delivery Van)",
    type: "deviceOverspeed",
    eventTime: new Date(Date.now() - 30 * 60000).toISOString(),
    positionId: 101,
    position: {
      id: 101,
      deviceId: 1,
      latitude: 40.7488,
      longitude: -73.9857,
      speed: 92,
      course: 135,
      address: "Main Street, New York, NY",
      attributes: { ignition: true, fuel: 72, battery: 97, odometer: 45250 },
      fixTime: new Date(Date.now() - 30 * 60000).toISOString(),
    },
    attributes: { 
      speed: 92,
      speedLimit: 65,
      address: "Main Street, New York, NY"
    },
  },
  {
    id: 2,
    deviceId: 2,
    deviceName: "Vehicle-002 (Truck)",
    type: "geofenceEnter",
    eventTime: new Date(Date.now() - 180 * 60000).toISOString(),
    positionId: 102,
    position: {
      id: 102,
      deviceId: 2,
      latitude: 40.6545,
      longitude: -73.9557,
      speed: 35,
      course: 270,
      address: "123 Industrial Blvd, Brooklyn, NY",
      attributes: { ignition: true, fuel: 58, battery: 94, odometer: 67920 },
      fixTime: new Date(Date.now() - 180 * 60000).toISOString(),
    },
    attributes: { 
      geofenceId: 1,
      geofenceName: "Delivery Zone A",
      address: "123 Industrial Blvd, Brooklyn, NY"
    },
  },
  {
    id: 3,
    deviceId: 3,
    deviceName: "Vehicle-003 (Sedan)",
    type: "alarm",
    eventTime: new Date(Date.now() - 60 * 60000).toISOString(),
    positionId: 103,
    position: {
      id: 103,
      deviceId: 3,
      latitude: 40.7614,
      longitude: -73.9776,
      speed: 0,
      course: 0,
      address: "456 Park Avenue, Manhattan, NY",
      attributes: { ignition: false, fuel: 38, battery: 91, odometer: 34580 },
      fixTime: new Date(Date.now() - 60 * 60000).toISOString(),
    },
    attributes: { 
      alarm: "vibration",
      address: "456 Park Avenue, Manhattan, NY"
    },
  },
  {
    id: 4,
    deviceId: 2,
    deviceName: "Vehicle-002 (Truck)",
    type: "geofenceExit",
    eventTime: new Date(Date.now() - 90 * 60000).toISOString(),
    positionId: 104,
    position: {
      id: 104,
      deviceId: 2,
      latitude: 40.6548,
      longitude: -73.9560,
      speed: 28,
      course: 90,
      address: "123 Industrial Blvd, Brooklyn, NY",
      attributes: { ignition: true, fuel: 59, battery: 95, odometer: 67910 },
      fixTime: new Date(Date.now() - 90 * 60000).toISOString(),
    },
    attributes: { 
      geofenceId: 1,
      geofenceName: "Delivery Zone A",
      address: "123 Industrial Blvd, Brooklyn, NY"
    },
  },
  {
    id: 5,
    deviceId: 1,
    deviceName: "Vehicle-001 (Delivery Van)",
    type: "geofenceEnter",
    eventTime: new Date(Date.now() - 120 * 60000).toISOString(),
    positionId: 105,
    position: {
      id: 105,
      deviceId: 1,
      latitude: 40.7489,
      longitude: -73.9680,
      speed: 42,
      course: 180,
      address: "789 Business Park, Queens, NY",
      attributes: { ignition: true, fuel: 80, battery: 99, odometer: 45210 },
      fixTime: new Date(Date.now() - 120 * 60000).toISOString(),
    },
    attributes: { 
      geofenceId: 2,
      geofenceName: "Customer Hub B",
      address: "789 Business Park, Queens, NY"
    },
  },
  {
    id: 6,
    deviceId: 1,
    deviceName: "Vehicle-001 (Delivery Van)",
    type: "geofenceExit",
    eventTime: new Date(Date.now() - 45 * 60000).toISOString(),
    positionId: 106,
    position: {
      id: 106,
      deviceId: 1,
      latitude: 40.7492,
      longitude: -73.9682,
      speed: 38,
      course: 45,
      address: "789 Business Park, Queens, NY",
      attributes: { ignition: true, fuel: 78, battery: 98, odometer: 45240 },
      fixTime: new Date(Date.now() - 45 * 60000).toISOString(),
    },
    attributes: { 
      geofenceId: 2,
      geofenceName: "Customer Hub B",
      address: "789 Business Park, Queens, NY"
    },
  },
  {
    id: 7,
    deviceId: 3,
    deviceName: "Vehicle-003 (Sedan)",
    type: "deviceMoving",
    eventTime: new Date(Date.now() - 15 * 60000).toISOString(),
    positionId: 107,
    position: {
      id: 107,
      deviceId: 3,
      latitude: 40.7169,
      longitude: -74.0090,
      speed: 48,
      course: 225,
      address: "234 Broadway, Manhattan, NY",
      attributes: { ignition: true, fuel: 42, battery: 93, odometer: 34595 },
      fixTime: new Date(Date.now() - 15 * 60000).toISOString(),
    },
    attributes: { 
      address: "234 Broadway, Manhattan, NY"
    },
  },
  {
    id: 8,
    deviceId: 4,
    deviceName: "Vehicle-004 (SUV)",
    type: "alarm",
    eventTime: new Date(Date.now() - 240 * 60000).toISOString(),
    positionId: 108,
    position: {
      id: 108,
      deviceId: 4,
      latitude: 40.7550,
      longitude: -73.9842,
      speed: 0,
      course: 0,
      address: "567 5th Avenue, Manhattan, NY",
      attributes: { ignition: false, fuel: 45, battery: 88, odometer: 56230 },
      fixTime: new Date(Date.now() - 240 * 60000).toISOString(),
    },
    attributes: { 
      alarm: "sos",
      address: "567 5th Avenue, Manhattan, NY"
    },
  },
];

// Mock API functions
export const traccarApi = {
  // Get all devices
  getDevices: async (): Promise<Device[]> => {
    await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay
    return mockDevices;
  },

  // Get single device
  getDevice: async (id: number): Promise<Device | undefined> => {
    await new Promise(resolve => setTimeout(resolve, 200));
    return mockDevices.find(d => d.id === id);
  },

  // Get positions for all devices
  getPositions: async (): Promise<Position[]> => {
    await new Promise(resolve => setTimeout(resolve, 300));
    return mockDevices.map(d => d.position).filter(Boolean) as Position[];
  },

  // Get trips for a device
  getTrips: async (deviceId?: number, from?: string, to?: string): Promise<Trip[]> => {
    await new Promise(resolve => setTimeout(resolve, 400));
    return deviceId ? mockTrips.filter(t => t.deviceId === deviceId) : mockTrips;
  },

  // Get events
  getEvents: async (deviceId?: number, from?: string, to?: string): Promise<Event[]> => {
    await new Promise(resolve => setTimeout(resolve, 300));
    return deviceId ? mockEvents.filter(e => e.deviceId === deviceId) : mockEvents;
  },

  // Get summary statistics
  getSummary: async (): Promise<Summary> => {
    await new Promise(resolve => setTimeout(resolve, 200));
    const online = mockDevices.filter(d => d.status === 'online').length;
    const offline = mockDevices.filter(d => d.status === 'offline').length;
    const idle = mockDevices.filter(d => d.status === 'idle').length;
    
    return {
      totalDevices: mockDevices.length,
      onlineDevices: online,
      offlineDevices: offline,
      idleDevices: idle,
      todayDistance: 245.7,
      todayTrips: 18,
      activeAlerts: 3,
      fuelConsumed: 127.5,
    };
  },

  // Get historical data for charts
  getHistoricalData: async (days: number = 7) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];
      data.push({
        id: `hist-${dateString}-${i}`, // Unique ID combining date and index
        date: dateString,
        distance: Math.floor(Math.random() * 500) + 200,
        trips: Math.floor(Math.random() * 30) + 10,
        fuel: Math.floor(Math.random() * 150) + 80,
        alerts: Math.floor(Math.random() * 10),
      });
    }
    return data;
  },
};