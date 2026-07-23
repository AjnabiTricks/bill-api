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

    // FORWARD to original API with COMPLETE headers
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
        'Cache-Control': 'no-cache'
      },
      body: requestBody
    });

    // Get response as text first
    const responseText = await response.text();
    console.log('Raw response:', responseText.substring(0, 200)); // Log first 200 chars

    // Try to parse JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      // If parsing fails, check if response is HTML (session expired)
      if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
        return res.status(500).json({
          success: false,
          error: 'Upstream server returned HTML (session may have expired)',
          details: 'The original server requires a valid session. Try again later.'
        });
      }
      return res.status(500).json({
        success: false,
        error: 'Invalid response from upstream server',
        raw: responseText.substring(0, 200) // Show first 200 chars for debugging
      });
    }

    // ✅ FORMAT RESPONSE with COMPLETE ADDRESS
    const formattedData = (data.data || []).map(item => ({
      reference: item.REFNO || '',
      name: item.NAME || '',
      fatherName: item.FNAME || '',
      // 🏠 COMPLETE ADDRESS FIELDS
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
      status: item.CURSTATUS || '',
      // Raw data for reference (optional)
      _raw: item
    }));

    return res.status(200).json({
      success: true,
      method: req.method,
      searchValue: searchValue,
      detectedAs: searchType,
      count: formattedData.length,
      data: formattedData,
      message: data.message || 'Success'
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
      }
