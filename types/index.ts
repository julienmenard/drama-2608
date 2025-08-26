export interface Rubrique {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
}

export interface Serie {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  rubriqueId: string;
  rating: number;
  totalSeasons: number;
  isPopular: boolean;
  isNew: boolean;
  isTrending: boolean;
}

export interface Saison {
  id: string;
  number: number;
  title: string;
  serieId: string;
  totalEpisodes: number;
}

export interface Episode {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: number; // in minutes
  saisonId: string;
  episodeNumber: number;
  is_free: boolean;
  video_url?: string;
  seriesId?: string;
}

export interface User {
  id: string;
  email: string;
  isSubscribed: boolean;
  smartuserId: string;
  subscriptionExpiresAt?: Date;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
}

export interface WatchHistory {
  episodeId: string;
  watchedAt: Date;
  progress: number; // 0-1
}

export interface MyListItem {
  serieId: string;
  addedAt: Date;
}