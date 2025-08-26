import { useState, useEffect } from 'react';
import { FavoritesService, FavoriteContent } from '@/services/favoritesService';
import { useAuth } from '@/hooks/useAuth';
import { useCampaignConfig } from '@/hooks/useCampaignConfig';

export const useFavorites = () => {
  const [favorites, setFavorites] = useState<FavoriteContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { authState } = useAuth();
  const { campaignCountriesLanguagesId } = useCampaignConfig();

  useEffect(() => {
    const fetchFavorites = async () => {
      console.log('🔍 useFavorites: Starting fetchFavorites with:', {
        smartuserId: authState.user?.smartuserId,
        campaignCountriesLanguagesId
      });

      if (!authState.user?.smartuserId || !campaignCountriesLanguagesId) {
        console.log('🔍 useFavorites: Missing required data, setting empty favorites');
        setFavorites([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        console.log('🔍 useFavorites: Calling FavoritesService.getUserFavorites...');
        const data = await FavoritesService.getUserFavorites(
          campaignCountriesLanguagesId,
          authState.user.smartuserId
        );
        console.log('🔍 useFavorites: Received favorites data:', data);
        setFavorites(data);
      } catch (err) {
        console.error('🔍 useFavorites: Error in fetchFavorites:', err);
        setError('Error loading favorites');
        console.error(err);
        setFavorites([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFavorites();
  }, [authState.user?.smartuserId, campaignCountriesLanguagesId]);

  const addToFavorites = async (contentId: number, contentType: 'serie' | 'episode') => {
    if (!authState.user?.smartuserId) return false;

    const success = await FavoritesService.addToFavorites(
      authState.user.smartuserId,
      contentId,
      contentType
    );

    if (success) {
      // Refresh favorites list
      const updatedFavorites = await FavoritesService.getUserFavorites(
        campaignCountriesLanguagesId!,
        authState.user.smartuserId
      );
      setFavorites(updatedFavorites);
    }

    return success;
  };

  const removeFromFavorites = async (contentId: number, contentType: 'serie' | 'episode') => {
    if (!authState.user?.smartuserId) return false;

    const success = await FavoritesService.removeFromFavorites(
      authState.user.smartuserId,
      contentId,
      contentType
    );

    if (success) {
      // Refresh favorites list
      const updatedFavorites = await FavoritesService.getUserFavorites(
        campaignCountriesLanguagesId!,
        authState.user.smartuserId
      );
      setFavorites(updatedFavorites);
    }

    return success;
  };

  const toggleFavorite = async (contentId: number, contentType: 'serie' | 'episode') => {
    if (!authState.user?.smartuserId) return false;

    const success = await FavoritesService.toggleFavorite(
      authState.user.smartuserId,
      contentId,
      contentType
    );

    if (success) {
      // Refresh favorites list
      const updatedFavorites = await FavoritesService.getUserFavorites(
        campaignCountriesLanguagesId!,
        authState.user.smartuserId
      );
      setFavorites(updatedFavorites);
    }

    return success;
  };

  const isFavorite = async (contentId: number, contentType: 'serie' | 'episode') => {
    if (!authState.user?.smartuserId) return false;

    return await FavoritesService.isFavorite(
      authState.user.smartuserId,
      contentId,
      contentType
    );
  };

  return {
    favorites,
    loading,
    error,
    addToFavorites,
    removeFromFavorites,
    toggleFavorite,
    isFavorite,
  };
};