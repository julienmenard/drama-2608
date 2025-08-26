import 'react-native-url-polyfill/auto';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from '@/hooks/useAuth';
import { TranslationProvider } from '@/hooks/useTranslation';
import { CountryProvider } from '@/hooks/useCountry';
import { CampaignConfigProvider } from '@/hooks/useCampaignConfig';
import { GamificationProvider } from '@/hooks/useGamification';
import { RewardNotificationManager } from '@/components/RewardNotificationManager';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { SplashScreenManager } from '@/components/SplashScreenManager';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useFrameworkReady();

  return (
    <CountryProvider>
      <TranslationProvider>
        <CampaignConfigProvider>
          <AuthProvider>
            <GamificationProvider>
              <SplashScreenManager />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="login" />
                <Stack.Screen name="signup" />
                <Stack.Screen name="rewards" />
                <Stack.Screen name="rubrique/[rubriqueId]" />
                <Stack.Screen name="saison/[saisonId]" />
                <Stack.Screen name="+not-found" />
              </Stack>
              <StatusBar style="light" backgroundColor="#1a1a1a" />
              <RewardNotificationManager />
            </GamificationProvider>
          </AuthProvider>
        </CampaignConfigProvider>
      </TranslationProvider>
    </CountryProvider>
  );
}