import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

export const handleSignIn = (
  setShowSignInModal: (show: boolean) => void,
  onClose: () => void,
  seriesId: string,
  episodes: any[],
  currentEpisodeIndex: number
) => {
  setShowSignInModal(false);
  // Store the target premium episode info in localStorage for return after sign-in
  if (typeof window !== 'undefined') {
    const returnData = {
      seriesId,
      episodeId: episodes[currentEpisodeIndex]?.id, // This will be the premium episode they're trying to access
      timestamp: Date.now()
    };
    localStorage.setItem('playerReturnData', JSON.stringify(returnData));
  }
  onClose(); // Close the player
  router.push('/login');
};

export const handleSubscribe = (
  setShowSubscriptionModal: (show: boolean) => void,
  updateSubscriptionStatus: () => Promise<void>
) => {
  setShowSubscriptionModal(false);
  updateSubscriptionStatus();
};

export const updateSubscriptionStatus = async (
  smartuserId: string,
  updateUserSubscription: (isSubscribed: boolean) => void,
  playNextEpisode: (forceAccess?: boolean) => void
) => {
  if (!smartuserId) return;

  try {
    console.log('Updating subscription status for user:', smartuserId);
    
    // Update user subscription status in database
    const { error } = await supabase
      .from('users')
      .update({ 
        is_paying: true,
        updated_at: new Date().toISOString()
      })
      .eq('smartuser_id', smartuserId);

    if (error) {
      console.error('Error updating subscription status:', error);
      return;
    }

    console.log('Subscription status updated successfully');
    
    // Update local auth state to reflect subscription change
    updateUserSubscription(true);
    
    // Play the next episode after subscription with forced access
    playNextEpisode(true);
    
  } catch (error) {
    console.error('Error in updateSubscriptionStatus:', error);
  }
};