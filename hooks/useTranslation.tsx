import { useState, useEffect, createContext, useContext } from 'react';
import { Platform } from 'react-native';
import * as Localization from 'expo-localization';
import { en, TranslationKey } from '@/texts/en';
import { fr } from '@/texts/fr';

type Language = 'en' | 'fr';
type Translations = typeof en;

const translations: Record<Language, Translations> = {
  en,
  fr,
};

// Platform-specific storage functions
const getStorageItem = async (key: string): Promise<string | null> => {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  } else {
    const { getItemAsync } = await import('expo-secure-store');
    return await getItemAsync(key);
  }
};

const setStorageItem = async (key: string, value: string): Promise<void> => {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
  } else {
    const { setItemAsync } = await import('expo-secure-store');
    await setItemAsync(key, value);
  }
};

interface TranslationContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: TranslationKey) => string;
  isLoading: boolean;
}

const TranslationContext = createContext<TranslationContextType>({
  language: 'en',
  setLanguage: async () => {},
  t: (key: TranslationKey) => key,
  isLoading: true,
});

export const useTranslation = () => {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
};

export const TranslationProvider = ({ children }: { children: React.ReactNode }) => {
  const [language, setLanguageState] = useState<Language>('en');
  const [isLoading, setIsLoading] = useState(true);

  // Function to detect device/browser language
  const detectSystemLanguage = (): Language => {
    try {
      if (Platform.OS === 'web') {
        // For web, use browser language
        const browserLang = navigator.language || navigator.languages?.[0] || 'en';
        return browserLang.startsWith('fr') ? 'fr' : 'en';
      } else {
        // For React Native, use device locale
        const deviceLocale = Localization.getLocales()[0]?.languageCode || 'en';
        return deviceLocale.startsWith('fr') ? 'fr' : 'en';
      }
    } catch (error) {
      console.error('Error detecting system language:', error);
      return 'en';
    }
  };

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      const savedLanguage = await getStorageItem('language');
      if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'fr')) {
        setLanguageState(savedLanguage as Language);
      } else {
        // Default to system language
        const systemLanguage = detectSystemLanguage();
        setLanguageState(systemLanguage);
        // Save the detected language
        await setStorageItem('language', systemLanguage);
      }
    } catch (error) {
      console.error('Error loading language:', error);
      const systemLanguage = detectSystemLanguage();
      setLanguageState(systemLanguage);
    } finally {
      setIsLoading(false);
    }
  };

  const setLanguage = async (lang: Language) => {
    try {
      await setStorageItem('language', lang);
      setLanguageState(lang);
    } catch (error) {
      console.error('Error saving language:', error);
    }
  };

  const t = (key: TranslationKey): string => {
    return translations[language][key] || key;
  };

  return (
    <TranslationContext.Provider value={{ language, setLanguage, t, isLoading }}>
      {children}
    </TranslationContext.Provider>
  );
};