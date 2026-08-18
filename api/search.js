// Credit: AZ Tricks (https://t.me/AZ_Tricks)

import { authenticatedFetch, getHeaders } from '../lib/session.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Support multiple search parameters
  const searchTerm = req.method === 'GET' 
    ? req.query.q || req.query.reference || req.query.cnic || req.query.mobile
    : req.body.q || req.body.reference || req.body.cnic || req.body.mobile;

  if (!searchTerm) {
    return res.status(400).json({
      success: false,
      error: 'Search term required',
      hint: 'Use q, reference, cnic, or mobile parameter',
      credit: 'AZ Tricks (https://t.me/AZ_Tricks)'
    });
  }

  try {
    // Step 1: Search by reference
    let response = await authenticatedFetch('https://ccms.pitc.com.pk/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
      },
      body: new URLSearchParams({ reference: searchTerm })
    });

    let data = await response.json();

    if (data.user && data.user.REFNO) {
      const refno = data.user.REFNO;
      
      // Step 2: Get feeder details
      const feederResponse = await authenticatedFetch(
        `https://ccms.pitc.com.pk/getFeederDetails?reference=${refno}`
      );
      const feederData = await feederResponse.json();

      // Step 3: Get user details
      const userResponse = await authenticatedFetch(
        `https://ccms.pitc.com.pk/api/details/user?reference=${refno}`
      );
      const userData = await userResponse.json();

      return res.status(200).json({
        success: true,
        credit: 'AZ Tricks (https://t.me/AZ_Tricks)',
        searchTerm: searchTerm,
        user: {
          ...data.user,
          feederDetails: feederData,
          userDetails: userData
        }
      });
    }

    return res.status(404).json({
      success: false,
      message: 'No record found',
      searchTerm: searchTerm,
      credit: 'AZ Tricks (https://t.me/AZ_Tricks)'
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
