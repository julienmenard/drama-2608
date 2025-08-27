import { createClient } from 'npm:@supabase/supabase-js@2.53.0';
import { generateAuthenticationOptions } from 'npm:@simplewebauthn/server@10.0.1';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { smartuserId } = await req.json();

    // Get the origin from the request
    const origin = req.headers.get('origin') || 'http://localhost:8081';
    const rpID = new URL(origin).hostname;

    console.log('WebAuthn authentication start:', { smartuserId, rpID, origin });

    let allowCredentials = [];

    if (smartuserId) {
      // Get user's registered credentials
      const { data: credentials, error: fetchError } = await supabase
        .from('user_webauthn_credentials')
        .select('credential_id, transports')
        .eq('smartuser_id', smartuserId);

      if (fetchError) {
        console.error('Error fetching WebAuthn credentials:', fetchError);
        return new Response(JSON.stringify({ error: 'Failed to fetch credentials' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      allowCredentials = (credentials || []).map(cred => {
        // Convert base64 back to ArrayBuffer
        const binaryString = atob(cred.credential_id);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        return {
          id: bytes,
          type: 'public-key' as const,
          transports: cred.transports || [],
        };
      });
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials,
      userVerification: 'preferred',
      timeout: 60000,
    });

    console.log('Generated authentication options:', { challenge: options.challenge });

    return new Response(JSON.stringify(options), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    console.error('Error in webauthn-authenticate-start:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});