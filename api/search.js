export default async function handler(req, res) {
  // Enable CORS for all origins
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Get search parameter from GET or POST
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

    // =============================================
    // ✅ USING CORS PROXY (Bypasses IP blocking)
    // =============================================
    
    // Option 1: Using corsproxy.io (Free, reliable)
    const proxyUrl = 'https://corsproxy.io/?' + 
      encodeURIComponent('https://ccms.pitc.com.pk/api/search');
    
    // Option 2: Using api.allorigins.win (Alternative)
    // const proxyUrl = 'https://api.allorigins.win/raw?url=' + 
    //   encodeURIComponent('https://ccms.pitc.com.pk/api/search');
    
    // Option 3: Using thingproxy (Another alternative)
    // const proxyUrl = 'https://thingproxy.freeboard.io/fetch/https://ccms.pitc.com.pk/api/search';

    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://ccms.pitc.com.pk',
        'Referer': 'https://ccms.pitc.com.pk/complaint',
        'Connection': 'keep-alive'
      },
      body: requestBody
    });

    const responseText = await response.text();
    
    // Check if response is HTML (error)
    if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
      return res.status(500).json({
        success: false,
        error: 'Proxy server returned HTML. Trying alternative proxy...',
        details: 'The upstream server might be blocking the proxy.'
      });
    }

    // Parse JSON
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

    // Format response with address
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

    return res.status(200).json({
      success: true,
      searchValue: searchValue,
      detectedAs: searchType,
      count: formattedData.length,
      data: formattedData,
      message: data.message || 'Success'
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
      }
