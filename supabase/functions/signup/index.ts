import { createClient } from 'npm:@supabase/supabase-js@2.53.0';

const CONNECTION_TIMEOUT = 10000;

class HTTPClient {
  config;
  ERROR_CODE;
  disabled;
  applicationSecret;
  whiteLabel;
  isInternational;

  constructor(config) {
    this.config = config;
    this.ERROR_CODE = 'HTTP_CLIENT_ERROR';
    this.isInternational = false;
    this.disabled = false;
  }

  setup() {
    this.applicationSecret = this.config.secret;
    if (this.config.iPawn !== undefined) {
      this.whiteLabel = this.config.iPawn.whiteLabel;
      this.isInternational = this.config.iPawn.isInternational;
    }
    return this;
  }

  async makeSignedRequest(url, body) {
    if (this.disabled) {
      throw new Error('Disabled instance');
    }
    const timestamp = Math.ceil(new Date().getTime() / 1000);
    const headers = {
      Authorization: await this.getAuthHeader('POST', url, JSON.stringify(body), '', timestamp)
    };
    return await this.makePostWithFetch(url, body, headers);
  }

  async makePostWithFetch(url, body, headers = {}) {
    const controller = new AbortController();
    const id = setTimeout(() => {
      controller.abort();
    }, CONNECTION_TIMEOUT);
    try {
      const result = await fetch(url, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-type': 'application/json; charset=UTF-8'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      if (result.ok === true) {
        if (![204, 205, 0].includes(result.status)) {
          return await result.json();
        }
        return undefined;
      }
      // Enhanced error handling with raw response logging
      const rawBody = await result.text();
      console.error('Raw response body:', rawBody);
      let errorResponse;
      try {
        errorResponse = JSON.parse(rawBody);
      } catch {
        throw new Error(`Invalid JSON response from ${url}`);
      }
      let code = this.ERROR_CODE;
      let message = errorResponse.statusText ?? 'Unknown error';
      const status = result.status.toString();
      if (errorResponse.error?.message !== undefined && typeof errorResponse.error.message === 'string') {
        message = errorResponse.error.message;
      }
      if (errorResponse.error?.code !== undefined && typeof errorResponse.error.code === 'string') {
        code = errorResponse.error.code;
      }
      throw new Error(`${message} ${code} ${status}`);
    } catch (error) {
      console.error("HTTP POST failed", {
        url,
        error
      });
      throw error;
    } finally {
      clearTimeout(id);
    }
  }

  disable() {
    this.disabled = true;
  }

  isDisabled() {
    return this.disabled;
  }

