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

    // ✅ GET: Read from query parameters
    if (req.method === 'GET') {
      searchValue = req.query.search || req.query.reference || req.query.cnic || req.query.mobile;
    } 
    // ✅ POST: Read from JSON body
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

    // 🧠 SMART DETECTION: Auto-detect what was sent
    let requestBody = '';
    let searchType = 'unknown';

    // Remove dashes and spaces for clean comparison
    const cleanValue = searchValue.replace(/[-\s]/g, '');
    
    // Check if it's a CNIC (13 digits, starts with 3 or 4)
    if (/^[3-4]\d{12}$/.test(cleanValue)) {
      requestBody = `cnic=${encodeURIComponent(cleanValue)}`;
      searchType = 'cnic';
    }
    // Check if it's a Mobile Number (starts with 92 or 03, 11-12 digits)
    else if (/^(92|03)\d{9,10}$/.test(cleanValue)) {
      const mobile = cleanValue.replace(/^0/, '92');
      requestBody = `mobile=${encodeURIComponent(mobile)}`;
      searchType = 'mobile';
    }
    // Default: Treat as Reference Number
    else {
      requestBody = `reference=${encodeURIComponent(searchValue)}`;
      searchType = 'reference';
    }

    console.log('Search:', { searchValue, searchType, requestBody });

    // Forward request to original API
    const response = await fetch('https://ccms.pitc.com.pk/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Origin': 'https://ccms.pitc.com.pk',
        'Referer': 'https://ccms.pitc.com.pk/complaint',
      },
      body: requestBody
    });

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      return res.status(500).json({
        success: false,
        error: 'Invalid response from upstream server',
      });
    }

    return res.status(200).json({
      success: true,
      method: req.method,
      searchValue: searchValue,
      detectedAs: searchType, // Tells you what was detected
      data: data.data || [],
      message: data.message || 'Success',
      count: data.data ? data.data.length : 0
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
