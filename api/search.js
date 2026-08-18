// Credit: AZ Tricks (https://t.me/AZ_Tricks)

import { authenticatedFetch, getHeaders } from '../lib/session.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Get search parameter (support all formats)
  const searchTerm = req.method === 'GET' 
    ? req.query.q || req.query.reference || req.query.cnic || req.query.mobile || req.query.refno
    : req.body.q || req.body.reference || req.body.cnic || req.body.mobile || req.body.refno;

  if (!searchTerm) {
    return res.status(400).json({
      success: false,
      error: 'Search term required',
      hint: 'Use q, reference, cnic, mobile, or refno parameter',
      credit: 'AZ Tricks (https://t.me/AZ_Tricks)'
    });
  }

  try {
    // ============================================
    // STEP 1: Search by Reference
    // ============================================
    let response = await authenticatedFetch('https://ccms.pitc.com.pk/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
      },
      body: new URLSearchParams({ reference: searchTerm })
    });

    let data = await response.json();

    if (!data.user || !data.user.REFNO) {
      return res.status(404).json({
        success: false,
        message: 'No record found',
        searchTerm: searchTerm,
        credit: 'AZ Tricks (https://t.me/AZ_Tricks)'
      });
    }

    const refno = data.user.REFNO;
    const userData = data.user;

    // ============================================
    // STEP 2: Get Feeder Details
    // ============================================
    const feederResponse = await authenticatedFetch(
      `https://ccms.pitc.com.pk/getFeederDetails?reference=${refno}`
    );
    const feederData = await feederResponse.json();

    // ============================================
    // STEP 3: Get User Details
    // ============================================
    const userDetailsResponse = await authenticatedFetch(
      `https://ccms.pitc.com.pk/api/details/user?reference=${refno}`
    );
    const userDetailsData = await userDetailsResponse.json();

    // ============================================
    // STEP 4: Get Complaint History (if any)
    // ============================================
    let complaintHistory = [];
    try {
      const complaintResponse = await authenticatedFetch(
        `https://ccms.pitc.com.pk/api/complaints?reference=${refno}`
      );
      const complaintData = await complaintResponse.json();
      if (complaintData.data) {
        complaintHistory = complaintData.data;
      }
    } catch (e) {
      // Complaint history optional
    }

    // ============================================
    // STEP 5: Get Bill Details (if available)
    // ============================================
    let billDetails = null;
    try {
      const billResponse = await authenticatedFetch(
        `https://ccms.pitc.com.pk/api/bill?reference=${refno}`
      );
      const billData = await billResponse.json();
      if (billData.success) {
        billDetails = billData;
      }
    } catch (e) {
      // Bill details optional
    }

    // ============================================
    // STEP 6: Get Consumer Status
    // ============================================
    let consumerStatus = null;
    try {
      const statusResponse = await authenticatedFetch(
        `https://ccms.pitc.com.pk/api/status?reference=${refno}`
      );
      const statusData = await statusResponse.json();
      if (statusData.success) {
        consumerStatus = statusData;
      }
    } catch (e) {
      // Status optional
    }

    // ============================================
    // COMBINE ALL DATA
    // ============================================
    return res.status(200).json({
      success: true,
      credit: 'AZ Tricks (https://t.me/AZ_Tricks)',
      searchTerm: searchTerm,
      refno: refno,
      
      // Consumer Information
      consumer: {
        name: userData.NAME?.trim() || 'N/A',
        fatherName: userData.FNAME?.trim() || 'N/A',
        address: `${userData.ADDR1?.trim() || ''} ${userData.ADDR2?.trim() || ''}`.trim() || 'N/A',
        contactNo: userData.CONTACTNO || 'N/A',
        cnic: userData.NICNO || 'N/A',
        connectionDate: userData.CONDATE || 'N/A',
        tariff: userData.TARIFF || 'N/A',
        sanctionedLoad: userData.SLOAD || 'N/A',
        feederCode: userData.FEEDERCD || 'N/A',
        gpsLong: userData.GPSLONG || 'N/A',
        gpsLati: userData.GPSLATI || 'N/A',
        currentStatus: userData.CURSTATUS || 'N/A'
      },

      // Feeder Details
      feeder: feederData || {},

      // User Details
      userDetails: userDetailsData || {},

      // Complaint History
      complaints: complaintHistory || [],

      // Bill Details
      bill: billDetails || {},

      // Consumer Status
      status: consumerStatus || {},

      // Raw Data (for reference)
      raw: {
        user: userData,
        feeder: feederData,
        userDetails: userDetailsData
      }
    });

  } catch (error) {
    console.error('❌ Search error:', error);
    return res.status(500).json({
      success: false,
      error: 'Search failed',
      details: error.message,
      credit: 'AZ Tricks (https://t.me/AZ_Tricks)'
    });
  }
}

// Health check
export async function healthCheck(req, res) {
  const headers = await getHeaders();
  return res.status(200).json({
    status: 'healthy',
    credit: 'AZ Tricks (https://t.me/AZ_Tricks)',
    session: {
      active: !!headers.Cookie
    }
  });
      }
