// Credit: AZ Tricks (https://t.me/AZ_Tricks)

let sessionData = {
  cookies: '',
  lastUpdated: null
};

// 🔹 Full browser headers
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'max-age=0'
};

// 🔹 Get fresh session
async function getFreshSession() {
  try {
    console.log('🔄 Getting fresh session...');
    
    // Step 1: GET complaint page
    const response = await fetch('https://ccms.pitc.com.pk/complaint', {
      method: 'GET',
      headers: BROWSER_HEADERS
    });

    // Extract cookies
    let cookies = [];
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      // Parse multiple cookies
      const cookieParts = setCookie.split(',').map(c => c.trim());
      for (const part of cookieParts) {
        const match = part.match(/^([^=]+)=([^;]+)/);
        if (match) {
          cookies.push(`${match[1]}=${match[2]}`);
        }
      }
    }

    // Step 2: Get CSRF token
    const html = await response.text();
    const tokenMatch = html.match(/name="_token" value="([^"]+)"/) ||
                      html.match(/csrf-token" content="([^"]+)"/) ||
                      html.match(/XSRF-TOKEN[^;]+;[\s]*value="([^"]+)"/);
    
    if (tokenMatch && tokenMatch[1]) {
      cookies.push(`XSRF-TOKEN=${encodeURIComponent(tokenMatch[1])}`);
      console.log('✅ CSRF token extracted');
    }

    if (cookies.length > 0) {
      sessionData.cookies = cookies.join('; ');
      sessionData.lastUpdated = Date.now();
      console.log('✅ Session created successfully');
      console.log(`📝 Cookies: ${sessionData.cookies}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error('❌ Session creation failed:', error);
    return false;
  }
}

// 🔹 Session refresh
async function ensureSession() {
  const now = Date.now();
  const elapsed = (now - sessionData.lastUpdated) / 1000;
  
  if (!sessionData.cookies || elapsed > 1200) {
    return await getFreshSession();
  }
  return true;
}

// 🔹 Get headers with cookies
export async function getHeaders(additionalHeaders = {}) {
  await ensureSession();
  
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Origin': 'https://ccms.pitc.com.pk',
    'Referer': 'https://ccms.pitc.com.pk/complaint',
    'X-Requested-With': 'XMLHttpRequest',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty',
    'Cookie': sessionData.cookies || '',
    ...additionalHeaders
  };
}

// 🔹 Authenticated fetch
export async function authenticatedFetch(url, options = {}) {
  const headers = await getHeaders(options.headers);
  
  let response = await fetch(url, {
    ...options,
    headers: headers
  });

  // If session expired, retry once
  if (response.status === 403 || response.status === 401) {
    console.log('🔄 Session expired, refreshing...');
    await getFreshSession();
    const newHeaders = await getHeaders(options.headers);
    
    response = await fetch(url, {
      ...options,
      headers: newHeaders
    });
  }

  // Update cookies if provided
  const newCookies = response.headers.get('set-cookie');
  if (newCookies) {
    const cookieMatch = newCookies.match(/^([^=]+)=([^;]+)/);
    if (cookieMatch) {
      const currentCookies = sessionData.cookies.split('; ').filter(c => !c.startsWith(cookieMatch[1]+'='));
      currentCookies.push(`${cookieMatch[1]}=${cookieMatch[2]}`);
      sessionData.cookies = currentCookies.join('; ');
      sessionData.lastUpdated = Date.now();
    }
  }

  return response;
}

// 🔹 Health check
export async function checkSession() {
  const active = await ensureSession();
  return {
    active: active,
    hasCookies: !!sessionData.cookies,
    cookies: sessionData.cookies || 'none',
    lastUpdated: sessionData.lastUpdated ? new Date(sessionData.lastUpdated).toISOString() : 'never'
  };
}

// Auto initialize on first load
getFreshSession();
