// Credit: AZ Tricks (https://t.me/AZ_Tricks)

let sessionData = {
  cookies: '',
  lastUpdated: null
};

const BASE_HEADERS = {
  'X-Requested-With': 'XMLHttpRequest',
  'User-Agent': 'Mozilla/5.0 (Linux; Android 16; SM-A065F) AppleWebKit/537.36',
  'Origin': 'https://ccms.pitc.com.pk',
  'Referer': 'https://ccms.pitc.com.pk/complaint',
  'Accept': '*/*',
  'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
  'sec-ch-ua': '"Not;A=Brand";v="8", "Chromium";v="150", "Android WebView";v="150"',
  'sec-ch-ua-mobile': '?1',
  'sec-ch-ua-platform': '"Android"'
};

async function initializeSession() {
  try {
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
    return false;
  } catch (error) {
    console.error('❌ Session init failed:', error);
    return false;
  }
}

async function refreshSessionIfNeeded() {
  const now = Date.now();
  const elapsed = (now - sessionData.lastUpdated) / 1000;
  
  if (!sessionData.cookies || elapsed > 1500) {
    console.log('🔄 Refreshing session...');
    await initializeSession();
  }
  return sessionData.cookies;
}

export async function getHeaders() {
  const cookies = await refreshSessionIfNeeded();
  return {
    ...BASE_HEADERS,
    'Cookie': cookies
  };
}

export async function authenticatedFetch(url, options = {}) {
  const headers = await getHeaders();
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers
    }
  });

  if (response.status === 401 || response.status === 403) {
    console.log('🔄 Session expired, re-initializing...');
    await initializeSession();
    const newHeaders = await getHeaders();
    
    return fetch(url, {
      ...options,
      headers: {
        ...newHeaders,
        ...options.headers
      }
    });
  }

  const newCookies = response.headers.get('set-cookie');
  if (newCookies) {
    sessionData.cookies = newCookies;
    sessionData.lastUpdated = Date.now();
  }

  return response;
}

initializeSession();
