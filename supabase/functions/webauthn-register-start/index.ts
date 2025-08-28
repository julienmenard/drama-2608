import { createClient } from 'npm:@supabase/supabase-js@2.53.0';
import { generateRegistrationOptions } from 'npm:@simplewebauthn/server@10.0.1';

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
    const { smartuserId, email } = await req.json();

    if (!smartuserId || !email) {
      return new Response(JSON.stringify({ error: 'smartuserId and email are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Get the origin from the request
    const origin = req.headers.get('origin') || 'http://localhost:8081';
    const rpID = new URL(origin).hostname;
    const rpName = 'Dramapills';

    console.log('WebAuthn registration start:', { smartuserId, email, rpID, origin });

    // Check for existing credentials to exclude them
    const { data: existingCredentials, error: fetchError } = await supabase
      .from('user_webauthn_credentials')
      .select('credential_id')
      .eq('smartuser_id', smartuserId);

    if (fetchError) {
      console.error('Error fetching existing credentials:', fetchError);
      return new Response(JSON.stringify({ error: 'Failed to check existing credentials' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const excludeCredentials = (existingCredentials || []).map(cred => ({
      id: Uint8Array.from(atob(cred.credential_id), c => c.charCodeAt(0)),
      type: 'public-key' as const,
    }));

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new TextEncoder().encode(smartuserId),
      userName: email,
      userDisplayName: email.split('@')[0] || email,
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'preferred',
        residentKey: 'preferred',
      },
      timeout: 60000,
    });

    console.log('Generated registration options:', { challenge: options.challenge });

    return new Response(JSON.stringify(options), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    console.error('Error in webauthn-register-start:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});