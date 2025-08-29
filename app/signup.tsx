import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { signup } = useAuth();
  const { t } = useTranslation();

  const handleSignup = async () => {
    // Clear any previous error message
    setErrorMessage('');

    if (!email || !password || !confirmPassword) {
      setErrorMessage(t('pleaseFillAllFields'));
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage(t('passwordsDoNotMatch'));
      return;
    }

    if (password.length < 6) {
      setErrorMessage(t('passwordMinLength'));
      return;
    }

    setIsLoading(true);
    const success = await signup(email, password);
    setIsLoading(false);

    if (success) {
      router.replace('/(tabs)');
    } else {
      setErrorMessage(t('failedToCreateAccount'));
    }
  };

  // Clear error message when user starts typing
  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (errorMessage) setErrorMessage('');
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (errorMessage) setErrorMessage('');
  };

  const handleConfirmPasswordChange = (text: string) => {
    setConfirmPassword(text);
    if (errorMessage) setErrorMessage('');
  };
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={styles.backButton}>
          <ChevronLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('signUp')}</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.logo}>{t('appName')}</Text>
        
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
              style={styles.input}
              value={email}
              onChangeText={handleEmailChange}
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
              onChangeText={handlePasswordChange}
              placeholder={t('enterPassword')}
              placeholderTextColor="#666"
              secureTextEntry
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('confirmPassword')}</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={handleConfirmPasswordChange}
              placeholder={t('confirmYourPassword')}
              placeholderTextColor="#666"
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.signupButton, isLoading && styles.buttonDisabled]}
            onPress={handleSignup}
            disabled={isLoading}
          >
            <Text style={styles.signupButtonText}>
              {isLoading ? t('creatingAccount') : t('signUp')}
            </Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('alreadyHaveAccount')}</Text>
            <TouchableOpacity onPress={() => router.push('/login')}>
              <Text style={styles.loginLink}>{t('signIn')}</Text>
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
  signupButton: {
    backgroundColor: '#FF1B8D',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  signupButtonText: {
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
  loginLink: {
    color: '#FF1B8D',
    fontSize: 14,
    fontWeight: '600',
  },
});