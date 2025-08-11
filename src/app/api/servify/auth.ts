import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';

interface AuthResponse {
  token?: string;
  error?: string;
}

// Store token in memory (use Redis or database in production)
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AuthResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check if we have a valid cached token
    if (cachedToken && Date.now() < tokenExpiry) {
      return res.status(200).json({ token: cachedToken });
    }

    const servifyConfig = {
      baseUrl: process.env.SERVIFY_BASE_URL || 'https://api.servify.com',
      clientId: process.env.SERVIFY_CLIENT_ID,
      clientSecret: process.env.SERVIFY_CLIENT_SECRET,
      publicKey: process.env.SERVIFY_PUBLIC_KEY,
    };

    // Prepare authentication payload
    const timestamp = Math.floor(Date.now() / 1000);
    const authPayload = {
      clientId: servifyConfig.clientId,
      timestamp: timestamp,
    };

    // Encrypt payload (RSA encryption)
    const encryptedPayload = crypto.publicEncrypt(
      {
        key: servifyConfig.publicKey!,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      },
      Buffer.from(JSON.stringify(authPayload))
    );

    const response = await fetch(`${servifyConfig.baseUrl}/auth/generatetoken`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${servifyConfig.clientSecret}`,
      },
      body: JSON.stringify({
        data: encryptedPayload.toString('base64'),
      }),
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Cache token for 50 minutes (assuming 1-hour expiry)
    cachedToken = data.token;
    tokenExpiry = Date.now() + (50 * 60 * 1000);

    res.status(200).json({ token: data.token });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}