import { Episode } from '@/types';
import { createVideoSource } from './playerUtils';

declare global {
  interface Window {
    bitmovin?: {
      player: {
        Player: any;
        PlayerEvent: any;
      };
    };
  }
}

export const initializePlayerForEpisode = async (
  episodeIndex: number,
  episodes: Episode[],
  currentPlayerInstanceRef: React.MutableRefObject<any>,
  currentEpisodeIndexRef: React.MutableRefObject<number>,
  preloadPlayerRef: React.MutableRefObject<any>,
  isInitializingEpisodeRef: React.MutableRefObject<string | null>,
  setIsPlaying: (playing: boolean) => void,
  setCurrentTime: (time: number) => void,
  setDuration: (duration: number) => void,
  setProgress: (progress: number) => void,
  isDragging: boolean,
  updateViewingProgress: (episodeId: string, currentTime: number, duration: number, episode: Episode) => Promise<void>,
  playNextEpisode: () => void,
  warmUpNextItems: () => Promise<void>,
  trackViewingProgress: (episodeId: string, seriesId: string) => Promise<void>,
  seriesId: string,
  setShowTapToPlayOverlay: (show: boolean) => void,
  hasUserUnmuted: boolean
) => {
  const episode = episodes[episodeIndex];
  if (!episode) {
    console.error(`🎬 No episode found at index ${episodeIndex}`);
    return;
  }

  console.log(`🎬 Player config for episode ${episodeIndex}: Starting initialization`);
  console.log(`🎬 Safari autoplay test: Episode ${episodeIndex} initialization beginning`);

  // Check if this episode is already being initialized
  if (isInitializingEpisodeRef.current === episode.id) {
    console.log(`🎬 initializePlayerForEpisode: Episode ${episode.id} initialization already in progress, skipping duplicate call`);
    return;
  }

  // Set the flag to indicate initialization is in progress
  isInitializingEpisodeRef.current = episode.id;
  console.log(`🎬 initializePlayerForEpisode: Starting initialization for episode ${episode.id}, setting in-progress flag`);

  // Additional safeguard: prevent initialization if already processing this episode
  if (currentEpisodeIndexRef.current === episodeIndex && currentPlayerInstanceRef.current) {
    console.log(`🎬 initializePlayerForEpisode: Episode ${episodeIndex} already initialized, skipping duplicate call`);
    isInitializingEpisodeRef.current = null; // Clear the flag
    return;
  }
  
  console.log(`🎬 Initializing player for episode index: ${episodeIndex}`);
  
  // ALWAYS destroy any existing player instance first to prevent audio leaks
  if (currentPlayerInstanceRef.current) {
    try {
      console.log(`🎬 Destroying existing player instance before creating new one`);
      currentPlayerInstanceRef.current.destroy();
      currentPlayerInstanceRef.current = null;
      console.log(`🎬 ✅ Previous player instance destroyed successfully`);
    } catch (e) {
      console.warn('🎬 ⚠️ Error destroying previous player instance:', e);
      currentPlayerInstanceRef.current = null; // Clear reference anyway
    }
  }
  
  // ALWAYS destroy any existing preload player instance to prevent audio leaks
  if (preloadPlayerRef.current) {
    try {
      console.log(`🎬 Destroying existing preload player instance before creating new one`);
      preloadPlayerRef.current.destroy();
      preloadPlayerRef.current = null;
      console.log(`🎬 ✅ Previous preload player instance destroyed successfully`);
    } catch (e) {
      console.warn('🎬 ⚠️ Error destroying previous preload player instance:', e);
      preloadPlayerRef.current = null; // Clear reference anyway
    }
  }
  
  console.log(`🎬 Captured episode for player: ${episode.id} - ${episode.title}`);
  
  // Wait a bit to ensure DOM is ready after cleanup
  await new Promise(resolve => setTimeout(resolve, 100));

  const playerElement = document.getElementById(`bitmovin-player-${episodeIndex}`);
  if (!playerElement) {
    console.error(`🎬 Player element not found for episode ${episodeIndex}`);
    isInitializingEpisodeRef.current = null; // Clear the flag
    return;
  }

  // Clear any existing content in the player element
  playerElement.innerHTML = '';

  try {
    const playerConfig = {
      key: 'cac704b8-1b07-4407-818c-4dbdb847a115',
      playback: {
        autoplay: true,
        muted: !hasUserUnmuted,
        playsinline: true,
      },
      ui: false,
      analytics: {
        key: 'a52ccdeb-312f-478c-915a-a825746be950',
        title: episodes[episodeIndex]?.title || '',
        videoId: `episode-${episodes[episodeIndex]?.id}`,
      },
    };

    if (playerElement && window.bitmovin) {
      console.log(`🎬 Creating fresh player instance for episode ${episodeIndex}: ${episode.title}`);
      const player = new window.bitmovin.player.Player(playerElement, playerConfig);
      currentPlayerInstanceRef.current = player;
      currentEpisodeIndexRef.current = episodeIndex;
      console.log(`🎬 ✅ New player instance created and stored in ref`);
      console.log(`🎬 Player config for episode ${episodeIndex}: Autoplay=${playerConfig.playback.autoplay}, Muted=${playerConfig.playback.muted}`);

      // Start playback muted, then unmute if the user previously unmuted
      try {
        player.mute();
        if (hasUserUnmuted) {
          player.unmute();
        }
      } catch (e) {
        console.warn('🎬 ⚠️ Error adjusting mute state during initialization:', e);
      }

      // Clear the initialization flag after successful player creation
      isInitializingEpisodeRef.current = null;
      console.log(`🎬 ✅ Initialization flag cleared for episode ${episode.id}`);
      
      // Add event listeners
      player.on(window.bitmovin.player.PlayerEvent.Play, () => {
        setIsPlaying(true);
        warmUpNextItems();
      });

      player.on(window.bitmovin.player.PlayerEvent.Paused, () => {
        setIsPlaying(false);
      });

      player.on(window.bitmovin.player.PlayerEvent.PlaybackFinished, () => {
        console.log('🎬 PlaybackFinished event triggered for episode:', {
          currentEpisodeIndex: currentEpisodeIndexRef.current,
          episodeId: episodes[currentEpisodeIndexRef.current]?.id,
          episodeTitle: episodes[currentEpisodeIndexRef.current]?.title,
          totalEpisodes: episodes.length,
          isLastEpisode: currentEpisodeIndexRef.current >= episodes.length - 1
        });
        playNextEpisode();
      });

      player.on(window.bitmovin.player.PlayerEvent.TimeChanged, () => {
        if (player && currentEpisodeIndexRef.current === episodeIndex) {
          const currentTime = player.getCurrentTime();
          const duration = player.getDuration();
          
          if (duration > 0) {
            const progressPercentage = (currentTime / duration) * 100;
            setCurrentTime(currentTime);
            setDuration(duration);
            if (!isDragging) {
              setProgress(progressPercentage);
            }
            
            // Update viewing progress in database using the captured episode ID
            console.log(`🎬 TimeChanged event - updating progress for episode: ${episode.id}`);
            updateViewingProgress(episode.id, currentTime, duration, episode);
          }
        }
      });

      player.on(window.bitmovin.player.PlayerEvent.Ready, () => {
        console.log(`🎬 Player ready for episode ${episodeIndex}`);
      });

      player.on(window.bitmovin.player.PlayerEvent.Error, (event) => {
        console.error(`🎬 Player error for episode ${episodeIndex}:`, event);
      });

      // Initialize preload player if not exists
      if (!preloadPlayerRef.current) {
        const preloadElement = document.getElementById('bitmovin-preloader');
        if (preloadElement) {
          preloadPlayerRef.current = new window.bitmovin.player.Player(preloadElement, {
            key: 'cac704b8-1b07-4407-818c-4dbdb847a115',
            playback: { autoplay: false, muted: true }
          });
        }
      }
      
      // Load the episode
      await loadEpisode(episodeIndex, episodes, currentPlayerInstanceRef, trackViewingProgress, seriesId);
      
      // Explicitly call play() to ensure autoplay works in Safari
      if (currentPlayerInstanceRef.current) {
        console.log(`🎬 Safari Debug: About to call play() for episode ${episodeIndex}`);
        console.log(`🎬 Safari Debug: Player state before play():`, {
          isPlayerReady: !!currentPlayerInstanceRef.current,
          playerType: typeof currentPlayerInstanceRef.current,
          hasPlayMethod: typeof currentPlayerInstanceRef.current.play === 'function',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
          isSafari: typeof navigator !== 'undefined' ? navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome') : false,
          timestamp: new Date().toISOString()
        });
        
        try {
          console.log(`🎬 Safari Debug: Calling player.play() now...`);
          const playPromise = currentPlayerInstanceRef.current.play();
          console.log(`🎬 Safari Debug: play() method returned:`, {
            returnType: typeof playPromise,
            isPromise: playPromise instanceof Promise,
            playPromise: playPromise
          });
          
          if (playPromise instanceof Promise) {
            console.log(`🎬 Safari Debug: Awaiting play() promise...`);
            await playPromise;
            console.log(`🎬 Safari Debug: ✅ play() promise resolved successfully`);
            
            // Hide tap to play overlay on successful autoplay
            setShowTapToPlayOverlay(false);
          } else {
            console.log(`🎬 Safari Debug: ✅ play() completed synchronously`);
            
            // Hide tap to play overlay on successful autoplay
            setShowTapToPlayOverlay(false);
          }
        } catch (playError) {
          console.error(`🎬 Safari Debug: ❌ play() failed with error:`, {
            error: playError,
            errorName: playError?.name,
            errorMessage: playError?.message,
            errorCode: playError?.code,
            errorStack: playError?.stack,
            timestamp: new Date().toISOString()
          });
          
          // Check for specific Safari autoplay error codes
          if (playError?.name === 'NotAllowedError') {
            console.error(`🎬 Safari Debug: ❌ NotAllowedError - Autoplay was prevented by browser policy`);
            
            // Show tap to play overlay for NotAllowedError
            setShowTapToPlayOverlay(true);
          } else if (playError?.name === 'AbortError') {
            console.error(`🎬 Safari Debug: ❌ AbortError - Play request was aborted`);
          } else if (playError?.name === 'NotSupportedError') {
            console.error(`🎬 Safari Debug: ❌ NotSupportedError - Media format not supported`);
          }
        }
      } else {
        console.error(`🎬 Safari Debug: ❌ No player instance available for play() call`);
      }
    }
  } catch (error) {
    console.error('Error initializing player for episode:', error);
    // Clear the flag on error to allow retries
    isInitializingEpisodeRef.current = null;
    console.log(`🎬 ❌ Initialization flag cleared due to error for episode ${episode.id}`);
    
    // If player creation fails, try again after a short delay
    setTimeout(() => {
      console.log(`🎬 Retrying player initialization for episode ${episodeIndex}`);
      initializePlayerForEpisode(
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
        updateViewingProgress,
        playNextEpisode,
        warmUpNextItems,
        trackViewingProgress,
        seriesId
      );
    }, 500);
  }
};

