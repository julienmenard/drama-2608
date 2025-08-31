import React from 'react';
import { Platform } from 'react-native';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Play, Clock, Heart } from 'lucide-react-native';
import { Serie } from '@/types';
import { useSubscription } from '@/hooks/useSubscription';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { router } from 'expo-router';

interface SerieCardProps {
  serie: Serie;
  onPress: () => void;
  variant?: 'vertical' | 'horizontal';
  showFavoriteButton?: boolean;
  enableDirectPlay?: boolean;
  onPlaySeries?: (serieId: string) => void;
}

export const SerieCard: React.FC<SerieCardProps> = ({ 
  serie, 
  onPress, 
  variant = 'vertical',
  showFavoriteButton = false,
  enableDirectPlay = false,
  onPlaySeries
}) => {
  const { toggleFavorite, isFavorite } = useFavorites();
  const { authState } = useAuth();
  const { t } = useTranslation();
  const [isFav, setIsFav] = React.useState(false);

  React.useEffect(() => {
    const checkFavoriteStatus = async () => {
      if (authState.user?.smartuserId && showFavoriteButton) {
        const favStatus = await isFavorite(parseInt(serie.id), 'serie');
        setIsFav(favStatus);
      }
    };
    checkFavoriteStatus();
  }, [serie.id, authState.user?.smartuserId, showFavoriteButton]);

  const handleFavoritePress = async () => {
    if (!authState.user) {
      Alert.alert(t('signInRequired'), t('pleaseSignInToWatch'));
      return;
    }

    const success = await toggleFavorite(parseInt(serie.id), 'serie');
    if (success) {
      setIsFav(!isFav);
    }
  };

  const handlePlayPress = (e: any) => {
    e.stopPropagation();
    onPress();
  };
  return (
    <TouchableOpacity 
      style={[styles.container, variant === 'horizontal' && styles.horizontal]} 
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.imageContainer, variant === 'horizontal' && styles.horizontalImage]}>
        <Image source={{ uri: serie.thumbnail }} style={styles.image} />
        
        {/* Badges */}
        <View style={styles.badges}>
          {serie.isTrending && (
            <View style={[styles.badge, styles.trendingBadge]}>
              <Text style={styles.badgeText}>Trending</Text>
            </View>
          )}
          {serie.isNew && (
            <View style={[styles.badge, styles.newBadge]}>
              <Text style={styles.badgeText}>New</Text>
            </View>
          )}
        </View>

        {/* Play button overlay */}
        <View style={styles.playOverlay}>
          <TouchableOpacity style={styles.playButton} onPress={handlePlayPress}>
            <Play size={20} color="#fff" fill="#fff" />
          </TouchableOpacity>
          
          {/* Favorite button */}
          {showFavoriteButton && (
            <TouchableOpacity 
              style={styles.favoriteButton}
              onPress={handleFavoritePress}
            >
              <Heart 
                size={16} 
                color={isFav ? "#FF1B8D" : "#fff"} 
                fill={isFav ? "#FF1B8D" : "transparent"}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Duration indicator */}
        <View style={styles.duration}>
          <Clock size={12} color="#fff" />
          <Text style={styles.durationText}>
            {serie.totalSeasons} Season{serie.totalSeasons > 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      <View style={[styles.content, variant === 'horizontal' && styles.horizontalContent]}>
        <Text style={styles.title} numberOfLines={2}>
          {serie.title}
        </Text>
        <Text style={styles.description} numberOfLines={2}>
          {serie.description}
        </Text>
        <View style={styles.rating}>
          <Text style={styles.ratingText}>★ {serie.rating}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginRight: 12,
    width: 128,
  },
  horizontal: {
    flexDirection: 'row',
    width: '100%',
    marginRight: 0,
    marginBottom: 16,
  },
  imageContainer: {
    width: 128,
    height: 192,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  horizontalImage: {
    width: 96,
    height: 144,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  badges: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    gap: 4,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  trendingBadge: {
    backgroundColor: '#FF1B8D',
  },
  newBadge: {
    backgroundColor: '#00D4AA',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  duration: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
  },
  durationText: {
    color: '#fff',
    fontSize: 10,
  },
  content: {
    marginTop: 8,
  },
  horizontalContent: {
    flex: 1,
    marginTop: 0,
    marginLeft: 12,
    justifyContent: 'flex-start',
  },
  title: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  description: {
    color: '#888',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 4,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '600',
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});