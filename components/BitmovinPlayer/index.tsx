import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Modal } from 'react-native';
import { X, List, Heart, VolumeX, Volume2 } from 'lucide-react-native';
import { router } from 'expo-router';
import { ContentService } from '@/services/contentService';
import { useCampaignConfig } from '@/hooks/useCampaignConfig';
import { styles } from '../BitmovinPlayer.styles';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { useGamification } from '@/hooks/useGamification';
import { useFavorites } from '@/hooks/useFavorites';
import { Episode } from '@/types';
import { WebViewPlayer } from './WebViewPlayer';
import { 
  initializePlayerForEpisode, 
  loadEpisode, 
  warmUpNextItems 
} from './playerInitialization';
import { 
  trackViewingProgress, 
  updateViewingProgress 
} from './progressTracking';
import { 
  playEpisode, 
  playNextEpisode, 
  togglePlayPause 
} from './playerControls';
import { 
  handleProgressBarInteraction, 
  handleProgressBarMouseDown 
} from './progressBarHandlers';
import { 
  processCompletionEvents, 
  checkAndProcessSeriesCompletion 
} from './gamificationHandlers';
import { 
  handleSignIn, 
  handleSubscribe, 
  updateSubscriptionStatus 
} from './modalHandlers';
import { formatTime } from './playerUtils';

interface BitmovinPlayerProps {
  seriesId: string;
  initialEpisodeId?: string;
  onClose: () => void;
}

declare global {
  interface Window {
    bitmovin?: {
      player: {
        Player: any;
        PlayerEvent: any;
      };
    };
    Swiper?: any;
  }
}

