import { supabase } from './supabase';

// GeoIP API integration for country detection via Supabase Edge Function
export type GeoIpSuccess = { 
  code: 200; 
  error: 0; 
  data: { success: string } 
};

export type GeoIpError = { 
  code: string; 
  error: 1; 
  messages: string 
};

export async function getCountryByIp(ip?: string): Promise<string> {
  try {
    console.log('🌍 GeoIP: Starting country detection...');
    
    let body = '';
    if (ip) {
      body = new URLSearchParams({ ip }).toString();
      console.log('🌍 GeoIP: Using provided IP:', ip);
    } else {
      console.log('🌍 GeoIP: Using caller IP (no IP parameter provided)');
    }

    console.log('🌍 GeoIP: Making request via Supabase Edge Function...');

    // Use Supabase Edge Function to proxy the GeoIP request
    const apiUrl = `${supabase.supabaseUrl}/functions/v1/geoip`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabase.supabaseKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    console.log('🌍 GeoIP: Edge Function response status:', response.status);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const json = await response.json() as GeoIpSuccess | GeoIpError;
    console.log('🌍 GeoIP: Edge Function response:', json);

    if (json.error === 0) {
      const countryCode = json.data.success;
      console.log('🌍 GeoIP: ✅ Country detected successfully:', countryCode);
      return countryCode;
    } else {
      const errorMsg = `${json.code}: ${json.messages}`;
      console.error('🌍 GeoIP: ❌ API returned error:', errorMsg);
      throw new Error(errorMsg);
    }
  } catch (error) {
    console.error('🌍 GeoIP: ❌ Failed to detect country:', error);
    
    // Return default country code on error
    const defaultCountry = 'US';
    console.log('🌍 GeoIP: 🔄 Falling back to default country:', defaultCountry);
    return defaultCountry;
  }
}

// Helper function to get country name from code (optional)
export function getCountryName(countryCode: string): string {
  const countryNames: Record<string, string> = {
    'US': 'United States',
    'FR': 'France',
    'GB': 'United Kingdom',
    'DE': 'Germany',
    'ES': 'Spain',
    'IT': 'Italy',
    'CA': 'Canada',
    'AU': 'Australia',
    'JP': 'Japan',
    'BR': 'Brazil',
    'MX': 'Mexico',
    'IN': 'India',
    'CN': 'China',
    'RU': 'Russia',
    // Add more countries as needed
  };
  
  return countryNames[countryCode] || countryCode;
}