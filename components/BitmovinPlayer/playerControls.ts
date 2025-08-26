import { Episode } from '@/types';

export const playEpisode = async (
  episodeIndex: number,
  episodes: Episode[],
  forceAccess: boolean = false,
  authState: any,
  canAccessEpisode: (isFree: boolean) => boolean,
  setShowSignInModal: (show: boolean) => void,
  setShowSubscriptionModal: (show: boolean) => void,
  setCurrentEpisodeIndex: (index: number) => void,
  swiperRef: React.MutableRefObject<any>,
  initializePlayerForEpisode: (index: number) => Promise<void>,
  trackViewingProgress: (episodeId: string, seriesId: string) => Promise<void>,
  seriesId: string,
  currentPlayerInstanceRef: React.MutableRefObject<any>,
  currentEpisodeIndexRef: React.MutableRefObject<number>
) => {
  if (episodeIndex < 0 || episodeIndex >= episodes.length) return;
  
  // Prevent duplicate initialization for the same episode
  if (currentEpisodeIndexRef.current === episodeIndex) {
    console.log('🎬 playEpisode: Episode already active, skipping initialization:', {
      currentIndex: currentEpisodeIndexRef.current,
      requestedIndex: episodeIndex,
      episodeId: episodes[episodeIndex]?.id
    });
    return;
  }
  
  const episode = episodes[episodeIndex];
  
  // 🔍 DEBUG: Log all relevant values for modal display logic
  console.log('🔍 DEBUG playEpisode called with:', {
    episodeIndex,
    forceAccess,
    episodeId: episode.id,
    episodeTitle: episode.title,
    episodeIsFree: episode.is_free,
    authStateUser: authState.user,
    authStateUserSmartuserId: authState.user?.smartuserId,
    authStateUserIsSubscribed: authState.user?.isSubscribed,
    canAccessEpisodeResult: canAccessEpisode(episode.is_free),
  });
  
  // Pause the currently playing player before switching to ensure audio stops
  const currentlyPlayingPlayer = currentPlayerInstanceRef.current;
  if (currentlyPlayingPlayer && currentlyPlayingPlayer.isPlaying()) {
    console.log(`🎬 Pausing current player at index ${currentEpisodeIndexRef.current} before switching.`);
    currentlyPlayingPlayer.pause();
  }

  // Check if episode is premium and handle access control (unless forceAccess is true)
  if (!forceAccess && !episode.is_free) {
    console.log('🔍 DEBUG: Episode is premium, checking access control...');
    if (!authState.user) {
      // User not signed in - show sign-in modal
      console.log('🔍 DEBUG: No user found, showing sign-in modal');
      setShowSignInModal(true);
      return;
    } else if (!authState.user.isSubscribed) {
      // User signed in but not subscribed - show subscription modal
      console.log('🔍 DEBUG: User not subscribed, showing subscription modal');
      setShowSubscriptionModal(true);
      return;
    }
  } else {
    console.log('🔍 DEBUG: Episode access allowed:', {
      reason: forceAccess ? 'forceAccess=true' : 'episode.is_free=true'
    });
  }
  
  // If we have access (either forced or legitimate), hide any modals
  if (forceAccess || canAccessEpisode(episode.is_free)) {
    setShowSignInModal(false);
    setShowSubscriptionModal(false);
  }
  
  if (!forceAccess && !canAccessEpisode(episode.is_free)) {
    console.warn('Cannot access premium episode');
    return;
  }

  setCurrentEpisodeIndex(episodeIndex);
  
  // Update Swiper slide if it exists and index is different
  if (swiperRef.current && swiperRef.current.activeIndex !== episodeIndex) {
    swiperRef.current.slideTo(episodeIndex, 300);
  }
  
  // Initialize player for the new episode
  await initializePlayerForEpisode(episodeIndex);
  
  // Track viewing progress for the new episode
  if (episodes[episodeIndex]) {
    await trackViewingProgress(episodes[episodeIndex].id, episodes[episodeIndex].seriesId || seriesId);
  }
};

