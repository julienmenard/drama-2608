export const en = {
  // App branding
  appName: 'Dramapills',
  
  // Navigation
  home: 'Home',
  forYou: 'For you',
  myList: 'My list',
  profile: 'Profile',
  
  // Authentication
  signIn: 'Sign In',
  signUp: 'Sign Up',
  signOut: 'Sign out',
  email: 'Email',
  emailOrPhone: 'Email or Phone',
  password: 'Password',
  confirmPassword: 'Confirm Password',
  enterEmail: 'Enter your email',
  enterEmailOrPhone: 'Enter your email or phone number',
  enterPassword: 'Enter your password',
  confirmYourPassword: 'Confirm your password',
  signingIn: 'Signing In...',
  creatingAccount: 'Creating Account...',
  dontHaveAccount: "Don't have an account? ",
  alreadyHaveAccount: 'Already have an account? ',
  signInRequired: 'Sign in required',
  pleaseSignInToWatch: 'Please sign in to watch this episode',
  subscriptionRequired: 'Subscription required',
  episodeRequiresPremium: 'This episode requires a premium subscription',
  
  // Errors
  error: 'Error',
  pleaseFillAllFields: 'Please fill in all fields',
  passwordsDoNotMatch: 'Passwords do not match',
  passwordMinLength: 'Password must be at least 6 characters',
  failedToCreateAccount: 'Failed to create account',
  invalidCredentials: 'Invalid credentials',
  
  // Content
  searchDramas: 'Search dramas...',
  allSeries: 'All Series',
  topCharts: 'Top Charts',
  recommendedForYou: 'Recommended for you',
  basedOnPreferences: 'Based on your preferences',
  continueWatching: 'Continue Watching',
  similarToWatched: 'Similar to what you watched',
  trendingSearches: 'Trending Searches',
  noSeriesInProgress: 'No series in progress',
  startWatchingToSee: 'Start watching a series to see it here',
  noContentAvailable: 'No content available',
  checkSupabaseConfig: 'Please check your Supabase configuration',
  
  // Series and episodes
  seasons: 'Seasons',
  season: 'Season',
  episodes: 'Episodes',
  episode: 'Episode',
  play: 'Play',
  myListAction: 'My List',
  popular: 'Popular',
  new: 'New',
  trending: 'Trending',
  highlight: 'Highlight',
  free: 'Free',
  premium: 'Premium',
  premiumEpisode: 'Premium Episode',
  signInToUnlock: 'Sign in to unlock',
  subscribeToWatch: 'Subscribe to watch',
  
  // Profile
  subscribeToPremium: 'Subscribe to Premium',
  helpFeedback: 'Help & feedback',
  language: 'Language',
  notifications: 'Notifications',
  settings: 'Settings',
  privacyPolicy: 'Privacy Policy',
  termsConditions: 'Terms & Conditions',
  
  // Loading and errors
  loading: 'Loading...',
  loadingContent: 'Loading content...',
  serieNotFound: 'Serie not found',
  seasonNotFound: 'Season not found',
  episodeNotFound: 'Episode not found',
  rubriqueNotFound: 'Rubrique not found',
  
  // Video player
  videoPlayer: 'Video Player',
  videoPlayerImplementation: 'Video player will be implemented with JWPlayer',
  
  // Badges and labels
  min: 'min',
  enemiesToLovers: 'Enemies to Lovers',
  
  // Actions
  cancel: 'Cancel',
  subscribe: 'Subscribe',
  selectLanguage: 'Select Language',
  save: 'Save',
  saving: 'Saving...',
  editProfile: 'Edit Profile',
  profileInformation: 'Profile Information',
  dateOfBirth: 'Date of Birth',
  notProvided: 'Not provided',
  dateFormatHint: 'Format: YYYY-MM-DD (e.g., 1990-01-15)',
  
  // Placeholders and descriptions
  discoverGenre: 'Discover',
  
  // Time and duration
  m: 'M', // Million views abbreviation
  
  // History and viewing progress
  noViewingHistory: 'No viewing history',
  episodesWillAppearHere: 'Episodes you watch will appear here',
  history: 'History',
  series: 'Series',
  noFavoritesYet: 'No favorites yet',
  addContentToFavorites: 'Add series and episodes to your favorites to see them here',
  
  // Gamification notifications
  dailyVisitNotification: 'You earned {coins} coins for your daily visit!',
  emailProvidedNotification: 'You earned {coins} coins for providing your email!',
  birthDateProvidedNotification: 'You earned {coins} coins for providing your date of birth!',
  completeProfileNotification: 'You earned {coins} coins for completing your profile!',
  watchEpisodeNotification: 'You earned {coins} coins for watching an episode!',
  watchAdsNotification: 'You earned {coins} coins for watching ads!',
  enableNotificationsNotification: 'You earned {coins} coins for enabling notifications!',
  followSocialNotification: 'You earned {coins} coins for following us on social media!',
  coinsEarnedNotification: 'You earned {coins} coins!',
  
  // Reward Center
  rewardCenter: 'Reward Center',
  rewards: 'Rewards',
  weeklyRanking: 'Weekly Ranking',
  hallOfFame: 'Hall of Fame',
  coins: 'Coins',
  days: 'days',
  dailyCheckIn: 'Daily Check-in',
  earnRewards: 'Earn Rewards',
  completed: 'Completed',
  claim: 'To do',
  comingSoon: 'Coming Soon',
  day: 'Day',
  
  // All Episodes Control
  allEpisodes: 'All Episodes',
  
  // App availability
  appNotAvailable: 'This application is not yet available in your country and language.',
  appNotAvailableSubtext: 'We are working to expand our service to more regions.',
  
  // Biometric authentication
  biometricLogin: 'Biometric Login',
  signInWithBiometric: 'Sign in with biometric',
  enableBiometric: 'Enable biometric login',
  disableBiometric: 'Disable biometric login',
  biometricNotAvailable: 'Biometric authentication is not available on this device',
  biometricAuthFailed: 'Biometric authentication failed',
};

export type TranslationKey = keyof typeof en;