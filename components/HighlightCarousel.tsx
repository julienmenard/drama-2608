import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import { Platform } from 'react-native';
import { Play } from 'lucide-react-native';
import { router } from 'expo-router';
import { Serie } from '@/types';

const { width: screenWidth } = Dimensions.get('window');

interface HighlightCarouselProps {
  highlightSeries: Serie[];
  highlightLoading: boolean;
  onPlaySeries?: (serieId: string) => void;
  onNavigateToFirstSeason?: (serieId: string) => Promise<void>;
}

export const HighlightCarousel: React.FC<HighlightCarouselProps> = ({
  highlightSeries,
  highlightLoading,
  onPlaySeries,
  onNavigateToFirstSeason
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  // Auto-slide effect for highlight carousel
  useEffect(() => {
    if (highlightSeries.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentSlide((prevSlide) => {
        const nextSlide = (prevSlide + 1) % highlightSeries.length;
        scrollViewRef.current?.scrollTo({
          x: nextSlide * screenWidth,
          animated: true,
        });
        return nextSlide;
      });
    }, 4000); // Change slide every 4 seconds

    return () => clearInterval(interval);
  }, [highlightSeries.length]);

  // Don't render if loading or no series
  if (highlightLoading || highlightSeries.length === 0) {
    return null;
  }

  return (
    <View style={styles.featuredContainer}>
      <ScrollView 
        ref={scrollViewRef}
        horizontal 
        pagingEnabled 
        showsHorizontalScrollIndicator={false}
        style={styles.featuredScroll}
        onMomentumScrollEnd={(event) => {
          const slideIndex = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
          setCurrentSlide(slideIndex);
        }}
      >
        {highlightSeries.map((serie) => (
          <TouchableOpacity
            key={serie.id}
            style={styles.featured}
            onPress={() => {
              if (Platform.OS === 'web' && onPlaySeries) {
                onPlaySeries(serie.id);
              } else {
                onNavigateToFirstSeason?.(serie.id);
              }
            }}
          >
            <Image source={{ uri: serie.thumbnail }} style={styles.featuredImage} />
            <View style={styles.featuredOverlay}>
              <View style={styles.featuredBadge}>
                <Text style={styles.featuredBadgeText}>Highlight</Text>
              </View>
              <Text style={styles.featuredTitle}>{serie.title}</Text>
              <View style={styles.featuredPlayButton}>
                <Play size={16} color="#fff" fill="#fff" />
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  featuredContainer: {
    marginBottom: 30,
  },
  featuredScroll: {
    marginHorizontal: 20,
  },
  featured: {
    width: screenWidth - 40,
    marginRight: 0,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    height: 400,
  },
  featuredImage: {
    width: '100%',
    height: '100%',
  },
  featuredOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  featuredBadge: {
    backgroundColor: '#FF1B8D',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  featuredBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  featuredTitle: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  featuredPlayButton: {
    position: 'absolute',
    right: 20,
    bottom: 60,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF1B8D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featuredDuration: {
    position: 'absolute',
    right: 20,
    bottom: 20,
  },
  featuredDurationText: {
    color: '#ccc',
    fontSize: 14,
  },
});