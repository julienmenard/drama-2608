import { Tabs } from 'expo-router';
import { Chrome as Home, Play, Bookmark, User } from 'lucide-react-native';
import { View, StyleSheet, Platform } from 'react-native';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';

export default function TabLayout() {
  const { t } = useTranslation();
  const { authState } = useAuth();
  const [isPlayerVisible, setIsPlayerVisible] = useState(false);

  // Listen for player visibility changes on web
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handlePlayerVisibilityChange = (event: CustomEvent) => {
      setIsPlayerVisible(event.detail.isVisible);
    };

    // Listen for custom events from the player
    window.addEventListener('playerVisibilityChanged', handlePlayerVisibilityChange as EventListener);

    return () => {
      window.removeEventListener('playerVisibilityChanged', handlePlayerVisibilityChange as EventListener);
    };
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: [
          styles.tabBar,
          isPlayerVisible && Platform.OS === 'web' && { display: 'none' }
        ],
        tabBarActiveTintColor: '#FF1B8D',
        tabBarInactiveTintColor: '#666',
        tabBarLabelStyle: styles.tabBarLabel,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('home'),
          tabBarIcon: ({ size, color }) => (
            <Home size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="foryou"
        options={{
          title: t('forYou'),
          tabBarIcon: ({ size, color }) => (
            <Play size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="mylist"
        options={{
          title: t('myList'),
          tabBarIcon: ({ size, color }) => (
            <Bookmark size={size} color={color} />
          ),
          href: authState.user ? '/mylist' : null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('profile'),
          tabBarIcon: ({ size, color }) => (
            <User size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#1a1a1a',
    borderTopColor: '#333',
    borderTopWidth: 1,
    ...Platform.select({
      web: {
        paddingBottom: 0,
        height: 70,
      },
      default: {},
    }),
  },
  tabBarLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
});