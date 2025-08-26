import { useState, useEffect, createContext, useContext, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useCountry } from './useCountry';
import { useTranslation } from './useTranslation';

interface CampaignConfigContextType {
  campaignCountriesLanguagesId: string | null;
  isLoading: boolean;
  isAvailable: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const CampaignConfigContext = createContext<CampaignConfigContextType>({
  campaignCountriesLanguagesId: null,
  isLoading: true,
  isAvailable: false,
  error: null,
  refetch: async () => {},
});

export const useCampaignConfig = () => {
  const context = useContext(CampaignConfigContext);
  if (!context) {
    throw new Error('useCampaignConfig must be used within a CampaignConfigProvider');
  }
  return context;
};

export const CampaignConfigProvider = ({ children }: { children: React.ReactNode }) => {
  const isMountedRef = useRef(true);
  const [campaignCountriesLanguagesId, setCampaignCountriesLanguagesId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { countryCode, isLoading: countryLoading } = useCountry();
  const { language, isLoading: translationLoading } = useTranslation();

  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!countryLoading && !translationLoading && countryCode && language) {
      fetchCampaignConfig();
    }
  }, [countryCode, language, countryLoading, translationLoading]);

  const fetchCampaignConfig = async () => {
    if (!countryCode || !language) {
      console.log('🎯 CampaignConfig: Missing country or language, skipping fetch');
      return;
    }

    try {
      console.log('🎯 CampaignConfig: Fetching campaign config for:', {
        countryCode,
        language
      });

      setIsLoading(true);
      setError(null);

      if (!supabase) {
        console.warn('🎯 CampaignConfig: Supabase not configured, marking as unavailable');
        if (isMountedRef.current) {
          setIsAvailable(false);
          setIsLoading(false);
        }
        return;
      }

      // Convert country code to lowercase before querying
      const countryCodeLower = countryCode.toLowerCase();

      // Query campaign_countries_languages table
      const { data, error: fetchError } = await supabase
        .from('campaign_countries_languages')
        .select('id')
        .eq('country_code', countryCodeLower)
        .eq('language_code', language)
        .maybeSingle();

      if (fetchError) {
        console.error('🎯 CampaignConfig: ❌ Error fetching campaign config:', fetchError);
        if (isMountedRef.current) {
          setError('Failed to load campaign configuration');
          setIsAvailable(false);
        }
      } else if (data === null) {
        // No matching record found
        console.log('🎯 CampaignConfig: ❌ No campaign config found for:', {
          countryCode: countryCodeLower,
          language
        });
        if (isMountedRef.current) {
          setCampaignCountriesLanguagesId(null);
          setIsAvailable(false);
        }
      } else if (data) {
        console.log('🎯 CampaignConfig: ✅ Campaign config found:', {
          id: data.id,
          countryCode: countryCodeLower,
          language
        });
        if (isMountedRef.current) {
          setCampaignCountriesLanguagesId(data.id);
          setIsAvailable(true);
        }
      }
    } catch (err) {
      console.error('🎯 CampaignConfig: ❌ Unexpected error:', err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setIsAvailable(false);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const refetch = async () => {
    await fetchCampaignConfig();
  };

  return (
    <CampaignConfigContext.Provider value={{
      campaignCountriesLanguagesId,
      isLoading,
      isAvailable,
      error,
      refetch,
    }}>
      {children}
    </CampaignConfigContext.Provider>
  );
};