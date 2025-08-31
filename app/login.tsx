import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Fingerprint } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';

export default function LoginScreen() {
  const { errorMessage: routeErrorMessage, emailOrPhone: routeEmailOrPhone } =
    useLocalSearchParams<{ errorMessage?: string; emailOrPhone?: string }>();
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [biometricSupport, setBiometricSupport] = useState({ isAvailable: false, isEnrolled: false, supportedTypes: [] });
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const { login, checkBiometricSupport, performBiometricLogin, isBiometricEnabled: checkIsBiometricEnabled } = useAuth();
  const { t } = useTranslation();
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  // Check biometric support and status on component mount
  React.useEffect(() => {
    const checkForErrorMessage = async () => {
      // Ensure inputs are enabled when screen loads
      setIsLoading(false);

      if (routeErrorMessage) {
        setErrorMessage(routeErrorMessage);
        if (routeEmailOrPhone) setEmailOrPhone(String(routeEmailOrPhone));
        setPassword('');
        setTimeout(() => passwordInputRef.current?.focus(), 100);

      } else if (Platform.OS === 'web') {
        const storedError = localStorage.getItem('signinErrorMessage');
        const storedEmail = localStorage.getItem('signinEmail');
        if (storedError) {
          setErrorMessage(storedError);
          if (storedEmail) setEmailOrPhone(storedEmail);
          localStorage.removeItem('signinErrorMessage');
          localStorage.removeItem('signinEmail');
          setPassword('');
          setTimeout(() => passwordInputRef.current?.focus(), 100);
        }
      }
    };

    checkForErrorMessage();

    const checkBiometrics = async () => {
      if (Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'web') {
        const support = await checkBiometricSupport();
        setBiometricSupport(support);

        if (support.isAvailable) {
          const enabled = await checkIsBiometricEnabled();
          setIsBiometricEnabled(enabled);
        }
      }
    };

    checkBiometrics();
  }, []);
  const handleLogin = async () => {
    // Clear any previous error message
    setErrorMessage('');
    
    if (!emailOrPhone || !password) {
      setErrorMessage(t('pleaseFillAllFields'));
      return;
    }

    setIsLoading(true);
    try {
      const result = await login(emailOrPhone, password);
      if (result.success) {
        router.replace('/(tabs)');
      } else {
        setErrorMessage(result.error || t('invalidCredentials'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    setIsLoading(true);
    try {
      const result = await performBiometricLogin();
      if (result.success) {
        router.replace('/(tabs)');
      } else {
        let errorMessage = result.error || t('biometricAuthFailed');

        // Provide more user-friendly messages for common scenarios
        if (Platform.OS === 'web') {
          if (errorMessage.includes('WebAuthn login is not enabled')) {
            errorMessage = t('webauthnNotEnabled');
          } else if (errorMessage.includes('Authentication was cancelled')) {
            errorMessage = t('webauthnCancelled');
          }
        } else {
          if (errorMessage.includes('No stored authentication data found')) {
            errorMessage = t('biometricNoUserData');
          } else if (errorMessage.includes('Biometric token not found')) {
            errorMessage = t('biometricNoUserData');
          }
        }

        Alert.alert(t('error'), errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Clear error message when user starts typing
  const handleEmailOrPhoneChange = (text: string) => {
    setEmailOrPhone(text);
    if (errorMessage) setErrorMessage('');
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (errorMessage) setErrorMessage('');
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={styles.backButton}>
          <ChevronLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('signIn')}</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.logo}>{t('appName')}</Text>
        
        {/* Biometric Login Button - Only show on iOS if available and enabled */}
        {biometricSupport.isAvailable && isBiometricEnabled && (
          <TouchableOpacity
            style={styles.biometricButton}
            onPress={handleBiometricLogin}
            disabled={isLoading}
          >
            <Fingerprint size={24} color="#fff" />
            <Text style={styles.biometricButtonText}>
              {Platform.OS === 'web' 
                ? 'Sign in with WebAuthn'
                : `Sign in with ${biometricSupport.supportedTypes[0] || 'Biometric'}`
              }
            </Text>
          </TouchableOpacity>
        )}
        
        {/* Divider - Only show if biometric is available */}
        {biometricSupport.isAvailable && isBiometricEnabled && (
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>
        )}
        
        <View style={styles.form}>
          {/* Error Message Display */}
          {errorMessage ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('emailOrPhone')}</Text>
            <TextInput
              ref={emailInputRef}
              style={styles.input}
              value={emailOrPhone}
              onChangeText={handleEmailOrPhoneChange}
              placeholder={t('enterEmailOrPhone')}
              placeholderTextColor="#666"
              keyboardType="default"
              autoCapitalize="none"
              textContentType="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('password')}</Text>
            <TextInput
              ref={passwordInputRef}
              style={styles.input}
              value={password}
              onChangeText={handlePasswordChange}
              placeholder={t('enterPassword')}
              placeholderTextColor="#666"
              secureTextEntry
              textContentType="none"
            />
          </View>

          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            <Text style={styles.loginButtonText}>
              {isLoading ? t('signingIn') : t('signIn')}
            </Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('dontHaveAccount')}</Text>
            <TouchableOpacity onPress={() => router.push('/signup')}>
              <Text style={styles.signupLink}>{t('signUp')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  logo: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FF1B8D',
    textAlign: 'center',
    marginTop: 40,
    marginBottom: 60,
  },
  form: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  loginButton: {
    backgroundColor: '#FF1B8D',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 30,
  },
  footerText: {
    color: '#888',
    fontSize: 14,
  },
  signupLink: {
    color: '#FF1B8D',
    fontSize: 14,
    fontWeight: '600',
  },
  biometricButton: {
    backgroundColor: '#333',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 12,
  },
  biometricButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#333',
  },
  dividerText: {
    color: '#888',
    fontSize: 14,
  },
  errorContainer: {
    backgroundColor: '#ff4444',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#cc0000',
  },
  errorText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});