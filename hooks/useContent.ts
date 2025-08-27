import { useState, useEffect } from 'react';
import { ContentService } from '@/services/contentService';
import type { SearchResult } from '@/services/contentService';
import { Rubrique, Serie, Saison, Episode } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

export const useSearch = (campaignCountriesLanguagesId: string | null, query: string) => {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const searchContent = async () => {
      if (!campaignCountriesLanguagesId || !query.trim()) {
        setResults([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const searchResults = await ContentService.search(campaignCountriesLanguagesId, query);
        setResults(searchResults);
      } catch (err) {
        setError('Error searching content');
        console.error(err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    // Debounce search to avoid too many API calls
    const timeoutId = setTimeout(searchContent, 300);
    return () => clearTimeout(timeoutId);
  }, [campaignCountriesLanguagesId, query]);

  return { results, loading, error };
};

export const useTopViewedSeries = (campaignCountriesLanguagesId: string | null, limit: number = 3) => {
  const [series, setSeries] = useState<Serie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTopSeries = async () => {
      if (!campaignCountriesLanguagesId) {
        setSeries([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await ContentService.getTopViewedSeries(campaignCountriesLanguagesId, limit);
        setSeries(data);
        setError(null);
      } catch (err) {
        setError('Erreur lors du chargement des séries populaires');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTopSeries();
  }, [campaignCountriesLanguagesId, limit]);

  return { series, loading, error };
};

export const useRubriques = (campaignCountriesLanguagesId: string | null) => {
  const [rubriques, setRubriques] = useState<Rubrique[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRubriques = async () => {
      if (!campaignCountriesLanguagesId) {
        setRubriques([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        console.log('useRubriques: Starting fetch...');
        const data = await ContentService.getRubriques(campaignCountriesLanguagesId);
        console.log('useRubriques: Data received:', data);
        setRubriques(data);
        setError(null);
      } catch (err) {
        setError('Erreur lors du chargement des rubriques');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchRubriques();
  }, [campaignCountriesLanguagesId]);

  return { rubriques, loading, error };
};

export const useSeries = (campaignCountriesLanguagesId: string | null) => {
  const [series, setSeries] = useState<Serie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSeries = async () => {
      if (!campaignCountriesLanguagesId) {
        setSeries([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        console.log('useSeries: Starting fetch...');
        const data = await ContentService.getSeries(campaignCountriesLanguagesId);
        console.log('useSeries: Data received:', data);
        setSeries(data);
        setError(null);
      } catch (err) {
        setError('Erreur lors du chargement des séries');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSeries();
  }, [campaignCountriesLanguagesId]);

  return { series, loading, error };
};

export const useSeriesWithFreeEpisodes = (campaignCountriesLanguagesId: string | null) => {
  const [series, setSeries] = useState<Serie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSeries = async () => {
      if (!campaignCountriesLanguagesId) {
        setSeries([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        console.log('useSeriesWithFreeEpisodes: Starting fetch...');
        const data = await ContentService.getSeriesWithFreeEpisodes(campaignCountriesLanguagesId);
        console.log('useSeriesWithFreeEpisodes: Data received:', data);
        setSeries(data);
        setError(null);
      } catch (err) {
        setError('Erreur lors du chargement des séries gratuites');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSeries();
  }, [campaignCountriesLanguagesId]);

  return { series, loading, error };
};

export const useSeriesByRubrique = (campaignCountriesLanguagesId: string | null, rubriqueId: string) => {
  const [series, setSeries] = useState<Serie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSeries = async () => {
      if (!campaignCountriesLanguagesId || !rubriqueId) {
        setSeries([]);
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const data = await ContentService.getSeriesByRubrique(campaignCountriesLanguagesId, rubriqueId);
        setSeries(data);
        setError(null);
      } catch (err) {
        setError('Erreur lors du chargement des séries');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSeries();
  }, [campaignCountriesLanguagesId, rubriqueId]);

  return { series, loading, error };
};

export const useSaisonsBySerie = (campaignCountriesLanguagesId: string | null, serieId: string) => {
  const [saisons, setSaisons] = useState<Saison[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSaisons = async () => {
      if (!campaignCountriesLanguagesId || !serieId) {
        setSaisons([]);
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const data = await ContentService.getSaisonsBySerie(campaignCountriesLanguagesId, serieId);
        setSaisons(data);
        setError(null);
      } catch (err) {
        setError('Erreur lors du chargement des saisons');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSaisons();
  }, [campaignCountriesLanguagesId, serieId]);

  return { saisons, loading, error };
};

export const useEpisodesBySaison = (campaignCountriesLanguagesId: string | null, saisonId: string) => {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEpisodes = async () => {
      if (!campaignCountriesLanguagesId || !saisonId) {
        setEpisodes([]);
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const data = await ContentService.getEpisodesBySaison(campaignCountriesLanguagesId, saisonId);
        setEpisodes(data);
        setError(null);
      } catch (err) {
        setError('Erreur lors du chargement des épisodes');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchEpisodes();
  }, [campaignCountriesLanguagesId, saisonId]);

  return { episodes, loading, error };
};

export const useEpisodeById = (campaignCountriesLanguagesId: string | null, episodeId: string) => {
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEpisode = async () => {
      if (!campaignCountriesLanguagesId || !episodeId) {
        setEpisode(null);
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const data = await ContentService.getEpisodeById(campaignCountriesLanguagesId, episodeId);
        setEpisode(data);
        setError(null);
      } catch (err) {
        setError('Erreur lors du chargement de l\'épisode');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchEpisode();
  }, [campaignCountriesLanguagesId, episodeId]);

  return { episode, loading, error };
};

export const useUserViewingProgress = () => {
  const [viewingProgress, setViewingProgress] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { authState } = useAuth();

  useEffect(() => {
    const fetchViewingProgress = async () => {
      if (!authState.user?.smartuserId) {
        setViewingProgress([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        const { data, error: fetchError } = await supabase
          .from('user_viewing_progress_with_details')
          .select('*')
          .eq('smartuser_id', authState.user.smartuserId)
          .order('updated_at', { ascending: false });

        if (fetchError) {
          console.error('Error fetching viewing progress:', fetchError);
          setError('Error loading viewing history');
          return;
        }

        setViewingProgress(data || []);
      } catch (err) {
        console.error('Unexpected error fetching viewing progress:', err);
        setError('Error loading viewing history');
      } finally {
        setLoading(false);
      }
    };

    fetchViewingProgress();
  }, [authState.user?.smartuserId]);

  return { viewingProgress, loading, error };
};

export const useSerieById = (campaignCountriesLanguagesId: string | null, serieId: string) => {
  const [serie, setSerie] = useState<Serie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSerie = async () => {
      if (!campaignCountriesLanguagesId || !serieId) {
        setSerie(null);
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const data = await ContentService.getSerieById(campaignCountriesLanguagesId, serieId);
        setSerie(data);
        setError(null);
      } catch (err) {
        setError('Erreur lors du chargement de la série');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSerie();
  }, [campaignCountriesLanguagesId, serieId]);

  return { serie, loading, error };
};

export const useFirstEpisodesOfAllSeries = (campaignCountriesLanguagesId: string | null) => {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFirstEpisodes = async () => {
      if (!campaignCountriesLanguagesId) {
        setEpisodes([]);
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const data = await ContentService.getFirstEpisodesOfAllSeries(campaignCountriesLanguagesId);
        setEpisodes(data);
        setError(null);
      } catch (err) {
        setError('Error loading first episodes');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchFirstEpisodes();
  }, [campaignCountriesLanguagesId]);

  return { episodes, loading, error };
};