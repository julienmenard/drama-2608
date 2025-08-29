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
  requestType?: 'login' | 'signup';
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

    const { emailOrPhone, password, requestType = 'login' }: LoginRequest = await req.json();

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
      console.log(`📧 ${requestType}: Input detected as email:`, emailOrPhone);
    } else {
      // Format phone number to international format
      msisdn = formatToInternationalPhone(emailOrPhone);
      console.log(`📱 ${requestType}: Input detected as phone, formatted:`, {
        original: emailOrPhone,
        formatted: msisdn
      });
    }

    // Call SmartUser API for authentication
    const apiUrl = requestType === 'signup' 
      ? 'https://auth-smartuser.dv-content.io/register/direct/msisdn/credential_create'
      : 'https://auth-smartuser.dv-content.io/login/direct/msisdn/credential_identify';
    
    console.log(`🚀 Making ${requestType} request to SmartUser API...`);
    console.log(`🌐 Request URL:`, apiUrl);
    console.log(`📦 ${requestType} request payload:`, {
      msisdn: msisdn,
      secret: password,
      requestType: requestType,
      timestamp: new Date().toISOString()
    });

    let loginResponse;
    try {
      console.log(`⏳ ${requestType}: Calling httpClient.makeSignedRequest...`);
      const requestStartTime = Date.now();
      
      loginResponse = await httpClient.makeSignedRequest<LoginResponse>(
        apiUrl,
        {
          msisdn: msisdn,
          secret: password
        }
      );
      
      const requestDuration = Date.now() - requestStartTime;
      console.log(`✅ ${requestType} response received (${requestDuration}ms):`, {
        success: true,
        hasSessionToken: !!loginResponse?.sessionToken,
        hasIdentity: !!loginResponse?.identity,
        identityId: loginResponse?.identity?.id,
        identityType: loginResponse?.identity?.type,
        identityIdentifier: loginResponse?.identity?.identifier,
        responseStructure: Object.keys(loginResponse || {}),
        fullResponse: loginResponse
      });
    } catch (err) {
      console.error(`❌ ${requestType} failed:`, {
        error: err,
        errorMessage: err.message,
        errorStack: err.stack,
        requestType: requestType,
        apiUrl: apiUrl,
        msisdn: msisdn,
        timestamp: new Date().toISOString()
      });
      return new Response(JSON.stringify({ error: `${requestType} failed`, details: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (!loginResponse || !loginResponse.sessionToken) {
      console.error(`❌ ${requestType} failed: Invalid response structure:`, {
        hasLoginResponse: !!loginResponse,
        hasSessionToken: !!loginResponse?.sessionToken,
        responseKeys: loginResponse ? Object.keys(loginResponse) : 'null',
        fullResponse: loginResponse,
        requestType: requestType,
        timestamp: new Date().toISOString()
      });
      return new Response(
        JSON.stringify({ error: requestType === 'signup' ? "Account creation failed" : "Invalid credentials" }),
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
    console.log(`💳 Making subscription check request to SmartUser API for ${requestType}...`);
    console.log(`🌐 Subscription check URL: https://auth-smartuser.dv-content.io/payment/is_paying_for`);
    console.log(`📦 Subscription request payload:`, {
      userToken: loginResponse.sessionToken
    });

    let subscriptionResponse;
    try {
      console.log(`⏳ ${requestType}: Calling subscription check...`);
      const subscriptionStartTime = Date.now();
      
      subscriptionResponse = await httpClient.makeSignedRequest<SubscriptionResponse>(
        'https://auth-smartuser.dv-content.io/payment/is_paying_for',
        {
          userToken: loginResponse.sessionToken
        }
      );
      
      const subscriptionDuration = Date.now() - subscriptionStartTime;
      console.log(`✅ Subscription check response received (${subscriptionDuration}ms):`, {
        success: true,
        isPaying: subscriptionResponse?.isPaying,
        hasPayment: !!subscriptionResponse?.payment,
        responseStructure: Object.keys(subscriptionResponse || {}),
        fullResponse: subscriptionResponse,
        requestType: requestType
      });
    } catch (err) {
      console.error(`❌ Subscription check failed for ${requestType}:`, {
        error: err,
        errorMessage: err.message,
        errorStack: err.stack,
        userToken: loginResponse.sessionToken,
        timestamp: new Date().toISOString()
      });
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

    console.log(`👤 Processing user data for ${requestType}:`, {
      smartuserId: smartuserId,
      identityType: loginResponse.identity.type,
      identityIdentifier: loginResponse.identity.identifier,
      isPaying: subscriptionResponse?.isPaying || false,
      requestType: requestType,
      timestamp: new Date().toISOString()
    });

    // Create or update user in Supabase
    console.log(`🔍 Checking if user exists in Supabase for ${requestType}...`);
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('smartuser_id', smartuserId)
      .single();

    console.log(`🔍 User existence check result for ${requestType}:`, {
      userExists: !fetchError || fetchError.code !== 'PGRST116',
      fetchError: fetchError,
      existingUser: existingUser ? {
        smartuser_id: existingUser.smartuser_id,
        email: existingUser.email,
        is_paying: existingUser.is_paying,
        created_at: existingUser.created_at
      } : null,
      requestType: requestType
    });
    let user;
    if (fetchError && fetchError.code === 'PGRST116') {
      // User doesn't exist, create new one
      console.log(`➕ User not found, creating new user for ${requestType}...`);
      const newUserData = {
        smartuser_id: smartuserId,
        email: isEmail(emailOrPhone) ? emailOrPhone : null,
        phone_number: !isEmail(emailOrPhone) ? msisdn : null,
        is_paying: subscriptionResponse?.isPaying || false,
        session_token: loginResponse.sessionToken,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      console.log(`📝 New user data to insert for ${requestType}:`, newUserData);
      
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert(newUserData)
        .select()
        .single();

      if (createError) {
        console.error(`❌ Error creating user in Supabase for ${requestType}:`, {
          error: createError,
          code: createError.code,
          message: createError.message,
          details: createError.details,
          hint: createError.hint,
          newUserData: newUserData,
          requestType: requestType
        });
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
      console.log(`✅ New user created successfully for ${requestType}:`, {
        smartuser_id: newUser.smartuser_id,
        email: newUser.email,
        phone_number: newUser.phone_number,
        is_paying: newUser.is_paying,
        created_at: newUser.created_at,
        requestType: requestType
      });
      user = newUser;
    } else if (fetchError) {
      console.error(`❌ Error fetching user from Supabase for ${requestType}:`, fetchError);
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
      console.log(`🔄 User found, updating session token and subscription status for ${requestType}...`);
      const updateData = {
        session_token: loginResponse.sessionToken,
        is_paying: subscriptionResponse?.isPaying || false,
        email: isEmail(emailOrPhone) ? emailOrPhone : existingUser.email,
        phone_number: !isEmail(emailOrPhone) ? msisdn : existingUser.phone_number,
        updated_at: new Date().toISOString()
      };
      console.log(`📝 User update data for ${requestType}:`, updateData);
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('smartuser_id', smartuserId)
        .select()
        .single();

      if (updateError) {
        console.error(`❌ Error updating user in Supabase for ${requestType}:`, {
          error: updateError,
          code: updateError.code,
          message: updateError.message,
          updateData: updateData,
          requestType: requestType
        });
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
      console.log(`✅ User updated successfully for ${requestType}:`, {
        smartuser_id: updatedUser.smartuser_id,
        email: updatedUser.email,
        phone_number: updatedUser.phone_number,
        is_paying: updatedUser.is_paying,
        updated_at: updatedUser.updated_at,
        requestType: requestType
      });
      user = updatedUser;
    }

    console.log(`🎉 Preparing success response for ${requestType}...`);
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
    console.log(`📤 Success response data for ${requestType}:`, {
      success: responseData.success,
      userId: responseData.user.id,
      userEmail: responseData.user.email,
      userIsSubscribed: responseData.user.isSubscribed,
      hasSessionToken: !!responseData.sessionToken,
      sessionTokenLength: responseData.sessionToken.length,
      fullResponseData: responseData
    });

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