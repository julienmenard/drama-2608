import { createClient } from 'npm:@supabase/supabase-js@2.51.0';

// CORS headers pour permettre les requêtes cross-origin
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

// Initialisation du client Supabase avec les permissions service_role
const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

// Configuration de l'API Galaxy (sans campaignId fixe)
const GALAXY_CONFIG = {
  baseUrl: Deno.env.get('GALAXY_BASE_URL') || 'https://galaxy-api.galaxydve.com',
  apiKey: Deno.env.get('GALAXY_API_KEY'),
  apiSecretKey: Deno.env.get('GALAXY_API_SECRET_KEY'),
  serviceId: Deno.env.get('GALAXY_SERVICE_ID') || '1'
};

/**
 * Fonction utilitaire pour effectuer des requêtes à l'API Galaxy
 */
async function fetchWithParams(endpoint, campaignId, countryCode, languageCode, additionalParams = {}) {
  // Validation des secrets requis
  if (!GALAXY_CONFIG.apiKey || !GALAXY_CONFIG.apiSecretKey) {
    throw new Error('GALAXY_API_KEY et GALAXY_API_SECRET_KEY sont requis dans les secrets Supabase');
  }

  const params = new URLSearchParams();
  params.append('api_key', GALAXY_CONFIG.apiKey);
  params.append('api_secret_key', GALAXY_CONFIG.apiSecretKey);
  params.append('campaign_id', campaignId.toString());
  params.append('service_id', GALAXY_CONFIG.serviceId);
  params.append('country_code', countryCode);
  params.append('language_code', languageCode);

  Object.entries(additionalParams).forEach(([key, value]) => {
    params.append(key, value);
  });

  const url = `${GALAXY_CONFIG.baseUrl}${endpoint}?${params.toString()}`;
  console.log('🌌 Calling Galaxy API:', url);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('📊 Galaxy API Response:', data);

    if (data.code !== 200) {
      throw new Error(`Galaxy API error: ${data.code} - ${data.message || 'Unknown error'}`);
    }

    return data;
  } catch (error) {
    console.error('❌ Galaxy API request failed:', error);
    throw error;
  }
}

/**
 * Point d'entrée principal de la fonction Edge Supabase
 */
