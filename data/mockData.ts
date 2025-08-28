import { Rubrique, Serie, Saison, Episode } from '@/types';

export const rubriques: Rubrique[] = [
  {
    id: '1',
    name: 'Romance',
    description: 'Histoires d\'amour passionnées',
    thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176'
  },
  {
    id: '2',
    name: 'Action',
    description: 'Aventures palpitantes',
    thumbnail: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b'
  },
  {
    id: '3',
    name: 'Historique',
    description: 'Drames d\'époque',
    thumbnail: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96'
  },
  {
    id: '4',
    name: 'Thriller',
    description: 'Suspense et mystère',
    thumbnail: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96'
  }
];

export const series: Serie[] = [
  {
    id: '1',
    title: 'Mistic Love!',
    description: 'A gripping tale of love and betrayal.',
    thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176',
    rubriqueId: '1',
    rating: 4.8,
    totalSeasons: 2,
    isPopular: true,
    isNew: false,
    isTrending: true
  },
  {
    id: '2',
    title: 'Sweet Love',
    description: 'A romantic saga that will touch your heart.',
    thumbnail: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b',
    rubriqueId: '1',
    rating: 4.6,
    totalSeasons: 1,
    isPopular: true,
    isNew: true,
    isTrending: false
  },
  {
    id: '3',
    title: 'Hidden Identity',
    description: 'Secrets and mysteries unfold.',
    thumbnail: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96',
    rubriqueId: '4',
    rating: 4.7,
    totalSeasons: 1,
    isPopular: false,
    isNew: false,
    isTrending: true
  },
  {
    id: '4',
    title: 'Unwanted True Mate',
    description: 'Enemies to Lovers',
    thumbnail: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e',
    rubriqueId: '1',
    rating: 4.9,
    totalSeasons: 1,
    isPopular: true,
    isNew: false,
    isTrending: false
  }
];

export const saisons: Saison[] = [
  {
    id: '1',
    number: 1,
    title: 'Season 1',
    serieId: '1',
    totalEpisodes: 30
  },
  {
    id: '2',
    number: 2,
    title: 'Season 2',
    serieId: '1',
    totalEpisodes: 25
  },
  {
    id: '3',
    number: 1,
    title: 'Season 1',
    serieId: '2',
    totalEpisodes: 20
  },
  {
    id: '4',
    number: 1,
    title: 'Season 1',
    serieId: '3',
    totalEpisodes: 15
  },
  {
    id: '5',
    number: 1,
    title: 'Season 1',
    serieId: '4',
    totalEpisodes: 30
  }
];

export const episodes: Episode[] = [
  // Mistic Love Season 1
  ...Array.from({ length: 30 }, (_, i) => ({
    id: `ep-1-${i + 1}`,
    title: `Episode ${i + 1}`,
    description: `Episode ${i + 1} of Mistic Love`,
    thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176',
    duration: Math.floor(Math.random() * 20) + 10,
    saisonId: '1',
    episodeNumber: i + 1,
    is_free: i < 2, // First 2 episodes are free
    video_url: 'https://bitmovin-a.akamaihd.net/content/MI201109210084_1/mpds/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.mpd'
  })),
  
  // Sweet Love Season 1
  ...Array.from({ length: 20 }, (_, i) => ({
    id: `ep-2-${i + 1}`,
    title: `Episode ${i + 1}`,
    description: `Episode ${i + 1} of Sweet Love`,
    thumbnail: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b',
    duration: Math.floor(Math.random() * 20) + 10,
    saisonId: '3',
    episodeNumber: i + 1,
    is_free: i < 1, // First episode is free
    video_url: 'https://bitmovin-a.akamaihd.net/content/sintel/hls/playlist.m3u8'
  })),

  // Unwanted True Mate Season 1
  ...Array.from({ length: 30 }, (_, i) => ({
    id: `ep-4-${i + 1}`,
    title: `Episode ${i + 1}`,
    description: `Episode ${i + 1} of Unwanted True Mate`,
    thumbnail: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e',
    duration: Math.floor(Math.random() * 20) + 10,
    saisonId: '5',
    episodeNumber: i + 1,
    is_free: i < 1, // First episode is free
    video_url: 'https://bitmovin-a.akamaihd.net/content/art-of-motion-dash-hls-progressive/mpds/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.mpd'
  }))
];