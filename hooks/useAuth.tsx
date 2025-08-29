import { useState, useEffect, createContext, useContext, useRef } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { AuthState, User } from '@/types';

// Conditional imports for platform-specific authentication
let LocalAuthentication: any = null;
let startRegistration: any = null;
let startAuthentication: any = null;

if (Platform.OS !== 'web') {
  // Only import expo-local-authentication on native platforms
  LocalAuthentication = require('expo-local-authentication');
} else {
  // Only import WebAuthn browser library on web
  import('@simplewebauthn/browser').then(module => {
    startRegistration = module.startRegistration;
    startAuthentication = module.startAuthentication;
  }).catch(error => {
    console.warn('Failed to load WebAuthn browser library:', error);
  });
}

// Platform-specific storage functions
const getStorageItem = async (key: string): Promise<string | null> => {
  console.log('🔐 Storage: Getting item with key:', key);
  if (Platform.OS === 'web') {
    const value = localStorage.getItem(key);
    console.log('🔐 Storage (web): Retrieved value for key', key, ':', {
      hasValue: !!value,
      valueLength: value?.length || 0,
      valuePreview: value ? value.substring(0, 50) + '...' : 'null'
    });
    return value;
  } else {
    const { getItemAsync } = await import('expo-secure-store');
    const value = await getItemAsync(key);
    console.log('🔐 Storage (secure): Retrieved value for key', key, ':', {
      hasValue: !!value,
      valueLength: value?.length || 0,
      valuePreview: value ? value.substring(0, 50) + '...' : 'null'
    });
    return value;
  }
};

