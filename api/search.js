// Credit: AZ Tricks (https://t.me/AZ_Tricks)
import { authenticatedFetch, checkSession } from '../lib/session.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const searchTerm = req.method === 'GET' 
    ? req.query.cnic || req.query.mobile || req.query.reference || req.query.q
    : req.body.cnic || req.body.mobile || req.body.reference || req.body.q;

  if (!searchTerm) {
    return res.status(400).json({
      success: false,
      message: 'Search term required',
      credit: 'AZ Tricks (https://t.me/AZ_Tricks)'
    });
  }

  try {
    // Search via proxy
    const searchResponse = await authenticatedFetch('https://ccms.pitc.com.pk/api/search', {
      method: 'POST',
      body: new URLSearchParams({ reference: searchTerm })
    });

    // Check if valid JSON
    const contentType = searchResponse.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      throw new Error('HTML received - proxy issue');
    }

    const searchData = await searchResponse.json();

    if (!searchData.user || !searchData.user.REFNO) {
      return res.status(404).json({
        success: false,
        message: 'Consumer not found',
        credit: 'AZ Tricks (https://t.me/AZ_Tricks)'
      });
    }

    const user = searchData.user;
    const refno = user.REFNO;

    // Get details
    const [feederRes, userDetailsRes] = await Promise.all([
      authenticatedFetch(`https://ccms.pitc.com.pk/getFeederDetails?reference=${refno}`),
      authenticatedFetch(`https://ccms.pitc.com.pk/api/details/user?reference=${refno}`)
    ]);

    const feederData = await feederRes.json();
    const userDetailsData = await userDetailsRes.json();

    return res.status(200).json({
      success: true,
      credit: 'AZ Tricks (https://t.me/AZ_Tricks)',
      data: {
        referenceNo: refno,
        name: user.NAME?.trim() || 'N/A',
        fatherName: user.FNAME?.trim() || 'N/A',
        address: `${user.ADDR1?.trim() || ''} ${user.ADDR2?.trim() || ''}`.trim() || 'N/A',
        contactNo: user.CONTACTNO || 'N/A',
        cnic: user.NICNO || 'N/A',
        connectionDate: user.CONDATE || 'N/A',
        tariff: user.TARIFF || 'N/A',
        sanctionedLoad: user.SLOAD || 'N/A',
        feederCode: user.FEEDERCD || 'N/A',
        currentStatus: user.CURSTATUS || 'N/A',
        feederName: feederData?.FEEDER_NAME || 'N/A',
        userDetails: userDetailsData || {}
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Search failed',
      error: error.message,
      credit: 'AZ Tricks (https://t.me/AZ_Tricks)'
    });
  }
}
