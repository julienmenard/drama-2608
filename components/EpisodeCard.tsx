import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Play, Lock, Clock, Heart } from 'lucide-react-native';
import { Episode } from '@/types';
import { useSubscription } from '@/hooks/useSubscription';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';

interface EpisodeCardProps {
  episode: Episode;
  onPress: () => void;
  showFavoriteButton?: boolean;
}

export const EpisodeCard: React.FC<EpisodeCardProps> = ({ 
  episode, 
  onPress, 
  showFavoriteButton = false 
}) => {
  const { canAccessEpisode } = useSubscription();
  const { toggleFavorite, isFavorite } = useFavorites();
  const { authState } = useAuth();
  const { t } = useTranslation();
  const isAccessible = canAccessEpisode(episode.is_free);
  const [isFav, setIsFav] = React.useState(false);

  React.useEffect(() => {
    const checkFavoriteStatus = async () => {
      if (authState.user?.smartuserId && showFavoriteButton) {
        const favStatus = await isFavorite(parseInt(episode.id), 'episode');
        setIsFav(favStatus);
      }
    };
    checkFavoriteStatus();
  }, [episode.id, authState.user?.smartuserId, showFavoriteButton]);

  const handleFavoritePress = async () => {
    if (!authState.user) {
      Alert.alert(t('signInRequired'), t('pleaseSignInToWatch'));
      return;
    }

    const success = await toggleFavorite(parseInt(episode.id), 'episode');
    if (success) {
      setIsFav(!isFav);
    }
  };

  return (
    <TouchableOpacity 
      style={[styles.container, !isAccessible && styles.locked]} 
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.imageContainer}>
        <Image source={{ uri: episode.thumbnail }} style={styles.image} />
        
        {/* Lock overlay for premium episodes */}
        {!isAccessible && (
          <View style={styles.lockOverlay}>
            <View style={styles.lockIcon}>
              <Lock size={20} color="#FF1B8D" />
            </View>
          </View>
        )}

        {/* Play button */}
        {isAccessible && (
          <View style={styles.playOverlay}>
            <View style={styles.playButton}>
              <Play size={16} color="#fff" fill="#fff" />
            </View>
          </View>
        )}

        {/* Duration */}
        <View style={styles.duration}>
          <Clock size={10} color="#fff" />
          <Text style={styles.durationText}>{episode.duration}m</Text>
        </View>

        {/* Episode number */}
        <View style={styles.episodeNumber}>
          <Text style={styles.episodeNumberText}>{episode.episodeNumber}</Text>
        </View>

        {/* Favorite button */}
        {showFavoriteButton && (
          <TouchableOpacity 
            style={styles.favoriteButton}
            onPress={handleFavoritePress}
          >
            <Heart 
              size={12} 
              color={isFav ? "#FF1B8D" : "#fff"} 
              fill={isFav ? "#FF1B8D" : "transparent"}
            />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {episode.title}
        </Text>
        <Text style={styles.description} numberOfLines={2}>
          {episode.description}
        </Text>
        {episode.is_free && (
          <Text style={styles.freeTag}>Free</Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 80,
    marginRight: 12,
  },
  locked: {
    opacity: 0.7,
  },
  imageContainer: {
    width: 80,
    height: 112,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#333',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  playButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  duration: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    gap: 2,
  },
  durationText: {
    color: '#fff',
    fontSize: 8,
  },
  episodeNumber: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: '#FF1B8D',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },
  episodeNumberText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '600',
  },
  content: {
    marginTop: 6,
  },
  title: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  description: {
    color: '#888',
    fontSize: 10,
    lineHeight: 14,
    marginBottom: 4,
  },
  freeTag: {
    color: '#00D4AA',
    fontSize: 10,
    fontWeight: '600',
  },
  favoriteButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});