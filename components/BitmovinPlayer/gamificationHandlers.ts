import { ContentService } from '@/services/contentService';

export const processCompletionEvents = async (
  smartuserId: string,
  seriesId: string,
  processEvent: (eventType: string, metadata?: any) => Promise<void>,
  completedEpisodesInSession: Set<string>,
  setCompletedEpisodesInSession: React.Dispatch<React.SetStateAction<Set<string>>>,
  campaignCountriesLanguagesId: string
) => {
  console.log('🎮 DEBUG: processCompletionEvents called with:', {
    smartuserId,
    completedEpisodesInSession: Array.from(completedEpisodesInSession),
    completedEpisodesCount: completedEpisodesInSession.size,
    seriesId,
    hasProcessEvent: !!processEvent,
    hasSetCompletedEpisodesInSession: !!setCompletedEpisodesInSession,
    campaignCountriesLanguagesId
  });
  console.log('Auto close Reward 🎮 DEBUG: processCompletionEvents called with:', {
    smartuserId,
    completedEpisodesInSession: Array.from(completedEpisodesInSession),
    completedEpisodesCount: completedEpisodesInSession.size,
    seriesId,
    hasProcessEvent: !!processEvent,
    hasSetCompletedEpisodesInSession: !!setCompletedEpisodesInSession,
    campaignCountriesLanguagesId
  });

  if (!smartuserId || completedEpisodesInSession.size === 0) {
    console.log('🎮 No completion events to process:', {
      hasUser: !!smartuserId,
      completedEpisodesCount: completedEpisodesInSession.size
    });
    console.log('Auto close Reward 🎮 DEBUG: Early return - no events to process');
    return;
  }

  console.log('Auto close Reward 🎮 Processing completion events for session:', {
    completedEpisodesCount: completedEpisodesInSession.size,
    completedEpisodeIds: Array.from(completedEpisodesInSession)
  });

  try {
    // Process episode completion events individually but batch the notification
    if (completedEpisodesInSession.size > 0) {
      console.log(`Auto close Reward 🎮 Processing ${completedEpisodesInSession.size} episode_completed events`);
      console.log('Auto close Reward 🎮 DEBUG: Starting individual episode processing...');
      
      // Process each episode completion event individually for database records
      for (const episodeId of completedEpisodesInSession) {
        console.log(`Auto close Reward 🎮 Processing episode_completed event for episode: ${episodeId}`);
        console.log('Auto close Reward 🎮 DEBUG: About to call processEvent for episode:', episodeId);
        await processEvent('episode_completed', {
          episodeId: episodeId,
          seriesId: seriesId,
          completedAt: new Date().toISOString(),
          suppressNotification: true // Suppress individual notifications
        });
        console.log('Auto close Reward 🎮 DEBUG: processEvent completed for episode:', episodeId);
      }
      
      console.log('Auto close Reward 🎮 DEBUG: Individual episode processing completed, creating batch notification...');
      // Create a single batched notification for all completed episodes
      await processEvent('episodes_batch_completed', {
        episodeIds: Array.from(completedEpisodesInSession),
        episodeCount: completedEpisodesInSession.size,
        seriesId: seriesId,
        completedAt: new Date().toISOString()
      });
      console.log('Auto close Reward 🎮 DEBUG: Batch notification event processed');
    }

    console.log('Auto close Reward 🎮 DEBUG: About to check series completion...');
    // Check if all episodes of the series are now completed
    await checkAndProcessSeriesCompletion(
      smartuserId,
      seriesId,
      campaignCountriesLanguagesId,
      processEvent
    );
    console.log('Auto close Reward 🎮 DEBUG: Series completion check completed');

  } catch (error) {
    console.log('Auto close Reward 🎮 DEBUG: Error in processCompletionEvents:', error);
    console.error('🎮 Error processing completion events:', error);
  } finally {
    console.log('Auto close Reward 🎮 DEBUG: Clearing completed episodes in session...');
    // Clear the completed episodes for this session
    setCompletedEpisodesInSession(new Set());
    console.log('Auto close Reward 🎮 DEBUG: processCompletionEvents function completed');
  }
};

export const checkAndProcessSeriesCompletion = async (
  smartuserId: string,
  seriesId: string,
  campaignCountriesLanguagesId: string,
  processEvent: (eventType: string, metadata?: any) => Promise<void>
) => {
  if (!smartuserId || !seriesId) return;

  try {
    console.log('🎮 Checking series completion status for series:', seriesId);

    // Get all episodes for this series
    const allSeriesEpisodes = await ContentService.getAllEpisodesForSeries(
      campaignCountriesLanguagesId,
      seriesId
    );

    if (allSeriesEpisodes.length === 0) {
      console.log('🎮 No episodes found for series, skipping series completion check');
      return;
    }

    // Get all episode IDs for this series
    const allEpisodeIds = allSeriesEpisodes.map(ep => parseInt(ep.id));
    console.log('🎮 All episode IDs for series:', allEpisodeIds);

    // Check how many episodes are completed in the database
    const { supabase } = await import('@/lib/supabase');
    const { data: completedEpisodes, error: completedError } = await supabase
      .from('user_viewing_progress')
      .select('content_id')
      .eq('smartuser_id', smartuserId)
      .eq('content_type', 'episode')
      .eq('is_completed', true)
      .in('content_id', allEpisodeIds);

    if (completedError) {
      console.error('🎮 Error checking completed episodes:', completedError);
      return;
    }

    const completedEpisodeIds = completedEpisodes?.map(ep => ep.content_id) || [];
    console.log('🎮 Completed episodes for series:', {
      totalEpisodes: allEpisodeIds.length,
      completedEpisodes: completedEpisodeIds.length,
      completedEpisodeIds,
      allCompleted: completedEpisodeIds.length === allEpisodeIds.length
    });

    // If all episodes are completed, trigger series completion event
    if (completedEpisodeIds.length === allEpisodeIds.length && allEpisodeIds.length > 0) {
      console.log('🎮 All episodes completed! Processing series completion event');
      await processEvent('series_completed', {
        seriesId: seriesId,
        totalEpisodes: allEpisodeIds.length,
        completedAt: new Date().toISOString()
      });
    } else {
      console.log('🎮 Series not yet fully completed:', {
        completed: completedEpisodeIds.length,
        total: allEpisodeIds.length,
        remaining: allEpisodeIds.length - completedEpisodeIds.length
      });
    }

  } catch (error) {
    console.error('🎮 Error checking series completion:', error);
  }
};