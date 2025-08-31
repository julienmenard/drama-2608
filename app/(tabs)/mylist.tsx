import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import { Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bookmark, BookmarkCheck, Play, Clock, Heart, User, Gift } from 'lucide-react-native';
import { router } from 'expo-router';
import { Image as RNImage } from 'react-native';
import { useSeries, useUserViewingProgress } from '@/hooks/useContent';
import { ContentService } from '@/services/contentService';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { useCampaignConfig } from '@/hooks/useCampaignConfig';
import { BitmovinPlayer } from '@/components/BitmovinPlayer';

export default function MyListScreen() {
  const [activeTab, setActiveTab] = useState<'mylist' | 'history'>('mylist');
  const insets = useSafeAreaInsets();
  const { campaignCountriesLanguagesId } = useCampaignConfig();
  const { favorites, loading: favoritesLoading } = useFavorites();
  const { viewingProgress, loading: historyLoading } = useUserViewingProgress();
  const { authState } = useAuth();
  const { t } = useTranslation();
  const [playerState, setPlayerState] = useState<{
    isVisible: boolean;
    seriesId: string | null;
    initialEpisodeId?: string;
  }>({
    isVisible: false,
    seriesId: null,
    initialEpisodeId: undefined,
  });

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

  // Handle direct episode play
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
      Alert.alert(t('videoPlayer'), t('videoPlayerImplementation'));
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

  // Debug logs
  React.useEffect(() => {
    console.log('🔍 MyListScreen: Component state:', {
      activeTab,
      campaignCountriesLanguagesId,
      favoritesCount: favorites.length,
      favoritesLoading,
      authUserId: authState.user?.smartuserId,
      favorites: favorites.map(f => ({ id: f.id, title: f.title, type: f.type }))
    });
  }, [activeTab, campaignCountriesLanguagesId, favorites, favoritesLoading, authState.user?.smartuserId]);
  
  // Helper function to calculate time ago
  const getTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'now';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d`;
  };

  const historyItems = [
    // Mock data for history - this could be enhanced with real viewing progress
  ];

  if (favoritesLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderMyList = () => {
    console.log('🔍 MyListScreen.renderMyList called with:', {
      hasUser: !!authState.user,
      favoritesCount: favorites.length,
      favoritesLoading
    });

    if (!authState.user) {
      console.log('🔍 MyListScreen.renderMyList: No user, showing sign in required');
      return (
        <View style={styles.emptyState}>
          <Heart size={48} color="#666" />
          <Text style={styles.emptyText}>{t('signInRequired')}</Text>
          <Text style={styles.emptySubtext}>{t('pleaseSignInToWatch')}</Text>
        </View>
      );
    }

    if (favorites.length === 0) {
      console.log('🔍 MyListScreen.renderMyList: No favorites, showing empty state');
      return (
        <View style={styles.emptyState}>
          <Heart size={48} color="#666" />
          <Text style={styles.emptyText}>{t('noFavoritesYet')}</Text>
          <Text style={styles.emptySubtext}>{t('addContentToFavorites')}</Text>
        </View>
      );
    }

    console.log('🔍 MyListScreen.renderMyList: Rendering favorites grid with', favorites.length, 'items');
    return (
      <ScrollView showsVerticalScrollIndicator={false} style={styles.favoritesList} contentContainerStyle={[styles.favoritesContent, { paddingBottom: insets.bottom + 20 }]}>
        {favorites.map((favorite) => {
          // Calculate time ago for when it was added to favorites
          const timeAgo = getTimeAgo(new Date(favorite.created_at));
          
          return (
            <TouchableOpacity
              key={`favorite-${favorite.id}`}
              style={styles.historyItem}
              onPress={() => {
                if (favorite.type === 'serie') {
                  handleNavigateToFirstSeason(favorite.contentDbId.toString());
                } else {
                  // For episodes, we need to get the series ID from the episode data
                  // Use the correct series ID from the favorite data
                  handlePlayEpisode(favorite.contentDbId.toString(), favorite.serieId || '');
                }
              }}
            >
              <View style={styles.historyImageContainer}>
                <Image 
                  source={{ uri: favorite.thumbnail }} 
                  style={styles.historyImage} 
                  defaultSource={{ uri: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400&h=600&fit=crop' }}
                />
              </View>
              
              <View style={styles.historyContentContainer}>
                <View style={styles.historyTypeHeader}>
                  <View style={styles.historyTypeIndicator}>
                    <View style={styles.playIcon} />
                    <Text style={styles.historyTypeText}>
                      {favorite.type === 'episode' ? 'Episode' : 'Series'}
                    </Text>
                  </View>
                  <Text style={styles.historyTimeAgo}>{timeAgo}</Text>
                </View>
                
                <Text style={styles.historyTitle} numberOfLines={1}>
                  {favorite.type === 'episode' && favorite.serieTitle 
                    ? favorite.serieTitle
                    : favorite.title
                  }
                </Text>
                
                <Text style={styles.historyDescription} numberOfLines={2}>
                  {favorite.type === 'episode' && favorite.serieTitle 
                    ? `${favorite.title} - ${favorite.description}`
                    : favorite.description
                  }
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  const renderHistory = () => {
    if (historyLoading) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      );
    }

    if (!authState.user) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{t('signInRequired')}</Text>
          <Text style={styles.emptySubtext}>{t('pleaseSignInToWatch')}</Text>
        </View>
      );
    }

    if (viewingProgress.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{t('noViewingHistory')}</Text>
          <Text style={styles.emptySubtext}>{t('episodesWillAppearHere')}</Text>
        </View>
      );
    }

    // Filter out duplicates based on unique id to prevent React key conflicts
    const uniqueViewingProgress = viewingProgress.filter((item, index, array) => 
      array.findIndex(i => i.id === item.id) === index
    );

    return (
      <ScrollView showsVerticalScrollIndicator={false} style={styles.historyList} contentContainerStyle={[styles.historyContent, { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 50 : 0) + 20 }]}>
        {uniqueViewingProgress.map((item) => {
          // Data is now flattened from the view
          if (!item.episode_title && !item.series_title) return null;

          // Calculate time ago
          const timeAgo = getTimeAgo(new Date(item.updated_at));
          
          // Use series thumbnail with fallback
          const imageUri = item.series_thumbnail || 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400&h=600&fit=crop';

          return (
            <TouchableOpacity
              key={`history-${item.id}`}
              style={styles.historyItem}
              onPress={() => handlePlayEpisode(item.content_id.toString(), item.episode_series_id?.toString() || item.content_id.toString())}
            >
              <View style={styles.historyImageContainer}>
                <Image 
                  source={{ uri: imageUri }} 
                  style={styles.historyImage} 
                  defaultSource={{ uri: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400&h=600&fit=crop' }}
                />
              </View>
              
              <View style={styles.historyContentContainer}>
                <View style={styles.historyTypeHeader}>
                  <View style={styles.historyTypeIndicator}>
                    <View style={styles.playIcon} />
                    <Text style={styles.historyTypeText}>
                      {item.content_type === 'episode' ? 'Episode' : 'Series'}
                    </Text>
                  </View>
                  <Text style={styles.historyTimeAgo}>{timeAgo}</Text>
                </View>
                
                <Text style={styles.historyTitle} numberOfLines={1}>
                  {item.series_title}
                </Text>
                
                <Text style={styles.historyDescription} numberOfLines={2}>
                  {item.episode_description || item.series_description || `Episode ${item.episode_position} description`}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

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
          
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'mylist' && styles.activeTab]}
              onPress={() => setActiveTab('mylist')}
            >
              <Text style={[styles.tabText, activeTab === 'mylist' && styles.activeTabText]}>
                My List
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'history' && styles.activeTab]}
              onPress={() => setActiveTab('history')}
            >
              <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>
                {t('history')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.content}>
          {activeTab === 'mylist' ? renderMyList() : renderHistory()}
        </ScrollView>

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
  logoImage: {
    width: 120,
    height: 32,
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    alignSelf: 'center',
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginHorizontal: 10,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#fff',
  },
  tabText: {
    color: '#888',
    fontSize: 16,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingTop: 20,
  },
  favoritesList: {
    paddingTop: 20,
  },
  favoritesContent: {
    paddingBottom: 20,
  },
  historyList: {
    paddingTop: 20,
  },
  historyContent: {
    paddingBottom: 20,
  },
  historyItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  historyImageContainer: {
    marginRight: 12,
  },
  historyImage: {
    width: 60,
    height: 80,
    borderRadius: 8,
  },
  historyContentContainer: {
    flex: 1,
  },
  historyTypeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  historyTypeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  playIcon: {
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 0,
    borderTopWidth: 3,
    borderBottomWidth: 3,
    borderLeftColor: '#FF1B8D',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  historyTypeText: {
    color: '#FF1B8D',
    fontSize: 12,
    fontWeight: '500',
  },
  historyTimeAgo: {
    color: '#888',
    fontSize: 12,
  },
  historyTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  historyDescription: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    color: '#888',
    fontSize: 12,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
  },
});