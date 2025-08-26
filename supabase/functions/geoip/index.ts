const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const GEOIP_USER = 'drama_pills_srv';
const GEOIP_PASS = 'dp2f6,30cvW6';

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    console.log('🌍 Edge Function: Starting GeoIP request...');
    console.log('🌍 Edge Function: Request method:', req.method);
    console.log('🌍 Edge Function: Request headers:', Object.fromEntries(req.headers.entries()));

    // Extract client IP from various headers and connection info
    const getClientIP = (req: Request): string | null => {
      // Check common headers for client IP (in order of preference)
      const ipHeaders = [
        'cf-connecting-ip',      // Cloudflare
        'x-forwarded-for',       // Standard proxy header
        'x-real-ip',            // Nginx proxy
        'x-client-ip',          // Apache
        'x-forwarded',          // General forwarded
        'forwarded-for',        // Alternative
        'forwarded',            // RFC 7239
      ];

      for (const header of ipHeaders) {
        const value = req.headers.get(header);
        if (value) {
          // x-forwarded-for can contain multiple IPs, take the first one
          const ip = value.split(',')[0].trim();
          if (ip && ip !== 'unknown') {
            console.log(`🌍 Edge Function: Found client IP in ${header}: ${ip}`);
            return ip;
          }
        }
      }

      console.log('🌍 Edge Function: No client IP found in headers');
      return null;
    };

    // Create auth header using btoa (available in Deno)
    const authString = `${GEOIP_USER}:${GEOIP_PASS}`;
    const authHeader = `Basic ${btoa(authString)}`;

    const body = new URLSearchParams();
    let targetIp = null;
    
    // First, try to get client IP from headers
    const clientIP = getClientIP(req);
    if (clientIP) {
      body.append('ip', clientIP);
      targetIp = clientIP;
      console.log('🌍 Edge Function: Using client IP from headers:', clientIP);
    }
    
    // Check if a specific IP was provided in the request body (this overrides client IP)
    if (req.method === 'POST') {
      try {
        const requestBody = await req.text();
        console.log('🌍 Edge Function: Request body received:', requestBody);
        const params = new URLSearchParams(requestBody);
        const ip = params.get('ip');
        if (ip) {
          // Clear previous IP and use the provided one
          body.delete('ip');
          body.append('ip', ip);
          targetIp = ip;
          console.log('🌍 Edge Function: Using provided IP:', ip);
        }
      } catch (e) {
        console.log('🌍 Edge Function: Error parsing request body, using caller IP:', e);
      }
    }

    // Final logging
    if (targetIp) {
      console.log('🌍 Edge Function: Final IP being sent to GeoIP API:', targetIp);
    } else {
      console.log('🌍 Edge Function: No IP specified, GeoIP API will use server IP (fallback)');
    }
    
    console.log('🌍 Edge Function: Request body params:', body.toString());
    console.log('🌍 Edge Function: Making request to GeoIP API...');

    const response = await fetch('https://api.contactdve.com/geoip/getCountryByIp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': authHeader,
        'User-Agent': 'Supabase-Edge-Function/1.0',
      },
      body: body.toString(),
    });

    console.log('🌍 Edge Function: GeoIP API response status:', response.status);

    if (!response.ok) {
      console.error('🌍 Edge Function: HTTP error:', response.status, response.statusText);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();
    console.log('🌍 Edge Function: GeoIP API response:', json);

    return new Response(
      JSON.stringify(json),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error('🌍 Edge Function: Error:', error);
    
    // Return a fallback response with proper structure
    const fallbackResponse = {
      code: 200,
      error: 0,
      data: { success: 'US' }
    };

    return new Response(
      JSON.stringify(fallbackResponse),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
});