// Session debugging utility
export const debugSession = () => {
  const stored = localStorage.getItem('traccar_session');
  
  if (!stored) {
    console.log('🔍 Session Debug: No session found in localStorage');
    return;
  }

  try {
    const session = JSON.parse(stored);
    console.log('🔍 Session Debug:', {
      serverUrl: session.serverUrl,
      userEmail: session.user?.email,
      userName: session.user?.name,
      hasCredentials: !!session.credentials,
      credentialsLength: session.credentials?.length,
    });

    // Test if we can make a simple API call
    console.log('🔍 Testing API connectivity...');
    fetch(`${session.serverUrl}/api/server`, {
      headers: {
        'Authorization': `Basic ${session.credentials}`,
        'Accept': 'application/json',
      },
      credentials: 'include',
      mode: 'cors',
    })
      .then(response => {
        console.log('🔍 API Test Result:', {
          status: response.status,
          ok: response.ok,
          statusText: response.statusText,
        });
        if (response.ok) {
          return response.json();
        }
        throw new Error(`API returned ${response.status}`);
      })
      .then(data => {
        console.log('✅ API Test Success:', data);
      })
      .catch(error => {
        console.warn('⚠️ API Test Failed:', error);
      });
  } catch (error) {
    console.error('🔍 Session Debug Error:', error);
  }
};

// Make debugSession available in console but don't auto-run
// To debug session, open console and type: window.debugSession()
if (typeof window !== 'undefined') {
  (window as any).debugSession = debugSession;
}