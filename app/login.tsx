import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Fingerprint } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';

export default function LoginScreen() {
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [biometricSupport, setBiometricSupport] = useState({ isAvailable: false, isEnrolled: false, supportedTypes: [] });
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const { login, checkBiometricSupport, performBiometricLogin, isBiometricEnabled: checkIsBiometricEnabled } = useAuth();
  const { t } = useTranslation();

  // Check biometric support and status on component mount
  React.useEffect(() => {
    const checkBiometrics = async () => {
      if (Platform.OS === 'ios') {
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
    if (!emailOrPhone || !password) {
      Alert.alert(t('error'), t('pleaseFillAllFields'));
      return;
    }

    setIsLoading(true);
    const success = await login(emailOrPhone, password);
    setIsLoading(false);

    if (success) {
      router.replace('/(tabs)');
    } else {
      Alert.alert(t('error'), t('invalidCredentials'));
    }
  };

  const handleBiometricLogin = async () => {
    setIsLoading(true);
    const result = await performBiometricLogin();
    setIsLoading(false);

    if (result.success) {
      router.replace('/(tabs)');
    } else {
      let errorMessage = result.error || t('biometricAuthFailed');
      
      // Provide more user-friendly messages for common scenarios
      if (Platform.OS === 'web') {
        if (errorMessage.includes('WebAuthn login is not enabled')) {
          errorMessage = 'Please sign in with your email and password first, then enable WebAuthn login in your profile settings.';
        } else if (errorMessage.includes('Authentication was cancelled')) {
          errorMessage = 'WebAuthn authentication was cancelled. Please try again.';
        }
      } else {
        if (errorMessage.includes('No stored authentication data found')) {
          errorMessage = 'Please sign in with your email and password first, then enable biometric login in your profile settings.';
        } else if (errorMessage.includes('Biometric token not found')) {
          errorMessage = 'Biometric login is not set up. Please enable it in your profile settings after signing in.';
        }
      }
      
      Alert.alert(t('error'), errorMessage);
    }
  };
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
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
          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('emailOrPhone')}</Text>
            <TextInput
              style={styles.input}
              value={emailOrPhone}
              onChangeText={setEmailOrPhone}
              placeholder={t('enterEmailOrPhone')}
              placeholderTextColor="#666"
              keyboardType="default"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('password')}</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder={t('enterPassword')}
              placeholderTextColor="#666"
              secureTextEntry
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
});