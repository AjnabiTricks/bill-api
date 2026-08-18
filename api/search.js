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
      message: 'Search term required (cnic, mobile, reference, or q)',
      credit: 'AZ Tricks (https://t.me/AZ_Tricks)'
    });
  }

  try {
    // Check session first
    const sessionStatus = await checkSession();
    console.log('📊 Session status:', sessionStatus);

    console.log(`🔍 Searching for: ${searchTerm}`);

    // Step 1: Search
    const searchResponse = await authenticatedFetch('https://ccms.pitc.com.pk/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
      },
      body: new URLSearchParams({ reference: searchTerm })
    });

    // Check if response is JSON or HTML
    const contentType = searchResponse.headers.get('content-type') || '';
    console.log(`📄 Content-Type: ${contentType}`);

    if (contentType.includes('text/html')) {
      const html = await searchResponse.text();
      console.error('❌ Received HTML:', html.substring(0, 200));
      throw new Error('PITC server returned HTML - IP blocked or session invalid');
    }

    const searchData = await searchResponse.json();

    if (!searchData.user || !searchData.user.REFNO) {
      return res.status(404).json({
        success: false,
        message: 'Consumer not found',
        searchTerm: searchTerm,
        credit: 'AZ Tricks (https://t.me/AZ_Tricks)'
      });
    }

    const user = searchData.user;
    const refno = user.REFNO;

    // Step 2: Get details
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
