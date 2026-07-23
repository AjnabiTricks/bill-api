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

    // ============= STEP 1: Get CSRF Token and Session =============
    console.log('🔄 Getting CSRF token and session...');
    
    const homeResponse = await fetch('https://ccms.pitc.com.pk/complaint', {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    const homeHtml = await homeResponse.text();
    
    // Extract CSRF token from HTML
    let csrfToken = '';
    const tokenMatch = homeHtml.match(/name="_token"[^>]*value="([^"]+)"/) || 
                       homeHtml.match(/XSRF-TOKEN[^;]+;[\s]*value="([^"]+)"/) ||
                       homeHtml.match(/csrf-token" content="([^"]+)"/);
    
    if (tokenMatch) {
      csrfToken = tokenMatch[1];
      console.log('✅ CSRF Token extracted:', csrfToken.substring(0, 20) + '...');
    }

    // Extract session cookies
    const setCookieHeader = homeResponse.headers.get('set-cookie') || '';
    const cookies = setCookieHeader.split(',').map(c => c.split(';')[0].trim()).join('; ');
    console.log('✅ Session cookies obtained');

    // ============= STEP 2: Make the actual API call =============
    console.log('🔄 Making search request...');
    
    const searchHeaders = {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Origin': 'https://ccms.pitc.com.pk',
      'Referer': 'https://ccms.pitc.com.pk/complaint',
      'Connection': 'keep-alive',
      'Cookie': cookies,
      'Cache-Control': 'no-cache',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin'
    };

    // Add CSRF token if found
    if (csrfToken) {
      searchHeaders['X-CSRF-TOKEN'] = csrfToken;
      // Also try adding to body
      requestBody += `&_token=${encodeURIComponent(csrfToken)}`;
    }

    const response = await fetch('https://ccms.pitc.com.pk/api/search', {
      method: 'POST',
      headers: searchHeaders,
      body: requestBody
    });

    const responseText = await response.text();
    
    // Check if response is valid JSON
    if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
      // Try one more time with different approach
      console.log('⚠️ Got HTML response, trying alternate method...');
      
      // Try using the session from headers
      const altResponse = await fetch('https://ccms.pitc.com.pk/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Origin': 'https://ccms.pitc.com.pk',
          'Referer': 'https://ccms.pitc.com.pk/complaint',
          'Cookie': cookies
        },
        body: requestBody.replace(/&_token=[^&]*/, '') // Remove token if present
      });
      
      const altText = await altResponse.text();
      
      if (altText.includes('<!DOCTYPE') || altText.includes('<html')) {
        return res.status(500).json({
          success: false,
          error: 'Server requires authentication',
          details: 'The upstream server cannot be accessed without proper session.',
          suggestion: 'Try accessing https://ccms.pitc.com.pk in your browser first'
        });
      }
      
      // Parse the alternative response
      try {
        const data = JSON.parse(altText);
        return formatResponse(data, searchValue, searchType, req.method);
      } catch (e) {
        return res.status(500).json({
          success: false,
          error: 'Could not parse response after retry',
          raw: altText.substring(0, 200)
        });
      }
    }

    // Parse successful JSON response
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
    console.error('Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}

// 📦 Helper function to format response
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
