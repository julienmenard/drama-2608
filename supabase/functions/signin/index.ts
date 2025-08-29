import { createClient } from 'npm:@supabase/supabase-js@2.53.0';

const CONNECTION_TIMEOUT = 10000;

interface HTTPClientConfig {
  identifier: string;
  secret: string;
  iPawn?: {
    whiteLabel: string;
    isInternational: boolean;
  };
}

class HTTPClient {
  private readonly ERROR_CODE = 'HTTP_CLIENT_ERROR';
  private disabled: boolean;
  private applicationSecret?: string;
  private whiteLabel?: string;
  private isInternational: boolean = false;

  constructor(private readonly config: HTTPClientConfig) {
    this.disabled = false;
  }

  setup(): this {
    this.applicationSecret = this.config.secret;

    if (this.config.iPawn !== undefined) {
      this.whiteLabel = this.config.iPawn.whiteLabel;
      this.isInternational = this.config.iPawn.isInternational;
    }

    return this;
  }

  async makeSignedRequest<T = unknown>(url: string, body: Record<string, unknown>): Promise<T | undefined> {
    if (this.disabled) {
      throw new Error('Disabled instance');
    }

    const timestamp = Math.ceil((new Date()).getTime() / 1000);
    const headers = { Authorization: await this.getAuthHeader('POST', url, JSON.stringify(body), '', timestamp) };

    return await this.makePostWithFetch<T>(url, body, headers);
  }

