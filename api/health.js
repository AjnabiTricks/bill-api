// Credit: AZ Tricks (https://t.me/AZ_Tricks)
import { checkSession } from '../lib/session.js';

export default async function handler(req, res) {
  const sessionStatus = await checkSession();
  
  res.status(200).json({
    status: 'healthy',
    credit: 'AZ Tricks (https://t.me/AZ_Tricks)',
    session: sessionStatus
  });
}
