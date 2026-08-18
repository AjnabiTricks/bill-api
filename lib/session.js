// Credit: AZ Tricks (https://t.me/AZ_Tricks)

// 🔹 Use CORS proxy to bypass IP block
const PROXY_BASE = 'https://corsproxy.io/?url=';

let sessionData = {
  cookies: '',
  lastUpdated: null
};

// 🔹 Get session via proxy
async function initializeSession() {
  try {
    console.log('🔄 Initializing session via proxy...');

    // Use proxy to visit complaint page
    const response = await fetch(`${PROXY_BASE}https://ccms.pitc.com.pk/complaint`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const html = await response.text();
    
    // Extract CSRF token
    const tokenMatch = html.match(/name="_token" value="([^"]+)"/) ||
                      html.match(/csrf-token" content="([^"]+)"/);
    
    if (tokenMatch && tokenMatch[1]) {
      sessionData.cookies = `XSRF-TOKEN=${encodeURIComponent(tokenMatch[1])}`;
      sessionData.lastUpdated = Date.now();
      console.log('✅ Session initialized via proxy');
      return true;
    }

    return false;
  } catch (error) {
    console.error('❌ Proxy session failed:', error);
    return false;
  }
}

// 🔹 Authenticated fetch with proxy
export async function authenticatedFetch(url, options = {}) {
  // Initialize if needed
  if (!sessionData.cookies) {
    await initializeSession();
  }

  // Use proxy for all requests
  const proxyUrl = `${PROXY_BASE}${url}`;
  
  const response = await fetch(proxyUrl, {
    method: options.method || 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Cookie': sessionData.cookies || '',
      ...options.headers
    },
    body: options.body
  });

  return response;
}

export async function checkSession() {
  return {
    active: !!sessionData.cookies,
    hasCookies: !!sessionData.cookies,
    lastUpdated: sessionData.lastUpdated ? new Date(sessionData.lastUpdated).toISOString() : 'never'
  };
}

// Auto initialize
initializeSession();