Deno.serve(async (req) => {
  try {
    // Gérer les requêtes OPTIONS (CORS preflight)
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders
      });
    }

    console.log('🚀 Starting galaxy-import function...');

    // 📊 Récupérer toutes les configurations de campagne/pays/langue
    console.log('📋 Fetching campaign configurations...');
    const { data: campaignConfigs, error: configError } = await supabase
      .from('campaign_countries_languages')
      .select('id, campaign_id, country_code, language_code');

    if (configError) {
      console.error('❌ Failed to fetch campaign configurations:', configError);
      return new Response(JSON.stringify({
        success: false,
        error: `Failed to fetch configurations: ${configError.message}`
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 500
      });
    }

    if (!campaignConfigs || campaignConfigs.length === 0) {
      console.log('⚠️ No campaign configurations found');
      return new Response(JSON.stringify({
        success: true,
        message: 'No campaign configurations found',
        imported: 0
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }

    // Récupérer les paramètres de la requête
    const url = new URL(req.url);
    const rubricId = url.searchParams.get('rubric_id') || '299457'; // ID de rubrique par défaut
    const contentType = url.searchParams.get('content_type') || 'series';

    // 🗑️ Vider les tables contents_series et contents_rubrics avant l'import
    console.log('🗑️ Clearing contents_series, contents_rubrics, contents_series_rubrics, contents_series_episodes, and contents_series_episodes_free tables (preserving user_viewing_progress)...');

    // Vider les tables en parallèle
    // Delete tables in correct order to respect foreign key constraints
    // 1. Delete contents_series_episodes_free (depends on contents_series_episodes)
    console.log('🗑️ Step 1: Clearing contents_series_episodes_free...');
    const { error: freeEpisodesError } = await supabase
      .from('contents_series_episodes_free')
      .delete()
      .gte('episode_id', 0);

    if (freeEpisodesError) {
      console.error('❌ Failed to clear contents_series_episodes_free table:', freeEpisodesError);
      return new Response(JSON.stringify({
        success: false,
        error: `Failed to clear contents_series_episodes_free table: ${freeEpisodesError.message}`
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 500
      });
    }

    // 2. Delete contents_series_episodes (depends on contents_series)
    console.log('🗑️ Step 2: Clearing contents_series_episodes...');
    const { error: seriesEpisodesError } = await supabase
      .from('contents_series_episodes')
      .delete()
      .gte('series_id', 0);

    if (seriesEpisodesError) {
      console.error('❌ Failed to clear contents_series_episodes table:', seriesEpisodesError);
      return new Response(JSON.stringify({
        success: false,
        error: `Failed to clear contents_series_episodes table: ${seriesEpisodesError.message}`
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 500
      });
    }

    // 3. Delete contents_series_rubrics (depends on contents_series and contents_rubrics)
    console.log('🗑️ Step 3: Clearing contents_series_rubrics...');
    const { error: seriesRubricsError } = await supabase
      .from('contents_series_rubrics')
      .delete()
      .gte('serie_id', 0);

    if (seriesRubricsError) {
      console.error('❌ Failed to clear contents_series_rubrics table:', seriesRubricsError);
      return new Response(JSON.stringify({
        success: false,
        error: `Failed to clear contents_series_rubrics table: ${seriesRubricsError.message}`
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 500
      });
    }

    // 4. Delete contents_series
    console.log('🗑️ Step 4: Clearing contents_series...');
    const { error: seriesError } = await supabase
      .from('contents_series')
      .delete()
      .gte('serie_id', 0);

    if (seriesError) {
      console.error('❌ Failed to clear contents_series table:', seriesError);
      return new Response(JSON.stringify({
        success: false,
        error: `Failed to clear contents_series table: ${seriesError.message}`
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 500
      });
    }

    // 5. Delete contents_rubrics
    console.log('🗑️ Step 5: Clearing contents_rubrics...');
    const { error: rubricsError } = await supabase
      .from('contents_rubrics')
      .delete()
      .gte('id_rubric', 0);

    if (rubricsError) {
      console.error('❌ Failed to clear contents_rubrics table:', rubricsError);
      return new Response(JSON.stringify({
        success: false,
        error: `Failed to clear contents_rubrics table: ${rubricsError.message}`
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 500
      });
    }

    console.log('✅ Tables contents_series, contents_rubrics, contents_series_rubrics, contents_series_episodes, and contents_series_episodes_free cleared successfully (user_viewing_progress preserved)');

    let totalImported = 0;
    let totalRubricsImported = 0;
    let totalSeriesRubricsImported = 0;
    let totalSeriesEpisodesImported = 0;
    let totalFreeEpisodesImported = 0;

    // 🔄 Traiter chaque configuration
    for (const config of campaignConfigs) {
      console.log(`🌐 Processing config ID: ${config.id}, campaign: ${config.campaign_id}, country: ${config.country_code}, language: ${config.language_code}`);

      try {
        // 📚 Appel à l'API Galaxy pour les rubriques
        console.log(`📚 Fetching rubrics for config ID ${config.id}...`);
        const rubricsResponse = await fetchWithParams(
          '/publishing-rubric-list',
          config.campaign_id,
          config.country_code,
          config.language_code
        );

        // Préparation des données à insérer dans la table 'contents_rubrics'
        const rubricsToUpsert = rubricsResponse.data.data.map((rubric) => ({
          id_rubric: rubric.rubric_id,
          rubric_name: rubric.rubric_title || rubric.rubric_label,
          campaign_countries_languages_id: config.id
        }));

        if (rubricsToUpsert.length > 0) {
          console.log(`📚 Attempting to upsert ${rubricsToUpsert.length} rubrics for config ID ${config.id}...`);
          // Utilisation de upsert pour insérer de nouvelles entrées ou mettre à jour les existantes
          const { error: rubricsError } = await supabase
            .from('contents_rubrics')
            .upsert(rubricsToUpsert, {
              onConflict: 'id_rubric,campaign_countries_languages_id'
            });

          if (rubricsError) {
            console.error(`❌ Supabase rubrics upsert error for config ID ${config.id}:`, rubricsError);
            throw rubricsError;
          }

          totalRubricsImported += rubricsToUpsert.length;
          console.log(`✅ Successfully imported ${rubricsToUpsert.length} rubrics for config ID ${config.id} (campaign ${config.campaign_id})`);
        } else {
          console.log(`⚠️ No rubrics found for config ID ${config.id} (campaign ${config.campaign_id}, country ${config.country_code}, language ${config.language_code})`);
        }

        // 📺 Appel à l'API Galaxy pour les séries
        console.log(`📺 About to fetch series for config ID ${config.id} with parameters:`, {
          endpoint: '/publishing-content-list',
          campaign_id: config.campaign_id,
          country_code: config.country_code,
          language_code: config.language_code,
          rubric_id: rubricId,
          content_type: contentType,
          artist: 'true',
          asset: 'true',
          delivery: 'true'
        });

        const galaxyResponse = await fetchWithParams(
          '/publishing-content-list',
          config.campaign_id,
          config.country_code,
          config.language_code,
          {
            rubric_id: rubricId,
            content_type: contentType,
            artist: 'true',
            asset: 'true',
            delivery: 'true'
          }
        );

        console.log(`📺 Galaxy API response for config ID ${config.id}:`, {
          responseCode: galaxyResponse.code,
          dataLength: galaxyResponse.data?.data?.length || 0,
          hasData: !!galaxyResponse.data?.data,
          sampleData: galaxyResponse.data?.data?.length > 0 ? galaxyResponse.data.data.slice(0, 2) : 'No data',
          fullResponse: galaxyResponse.data?.data?.length === 0 ? galaxyResponse : 'Data exists, not logging full response'
        });

        // Préparation des données à insérer dans la table 'contents_series'
        const contentsToUpsert = galaxyResponse.data.data.map((item) => ({
          serie_id: item.content_id,
          title: item.title,
          description: item.description || null,
          campaign_countries_languages_id: config.id,
          url_covers: item.assets?.cover?.[0]?.url || null
        }));

        if (contentsToUpsert.length > 0) {
          console.log(`💾 Attempting to upsert ${contentsToUpsert.length} contents for config ID ${config.id}...`);
          // Utilisation de upsert pour insérer de nouvelles entrées ou mettre à jour les existantes
          const { error } = await supabase
            .from('contents_series')
            .upsert(contentsToUpsert, {
              onConflict: 'serie_id,campaign_countries_languages_id'
            });

          if (error) {
            console.error(`❌ Supabase upsert error for config ID ${config.id}:`, error);
            throw error;
          }

          totalImported += contentsToUpsert.length;
          console.log(`✅ Successfully imported ${contentsToUpsert.length} series for config ID ${config.id} (campaign ${config.campaign_id})`);

          // 🔗 Création des associations séries-rubriques
          console.log(`🔗 Creating series-rubrics associations for config ID ${config.id}...`);
          const seriesRubricsToInsert = [];

          for (const item of galaxyResponse.data.data) {
            // Vérifier si la série a des rubriques associées
            if (item.rubric_id && Array.isArray(item.rubric_id)) {
              for (const rubricId of item.rubric_id) {
                seriesRubricsToInsert.push({
                  serie_id: item.content_id,
                  id_rubric: rubricId,
                  campaign_countries_languages_id: config.id
                });
              }
            }
          }

          if (seriesRubricsToInsert.length > 0) {
            console.log(`🔗 Attempting to upsert ${seriesRubricsToInsert.length} series-rubrics associations for config ID ${config.id}...`);
            // Utilisation de upsert pour insérer de nouvelles entrées ou mettre à jour les existantes
            const { error: seriesRubricsError } = await supabase
              .from('contents_series_rubrics')
              .upsert(seriesRubricsToInsert, {
                onConflict: 'serie_id,id_rubric,campaign_countries_languages_id'
              });

            if (seriesRubricsError) {
              console.error(`❌ Supabase series-rubrics upsert error for config ID ${config.id}:`, seriesRubricsError);
              throw seriesRubricsError;
            }

            totalSeriesRubricsImported += seriesRubricsToInsert.length;
            console.log(`✅ Successfully imported ${seriesRubricsToInsert.length} series-rubrics associations for config ID ${config.id} (campaign ${config.campaign_id})`);
          } else {
            console.log(`⚠️ No series-rubrics associations found for config ID ${config.id}`);
          }

          // 📺 Récupération des épisodes pour chaque série
          console.log(`📺 Fetching episodes for ${contentsToUpsert.length} series in config ID ${config.id}...`);
          console.log(`📺 DEBUG: Starting episode fetching for config ID ${config.id} (campaign ${config.campaign_id}, country ${config.country_code}, language ${config.language_code})`);
          const seriesEpisodesToInsert = [];

          for (const series of contentsToUpsert) {
            try {
              console.log(`📺 DEBUG: Processing series ${series.serie_id}: ${series.title} for config ID ${config.id}`);
              console.log(`📺 Processing series ${series.serie_id}: ${series.title}`);

              // 1. Récupérer les saisons de la série avec leurs détails
              console.log(`📺 DEBUG: About to fetch seasons for series ${series.serie_id} with config ID ${config.id}`);
              const seriesSeasonsResponse = await fetchWithParams(
                '/publishing-content-list-by-collection',
                config.campaign_id,
                config.country_code,
                config.language_code,
                {
                  content_id: series.serie_id.toString(),
                  preview: 'true',
                  asset: 'true',
                  delivery: 'true'
                }
              );

              console.log(`📺 DEBUG: Seasons response for series ${series.serie_id} config ID ${config.id}:`, {
                responseCode: seriesSeasonsResponse.code,
                dataLength: seriesSeasonsResponse.data?.data?.length || 0,
                hasData: !!seriesSeasonsResponse.data?.data,
                seasonsData: seriesSeasonsResponse.data?.data?.map(s => ({ 
                  content_id: s.content_id, 
                  children_number: s.children_number 
                })) || []
              });
              console.log(`📺 Found ${seriesSeasonsResponse.data.data.length} seasons for series ${series.serie_id}`);

              // 2. Pour chaque saison, récupérer les épisodes
              for (const season of seriesSeasonsResponse.data.data) {
                try {
                  console.log(`📺 DEBUG: Processing season ${season.content_id} for series ${series.serie_id} config ID ${config.id}`);
                  console.log(`📺 Processing season ${season.content_id} for series ${series.serie_id}`);
                  console.log(`📺 Season children_number: ${season.children_number}`);

                  console.log(`📺 DEBUG: About to fetch episodes for season ${season.content_id} series ${series.serie_id} config ID ${config.id}`);
                  const episodesResponse = await fetchWithParams(
                    '/publishing-content-list-by-collection',
                    config.campaign_id,
                    config.country_code,
                    config.language_code,
                    {
                      content_id: season.content_id.toString(),
                      preview: 'true',
                      asset: 'true',
                      delivery: 'true'
                    }
                  );

                  console.log(`📺 DEBUG: Episodes response for season ${season.content_id} series ${series.serie_id} config ID ${config.id}:`, {
                    responseCode: episodesResponse.code,
                    dataLength: episodesResponse.data?.data?.length || 0,
                    hasData: !!episodesResponse.data?.data,
                    episodesData: episodesResponse.data?.data?.map(e => ({ 
                      content_id: e.content_id, 
                      title: e.title,
                      display_order: e.display_order 
                    })) || []
                  });
                  console.log(`📺 Found ${episodesResponse.data.data.length} episodes for season ${season.content_id}`);

                  // 3. Créer les enregistrements d'épisodes
                  console.log(`📺 DEBUG: Creating episode records for season ${season.content_id} series ${series.serie_id} config ID ${config.id}`);
                  episodesResponse.data.data.forEach((episode, index) => {
                    // Extraire l'URL de streaming de l'épisode
                    let streamingUrl = 'url'; // Valeur par défaut

                    try {
                      // Priority 1: Main delivery URL
                      if (episode.deliveries?.mainDelivery?.url) {
                        streamingUrl = episode.deliveries.mainDelivery.url;
                      } else if (episode.deliveries?.stream) {
                        const qualityPriority = [
                          'VHD (1080p)',
                          'HD (720p)',
                          'SD (480p)',
                          'HD',
                          'SD'
                        ];

                        for (const quality of qualityPriority) {
                          if (episode.deliveries.stream[quality]?.[0]?.url) {
                            streamingUrl = episode.deliveries.stream[quality][0].url;
                            break;
                          }
                        }

                        // Fallback: use any available stream
                        if (streamingUrl === 'url') {
                          const availableQualities = Object.keys(episode.deliveries.stream);
                          if (availableQualities.length > 0) {
                            const firstQuality = availableQualities[0];
                            if (episode.deliveries.stream[firstQuality]?.[0]?.url) {
                              streamingUrl = episode.deliveries.stream[firstQuality][0].url;
                            }
                          }
                        }
                      } else if (episode.deliveries?.additionalDeliveries && episode.deliveries.additionalDeliveries.length > 0) {
                        if (episode.deliveries.additionalDeliveries[0].url) {
                          streamingUrl = episode.deliveries.additionalDeliveries[0].url;
                        }
                      } else if (episode.deliveries?.download?.[0]?.url) {
                        streamingUrl = episode.deliveries.download[0].url;
                      }

                      console.log(`📺 Episode ${episode.content_id} streaming URL: ${streamingUrl}`);
                    } catch (urlError) {
                      console.warn(`⚠️ Failed to extract streaming URL for episode ${episode.content_id}:`, urlError);
                      // Garder la valeur par défaut 'url'
                    }

                    seriesEpisodesToInsert.push({
                      series_id: series.serie_id,
                      episode_id: episode.content_id,
                      season_id: season.content_id,
                      season_position: season.children_number || 1,
                      episode_position: episode.display_order || (index + 1),
                      campaign_countries_languages_id: config.id,
                      url_streaming_no_drm: streamingUrl,
                      description: episode.description || null,
                      title: episode.title || `Episode ${episode.display_order || (index + 1)}`,
                      duration: episode.duration || null,
                      product_year: episode.product_year || null
                    });
                    console.log(`📺 DEBUG: Added episode ${episode.content_id} to insert batch for config ID ${config.id}`);
                  });
                } catch (episodeError) {
                  console.error(`❌ DEBUG: Failed to fetch episodes for season ${season.content_id} series ${series.serie_id} config ID ${config.id}:`, episodeError);
                  console.error(`❌ Failed to fetch episodes for season ${season.content_id}:`, episodeError);
                  // Continuer avec la saison suivante même en cas d'erreur
                }
              }
            } catch (seasonError) {
              console.error(`❌ DEBUG: Failed to fetch seasons for series ${series.serie_id} config ID ${config.id}:`, seasonError);
              console.error(`❌ Failed to fetch seasons for series ${series.serie_id}:`, seasonError);
              // Continuer avec la série suivante même en cas d'erreur
            }
          }

          // 4. Insérer tous les épisodes en une seule fois
          if (seriesEpisodesToInsert.length > 0) {
            console.log(`📺 DEBUG: About to upsert ${seriesEpisodesToInsert.length} series-episodes for config ID ${config.id}`);
            console.log(`📺 DEBUG: Sample episodes to insert for config ID ${config.id}:`, 
              seriesEpisodesToInsert.slice(0, 3).map(ep => ({
                series_id: ep.series_id,
                episode_id: ep.episode_id,
                season_id: ep.season_id,
                campaign_countries_languages_id: ep.campaign_countries_languages_id,
                title: ep.title
              }))
            );
            console.log(`📺 Attempting to upsert ${seriesEpisodesToInsert.length} series-episodes for config ID ${config.id}...`);
            const { error: seriesEpisodesError } = await supabase
              .from('contents_series_episodes')
              .upsert(seriesEpisodesToInsert, {
                onConflict: 'series_id,episode_id,season_id,campaign_countries_languages_id'
              });

            if (seriesEpisodesError) {
              console.error(`❌ DEBUG: Supabase series-episodes upsert error for config ID ${config.id}:`, {
                error: seriesEpisodesError,
                code: seriesEpisodesError.code,
                message: seriesEpisodesError.message,
                details: seriesEpisodesError.details,
                hint: seriesEpisodesError.hint
              });
              console.error(`❌ Supabase series-episodes upsert error for config ID ${config.id}:`, seriesEpisodesError);
              throw seriesEpisodesError;
            }

            totalSeriesEpisodesImported += seriesEpisodesToInsert.length;
            console.log(`✅ DEBUG: Successfully imported ${seriesEpisodesToInsert.length} series-episodes for config ID ${config.id} (campaign ${config.campaign_id})`);
            console.log(`✅ Successfully imported ${seriesEpisodesToInsert.length} series-episodes for config ID ${config.id} (campaign ${config.campaign_id})`);
          } else {
            console.log(`⚠️ DEBUG: No series-episodes found for config ID ${config.id} (campaign ${config.campaign_id}, country ${config.country_code}, language ${config.language_code})`);
            console.log(`⚠️ No series-episodes found for config ID ${config.id}`);
          }
        } else {
          console.log(`⚠️ DEBUG: No content found for config ID ${config.id} (campaign ${config.campaign_id}, country ${config.country_code}, language ${config.language_code}) - skipping episode fetching`);
          console.log(`⚠️ No content found for config ID ${config.id} (campaign ${config.campaign_id}, country ${config.country_code}, language ${config.language_code})`);
        }
      } catch (error) {
        console.error(`❌ DEBUG: Error processing config ID ${config.id} (campaign ${config.campaign_id}):`, {
          error: error,
          message: error.message,
          stack: error.stack
        });
        console.error(`❌ Error processing config ID ${config.id} (campaign ${config.campaign_id}):`, error);
        // Continue avec la configuration suivante même en cas d'erreur
      }
    }

    // 🎁 Insérer tous les premiers épisodes (episode_position = 1) dans la table contents_series_episodes_free
    console.log('🎁 Processing free episodes (episode_position = 1)...');
    console.log('🎁 DEBUG: Starting free episodes processing for all configurations');
    try {
      // Récupérer tous les épisodes avec episode_position = 1 pour toutes les configurations
      console.log('🎁 Fetching first episodes (episode_position = 1) from all configurations...');
      console.log('🎁 DEBUG: About to query contents_series_episodes for episode_position = 1');
      const { data: firstEpisodes, error: firstEpisodesError } = await supabase
        .from('contents_series_episodes')
        .select('episode_id, campaign_countries_languages_id')
        .eq('episode_position', 1);

      if (firstEpisodesError) {
        console.error('❌ DEBUG: Failed to fetch first episodes:', {
          error: firstEpisodesError,
          code: firstEpisodesError.code,
          message: firstEpisodesError.message
        });
        console.error('❌ Failed to fetch first episodes:', firstEpisodesError);
        throw firstEpisodesError;
      }

      if (firstEpisodes && firstEpisodes.length > 0) {
        console.log(`🎁 DEBUG: Found ${firstEpisodes.length} first episodes to mark as free:`, 
          firstEpisodes.map(ep => ({
            episode_id: ep.episode_id,
            campaign_countries_languages_id: ep.campaign_countries_languages_id
          }))
        );
        console.log(`🎁 Found ${firstEpisodes.length} first episodes to mark as free`);

        // Préparer les données pour l'insertion
        const freeEpisodesToInsert = firstEpisodes.map((episode) => ({
          episode_id: episode.episode_id,
          campaign_countries_languages_id: episode.campaign_countries_languages_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));

        console.log(`🎁 DEBUG: Preparing to insert ${freeEpisodesToInsert.length} free episodes for all configurations`);
        console.log(`🎁 Preparing to insert ${freeEpisodesToInsert.length} free episodes`);

        // Insérer dans contents_series_episodes_free avec gestion des conflits
        const { error: freeEpisodesInsertError } = await supabase
          .from('contents_series_episodes_free')
          .upsert(freeEpisodesToInsert, {
            onConflict: 'episode_id,campaign_countries_languages_id'
          });

        if (freeEpisodesInsertError) {
          console.error('❌ DEBUG: Failed to insert free episodes:', {
            error: freeEpisodesInsertError,
            code: freeEpisodesInsertError.code,
            message: freeEpisodesInsertError.message,
            details: freeEpisodesInsertError.details
          });
          console.error('❌ Failed to insert free episodes:', freeEpisodesInsertError);
          throw freeEpisodesInsertError;
        }

        totalFreeEpisodesImported = freeEpisodesToInsert.length;
        console.log(`✅ DEBUG: Successfully inserted ${totalFreeEpisodesImported} free episodes across all configurations`);
        console.log(`✅ Successfully inserted ${totalFreeEpisodesImported} free episodes`);
      } else {
        console.log('⚠️ DEBUG: No first episodes found to mark as free - this might indicate no episodes were imported at all');
        console.log('⚠️ No first episodes found to mark as free');
      }
    } catch (freeEpisodesError) {
      console.error('❌ DEBUG: Error processing free episodes:', {
        error: freeEpisodesError,
        message: freeEpisodesError.message,
        stack: freeEpisodesError.stack
      });
      console.error('❌ Error processing free episodes:', freeEpisodesError);
      // Ne pas faire échouer tout l'import pour une erreur sur les épisodes gratuits
    }

    console.log('✅ Galaxy import completed successfully');
    return new Response(JSON.stringify({
      success: true,
      message: `Tables cleared and successfully imported ${totalImported} series, ${totalRubricsImported} rubrics, ${totalSeriesRubricsImported} series-rubrics associations, ${totalSeriesEpisodesImported} series-episodes, and ${totalFreeEpisodesImported} free episodes from ${campaignConfigs.length} campaign/country/language configurations`,
      imported: {
        series: totalImported,
        rubrics: totalRubricsImported,
        seriesRubrics: totalSeriesRubricsImported,
        seriesEpisodes: totalSeriesEpisodesImported,
        freeEpisodes: totalFreeEpisodesImported
      },
      configurations: campaignConfigs.length
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });

  } catch (error) {
    console.error('❌ Error in galaxy-import function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});