const setStorageItem = async (key: string, value: string): Promise<void> => {
  console.log('🔐 Storage: Setting item with key:', key, 'value length:', value.length);
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    console.log('🔐 Storage (web): Successfully stored value for key:', key);
  } else {
    const { setItemAsync } = await import('expo-secure-store');
    await setItemAsync(key, value);
    console.log('🔐 Storage (secure): Successfully stored value for key:', key);
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
  checkBiometricSupport: () => Promise<{ isAvailable: boolean; isEnrolled: boolean; supportedTypes: string[] }>;
  enableBiometricLogin: (user?: User | null, token?: string | null) => Promise<boolean>;
  disableBiometricLogin: () => Promise<boolean>;
  performBiometricLogin: () => Promise<{ success: boolean; error?: string }>;
  isBiometricEnabled: () => Promise<boolean>;
}>({
  authState: { user: null, token: null, isLoading: true },
  login: async () => false,
  signup: async () => false,
  logout: async () => {},
  updateUserSubscription: () => {},
  checkBiometricSupport: async () => ({ isAvailable: false, isEnrolled: false, supportedTypes: [] }),
  enableBiometricLogin: async () => false,
  disableBiometricLogin: async () => false,
  performBiometricLogin: async () => ({ success: false }),
  isBiometricEnabled: async () => false,
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
          password: password,
          clientOrigin: window.location.origin,
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
      // Call the sign-in edge function for account creation
      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          emailOrPhone: email,
          password: password,
          clientOrigin: Platform.OS === 'web' ? window.location.origin : 'app://localhost',
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Signup failed:', errorData);
        return false;
      }

      const data = await response.json();
      
      if (!data.success) {
        console.error('Signup failed:', data.error);
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

      // Check if user should return to player after sign-up
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
      console.error('Signup error:', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      // Check if biometric login is enabled before clearing storage
      let shouldPreserveBiometricData = false;
      
      if (Platform.OS === 'web') {
        const webAuthnEnabled = await getStorageItem('WEBAUTHN_ENABLED');
        shouldPreserveBiometricData = webAuthnEnabled === 'true';
      } else {
        const biometricEnabled = await getStorageItem('BIOMETRIC_ENABLED');
        shouldPreserveBiometricData = biometricEnabled === 'true';
      }
      
      console.log('🔐 Logout: Biometric preservation check:', {
        platform: Platform.OS,
        shouldPreserveBiometricData,
        hasUser: !!authState.user,
        smartuserId: authState.user?.smartuserId
      });
      
      if (shouldPreserveBiometricData) {
        console.log(`🔐 Logout: Biometric login enabled - preserving session data for ${Platform.OS === 'web' ? 'WebAuthn' : 'Face ID'}`);
        // Don't delete token and user data - keep them for biometric re-authentication
        // Only clear the in-memory auth state
      } else {
        console.log(`🔐 Logout: Biometric login not enabled - clearing all session data`);
        await deleteStorageItem('token');
        await deleteStorageItem('user');
      }
      
      if (isMountedRef.current) {
        setAuthState({
          user: null,
          token: null,
          isLoading: false,
        });
        console.log('🔐 Logout: Auth state cleared from memory');
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

  const checkBiometricSupport = async () => {
    if (Platform.OS === 'web') {
      // Check WebAuthn support for web
      // Check if startRegistration is available
      console.log('🔐 WebAuthn: Checking startRegistration availability:', {
        startRegistrationExists: !!startRegistration,
        startRegistrationType: typeof startRegistration,
        isFunction: typeof startRegistration === 'function'
      });

      if (!startRegistration || typeof startRegistration !== 'function') {
        console.error('🔐 WebAuthn: startRegistration is not available or not a function');
        return false;
      }

      try {
        if (!window.PublicKeyCredential) {
          return { isAvailable: false, isEnrolled: false, supportedTypes: [] };
        }

        const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        const isEnrolled = await isBiometricEnabled(); // Check if user has enabled WebAuthn
        
        return {
          isAvailable: available,
          isEnrolled,
          supportedTypes: available ? ['WebAuthn'] : []
        };
      } catch (error) {
        console.error('Error checking WebAuthn support:', error);
        return { isAvailable: false, isEnrolled: false, supportedTypes: [] };
      }
    } else if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
      return { isAvailable: false, isEnrolled: false, supportedTypes: [] };
    }

    if (!LocalAuthentication) {
      return { isAvailable: false, isEnrolled: false, supportedTypes: [] };
    }

    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      
      const typeNames = supportedTypes.map(type => {
        switch (type) {
          case LocalAuthentication.AuthenticationType.FINGERPRINT:
            return Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
          case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
            return 'Face ID';
          case LocalAuthentication.AuthenticationType.IRIS:
            return 'Iris';
          default:
            return 'Biometric';
        }
      });

      return {
        isAvailable: hasHardware && isEnrolled,
        isEnrolled,
        supportedTypes: typeNames
      };
    } catch (error) {
      console.error('Error checking biometric support:', error);
      return { isAvailable: false, isEnrolled: false, supportedTypes: [] };
    }
  };

  const enableBiometricLogin = async (
    userParam?: User | null,
    tokenParam?: string | null
  ): Promise<boolean> => {
    const currentUser = userParam || authState.user;
    const currentToken = tokenParam || authState.token;

    if (!currentUser || !currentToken) {
      return false;
    }

    if (Platform.OS === 'web') {
      try {
        if (!startRegistration) {
          const module = await import('@simplewebauthn/browser');
          startRegistration = module.startRegistration;
          startAuthentication = module.startAuthentication;
        }

        const startResp = await fetch(
          `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/webauthn-register-start`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              smartuserId: currentUser.smartuserId,
              email: currentUser.email,
            }),
          }
        );

        if (!startResp.ok) {
          console.error('WebAuthn register-start failed:', await startResp.text());
          return false;
        }

        const options = await startResp.json();
        const attResp = await startRegistration(options);

        const finishResp = await fetch(
          `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/webauthn-register-finish`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              smartuserId: currentUser.smartuserId,
              attResp,
              expectedChallenge: options.challenge,
            }),
          }
        );

        if (!finishResp.ok) {
          console.error('WebAuthn register-finish failed:', await finishResp.text());
          return false;
        }

        const finishData = await finishResp.json();
        if (!finishData.success) {
          return false;
        }

        const biometricToken = `${currentToken}_${Date.now()}`;
        const storageKey = `BIOMETRIC_TOKEN_${currentUser.smartuserId}`;

        await setStorageItem(storageKey, biometricToken);
        await setStorageItem('BIOMETRIC_ENABLED', 'true');
        await setStorageItem('token', currentToken);
        await setStorageItem('user', JSON.stringify(currentUser));

        return true;
      } catch (error) {
        console.error('Error enabling biometric login:', error);
        return false;
      }
    }

    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
      return false;
    }

    try {
      const biometricSupport = await checkBiometricSupport();
      if (!biometricSupport.isAvailable) {
        return false;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: Platform.OS === 'ios' ? 'Enable biometric login' : 'Enable fingerprint/face unlock',
        fallbackLabel: 'Use password instead',
        cancelLabel: 'Cancel',
      });

      if (result.success) {
        const biometricToken = `${currentToken}_${Date.now()}`;
        const storageKey = `BIOMETRIC_TOKEN_${currentUser.smartuserId}`;

        console.log('🔐 Biometric: About to store biometric data:', {
          storageKey,
          hasCurrentToken: !!currentToken,
          hasCurrentUser: !!currentUser,
          currentTokenLength: currentToken.length,
          smartuserId: currentUser.smartuserId,
        });

        await setStorageItem(storageKey, biometricToken);
        await setStorageItem('BIOMETRIC_ENABLED', 'true');
        await setStorageItem('token', currentToken);
        await setStorageItem('user', JSON.stringify(currentUser));

        console.log('🔐 Biometric: All biometric data stored successfully');

        const verifyToken = await getStorageItem('token');
        const verifyUser = await getStorageItem('user');
        const verifyBiometric = await getStorageItem(storageKey);

        console.log('🔐 Biometric: Verification check:', {
          tokenStored: !!verifyToken,
          userStored: !!verifyUser,
          biometricStored: !!verifyBiometric,
          tokenLength: verifyToken?.length || 0,
          userLength: verifyUser?.length || 0,
        });

        console.log('Biometric login enabled successfully');
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error enabling biometric login:', error);
      return false;
    }
  };

  const disableBiometricLogin = async (): Promise<boolean> => {
    if (!authState.user) {
      return false;
    }

    if (Platform.OS === 'web') {
      try {
        const storageKey = `BIOMETRIC_TOKEN_${authState.user.smartuserId}`;
        await deleteStorageItem(storageKey);
        await deleteStorageItem('BIOMETRIC_ENABLED');
        return true;
      } catch (error) {
        console.error('Error disabling biometric login:', error);
        return false;
      }
    }

    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
      return false;
    }

    try {
      const storageKey = `BIOMETRIC_TOKEN_${authState.user.smartuserId}`;
      await deleteStorageItem(storageKey);
      await deleteStorageItem('BIOMETRIC_ENABLED');

      console.log('Biometric login disabled successfully');
      return true;
    } catch (error) {
      console.error('Error disabling biometric login:', error);
      return false;
    }
  };

  const performBiometricLogin = async (): Promise<{ success: boolean; error?: string }> => {
    if (Platform.OS === 'web') {
      try {
        if (!startAuthentication) {
          const module = await import('@simplewebauthn/browser');
          startRegistration = module.startRegistration;
          startAuthentication = module.startAuthentication;
        }

        const biometricSupport = await checkBiometricSupport();
        if (!biometricSupport.isAvailable) {
          return { success: false, error: 'Biometric authentication is not available on this device' };
        }

        const isEnabled = await getStorageItem('BIOMETRIC_ENABLED');
        if (!isEnabled) {
          return { success: false, error: 'Biometric login is not enabled' };
        }

        const userString = await getStorageItem('user');
        if (!userString) {
          return { success: false, error: 'No stored authentication data found' };
        }
        const user = JSON.parse(userString);

        const startResp = await fetch(
          `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/webauthn-authenticate-start`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ smartuserId: user.smartuserId }),
          }
        );

        if (!startResp.ok) {
          return { success: false, error: 'Failed to start WebAuthn authentication' };
        }

        const options = await startResp.json();
        const authResp = await startAuthentication(options);

        const finishResp = await fetch(
          `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/webauthn-authenticate-finish`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ 
              authResp, 
              expectedChallenge: options.challenge,
              clientOrigin: window.location.origin,
            }),
          }
        );

        if (!finishResp.ok) {
          return { success: false, error: 'WebAuthn authentication failed' };
        }

        const finishData = await finishResp.json();
        if (finishData.success) {
          if (isMountedRef.current) {
            setAuthState({ user: finishData.user, token: finishData.sessionToken, isLoading: false });
          }
          await setStorageItem('token', finishData.sessionToken);
          await setStorageItem('user', JSON.stringify(finishData.user));
          return { success: true };
        }

        return { success: false, error: 'Authentication verification failed' };
      } catch (error) {
        console.error('Error performing biometric login:', error);
        return { success: false, error: 'An unexpected error occurred during biometric authentication' };
      }
    }

    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
      return { success: false, error: 'Biometric authentication is only available on iOS' };
    }

    try {
      const biometricSupport = await checkBiometricSupport();
      if (!biometricSupport.isAvailable) {
        return { success: false, error: 'Biometric authentication is not available on this device' };
      }

      // Check if biometric login is enabled
      const isEnabled = await getStorageItem('BIOMETRIC_ENABLED');
      if (!isEnabled) {
        return { success: false, error: 'Biometric login is not enabled' };
      }

      // Prompt user for biometric authentication
      const authType = biometricSupport.supportedTypes[0] || 'biometric';
      console.log('🔐 Biometric: About to prompt for authentication with type:', authType);

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: Platform.OS === 'ios' ? `Sign in with ${authType}` : 'Sign in with fingerprint or face unlock',
        fallbackLabel: 'Use password instead',
        cancelLabel: 'Cancel',
      });

      console.log('🔐 Biometric: Authentication result:', {
        success: result.success,
        error: result.error,
        warning: result.warning,
      });

      if (result.success) {
        // Get stored user data
        const userString = await getStorageItem('user');
        const token = await getStorageItem('token');

        console.log('Biometric auth successful, checking stored data:', {
          hasUserString: !!userString,
          hasToken: !!token,
          userStringLength: userString?.length || 0,
          tokenLength: token?.length || 0,
        });

        if (userString && token) {
          const user = JSON.parse(userString);

          // Verify the biometric token exists
          const storageKey = `BIOMETRIC_TOKEN_${user.smartuserId}`;
          const biometricToken = await getStorageItem(storageKey);

          console.log('Checking biometric token:', {
            storageKey,
            hasBiometricToken: !!biometricToken,
            userSmartuserId: user.smartuserId,
          });

          if (biometricToken && isMountedRef.current) {
            // TODO: In production, you should validate this token with your backend
            // For now, we'll trust the stored session if biometric auth succeeded
            setAuthState({
              user,
              token,
              isLoading: false,
            });

            console.log('Biometric login successful');
            return { success: true };
          }

          return {
            success: false,
            error: 'Biometric token not found. Please enable biometric login in your profile settings.',
          };
        }

        return { success: false, error: 'No stored authentication data found' };
      } else {
        // Handle specific error cases
        const errorMessage = result.error || 'Authentication was cancelled or failed';
        console.log('Biometric authentication failed:', {
          error: result.error,
          warning: result.warning,
        });

        return { success: false, error: errorMessage };
      }
    } catch (error) {
      console.error('Error performing biometric login:', error);
      return { success: false, error: 'An unexpected error occurred during biometric authentication' };
    }
  };

  const isBiometricEnabled = async (): Promise<boolean> => {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android' && Platform.OS !== 'web') {
      return false;
    }

    try {
      const isEnabled = await getStorageItem('BIOMETRIC_ENABLED');
      return isEnabled === 'true';
    } catch (error) {
      console.error('Error checking biometric status:', error);
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      authState, 
      login, 
      signup, 
      logout, 
      updateUserSubscription,
      checkBiometricSupport,
      enableBiometricLogin,
      disableBiometricLogin,
      performBiometricLogin,
      isBiometricEnabled
    }}>
      {children}
    </AuthContext.Provider>
  );
};