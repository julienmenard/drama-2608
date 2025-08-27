import React from 'react';
import { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, TextInput, Dimensions, RefreshControl, Alert } from 'react-native';
import { Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Play, User, Gift } from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Image as RNImage } from 'react-native';
import { SerieCard } from '@/components/SerieCard';
import { HighlightCarousel } from '@/components/HighlightCarousel';
import { SearchResults } from '@/components/SearchResults';
import { BitmovinPlayer } from '@/components/BitmovinPlayer';
import { useRubriques, useSeries, useSeriesByRubrique, useTopViewedSeries, useSearch, useSeriesWithFreeEpisodes } from '@/hooks/useContent';
import { ContentService } from '@/services/contentService';
import { useTranslation } from '@/hooks/useTranslation';
import { useCountry } from '@/hooks/useCountry';
import { useCampaignConfig } from '@/hooks/useCampaignConfig';
import { useAuth } from '@/hooks/useAuth';

const { width: screenWidth } = Dimensions.get('window');

export default function HomeScreen() {
  const { t } = useTranslation();
  const { authState } = useAuth();
  const { countryCode, countryName, isLoading: countryLoading, refetch: refetchCountry } = useCountry();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const { campaignCountriesLanguagesId, isLoading: campaignLoading, isAvailable, refetch: refetchCampaign } = useCampaignConfig();
  const [refreshing, setRefreshing] = useState(false);
  const { rubriques, loading: rubriquesLoading } = useRubriques(campaignCountriesLanguagesId);
  const { series, loading: seriesLoading } = useSeries(campaignCountriesLanguagesId);
  const { series: freeEpisodesSeries, loading: freeSeriesLoading } = useSeriesWithFreeEpisodes(campaignCountriesLanguagesId);
  const [selectedRubriqueId, setSelectedRubriqueId] = useState<string | null>(null);
  const { results: searchResults, loading: searchLoading, error: searchError } = useSearch(campaignCountriesLanguagesId, searchQuery);
  const [playerState, setPlayerState] = useState<{
    isVisible: boolean;
    seriesId: string | null;
    initialEpisodeId?: string;
  }>({
    isVisible: false,
    seriesId: null,
    initialEpisodeId: undefined,
  });
  
  // Find Highlight rubric and get its series
  const highlightRubrique = rubriques.find(r => r.name.toLowerCase() === 'highlight');
  const { series: highlightSeries, loading: highlightLoading } = useSeriesByRubrique(campaignCountriesLanguagesId, highlightRubrique?.id || '');

  // Log country information for debugging
  useEffect(() => {
    if (countryCode && countryName) {
      console.log('🏠 Homepage: User country detected:', {
        code: countryCode,
        name: countryName
      });
    }
  }, [countryCode, countryName]);

  // Ensure navbar is visible when arriving on the homepage
  useEffect(() => {
    if (Platform.OS === 'web') {
      const hidePlayerEvent = new CustomEvent('playerVisibilityChanged', {
        detail: { isVisible: false }
      });
      window.dispatchEvent(hidePlayerEvent);
    }
  }, []);

  // Handle search input changes
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    setIsSearching(text.trim().length > 0);
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
    setIsSearching(false);
  };

  // Handle direct player launch
  const handlePlaySeries = (seriesId: string) => {
    console.log('🎬 handlePlaySeries called with seriesId:', seriesId);
    if (Platform.OS === 'web') {
      console.log('🎬 Setting player state for web platform');
      setPlayerState({
        isVisible: true,
        seriesId: seriesId,
        initialEpisodeId: undefined,
      });
      console.log('🎬 Player state updated:', { isVisible: true, seriesId });
    } else {
      router.push(`/serie/${seriesId}`);
    }
  };

  const handlePlayEpisode = (episodeId: string, seriesId: string) => {
    console.log('🎬 handlePlayEpisode called with:', { episodeId, seriesId });
    if (Platform.OS === 'web') {
      console.log('🎬 Setting player state for episode on web platform');
      setPlayerState({
        isVisible: true,
        seriesId: seriesId,
        initialEpisodeId: episodeId,
      });
      console.log('🎬 Player state updated for episode:', { isVisible: true, seriesId, initialEpisodeId: episodeId });
    } else {
      router.push(`/episode/${episodeId}`);
    }
  };

  const closePlayer = () => {
    console.log('🎬 closePlayer called');
    console.log('🎬 closePlayer: Current player state before closing:', {
      isVisible: playerState.isVisible,
      seriesId: playerState.seriesId,
      initialEpisodeId: playerState.initialEpisodeId
    });

    // Dispatch custom event to show navigation when player closes
    if (Platform.OS === 'web') {
      const hidePlayerEvent = new CustomEvent('playerVisibilityChanged', {
        detail: { isVisible: false }
      });
      window.dispatchEvent(hidePlayerEvent);
    }

    setPlayerState({
      isVisible: false,
      seriesId: null,
      initialEpisodeId: undefined,
    });
    console.log('🎬 Player state cleared');
    console.log('🎬 closePlayer: Player state after clearing:', {
      isVisible: false,
      seriesId: null,
      initialEpisodeId: undefined
    });
  };

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

  // Handle pull-to-refresh
  const onRefresh = async () => {
    console.log('🏠 Homepage: onRefresh() called - Pull-to-refresh initiated');
    
    if (Platform.OS === 'web') {
      // Skip refresh on web platform
      console.log('🏠 Homepage: Skipping refresh on web platform');
      return;
    }

    console.log('🔄 Homepage: Starting pull-to-refresh...');
    setRefreshing(true);
    
    try {
      // First, refetch country information (calls GeoIP API)
      console.log('🔄 Homepage: Refetching country...');
      await refetchCountry();
      
      // Then refetch campaign configuration
      console.log('🔄 Homepage: Refetching campaign config...');
      await refetchCampaign();
      
      // Note: The content hooks (rubriques, series, etc.) will automatically
      // refetch when campaignCountriesLanguagesId changes due to their useEffect dependencies
      
      console.log('🔄 Homepage: Pull-to-refresh completed');
    } catch (error) {
      console.error('🔄 Homepage: Error during refresh:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Handle automatic player launch after sign-in
  useEffect(() => {
    if (Platform.OS === 'web' && !authState.isLoading && authState.user) {
      const returnDataStr = localStorage.getItem('playerReturnData');
      if (returnDataStr) {
        try {
          const returnData = JSON.parse(returnDataStr);
          // Check if the data is recent (within 10 minutes) and user is subscribed
          if (Date.now() - returnData.timestamp < 10 * 60 * 1000 && authState.user.isSubscribed) {
            console.log('🎬 Auto-launching player after sign-in:', returnData);
            localStorage.removeItem('playerReturnData');
            setPlayerState({
              isVisible: true,
              seriesId: returnData.seriesId,
              initialEpisodeId: returnData.episodeId,
            });
          } else {
            // Clean up old or invalid data
            localStorage.removeItem('playerReturnData');
          }
        } catch (error) {
          console.error('Error parsing player return data:', error);
          localStorage.removeItem('playerReturnData');
        }
      }
    }
  }, [authState.isLoading, authState.user]);

  // Close player when navigating away from Home tab
  useFocusEffect(
    useCallback(() => {
      console.log('🏠 Home tab gained focus');
      
      return () => {
        console.log('🏠 Home tab lost focus - closing player');
        if (playerState.isVisible) {
          closePlayer();
        }
      };
    }, [playerState.isVisible])
  );

  // Separate component for rubric carousel
  const RubricCarouselComponent = ({ rubrique, selectedRubriqueId }: { rubrique: any, selectedRubriqueId: string | null }) => {
    const { series: rubricSeries, loading } = useSeriesByRubrique(campaignCountriesLanguagesId, rubrique.id);

    // If a specific rubric is selected and this isn't it, don't render
    if (selectedRubriqueId && selectedRubriqueId !== rubrique.id) {
      return null;
    }

    if (loading || rubricSeries.length === 0) {
      return null;
    }

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{rubrique.name}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
          {rubricSeries.map((serie) => (
            <TouchableOpacity
              key={serie.id}
              style={styles.horizontalCard}
              onPress={() => {
                console.log('🎬 RubricCarouselComponent: Serie card clicked:', serie.id);
                if (Platform.OS === 'web') {
                  console.log('🎬 RubricCarouselComponent: Calling handlePlaySeries for web');
                  handlePlaySeries(serie.id);
                } else {
                  console.log('🎬 RubricCarouselComponent: Calling handleNavigateToFirstSeason for mobile');
                  Alert.alert(t('videoPlayer'), t('videoPlayerImplementation'));
                }
              }}
            >
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
                  <Play size={16} color="#fff" fill="#fff" />
                </View>
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardGenre}>{rubrique.name}</Text>
                <Text style={styles.cardTitle} numberOfLines={1}>{serie.title}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  // Separate component for Free rubric carousel
  const FreeRubricCarouselComponent = ({ selectedRubriqueId }: { selectedRubriqueId: string | null }) => {
    // If a specific rubric is selected and it's not "free", don't render
    if (selectedRubriqueId && selectedRubriqueId !== 'free') {
      return null;
    }

    if (freeSeriesLoading || freeEpisodesSeries.length === 0) {
      return null;
    }

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('language') === 'fr' ? 'Gratuit' : t('free')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
          {freeEpisodesSeries.map((serie) => (
            <TouchableOpacity
              key={serie.id}
              style={styles.horizontalCard}
              onPress={() => {
                if (Platform.OS === 'web') {
                  handlePlaySeries(serie.id);
                } else {
                  Alert.alert(t('videoPlayer'), t('videoPlayerImplementation'));
                }
              }}
            >
              <View style={styles.cardImageContainer}>
                <Image source={{ uri: serie.thumbnail }} style={styles.cardImage} />
                <View style={styles.newBadge}>
                  <Text style={styles.badgeText}>{t('language') === 'fr' ? 'Gratuit' : t('free')}</Text>
                </View>
                <View style={styles.playIconOverlay}>
                  <Play size={16} color="#fff" fill="#fff" />
                </View>
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardGenre}>{t('language') === 'fr' ? 'Gratuit' : t('free')}</Text>
                <Text style={styles.cardTitle} numberOfLines={1}>{serie.title}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  // Separate component for top charts
  const TopChartsSection = ({ series, selectedRubriqueId, t }: { series: any[], selectedRubriqueId: string | null, t: (key: any) => string }) => {
    const { series: topViewedSeries, loading: topChartsLoading } = useTopViewedSeries(campaignCountriesLanguagesId, 3);
    
    if (topChartsLoading) {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('topCharts')}</Text>
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      );
    }
    
    if (topViewedSeries.length === 0) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('topCharts')}</Text>
        {topViewedSeries.map((serie, index) => (
          <TouchableOpacity
            key={serie.id}
            style={styles.topChartItem}
            onPress={() => {
              if (Platform.OS === 'web') {
                handlePlaySeries(serie.id);
              } else {
                handleNavigateToFirstSeason(serie.id);
              }
            }}
          >
            <Text style={styles.chartRank}>{index + 1}</Text>
            <Image source={{ uri: serie.thumbnail }} style={styles.topChartImage} />
            <View style={styles.topChartContent}>
              <Text style={styles.topChartTitle}>{serie.title}</Text>
              <Text style={styles.topChartSubtitle}>
                {serie.description.split(' ').slice(0, 4).join(' ')}...
              </Text>
              <View style={styles.topChartMeta}>
                <Text style={styles.topChartEpisodes}>1 Season</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const featuredSerie = series.find(s => s.isTrending) || series[0];

  if (campaignLoading || rubriquesLoading || seriesLoading) {
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
            <View style={styles.unavailableIconContainer}>
              <View style={styles.unavailableIcon}>
                <Text style={styles.unavailableIconText}>🌍</Text>
              </View>
            </View>
            
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

  if (rubriques.length === 0 && series.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.logo}>{t('appName')}</Text>
          <View style={styles.searchContainer}>
            <Search size={16} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search dramas..."
              placeholderTextColor="#666"
            />
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t('noContentAvailable')}</Text>
          <Text style={styles.loadingSubtext}>{t('checkSupabaseConfig')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.desktopContainer}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <RNImage 
            source={require('@/assets/images/logo-dp.png')} 
            style={styles.logoImage}
            resizeMode="contain"
          />
          <View style={styles.headerIcons}>
          <>
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
          </>
          </View>
        </View>
        <View style={styles.searchContainer}>
          <Search size={16} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={handleSearchChange}
            placeholder={t('searchDramas')}
            placeholderTextColor="#666"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>×</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isSearching ? (
        <SearchResults
          results={searchResults}
          loading={searchLoading}
          error={searchError}
          query={searchQuery}
          onPlaySeries={handlePlaySeries}
          onPlayEpisode={handlePlayEpisode}
        />
      ) : (
        <ScrollView 
          style={{ flex: 1 }}
          refreshControl={
            Platform.OS !== 'web' ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#FF1B8D"
                colors={['#FF1B8D']}
                progressBackgroundColor="#2a2a2a"
              />
            ) : undefined
          }
        >
          {/* Categories */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesContainer}>
            <TouchableOpacity
              style={[
                styles.categoryPill, 
                selectedRubriqueId === null && styles.categoryPillActive
              ]}
              onPress={() => setSelectedRubriqueId(null)}
            >
              <Text style={[
                styles.categoryText, 
                selectedRubriqueId === null && styles.categoryTextActive
              ]}>
                {t('allSeries')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.categoryPill, 
                selectedRubriqueId === 'free' && styles.categoryPillActive
              ]}
              onPress={() => setSelectedRubriqueId('free')}
            >
              <Text style={[
                styles.categoryText, 
                selectedRubriqueId === 'free' && styles.categoryTextActive
              ]}>
                {t('language') === 'fr' ? 'Gratuit' : t('free')}
              </Text>
            </TouchableOpacity>
            {rubriques.filter(rubrique => rubrique.name.toLowerCase() !== 'highlight').map((rubrique) => (
              <TouchableOpacity
                key={rubrique.id}
               style={[
                 styles.categoryPill, 
                 selectedRubriqueId === rubrique.id && styles.categoryPillActive
               ]}
                onPress={() => setSelectedRubriqueId(rubrique.id)}
              >
               <Text style={[
                 styles.categoryText, 
                 selectedRubriqueId === rubrique.id && styles.categoryTextActive
               ]}>
                  {rubrique.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Featured Serie */}
          {!selectedRubriqueId && (
            <HighlightCarousel 
              highlightSeries={highlightSeries}
              highlightLoading={highlightLoading}
              onPlaySeries={handlePlaySeries}
              onNavigateToFirstSeason={handleNavigateToFirstSeason}
            />
          )}

          {/* Free Episodes Section */}
          <FreeRubricCarouselComponent selectedRubriqueId={selectedRubriqueId} />

          {/* Rubric-based Carousels */}
          {rubriques.filter(rubrique => rubrique.name.toLowerCase() !== 'highlight').map((rubrique) => (
            <RubricCarouselComponent key={rubrique.id} rubrique={rubrique} selectedRubriqueId={selectedRubriqueId} />
          ))}

          {/* Top Charts */}
          <TopChartsSection t={t} series={series} selectedRubriqueId={selectedRubriqueId} />
        </ScrollView>
      )}

      {/* Bitmovin Player (Web Only) */}
      {Platform.OS === 'web' && playerState.isVisible && playerState.seriesId && (
        <BitmovinPlayer
          seriesId={playerState.seriesId}
          initialEpisodeId={playerState.initialEpisodeId}
          onClose={closePlayer}
        />
      )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  desktopContainer: {
    flex: 1,
    maxWidth: Platform.OS === 'web' ? 1024 : undefined,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FF1B8D',
  },
  logoImage: {
    width: 120,
    height: 32,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  clearButton: {
    padding: 8,
    marginLeft: 8,
  },
  clearButtonText: {
    color: '#666',
    fontSize: 20,
    fontWeight: 'bold',
  },
  categoriesContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  categoryPill: {
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  categoryPillActive: {
    backgroundColor: '#FF1B8D',
    borderColor: '#FF1B8D',
  },
  featuredContainer: {
    marginBottom: 30,
  },
  featuredScroll: {
    marginHorizontal: 20,
  },
  categoryText: {
    color: '#888',
  },
  categoryTextActive: {
    color: '#fff',
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  horizontalScroll: {
    paddingHorizontal: 20,
  },
  horizontalCard: {
    marginRight: 12,
    width: 120,
    '@media (min-width: 1024px)': {
      width: 200,
      marginRight: 20,
    },
  },
  cardImageContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  cardImage: {
    width: 120,
    height: 180,
  },
  newBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#00D4AA',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  trendingBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#FF1B8D',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  playIconOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: '#fff',
    fontSize: 10,
  },
  cardContent: {
    paddingHorizontal: 4,
  },
  cardGenre: {
    color: '#888',
    fontSize: 12,
    marginBottom: 2,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  topChartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  chartRank: {
    color: '#FF1B8D',
    fontSize: 24,
    fontWeight: 'bold',
    width: 30,
    textAlign: 'center',
  },
  topChartImage: {
    width: 60,
    height: 80,
    borderRadius: 8,
    marginHorizontal: 12,
  },
  topChartContent: {
    flex: 1,
  },
  topChartTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  topChartSubtitle: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  topChartMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  topChartRating: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '600',
  },
  topChartEpisodes: {
    color: '#888',
    fontSize: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 8,
  },
  loadingSubtext: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
  },
  unavailableContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  unavailableHeader: {
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  unavailableLogo: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FF1B8D',
  },
  unavailableContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  unavailableIconContainer: {
    marginBottom: 40,
  },
  unavailableIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FF1B8D',
  },
  unavailableIconText: {
    fontSize: 48,
  },
  unavailableTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 32,
  },
  unavailableSubtext: {
    color: '#888',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 80,
  },
  comingSoonBadge: {
    backgroundColor: '#FF1B8D',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#FF1B8D',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  comingSoonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});