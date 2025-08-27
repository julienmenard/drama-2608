import { createClient } from 'npm:@supabase/supabase-js@2.53.0';
import { verifyRegistrationResponse } from 'npm:@simplewebauthn/server@10.0.1';

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
    const { smartuserId, attResp, expectedChallenge } = await req.json();

    if (!smartuserId || !attResp || !expectedChallenge) {
      return new Response(JSON.stringify({ error: 'smartuserId, attResp, and expectedChallenge are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Get the origin from the request
    const origin = req.headers.get('origin') || 'http://localhost:8081';
    const rpID = new URL(origin).hostname;

    console.log('WebAuthn registration finish:', { smartuserId, rpID, origin });

    const verification = await verifyRegistrationResponse({
      response: attResp,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });

    const { verified, registrationInfo } = verification;

    if (verified && registrationInfo) {
      const { credentialID, credentialPublicKey, counter, attestationType, aaguid } = registrationInfo;

      // Convert ArrayBuffer to base64 for storage
      const credentialIdBase64 = btoa(String.fromCharCode(...new Uint8Array(credentialID)));
      const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(credentialPublicKey)));
      const aaguidHex = aaguid ? Array.from(new Uint8Array(aaguid)).map(b => b.toString(16).padStart(2, '0')).join('') : null;

      // Store the credential in the database
      const { error } = await supabase
        .from('user_webauthn_credentials')
        .insert({
          smartuser_id: smartuserId,
          credential_id: credentialIdBase64,
          public_key: publicKeyBase64,
          attestation_type: attestationType,
          aaguid: aaguidHex,
          sign_count: counter,
          transports: attResp.response?.transports || [],
        });

      if (error) {
        console.error('Error storing WebAuthn credential:', error);
        return new Response(JSON.stringify({ error: 'Failed to store credential' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      console.log('WebAuthn credential stored successfully');

      return new Response(JSON.stringify({ success: true, verified }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    } else {
      console.log('WebAuthn registration verification failed');
      return new Response(JSON.stringify({ success: false, verified, error: 'Registration verification failed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  } catch (error) {
    console.error('Error in webauthn-register-finish:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});