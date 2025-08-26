import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import { useTranslation } from './useTranslation';

export interface GamificationEvent {
  id: string;
  event_type: string;
  title: string;
  description: string;
  coins_reward: number;
  is_active: boolean;
  metadata: any;
  translations?: {
    title: string;
    description: string;
    message: string;
  };
}

export interface UserAchievement {
  id: string;
  smartuser_id: string;
  achievement_type: string;
  coins_earned: number;
  metadata: any;
  created_at: string;
}

export interface UserGamification {
  smartuser_id: string;
  total_coins: number;
  consecutive_days_streak: number;
  last_visit_date: string;
}

export interface RewardNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  coins: number;
  timestamp: Date;
  isNew: boolean;
}

interface GamificationContextType {
  notifications: RewardNotification[];
  userGamification: UserGamification | null;
  isLoading: boolean;
  processEvent: (eventType: string, metadata?: any) => Promise<void>;
  dismissNotification: (notificationId: string) => void;
  clearNotifications: () => void;
}

const GamificationContext = createContext<GamificationContextType | null>(null);

export const GamificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { authState } = useAuth();
  const { language } = useTranslation();
  const [notifications, setNotifications] = useState<RewardNotification[]>([]);
  const [userGamification, setUserGamification] = useState<UserGamification | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const hasProcessedDailyVisit = useRef(false);

  console.log('🎮 GamificationProvider: Component rendered');

  // Process daily visit when user is authenticated
  useEffect(() => {
    console.log('🎮 GamificationProvider: Daily visit useEffect triggered', {
      hasUser: !!authState.user?.smartuserId,
      hasProcessed: hasProcessedDailyVisit.current,
      smartuserId: authState.user?.smartuserId
    });
    
    if (authState.user?.smartuserId && !hasProcessedDailyVisit.current) {
      console.log('🎮 GamificationProvider: Conditions met, calling processDailyVisit');
      hasProcessedDailyVisit.current = true;
      processDailyVisit();
    } else {
      console.log('🎮 GamificationProvider: Daily visit conditions NOT met', {
        hasUser: !!authState.user?.smartuserId,
        hasProcessed: hasProcessedDailyVisit.current
      });
    }
  }, [authState.user?.smartuserId]);

  const processDailyVisit = async () => {
    console.log('🎮 GamificationProvider: processDailyVisit() called');
    
    if (!authState.user?.smartuserId) return;

    try {
      setIsLoading(true);
      console.log('🎮 Processing daily visit for user:', authState.user.smartuserId);

      // Get or create user gamification record
      let { data: gamificationData, error: gamificationError } = await supabase
        .from('user_gamification')
        .select('*')
        .eq('smartuser_id', authState.user.smartuserId);

      if (gamificationError) {
        console.error('Error fetching user gamification:', gamificationError);
        return;
      }

      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      let currentGamification = gamificationData && gamificationData.length > 0 ? gamificationData[0] : null;

      // Check if user already visited today
      if (currentGamification?.last_visit_date === today) {
        console.log('🎮 User already visited today, skipping daily visit reward');
        setUserGamification(currentGamification);
        return;
      }

      // Get daily_visit event
      const { data: dailyEvent, error: eventError } = await supabase
        .from('gamification_events')
        .select(`
          *,
          gamification_event_translations!inner(
            title,
            description,
            message
          )
        `)
        .eq('event_type', 'daily_visit')
        .eq('is_active', true)
        .eq('gamification_event_translations.language_code', language);

      let dailyEventRecord = dailyEvent && dailyEvent.length > 0 ? dailyEvent[0] : null;
      
      // If no translation found for current language, fallback to English
      if (!dailyEventRecord) {
        const { data: fallbackEvent } = await supabase
          .from('gamification_events')
          .select(`
            *,
            gamification_event_translations!inner(
              title,
              description,
              message
            )
          `)
          .eq('event_type', 'daily_visit')
          .eq('is_active', true)
          .eq('gamification_event_translations.language_code', 'en');
        
        dailyEventRecord = fallbackEvent && fallbackEvent.length > 0 ? fallbackEvent[0] : null;
      }
      
      if (eventError || !dailyEventRecord) {
        console.warn('Daily visit event not found or inactive. Skipping daily visit processing.');
        return;
      }

      // Calculate streak
      let newStreak = 1;
      if (currentGamification) {
        const lastVisit = new Date(currentGamification.last_visit_date);
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        // If last visit was yesterday, increment streak
        if (lastVisit.toISOString().split('T')[0] === yesterday.toISOString().split('T')[0]) {
          newStreak = currentGamification.consecutive_days_streak + 1;
        }
      }

      // Calculate coins earned (streak * base reward)
      const coinsEarned = newStreak * dailyEventRecord.coins_reward;

      // Update or create user gamification record
      const updatedGamification = {
        smartuser_id: authState.user.smartuserId,
        total_coins: (currentGamification?.total_coins || 0) + coinsEarned,
        consecutive_days_streak: newStreak,
        last_visit_date: today,
        updated_at: new Date().toISOString(),
      };

      if (currentGamification) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('user_gamification')
          .update(updatedGamification)
          .eq('smartuser_id', authState.user.smartuserId);

        if (updateError) {
          console.error('Error updating user gamification:', updateError);
          return;
        }
      } else {
        // Create new record
        const { error: insertError } = await supabase
          .from('user_gamification')
          .insert({
            ...updatedGamification,
            created_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error('Error creating user gamification:', insertError);
          return;
        }
      }

      // Record achievement
      const { error: achievementError } = await supabase
        .from('user_achievements')
        .insert({
          smartuser_id: authState.user.smartuserId,
          achievement_type: 'daily_visit',
          coins_earned: coinsEarned,
          metadata: {
            streak: newStreak,
            date: today,
          },
          created_at: new Date().toISOString(),
        });

      if (achievementError) {
        console.error('Error recording achievement:', achievementError);
        // Don't return here - continue with local state updates even if achievement recording fails
      }

      // Update local state
      setUserGamification(updatedGamification);

      // Get translated content
      const translations = (dailyEventRecord as any).gamification_event_translations?.[0];
      const eventTitle = translations?.title || dailyEventRecord.title;
      const eventMessage = translations?.message || `You earned ${coinsEarned} coins for your daily visit`;

      // Show notification
      const notification: RewardNotification = {
        id: `daily_visit_${Date.now()}`,
        type: 'daily_visit',
        title: newStreak === 1 ? eventTitle : `${newStreak} day streak!`,
        message: eventMessage.replace('{coins}', coinsEarned.toString()),
        coins: coinsEarned,
        timestamp: new Date(),
        isNew: true,
      };

      console.log('🔔 GamificationProvider: Creating daily visit notification:', notification);
      setNotifications(prev => {
        const updated = [notification, ...prev];
        console.log('🔔 GamificationProvider: Daily visit notifications state updated, current notifications:', updated.length);
        return updated;
      });

      console.log('🎮 Daily visit processed successfully:', {
        streak: newStreak,
        coinsEarned,
        totalCoins: updatedGamification.total_coins,
      });

    } catch (error) {
      console.error('Error processing daily visit:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const processEvent = async (eventType: string, metadata: any = {}) => {
    if (!authState.user?.smartuserId) return;

    try {
      console.log('🎮 GamificationProvider: Processing event:', eventType);
      console.log('🎮 DEBUG: processEvent called with:', {
        eventType,
        metadata,
        smartuserId: authState.user?.smartuserId,
        language
      });

      // Handle batched episode completion notification
      if (eventType === 'episodes_batch_completed') {
        console.log('Auto close Reward 🎮 DEBUG: Processing episodes_batch_completed event');
        const episodeCount = metadata.episodeCount || 1;
        console.log('Auto close Reward 🎮 DEBUG: Episode count for batch:', episodeCount);
        
        // Get episode_completed event details for coin calculation
        const { data: episodeEvent, error: episodeEventError } = await supabase
          .from('gamification_events')
          .select(`
            *,
            gamification_event_translations!inner(
              title,
              description,
              message
            )
          `)
          .eq('event_type', 'episode_completed')
          .eq('is_active', true)
          .eq('gamification_event_translations.language_code', language);

        console.log('Auto close Reward 🎮 DEBUG: Episode event query result:', {
          data: episodeEvent,
          error: episodeEventError,
          language
        });
        let episodeEventRecord = episodeEvent && episodeEvent.length > 0 ? episodeEvent[0] : null;
        
        // Fallback to English if no translation found
        if (!episodeEventRecord) {
          console.log('Auto close Reward 🎮 DEBUG: No event found for language, trying English fallback...');
          const { data: fallbackEvent } = await supabase
            .from('gamification_events')
            .select(`
              *,
              gamification_event_translations!inner(
                title,
                description,
                message
              )
            `)
            .eq('event_type', 'episode_completed')
            .eq('is_active', true)
            .eq('gamification_event_translations.language_code', 'en');
          
          console.log('Auto close Reward 🎮 DEBUG: English fallback query result:', fallbackEvent);
          episodeEventRecord = fallbackEvent && fallbackEvent.length > 0 ? fallbackEvent[0] : null;
        }
        
        if (episodeEventRecord) {
          console.log('Auto close Reward 🎮 DEBUG: Found episode event record, creating notification...');
          const totalCoinsEarned = episodeCount * episodeEventRecord.coins_reward;
          const translations = (episodeEventRecord as any).gamification_event_translations?.[0];
          const eventTitle = translations?.title || episodeEventRecord.title;
          
          // Create batched notification message
          const batchedMessage = episodeCount === 1 
            ? (translations?.message || `You earned ${totalCoinsEarned} coins for watching an episode!`)
            : `${episodeCount} episodes completed! You earned ${totalCoinsEarned} coins!`;

          console.log('Auto close Reward 🎮 DEBUG: Creating batched notification with:', {
            totalCoinsEarned,
            eventTitle,
            batchedMessage,
            episodeCount
          });
          // Show single notification for all completed episodes
          const notification: RewardNotification = {
            id: `episodes_batch_${Date.now()}`,
            type: 'episode_completed',
            title: episodeCount === 1 ? eventTitle : `${episodeCount} Episodes Completed!`,
            message: batchedMessage.replace('{coins}', totalCoinsEarned.toString()),
            coins: totalCoinsEarned,
            timestamp: new Date(),
            isNew: true,
          };

          console.log('🔔 GamificationProvider: Creating batched episode completion notification:', notification);
          console.log('Auto close Reward 🎮 DEBUG: About to update notifications state...');
          setNotifications(prev => {
            const updated = [notification, ...prev];
            console.log('🔔 GamificationProvider: Batched notifications state updated, current notifications:', updated.length);
            console.log('Auto close Reward 🎮 DEBUG: Notifications state updated successfully, new count:', updated.length);
            return updated;
          });
        } else {
          console.log('Auto close Reward 🎮 DEBUG: No episode event record found, cannot create notification');
        }
        
        console.log('Auto close Reward 🎮 DEBUG: episodes_batch_completed processing completed, returning early');
        return; // Exit early for batched notifications
      }

      // Get event details
      const { data: event, error: eventError } = await supabase
        .from('gamification_events')
        .select(`
          *,
          gamification_event_translations!inner(
            title,
            description,
            message
          )
        `)
        .eq('event_type', eventType)
        .eq('is_active', true)
        .eq('gamification_event_translations.language_code', language);

      let eventRecord = event && event.length > 0 ? event[0] : null;
      
      // If no translation found for current language, fallback to English
      if (!eventRecord) {
        const { data: fallbackEvent } = await supabase
          .from('gamification_events')
          .select(`
            *,
            gamification_event_translations!inner(
              title,
              description,
              message
            )
          `)
          .eq('event_type', eventType)
          .eq('is_active', true)
          .eq('gamification_event_translations.language_code', 'en');
        
        eventRecord = fallbackEvent && fallbackEvent.length > 0 ? fallbackEvent[0] : null;
      }
      
      if (eventError || !eventRecord) {
        console.error(`Gamification event '${eventType}' not found for language '${language}' or English fallback`);
        return;
      }

      // Check if user already completed this event (for one-time events, check all time; for daily events, check today)
      const isOneTimeEvent = eventRecord.metadata?.one_time === true;
      const today = new Date().toISOString().split('T')[0];
      
      let achievementQuery = supabase
        .from('user_achievements')
        .select('*')
        .eq('smartuser_id', authState.user.smartuserId)
        .eq('achievement_type', eventType);

     // For episode_completed events, check uniqueness by episode ID
     if (eventType === 'episode_completed' && metadata?.episodeId) {
       achievementQuery = achievementQuery.eq('metadata->>episodeId', metadata.episodeId);
     }
      // For daily events, only check today; for one-time events, check all time
     if (!isOneTimeEvent && eventType !== 'episode_completed') {
        achievementQuery = achievementQuery
          .gte('created_at', `${today}T00:00:00.000Z`)
          .lt('created_at', `${today}T23:59:59.999Z`);
      }

      const { data: existingAchievement } = await achievementQuery;

      if (existingAchievement && existingAchievement.length > 0) {
        console.log(`🎮 Event already completed ${isOneTimeEvent ? 'before' : 'today'}:`, eventType);
        return;
      }

      // Get current user gamification
      const { data: gamificationData } = await supabase
        .from('user_gamification')
        .select('*')
        .eq('smartuser_id', authState.user.smartuserId);

      const currentGamification = gamificationData && gamificationData.length > 0 ? gamificationData[0] : null;
      const coinsEarned = eventRecord.coins_reward;

      // Update user coins
      const updatedGamification = {
        smartuser_id: authState.user.smartuserId,
        total_coins: (currentGamification?.total_coins || 0) + coinsEarned,
        consecutive_days_streak: currentGamification?.consecutive_days_streak || 0,
        last_visit_date: currentGamification?.last_visit_date || today,
        updated_at: new Date().toISOString(),
      };

      if (currentGamification) {
        await supabase
          .from('user_gamification')
          .update(updatedGamification)
          .eq('smartuser_id', authState.user.smartuserId);
      } else {
        await supabase
          .from('user_gamification')
          .insert({
            ...updatedGamification,
            created_at: new Date().toISOString(),
          });
      }

      // Record achievement
      await supabase
        .from('user_achievements')
        .insert({
          smartuser_id: authState.user.smartuserId,
          achievement_type: eventType,
          coins_earned: coinsEarned,
          metadata: metadata,
          created_at: new Date().toISOString(),
        });

      // Update local state
      setUserGamification(updatedGamification);

      // Show notification only if not suppressed (for individual episode events, we suppress to show batched notification)
      if (!metadata.suppressNotification) {
        // Get translated content
        const translations = (eventRecord as any).gamification_event_translations?.[0];
        const eventTitle = translations?.title || eventRecord.title;
        const eventMessage = translations?.message || `You earned ${coinsEarned} coins!`;

        // Show notification
        const notification: RewardNotification = {
          id: `${eventType}_${Date.now()}`,
          type: eventType,
          title: eventTitle,
          message: eventMessage.replace('{coins}', coinsEarned.toString()),
          coins: coinsEarned,
          timestamp: new Date(),
          isNew: true,
        };

        console.log('🔔 GamificationProvider: Creating notification:', notification);
        setNotifications(prev => {
          const updated = [notification, ...prev];
          console.log('🔔 GamificationProvider: Notifications state updated, current notifications:', updated.length);
          return updated;
        });
      }

      console.log('🎮 Event processed successfully:', {
        eventType,
        coinsEarned,
        totalCoins: updatedGamification.total_coins,
      });

    } catch (error) {
      console.error('Error processing event:', error);
    }
  };

  const dismissNotification = (notificationId: string) => {
    console.log('🔔 GamificationProvider: Dismissing notification:', notificationId);
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === notificationId 
          ? { ...notification, isNew: false }
          : notification
      )
    );
    console.log('🔔 GamificationProvider: Notification dismissed');
  };

  const clearNotifications = () => {
    console.log('🔔 GamificationProvider: Clearing all notifications');
    setNotifications([]);
  };

  const contextValue: GamificationContextType = {
    notifications,
    userGamification,
    isLoading,
    processEvent,
    dismissNotification,
    clearNotifications,
  };

  return (
    <GamificationContext.Provider value={contextValue}>
      {children}
    </GamificationContext.Provider>
  );
};

export const useGamification = () => {
  const context = useContext(GamificationContext);
  if (!context) {
    throw new Error('useGamification must be used within a GamificationProvider');
  }
  return context;
};