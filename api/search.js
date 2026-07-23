// 🔒 Persistent session storage (in-memory)
let sessionCookies = '';
let sessionExpiry = null;
let isRefreshing = false;

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Get search parameter
    let searchValue;
    if (req.method === 'GET') {
      searchValue = req.query.search || req.query.reference || req.query.cnic || req.query.mobile;
    } else if (req.method === 'POST') {
      searchValue = req.body.search || req.body.reference || req.body.cnic || req.body.mobile;
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!searchValue) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a search parameter'
      });
    }

    // Smart detection
    let requestBody = '';
    let searchType = 'reference';
    const cleanValue = searchValue.replace(/[-\s]/g, '');
    
    if (/^[3-4]\d{12}$/.test(cleanValue)) {
      requestBody = `cnic=${encodeURIComponent(cleanValue)}`;
      searchType = 'cnic';
    } else if (/^(92|03)\d{9,10}$/.test(cleanValue)) {
      const mobile = cleanValue.replace(/^0/, '92');
      requestBody = `mobile=${encodeURIComponent(mobile)}`;
      searchType = 'mobile';
    } else {
      requestBody = `reference=${encodeURIComponent(searchValue)}`;
      searchType = 'reference';
    }

    console.log('🔍 Searching:', { searchValue, searchType });

    // ===== GET OR REFRESH SESSION =====
    if (!sessionCookies || isSessionExpired()) {
      console.log('🔄 Getting fresh session...');
      await refreshSession();
    }

    // ===== MAKE SEARCH REQUEST =====
    const response = await fetch('https://ccms.pitc.com.pk/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://ccms.pitc.com.pk',
        'Referer': 'https://ccms.pitc.com.pk/complaint',
        'Connection': 'keep-alive',
        'Cookie': sessionCookies
      },
      body: requestBody
    });

    const responseText = await response.text();
    
    // ✅ Update cookies if new ones come
    const newCookies = response.headers.get('set-cookie');
    if (newCookies) {
      updateCookies(newCookies);
    }

    // Check if response is HTML (session expired)
    if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
      console.log('⚠️ Session expired during request, refreshing...');
      
      // Force refresh session and retry
      await refreshSession(true);
      
      // Retry the request with new session
      const retryResponse = await fetch('https://ccms.pitc.com.pk/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Origin': 'https://ccms.pitc.com.pk',
          'Referer': 'https://ccms.pitc.com.pk/complaint',
          'Cookie': sessionCookies
        },
        body: requestBody
      });
      
      const retryText = await retryResponse.text();
      
      if (retryText.includes('<!DOCTYPE') || retryText.includes('<html')) {
        return res.status(500).json({
          success: false,
          error: 'Unable to establish session. Please try again.',
          details: 'The server is blocking requests.'
        });
      }
      
      // Parse retry response
      try {
        const data = JSON.parse(retryText);
        return formatResponse(data, searchValue, searchType, req.method);
      } catch (e) {
        return res.status(500).json({
          success: false,
          error: 'Invalid response after retry',
          raw: retryText.substring(0, 200)
        });
      }
    }

    // Parse JSON response
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      return res.status(500).json({
        success: false,
        error: 'Invalid response format',
        raw: responseText.substring(0, 200)
      });
    }

    return formatResponse(data, searchValue, searchType, req.method);

  } catch (error) {
    console.error('❌ Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}

// ===== HELPER FUNCTIONS =====

function isSessionExpired() {
  if (!sessionExpiry) return true;
  // Session expires in 15 minutes, refresh after 10 minutes
  const now = Date.now();
  const timeLeft = sessionExpiry - now;
  console.log(`⏰ Session time left: ${Math.round(timeLeft / 1000)} seconds`);
  return timeLeft < 60000; // Refresh if less than 1 minute left
}

async function refreshSession(force = false) {
  if (isRefreshing && !force) {
    console.log('⏳ Session refresh already in progress, waiting...');
    // Wait for existing refresh to complete
    await new Promise(resolve => setTimeout(resolve, 3000));
    return;
  }

  isRefreshing = true;
  
  try {
    console.log('🌐 Fetching new session...');
    
    const response = await fetch('https://ccms.pitc.com.pk/complaint', {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });

    // Extract and store cookies
    const setCookieHeader = response.headers.get('set-cookie') || '';
    updateCookies(setCookieHeader);
    
    // Set expiry to 15 minutes from now
    sessionExpiry = Date.now() + 15 * 60 * 1000;
    
    console.log('✅ Session obtained successfully');
    console.log('📝 Cookies:', sessionCookies.substring(0, 100) + '...');
    
  } catch (error) {
    console.error('❌ Failed to get session:', error);
    // Don't clear existing cookies on error
  } finally {
    isRefreshing = false;
  }
}

function updateCookies(cookieHeader) {
  if (!cookieHeader) return;
  
  // Parse Set-Cookie headers
  const cookies = cookieHeader.split(',').map(c => {
    const parts = c.trim().split(';');
    return parts[0];
  }).filter(c => c.includes('='));
  
  // Merge with existing cookies
  const existingCookies = sessionCookies ? sessionCookies.split('; ').map(c => c.split('=')[0]) : [];
  const newCookies = cookies.map(c => c.split('=')[0]);
  
  // Remove cookies that are being updated
  const filteredExisting = sessionCookies ? sessionCookies.split('; ').filter(c => {
    const name = c.split('=')[0];
    return !newCookies.includes(name);
  }) : [];
  
  // Merge all cookies
  const allCookies = [...filteredExisting, ...cookies];
  sessionCookies = allCookies.join('; ');
  
  console.log('🔄 Cookies updated');
}

function formatResponse(data, searchValue, searchType, method) {
  const formattedData = (data.data || []).map(item => ({
    reference: item.REFNO || '',
    name: item.NAME || '',
    fatherName: item.FNAME || '',
    address: {
      line1: item.ADDR1 || '',
      line2: item.ADDR2 || '',
      full: `${item.ADDR1 || ''} ${item.ADDR2 || ''}`.trim()
    },
    contactNumber: item.CONTACTNO || '',
    cnic: item.NICNO || '',
    connectionDate: item.CONDATE || '',
    tariff: item.TARIFF || '',
    load: item.SLOAD || '',
    feederCode: item.FEEDERCD || '',
    gpsLocation: {
      latitude: item.GPSLATI || '0',
      longitude: item.GPSLONG || '0'
    },
    status: item.CURSTATUS || ''
  }));

  return {
    success: true,
    searchValue: searchValue,
    detectedAs: searchType,
    count: formattedData.length,
    data: formattedData,
    message: data.message || 'Success'
  };
    }
