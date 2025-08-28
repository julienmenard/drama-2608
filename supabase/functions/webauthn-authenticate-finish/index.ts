import { createClient } from 'npm:@supabase/supabase-js@2.53.0';
import { verifyAuthenticationResponse } from 'npm:@simplewebauthn/server@10.0.1';

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
    const { authResp, expectedChallenge, clientOrigin } = await req.json();

    if (!authResp || !expectedChallenge) {
      return new Response(JSON.stringify({ error: 'authResp and expectedChallenge are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Get the origin from the request
    const origin = clientOrigin || req.headers.get('origin') || 'http://localhost:8081';
    const rpID = new URL(origin).hostname;

    console.log('WebAuthn authentication finish:', { rpID, origin, credentialId: authResp.id });

    // Convert credential ID from base64url to base64 for database lookup
    const credentialIdBase64 = btoa(String.fromCharCode(...new Uint8Array(
      Uint8Array.from(atob(authResp.id.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
    )));

    // Get user's registered credential
    const { data: credential, error: fetchError } = await supabase
      .from('user_webauthn_credentials')
      .select('smartuser_id, credential_id, public_key, sign_count')
      .eq('credential_id', credentialIdBase64)
      .single();

    if (fetchError || !credential) {
      console.error('Error fetching WebAuthn credential for authentication:', fetchError);
      return new Response(JSON.stringify({ error: 'Credential not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Convert stored base64 back to ArrayBuffer for verification
    const credentialIdBuffer = Uint8Array.from(atob(credential.credential_id), c => c.charCodeAt(0));
    const publicKeyBuffer = Uint8Array.from(atob(credential.public_key), c => c.charCodeAt(0));

    const verification = await verifyAuthenticationResponse({
      response: authResp,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: credentialIdBuffer,
        credentialPublicKey: publicKeyBuffer,
        counter: credential.sign_count,
      },
      requireUserVerification: false,
    });

    const { verified, authenticationInfo } = verification;

    if (verified && authenticationInfo) {
      // Update the sign_count in the database
      const { error: updateError } = await supabase
        .from('user_webauthn_credentials')
        .update({ 
          sign_count: authenticationInfo.newSignCount,
          updated_at: new Date().toISOString()
        })
        .eq('credential_id', credential.credential_id);

      if (updateError) {
        console.error('Error updating sign_count:', updateError);
        // Don't fail the authentication for this
      }

      // Get user data for the authenticated user
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('smartuser_id', credential.smartuser_id)
        .single();

      if (userError || !user) {
        console.error('Error fetching user after successful WebAuthn auth:', userError);
        return new Response(JSON.stringify({ error: 'User not found after authentication' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Generate a session token (you might want to use a more sophisticated approach)
      const sessionToken = `webauthn_${credential.smartuser_id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Update user's session token in database
      const { error: sessionError } = await supabase
        .from('users')
        .update({ 
          session_token: sessionToken,
          updated_at: new Date().toISOString()
        })
        .eq('smartuser_id', credential.smartuser_id);

      if (sessionError) {
        console.error('Error updating session token:', sessionError);
        // Continue anyway, as authentication was successful
      }

      console.log('WebAuthn authentication successful for user:', credential.smartuser_id);

      return new Response(JSON.stringify({
        success: true,
        verified,
        user: {
          id: user.smartuser_id,
          smartuserId: user.smartuser_id,
          email: user.email || '',
          isSubscribed: user.is_paying || false
        },
        sessionToken
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    } else {
      console.log('WebAuthn authentication verification failed');
      return new Response(JSON.stringify({ success: false, verified, error: 'Authentication verification failed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  } catch (error) {
    console.error('Error in webauthn-authenticate-finish:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});