import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Platform } from 'react-native';
import { Play, Clock, Folder } from 'lucide-react-native';
import { router } from 'expo-router';
import type { SearchResult } from '@/services/contentService';
import { useTranslation } from '@/hooks/useTranslation';

interface SearchResultsProps {
  results: SearchResult[];
  loading: boolean;
  error: string | null;
  query: string;
  onPlaySeries?: (serieId: string) => void;
  onPlayEpisode?: (episodeId: string, serieId: string) => void;
}

export const SearchResults: React.FC<SearchResultsProps> = ({ 
  results, 
  loading, 
  error, 
  query,
  onPlaySeries,
  onPlayEpisode
}) => {
  const { t } = useTranslation();

  const handleResultPress = (result: SearchResult) => {
    if (Platform.OS === 'web') {
      switch (result.type) {
        case 'serie':
          onPlaySeries?.(result.id);
          break;
        case 'episode':
          if (result.serieId) {
            onPlayEpisode?.(result.id, result.serieId);
          }
          break;
      }
    } else {
      switch (result.type) {
        case 'serie':
          router.push(`/serie/${result.id}`);
          break;
        case 'episode':
          router.push(`/episode/${result.id}`);
          break;
      }
    }
  };

  const getResultIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'serie':
        return <Play size={16} color="#FF1B8D" />;
      case 'episode':
        return <Clock size={16} color="#00D4AA" />;
    }
  };

  const getResultTypeLabel = (type: SearchResult['type']) => {
    switch (type) {
      case 'serie':
        return 'Series';
      case 'episode':
        return 'Episode';
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>{t('loading')}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!query.trim()) {
    return null;
  }

  if (results.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.noResultsText}>
          {`No results found for "${query}"`}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.resultsHeader}>
        {`${results.length} result${results.length !== 1 ? 's' : ''} for "${query}"`}
      </Text>
      
      <ScrollView showsVerticalScrollIndicator={false} style={styles.resultsList}>
        {results.map((result) => (
          <TouchableOpacity
            key={`${result.type}-${result.id}`}
            style={styles.resultItem}
            onPress={() => handleResultPress(result)}
          >
            <Image source={{ uri: result.thumbnail }} style={styles.resultImage} />
            
            <View style={styles.resultContent}>
              <View style={styles.resultHeader}>
                <View style={styles.resultTypeContainer}>
                  {getResultIcon(result.type)}
                  <Text style={styles.resultType}>
                    {getResultTypeLabel(result.type)}
                  </Text>
                </View>
                {result.type === 'episode' && result.episodeNumber && (
                  <Text style={styles.episodeInfo}>
                    {result.seasonNumber ? `S${result.seasonNumber} ` : ''}
                    Episode {result.episodeNumber}
                  </Text>
                )}
              </View>
              
              <Text style={styles.resultTitle} numberOfLines={1}>
                {result.title}
              </Text>
              
              <Text style={styles.resultDescription} numberOfLines={2}>
                {result.description}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
  noResultsText: {
    color: '#888',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
  resultsHeader: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  resultsList: {
    flex: 1,
  },
  resultItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  resultImage: {
    width: 60,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  resultContent: {
    flex: 1,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  resultTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  resultType: {
    color: '#888',
    fontSize: 12,
    fontWeight: '500',
  },
  duration: {
    color: '#888',
    fontSize: 12,
  },
  resultTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  resultDescription: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  episodeInfo: {
    color: '#FF1B8D',
    fontSize: 12,
    fontWeight: '500',
  },
});