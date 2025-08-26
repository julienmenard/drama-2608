import { Episode } from '@/types';

export const createVideoSource = (episode: Episode) => {
  const videoUrl = episode.video_url || 'https://cdn.bitmovin.com/content/assets/art-of-motion-dash-hls-progressive/mpds/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.mpd';
  
  // Determine if it's DASH or HLS based on URL extension
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
    // Default to DASH
    return {
      title: episode.title,
      dash: videoUrl,
    };
  }
};

export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};