export const playNextEpisode = async (
  currentEpisodeIndexRef: React.MutableRefObject<number>,
  isProcessingNextEpisodeRef: React.MutableRefObject<boolean>,
  episodes: Episode[],
  playEpisode: (index: number, forceAccess?: boolean) => Promise<void>,
  onClose: () => void,
  forceAccess: boolean = false,
  smartuserId?: string,
  completedEpisodesInSessionRef?: React.MutableRefObject<Set<string>>,
  completedEpisodesInSession: Set<string> = new Set(),
  seriesId?: string,
  processEvent?: (eventType: string, metadata?: any) => Promise<void>,
  setCompletedEpisodesInSession?: React.Dispatch<React.SetStateAction<Set<string>>>,
  campaignCountriesLanguagesId: string = ''
) => {
  // Prevent duplicate execution during automatic transitions
  if (isProcessingNextEpisodeRef.current) {
    console.log('🎬 playNextEpisode already in progress, skipping duplicate call');
    return;
  }
  
  isProcessingNextEpisodeRef.current = true;
  
  console.log('🎬 playNextEpisode called with:', {
    currentEpisodeIndex: currentEpisodeIndexRef.current,
    totalEpisodes: episodes.length,
    forceAccess,
    hasMoreEpisodes: currentEpisodeIndexRef.current < episodes.length - 1,
    willClosePlayer: currentEpisodeIndexRef.current >= episodes.length - 1
  });
  
  // DEBUG: Log gamification state
  console.log('🎮 DEBUG: Gamification state at playNextEpisode:', {
    smartuserId,
    seriesId,
    completedEpisodesInSessionCount: completedEpisodesInSession.size,
    hasProcessEvent: !!processEvent,
    hasSetCompletedEpisodesInSession: !!setCompletedEpisodesInSession,
    campaignCountriesLanguagesId
  });
  
  if (currentEpisodeIndexRef.current < episodes.length - 1) {
    console.log('🎬 Playing next episode at index:', currentEpisodeIndexRef.current + 1);
    playEpisode(currentEpisodeIndexRef.current + 1, forceAccess).finally(() => {
      isProcessingNextEpisodeRef.current = false;
    });
  } else {
    // We're at the last episode, close the player
    console.log('🎬 Reached end of series, closing player automatically');
    console.log('Auto close Reward 🎮 DEBUG: About to process completion events before auto-close');

    // Get the current completed episodes from ref to ensure we have the latest state
    let episodesToProcess = completedEpisodesInSessionRef?.current || new Set();
    
    // Ensure the just-finished episode is included in the completed set
    const currentEpisodeId = episodes[currentEpisodeIndexRef.current]?.id;
    if (currentEpisodeId && !episodesToProcess.has(currentEpisodeId)) {
      console.log('Auto close Reward 🎮 DEBUG: Adding current episode to completed set before auto-close', currentEpisodeId);
      episodesToProcess = new Set([...episodesToProcess, currentEpisodeId]);
      // Update state to stay in sync
      setCompletedEpisodesInSession?.(episodesToProcess);
    }

    // Process any pending gamification events before closing
    console.log('🎬 Processing completion events before auto-close');
    
    // Import the function dynamically to avoid circular dependencies
    console.log('Auto close Reward 🎮 DEBUG: About to import gamificationHandlers...');
    import('./gamificationHandlers').then(({ processCompletionEvents }) => {
      console.log('Auto close Reward 🎮 DEBUG: gamificationHandlers imported successfully');
      console.log('Auto close Reward 🎮 DEBUG: Calling processCompletionEvents with parameters:', {
        smartuserId,
        completedEpisodesInSession: Array.from(episodesToProcess),
        seriesId,
        hasProcessEvent: !!processEvent,
        hasSetCompletedEpisodesInSession: !!setCompletedEpisodesInSession,
        campaignCountriesLanguagesId
      });

      if (processEvent && setCompletedEpisodesInSession) {
        return processCompletionEvents(
          smartuserId,
          seriesId,
          processEvent,
          episodesToProcess,
          setCompletedEpisodesInSession,
          campaignCountriesLanguagesId
        );
      }

      console.log('Auto close Reward 🎮 DEBUG: Missing processEvent or setCompletedEpisodesInSession, skipping gamification');
      return Promise.resolve();
    }).then(() => {
      console.log('Auto close Reward 🎮 DEBUG: processCompletionEvents completed successfully');
      console.log('🎬 Completion events processed successfully, now closing player');
      console.log('🎬 About to call onClose() function');
      onClose();
      console.log('🎬 onClose() function called successfully');
    }).catch(error => {
      console.error('🎬 Error processing completion events:', error);
      // Still close the player even if gamification fails
      console.log('🎬 About to call onClose() function after error');
      onClose();
      console.log('🎬 onClose() function called successfully after error');
    }).finally(() => {
      isProcessingNextEpisodeRef.current = false;
    });
  }
};

export const togglePlayPause = (
  currentPlayerInstanceRef: React.MutableRefObject<any>,
  isPlaying: boolean
) => {
  const currentPlayer = currentPlayerInstanceRef.current;
  if (!currentPlayer) return;

  if (isPlaying) {
    currentPlayer.pause();
  } else {
    currentPlayer.play();
  }
};