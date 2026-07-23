export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { reference, cnic, mobile } = req.body;

    // Validate: At least one search parameter is required
    if (!reference && !cnic && !mobile) {
      return res.status(400).json({
        success: false,
        error: 'Please provide at least one: reference, cnic, or mobile'
      });
    }

    // Build the request body based on what's provided
    let requestBody = '';
    
    if (reference) {
      // Search by Reference Number
      requestBody = `reference=${encodeURIComponent(reference)}`;
    } else if (cnic) {
      // Search by CNIC (format: 3410237236101)
      const cleanCnic = cnic.replace(/-/g, ''); // Remove dashes if any
      requestBody = `cnic=${encodeURIComponent(cleanCnic)}`;
    } else if (mobile) {
      // Search by Mobile Number (format: 923076231799)
      const cleanMobile = mobile.replace(/^0/, '92'); // Convert 03xx to 923xx
      requestBody = `mobile=${encodeURIComponent(cleanMobile)}`;
    }

    console.log('Searching with:', requestBody); // Debug log

    // Forward request to original API
    const response = await fetch('https://ccms.pitc.com.pk/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 11; RMX2103 Build/RKQ1.201217.002) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.7871.46 Mobile Safari/537.36',
        'Accept': '*/*',
        'Origin': 'https://ccms.pitc.com.pk',
        'Referer': 'https://ccms.pitc.com.pk/complaint',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br, zstd'
      },
      body: requestBody
    });

    const data = await response.json();

    // Return success or error
    if (response.ok) {
      return res.status(200).json({
        success: true,
        searchBy: reference ? 'reference' : cnic ? 'cnic' : 'mobile',
        searchValue: reference || cnic || mobile,
        data: data.data || [],
        message: data.message || 'Success',
        count: data.data ? data.data.length : 0
      });
    } else {
      return res.status(response.status).json({
        success: false,
        error: data.message || 'Failed to fetch data'
      });
    }

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
  }
