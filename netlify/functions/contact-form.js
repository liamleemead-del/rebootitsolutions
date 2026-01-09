// Netlify Function to handle contact form submissions
// Verifies Turnstile and stores submissions

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    // Parse form data (URL encoded)
    const params = new URLSearchParams(event.body);
    const formData = {
      name: params.get('name'),
      email: params.get('email'),
      phone: params.get('phone'),
      message: params.get('message'),
      referral: params.get('referral') || 'Not specified',
      turnstileToken: params.get('cf-turnstile-response'),
      submittedAt: new Date().toISOString()
    };

    // Validate required fields
    if (!formData.name || !formData.email || !formData.phone || !formData.message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Missing required fields' })
      };
    }

    // Verify Turnstile token
    const secretKey = process.env.TURNSTILE_SECRET_KEY;
    if (secretKey && formData.turnstileToken) {
      const verifyResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: secretKey,
          response: formData.turnstileToken
        })
      });

      const verifyResult = await verifyResponse.json();
      if (!verifyResult.success) {
        console.log('Turnstile verification failed:', verifyResult['error-codes']);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Bot verification failed. Please try again.' })
        };
      }
    }

    // Log submission (will appear in Netlify function logs)
    console.log('=== NEW CONTACT FORM SUBMISSION ===');
    console.log('Name:', formData.name);
    console.log('Email:', formData.email);
    console.log('Phone:', formData.phone);
    console.log('Message:', formData.message);
    console.log('Referral:', formData.referral);
    console.log('Submitted:', formData.submittedAt);
    console.log('===================================');

    // Store in Netlify Blobs (if available) for persistence
    try {
      const { getStore } = await import('@netlify/blobs');
      const store = getStore('contact-submissions');
      const submissionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      await store.setJSON(submissionId, formData);
      console.log('Stored submission:', submissionId);
    } catch (blobError) {
      // Blobs might not be available, that's okay - we logged it
      console.log('Blob storage not available, submission logged only');
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'Form submitted successfully' })
    };

  } catch (error) {
    console.error('Form submission error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Server error. Please try again.' })
    };
  }
};
