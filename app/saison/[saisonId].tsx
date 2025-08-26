import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { EpisodeCard } from '@/components/EpisodeCard';
import { useEpisodesBySaison, useSerieById } from '@/hooks/useContent';
import { ContentService } from '@/services/contentService';
import { useCampaignConfig } from '@/hooks/useCampaignConfig';
import { useTranslation } from '@/hooks/useTranslation';
import { BitmovinPlayer } from '@/components/BitmovinPlayer';

export default function SaisonScreen() {
  const { saisonId, seriesId, seasonPosition } = useLocalSearchParams<{ 
    saisonId: string; 
    seriesId?: string; 
    seasonPosition?: string; 
  }>();
  const { t } = useTranslation();
  const { campaignCountriesLanguagesId, isLoading: campaignLoading, isAvailable } = useCampaignConfig();
  const { episodes: saisonEpisodes, loading } = useEpisodesBySaison(campaignCountriesLanguagesId, saisonId || '');
  const { serie: serieData, loading: serieLoading } = useSerieById(campaignCountriesLanguagesId, seriesId || '');
  const [saison, setSaison] = React.useState<any>(null);
  const [playerState, setPlayerState] = React.useState<{
    isVisible: boolean;
    seriesId: string | null;
    initialEpisodeId?: string;
  }>({
    isVisible: false,
    seriesId: null,
    initialEpisodeId: undefined,
  });

  React.useEffect(() => {
    if (saisonId) {
      const seasonNumber = seasonPosition ? parseInt(seasonPosition) : 1;
      setSaison({
        id: saisonId,
        number: seasonNumber,
        title: `${t('season')} ${seasonNumber}`,
        serieId: seriesId || '',
        totalEpisodes: saisonEpisodes.length
      });
    }
  }, [saisonId, seriesId, seasonPosition, saisonEpisodes.length, t]);

  // Handle direct episode play
  const handlePlayEpisode = (episodeId: string) => {
    console.log('🎬 handlePlayEpisode called with:', { episodeId, seriesId });
    if (Platform.OS === 'web') {
      console.log('🎬 Setting player state for episode on web platform');
      setPlayerState({
        isVisible: true,
        seriesId: seriesId || '',
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

  if (campaignLoading || loading || serieLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAvailable) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.serieTitle}>{t('appNotAvailable')}</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t('appNotAvailable')}</Text>
          <Text style={styles.loadingText}>{t('appNotAvailableSubtext')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!saison || !serieData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.serieTitle}>{t('seasonNotFound')}</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t('seasonNotFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (saisonEpisodes.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.serieTitle}>{serieData.title}</Text>
            <Text style={styles.seasonTitle}>{saison.title}</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>No episodes found for this season</Text>
        </View>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.serieTitle}>{serieData.title}</Text>
          <Text style={styles.seasonTitle}>{saison.title}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.content}>
        <View style={styles.info}>
          <Text style={styles.episodeCount}>
            {saisonEpisodes.length} {t('episodes')}
          </Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.episodesList}>
          {saisonEpisodes.map((episode) => (
            <EpisodeCard
              key={episode.id}
              episode={episode}
              onPress={() => handlePlayEpisode(episode.id)}
            />
          ))}
        </ScrollView>

        {/* Episodes Grid for better viewing */}
        <View style={styles.episodesGrid}>
          <Text style={styles.gridTitle}>{t('allSeries')}</Text>
          <View style={styles.grid}>
            {saisonEpisodes.map((episode) => (
              <TouchableOpacity
                key={episode.id}
                style={styles.episodeGridItem}
                onPress={() => handlePlayEpisode(episode.id)}
              >
                <Text style={styles.episodeNumber}>{episode.episodeNumber}</Text>
                <Text style={styles.episodeTitle} numberOfLines={1}>
                  {episode.title}
                </Text>
                <Text style={styles.episodeDuration}>{episode.duration}{t('min')}</Text>
                {!episode.is_free && <Text style={styles.premiumBadge}>{t('premium')}</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Bitmovin Player (Web Only) */}
      {Platform.OS === 'web' && playerState.isVisible && playerState.seriesId && (
        <BitmovinPlayer
          seriesId={playerState.seriesId}
          initialEpisodeId={playerState.initialEpisodeId}
          onClose={closePlayer}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 10,
  },
  backButton: {
    marginRight: 16,
  },
  headerContent: {
    flex: 1,
  },
  serieTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  seasonTitle: {
    color: '#888',
    fontSize: 14,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  info: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  episodeCount: {
    color: '#888',
    fontSize: 16,
  },
  episodesList: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  episodesGrid: {
    paddingHorizontal: 20,
  },
  gridTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  episodeGridItem: {
    width: '48%',
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  episodeNumber: {
    color: '#FF1B8D',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  episodeTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  episodeDuration: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
  },
  premiumBadge: {
    color: '#FF1B8D',
    fontSize: 10,
    fontWeight: '600',
    backgroundColor: 'rgba(255, 27, 141, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  error: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 50,
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