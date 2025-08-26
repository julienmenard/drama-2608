import { supabase } from '@/lib/supabase';

export interface UserFavorite {
  id: string;
  smartuser_id: string;
  content_id: number;
  content_type: 'serie' | 'episode';
  created_at: string;
  updated_at: string;
}

export interface FavoriteContent {
  id: string;
  contentDbId: number;
  title: string;
  description: string;
  thumbnail: string;
  type: 'serie' | 'episode';
  created_at: string;
  // Additional fields for episodes
  episodeNumber?: number;
  duration?: number;
  seasonNumber?: number;
  serieTitle?: string;
  serieId?: string;
}

export class FavoritesService {
  // Add content to favorites
  static async addToFavorites(
    smartuserId: string,
    contentId: number,
    contentType: 'serie' | 'episode'
  ): Promise<boolean> {
    if (!supabase) {
      console.warn('Supabase not configured');
      return false;
    }

    try {
      // Debug: Log the full query parameters
      console.log('🔍 DEBUG: addToFavorites query parameters:', {
        table: 'user_favorites',
        operation: 'INSERT',
        data: {
          smartuser_id: smartuserId,
          content_id: contentId,
          content_type: contentType,
        }
      });
      
      // Debug: Log the equivalent SQL query
      console.log('🔍 DEBUG: Equivalent SQL query:', 
        `INSERT INTO user_favorites (smartuser_id, content_id, content_type, created_at, updated_at) 
         VALUES ('${smartuserId}', ${contentId}, '${contentType}', NOW(), NOW());`
      );

      const { data, error } = await supabase
        .from('user_favorites')
        .upsert(
          { smartuser_id: smartuserId, content_id: contentId, content_type: contentType },
          { onConflict: 'smartuser_id,content_id,content_type' }
        )
        .select();

      if (error) {
        console.error('🔍 DEBUG: addToFavorites error details:', {
          error,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        console.error('Error adding to favorites:', error);
        return false;
      }

      console.log('🔍 DEBUG: addToFavorites success for:', { contentId, contentType, smartuserId });
      console.log('Successfully added to favorites:', { contentId, contentType });
      return true;
    } catch (err) {
      console.error('🔍 DEBUG: addToFavorites unexpected error:', err);
      console.error('Unexpected error adding to favorites:', err);
      return false;
    }
  }

  // Remove content from favorites
  static async removeFromFavorites(
    smartuserId: string,
    contentId: number,
    contentType: 'serie' | 'episode'
  ): Promise<boolean> {
    if (!supabase) {
      console.warn('Supabase not configured');
      return false;
    }

    try {
      const { error } = await supabase
        .from('user_favorites')
        .delete()
        .eq('smartuser_id', smartuserId)
        .eq('content_id', contentId)
        .eq('content_type', contentType);

      if (error) {
        console.error('Error removing from favorites:', error);
        return false;
      }

      console.log('Successfully removed from favorites:', { contentId, contentType });
      return true;
    } catch (err) {
      console.error('Unexpected error removing from favorites:', err);
      return false;
    }
  }

  // Check if content is in favorites
  static async isFavorite(
    smartuserId: string,
    contentId: number,
    contentType: 'serie' | 'episode'
  ): Promise<boolean> {
    const { count, error } = await supabase
      .from('user_favorites')
      .select('id', { count: 'exact', head: true }) // HEAD request; no body
      .eq('smartuser_id', smartuserId)
      .eq('content_id', contentId)
      .eq('content_type', contentType)
      .limit(1); // keep it cheap

    if (error) {
      console.error('isFavorite error:', error);
      return false;
    }
    return (count ?? 0) > 0;
  }

  // Get user's favorite content with details
  static async getUserFavorites(
    campaignCountriesLanguagesId: string,
    smartuserId: string
  ): Promise<FavoriteContent[]> {
    console.log('🔍 FavoritesService.getUserFavorites called with:', {
      campaignCountriesLanguagesId,
      smartuserId
    });

    if (!supabase) {
      console.warn('Supabase not configured');
      return [];
    }

    try {
      const favorites: FavoriteContent[] = [];

      console.log('🔍 Fetching favorite series...');
      // Get favorite series
      const { data: favoriteSeries, error: seriesError } = await supabase
        .from('user_favorites')
        .select('*')
        .eq('smartuser_id', smartuserId)
        .eq('content_type', 'serie')
        .order('created_at', { ascending: false });

      console.log('🔍 Favorite series query result:', {
        data: favoriteSeries,
        error: seriesError,
        count: favoriteSeries?.length || 0
      });

      if (seriesError) {
        console.error('Error fetching favorite series:', seriesError);
      } else if (favoriteSeries) {
        // Get series details for favorite series
        const seriesIds = favoriteSeries.map(fav => fav.content_id);
        console.log('🔍 Series IDs to fetch details for:', seriesIds);
        
        if (seriesIds.length > 0) {
          const { data: seriesDetails, error: seriesDetailsError } = await supabase
            .from('contents_series')
            .select('serie_id, title, description, url_covers')
            .in('serie_id', seriesIds)
            .eq('campaign_countries_languages_id', campaignCountriesLanguagesId);

          console.log('🔍 Series details query result:', {
            data: seriesDetails,
            error: seriesDetailsError,
            count: seriesDetails?.length || 0
          });

          if (seriesDetailsError) {
            console.error('Error fetching series details:', seriesDetailsError);
          } else if (seriesDetails) {
            favoriteSeries.forEach((favorite: any) => {
              const serie = seriesDetails.find(s => s.serie_id === favorite.content_id);
              if (serie) {
                favorites.push({
                  id: favorite.id,
                  contentDbId: serie.serie_id,
                  title: serie.title,
                  description: serie.description || 'No description available',
                  thumbnail: serie.url_covers || 'https://images.unsplash.com/photo-1518709268805-4e9042af2176',
                  type: 'serie',
                  created_at: favorite.created_at,
                });
              }
            });
          }
        }
      }

      console.log('🔍 Fetching favorite episodes...');
      // Get favorite episodes
      const { data: favoriteEpisodes, error: episodesError } = await supabase
        .from('user_favorites')
        .select('*')
        .eq('smartuser_id', smartuserId)
        .eq('content_type', 'episode')
        .order('created_at', { ascending: false });

      console.log('🔍 Favorite episodes query result:', {
        data: favoriteEpisodes,
        error: episodesError,
        count: favoriteEpisodes?.length || 0
      });

      if (episodesError) {
        console.error('Error fetching favorite episodes:', episodesError);
      } else if (favoriteEpisodes) {
        // Get episode details for favorite episodes
        const episodeIds = favoriteEpisodes.map(fav => fav.content_id);
        console.log('🔍 Episode IDs to fetch details for:', episodeIds);
        
        if (episodeIds.length > 0) {
          const { data: episodeDetails, error: episodeDetailsError } = await supabase
            .from('contents_series_episodes')
            .select(`
              episode_id,
              title,
              description,
              episode_position,
              season_position,
              duration,
              series_id,
              contents_series!inner(
                title,
                url_covers
              )
            `)
            .in('episode_id', episodeIds)
            .eq('campaign_countries_languages_id', campaignCountriesLanguagesId);

          console.log('🔍 Episode details query result:', {
            data: episodeDetails,
            error: episodeDetailsError,
            count: episodeDetails?.length || 0
          });

          if (episodeDetailsError) {
            console.error('Error fetching episode details:', episodeDetailsError);
          } else if (episodeDetails) {
            favoriteEpisodes.forEach((favorite: any) => {
              const episode = episodeDetails.find(e => e.episode_id === favorite.content_id);
              if (episode) {
                const serie = episode.contents_series;
                favorites.push({
                  id: favorite.id,
                  contentDbId: episode.episode_id,
                  title: episode.title || `Episode ${episode.episode_position}`,
                  description: episode.description || `Episode ${episode.episode_position} description`,
                  thumbnail: serie.url_covers || 'https://images.unsplash.com/photo-1518709268805-4e9042af2176',
                  type: 'episode',
                  created_at: favorite.created_at,
                  episodeNumber: episode.episode_position,
                  duration: Math.floor((episode.duration || 900) / 60),
                  seasonNumber: episode.season_position,
                  serieTitle: serie.title,
                  serieId: episode.series_id.toString(),
                });
              }
            });
          }
        }
      }

      // Sort all favorites by creation date
      favorites.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      console.log('🔍 Final favorites result:', {
        totalFavorites: favorites.length,
        seriesCount: favorites.filter(f => f.type === 'serie').length,
        episodesCount: favorites.filter(f => f.type === 'episode').length,
        favorites: favorites.map(f => ({ id: f.id, title: f.title, type: f.type }))
      });

      return favorites;
    } catch (err) {
      console.error('Unexpected error fetching user favorites:', err);
      return [];
    }
  }

  // Toggle favorite status
  static async toggleFavorite(
    smartuserId: string,
    contentId: number,
    contentType: 'serie' | 'episode'
  ): Promise<boolean> {
    const isFav = await this.isFavorite(smartuserId, contentId, contentType);
    
    if (isFav) {
      return await this.removeFromFavorites(smartuserId, contentId, contentType);
    } else {
      return await this.addToFavorites(smartuserId, contentId, contentType);
    }
  }
}