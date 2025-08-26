import { supabase } from '@/lib/supabase';
import { Episode } from '@/types';

export const trackViewingProgress = async (
  episodeId: string,
  seriesId: string,
  smartuserId: string,
  setCompletedEpisodesInSession: React.Dispatch<React.SetStateAction<Set<string>>>
) => {
  if (!smartuserId) return;

  try {
    console.log('📊 Tracking viewing progress for episode:', episodeId, 'series:', seriesId);
    console.log('📊 User ID:', smartuserId);
    
    // Log the exact parameters being used in the query
    console.log('📊 Query parameters:', {
      smartuser_id: smartuserId,
      content_id: parseInt(episodeId),
      content_type: 'episode'
    });
    
    // Check if a record already exists for this episode
    const { data: existingProgress, error: fetchError } = await supabase
      .from('user_viewing_progress')
      .select('completion_percentage, is_completed')
      .eq('smartuser_id', smartuserId)
      .eq('content_id', parseInt(episodeId))
      .eq('content_type', 'episode')
      .maybeSingle();

    // Log the query result
    console.log('📊 Query result:', {
      data: existingProgress,
      error: fetchError,
      hasExistingProgress: !!existingProgress
    });

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('📊 ❌ Error checking existing progress:', fetchError);
      return;
    }

    // If record exists, don't reset the progress - just update timestamp
    if (existingProgress) {
      console.log('📊 ✅ Existing progress found, preserving completion:', {
        episodeId,
        existingCompletion: existingProgress.completion_percentage,
        isCompleted: existingProgress.is_completed
      });
      
      const { error } = await supabase
        .from('user_viewing_progress')
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq('smartuser_id', smartuserId)
        .eq('content_id', parseInt(episodeId))
        .eq('content_type', 'episode');

      if (error) {
        console.error('📊 ❌ Error updating viewing progress timestamp:', error);
      } else {
        console.log('📊 ✅ Viewing progress timestamp updated, completion preserved');
      }
      return;
    }

    // Only create new record with 0% if no existing record found
    const { error } = await supabase
      .from('user_viewing_progress')
      .insert({
        smartuser_id: smartuserId,
        content_id: parseInt(episodeId),
        content_type: 'episode',
        is_completed: false,
        completion_percentage: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error('📊 ❌ Error tracking viewing progress:', error);
    } else {
      console.log('📊 ✅ New viewing progress record created for episode:', episodeId);
      console.log('📊 ✅ New record created with completion_percentage: 0, is_completed: false');
    }
  } catch (error) {
    console.error('📊 ❌ Unexpected error in trackViewingProgress:', error);
  }
};

export const updateViewingProgress = async (
  episodeId: string,
  currentTime: number,
  duration: number,
  episode: Episode,
  smartuserId: string,
  setCompletedEpisodesInSession: React.Dispatch<React.SetStateAction<Set<string>>>
) => {
  if (!smartuserId || duration <= 0) return;
  
  try {
    const completionPercentage = Math.round((currentTime / duration) * 100);
    const isCompleted = completionPercentage >= 90;
    
    console.log('📊 Updating viewing progress:', {
      episodeId,
      isCompleted,
      smartuserId: smartuserId,
      currentTime: Math.round(currentTime),
      duration: Math.round(duration),
      completionPercentage,
    });
    
    // Log the SQL query parameters for the SELECT operation
    console.log('📊 SQL SELECT query parameters:', {
      table: 'user_viewing_progress',
      where: {
        smartuser_id: smartuserId,
        content_id: parseInt(episodeId),
        content_type: 'episode'
      }
    });
    
    // Log the actual SQL query being executed
    console.log('📊 SQL SELECT Query:', `
      SELECT completion_percentage, is_completed 
      FROM user_viewing_progress 
      WHERE smartuser_id = '${smartuserId}' 
        AND content_id = ${parseInt(episodeId)} 
        AND content_type = 'episode'
      LIMIT 1;
    `);
    
    // Check existing completion percentage before updating
    const { data: existingProgress, error: fetchError } = await supabase
      .from('user_viewing_progress')
      .select('completion_percentage, is_completed')
      .eq('smartuser_id', smartuserId)
      .eq('content_id', parseInt(episodeId))
      .eq('content_type', 'episode')
      .maybeSingle();

    // Get the previous completion status to check if this is a new completion
    const wasCompleted = existingProgress?.is_completed || false;

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('📊 ❌ Error checking existing progress before update:', fetchError);
      return;
    }

    console.log('📊 ✅ Proceeding with update:', {
      existingPercentage: existingProgress?.completion_percentage || 0,
      newPercentage: completionPercentage,
      episodeId
    });

    // Check if this episode is being completed for the first time in this session
    const wasAlreadyCompleted = existingProgress?.is_completed || false;
    const isNowCompleted = isCompleted;
    const isFirstTimeCompleted = !wasAlreadyCompleted && isNowCompleted;

    console.log('📊 Completion status check:', {
      episodeId,
      wasAlreadyCompleted,
      isNowCompleted,
      isFirstTimeCompleted
    });
    
    console.log('🎮 DEBUG: Episode completion tracking:', {
      episodeId,
      currentTime: Math.round(currentTime),
      duration: Math.round(duration),
      completionPercentage,
      wasAlreadyCompleted,
      isNowCompleted,
      isFirstTimeCompleted,
      willAddToCompletedSet: isFirstTimeCompleted
    });
    
    // Log the SQL query parameters for the UPSERT operation
    console.log('📊 SQL UPSERT query parameters:', {
      table: 'user_viewing_progress',
      data: {
        smartuser_id: smartuserId,
        content_id: parseInt(episodeId),
        content_type: 'episode',
        is_completed: isNowCompleted,
        completion_percentage: completionPercentage,
        completed_at: isNowCompleted ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      onConflict: 'smartuser_id,content_id,content_type'
    });
    
    const { error } = await supabase
      .from('user_viewing_progress')
      .upsert({
        smartuser_id: smartuserId,
        content_id: parseInt(episodeId),
        content_type: 'episode',
        is_completed: isCompleted,
        completion_percentage: completionPercentage,
        completed_at: isCompleted ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'smartuser_id,content_id,content_type'
      });

    if (error) {
      console.error('📊 ❌ Error updating viewing progress:', error);
    } else {
      console.log('📊 ✅ Viewing progress updated successfully:', {
        episodeId,
        completionPercentage,
        isCompleted: isNowCompleted,
        operation: 'upsert'
      });

      // Track episode completion for gamification (only if completed for the first time in this session)
      if (isFirstTimeCompleted) {
        console.log('Auto close Reward 🎮 Episode completed for first time in session, adding to completed episodes:', episodeId);
        console.log('Auto close Reward 🎮 DEBUG: Before adding to completedEpisodesInSession set');
        setCompletedEpisodesInSession(prev => new Set([...prev, episodeId]));
        console.log('Auto close Reward 🎮 DEBUG: After adding to completedEpisodesInSession set');
      }
    }
  } catch (error) {
    console.error('📊 ❌ Unexpected error in updateViewingProgress:', error);
  }
};