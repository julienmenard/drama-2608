import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Dimensions, Alert } from 'react-native';
import { Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Play, User, Gift } from 'lucide-react-native';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Image as RNImage } from 'react-native';
import { useFirstEpisodesOfAllSeries } from '@/hooks/useContent';
import { useTranslation } from '@/hooks/useTranslation';
import { useCountry } from '@/hooks/useCountry';
import { useCampaignConfig } from '@/hooks/useCampaignConfig';
import { useAuth } from '@/hooks/useAuth';
import { BitmovinPlayer } from '@/components/BitmovinPlayer';
import { styles } from '@/styles/forYouStyles';
import { ContentService } from '@/services/contentService';

const { width: screenWidth } = Dimensions.get('window');

export default function ForYouScreen() {
  const { t } = useTranslation();
  const { authState } = useAuth();
  const { countryCode, countryName, isLoading: countryLoading } = useCountry();
  const { campaignCountriesLanguagesId, isLoading: campaignLoading, isAvailable } = useCampaignConfig();
  const { episodes: firstEpisodes, loading, error } = useFirstEpisodesOfAllSeries(campaignCountriesLanguagesId);
  const [playerState, setPlayerState] = useState<{
    isVisible: boolean;
    episodes?: Episode[];
    seriesId?: string;
    initialEpisodeId?: string;
  }>({
    isVisible: false,
    episodes: undefined,
    seriesId: undefined,
    initialEpisodeId: undefined,
  });
  const [hasAutoLaunched, setHasAutoLaunched] = useState(false);

  const handleShowFullSeries = async (seriesId: string, episodeId: string) => {
    console.log('🎬 For You: Showing full series:', { seriesId, episodeId });
    
    try {
      // Get the first season data for this series
      const firstSeasonData = await ContentService.getFirstSeasonIdForSeries(campaignCountriesLanguagesId, seriesId);
      if (firstSeasonData) {
        // Update player state to show all episodes of the series
        setPlayerState({
          isVisible: true,
          episodes: undefined, // This will trigger loading all episodes for the series
          seriesId: seriesId,
          initialEpisodeId: episodeId,
        });
      } else {
        Alert.alert(t('error'), t('seasonNotFound'));
      }
    } catch (error) {
      console.error('Error showing full series:', error);
      Alert.alert(t('error'), t('seasonNotFound'));
    }
  };

  const closePlayer = () => {
    // Dispatch custom event to show navigation when player closes
    if (Platform.OS === 'web') {
      const hidePlayerEvent = new CustomEvent('playerVisibilityChanged', {
        detail: { isVisible: false }
      });
      window.dispatchEvent(hidePlayerEvent);
    }

    setHasAutoLaunched(true);

    // First delay: Allow tab bar to process visibility event
    setTimeout(() => {
      setPlayerState({
        isVisible: false,
        episodes: undefined,
        seriesId: undefined,
        initialEpisodeId: undefined,
      });

      // Second delay: Ensure UI has settled before navigation
      setTimeout(() => {
        // Use root path since route groups aren't part of the URL
        router.replace('/');
      }, 100);
    }, 50);
  };

  // Reset auto-launch flag when tab gains focus
  useFocusEffect(
    useCallback(() => {
      console.log('💖 For You: Tab gained focus, resetting hasAutoLaunched flag');
      setHasAutoLaunched(false);
    }, [])
  );

  // Auto-launch player when episodes are loaded (web only)
  useEffect(() => {
    if (
      Platform.OS === 'web' &&
      !loading &&
      firstEpisodes.length > 0 &&
      !playerState.isVisible &&
      !hasAutoLaunched
    ) {
      console.log('🎬 For You: Auto-launching player with first episodes:', firstEpisodes.length);
      setPlayerState({
        isVisible: true,
        episodes: firstEpisodes,
        seriesId: undefined,
        initialEpisodeId: undefined,
      });
      setHasAutoLaunched(true);
    }
  }, [loading, firstEpisodes, playerState.isVisible, hasAutoLaunched]);

  // Log country information for debugging
  useEffect(() => {
    if (countryCode && countryName) {
      console.log('💖 For You: User country detected:', {
        code: countryCode,
        name: countryName
      });
    }
  }, [countryCode, countryName]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t('loadingContent')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAvailable) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.unavailableContainer}>
          <View style={styles.unavailableHeader}>
            <Text style={styles.unavailableLogo}>{t('appName')}</Text>
          </View>
          
          <View style={styles.unavailableContent}>
            <Text style={styles.unavailableTitle}>{t('appNotAvailable')}</Text>
            <Text style={styles.unavailableSubtext}>{t('appNotAvailableSubtext')}</Text>
            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonText}>Coming Soon</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // For web platform, show player directly
  if (Platform.OS === 'web') {
    if (loading) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>{t('loadingContent')}</Text>
          </View>
        </SafeAreaView>
      );
    }

    if (firstEpisodes.length === 0) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>{t('noContentAvailable')}</Text>
          </View>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={styles.container}>
        {playerState.isVisible && (playerState.episodes?.length > 0 || playerState.seriesId) && (
          <BitmovinPlayer
            episodes={playerState.episodes}
            seriesId={playerState.seriesId || playerState.episodes?.[0]?.seriesId || ''}
            initialEpisodeId={playerState.initialEpisodeId}
            onClose={closePlayer}
            onShowFullSeries={handleShowFullSeries}
          />
        )}
      </SafeAreaView>
    );
  }

  // For React Native platforms, show message that this feature is web-only
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.desktopContainer}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerContent}>
              <RNImage 
                source={require('@/assets/images/logo-dp.png')} 
                style={styles.logoImage}
                resizeMode="contain"
              />
              <Text style={styles.subtitle}>{t('recommendedForYou')}</Text>
            </View>
            <View style={styles.headerIcons}>
              {authState.user && (
                <TouchableOpacity 
                  style={styles.headerIconButton}
                  onPress={() => router.push('/rewards')}
                >
                  <Gift size={24} color="#fff" />
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                style={styles.headerIconButton}
                onPress={() => router.push('/(tabs)/profile')}
              >
                <User size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>
            {t('language') === 'fr' 
              ? 'Cette fonctionnalité est disponible sur la version web' 
              : 'This feature is available on the web version'
            }
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}