  private async makePostWithFetch<T = unknown>(url: string, body: Record<string, unknown>, headers: Record<string, string> = {}): Promise<T | undefined> {
    const controller = new AbortController();
    const id = setTimeout(() => {
      controller.abort();
    }, CONNECTION_TIMEOUT);

    try {
      const result = await fetch(url, {
        method: 'POST',
        headers: { ...headers, 'Content-type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      if (result.ok === true) {
        if (![204, 205, 0].includes(result.status)) {
          return await result.json() as T;
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

      let code: string = this.ERROR_CODE;
      let message: string = errorResponse.statusText ?? 'Unknown error';
      const status: string = result.status.toString();

      if (errorResponse.error?.message !== undefined && typeof errorResponse.error.message === 'string') {
        message = errorResponse.error.message;
      }

      if (errorResponse.error?.code !== undefined && typeof errorResponse.error.code === 'string') {
        code = errorResponse.error.code;
      }

      throw new Error(`${message} ${code} ${status}`);
    } catch (error) {
      console.error("HTTP POST failed", { url, error });
      throw error;
    } finally {
      clearTimeout(id);
    }
  }

  disable(): void {
    this.disabled = true;
  }

  isDisabled(): boolean {
    return this.disabled;
  }

  private async getIpawnHash(url: string, method: string, bodyString: string, queryString: string, timestamp: number): Promise<string> {
    if (this.applicationSecret === undefined) throw new Error('Unable to generate iPawn signature without application secret');
    url = url.replace(/^https?:\/\//, '');
    const msg = [url, method, bodyString, queryString, timestamp].join('|');
    return await this.getHmac(msg, this.applicationSecret);
  }

  private async getHmac(message: string, secret: string, algorithm: 'SHA-1' = 'SHA-1'): Promise<string> {
    const enc = new TextEncoder();
    const keyData = enc.encode(secret);
    const messageData = enc.encode(message);

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: { name: algorithm } },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, messageData);
    const signatureArray = new Uint8Array(signature);
    const hexSignature = Array.from(signatureArray)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return hexSignature;
  }

  private async getAuthHeader(method: string, url: string, bodyString: string, queryString: string, timestamp: number): Promise<string> {
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

interface LoginRequest {
  emailOrPhone: string;
  password: string;
}

interface LoginResponse {
  sessionToken: string;
  identity: {
    id: string;
    type: string;
    identifier: string;
    extra: {
      operator: string;
      country: string;
    };
    createdAt: string;
    updatedAt: string;
  };
}

interface SubscriptionResponse {
  isPaying: boolean;
  payment: Record<string, any>;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Helper function to format phone number to international format
function formatToInternationalPhone(input: string): string {
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
function isEmail(input: string): boolean {
  return input.includes('@') && input.includes('.');
}

Deno.serve(async (req: Request) => {
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

    const { emailOrPhone, password }: LoginRequest = await req.json();

    if (!emailOrPhone || !password) {
      return new Response(
        JSON.stringify({ error: "Email/phone and password are required" }),
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
    let msisdn: string;
    if (isEmail(emailOrPhone)) {
      // For email, we'll use it as is (the API might handle email differently)
      msisdn = emailOrPhone;
    } else {
      // Format phone number to international format
      msisdn = formatToInternationalPhone(emailOrPhone);
    }

    // Call SmartUser API for authentication
    console.log('Making login request to SmartUser API...');
    console.log('Request URL: https://auth-smartuser.dv-content.io/login/direct/msisdn/credential_identify');
    console.log('Login request body:', {
      msisdn: msisdn,
      secret: password
    });

    let loginResponse;
    try {
      loginResponse = await httpClient.makeSignedRequest<LoginResponse>(
        'https://auth-smartuser.dv-content.io/login/direct/msisdn/credential_identify',
        {
          msisdn: msisdn,
          secret: password
        }
      );
      console.log('Login response OK', loginResponse);
    } catch (err) {
      console.error('Login failed', err);
      return new Response(JSON.stringify({ error: "Login failed", details: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (!loginResponse || !loginResponse.sessionToken) {
      console.error('Login failed: No session token in response');
      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    // Check subscription status
    console.log('Making subscription check request to SmartUser API...');
    console.log('Request URL: https://auth-smartuser.dv-content.io/payment/is_paying_for');
    console.log('Subscription request body:', {
      userToken: loginResponse.sessionToken
    });

    let subscriptionResponse;
    try {
      subscriptionResponse = await httpClient.makeSignedRequest<SubscriptionResponse>(
        'https://auth-smartuser.dv-content.io/payment/is_paying_for',
        {
          userToken: loginResponse.sessionToken
        }
      );
      console.log('Subscription response OK', subscriptionResponse);
    } catch (err) {
      console.error('Subscription check failed', err);
      return new Response(JSON.stringify({ error: "Subscription check failed", details: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Use the identity.id from SmartUser API response as smartuser_id
    const smartuserId = loginResponse.identity.id;

    console.log('Processing user data for smartuser_id:', smartuserId);

    // Create or update user in Supabase
    console.log('Checking if user exists in Supabase...');
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('smartuser_id', smartuserId)
      .single();

    let user;
    if (fetchError && fetchError.code === 'PGRST116') {
      // User doesn't exist, create new one
      console.log('User not found, creating new user...');
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          smartuser_id: smartuserId,
          email: isEmail(emailOrPhone) ? emailOrPhone : null,
          phone_number: !isEmail(emailOrPhone) ? msisdn : null,
          is_paying: subscriptionResponse?.isPaying || false,
          session_token: loginResponse.sessionToken,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating user in Supabase:', createError);
        return new Response(
          JSON.stringify({ error: "Failed to create user account" }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }
      console.log('New user created successfully:', newUser);
      user = newUser;
    } else if (fetchError) {
      console.error('Error fetching user from Supabase:', fetchError);
      return new Response(
        JSON.stringify({ error: "Database error" }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    } else {
      // User exists, update session token and subscription status
      console.log('User found, updating session token and subscription status...');
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          session_token: loginResponse.sessionToken,
          is_paying: subscriptionResponse?.isPaying || false,
          email: isEmail(emailOrPhone) ? emailOrPhone : existingUser.email,
          phone_number: !isEmail(emailOrPhone) ? msisdn : existingUser.phone_number,
          updated_at: new Date().toISOString()
        })
        .eq('smartuser_id', smartuserId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating user in Supabase:', updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update user account" }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }
      console.log('User updated successfully:', updatedUser);
      user = updatedUser;
    }

    console.log('Preparing success response...');
    const responseData = {
      success: true,
      user: {
        id: user.smartuser_id,
        smartuserId: user.smartuser_id,
        email: user.email || '',
        isSubscribed: user.is_paying
      },
      sessionToken: loginResponse.sessionToken
    };
    console.log('Success response data:', JSON.stringify(responseData, null, 2));

    // Return success response with user data
    return new Response(
      JSON.stringify(responseData),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );

  } catch (error) {
    console.error('Sign-in error:', error);
    
    // Handle specific SmartUser API errors
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        console.error('Authentication failed - Invalid credentials');
        return new Response(
          JSON.stringify({ error: "Invalid credentials" }),
          {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }
    }

    console.error('Unhandled error in signin function');
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