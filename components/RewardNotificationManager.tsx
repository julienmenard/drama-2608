import React from 'react';
import { View, StyleSheet } from 'react-native';
import { RewardNotificationComponent } from './RewardNotification';
import { useGamification } from '@/hooks/useGamification';

export const RewardNotificationManager: React.FC = () => {
  const { notifications, dismissNotification } = useGamification();

  // Only show new notifications
  const newNotifications = notifications.filter(n => n.isNew);

  console.log('🔔 RewardNotificationManager render:', {
    totalNotifications: notifications.length,
    newNotifications: newNotifications.length,
    notifications: notifications.map(n => ({ id: n.id, type: n.type, isNew: n.isNew }))
  });

  return (
    <View style={styles.container} pointerEvents="box-none">
      {newNotifications.map((notification, index) => (
        <View
          key={notification.id}
          style={[styles.notificationWrapper, { top: 60 + (index * 80) }]}
          pointerEvents="box-none"
        >
          {console.log('🔔 Rendering notification:', notification.id, notification.type)}
          <RewardNotificationComponent
            notification={notification}
            onDismiss={dismissNotification}
          />
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    elevation: 1000,
  },
  notificationWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 1000,
  },
});