  async getIpawnHash(url, method, bodyString, queryString, timestamp) {
    if (this.applicationSecret === undefined) throw new Error('Unable to generate iPawn signature without application secret');
    url = url.replace(/^https?:\/\//, '');
    const msg = [url, method, bodyString, queryString, timestamp].join('|');
    return await this.getHmac(msg, this.applicationSecret);
  }

  async getHmac(message, secret, algorithm = 'SHA-1') {
    const enc = new TextEncoder();
    const keyData = enc.encode(secret);
    const messageData = enc.encode(message);
    const key = await crypto.subtle.importKey('raw', keyData, {
      name: 'HMAC',
      hash: {
        name: algorithm
      }
    }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, messageData);
    const signatureArray = new Uint8Array(signature);
    const hexSignature = Array.from(signatureArray).map(b => b.toString(16).padStart(2, '0')).join('');
    return hexSignature;
  }

  async getAuthHeader(method, url, bodyString, queryString, timestamp) {
    const authHeaderSignature = await this.getIpawnHash(url, method, bodyString, queryString, timestamp);
    const headerParts = [
      `iPawn application_id=${JSON.stringify(this.config.identifier)}`,
      'platform="JS"',
      `signature=${JSON.stringify(authHeaderSignature)}`,
      'version="2.1"',
      `timestamp="${timestamp}"`
    ];
    if (this.isInternational && this.whiteLabel) {
      headerParts.splice(2, 0, `group=${JSON.stringify(this.whiteLabel)}`);
    }
    return headerParts.join(' ');
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Helper function to format phone number to international format
function formatToInternationalPhone(input) {
  // Remove all non-digit characters
  const digits = input.replace(/\D/g, '');
  
  // If it starts with +, it's already international
  if (input.startsWith('+')) {
    return input;
  }
  
  // If it's a US number (10 digits), add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // If it's 11 digits and starts with 1, it's US with country code
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  // For other formats, assume it's already in correct format or add + if missing
  if (!input.startsWith('+') && digits.length > 10) {
    return `+${digits}`;
  }
  
  return input;
}

// Helper function to check if input is email or phone
function isEmail(input) {
  return input.includes('@') && input.includes('.');
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email and password are required" }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    // Initialize HTTPClient for SmartUser API
    const httpClient = new HTTPClient({
      identifier: 'bolt_test_app',
      secret: '(c~BSIWJ9k>*T]..4E.@'
    }).setup();

    // Determine if input is email or phone and format accordingly
    let identifier;
    let identityType;
    if (isEmail(email)) {
      identifier = email;
      identityType = 'EMAIL';
    } else {
      // Format phone number to international format
      identifier = formatToInternationalPhone(email);
      identityType = 'MSISDN';
    }

    // Prepare signup request
    const signupRequest = {
      identifier,
      identityType,
      secret: password
    };

    // Call SmartUser API for user registration
    console.log('Making signup request to SmartUser API...');
    console.log('Request URL: https://auth-smartuser.dv-content.io/user/signup');
    console.log('Signup request body:', signupRequest);

    let signupResponse;
    try {
      signupResponse = await httpClient.makeSignedRequest(
        'https://auth-smartuser.dv-content.io/user/signup',
        signupRequest
      );
      console.log('Signup response OK', signupResponse);
    } catch (err) {
      console.error('Signup failed', err);
      // Check if it's a user already exists error
      if (err.message && err.message.includes('409')) {
        return new Response(JSON.stringify({ error: "User already exists" }), {
          status: 409,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      return new Response(JSON.stringify({ error: "Signup failed", details: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (!signupResponse || !signupResponse.sessionToken) {
      console.error('Signup failed: No session token in response');
      console.error('Full signup response:', JSON.stringify(signupResponse, null, 2));
      return new Response(
        JSON.stringify({ error: "Signup failed" }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    // If we have a sessionToken, signup was successful
    // Now call the signin edge function to complete the authentication flow
    if (signupResponse.sessionToken) {
      console.log('Signup successful with sessionToken, calling signin edge function...');
      console.error('Full signup response:', JSON.stringify(signupResponse, null, 2));
      
      try {
        // Call the signin edge function to complete the authentication flow
        const signinUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/signin`;
        console.log('Calling signin edge function at:', signinUrl);
        
        const signinResponse = await fetch(signinUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          },
          body: JSON.stringify({
            emailOrPhone: identifier,
            password: password,
          })
        });

        console.log('Signin edge function response status:', signinResponse.status);
        
        if (!signinResponse.ok) {
          const errorData = await signinResponse.text();
          console.error('Signin edge function failed:', errorData);
          return new Response(
            JSON.stringify({ error: "Failed to complete signup authentication" }),
            {
              status: 500,
              headers: {
                'Content-Type': 'application/json',
                ...corsHeaders,
              },
            }
          );
        }

        const signinData = await signinResponse.json();
        console.log('Signin edge function response data:', JSON.stringify(signinData, null, 2));
        
        if (!signinData.success) {
          console.error('Signin edge function returned failure:', signinData);
          return new Response(
            JSON.stringify({ error: "Failed to complete signup authentication" }),
            {
              status: 500,
              headers: {
                'Content-Type': 'application/json',
                ...corsHeaders,
              },
            }
          );
        }

        // Return the signin response data (which includes user creation/update)
        console.log('Signup completed successfully via signin edge function');
        return new Response(
          JSON.stringify(signinData),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
        
      } catch (signinError) {
        console.error('Error calling signin edge function:', signinError);
        return new Response(
          JSON.stringify({ error: "Failed to complete signup authentication" }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }
    }

    console.error('Unhandled error in signup function');
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error('Sign-up error:', error);
    
    // Handle specific SmartUser API errors
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      if (error.message.includes('409') || error.message.includes('Conflict')) {
        console.error('User already exists');
        return new Response(
          JSON.stringify({ error: "User already exists" }),
          {
            status: 409,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
});