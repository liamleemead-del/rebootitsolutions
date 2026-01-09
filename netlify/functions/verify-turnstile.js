// Netlify Function to verify Cloudflare Turnstile token server-side
exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const { token } = JSON.parse(event.body);

    if (!token) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Missing Turnstile token' })
      };
    }

    // Get secret key from environment variable
    const secretKey = process.env.TURNSTILE_SECRET_KEY;

    if (!secretKey) {
      console.error('TURNSTILE_SECRET_KEY not configured');
      return {
        statusCode: 500,
        body: JSON.stringify({ success: false, error: 'Server configuration error' })
      };
    }

    // Verify token with Cloudflare
    const verifyResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        secret: secretKey,
        response: token
      })
    });

    const verifyResult = await verifyResponse.json();

    if (verifyResult.success) {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true })
      };
    } else {
      console.log('Turnstile verification failed:', verifyResult['error-codes']);
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Verification failed. Please try again.'
        })
      };
    }
  } catch (error) {
    console.error('Turnstile verification error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Verification service error' })
    };
  }
};
