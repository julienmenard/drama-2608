import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Coins, Trophy, Crown, Star, CircleCheck as CheckCircle, Circle } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { useGamification } from '@/hooks/useGamification';
import { supabase } from '@/lib/supabase';
import { useCampaignConfig } from '@/hooks/useCampaignConfig';

interface GamificationEvent {
  id: string;
  event_type: string;
  event_type_category: string;
  event_position: number;
  title: string;
  description: string;
  coins_reward: number;
  is_active: boolean;
  metadata: any;
  event_categories?: {
    name: string;
    description: string;
  };
}

interface UserAchievement {
  id: string;
  achievement_type: string;
  coins_earned: number;
  created_at: string;
}

interface UserGamification {
  total_coins: number;
  consecutive_days_streak: number;
  last_visit_date: string;
}

export default function RewardsScreen() {
  const { t } = useTranslation();
  const { authState } = useAuth();
  const { userGamification: gamificationData, processEvent } = useGamification();
  const [activeTab, setActiveTab] = useState<'rewards' | 'ranking' | 'hall'>('rewards');
  const [events, setEvents] = useState<GamificationEvent[]>([]);
  const [achievements, setAchievements] = useState<UserAchievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupedEvents, setGroupedEvents] = useState<Record<string, { events: GamificationEvent[], position: number }>>({});
  const { language } = useTranslation();
  const { isAvailable, isLoading: campaignLoading } = useCampaignConfig();

  useEffect(() => {
    if (authState.user?.smartuserId) {
      loadGamificationData();
    }
  }, [authState.user?.smartuserId]);

  const loadGamificationData = async () => {
    if (!authState.user?.smartuserId) return;

    try {
      setLoading(true);

      // Load gamification events
      const { data: eventsData, error: eventsError } = await supabase
        .from('gamification_events')
        .select(`
          *,
          event_categories!left(
            name,
            description,
            category_position
          ),
          gamification_event_translations!left(
            title,
            description,
            message
          )
        `)
        .eq('is_active', true)
        .eq('gamification_event_translations.language_code', language)
        .order('event_position', { ascending: true });

      if (eventsError) {
        console.error('Error loading gamification events:', eventsError);
      } else {
        // Process events with translations
        const processedEvents = (eventsData || []).map(event => {
          const translations = (event as any).gamification_event_translations?.[0];
          return {
            ...event,
            title: translations?.title || event.title,
            description: translations?.description || event.description,
            translations: translations
          };
        });
        setEvents(processedEvents);
        
        // Group events by category
        const grouped = processedEvents.reduce((acc, event) => {
          const category = event.event_categories?.name || 'General';
          const categoryPosition = event.event_categories?.category_position || 999;
          if (!acc[category]) {
            acc[category] = {
              events: [],
              position: categoryPosition
            };
          }
          acc[category].events.push(event);
          return acc;
        }, {} as Record<string, { events: GamificationEvent[], position: number }>);
        
        // Sort events within each category by event_position
        Object.keys(grouped).forEach(category => {
          grouped[category].events.sort((a, b) => (a.event_position || 0) - (b.event_position || 0));
        });
        
        setGroupedEvents(grouped);
      }

      // Load user achievements
      const { data: achievementsData, error: achievementsError } = await supabase
        .from('user_achievements')
        .select('*')
        .eq('smartuser_id', authState.user.smartuserId)
        .order('created_at', { ascending: false });

      if (achievementsError) {
        console.error('Error loading user achievements:', achievementsError);
      } else {
        setAchievements(achievementsData || []);
      }

      // Load user gamification data
      const { data: gamificationData, error: gamificationError } = await supabase
        .from('user_gamification')
        .select('*')
        .eq('smartuser_id', authState.user.smartuserId);

      if (gamificationError) {
        console.error('Error loading user gamification:', gamificationError);
      } else {
        // Data is now managed by useGamification hook
      }
    } catch (error) {
      console.error('Error loading gamification data:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasCompletedEvent = (eventType: string): boolean => {
    return achievements.some(achievement => achievement.achievement_type === eventType);
  };

  const handleClaimReward = async (eventType: string) => {
    await processEvent(eventType);
    // Reload achievements to update UI
    await loadGamificationData();
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'daily_visit':
        return <Coins size={24} color="#FFD700" />;
      case 'watch_episode':
        return <Star size={24} color="#FF1B8D" />;
      case 'complete_series':
        return <Trophy size={24} color="#00D4AA" />;
      case 'weekly_streak':
        return <Crown size={24} color="#9333EA" />;
      default:
        return <Circle size={24} color="#888" />;
    }
  };

  // Dynamic daily streak display logic
  const getDailyStreakDisplay = () => {
    const currentStreak = gamificationData?.consecutive_days_streak || 0;
    const dailyVisitEvent = events.find(event => event.event_type === 'daily_visit');
    const baseCoins = dailyVisitEvent?.coins_reward || 20;
    
    let startDay = 1;
    let endDay = 7;
    let navigationText = '';
    
    if (currentStreak <= 7) {
      // First week: show days 1-7
      startDay = 1;
      endDay = 7;
      navigationText = t('firstWeek') || 'Week 1';
    } else if (currentStreak <= 14) {
      // Second week: show days 8-14
      startDay = 8;
      endDay = 14;
      navigationText = t('secondWeek') || 'Week 2';
    } else {
      // Long streaks: show rolling window of last 7 days
      startDay = currentStreak - 6;
      endDay = currentStreak;
      navigationText = `${t('days') || 'Days'} ${startDay}-${endDay}`;
    }
    
    const days = [];
    for (let i = startDay; i <= endDay; i++) {
      const isCompleted = i <= currentStreak;
      const isToday = i === currentStreak + 1 && !isCompleted;
      const coins = baseCoins * i;
      
      days.push({
        day: i,
        isCompleted,
        isToday,
        coins
      });
    }
    
    return { days, navigationText, showStreakSummary: currentStreak >= 15 };
  };

  const renderRewardsTab = () => {
    const { days, navigationText, showStreakSummary } = getDailyStreakDisplay();
    
    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        {/* Coins Display */}
        <View style={styles.coinsHeader}>
          <View style={styles.coinsDisplay}>
            <Text style={styles.coinsAmount}>{gamificationData?.total_coins || 0}</Text>
            <Text style={styles.coinsLabel}>{t('totalCoins')}</Text>
          </View>
          <View style={styles.streakDisplay}>
            <View style={styles.streakBadge}>
              <Text style={styles.streakText}>
                {gamificationData?.consecutive_days_streak || 0} {t('dayStreak')}
              </Text>
            </View>
          </View>
        </View>

        {/* Long Streak Summary */}
        {showStreakSummary && (
          <View style={styles.streakSummary}>
            <View style={styles.streakSummaryIcon}>
              <Text style={styles.streakSummaryEmoji}>🔥</Text>
            </View>
            <View style={styles.streakSummaryContent}>
              <Text style={styles.streakSummaryTitle}>
                {gamificationData?.consecutive_days_streak} {t('dayStreak')}
              </Text>
              <Text style={styles.streakSummarySubtitle}>
                {t('amazingStreak') || 'Amazing streak! Keep it up!'}
              </Text>
            </View>
          </View>
        )}

        {/* Daily Check-in */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('dailyCheckIn')}</Text>
          <View style={styles.dailyCheckIn}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.dailyScroll}
            >
              {days.map((dayData) => (
                <View key={dayData.day} style={styles.dailyItem}>
                  <View style={[
                    styles.dailyReward,
                    dayData.isCompleted && styles.dailyRewardCompleted,
                    dayData.isToday && styles.dailyRewardToday
                  ]}>
                    {dayData.isCompleted ? (
                      <CheckCircle size={24} color="#fff" />
                    ) : (
                      <Coins size={24} color={dayData.isToday ? "#FF1B8D" : "#888"} />
                    )}
                  </View>
                  <Text style={[
                    styles.dailyCoins,
                    dayData.isToday && styles.dailyCoinsToday
                  ]}>
                    +{dayData.coins}
                  </Text>
                  <Text style={[
                    styles.dailyLabel,
                    dayData.isToday && styles.dailyLabelToday
                  ]}>
                    {t('day')} {dayData.day}
                  </Text>
                  {dayData.isToday && (
                    <Text style={styles.todayIndicator}>{t('today') || 'Today'}</Text>
                  )}
                </View>
              ))}
            </ScrollView>
            
            {/* Navigation context */}
            <View style={styles.streakNavigation}>
              <Text style={styles.streakNavigationText}>
                {navigationText}
              </Text>
            </View>
          </View>
        </View>

        {/* Earn Rewards Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('earnRewards')}</Text>
          {Object.entries(groupedEvents)
            .sort(([, a], [, b]) => a.position - b.position)
            .map(([category, categoryData]) => (
            <View key={category} style={styles.categorySection}>
              <Text style={styles.categoryTitle}>{category}</Text>
              {categoryData.events.map((event) => {
                const completed = hasCompletedEvent(event.event_type);
                
                return (
                  <View key={event.id} style={styles.rewardItem}>
                    <View style={styles.rewardIcon}>
                      {getEventIcon(event.event_type)}
                    </View>
                    <View style={styles.rewardContent}>
                      <Text style={styles.rewardTitle}>{event.title}</Text>
                      <Text style={styles.rewardDescription}>{event.description}</Text>
                      <Text style={styles.rewardCoins}>+{event.coins_reward} Coin{event.coins_reward > 1 ? 's' : ''}</Text>
                    </View>
                    <Text style={[
                      styles.rewardStatusText,
                      completed && styles.rewardStatusTextCompleted
                    ]}>
                      {completed ? t('completed') : t('toDo')}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    );
  };

  const renderRankingTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.comingSoon}>{t('weeklyRanking')}</Text>
      <Text style={styles.comingSoonSubtext}>{t('comingSoon')}</Text>
    </View>
  );

  const renderHallOfFameTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.comingSoon}>{t('hallOfFame')}</Text>
      <Text style={styles.comingSoonSubtext}>{t('comingSoon')}</Text>
    </View>
  );

  if (loading || campaignLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAvailable) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>{t('rewardCenter')}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t('appNotAvailable')}</Text>
          <Text style={styles.comingSoonSubtext}>{t('appNotAvailableSubtext')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.desktopContainer}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('rewardCenter')}</Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'rewards' && styles.activeTab]}
          onPress={() => setActiveTab('rewards')}
        >
          <Text style={[styles.tabText, activeTab === 'rewards' && styles.activeTabText]}>
            {t('rewards')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'ranking' && styles.activeTab]}
          onPress={() => setActiveTab('ranking')}
        >
          <Text style={[styles.tabText, activeTab === 'ranking' && styles.activeTabText]}>
            {t('weeklyRanking')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'hall' && styles.activeTab]}
          onPress={() => setActiveTab('hall')}
        >
          <Text style={[styles.tabText, activeTab === 'hall' && styles.activeTabText]}>
            {t('hallOfFame')}
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'rewards' && renderRewardsTab()}
      {activeTab === 'ranking' && renderRankingTab()}
      {activeTab === 'hall' && renderHallOfFameTab()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  desktopContainer: {
    flex: 1,
    maxWidth: Platform.OS === 'web' ? 1024 : undefined,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 10,
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#2a2a2a',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#FF1B8D',
  },
  tabText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  activeTabText: {
    color: '#fff',
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  coinsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  coinsDisplay: {
    alignItems: 'flex-start',
  },
  coinsAmount: {
    color: '#FFD700',
    fontSize: 48,
    fontWeight: 'bold',
  },
  coinsLabel: {
    color: '#888',
    fontSize: 16,
    marginTop: -8,
  },
  streakDisplay: {
    alignItems: 'flex-end',
  },
  streakBadge: {
    backgroundColor: '#333',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  streakText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  dailyCheckIn: {
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 20,
  },
  dailyScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  dailyItem: {
    alignItems: 'center',
    marginRight: 16,
  },
  dailyReward: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#444',
  },
  dailyRewardCompleted: {
    backgroundColor: '#00D4AA',
    borderColor: '#00D4AA',
  },
  dailyCoins: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  dailyLabel: {
    color: '#888',
    fontSize: 12,
  },
  dailyRewardToday: {
    borderColor: '#FF1B8D',
    borderWidth: 3,
    shadowColor: '#FF1B8D',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  dailyCoinsToday: {
    color: '#FF1B8D',
    fontWeight: 'bold',
  },
  dailyLabelToday: {
    color: '#FF1B8D',
    fontWeight: '600',
  },
  todayIndicator: {
    color: '#FF1B8D',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  streakSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  streakSummaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  streakSummaryEmoji: {
    fontSize: 24,
  },
  streakSummaryContent: {
    flex: 1,
  },
  streakSummaryTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  streakSummarySubtitle: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '500',
  },
  streakNavigation: {
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  streakNavigationText: {
    color: '#888',
    fontSize: 12,
    fontStyle: 'italic',
  },
  rewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  rewardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  eventIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  rewardContent: {
    flex: 1,
  },
  rewardTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  rewardDescription: {
    color: '#888',
    fontSize: 14,
    marginBottom: 4,
  },
  rewardCoins: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '600',
  },
  rewardButton: {
    backgroundColor: '#FF1B8D',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  rewardButtonCompleted: {
    backgroundColor: '#00D4AA',
  },
  rewardButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  rewardButtonTextCompleted: {
    color: '#fff',
  },
  rewardStatusText: {
    color: '#FF1B8D',
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  rewardStatusTextCompleted: {
    color: '#00D4AA',
  },
  comingSoon: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 100,
  },
  comingSoonSubtext: {
    color: '#888',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryTitle: {
    color: '#FF1B8D',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    paddingLeft: 4,
  },
});