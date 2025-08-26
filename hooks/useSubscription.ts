import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

export const useSubscription = () => {
  const { authState } = useAuth();
  const isMountedRef = useRef(true);
  const [isLoading, setIsLoading] = useState(true);

  // Derive isSubscribed directly from authState.user
  const isSubscribed = authState.user?.isSubscribed || false;

  useEffect(() => {
    isMountedRef.current = true;
    checkSubscriptionStatus();
    
    return () => {
      isMountedRef.current = false;
    };
  }, [authState.user?.smartuserId]);

  const checkSubscriptionStatus = async () => {
    if (!authState.user?.smartuserId) {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
      return;
    }

    try {
      // Query the users table to get the current is_paying status
      const { data: userData, error } = await supabase
        .from('users')
        .select('is_paying')
        .eq('smartuser_id', authState.user!.smartuserId)
        .single();

      if (error) {
        console.error('Error fetching subscription status:', error);
        // Just set loading to false, isSubscribed is derived from authState
        if (isMountedRef.current) {
          setIsLoading(false);
        }
        return;
      }
      
      // Note: The database result could be used to update the user object in authState
      // if needed, but for now we just complete the loading state
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error checking subscription status:', error);
      // Just set loading to false, isSubscribed is derived from authState
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const canAccessEpisode = (isFree: boolean): boolean => {
    if (isFree) return true;
    if (!authState.user) return false;
    return isSubscribed;
  };

  return {
    isSubscribed,
    isLoading,
    canAccessEpisode,
    checkSubscriptionStatus,
  };
};