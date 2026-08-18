// Credit: AZ Tricks (https://t.me/AZ_Tricks)

// 🔹 Hardcoded cookies (Browser se copy karein)
// Steps: Browser mein https://ccms.pitc.com.pk/complaint open karein
//        F12 → Application → Cookies → Copy all cookies as string
const HARDCODED_COOKIES = 'XSRF-TOKEN=eyJpdiI6IktqRmFiczJ1QlRpeVdOMElaeVZ0cXc9PSIsInZhbHVlIjoiQkUxc3dhdldBYThpSjNGKzUxODRXc1ZSWG5pTjcyZHFSM3hVRkhjMnozWTVNaHJhR0ljbXJnZktXdldYTEw5SSIsIm1hYyI6IjkyYmEwNjQ4ZDY4OTI3YmZlM2IzNDVkZDFjMzU2ZTUyMDAyN2NkOWI2OGM4NjMxYjE1MmRmZjFkZGZhMjRkZGIifQ%3D%3D; cookiesession1=678B28D422443C697F8FC03A14985CFF; ccms_session=eyJpdiI6IkhOaW10VVhLbHo2U2xPazFlZENOM0E9PSIsInZhbHVlIjoiSU02eTNCckpFK3NuaTdJdmNKeE1RZmUwc25lc0xzVjVpRU9iN2I2eThSZXBLZ21EckRIRHhrak42dEhMODRiSCIsIm1hYyI6IjRjMTEwODRkOGNjODUzOWFhNGMwMzE5ZWU4Mzk2YTJjMjQ5ZmEzZWRkMDAzNTI0MmM5OGFjMThiOWRmNDVhYjAifQ%3D%3D';

let sessionData = {
  cookies: HARDCODED_COOKIES,
  lastUpdated: Date.now()
};

const BASE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 16; SM-A065F) AppleWebKit/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
  'Origin': 'https://ccms.pitc.com.pk',
  'Referer': 'https://ccms.pitc.com.pk/complaint',
  'X-Requested-With': 'XMLHttpRequest',
  'sec-ch-ua': '"Not;A=Brand";v="8", "Chromium";v="150", "Android WebView";v="150"',
  'sec-ch-ua-mobile': '?1',
  'sec-ch-ua-platform': '"Android"',
  'Cache-Control': 'no-cache'
};

export async function getHeaders() {
  return {
    ...BASE_HEADERS,
    'Cookie': sessionData.cookies
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
    console.log('🔄 Session expired, refreshing...');
    // Naya session lene ki koshish karein
    const newSession = await fetch('https://ccms.pitc.com.pk/complaint', {
      method: 'GET',
      headers: BASE_HEADERS
    });
    
    const newCookies = newSession.headers.get('set-cookie');
    if (newCookies) {
      sessionData.cookies = newCookies;
      sessionData.lastUpdated = Date.now();
      
      // Retry with new cookies
      const newHeaders = await getHeaders();
      response = await fetch(url, {
        ...options,
        headers: {
          ...newHeaders,
          ...options.headers
        }
      });
    }
  }

  // Update cookies from response (agar set-cookie aaye toh)
  const newCookies = response.headers.get('set-cookie');
  if (newCookies) {
    sessionData.cookies = newCookies;
    sessionData.lastUpdated = Date.now();
  }

  return response;
}
