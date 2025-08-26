// WebView Bitmovin Player Implementation
class WebViewBitmovinPlayer {
  constructor() {
    this.episodes = [];
    this.currentEpisodeIndex = 0;
    this.currentPlayerInstance = null;
    this.preloadPlayer = null;
    this.swiper = null;
    this.isInitializingEpisode = null;
    this.isProcessingNextEpisode = false;
    this.completedEpisodesInSession = new Set();
    this.showEpisodeInfo = true;
    this.episodeInfoTimer = null;
    this.isCurrentEpisodeFavorite = false;
    
    // Player state
    this.isPlaying = false;
    this.currentTime = 0;
    this.duration = 0;
    this.progress = 0;
    this.isDragging = false;
    
    // User and config data
    this.userState = null;
    this.campaignCountriesLanguagesId = null;
    this.seriesId = null;
    
    this.init();
  }

  init() {
    console.log('🎬 WebView Player: Initializing...');
    
    // Wait for first user interaction before initializing player
    this.waitForFirstUserInteraction();
    
    // Listen for messages from React Native
    window.addEventListener('message', (event) => {
      this.handleMessage(event.data);
    });
    
    // Also listen for React Native WebView messages
    document.addEventListener('message', (event) => {
      this.handleMessage(event.data);
    });
    
  }

  waitForFirstUserInteraction() {
    console.log('🎬 WebView Player: Waiting for first user interaction...');
    
    const handleFirstInteraction = () => {
      console.log('🎬 WebView Player: First user interaction detected');
      
      // Remove listeners
      window.removeEventListener('touchend', handleFirstInteraction);
      window.removeEventListener('click', handleFirstInteraction);
      
      // Add click handlers for favorites button
      this.setupFavoritesButton();
      
      // Wait for scripts to load
      this.waitForScripts();
    };
    
    // Listen for first user interaction
    window.addEventListener('touchend', handleFirstInteraction, { once: true });
    window.addEventListener('click', handleFirstInteraction, { once: true });
  }

  setupFavoritesButton() {
    // Add favorites button to the player controls
    document.addEventListener('DOMContentLoaded', () => {
      this.createPlayerControls();
    });
  }

  createPlayerControls() {
    // Create controls overlay if it doesn't exist
    let controlsOverlay = document.getElementById('player-controls-overlay');
    if (!controlsOverlay) {
      controlsOverlay = document.createElement('div');
      controlsOverlay.id = 'player-controls-overlay';
      controlsOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
        z-index: 100;
      `;
      document.body.appendChild(controlsOverlay);
    }

    // Create top controls container
    let topControls = document.getElementById('top-controls');
    if (!topControls) {
      topControls = document.createElement('div');
      topControls.id = 'top-controls';
      topControls.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px;
        background: linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%);
        pointer-events: auto;
      `;
      controlsOverlay.appendChild(topControls);
    }

    // Create right controls container
    let rightControls = document.getElementById('right-controls');
    if (!rightControls) {
      rightControls = document.createElement('div');
      rightControls.id = 'right-controls';
      rightControls.style.cssText = `
        display: flex;
        align-items: center;
        gap: 12px;
      `;
      topControls.appendChild(rightControls);
    }

    // Create favorites button
    let favoritesButton = document.getElementById('favorites-button');
    if (!favoritesButton) {
      favoritesButton = document.createElement('button');
      favoritesButton.id = 'favorites-button';
      favoritesButton.innerHTML = '♡';
      favoritesButton.style.cssText = `
        width: 44px;
        height: 44px;
        border-radius: 22px;
        background-color: rgba(0, 0, 0, 0.7);
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        display: flex;
        justify-content: center;
        align-items: center;
        transition: all 0.2s ease;
      `;
      
      favoritesButton.addEventListener('click', () => {
        this.toggleCurrentEpisodeFavorite();
      });
      
      rightControls.appendChild(favoritesButton);
    }

    // Create playlist button
    let playlistButton = document.getElementById('playlist-button');
    if (!playlistButton) {
      playlistButton = document.createElement('button');
      playlistButton.id = 'playlist-button';
      playlistButton.innerHTML = '☰';
      playlistButton.style.cssText = `
        width: 44px;
        height: 44px;
        border-radius: 22px;
        background-color: rgba(0, 0, 0, 0.7);
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
        display: flex;
        justify-content: center;
        align-items: center;
        transition: all 0.2s ease;
      `;
      
      playlistButton.addEventListener('click', () => {
        this.togglePlaylist();
      });
      
      rightControls.appendChild(playlistButton);
    }
  }

