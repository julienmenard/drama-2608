import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gift, Trophy, Star, User } from 'lucide-react-native';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { useGamification } from '@/hooks/useGamification';
import { useCampaignConfig } from '@/hooks/useCampaignConfig';
import { supabase } from '@/lib/supabase';
import type { GamificationEvent, UserAchievement } from '@/types';

export default function RewardsScreen() {
   const { t } = useTranslation();
   const { authState } = useAuth();
   const { userGamification: gamificationData, processEvent } = useGamification();
   const [activeTab, setActiveTab] = useState<'rewards' | 'ranking' | 'hall'>('rewards');
   const [events, setEvents] = useState<GamificationEvent[]>([]);
   const [achievements, setAchievements] = useState<UserAchievement[]>([]);
   const [loading, setLoading] = useState(true);
  const [dailyVisitBaseReward, setDailyVisitBaseReward] = useState(0);
   const { language } = useTranslation();
   const { isAvailable, isLoading: campaignLoading } = useCampaignConfig();

   useEffect(() => {
     if (authState.user?.smartuserId) {
       loadGamificationData();
       loadDailyVisitBaseReward();
     }
   }, [authState.user?.smartuserId]);

   const loadDailyVisitBaseReward = async () => {
     try {
       // Fetch the daily_visit event to get the base coins reward
       const { data: dailyVisitEvent, error } = await supabase
         .from('gamification_events')
         .select('coins_reward')
         .eq('event_type', 'daily_visit')
         .eq('is_active', true)
         .single();

       if (error) {
         console.error('Error loading daily visit base reward:', error);
         // Fallback to default value
         setDailyVisitBaseReward(20);
       } else if (dailyVisitEvent) {
         setDailyVisitBaseReward(dailyVisitEvent.coins_reward);
         console.log('Daily visit base reward loaded:', dailyVisitEvent.coins_reward);
       } else {
         // Fallback if no event found
         setDailyVisitBaseReward(20);
       }
     } catch (error) {
       console.error('Unexpected error loading daily visit base reward:', error);
       setDailyVisitBaseReward(20);
     }
   };

   const loadGamificationData = async () => {
    try {
      setLoading(true);
      
      if (!authState.user?.smartuserId) {
        return;
      }

      // Load events
      const { data: eventsData, error: eventsError } = await supabase
        .from('gamification_events')
        .select('*')
        .eq('is_active', true);

      if (eventsError) {
        console.error('Error loading events:', eventsError);
      } else {
        setEvents(eventsData || []);
      }

      // Load achievements
      const { data: achievementsData, error: achievementsError } = await supabase
        .from('user_achievements')
        .select('*')
        .eq('user_id', authState.user.smartuserId);

      if (achievementsError) {
        console.error('Error loading achievements:', achievementsError);
      } else {
        setAchievements(achievementsData || []);
      }
    } catch (error) {
      console.error('Error loading gamification data:', error);
    } finally {
      setLoading(false);
    }
   };
}