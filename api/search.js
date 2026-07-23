// Store cookies globally to maintain session
let storedCookies = '';
let cookieExpiry = null;

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let searchValue;

    // GET: Read from query parameters
    if (req.method === 'GET') {
      searchValue = req.query.search || req.query.reference || req.query.cnic || req.query.mobile;
    } 
    // POST: Read from JSON body
    else if (req.method === 'POST') {
      searchValue = req.body.search || req.body.reference || req.body.cnic || req.body.mobile;
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Validate
    if (!searchValue) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a search parameter (reference, cnic, or mobile)'
      });
    }

    // SMART DETECTION
    let requestBody = '';
    let searchType = 'unknown';
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

    console.log('Search:', { searchValue, searchType, requestBody });

    // ✅ FIRST, visit the homepage to get session cookies
    if (!storedCookies) {
      console.log('🔄 Fetching initial session...');
      const homeResponse = await fetch('https://ccms.pitc.com.pk/complaint', {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      });

      // Extract cookies from response
      const setCookie = homeResponse.headers.get('set-cookie');
      if (setCookie) {
        storedCookies = setCookie.split(',')
          .map(c => c.split(';')[0])
          .join('; ');
        console.log('✅ Session cookies obtained:', storedCookies);
      }
    }

    // ✅ FORWARD to original API with cookies
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
        'Cache-Control': 'no-cache',
        // ✅ Add stored cookies
        'Cookie': storedCookies
      },
      body: requestBody
    });

    // Get response as text first
    const responseText = await response.text();
    
    // ✅ Update cookies if new ones come in
    const newCookies = response.headers.get('set-cookie');
    if (newCookies) {
      storedCookies = newCookies.split(',')
        .map(c => c.split(';')[0])
        .join('; ');
      console.log('🔄 Session updated');
    }

    // Check if response is HTML (session still expired)
    if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
      // Try to get fresh session and retry
      console.log('⚠️ Session expired, refreshing...');
      storedCookies = ''; // Clear stored cookies
      
      // Get fresh session
      const freshHome = await fetch('https://ccms.pitc.com.pk/complaint', {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
      });
      
      const freshSetCookie = freshHome.headers.get('set-cookie');
      if (freshSetCookie) {
        storedCookies = freshSetCookie.split(',')
          .map(c => c.split(';')[0])
          .join('; ');
      }
      
      // Retry the search
      const retryResponse = await fetch('https://ccms.pitc.com.pk/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Origin': 'https://ccms.pitc.com.pk',
          'Referer': 'https://ccms.pitc.com.pk/complaint',
          'Cookie': storedCookies
        },
        body: requestBody
      });
      
      const retryText = await retryResponse.text();
      
      if (retryText.includes('<!DOCTYPE') || retryText.includes('<html')) {
        return res.status(500).json({
          success: false,
          error: 'Unable to establish session with upstream server',
          details: 'The server is blocking requests. Please try again later.'
        });
      }
      
      // Parse retry response
      let data;
      try {
        data = JSON.parse(retryText);
      } catch (e) {
        return res.status(500).json({
          success: false,
          error: 'Invalid response after session refresh',
          raw: retryText.substring(0, 200)
        });
      }
      
      return formatResponse(data, searchValue, searchType, req.method);
    }

    // Parse JSON response
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      return res.status(500).json({
        success: false,
        error: 'Invalid response from upstream server',
        raw: responseText.substring(0, 200)
      });
    }

    return formatResponse(data, searchValue, searchType, req.method);

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}

// 📦 Helper function to format response with address
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
    method: method,
    searchValue: searchValue,
    detectedAs: searchType,
    count: formattedData.length,
    data: formattedData,
    message: data.message || 'Success'
  };
  }
