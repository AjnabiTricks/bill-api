// Credit: AZ Tricks (https://t.me/AZ_Tricks)

let sessionData = {
  cookies: '',
  lastUpdated: null,
  xsrfToken: ''
};

const BASE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Origin': 'https://ccms.pitc.com.pk',
  'Referer': 'https://ccms.pitc.com.pk/complaint',
  'X-Requested-With': 'XMLHttpRequest',
  'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Dest': 'empty',
  'Connection': 'keep-alive'
};

// 🔹 Step 1: Get CSRF Token from page
async function getCSRFToken() {
  try {
    const response = await fetch('https://ccms.pitc.com.pk/complaint', {
      method: 'GET',
      headers: BASE_HEADERS
    });

    const html = await response.text();
    
    // Extract CSRF token from HTML
    const tokenMatch = html.match(/name="_token" value="([^"]+)"/) || 
                      html.match(/XSRF-TOKEN[^;]+;[\s]*value="([^"]+)"/) ||
                      html.match(/csrf-token" content="([^"]+)"/);
    
    if (tokenMatch && tokenMatch[1]) {
      console.log('✅ CSRF Token found');
      return tokenMatch[1];
    }
    
    // Agar HTML mein na mile toh cookie se lein
    const cookies = response.headers.get('set-cookie');
    if (cookies) {
      const xsrfMatch = cookies.match(/XSRF-TOKEN=([^;]+)/);
      if (xsrfMatch) {
        console.log('✅ XSRF Token from cookie');
        return decodeURIComponent(xsrfMatch[1]);
      }
    }
    
    return null;
  } catch (error) {
    console.error('❌ Token fetch failed:', error);
    return null;
  }
}

// 🔹 Step 2: Initialize Full Session
async function initializeSession() {
  try {
    console.log('🔄 Initializing new session...');
    
    // Visit complaint page
    const response = await fetch('https://ccms.pitc.com.pk/complaint', {
      method: 'GET',
      headers: BASE_HEADERS
    });

    // Collect all cookies
    let allCookies = '';
    const setCookieHeaders = response.headers.get('set-cookie');
    if (setCookieHeaders) {
      allCookies = setCookieHeaders;
    }

    // Get CSRF token
    const token = await getCSRFToken();
    if (token) {
      sessionData.xsrfToken = token;
      // Add token to cookies if not present
      if (!allCookies.includes('XSRF-TOKEN')) {
        allCookies = allCookies ? `${allCookies}; XSRF-TOKEN=${encodeURIComponent(token)}` : `XSRF-TOKEN=${encodeURIComponent(token)}`;
      }
    }

    if (allCookies) {
      sessionData.cookies = allCookies;
      sessionData.lastUpdated = Date.now();
      console.log('✅ Session initialized successfully');
      return true;
    }

    // 🔹 Fallback: Try to get session via API call
    return await fallbackSessionInit();
    
  } catch (error) {
    console.error('❌ Session init failed:', error);
    return false;
  }
}

// 🔹 Step 3: Fallback - Direct API hit
async function fallbackSessionInit() {
  try {
    console.log('🔄 Trying fallback session init...');
    
    const response = await fetch('https://ccms.pitc.com.pk/api/search', {
      method: 'POST',
      headers: {
        ...BASE_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
      },
      body: new URLSearchParams({ reference: 'test' })
    });

    const cookies = response.headers.get('set-cookie');
    if (cookies) {
      sessionData.cookies = cookies;
      sessionData.lastUpdated = Date.now();
      console.log('✅ Fallback session initialized');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('❌ Fallback failed:', error);
    return false;
  }
}

// 🔹 Step 4: Refresh if needed
async function refreshSessionIfNeeded() {
  const now = Date.now();
  const elapsed = (now - sessionData.lastUpdated) / 1000;
  
  if (!sessionData.cookies || elapsed > 1200) { // 20 minutes
    console.log('🔄 Session expired or missing, creating new...');
    return await initializeSession();
  }
  return true;
}

// 🔹 Step 5: Get Headers with cookies
export async function getHeaders() {
  await refreshSessionIfNeeded();
  return {
    ...BASE_HEADERS,
    'Cookie': sessionData.cookies || '',
    'X-XSRF-TOKEN': sessionData.xsrfToken || ''
  };
}

// 🔹 Step 6: Authenticated fetch with auto-retry
export async function authenticatedFetch(url, options = {}) {
  let headers = await getHeaders();
  
  let response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers
    }
  });

  // If session expired, retry once
  if (response.status === 403 || response.status === 401 || response.status === 419) {
    console.log('🔄 Session expired, re-initializing...');
    await initializeSession();
    headers = await getHeaders();
    
    response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
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

// 🔹 Auto-initialize on first load
initializeSession();

// 🔹 Health check function
export async function checkSession() {
  const status = await refreshSessionIfNeeded();
  return {
    active: status,
    hasCookies: !!sessionData.cookies,
    lastUpdated: sessionData.lastUpdated ? new Date(sessionData.lastUpdated).toISOString() : 'never'
  };
}
