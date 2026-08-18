// Credit: AZ Tricks (https://t.me/AZ_Tricks)
import { authenticatedFetch } from '../lib/session.js';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 🔹 Search term support: cnic, mobile, reference, q
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
    // 🔹 STEP 1: Search API
    const searchResponse = await authenticatedFetch('https://ccms.pitc.com.pk/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: new URLSearchParams({ reference: searchTerm })
    });

    const searchData = await searchResponse.json();

    // Agar user nahi mila
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

    // 🔹 STEP 2: Feeder Details (Parallel calls for speed)
    const [feederRes, userDetailsRes] = await Promise.all([
      authenticatedFetch(`https://ccms.pitc.com.pk/getFeederDetails?reference=${refno}`),
      authenticatedFetch(`https://ccms.pitc.com.pk/api/details/user?reference=${refno}`)
    ]);

    const feederData = await feederRes.json();
    const userDetailsData = await userDetailsRes.json();

    // 🔹 STEP 3: Sirf Consumer Details Return karein
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
      message: 'Internal server error',
      error: error.message,
      credit: 'AZ Tricks (https://t.me/AZ_Tricks)'
    });
  }
      }
