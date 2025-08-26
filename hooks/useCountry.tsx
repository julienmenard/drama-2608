import { useState, useEffect, createContext, useContext, useRef } from 'react';
import { getCountryByIp, getCountryName } from '@/lib/geoip';

interface CountryContextType {
  countryCode: string | null;
  countryName: string | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const CountryContext = createContext<CountryContextType>({
  countryCode: null,
  countryName: null,
  isLoading: true,
  error: null,
  refetch: async () => {},
});

export const useCountry = () => {
  const context = useContext(CountryContext);
  if (!context) {
    throw new Error('useCountry must be used within a CountryProvider');
  }
  return context;
};

export const CountryProvider = ({ children }: { children: React.ReactNode }) => {
  const isMountedRef = useRef(true);
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [countryName, setCountryName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    detectCountry();
    
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const detectCountry = async () => {
    try {
      console.log('🌍 CountryProvider: Starting country detection...');
      setIsLoading(true);
      setError(null);

      const detectedCountryCode = await getCountryByIp();
      
      if (isMountedRef.current) {
        setCountryCode(detectedCountryCode);
        setCountryName(getCountryName(detectedCountryCode));
        console.log('🌍 CountryProvider: ✅ Country set:', {
          code: detectedCountryCode,
          name: getCountryName(detectedCountryCode)
        });
      }
    } catch (err) {
      console.error('🌍 CountryProvider: ❌ Error detecting country:', err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to detect country');
        // Set default values on error
        setCountryCode('US');
        setCountryName('United States');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const refetch = async () => {
    await detectCountry();
  };

  return (
    <CountryContext.Provider value={{
      countryCode,
      countryName,
      isLoading,
      error,
      refetch,
    }}>
      {children}
    </CountryContext.Provider>
  );
};