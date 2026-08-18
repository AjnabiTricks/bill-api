// Credit: AZ Tricks (https://t.me/AZ_Tricks)
import https from 'https';

let sessionData = {
  cookies: '',
  lastUpdated: null
};

const BASE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1'
};

// 🔹 Promise-based HTTPS request
function httpsRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

// 🔹 Step 1: Get Session
async function initializeSession() {
  try {
    console.log('🔄 Initializing session...');

    // First visit complaint page
    const response = await httpsRequest('https://ccms.pitc.com.pk/complaint', {
      method: 'GET',
      headers: BASE_HEADERS
    });

    // Collect all cookies
    let cookies = [];
    if (response.headers['set-cookie']) {
      const cookieHeaders = Array.isArray(response.headers['set-cookie']) 
        ? response.headers['set-cookie'] 
        : [response.headers['set-cookie']];
      
      cookieHeaders.forEach(cookie => {
        // Extract cookie name and value
        const match = cookie.match(/^([^=]+)=([^;]+)/);
        if (match) {
          cookies.push(`${match[1]}=${match[2]}`);
        }
      });
    }

    // Extract CSRF from HTML
    const html = response.body;
    let csrfToken = null;
    
    // Try multiple patterns
    const patterns = [
      /name="_token" value="([^"]+)"/,
      /name="csrf-token" content="([^"]+)"/,
      /"csrfToken":"([^"]+)"/,
      /XSRF-TOKEN[^;]+;[\s]*value="([^"]+)"/
    ];
    
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        csrfToken = match[1];
        break;
      }
    }

    if (csrfToken) {
      cookies.push(`XSRF-TOKEN=${encodeURIComponent(csrfToken)}`);
      console.log('✅ CSRF Token found');
    }

    if (cookies.length > 0) {
      sessionData.cookies = cookies.join('; ');
      sessionData.lastUpdated = Date.now();
      console.log('✅ Session initialized successfully');
      console.log(`📝 Cookies: ${sessionData.cookies}`);
      return true;
    }

    // 🔹 Fallback: Try API
    return await fallbackSessionInit();

  } catch (error) {
    console.error('❌ Session init failed:', error);
    return false;
  }
}

// 🔹 Fallback: Direct API hit
async function fallbackSessionInit() {
  try {
    console.log('🔄 Trying fallback session...');
    
    const response = await httpsRequest('https://ccms.pitc.com.pk/api/search', {
      method: 'POST',
      headers: {
        ...BASE_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Origin': 'https://ccms.pitc.com.pk',
        'Referer': 'https://ccms.pitc.com.pk/complaint'
      },
      body: new URLSearchParams({ reference: 'test' }).toString()
    });

    if (response.headers['set-cookie']) {
      const cookieHeaders = Array.isArray(response.headers['set-cookie']) 
        ? response.headers['set-cookie'] 
        : [response.headers['set-cookie']];
      
      let cookies = [];
      cookieHeaders.forEach(cookie => {
        const match = cookie.match(/^([^=]+)=([^;]+)/);
        if (match) {
          cookies.push(`${match[1]}=${match[2]}`);
        }
      });
      
      if (cookies.length > 0) {
        sessionData.cookies = cookies.join('; ');
        sessionData.lastUpdated = Date.now();
        console.log('✅ Fallback session initialized');
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('❌ Fallback failed:', error);
    return false;
  }
}

// 🔹 Check and refresh session
async function refreshSessionIfNeeded() {
  const now = Date.now();
  const elapsed = (now - sessionData.lastUpdated) / 1000;
  
  if (!sessionData.cookies || elapsed > 1200) {
    console.log('🔄 Refreshing session...');
    return await initializeSession();
  }
  return true;
}

// 🔹 Get headers with cookies
export async function getHeaders() {
  await refreshSessionIfNeeded();
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Origin': 'https://ccms.pitc.com.pk',
    'Referer': 'https://ccms.pitc.com.pk/complaint',
    'X-Requested-With': 'XMLHttpRequest',
    'Cookie': sessionData.cookies || '',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"'
  };
}

// 🔹 Authenticated fetch with retry
export async function authenticatedFetch(url, options = {}) {
  let headers = await getHeaders();
  
  let response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers
    }
  });

  // If unauthorized, retry once
  if (response.status === 403 || response.status === 401) {
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

  // Update cookies
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
  const status = await refreshSessionIfNeeded();
  return {
    active: status,
    hasCookies: !!sessionData.cookies,
    lastUpdated: sessionData.lastUpdated ? new Date(sessionData.lastUpdated).toISOString() : 'never'
  };
}

// Auto initialize
initializeSession();
