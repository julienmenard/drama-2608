import { supabase } from '@/lib/supabase';
import { DatabaseRubrique, DatabaseSerie, DatabaseSerieRubrique, DatabaseEpisode, DatabaseFreeEpisode } from '@/types/database';
import { Rubrique, Serie, Saison, Episode } from '@/types';
import { rubriques as mockRubriques, series as mockSeries, saisons as mockSaisons, episodes as mockEpisodes } from '@/data/mockData';

export interface SearchResult {
  id: string;
  title: string;
  description: string;
  type: 'serie' | 'episode';
  thumbnail?: string;
  serieId?: string;
  episodeNumber?: number;
  duration?: number;
  seasonNumber?: number;
}

export class ContentService {
  // Search across series, episodes, and rubriques
  static async search(campaignCountriesLanguagesId: string | null, query: string): Promise<SearchResult[]> {
    if (!campaignCountriesLanguagesId) {
      console.log('ContentService.search: No campaign ID, returning empty results');
      return [];
    }

    if (!query.trim()) {
      return [];
    }

    if (!supabase) {
      console.warn('Supabase not configured, using mock data for search');
      return this.searchMockData(query);
    }

    try {
      console.log('Searching with query:', query);
      const searchTerm = `%${query.toLowerCase()}%`;
      const results: SearchResult[] = [];

      // Search in contents_series (title and description)
      const { data: seriesData, error: seriesError } = await supabase
        .from('contents_series')
        .select('*')
        .eq('campaign_countries_languages_id', campaignCountriesLanguagesId)
        .or(`title.ilike.${searchTerm},description.ilike.${searchTerm}`);

      if (seriesError) {
        console.error('Error searching series:', seriesError);
      } else if (seriesData) {
        seriesData.forEach((serie: DatabaseSerie) => {
          results.push({
            id: serie.serie_id.toString(),
            title: serie.title,
            description: serie.description || 'No description available',
            type: 'serie',
            thumbnail: serie.url_covers || 'https://images.unsplash.com/photo-1518709268805-4e9042af2176'
          });
        });
      }

      // Search in contents_series_episodes (title and description)
      const { data: episodesData, error: episodesError } = await supabase
        .from('contents_series_episodes')
        .select(`
          *,
          contents_series!inner(
            title,
            url_covers
          )
        `)
        .eq('campaign_countries_languages_id', campaignCountriesLanguagesId)
        .or(`title.ilike.${searchTerm},description.ilike.${searchTerm}`);

      if (episodesError) {
        console.error('Error searching episodes:', episodesError);
      } else if (episodesData) {
        episodesData.forEach((episode: DatabaseEpisode) => {
          const seriesData = (episode as any).contents_series;
          results.push({
            id: episode.episode_id.toString(),
            title: episode.title || `Episode ${episode.episode_position}`,
            description: episode.description || `Episode ${episode.episode_position} description`,
            type: 'episode',
            thumbnail: seriesData?.url_covers || 'https://images.unsplash.com/photo-1518709268805-4e9042af2176',
            serieId: episode.series_id.toString(),
            episodeNumber: episode.episode_position,
            duration: Math.floor((episode.duration || 900) / 60),
            seasonNumber: episode.season_position
          });
        });
      }

      // Search in contents_rubrics (rubric_name)
      // Note: Category/rubrique search removed as per requirements

      console.log('Search results:', results);
      return results;
    } catch (err) {
      console.error('Unexpected error during search:', err);
      return this.searchMockData(query);
    }
  }

  // Fallback search for mock data
  private static searchMockData(query: string): SearchResult[] {
    const searchTerm = query.toLowerCase();
    const results: SearchResult[] = [];

    // Search mock series
    mockSeries.forEach(serie => {
      if (serie.title.toLowerCase().includes(searchTerm) || 
          serie.description.toLowerCase().includes(searchTerm)) {
        results.push({
          id: serie.id,
          title: serie.title,
          description: serie.description,
          type: 'serie',
          thumbnail: serie.thumbnail
        });
      }
    });

    // Search mock episodes
    mockEpisodes.forEach(episode => {
      if (episode.title.toLowerCase().includes(searchTerm) || 
          episode.description.toLowerCase().includes(searchTerm)) {
        results.push({
          id: episode.id,
          title: episode.title,
          description: episode.description,
          type: 'episode',
          thumbnail: episode.thumbnail,
          episodeNumber: episode.episodeNumber,
          duration: episode.duration
        });
      }
    });

    // Search mock rubriques
    // Note: Category/rubrique search removed as per requirements

    return results;
  }

