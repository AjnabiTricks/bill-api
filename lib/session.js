// Credit: AZ Tricks (https://t.me/AZ_Tricks)

let sessionData = { cookies: '', lastUpdated: null };

const BASE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 16; SM-A065F) AppleWebKit/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
  'Origin': 'https://ccms.pitc.com.pk',
  'Referer': 'https://ccms.pitc.com.pk/complaint',
  'X-Requested-With': 'XMLHttpRequest',
  'sec-ch-ua': '"Not;A=Brand";v="8", "Chromium";v="150", "Android WebView";v="150"',
  'sec-ch-ua-mobile': '?1',
  'sec-ch-ua-platform': '"Android"'
};

async function initializeSession() {
  try {
    // Pehle complaint page visit karein
    const response = await fetch('https://ccms.pitc.com.pk/complaint', {
      method: 'GET',
      headers: BASE_HEADERS
    });

    const cookies = response.headers.get('set-cookie');
    if (cookies) {
      sessionData.cookies = cookies;
      sessionData.lastUpdated = Date.now();
      console.log('✅ Session initialized');
      return true;
    }
    
    // Agar cookie na mile toh XSRF token ke liye try karein
    const xsrfResponse = await fetch('https://ccms.pitc.com.pk/api/search', {
      method: 'GET',
      headers: BASE_HEADERS
    });
    
    const xsrfCookies = xsrfResponse.headers.get('set-cookie');
    if (xsrfCookies) {
      sessionData.cookies = xsrfCookies;
      sessionData.lastUpdated = Date.now();
      console.log('✅ Session initialized via XSRF');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('❌ Session init failed:', error);
    return false;
  }
}

async function refreshSessionIfNeeded() {
  const now = Date.now();
  const elapsed = (now - sessionData.lastUpdated) / 1000;
  
  if (!sessionData.cookies || elapsed > 1200) { // 20 minutes
    console.log('🔄 Refreshing session...');
    await initializeSession();
  }
  return sessionData.cookies;
}

export async function getHeaders() {
  const cookies = await refreshSessionIfNeeded();
  return {
    ...BASE_HEADERS,
    'Cookie': cookies || ''
  };
}

export async function authenticatedFetch(url, options = {}) {
  const headers = await getHeaders();
  
  let response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers
    }
  });

  // Agar 403/401 aaye toh session refresh karke retry karein
  if (response.status === 403 || response.status === 401) {
    console.log('🔄 Session expired, re-initializing...');
    await initializeSession();
    const newHeaders = await getHeaders();
    
    response = await fetch(url, {
      ...options,
      headers: {
        ...newHeaders,
        ...options.headers
      }
    });
  }

  // Update cookies from response
  const newCookies = response.headers.get('set-cookie');
  if (newCookies) {
    sessionData.cookies = newCookies;
    sessionData.lastUpdated = Date.now();
  }

  return response;
}

// Initialize on first load
initializeSession();
