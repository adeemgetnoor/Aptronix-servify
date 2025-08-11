import type { NextApiRequest, NextApiResponse } from 'next';

// Enable CORS
const allowCors = (handler: Function) => async (req: NextApiRequest, res: NextApiResponse) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-V, Authorization'
  );
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  return await handler(req, res);
};

interface SlotRequest {
  date: string;
  city: string;
  pincode: string;
}

interface TimeSlot {
  id: string;
  time: string;
  available: boolean;
}

interface SlotsResponse {
  slots?: TimeSlot[];
  error?: string;
}

async function getAuthToken(): Promise<string> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/servify/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to get auth token');
    }
    
    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error('Auth token error:', error);
    throw error;
  }
}

export default allowCors(async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SlotsResponse>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const { date, city, pincode }: SlotRequest = req.body;

    if (!date || !city || !pincode) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const token = await getAuthToken();
    const servifyConfig = {
      baseUrl: process.env.SERVIFY_BASE_URL || 'https://api.servify.com',
    };

    const slotsPayload = {
      date: date,
      city: city,
      pincode: pincode,
      serviceType: 'repair', // or based on your requirements
    };

    const response = await fetch(`${servifyConfig.baseUrl}/slots/fetch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(slotsPayload),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch slots: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Transform the response to match our frontend expectations
    const slots: TimeSlot[] = data.slots?.map((slot: any) => ({
      id: slot.slotId || slot.id,
      time: slot.timeSlot || slot.time,
      available: slot.available !== false,
    })) || [];

    res.status(200).json({ slots });
  } catch (error) {
    console.error('Slots fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch available slots' });
  }
});