  toggleCurrentEpisodeFavorite() {
    const currentEpisode = this.episodes[this.currentEpisodeIndex];
    if (!currentEpisode) return;

    this.postMessageToRN({
      type: 'TOGGLE_FAVORITE',
      payload: {
        episodeId: currentEpisode.id
      }
    });

    // Update button appearance optimistically
    this.isCurrentEpisodeFavorite = !this.isCurrentEpisodeFavorite;
    this.updateFavoritesButtonAppearance();
  }

  updateFavoritesButtonAppearance() {
    const favoritesButton = document.getElementById('favorites-button');
    if (favoritesButton) {
      if (this.isCurrentEpisodeFavorite) {
        favoritesButton.innerHTML = '♥';
        favoritesButton.style.color = '#FF1B8D';
      } else {
        favoritesButton.innerHTML = '♡';
        favoritesButton.style.color = 'white';
      }
    }
  }

  togglePlaylist() {
    // This would need to be implemented to show/hide playlist
    console.log('🎬 WebView Player: Toggle playlist clicked');
  }

  waitForScripts() {
    const checkScripts = () => {
      if (window.bitmovin && window.Swiper) {
        console.log('🎬 WebView Player: Scripts loaded, ready to receive data');
        this.postMessageToRN({ type: 'PLAYER_READY' });
      } else {
        setTimeout(checkScripts, 100);
      }
    };
    checkScripts();
  }

