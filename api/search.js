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

    // Build the request body
    let requestBody = '';
    
    if (reference) {
      requestBody = `reference=${encodeURIComponent(reference)}`;
    } else if (cnic) {
      const cleanCnic = cnic.replace(/-/g, '');
      requestBody = `cnic=${encodeURIComponent(cleanCnic)}`;
    } else if (mobile) {
      const cleanMobile = mobile.replace(/^0/, '92');
      requestBody = `mobile=${encodeURIComponent(cleanMobile)}`;
    }

    // Forward request to original API with COMPLETE headers
    const response = await fetch('https://ccms.pitc.com.pk/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Origin': 'https://ccms.pitc.com.pk',
        'Referer': 'https://ccms.pitc.com.pk/complaint',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty',
        'Connection': 'keep-alive'
      },
      body: requestBody
    });

    // Get response as text first to handle any issues
    const responseText = await response.text();
    
    // Try to parse JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      // If not JSON, return error
      return res.status(500).json({
        success: false,
        error: 'Invalid response from upstream server',
        raw: responseText.substring(0, 200) // First 200 chars for debugging
      });
    }

    // Return success response
    return res.status(200).json({
      success: true,
      searchBy: reference ? 'reference' : cnic ? 'cnic' : 'mobile',
      searchValue: reference || cnic || mobile,
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
