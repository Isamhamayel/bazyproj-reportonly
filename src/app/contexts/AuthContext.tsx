import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface User {
  id: number;
  name: string;
  email: string;
  administrator: boolean;
  readonly: boolean;
}

interface TraccarSession {
  serverUrl: string;
  user: User;
  credentials: string; // Base64 encoded credentials
}

interface AuthContextType {
  user: User | null;
  serverUrl: string | null;
  login: (serverUrl: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isAuthenticated: boolean;
  getAuthHeader: () => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

const SESSION_KEY = 'traccar_session';

// Helper function to safely encode credentials with Unicode support
const encodeCredentials = (email: string, password: string): string => {
  try {
    // First encode to UTF-8, then to base64
    const str = `${email}:${password}`;
    // Use TextEncoder for proper UTF-8 encoding
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    // Convert to base64 using a binary string approach
    let binary = '';
    data.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  } catch (error) {
    console.error('Encoding error:', error);
    // Fallback: remove non-ASCII characters and try again
    const str = `${email}:${password}`.replace(/[^\x00-\x7F]/g, '');
    return btoa(str);
  }
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<TraccarSession | null>(null);

  useEffect(() => {
    // Check for stored session
    const storedSession = localStorage.getItem(SESSION_KEY);
    if (storedSession) {
      try {
        setSession(JSON.parse(storedSession));
      } catch (error) {
        console.error('Failed to parse stored session:', error);
        localStorage.removeItem(SESSION_KEY);
      }
    }
  }, []);

  const login = async (serverUrl: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // Clean up server URL and ensure it has protocol
      let cleanUrl = serverUrl.trim().replace(/\/+$/, '');
      
      // Add https:// if no protocol specified
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = `https://${cleanUrl}`;
      }
      
      console.log('Attempting login to:', cleanUrl);
      
      // Create Basic Auth credentials with Unicode support
      const credentials = encodeCredentials(email, password);
      
      // Authenticate with Traccar API using POST to /api/session
      // According to Traccar API docs, we should send email and password in the body
      const response = await fetch(`${cleanUrl}/api/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: `email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
        // Add mode to handle CORS
        mode: 'cors',
        // Add credentials to handle cookies
        credentials: 'include',
      });

      console.log('Login response status:', response.status);

      if (!response.ok) {
        if (response.status === 401) {
          return { success: false, error: 'Invalid username/email or password' };
        } else if (response.status === 404) {
          return { success: false, error: 'Server not found. Please check the URL.' };
        } else if (response.status === 415) {
          return { success: false, error: 'Server configuration error. Please contact your administrator.' };
        } else {
          const errorText = await response.text().catch(() => '');
          console.error('Server error response:', errorText);
          return { success: false, error: `Server error: ${response.status}` };
        }
      }

      const userData = await response.json();
      console.log('Login successful, user:', userData.email);
      
      const newSession: TraccarSession = {
        serverUrl: cleanUrl,
        user: userData,
        credentials: credentials,
      };

      setSession(newSession);
      localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
      
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack,
        });
        
        if (error.message.includes('btoa') || error.message.includes('Latin1')) {
          return { 
            success: false, 
            error: 'Invalid characters in email or password. Please use only standard characters.' 
          };
        }
        if (error.message.includes('Failed to fetch')) {
          return { 
            success: false, 
            error: 'Cannot connect to server. This could be due to:\n• Wrong server URL\n• CORS not enabled on server\n• Server is down\n• Network firewall blocking connection\n\nPlease check the URL (e.g., https://go.bazytrack.jo) and ensure the server is accessible.' 
          };
        }
        if (error.message.includes('NetworkError')) {
          return { 
            success: false, 
            error: 'Network error. Please check your internet connection.' 
          };
        }
      }
      return { 
        success: false, 
        error: 'An unexpected error occurred. Please try again.' 
      };
    }
  };

  const logout = () => {
    setSession(null);
    localStorage.removeItem(SESSION_KEY);
  };

  const getAuthHeader = (): string => {
    return session ? `Basic ${session.credentials}` : '';
  };

  return (
    <AuthContext.Provider
      value={{
        user: session?.user || null,
        serverUrl: session?.serverUrl || null,
        login,
        logout,
        isAuthenticated: !!session,
        getAuthHeader,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}