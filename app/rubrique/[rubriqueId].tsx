import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { SerieCard } from '@/components/SerieCard';
import { useRubriques, useSeriesByRubrique } from '@/hooks/useContent';
import { ContentService } from '@/services/contentService';
import { useCampaignConfig } from '@/hooks/useCampaignConfig';
import { useTranslation } from '@/hooks/useTranslation';

export default function RubriqueScreen() {
  const { rubriqueId } = useLocalSearchParams<{ rubriqueId: string }>();
  const { t } = useTranslation();
  const { campaignCountriesLanguagesId, isLoading: campaignLoading, isAvailable } = useCampaignConfig();
  const { rubriques } = useRubriques(campaignCountriesLanguagesId);
  const { series: rubriqueSeries, loading } = useSeriesByRubrique(campaignCountriesLanguagesId, rubriqueId || '');
  
  const rubrique = rubriques.find(r => r.id === rubriqueId);

  // Handle navigation to first season of a series
  const handleNavigateToFirstSeason = async (seriesId: string) => {
    try {
      const firstSeasonData = await ContentService.getFirstSeasonIdForSeries(campaignCountriesLanguagesId, seriesId);
      if (firstSeasonData) {
        router.push(`/saison/${firstSeasonData.seasonId}?seriesId=${firstSeasonData.seriesId}&seasonPosition=${firstSeasonData.seasonPosition}`);
      } else {
        Alert.alert(t('error'), t('seasonNotFound'));
      }
    } catch (error) {
      console.error('Error navigating to first season:', error);
      Alert.alert(t('error'), t('seasonNotFound'));
    }
  };

  if (campaignLoading) {
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
          <Text style={styles.title}>{t('appNotAvailable')}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t('appNotAvailable')}</Text>
          <Text style={styles.loadingText}>{t('appNotAvailableSubtext')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!rubrique) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.error}>{t('rubriqueNotFound')}</Text>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>{rubrique.name}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{rubrique.name}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.content}>
        <Text style={styles.description}>{rubrique.description}</Text>
        
        <View style={styles.grid}>
          {rubriqueSeries.map((serie) => (
            <View key={serie.id} style={styles.gridItem}>
              <SerieCard
                serie={serie}
                onPress={() => handleNavigateToFirstSeason(serie.id)}
                variant="vertical"
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  description: {
    color: '#888',
    fontSize: 16,
    marginBottom: 30,
    lineHeight: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '48%',
    marginBottom: 20,
  },
  error: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 50,
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
});