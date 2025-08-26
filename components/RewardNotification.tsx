import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { Coins, X, Gift, Trophy } from 'lucide-react-native';
import type { RewardNotification } from '@/hooks/useGamification';

interface RewardNotificationProps {
  notification: RewardNotification;
  onDismiss: (id: string) => void;
}

const { width: screenWidth } = Dimensions.get('window');

export const RewardNotificationComponent: React.FC<RewardNotificationProps> = ({
  notification,
  onDismiss,
}) => {
  const [slideAnim] = useState(new Animated.Value(-screenWidth));
  const [fadeAnim] = useState(new Animated.Value(0));

  console.log('🔔 RewardNotificationComponent render:', {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    isNew: notification.isNew
  });

  useEffect(() => {
    console.log('🔔 Starting notification animation for:', notification.id);
    // Slide in animation
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => {
      console.log('🔔 Notification animation completed for:', notification.id);
    });

    // Auto dismiss after 5 seconds
    const timer = setTimeout(() => {
      console.log('🔔 Auto-dismissing notification after 5s:', notification.id);
      handleDismiss();
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    console.log('🔔 Handling dismiss for notification:', notification.id);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -screenWidth,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      console.log('🔔 Dismiss animation completed, calling onDismiss for:', notification.id);
      onDismiss(notification.id);
    });
  };

  const getIcon = () => {
    switch (notification.type) {
      case 'daily_visit':
        return <Gift size={24} color="#FFD700" />;
      case 'email_provided':
      case 'birth_date_provided':
      case 'complete_profile':
        return <Trophy size={24} color="#FFD700" />;
      default:
        return <Coins size={24} color="#FFD700" />;
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateX: slideAnim }],
          opacity: fadeAnim,
        },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          {getIcon()}
        </View>
        
        <View style={styles.textContainer}>
          <Text style={styles.title}>{notification.title}</Text>
          <Text style={styles.message}>{notification.message}</Text>
          
          <View style={styles.coinsContainer}>
            <Coins size={16} color="#FFD700" />
            <Text style={styles.coinsText}>+{notification.coins}</Text>
          </View>
        </View>
        
        <TouchableOpacity onPress={handleDismiss} style={styles.closeButton}>
          <X size={20} color="#666" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    zIndex: 1000,
    elevation: 1000,
  },
  content: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  message: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 8,
  },
  coinsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  coinsText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
    marginLeft: 8,
  },
});