  handleMessage(data) {
    console.log('🎬 WebView Player: Received message:', data);
    
    try {
      const message = typeof data === 'string' ? JSON.parse(data) : data;
      
      switch (message.type) {
        case 'INITIALIZE_PLAYER':
          this.initializePlayer(message.payload);
          break;
        case 'PLAY_EPISODE':
          this.playEpisode(message.payload.episodeIndex, message.payload.forceAccess);
          break;
        case 'TOGGLE_PLAY_PAUSE':
          this.togglePlayPause();
          break;
        case 'SEEK':
          this.seek(message.payload.time);
          break;
        case 'UPDATE_USER_STATE':
          this.userState = message.payload.userState;
          break;
        case 'UPDATE_FAVORITE_STATUS':
          this.isCurrentEpisodeFavorite = message.payload.isFavorite;
          this.updateFavoritesButtonAppearance();
          break;
        default:
          console.log('🎬 WebView Player: Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('🎬 WebView Player: Error handling message:', error);
    }
  }

  postMessageToRN(message) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(message));
    } else {
      console.warn('🎬 WebView Player: ReactNativeWebView not available');
    }
  }

  async initializePlayer(payload) {
    console.log('🎬 WebView Player: Initializing with payload:', payload);
    
    this.episodes = payload.episodes || [];
    this.currentEpisodeIndex = payload.initialEpisodeIndex || 0;
    this.userState = payload.userState;
    this.campaignCountriesLanguagesId = payload.campaignCountriesLanguagesId;
    this.seriesId = payload.seriesId;
    
    // Hide loading indicator
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.style.display = 'none';
    }
    
    // Create episode slides
    this.createEpisodeSlides();
    
    // Initialize Swiper
    await this.initializeSwiper();
    
    // Initialize player for current episode
    await this.initializePlayerForEpisode(this.currentEpisodeIndex);
    
    // Update unmute button visibility after initialization
    this.updateUnmuteButtonVisibility();
  }

  createEpisodeSlides() {
    const swiperWrapper = document.querySelector('.swiper-wrapper');
    if (!swiperWrapper) return;
    
    swiperWrapper.innerHTML = '';
    
    this.episodes.forEach((episode, index) => {
      const slide = document.createElement('div');
      slide.className = 'swiper-slide';
      slide.innerHTML = `
        <div id="bitmovin-player-${index}" class="player-container"></div>
        <div class="episode-info-overlay" id="episode-info-${index}">
          <div class="episode-title">${episode.title}</div>
          <div class="episode-description">${episode.description}</div>
          <div class="episode-number">Episode ${episode.episodeNumber} • ${episode.duration}m</div>
        </div>
      `;
      swiperWrapper.appendChild(slide);
    });
  }

  async initializeSwiper() {
    if (!window.Swiper) return;
    
    const swiperContainer = document.querySelector('.swiper-container');
    if (!swiperContainer) return;
    
    this.swiper = new window.Swiper(swiperContainer, {
      direction: 'vertical',
      loop: false,
      speed: 300,
      // Simplified configuration for Safari compatibility
      touchRatio: 1,
      threshold: 5,
      allowTouchMove: true,
      on: {
        slideChange: () => {
          const newIndex = this.swiper.activeIndex;
          
          // Enhanced logging for Safari debugging
          console.log('🔍 WebView Swiper Debug Info:', {
            browser: navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome') ? 'Safari' : 'Other',
            activeIndex: this.swiper.activeIndex,
            realIndex: this.swiper.realIndex,
            previousIndex: this.swiper.previousIndex,
            slides: this.swiper.slides?.length || 0,
            isBeginning: this.swiper.isBeginning,
            isEnd: this.swiper.isEnd,
            currentEpisodeIndex: this.currentEpisodeIndex
          });
          
          // Validate index before proceeding
          const validIndex = this.swiper.activeIndex >= 0 ? this.swiper.activeIndex : this.swiper.realIndex;
          
          if (validIndex < 0 || validIndex >= this.episodes.length) {
            console.warn('🔍 WebView Invalid Swiper index detected:', {
              activeIndex: this.swiper.activeIndex,
              realIndex: this.swiper.realIndex,
              validIndex,
              episodesLength: this.episodes.length
            });
            return;
          }
          
          console.log('🔍 WebView Using validated index:', validIndex);
          
          if (newIndex !== this.currentEpisodeIndex) {
            // Add small delay to allow Swiper state to stabilize (Safari fix)
            setTimeout(() => {
              console.log('🔍 WebView Delayed playEpisode call with index:', validIndex);
              this.playEpisode(validIndex);
            }, 100);
          }
        },
        touchStart: () => {
          console.log('🔍 WebView Swiper touch start - activeIndex:', this.swiper.activeIndex);
        },
        touchMove: () => {
          console.log('🔍 WebView Swiper touch move - activeIndex:', this.swiper.activeIndex);
        },
        touchEnd: () => {
          console.log('🔍 WebView Swiper touch end - activeIndex:', this.swiper.activeIndex);
        },
        slideChangeTransitionStart: () => {
          console.log('🔍 WebView Swiper transition start - activeIndex:', this.swiper.activeIndex, 'realIndex:', this.swiper.realIndex);
        },
        slideChangeTransitionEnd: () => {
          console.log('🔍 WebView Swiper transition end - activeIndex:', this.swiper.activeIndex, 'realIndex:', this.swiper.realIndex);
        }
      }
    });

    // Set initial slide
    if (this.currentEpisodeIndex > 0) {
      this.swiper.slideTo(this.currentEpisodeIndex, 0);
    }
  }

  async initializePlayerForEpisode(episodeIndex) {
    const episode = this.episodes[episodeIndex];
    if (!episode) return;

    // Check if already initializing this episode
    if (this.isInitializingEpisode === episode.id) {
      console.log('🎬 WebView Player: Episode already initializing, skipping');
      return;
    }

    this.isInitializingEpisode = episode.id;
    console.log('🎬 WebView Player: Initializing player for episode:', episode.id);

    // Show episode info and set timer to hide it
    this.showEpisodeInfoWithTimer(episodeIndex);

    // Destroy existing players
    if (this.currentPlayerInstance) {
      try {
        this.currentPlayerInstance.destroy();
        this.currentPlayerInstance = null;
      } catch (e) {
        console.warn('🎬 WebView Player: Error destroying current player:', e);
      }
    }

    if (this.preloadPlayer) {
      try {
        this.preloadPlayer.destroy();
        this.preloadPlayer = null;
      } catch (e) {
        console.warn('🎬 WebView Player: Error destroying preload player:', e);
      }
    }

    // Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, 100));

    const playerElement = document.getElementById(`bitmovin-player-${episodeIndex}`);
    if (!playerElement) {
      console.error('🎬 WebView Player: Player element not found');
      this.isInitializingEpisode = null;
      return;
    }

    playerElement.innerHTML = '';

    try {
      const playerConfig = {
        key: 'cac704b8-1b07-4407-818c-4dbdb847a115',
        playback: {
          autoplay: true,
          muted: false,
          playsinline: true,
        },
        ui: {
          playbackSpeedSelectionEnabled: false,
          pictureInPictureEnabled: false,
          disabled: true,
          hideFirstPlay: true,
          playbackToggleOverlay: false,
          seekbar: false,
          timeline: false,
          controlBar: false,
          bigPlayButton: false,
          volumeToggleButton: false,
          fullscreenToggleButton: false,
          settingsToggleButton: false,
          castToggleButton: false,
          airPlayToggleButton: false,
          playbackTimeLabel: false,
          totalTimeLabel: false,
          remainingTimeLabel: false,
          titleLabel: false,
          descriptionLabel: false,
          errorMessageOverlay: false,
          bufferedTimeRangesLabel: false,
          seekedTimeRangesLabel: false,
          volumeSlider: false,
          playbackSpeedSelectBox: false,
          audioTrackSelectBox: false,
          subtitleSelectBox: false,
          qualitySelectBox: false,
          playbackToggleButton: false,
          muteToggleButton: false,
          volumeControlButton: false,
          timelineMarkersEnabled: false,
          recommendationsOverlay: false,
          watermark: false,
          logo: false,
          contextMenuEnabled: false,
          keyboardEnabled: false,
          mouseCursorHidden: true,
          hideDelay: 0,
          playbackSpeedSelectionEnabled: false,
          subtitleEnabled: false,
          audioTrackSelectionEnabled: false,
          qualitySelectionEnabled: false,
          metadata: {
            title: episode.title || '',
          },
        },
        analytics: {
          key: 'a52ccdeb-312f-478c-915a-a825746be950',
          title: episode.title || '',
          videoId: `episode-${episode.id}`,
        },
      };

      const player = new window.bitmovin.player.Player(playerElement, playerConfig);
      this.currentPlayerInstance = player;
      this.currentEpisodeIndex = episodeIndex;
      console.log(`🎬 WebView Player: Player config for episode ${episodeIndex}: Autoplay=${playerConfig.playback.autoplay}, Muted=${playerConfig.playback.muted}`);

      // Add event listeners
      player.on(window.bitmovin.player.PlayerEvent.Play, () => {
        this.isPlaying = true;
        this.postMessageToRN({ 
          type: 'PLAYER_STATE_CHANGED', 
          payload: { isPlaying: true } 
        });
        this.warmUpNextItems();
      });

      player.on(window.bitmovin.player.PlayerEvent.Paused, () => {
        this.isPlaying = false;
        this.postMessageToRN({ 
          type: 'PLAYER_STATE_CHANGED', 
          payload: { isPlaying: false } 
        });
      });

      player.on(window.bitmovin.player.PlayerEvent.PlaybackFinished, () => {
        console.log('🎬 WebView Player: PlaybackFinished event');
        this.playNextEpisode();
      });

      player.on(window.bitmovin.player.PlayerEvent.TimeChanged, () => {
        if (player && this.currentEpisodeIndex === episodeIndex) {
          const currentTime = player.getCurrentTime();
          const duration = player.getDuration();
          
          if (duration > 0) {
            const progressPercentage = (currentTime / duration) * 100;
            this.currentTime = currentTime;
            this.duration = duration;
            this.progress = progressPercentage;
            
            // Send progress update to React Native
            this.postMessageToRN({
              type: 'PROGRESS_UPDATE',
              payload: {
                currentTime,
                duration,
                progress: progressPercentage
              }
            });
            
            // Update viewing progress
            this.updateViewingProgress(episode.id, currentTime, duration, episode);
          }
        }
      });

      player.on(window.bitmovin.player.PlayerEvent.Ready, () => {
        console.log('🎬 WebView Player: Player ready');
      });

      player.on(window.bitmovin.player.PlayerEvent.Error, (event) => {
        console.error('🎬 WebView Player: Player error:', event);
      });

      // Initialize preload player
      if (!this.preloadPlayer) {
        const preloadElement = document.getElementById('bitmovin-preloader');
        if (preloadElement) {
          this.preloadPlayer = new window.bitmovin.player.Player(preloadElement, {
            key: 'cac704b8-1b07-4407-818c-4dbdb847a115',
            playback: { autoplay: false, muted: false }
          });
        }
      }

      // Load the episode
      const loadedPlayer = await this.loadEpisode(episodeIndex);
      
      // Try muted autoplay - should work after first user interaction
      if (loadedPlayer) {
        console.log(`🎬 WebView Player: Attempting muted autoplay after first interaction for episode ${episodeIndex}`);
        try {
          await loadedPlayer.play();
          
          // Hide tap to play overlay on successful autoplay
          this.postMessageToRN({
            type: 'HIDE_TAP_TO_PLAY'
          });
        } catch (playError) {
          console.warn(`🎬 WebView Player: Muted autoplay still failed:`, playError);
          
          // Show tap to play overlay if even muted autoplay fails
          if (playError?.name === 'NotAllowedError') {
            console.error(`🎬 WebView Player: NotAllowedError - even muted autoplay blocked, showing tap to play overlay`);
            this.postMessageToRN({
              type: 'SHOW_TAP_TO_PLAY'
            });
          }
        }
      }
      
      // Track viewing progress
      await this.trackViewingProgress(episode.id, this.seriesId);

      this.isInitializingEpisode = null;
    } catch (error) {
      console.error('🎬 WebView Player: Error initializing player:', error);
      this.isInitializingEpisode = null;
    }
  }

  showEpisodeInfoWithTimer(episodeIndex) {
    // Show episode info
    const episodeInfo = document.getElementById(`episode-info-${episodeIndex}`);
    if (episodeInfo) {
      episodeInfo.classList.remove('hidden');
    }

    // Clear existing timer
    if (this.episodeInfoTimer) {
      clearTimeout(this.episodeInfoTimer);
    }

    // Set timer to hide after 4 seconds
    this.episodeInfoTimer = setTimeout(() => {
      if (episodeInfo) {
        episodeInfo.classList.add('hidden');
      }
    }, 4000);
  }

  async loadEpisode(episodeIndex) {
    const player = this.currentPlayerInstance;
    const episode = this.episodes[episodeIndex];
    if (!player || !episode) return null;

    try {
      const source = this.createVideoSource(episode);
      await player.load(source);
      console.log('🎬 WebView Player: Loaded episode:', episode.title);
      return player;
    } catch (error) {
      console.error('🎬 WebView Player: Error loading episode:', error);
      return null;
    }
  }

  createVideoSource(episode) {
    const videoUrl = episode.video_url || 'https://cdn.bitmovin.com/content/assets/art-of-motion-dash-hls-progressive/mpds/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.mpd';
    
    if (videoUrl.includes('.mpd')) {
      return {
        title: episode.title,
        dash: videoUrl,
      };
    } else if (videoUrl.includes('.m3u8')) {
      return {
        title: episode.title,
        hls: videoUrl,
      };
    } else {
      return {
        title: episode.title,
        dash: videoUrl,
      };
    }
  }

  async playEpisode(episodeIndex, forceAccess = false) {
    if (episodeIndex < 0 || episodeIndex >= this.episodes.length) return;
    
    if (this.currentEpisodeIndex === episodeIndex) {
      console.log('🎬 WebView Player: Episode already active, skipping');
      return;
    }
    
    const episode = this.episodes[episodeIndex];
    
    // Pause current player
    if (this.currentPlayerInstance && this.currentPlayerInstance.isPlaying()) {
      this.currentPlayerInstance.pause();
    }

    // Check access control
    if (!forceAccess && !episode.is_free) {
      if (!this.userState || !this.userState.user) {
        this.postMessageToRN({ type: 'SHOW_SIGN_IN_MODAL' });
        return;
      } else if (!this.userState.user.isSubscribed) {
        this.postMessageToRN({ type: 'SHOW_SUBSCRIPTION_MODAL' });
        return;
      }
    }

    // Update Swiper slide
    if (this.swiper && this.swiper.activeIndex !== episodeIndex) {
      this.swiper.slideTo(episodeIndex, 300);
    }
    
    // Initialize player for new episode
    await this.initializePlayerForEpisode(episodeIndex);
    
    // Update favorites button for new episode
    this.updateFavoritesButtonAppearance();
  }

  async playNextEpisode(forceAccess = false) {
    if (this.isProcessingNextEpisode) {
      console.log('🎬 WebView Player: playNextEpisode already in progress');
      return;
    }
    
    this.isProcessingNextEpisode = true;
    
    console.log('🎬 WebView Player: playNextEpisode called', {
      currentIndex: this.currentEpisodeIndex,
      totalEpisodes: this.episodes.length,
      hasMoreEpisodes: this.currentEpisodeIndex < this.episodes.length - 1
    });
    
    if (this.currentEpisodeIndex < this.episodes.length - 1) {
      console.log('🎬 WebView Player: Playing next episode');
      await this.playEpisode(this.currentEpisodeIndex + 1, forceAccess);
    } else {
      console.log('🎬 WebView Player: Reached end of series, processing completion events');
      
      // Add current episode to completed set if not already there
      const currentEpisodeId = this.episodes[this.currentEpisodeIndex]?.id;
      if (currentEpisodeId && !this.completedEpisodesInSession.has(currentEpisodeId)) {
        this.completedEpisodesInSession.add(currentEpisodeId);
      }
      
      // Process completion events
      await this.processCompletionEvents();
      
      // Close player
      this.postMessageToRN({ type: 'CLOSE_PLAYER' });
    }
    
    this.isProcessingNextEpisode = false;
  }

  togglePlayPause() {
    if (!this.currentPlayerInstance) return;

    if (this.isPlaying) {
      this.currentPlayerInstance.pause();
    } else {
      this.currentPlayerInstance.play();
    }
  }

  seek(time) {
    if (!this.currentPlayerInstance || this.duration <= 0) return;
    this.currentPlayerInstance.seek(time);
  }

  async warmUpNextItems() {
    if (!this.preloadPlayer || this.episodes.length <= this.currentEpisodeIndex + 1) return;

    const nextEpisodes = this.episodes.slice(this.currentEpisodeIndex + 1, this.currentEpisodeIndex + 3);
    
    for (const episode of nextEpisodes) {
      try {
        const source = this.createVideoSource(episode);
        await this.preloadPlayer.load(source);
        await new Promise(resolve => setTimeout(resolve, 1200));
        console.log('🎬 WebView Player: Preloaded episode:', episode.title);
      } catch (error) {
        console.debug('🎬 WebView Player: Preload failed for episode:', episode.title, error);
      }
    }
  }

  async trackViewingProgress(episodeId, seriesId) {
    if (!this.userState?.user?.smartuserId) return;

    this.postMessageToRN({
      type: 'TRACK_VIEWING_PROGRESS',
      payload: {
        episodeId,
        seriesId,
        smartuserId: this.userState.user.smartuserId
      }
    });
  }

  async updateViewingProgress(episodeId, currentTime, duration, episode) {
    if (!this.userState?.user?.smartuserId || duration <= 0) return;
    
    const completionPercentage = Math.round((currentTime / duration) * 100);
    const isCompleted = completionPercentage >= 90;
    
    // Check if this is a new completion
    const wasCompleted = this.completedEpisodesInSession.has(episodeId);
    
    if (isCompleted && !wasCompleted) {
      console.log('🎬 WebView Player: Episode completed for first time:', episodeId);
      this.completedEpisodesInSession.add(episodeId);
    }

    this.postMessageToRN({
      type: 'UPDATE_VIEWING_PROGRESS',
      payload: {
        episodeId,
        currentTime,
        duration,
        episode,
        smartuserId: this.userState.user.smartuserId,
        completionPercentage,
        isCompleted
      }
    });
  }

  async processCompletionEvents() {
    if (!this.userState?.user?.smartuserId || this.completedEpisodesInSession.size === 0) {
      console.log('🎬 WebView Player: No completion events to process');
      return;
    }

    console.log('🎬 WebView Player: Processing completion events:', {
      completedEpisodesCount: this.completedEpisodesInSession.size,
      completedEpisodeIds: Array.from(this.completedEpisodesInSession)
    });

    this.postMessageToRN({
      type: 'PROCESS_COMPLETION_EVENTS',
      payload: {
        smartuserId: this.userState.user.smartuserId,
        seriesId: this.seriesId,
        completedEpisodeIds: Array.from(this.completedEpisodesInSession),
        campaignCountriesLanguagesId: this.campaignCountriesLanguagesId
      }
    });

    // Clear completed episodes
    this.completedEpisodesInSession.clear();
  }
}

// Initialize the player when the page loads
let webViewPlayer;
document.addEventListener('DOMContentLoaded', () => {
  webViewPlayer = new WebViewBitmovinPlayer();
});

// Make player available globally for debugging
window.webViewPlayer = webViewPlayer;