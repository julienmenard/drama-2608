import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { useCountry } from '@/hooks/useCountry';
import { useCampaignConfig } from '@/hooks/useCampaignConfig';

export const SplashScreenManager: React.FC = () => {
  const { authState } = useAuth();
  const { isLoading: translationLoading } = useTranslation();
  const { isLoading: countryLoading } = useCountry();
  const { isLoading: campaignLoading } = useCampaignConfig();

  useEffect(() => {
    const hideSplashScreen = async () => {
      // Wait for all critical data to load
      const isAppReady = !authState.isLoading && 
                        !translationLoading && 
                        !countryLoading && 
                        !campaignLoading;

      if (isAppReady) {
        console.log('🚀 App is ready, hiding splash screen');
        await SplashScreen.hideAsync();
      }
    };

    hideSplashScreen();
  }, [authState.isLoading, translationLoading, countryLoading, campaignLoading]);

  // This component doesn't render anything visible
  // The splash screen is handled by Expo's native splash screen
  return null;
};