export const loadEpisode = async (
  episodeIndex: number,
  episodes: Episode[],
  currentPlayerInstanceRef: React.MutableRefObject<any>,
  trackViewingProgress: (episodeId: string, seriesId: string) => Promise<void>,
  seriesId: string
): Promise<any> => {
  const player = currentPlayerInstanceRef.current;
  if (!player || !episodes[episodeIndex]) return;

  try {
    const episode = episodes[episodeIndex];
    const source = createVideoSource(episode);
    
    await player.load(source);
    
    // Track viewing progress when episode starts loading
    await trackViewingProgress(episode.id, episode.seriesId || seriesId);
    
    console.log('Loaded episode:', episode.title);
    return player;
  } catch (error) {
    console.error('Error loading episode:', error);
    return null;
  }
};

export const warmUpNextItems = async (
  currentEpisodeIndex: number,
  episodes: Episode[],
  preloadPlayerRef: React.MutableRefObject<any>
) => {
  if (!preloadPlayerRef.current || episodes.length <= currentEpisodeIndex + 1) return;

  const nextEpisodes = episodes.slice(currentEpisodeIndex + 1, currentEpisodeIndex + 3); // Preload next 2 episodes
  
  for (const episode of nextEpisodes) {
    try {
      const source = createVideoSource(episode);
      await preloadPlayerRef.current.load(source);
      await new Promise(resolve => setTimeout(resolve, 1200)); // Hold for 1.2s to allow segments to download
      console.log('Preloaded episode:', episode.title);
    } catch (error) {
      console.debug('Preload failed for episode:', episode.title, error);
    }
  }
};