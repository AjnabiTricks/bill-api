// Credit: AZ Tricks (https://t.me/AZ_Tricks)

// 🔹 Use a working proxy API
const PROXY_API = 'https://api.allorigins.win/raw?url=';

let sessionData = {
  cookies: '',
  lastUpdated: null
};

async function getSession() {
  try {
    console.log('🔄 Getting session via proxy...');
    
    // Get page via proxy
    const response = await fetch(`${PROXY_API}https://ccms.pitc.com.pk/complaint`, {
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
      console.log('✅ Session created via proxy');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('❌ Proxy failed:', error);
    return false;
  }
}

export async function authenticatedFetch(url, options = {}) {
  if (!sessionData.cookies) {
    await getSession();
  }
  
  // Use proxy for all requests
  const proxyUrl = `${PROXY_API}${url}`;
  
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

getSession();
