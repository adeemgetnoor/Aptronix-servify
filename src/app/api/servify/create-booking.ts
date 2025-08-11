import type { NextApiRequest, NextApiResponse } from 'next';

interface BookingRequest {
  customerName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  pincode: string;
  deviceBrand: string;
  deviceModel: string;
  serialNumber: string;
  issueDescription: string;
  preferredDate: string;
  preferredTime: string;
}

interface BookingResponse {
  bookingId?: string;
  error?: string;
}

async function getAuthToken(): Promise<string> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/servify/auth`, {
    method: 'POST',
  });
  
  if (!response.ok) {
    throw new Error('Failed to get auth token');
  }
  
  const data = await response.json();
  return data.token;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BookingResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const bookingData: BookingRequest = req.body;

    // Validate required fields
    const requiredFields = [
      'customerName', 'email', 'phone', 'address', 'city', 'pincode',
      'deviceBrand', 'deviceModel', 'issueDescription', 'preferredDate', 'preferredTime'
    ];

    for (const field of requiredFields) {
      if (!bookingData[field as keyof BookingRequest]) {
        return res.status(400).json({ error: `Missing required field: ${field}` });
      }
    }

    const token = await getAuthToken();
    const servifyConfig = {
      baseUrl: process.env.SERVIFY_BASE_URL || 'https://api.servify.com',
    };

    // Prepare service request payload
    const serviceRequestPayload = {
      customer: {
        name: bookingData.customerName,
        email: bookingData.email,
        phone: bookingData.phone,
        address: {
          street: bookingData.address,
          city: bookingData.city,
          pincode: bookingData.pincode,
        },
      },
      device: {
        brand: bookingData.deviceBrand,
        model: bookingData.deviceModel,
        serialNumber: bookingData.serialNumber,
      },
      service: {
        type: 'repair',
        description: bookingData.issueDescription,
        preferredDate: bookingData.preferredDate,
        preferredTime: bookingData.preferredTime,
      },
      requestType: 'BOOKING',
      priority: 'NORMAL',
    };

    const response = await fetch(`${servifyConfig.baseUrl}/service/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(serviceRequestPayload),
    });

    if (!response.ok) {
      throw new Error(`Failed to create booking: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Send confirmation email/SMS (implement based on your requirements)
    await sendConfirmationNotification(bookingData, data.serviceRequestId);

    res.status(200).json({ 
      bookingId: data.serviceRequestId || data.bookingId || generateBookingId()
    });
  } catch (error) {
    console.error('Booking creation error:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
}

function generateBookingId(): string {
  return 'BK' + Date.now().toString() + Math.random().toString(36).substr(2, 4).toUpperCase();
}

async function sendConfirmationNotification(bookingData: BookingRequest, bookingId: string) {
  // Implement email/SMS notification logic here
  // This could integrate with services like SendGrid, Twilio, etc.
  console.log(`Booking confirmation sent for ${bookingId} to ${bookingData.email}`);
}