export const BitmovinPlayer: React.FC<BitmovinPlayerProps> = ({
  episodes: providedEpisodes,
  seriesId,
  initialEpisodeId,
  onClose,
}) => {
  const { campaignCountriesLanguagesId } = useCampaignConfig();
  const { canAccessEpisode } = useSubscription();
  const { authState, updateUserSubscription } = useAuth();
  const { t } = useTranslation();
  const { processEvent } = useGamification();
  const { toggleFavorite, isFavorite } = useFavorites();
  
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(0);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [swiperLoaded, setSwiperLoaded] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);
  const [completedEpisodesInSession, setCompletedEpisodesInSession] = useState<Set<string>>(new Set());
  const [showEpisodeInfo, setShowEpisodeInfo] = useState(true);
  const [isCurrentEpisodeFavorite, setIsCurrentEpisodeFavorite] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [hasUserUnmuted, setHasUserUnmuted] = useState(false);
  const [showTapToPlayOverlay, setShowTapToPlayOverlay] = useState(false);

  const currentPlayerInstanceRef = useRef<any>(null);
  const currentEpisodeIndexRef = useRef<number>(0);
  const preloadPlayerRef = useRef<any>(null);
  const isProcessingNextEpisodeRef = useRef<boolean>(false);
  const isInitializingEpisodeRef = useRef<string | null>(null);
  const swiperRef = useRef<any>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const swiperScriptRef = useRef<HTMLScriptElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const completedEpisodesInSessionRef = useRef<Set<string>>(new Set());
  const hasUserUnmutedRef = useRef(false);

  // Keep refs synchronized with state
  useEffect(() => {
    completedEpisodesInSessionRef.current = completedEpisodesInSession;
  }, [completedEpisodesInSession]);

  useEffect(() => {
    hasUserUnmutedRef.current = hasUserUnmuted;
  }, [hasUserUnmuted]);

  // Hide episode info after 4 seconds
  useEffect(() => {
    setShowEpisodeInfo(true);
    const timer = setTimeout(() => {
      setShowEpisodeInfo(false);
    }, 4000);

    return () => clearTimeout(timer);
  }, [currentEpisodeIndex]);

  // Close player when user switches tabs or window loses focus
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    // Dispatch custom event to hide navigation
    const showPlayerEvent = new CustomEvent('playerVisibilityChanged', {
      detail: { isVisible: true }
    });
    window.dispatchEvent(showPlayerEvent);

    const handleBeforeUnload = async () => {
      console.log('🎬 User navigating away from tab, closing Bitmovin player');
      
      // Process completion events before closing
      await handleProcessCompletionEvents();
      
      // Destroy players immediately before navigation
      if (currentPlayerInstanceRef.current) {
        try {
          currentPlayerInstanceRef.current.destroy();
          currentPlayerInstanceRef.current = null;
        } catch (e) {
          console.warn('Error destroying player on navigation:', e);
        }
      }
      if (preloadPlayerRef.current) {
        try {
          preloadPlayerRef.current.destroy();
          preloadPlayerRef.current = null;
        } catch (e) {
          console.warn('Error destroying preload player on navigation:', e);
        }
      }
      onClose();
    };

    const handleVisibilityChange = async () => {
      if (document.hidden) {
        console.log('🎬 Tab became hidden (user switched to different tab), closing Bitmovin player');
        
        // Process completion events before closing
        await handleProcessCompletionEvents();
        
        onClose();
      }
    };

    // Listen for beforeunload (when user tries to navigate to different tab/page)
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Listen for tab visibility changes (when user switches tabs)
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      // Dispatch custom event to show navigation
      const hidePlayerEvent = new CustomEvent('playerVisibilityChanged', {
        detail: { isVisible: false }
      });
      window.dispatchEvent(hidePlayerEvent);

      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [onClose]);

  // Load Bitmovin and Swiper scripts dynamically
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const loadScripts = async () => {
      // Load Bitmovin script
      const loadBitmovinScript = () => {
        return new Promise<void>((resolve, reject) => {
          if (window.bitmovin) {
            resolve();
            return;
          }

          const existingScript = document.querySelector('script[src*="bitmovinplayer.js"]');
          if (existingScript) {
            existingScript.addEventListener('load', () => resolve());
            return;
          }

          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/bitmovin-player@8/bitmovinplayer.js';
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Bitmovin player script'));
          
          document.head.appendChild(script);
          scriptRef.current = script;
        });
      };

      // Load Swiper script
      const loadSwiperScript = () => {
        return new Promise<void>((resolve, reject) => {
          if (window.Swiper) {
            resolve();
            return;
          }

          const existingScript = document.querySelector('script[src*="swiper-bundle.min.js"]');
          if (existingScript) {
            existingScript.addEventListener('load', () => resolve());
            return;
          }

          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js';
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Swiper script'));
          
          document.head.appendChild(script);
          swiperScriptRef.current = script;
        });
      };

      // Load Swiper CSS
      const loadSwiperCSS = () => {
        const existingLink = document.querySelector('link[href*="swiper-bundle.min.css"]');
        if (existingLink) return;

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css';
        document.head.appendChild(link);
      };

      try {
        loadSwiperCSS();
        await Promise.all([loadBitmovinScript(), loadSwiperScript()]);
        setScriptLoaded(true);
        setSwiperLoaded(true);
      } catch (error) {
        console.error('Failed to load scripts:', error);
      }
    };

    loadScripts();

    return () => {
      // Cleanup: destroy all players and remove scripts if we added them
      // Process any pending gamification events before cleanup
      handleProcessCompletionEvents().catch(error => {
        console.error('Error processing completion events during cleanup:', error);
      });
      
      if (currentPlayerInstanceRef.current) {
        try {
          console.log('Destroying current player instance');
          currentPlayerInstanceRef.current.destroy();
        } catch (e) {
          console.warn('Error destroying current player:', e);
        }
      }
      
      if (preloadPlayerRef.current) {
        try {
          preloadPlayerRef.current.destroy();
        } catch (e) {
          console.warn('Error destroying preload player:', e);
        }
      }
      if (swiperRef.current) {
        try {
          swiperRef.current.destroy();
        } catch (e) {
          console.warn('Error destroying swiper:', e);
        }
      }
    };
  }, []);

  // Load episodes data
  useEffect(() => {
    const loadEpisodes = async () => {
      // If episodes are provided directly, use them
      if (providedEpisodes && providedEpisodes.length > 0) {
        console.log('🎬 Using provided episodes:', providedEpisodes.length);
        setEpisodes(providedEpisodes);
        setIsLoading(false);
        return;
      }

      // Otherwise, load episodes for a specific series
      if (!campaignCountriesLanguagesId || !seriesId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const episodesList = await ContentService.getAllEpisodesForSeries(
          campaignCountriesLanguagesId,
          seriesId
        );
        
        setEpisodes(episodesList);
        
        // Find initial episode index
        if (initialEpisodeId) {
          const initialIndex = episodesList.findIndex(ep => ep.id === initialEpisodeId);
          if (initialIndex !== -1) {
            setCurrentEpisodeIndex(initialIndex);
          }
        }
      } catch (error) {
        console.error('Error loading episodes:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadEpisodes();
  }, [campaignCountriesLanguagesId, seriesId, providedEpisodes, initialEpisodeId]);

  // Synchronize currentEpisodeIndexRef with currentEpisodeIndex state
  useEffect(() => {
    currentEpisodeIndexRef.current = currentEpisodeIndex;
  }, [currentEpisodeIndex]);

  // Initialize Swiper and Bitmovin players
  useEffect(() => {
    if (!scriptLoaded || !swiperLoaded || isLoading || episodes.length === 0 || Platform.OS !== 'web') return;

    const initializeSwiper = async () => {
      try {
        // Wait a bit for DOM to be ready
        await new Promise(resolve => setTimeout(resolve, 100));

        // Initialize Swiper
        if (window.Swiper && !swiperRef.current) {
          const swiperContainer = document.querySelector('.swiper-container');
          if (swiperContainer) {
            swiperRef.current = new window.Swiper(swiperContainer, {
              direction: 'vertical',
              loop: false,
              speed: 300,
              // Simplified configuration for Safari compatibility
              touchRatio: 1,
              threshold: 5,
              allowTouchMove: true,
              on: {
                slideChange: function() {
                  const newIndex = this.activeIndex;
                  
                  // Enhanced logging for Safari debugging
                  console.log('🔍 Swiper Debug Info:', {
                    browser: navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome') ? 'Safari' : 'Other',
                    activeIndex: this.activeIndex,
                    realIndex: this.realIndex,
                    previousIndex: this.previousIndex,
                    slides: this.slides?.length || 0,
                    isBeginning: this.isBeginning,
                    isEnd: this.isEnd,
                    currentEpisodeIndexRef: currentEpisodeIndexRef.current
                  });
                  
                  // Validate index before proceeding
                  const validIndex = this.activeIndex >= 0 ? this.activeIndex : this.realIndex;
                  
                  if (validIndex < 0 || validIndex >= episodes.length) {
                    console.warn('🔍 Invalid Swiper index detected:', {
                      activeIndex: this.activeIndex,
                      realIndex: this.realIndex,
                      validIndex,
                      episodesLength: episodes.length
                    });
                    return;
                  }
                  
                  console.log('🔍 Using validated index:', validIndex);
                  
                  if (newIndex !== currentEpisodeIndexRef.current) {
                    console.log('🔍 Direct handlePlayEpisode call with index:', validIndex);
                    handlePlayEpisode(validIndex); // Use validated index
                  }
                },
                touchStart: function() {
                  console.log('🔍 Swiper touch start - activeIndex:', this.activeIndex);
                },
                touchMove: function() {
                  console.log('🔍 Swiper touch move - activeIndex:', this.activeIndex);
                },
                touchEnd: function() {
                  console.log('🔍 Swiper touch end - activeIndex:', this.activeIndex);
                },
                slideChangeTransitionStart: function() {
                  console.log('🔍 Swiper transition start - activeIndex:', this.activeIndex, 'realIndex:', this.realIndex);
                },
                slideChangeTransitionEnd: function() {
                  console.log('🔍 Swiper transition end - activeIndex:', this.activeIndex, 'realIndex:', this.realIndex);
                }
              }
            });

            // Set initial slide to current episode
            if (currentEpisodeIndexRef.current > 0) {
              swiperRef.current.slideTo(currentEpisodeIndexRef.current, 0);
            }

            console.log('Swiper initialized successfully');
          }
        }

        // Initialize Bitmovin players after Swiper
        await handleInitializePlayerForEpisode(currentEpisodeIndexRef.current);
      } catch (error) {
        console.error('Error initializing Swiper:', error);
      }
    };

    initializeSwiper();
  }, [scriptLoaded, swiperLoaded, isLoading, episodes]);

  // Wrapper functions to pass required dependencies
  const handleInitializePlayerForEpisode = async (episodeIndex: number) => {
    await initializePlayerForEpisode(
      episodeIndex,
      episodes,
      currentPlayerInstanceRef,
      currentEpisodeIndexRef,
      preloadPlayerRef,
      isInitializingEpisodeRef,
      setIsPlaying,
      setCurrentTime,
      setDuration,
      setProgress,
      isDragging,
      handleUpdateViewingProgress,
      handlePlayNextEpisode,
      handleWarmUpNextItems,
      handleTrackViewingProgress,
      seriesId,
      setShowTapToPlayOverlay,
      hasUserUnmutedRef.current
    );

    // Ensure component state reflects player's mute state for new episodes
    setIsMuted(!hasUserUnmutedRef.current);
  };

  const handleTrackViewingProgress = async (episodeId: string, seriesId: string) => {
    await trackViewingProgress(episodeId, seriesId, authState.user?.smartuserId || '');
  };

  const handleUpdateViewingProgress = async (episodeId: string, currentTime: number, duration: number, episode: Episode) => {
    await updateViewingProgress(episodeId, currentTime, duration, episode, authState.user?.smartuserId || '', setCompletedEpisodesInSession);
  };

  const handlePostPlayEpisode = async (episodeIndex: number, forceAccess: boolean) => {
    const episode = episodes[episodeIndex];
    if (!episode) return;

    // Access checks after playback has been triggered
    if (!forceAccess && !episode.is_free) {
      if (!authState.user) {
        setShowSignInModal(true);
        currentPlayerInstanceRef.current?.pause();
        return;
      } else if (!authState.user.isSubscribed) {
        setShowSubscriptionModal(true);
        currentPlayerInstanceRef.current?.pause();
        return;
      }
    }

    if (!forceAccess && !canAccessEpisode(episode.is_free)) {
      currentPlayerInstanceRef.current?.pause();
      return;
    }

    setShowSignInModal(false);
    setShowSubscriptionModal(false);

    await handleTrackViewingProgress(episode.id, episode.seriesId || seriesId);
  };

  const handlePlayEpisode = (episodeIndex: number, forceAccess: boolean = false) => {
    const playPromise = playEpisode(
      episodeIndex,
      episodes,
      setCurrentEpisodeIndex,
      swiperRef,
      handleInitializePlayerForEpisode,
      currentPlayerInstanceRef,
      currentEpisodeIndexRef
    );

    return playPromise.then(() => handlePostPlayEpisode(episodeIndex, forceAccess));
  };

  const handlePlayNextEpisode = (forceAccess: boolean = false) => {
    playNextEpisode(
      currentEpisodeIndexRef,
      isProcessingNextEpisodeRef,
      episodes,
      handlePlayEpisode,
      onClose,
      forceAccess,
      authState.user?.smartuserId,
      completedEpisodesInSessionRef,
      completedEpisodesInSession,
      seriesId,
      processEvent,
      setCompletedEpisodesInSession,
      campaignCountriesLanguagesId
    );
  };

  const handleWarmUpNextItems = async () => {
    await warmUpNextItems(currentEpisodeIndex, episodes, preloadPlayerRef);
  };

  const handleTogglePlayPause = () => {
    togglePlayPause(currentPlayerInstanceRef, isPlaying);
  };

  const handleSignInAction = () => {
    handleSignIn(setShowSignInModal, onClose, seriesId, episodes, currentEpisodeIndex);
  };

  const handleSubscribeAction = () => {
    handleSubscribe(setShowSubscriptionModal, handleUpdateSubscriptionStatus);
  };

  const handleUpdateSubscriptionStatus = async () => {
    await updateSubscriptionStatus(
      authState.user?.smartuserId || '',
      updateUserSubscription,
      handlePlayNextEpisode
    );
  };

  const handleTapToPlay = () => {
    if (currentPlayerInstanceRef.current) {
      console.log('🎬 User tapped "Tap to Play" overlay');
      currentPlayerInstanceRef.current.play()
        .then(() => {
          console.log('🎬 Playback started successfully after tap');
          setShowTapToPlayOverlay(false);
          setIsMuted(false); // Unmute when user explicitly taps to play
          setHasUserUnmuted(true);
          hasUserUnmutedRef.current = true;
        })
        .catch(error => {
          console.error('🎬 Failed to start playback after tap:', error);
        });
    }
  };

  const handleUnmute = () => {
    if (currentPlayerInstanceRef.current) {
      try {
        if (isMuted) {
          console.log('🔊 User tapped unmute button - unmuting player');
          currentPlayerInstanceRef.current.unmute();
          setIsMuted(false);
          setHasUserUnmuted(true); // Remember that user has unmuted
          hasUserUnmutedRef.current = true;

          // If player is paused (e.g., due to autoplay being blocked), start playback
          if (!isPlaying) {
            currentPlayerInstanceRef.current.play()
              .then(() => {
                console.log('🎬 Playback started successfully after unmute');
                setShowTapToPlayOverlay(false);
              })
              .catch(error => {
                console.error('Failed to start playback after unmute:', error);
              });
          } else {
            // Player is already playing, just hide the overlay
            setShowTapToPlayOverlay(false);
          }
        } else {
          console.log('🔇 User tapped mute button - muting player');
          currentPlayerInstanceRef.current.mute();
          setIsMuted(true);
        }
      } catch (error) {
        console.error('❌ Failed to toggle mute state:', error);
      }
    }
  };

  const handleProgressBarClick = (event: any) => {
    handleProgressBarInteraction(
      event,
      currentPlayerInstanceRef,
      duration,
      progressBarRef,
      setProgress
    );
  };

  const handleProgressBarMouseDownAction = (event: any) => {
    handleProgressBarMouseDown(
      event,
      progress,
      setIsDragging,
      setDragProgress,
      progressBarRef,
      handleProgressBarClick
    );
  };

  const handleProcessCompletionEvents = async () => {
    const currentEpisode = episodes[currentEpisodeIndex];
    const currentSeriesId = currentEpisode?.seriesId || seriesId || '';
    
    await processCompletionEvents(
      authState.user?.smartuserId || '',
      currentSeriesId,
      processEvent,
      completedEpisodesInSession,
      setCompletedEpisodesInSession,
      campaignCountriesLanguagesId || ''
    );
  };

  const handleCheckAndProcessSeriesCompletion = async () => {
    const currentEpisode = episodes[currentEpisodeIndex];
    const currentSeriesId = currentEpisode?.seriesId || seriesId || '';
    
    await checkAndProcessSeriesCompletion(
      authState.user?.smartuserId || '',
      currentSeriesId,
      campaignCountriesLanguagesId || '',
      processEvent
    );
  };

  const currentEpisode = episodes[currentEpisodeIndex];

  // Check if current episode is in favorites
  useEffect(() => {
    const checkFavoriteStatus = async () => {
      if (currentEpisode && authState.user?.smartuserId) {
        const favStatus = await isFavorite(parseInt(currentEpisode.id), 'episode');
        setIsCurrentEpisodeFavorite(favStatus);
      } else {
        setIsCurrentEpisodeFavorite(false);
      }
    };
    checkFavoriteStatus();
  }, [currentEpisode, authState.user?.smartuserId]);

  const handleToggleFavorite = async () => {
    if (!currentEpisode || !authState.user?.smartuserId) {
      setShowSignInModal(true);
      return;
    }

    const success = await toggleFavorite(parseInt(currentEpisode.id), 'episode');
    if (success) {
      setIsCurrentEpisodeFavorite(!isCurrentEpisodeFavorite);
    }
  };

  // For React Native platforms, use WebView player
  if (Platform.OS !== 'web') {
    return (
      <WebViewPlayer
        seriesId={seriesId}
        initialEpisodeId={initialEpisodeId}
        onClose={onClose}
        onShowSignInModal={() => setShowSignInModal(true)}
        onShowSubscriptionModal={() => setShowSubscriptionModal(true)}
        onProgressUpdate={(currentTime, duration, progress) => {
          setCurrentTime(currentTime);
          setDuration(duration);
          setProgress(progress);
        }}
      />
    );
  }

  if (Platform.OS !== 'web') {
    return null;
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Swiper Container */}
      <div className="swiper-container" style={styles.swiperContainer}>
        <div className="swiper-wrapper">
          {episodes.map((episode, index) => (
            <div key={episode.id} className="swiper-slide" style={styles.swiperSlide}>
              {/* Player Container - render for all slides but only initialize for current */}
              <div id={`bitmovin-player-${index}`} style={styles.playerStyle} />
            </div>
          ))}
        </div>
      </div>
      
      {/* Hidden Preloader */}
      <div 
        id="bitmovin-preloader" 
        style={{
          position: 'absolute',
          left: '-99999px',
          top: '-99999px',
          width: '1px',
          height: '1px',
          overflow: 'hidden'
        }} 
      />

      {/* Episode Info Overlay */}
      {showEpisodeInfo && (
        <div style={styles.episodeInfoOverlay}>
          <Text style={styles.episodeTitle}>{currentEpisode?.title}</Text>
          <Text style={styles.episodeDescription} numberOfLines={3}>
            {currentEpisode?.description}
          </Text>
          <Text style={styles.episodeNumber}>
            Episode {currentEpisode?.episodeNumber} • {currentEpisode?.duration}m
          </Text>
        </div>
      )}

      {/* Custom Controls Overlay */}
      <View style={styles.controlsOverlay}>
        {/* Top Controls */}
        <View style={styles.topControls}>
          <TouchableOpacity onPress={async () => {
            // Process completion events before closing
            await handleProcessCompletionEvents();
            onClose();
          }} style={styles.closeButton}>
            <X size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Right Side Controls */}
        <View style={styles.rightSideControls}>
          {/* Mute/Unmute Button */}
          {(isMuted || hasUserUnmuted || showTapToPlayOverlay) && (
            <TouchableOpacity 
              onPress={handleUnmute}
              style={styles.favoriteButton}
            >
              {isMuted ? (
                <VolumeX size={28} color="#fff" />
              ) : (
                <Volume2 size={28} color="#fff" />
              )}
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            onPress={handleToggleFavorite}
            style={styles.favoriteButton}
          >
            <Heart 
              size={28} 
              color={isCurrentEpisodeFavorite ? "#FF1B8D" : "#fff"} 
              fill={isCurrentEpisodeFavorite ? "#FF1B8D" : "transparent"}
            />
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={() => setShowPlaylist(!showPlaylist)} 
            style={styles.playlistButton}
          >
            <List size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Tap to Play Overlay */}
        {showTapToPlayOverlay && (
          <TouchableOpacity 
            style={styles.tapToPlayOverlay}
            onPress={handleTapToPlay}
          >
            <View style={styles.tapToPlayContent}>
              <View style={styles.tapToPlayIcon}>
                <Text style={styles.tapToPlayIconText}>▶</Text>
              </View>
              <Text style={styles.tapToPlayText}>Tap to Play</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Progress Bar */}
        <View style={styles.progressBarContainer}>
          <div 
            ref={progressBarRef}
            style={styles.progressBarBackground}
            onMouseDown={handleProgressBarMouseDownAction}
            onClick={handleProgressBarClick}
          >
            <View 
              style={[
                styles.progressBarFill,
                { width: `${isDragging ? dragProgress : progress}%` }
              ]} 
            />
            <View style={[styles.progressBarThumb, { left: `${isDragging ? dragProgress : progress}%` }]} />
          </div>
          
          {/* Time Display */}
          <View style={styles.timeDisplay}>
            <Text style={styles.timeText}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </Text>
          </View>
        </View>

      </View>

      {/* Playlist Sidebar */}
      {showPlaylist && (
        <View style={styles.playlistSidebar}>
          <View style={styles.playlistHeader}>
            <Text style={styles.playlistTitle}>Episodes</Text>
            <TouchableOpacity onPress={() => setShowPlaylist(false)}>
              <X size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.playlistContent} showsVerticalScrollIndicator={false}>
            {episodes.map((episode, index) => {
              const isAccessible = canAccessEpisode(episode.is_free);
              const isCurrent = index === currentEpisodeIndex;
              
              return (
                <TouchableOpacity
                  key={episode.id}
                  style={[
                    styles.playlistItem,
                    isCurrent && styles.currentPlaylistItem,
                    !isAccessible && styles.lockedPlaylistItem
                  ]}
                  onPress={() => isAccessible && handlePlayEpisode(index)}
                  disabled={!isAccessible}
                >
                  <View style={styles.playlistItemContent}>
                    <Text style={styles.playlistEpisodeNumber}>
                      {episode.episodeNumber}
                    </Text>
                    <View style={styles.playlistEpisodeInfo}>
                      <Text style={[
                        styles.playlistEpisodeTitle,
                        isCurrent && styles.currentEpisodeTitle,
                        !isAccessible && styles.lockedEpisodeTitle
                      ]} numberOfLines={1}>
                        {episode.title}
                      </Text>
                      <Text style={styles.playlistEpisodeDuration}>
                        {episode.duration}m
                      </Text>
                    </View>
                    {!isAccessible && (
                      <View style={styles.lockIcon}>
                        <Text style={styles.premiumText}>Premium</Text>
                      </View>
                    )}
                    {episode.is_free && (
                      <View style={styles.freeIcon}>
                        <Text style={styles.freeText}>Free</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Sign-in Modal */}
      <Modal
        visible={showSignInModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSignInModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('signInRequired')}</Text>
              <TouchableOpacity onPress={() => setShowSignInModal(false)}>
                <X size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              <Text style={styles.modalMessage}>
                {t('pleaseSignInToWatch')}
              </Text>
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.modalSecondaryButton}
                onPress={() => setShowSignInModal(false)}
              >
                <Text style={styles.modalSecondaryButtonText}>{t('cancel')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.modalPrimaryButton}
                onPress={handleSignInAction}
              >
                <Text style={styles.modalPrimaryButtonText}>{t('signIn')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Subscription Modal */}
      <Modal
        visible={showSubscriptionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSubscriptionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('subscriptionRequired')}</Text>
              <TouchableOpacity onPress={() => setShowSubscriptionModal(false)}>
                <X size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              <Text style={styles.modalMessage}>
                {t('episodeRequiresPremium')}
              </Text>
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.modalSecondaryButton}
                onPress={() => setShowSubscriptionModal(false)}
              >
                <Text style={styles.modalSecondaryButtonText}>{t('cancel')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.modalPrimaryButton}
                onPress={handleSubscribeAction}
              >
                <Text style={styles.modalPrimaryButtonText}>{t('subscribe')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};