  // Récupérer les séries les plus vues pour les top charts
  static async getTopViewedSeries(campaignCountriesLanguagesId: string | null, limit: number = 3): Promise<Serie[]> {
    if (!campaignCountriesLanguagesId) {
      console.log('ContentService.getTopViewedSeries: No campaign ID, returning empty results');
      return [];
    }

    if (!supabase) {
      console.warn('Supabase not configured, using mock data for top viewed series');
      return mockSeries.slice(0, limit);
    }

    try {
      console.log('Fetching top viewed series from Supabase...');
      
      // Get most viewed series from user_viewing_progress
      const { data: viewingData, error: viewingError } = await supabase
        .from('user_viewing_progress')
        .select('content_id, content_type')
        .eq('content_type', 'series')
        .order('updated_at', { ascending: false });

      if (viewingError) {
        console.error('Error fetching viewing progress:', viewingError);
        return mockSeries.slice(0, limit);
      }

      if (!viewingData || viewingData.length === 0) {
        console.log('No viewing data found, using regular series');
        return await this.getSeries(campaignCountriesLanguagesId).then(series => series.slice(0, limit));
      }

      // Count views per series
      const viewCounts = viewingData.reduce((acc, item) => {
        acc[item.content_id] = (acc[item.content_id] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

      // Get top series IDs
      const topSeriesIds = Object.entries(viewCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, limit)
        .map(([id]) => parseInt(id));

      if (topSeriesIds.length === 0) {
        return mockSeries.slice(0, limit);
      }

      // Fetch series details
      const { data: seriesData, error: seriesError } = await supabase
        .from('contents_series')
        .select('*')
        .eq('campaign_countries_languages_id', campaignCountriesLanguagesId)
        .in('serie_id', topSeriesIds);

      if (seriesError) {
        console.error('Error fetching top series:', seriesError);
        return mockSeries.slice(0, limit);
      }

      return this.mapSeriesToInterface(seriesData || []);
    } catch (err) {
      console.error('Unexpected error fetching top viewed series:', err);
      return mockSeries.slice(0, limit);
    }
  }

  // Récupérer toutes les rubriques
  static async getRubriques(campaignCountriesLanguagesId: string | null): Promise<Rubrique[]> {
    if (!campaignCountriesLanguagesId) {
      console.log('ContentService.getRubriques: No campaign ID, returning empty results');
      return [];
    }

    if (!supabase) {
      console.warn('Supabase not configured, using mock data for rubriques');
      return mockRubriques;
    }

    try {
      console.log('Fetching rubriques from Supabase...');
      
      const { data, error } = await supabase
        .from('contents_rubrics')
        .select('*')
        .eq('campaign_countries_languages_id', campaignCountriesLanguagesId);

      if (error) {
        console.error('Error fetching rubriques from Supabase:', error);
        return mockRubriques;
      }

      console.log('Rubriques data from Supabase:', data);

      if (!data || data.length === 0) {
        console.log('No rubriques found in database, using mock data');
        return mockRubriques;
      }

      return data.map((item: DatabaseRubrique) => ({
        id: item.id_rubric.toString(),
        name: item.rubric_name,
        description: item.rubric_name,
        thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176'
      }));
    } catch (err) {
      console.error('Unexpected error fetching rubriques:', err);
      return mockRubriques;
    }
  }

  // Récupérer toutes les séries
  static async getSeries(campaignCountriesLanguagesId: string | null): Promise<Serie[]> {
    if (!campaignCountriesLanguagesId) {
      console.log('ContentService.getSeries: No campaign ID, returning empty results');
      return [];
    }

    if (!supabase) {
      console.warn('Supabase not configured, using mock data for series');
      return mockSeries;
    }

    try {
      console.log('Fetching series from Supabase...');
      
      const { data, error } = await supabase
        .from('contents_series')
        .select('*')
        .eq('campaign_countries_languages_id', campaignCountriesLanguagesId);

      if (error) {
        console.error('Error fetching series from Supabase:', error);
        return mockSeries;
      }

      console.log('Series data from Supabase:', data);

      if (!data || data.length === 0) {
        console.log('No series found in database, using mock data');
        return mockSeries;
      }

      return this.mapSeriesToInterface(data);
    } catch (err) {
      console.error('Unexpected error fetching series:', err);
      return mockSeries;
    }
  }

  // Récupérer les séries d'une rubrique
  static async getSeriesByRubrique(campaignCountriesLanguagesId: string | null, rubriqueId: string): Promise<Serie[]> {
    if (!campaignCountriesLanguagesId) {
      console.log('ContentService.getSeriesByRubrique: No campaign ID, returning empty results');
      return [];
    }

    if (!supabase) {
      console.warn('Supabase not configured, using mock data for series by rubrique');
      return mockSeries.filter(s => s.rubriqueId === rubriqueId);
    }

    try {
      console.log('Fetching series by rubrique from Supabase...');
      
      // First get series IDs for this rubrique
      const { data: rubriqueData, error: rubriqueError } = await supabase
        .from('contents_series_rubrics')
        .select('serie_id')
        .eq('campaign_countries_languages_id', campaignCountriesLanguagesId)
        .eq('id_rubric', parseInt(rubriqueId));

      if (rubriqueError) {
        console.error('Error fetching series rubrique relations:', rubriqueError);
        return mockSeries.filter(s => s.rubriqueId === rubriqueId);
      }

      if (!rubriqueData || rubriqueData.length === 0) {
        console.log('No series found for rubrique, using mock data');
        return mockSeries.filter(s => s.rubriqueId === rubriqueId);
      }

      const seriesIds = rubriqueData.map(item => item.serie_id);

      // Then get series details
      const { data: seriesData, error: seriesError } = await supabase
        .from('contents_series')
        .select('*')
        .eq('campaign_countries_languages_id', campaignCountriesLanguagesId)
        .in('serie_id', seriesIds);

      if (seriesError) {
        console.error('Error fetching series details:', seriesError);
        return mockSeries.filter(s => s.rubriqueId === rubriqueId);
      }

      return this.mapSeriesToInterface(seriesData || []);
    } catch (err) {
      console.error('Unexpected error fetching series by rubrique:', err);
      return mockSeries.filter(s => s.rubriqueId === rubriqueId);
    }
  }

  // Récupérer les saisons d'une série
  static async getSaisonsBySerie(campaignCountriesLanguagesId: string | null, serieId: string): Promise<Saison[]> {
    if (!campaignCountriesLanguagesId) {
      console.log('ContentService.getSaisonsBySerie: No campaign ID, returning empty results');
      return [];
    }

    if (!supabase) {
      console.warn('Supabase not configured, using mock data for saisons');
      return mockSaisons.filter(s => s.serieId === serieId);
    }

    try {
      console.log('Fetching saisons from Supabase...');
      
      // Get unique seasons for this series
      const { data, error } = await supabase
        .from('contents_series_episodes')
        .select('season_id, season_position')
        .eq('campaign_countries_languages_id', campaignCountriesLanguagesId)
        .eq('series_id', parseInt(serieId))
        .order('season_position', { ascending: true });

      if (error) {
        console.error('Error fetching saisons:', error);
        return mockSaisons.filter(s => s.serieId === serieId);
      }

      if (!data || data.length === 0) {
        console.log('No saisons found, using mock data');
        return mockSaisons.filter(s => s.serieId === serieId);
      }

      // Group by season and count episodes
      const seasonsMap = new Map();
      for (const episode of data) {
        if (!seasonsMap.has(episode.season_id)) {
          seasonsMap.set(episode.season_id, {
            id: episode.season_id.toString(),
            number: episode.season_position || 1,
            title: `Season ${episode.season_position || 1}`,
            serieId: serieId,
            totalEpisodes: 0
          });
        }
        seasonsMap.get(episode.season_id).totalEpisodes++;
      }

      return Array.from(seasonsMap.values());
    } catch (err) {
      console.error('Unexpected error fetching saisons:', err);
      return mockSaisons.filter(s => s.serieId === serieId);
    }
  }

  // Récupérer les épisodes d'une saison
  static async getEpisodesBySaison(campaignCountriesLanguagesId: string | null, saisonId: string): Promise<Episode[]> {
    if (!campaignCountriesLanguagesId) {
      console.log('ContentService.getEpisodesBySaison: No campaign ID, returning empty results');
      return [];
    }

    if (!supabase) {
      console.warn('Supabase not configured, using mock data for episodes');
      return mockEpisodes.filter(e => e.saisonId === saisonId);
    }

    try {
      console.log('Fetching episodes from Supabase...');
      
      const { data: episodesData, error: episodesError } = await supabase
        .from('contents_series_episodes')
        .select('*')
        .eq('campaign_countries_languages_id', campaignCountriesLanguagesId)
        .eq('season_id', parseInt(saisonId))
        .order('episode_position', { ascending: true });

      if (episodesError) {
        console.error('Error fetching episodes:', episodesError);
        return mockEpisodes.filter(e => e.saisonId === saisonId);
      }

      if (!episodesData || episodesData.length === 0) {
        console.log('No episodes found, using mock data');
        return mockEpisodes.filter(e => e.saisonId === saisonId);
      }

      // Get free episodes
      const { data: freeEpisodesData } = await supabase
        .from('contents_series_episodes_free')
        .select('episode_id')
        .eq('campaign_countries_languages_id', campaignCountriesLanguagesId);

      const freeEpisodeIds = new Set(freeEpisodesData?.map(item => item.episode_id) || []);

      return episodesData.map((episode: DatabaseEpisode) => ({
        id: episode.episode_id.toString(),
        title: episode.title || `Episode ${episode.episode_position}`,
        description: episode.description || `Episode ${episode.episode_position} description`,
        thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176',
        duration: Math.floor((episode.duration || 900) / 60), // Convert seconds to minutes
        saisonId: saisonId,
        episodeNumber: episode.episode_position,
        is_free: freeEpisodeIds.has(episode.episode_id),
        video_url: episode.url_streaming_no_drm,
        seriesId: episode.series_id.toString()
      }));
    } catch (err) {
      console.error('Unexpected error fetching episodes:', err);
      return mockEpisodes.filter(e => e.saisonId === saisonId);
    }
  }

  // Récupérer un épisode par ID
  static async getEpisodeById(campaignCountriesLanguagesId: string | null, episodeId: string): Promise<Episode | null> {
    if (!campaignCountriesLanguagesId) {
      console.log('ContentService.getEpisodeById: No campaign ID, returning null');
      return null;
    }

    if (!supabase) {
      console.warn('Supabase not configured, using mock data for episode');
      return mockEpisodes.find(e => e.id === episodeId) || null;
    }

    try {
      console.log('Fetching episode from Supabase...');
      
      const { data: episodeData, error: episodeError } = await supabase
        .from('contents_series_episodes')
        .select('*')
        .eq('campaign_countries_languages_id', campaignCountriesLanguagesId)
        .eq('episode_id', parseInt(episodeId))
        .single();

      if (episodeError) {
        console.error('Error fetching episode:', episodeError);
        return mockEpisodes.find(e => e.id === episodeId) || null;
      }

      if (!episodeData) {
        return mockEpisodes.find(e => e.id === episodeId) || null;
      }

      // Check if episode is free
      const { data: freeEpisodeData } = await supabase
        .from('contents_series_episodes_free')
        .select('episode_id')
        .eq('campaign_countries_languages_id', campaignCountriesLanguagesId)
        .eq('episode_id', parseInt(episodeId))
        .single();

      return {
        id: episodeData.episode_id.toString(),
        title: episodeData.title || `Episode ${episodeData.episode_position}`,
        description: episodeData.description || `Episode ${episodeData.episode_position} description`,
        thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176',
        duration: Math.floor((episodeData.duration || 900) / 60),
        saisonId: episodeData.season_id.toString(),
        episodeNumber: episodeData.episode_position,
        is_free: !!freeEpisodeData,
        video_url: episodeData.url_streaming_no_drm,
        seriesId: episodeData.series_id.toString()
      };
    } catch (err) {
      console.error('Unexpected error fetching episode:', err);
      return mockEpisodes.find(e => e.id === episodeId) || null;
    }
  }

  // Get the first season ID for a series
  static async getFirstSeasonIdForSeries(campaignCountriesLanguagesId: string | null, seriesId: string): Promise<{
    seasonId: string;
    seriesId: string;
    seasonPosition: number;
  } | null> {
    if (!campaignCountriesLanguagesId) {
      console.log('ContentService.getFirstSeasonIdForSeries: No campaign ID, returning null');
      return null;
    }

    if (!supabase) {
      console.warn('Supabase not configured, using mock data for first season');
      const mockSaison = mockSaisons.find(s => s.serieId === seriesId);
      return mockSaison ? {
        seasonId: mockSaison.id,
        seriesId: seriesId,
        seasonPosition: mockSaison.number
      } : null;
    }

    try {
      console.log('Fetching first season for series from Supabase...');
      
      const { data, error } = await supabase
        .from('contents_series_episodes')
        .select('season_id, season_position')
        .eq('campaign_countries_languages_id', campaignCountriesLanguagesId)
        .eq('series_id', parseInt(seriesId))
        .order('season_position', { ascending: true })
        .limit(1)
        .single();

      if (error) {
        console.error('Error fetching first season:', error);
        const mockSaison = mockSaisons.find(s => s.serieId === seriesId);
        return mockSaison ? {
          seasonId: mockSaison.id,
          seriesId: seriesId,
          seasonPosition: mockSaison.number
        } : null;
      }

      if (!data) {
        console.log('No season found for series, using mock data');
        const mockSaison = mockSaisons.find(s => s.serieId === seriesId);
        return mockSaison ? {
          seasonId: mockSaison.id,
          seriesId: seriesId,
          seasonPosition: mockSaison.number
        } : null;
      }

      return {
        seasonId: data.season_id.toString(),
        seriesId: seriesId,
        seasonPosition: data.season_position || 1
      };
    } catch (err) {
      console.error('Unexpected error fetching first season:', err);
      const mockSaison = mockSaisons.find(s => s.serieId === seriesId);
      return mockSaison ? {
        seasonId: mockSaison.id,
        seriesId: seriesId,
        seasonPosition: mockSaison.number
      } : null;
    }
  }

  // Récupérer une série par ID
  static async getSerieById(campaignCountriesLanguagesId: string | null, serieId: string): Promise<Serie | null> {
    if (!campaignCountriesLanguagesId) {
      console.log('ContentService.getSerieById: No campaign ID, returning null');
      return null;
    }

    if (!supabase) {
      console.warn('Supabase not configured, using mock data for serie');
      return mockSeries.find(s => s.id === serieId) || null;
    }

    try {
      console.log('Fetching serie from Supabase...');
      
      const { data, error } = await supabase
        .from('contents_series')
        .select('*')
        .eq('campaign_countries_languages_id', campaignCountriesLanguagesId)
        .eq('serie_id', parseInt(serieId))
        .single();

      if (error) {
        console.error('Error fetching serie:', error);
        return mockSeries.find(s => s.id === serieId) || null;
      }

      if (!data) {
        return mockSeries.find(s => s.id === serieId) || null;
      }

      return this.mapSeriesToInterface([data])[0] || null;
    } catch (err) {
      console.error('Unexpected error fetching serie:', err);
      return mockSeries.find(s => s.id === serieId) || null;
    }
  }

  // Get series that have at least one free episode
  static async getSeriesWithFreeEpisodes(campaignCountriesLanguagesId: string | null): Promise<Serie[]> {
    if (!campaignCountriesLanguagesId) {
      console.log('ContentService.getSeriesWithFreeEpisodes: No campaign ID, returning empty results');
      return [];
    }

    if (!supabase) {
      console.warn('Supabase not configured, using mock data for free series');
      return mockSeries.filter(s => s.id === '1' || s.id === '2'); // Mock free series
    }

    try {
      console.log('Fetching series with free episodes from Supabase...');
      
      // Get unique series IDs that have free episodes
      const { data: freeEpisodesData, error: freeError } = await supabase
        .from('contents_series_episodes_free')
        .select(`
          episode_id,
          contents_series_episodes!inner(
            series_id
          )
        `)
        .eq('campaign_countries_languages_id', campaignCountriesLanguagesId);

      if (freeError) {
        console.error('Error fetching free episodes:', freeError);
        return mockSeries.filter(s => s.id === '1' || s.id === '2');
      }

      if (!freeEpisodesData || freeEpisodesData.length === 0) {
        console.log('No free episodes found');
        return [];
      }

      // Extract unique series IDs
      const seriesIds = [...new Set(freeEpisodesData.map(item => 
        (item as any).contents_series_episodes.series_id
      ))];

      if (seriesIds.length === 0) {
        return [];
      }

      // Fetch series details for these IDs
      const { data: seriesData, error: seriesError } = await supabase
        .from('contents_series')
        .select('*')
        .eq('campaign_countries_languages_id', campaignCountriesLanguagesId)
        .in('serie_id', seriesIds);

      if (seriesError) {
        console.error('Error fetching series with free episodes:', seriesError);
        return mockSeries.filter(s => s.id === '1' || s.id === '2');
      }

      return this.mapSeriesToInterface(seriesData || []);
    } catch (err) {
      console.error('Unexpected error fetching series with free episodes:', err);
      return mockSeries.filter(s => s.id === '1' || s.id === '2');
    }
  }

  // Get all episodes for a series (for playlist creation)
  static async getAllEpisodesForSeries(campaignCountriesLanguagesId: string | null, seriesId: string): Promise<Episode[]> {
    if (!campaignCountriesLanguagesId) {
      console.log('ContentService.getAllEpisodesForSeries: No campaign ID, returning empty results');
      return [];
    }

    if (!supabase) {
      console.warn('Supabase not configured, using mock data for series episodes');
      return mockEpisodes.filter(e => {
        const saison = mockSaisons.find(s => s.id === e.saisonId);
        return saison?.serieId === seriesId;
      });
    }

    try {
      console.log('Fetching all episodes for series from Supabase...');
      
      const { data: episodesData, error: episodesError } = await supabase
        .from('contents_series_episodes')
        .select('*')
        .eq('campaign_countries_languages_id', campaignCountriesLanguagesId)
        .eq('series_id', parseInt(seriesId))
        .order('season_position', { ascending: true })
        .order('episode_position', { ascending: true });

      if (episodesError) {
        console.error('Error fetching series episodes:', episodesError);
        return mockEpisodes.filter(e => {
          const saison = mockSaisons.find(s => s.id === e.saisonId);
          return saison?.serieId === seriesId;
        });
      }

      if (!episodesData || episodesData.length === 0) {
        console.log('No episodes found for series, using mock data');
        return mockEpisodes.filter(e => {
          const saison = mockSaisons.find(s => s.id === e.saisonId);
          return saison?.serieId === seriesId;
        });
      }

      // Get free episodes
      const { data: freeEpisodesData } = await supabase
        .from('contents_series_episodes_free')
        .select('episode_id')
        .eq('campaign_countries_languages_id', campaignCountriesLanguagesId);

      const freeEpisodeIds = new Set(freeEpisodesData?.map(item => item.episode_id) || []);

      return episodesData.map((episode: DatabaseEpisode) => ({
        id: episode.episode_id.toString(),
        title: episode.title || `Episode ${episode.episode_position}`,
        description: episode.description || `Episode ${episode.episode_position} description`,
        thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176',
        duration: Math.floor((episode.duration || 900) / 60), // Convert seconds to minutes
        saisonId: episode.season_id.toString(),
        episodeNumber: episode.episode_position,
        is_free: freeEpisodeIds.has(episode.episode_id),
        video_url: episode.url_streaming_no_drm,
        seriesId: seriesId
      }));
    } catch (err) {
      console.error('Unexpected error fetching series episodes:', err);
      return mockEpisodes.filter(e => {
        const saison = mockSaisons.find(s => s.id === e.saisonId);
        return saison?.serieId === seriesId;
      });
    }
  }

  // Helper method to map database series to interface
  private static mapSeriesToInterface(seriesData: DatabaseSerie[]): Serie[] {
    return seriesData.map((serie: DatabaseSerie) => ({
      id: serie.serie_id.toString(),
      title: serie.title,
      description: serie.description || 'No description available',
      thumbnail: serie.url_covers || 'https://images.unsplash.com/photo-1518709268805-4e9042af2176',
      rubriqueId: '1', // Default rubrique, you might want to fetch this from contents_series_rubrics
      rating: 4.5 + Math.random() * 0.5, // Random rating between 4.5-5.0
      totalSeasons: 1, // You might want to calculate this from episodes
      isPopular: Math.random() > 0.7,
      isNew: Math.random() > 0.8,
      isTrending: Math.random() > 0.6
    }));
  }
}