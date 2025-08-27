import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { Asset } from 'expo-asset';
import { useAuth } from '@/hooks/useAuth';
import { useCampaignConfig } from '@/hooks/useCampaignConfig';
import { useGamification } from '@/hooks/useGamification';
import { useFavorites } from '@/hooks/useFavorites';
import { ContentService } from '@/services/contentService';
import { Episode } from '@/types';
import { 
  trackViewingProgress, 
  updateViewingProgress 
} from './progressTracking';
import { 
  processCompletionEvents, 
  checkAndProcessSeriesCompletion 
} from './gamificationHandlers';

interface WebViewPlayerProps {
  seriesId: string;
  initialEpisodeId?: string;
  onClose: () => void;
  onShowSignInModal: () => void;
  onShowSubscriptionModal: () => void;
  onProgressUpdate: (currentTime: number, duration: number, progress: number) => void;
}

export const WebViewPlayer: React.FC<WebViewPlayerProps> = ({
  seriesId,
  initialEpisodeId,
  onClose,
  onShowSignInModal,
  onShowSubscriptionModal,
  onProgressUpdate,
}) => {
  const webViewRef = useRef<WebView>(null);
  const { campaignCountriesLanguagesId } = useCampaignConfig();
  const { authState } = useAuth();
  const { processEvent } = useGamification();
  const { toggleFavorite } = useFavorites();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [webViewReady, setWebViewReady] = useState(false);
  const [completedEpisodesInSession, setCompletedEpisodesInSession] = useState<Set<string>>(new Set());

  // Load episodes data
  useEffect(() => {
    const loadEpisodes = async () => {
      if (!campaignCountriesLanguagesId) return;

      try {
        setIsLoading(true);
        const episodesList = await ContentService.getAllEpisodesForSeries(
          campaignCountriesLanguagesId,
          seriesId
        );
        setEpisodes(episodesList);
      } catch (error) {
        console.error('🎬 WebView Player: Error loading episodes:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadEpisodes();
  }
  )

  // Initialize player when WebView is ready and episodes are loaded
  useEffect(() => {
    if (webViewReady && !isLoading && episodes.length > 0) {
      initializePlayer();
    }
  }, [webViewReady, isLoading, episodes]);

  const initializePlayer = () => {
    if (!webViewRef.current) return;

    // Find initial episode index
    let initialEpisodeIndex = 0;
    if (initialEpisodeId) {
      const foundIndex = episodes.findIndex(ep => ep.id === initialEpisodeId);
      if (foundIndex !== -1) {
        initialEpisodeIndex = foundIndex;
      }
    }

    const payload = {
      episodes,
      initialEpisodeIndex,
      userState: authState,
      campaignCountriesLanguagesId,
      seriesId,
    };

    console.log('🎬 WebView Player: Sending initialization data:', payload);
    
    webViewRef.current.postMessage(JSON.stringify({
      type: 'INITIALIZE_PLAYER',
      payload
    }));
  };

  const handleMessage = async (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      console.log('🎬 WebView Player: Received message from WebView:', message);

      switch (message.type) {
        case 'PLAYER_READY':
          setWebViewReady(true);
          break;

        case 'SHOW_SIGN_IN_MODAL':
          onShowSignInModal();
          break;

        case 'SHOW_SUBSCRIPTION_MODAL':
          onShowSubscriptionModal();
          break;

        case 'CLOSE_PLAYER':
          onClose();
          break;

        case 'PROGRESS_UPDATE':
          const { currentTime, duration, progress } = message.payload;
          onProgressUpdate(currentTime, duration, progress);
          break;

        case 'TRACK_VIEWING_PROGRESS':
          await trackViewingProgress(
            message.payload.episodeId,
            message.payload.seriesId,
            message.payload.smartuserId,
            setCompletedEpisodesInSession
          );
          break;

        case 'UPDATE_VIEWING_PROGRESS':
          await updateViewingProgress(
            message.payload.episodeId,
            message.payload.currentTime,
            message.payload.duration,
            message.payload.episode,
            message.payload.smartuserId,
            setCompletedEpisodesInSession
          );
          break;

        case 'PROCESS_COMPLETION_EVENTS':
          await processCompletionEvents(
            message.payload.smartuserId,
            message.payload.seriesId,
            processEvent,
            new Set(message.payload.completedEpisodeIds),
            setCompletedEpisodesInSession,
            message.payload.campaignCountriesLanguagesId
          );
          break;

        case 'TOGGLE_FAVORITE':
          if (authState.user?.smartuserId) {
            await toggleFavorite(
              parseInt(message.payload.episodeId),
              'episode'
            );
          } else {
            onShowSignInModal();
          }
          break;

        case 'SHOW_TAP_TO_PLAY':
          // This would be handled by the parent component
          // For now, we'll just log it
          console.log('🎬 WebView Player: Received SHOW_TAP_TO_PLAY message');
          break;

        case 'HIDE_TAP_TO_PLAY':
          // This would be handled by the parent component
          // For now, we'll just log it
          console.log('🎬 WebView Player: Received HIDE_TAP_TO_PLAY message');
          break;

        default:
          console.log('🎬 WebView Player: Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('🎬 WebView Player: Error handling message:', error);
    }
  };

  const playEpisode = (episodeIndex: number, forceAccess: boolean = false) => {
    if (!webViewRef.current) return;
    
    webViewRef.current.postMessage(JSON.stringify({
      type: 'PLAY_EPISODE',
      payload: { episodeIndex, forceAccess }
    }));
  };

  const togglePlayPause = () => {
    if (!webViewRef.current) return;
    
    webViewRef.current.postMessage(JSON.stringify({
      type: 'TOGGLE_PLAY_PAUSE'
    }));
  };

  const seek = (time: number) => {
    if (!webViewRef.current) return;
    
    webViewRef.current.postMessage(JSON.stringify({
      type: 'SEEK',
      payload: { time }
    }));
  };

  // Update user state when auth changes
  useEffect(() => {
    if (webViewRef.current && webViewReady) {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'UPDATE_USER_STATE',
        payload: { userState: authState }
      }));
    }
  }, [authState, webViewReady]);

  if (Platform.OS === 'web') {
    return null; // Use the existing web implementation
  }

  const webViewSource = Platform.select({
    ios: require('../../web-player/index.html'),
    android: { uri: 'file:///android_asset/web-player/index.html' },
    default: { uri: 'file:///web-player/index.html' }
  });

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={webViewSource}
        style={styles.webView}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo={true}
        onLoadEnd={() => {
          console.log('🎬 WebView Player: WebView loaded');
        }}
        onError={(error) => {
          console.error('🎬 WebView Player: WebView error:', error);
        }}
        originWhitelist={['*']}
        mixedContentMode="compatibility"
        allowFileAccess={true}
        allowFileAccessFromFileURLs={true}
        allowUniversalAccessFromFileURLs={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    zIndex: 1000,
  },
  webView: {
    flex: 1,
    backgroundColor: '#000',
  },
  tapToPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  tapToPlayContent: {
    alignItems: 'center',
  },
  tapToPlayIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FF1B8D',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  tapToPlayIconText: {
    fontSize: 32,
    color: '#fff',
    marginLeft: 4,
  },
  tapToPlayText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});