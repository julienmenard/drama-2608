import { useState, useEffect, createContext, useContext, useRef } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { AuthState, User } from '@/types';

// Platform-specific storage functions
const getStorageItem = async (key: string): Promise<string | null> => {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  } else {
    const { getItemAsync } = await import('expo-secure-store');
    return await getItemAsync(key);
  }
};

const setStorageItem = async (key: string, value: string): Promise<void> => {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
  } else {
    const { setItemAsync } = await import('expo-secure-store');
    await setItemAsync(key, value);
  }
};

const deleteStorageItem = async (key: string): Promise<void> => {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
  } else {
    const { deleteItemAsync } = await import('expo-secure-store');
    await deleteItemAsync(key);
  }
};

const AuthContext = createContext<{
  authState: AuthState;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateUserSubscription: (isSubscribed: boolean) => void;
}>({
  authState: { user: null, token: null, isLoading: true },
  login: async () => false,
  signup: async () => false,
  logout: async () => {},
  updateUserSubscription: () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const isMountedRef = useRef(true);
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isLoading: true,
  });

  useEffect(() => {
    isMountedRef.current = true;
    loadAuthState();
    
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadAuthState = async () => {
    try {
      const token = await getStorageItem('token');
      const userString = await getStorageItem('user');
      
      if (token && userString) {
        const user = JSON.parse(userString);
        if (isMountedRef.current) {
          setAuthState({
            user,
            token,
            isLoading: false,
          });
          console.log('🔐 useAuth: User loaded from storage:', {
            user,
            smartuserId: user?.smartuserId,
            isSubscribed: user?.isSubscribed,
            email: user?.email
          });
        }
      } else {
        if (isMountedRef.current) {
          setAuthState({
            user: null,
            token: null,
            isLoading: false,
          });
          console.log('🔐 useAuth: No user found in storage, user is logged out');
        }
      }
    } catch (error) {
      console.error('Error loading auth state:', error);
      if (isMountedRef.current) {
        setAuthState({
          user: null,
          token: null,
          isLoading: false,
        });
        console.log('🔐 useAuth: Error loading auth state, user set to logged out');
      }
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      // Call the sign-in edge function
      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          emailOrPhone: email,
          password: password
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        return false;
      }

      const data = await response.json();
      
      if (!data.success) {
        return false;
      }

      const user: User = {
        id: data.user.id,
        email: data.user.email || email,
        isSubscribed: data.user.isSubscribed,
        smartuserId: data.user.smartuserId,
      };

      await setStorageItem('token', data.sessionToken);
      await setStorageItem('user', JSON.stringify(user));

      if (isMountedRef.current) {
        setAuthState({
          user: user,
          token: data.sessionToken,
          isLoading: false,
        });
      }

      // Check if user should return to player after sign-in
      if (Platform.OS === 'web') {
        const returnDataStr = await getStorageItem('playerReturnData');
        if (returnDataStr) {
          try {
            const returnData = JSON.parse(returnDataStr);
            // Check if the data is recent (within 10 minutes)
            if (Date.now() - returnData.timestamp < 10 * 60 * 1000) {
              // Navigate back to the specific episode the user was trying to watch
              setTimeout(() => {
                router.replace('/(tabs)');
              }, 100);
            } else {
              // Clean up old data
              await deleteStorageItem('playerReturnData');
            }
          } catch (error) {
            console.error('Error parsing player return data:', error);
            await deleteStorageItem('playerReturnData');
          }
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  };

  const signup = async (email: string, password: string): Promise<boolean> => {
    try {
      // TODO: Replace with actual API call
      const mockUser: User = {
        id: '1',
        email,
        isSubscribed: false,
      };
      const mockToken = 'mock-jwt-token';

      await setStorageItem('token', mockToken);
      await setStorageItem('user', JSON.stringify(mockUser));

      if (isMountedRef.current) {
        setAuthState({
          user: mockUser,
          token: mockToken,
          isLoading: false,
        });
      }

      return true;
    } catch (error) {
      console.error('Signup error:', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      await deleteStorageItem('token');
      await deleteStorageItem('user');
      
      if (isMountedRef.current) {
        setAuthState({
          user: null,
          token: null,
          isLoading: false,
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const updateUserSubscription = (isSubscribed: boolean) => {
    if (authState.user && isMountedRef.current) {
      const updatedUser = { ...authState.user, isSubscribed };
      setAuthState(prev => ({
        ...prev,
        user: updatedUser
      }));
      
      // Update stored user data
      setStorageItem('user', JSON.stringify(updatedUser)).catch(error => {
        console.error('Error updating stored user data:', error);
      });
    }
  };

  return (
    <AuthContext.Provider value={{ authState, login, signup, logout, updateUserSubscription }}>
      {children}
    </AuthContext.Provider>
  );
};