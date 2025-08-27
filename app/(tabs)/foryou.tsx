import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Dimensions, Alert } from 'react-native';
import { Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Play, User, Gift } from 'lucide-react-native';
import { router } from 'expo-router';
import { useRubriques, useSeriesByRubrique } from '@/hooks/useContent';
import { ContentService } from '@/services/contentService';
import { useTranslation } from '@/hooks/useTranslation';
import { useCountry } from '@/hooks/useCountry';
import { useCampaignConfig } from '@/hooks/useCampaignConfig';
import { useAuth } from '@/hooks/useAuth';
import { styles } from '@/styles/forYouStyles';

const { width: screenWidth } = Dimensions.get('window');

export default function ForYouScreen() {
  const { t } = useTranslation();
  const { authState } = useAuth();
  const { countryCode, countryName, isLoading: countryLoading } = useCountry();
  const { campaignCountriesLanguagesId, isLoading: campaignLoading, isAvailable } = useCampaignConfig();
  const { rubriques, loading: rubriquesLoading } = useRubriques(campaignCountriesLanguagesId);
  
  // Find Highlight rubrique
  const highlightRubrique = rubriques.find(r => r.name.toLowerCase() === 'highlight');
  const { series: highlightSeries, loading: highlightLoading } = useSeriesByRubrique(campaignCountriesLanguagesId, highlightRubrique?.id || '');
  
  // Handle navigation to first season of a series
  const handleNavigateToFirstSeason = async (seriesId: string) => {
    try {
      const firstSeasonData = await ContentService.getFirstSeasonIdForSeries(campaignCountriesLanguagesId, seriesId);
      if (firstSeasonData) {
        router.push(`/saison/${firstSeasonData.seasonId}?seriesId=${firstSeasonData.seriesId}&seasonPosition=${firstSeasonData.seasonPosition}`);
      } else {
        Alert.alert(t('error'), t('seasonNotFound'));
      }
    } catch (error) {
      console.error('Error navigating to first season:', error);
      Alert.alert(t('error'), t('seasonNotFound'));
    }
  };

  const loading = campaignLoading || rubriquesLoading || highlightLoading;

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

  if (!isAvailable || !highlightRubrique || highlightSeries.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.unavailableContainer}>
          <View style={styles.unavailableHeader}>
            <Image source={require('@/assets/images/logo-dp.png')} style={styles.unavailableLogo} resizeMode="contain" />
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.desktopContainer}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerContent}>
              <Image source={require('@/assets/images/logo-dp.png')} style={styles.logo} resizeMode="contain" />
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

        <View style={styles.section}>
          <View style={styles.grid}>
            {highlightSeries.map((serie) => (
              <TouchableOpacity
                key={serie.id}
                style={styles.gridItem}
                onPress={() => {
                  handleNavigateToFirstSeason(serie.id);
                }}
              >
                <View style={styles.cardContainer}>
                  <View style={styles.cardImageContainer}>
                    <Image source={{ uri: serie.thumbnail }} style={styles.cardImage} />
                    {serie.isNew && (
                      <View style={styles.newBadge}>
                        <Text style={styles.badgeText}>New</Text>
                      </View>
                    )}
                    {serie.isTrending && (
                      <View style={styles.trendingBadge}>
                        <Text style={styles.badgeText}>Trending</Text>
                      </View>
                    )}
                    <View style={styles.playIconOverlay}>
                      <Play size={12} color="#fff" fill="#fff" />
                    </View>
                    <View style={styles.durationBadge}>
                      <Text style={styles.durationText}>70.8 M</Text>
                    </View>
                  </View>
                  <View style={styles.cardContent}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {serie.title}
                    </Text>
                    <Text style={styles.cardEpisode}>EP.1/EP.80</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

      </ScrollView>
      </View>
    </SafeAreaView>
  );
}