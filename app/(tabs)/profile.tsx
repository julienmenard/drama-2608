import React from 'react';
import { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, TextInput, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Globe, Bell, Settings, Shield, FileText, ChevronRight, Copy, CreditCard as Edit3, Calendar, Mail, X, Check, Gift, Fingerprint } from 'lucide-react-native';
import { router } from 'expo-router';
import { Image as RNImage } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useTranslation } from '@/hooks/useTranslation';
import { useGamification } from '@/hooks/useGamification';
import { LanguageSelector } from '@/components/LanguageSelector';
import { supabase } from '@/lib/supabase';
import RNDateTimePicker from '@react-native-community/datetimepicker';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { authState, logout, checkBiometricSupport, enableBiometricLogin, disableBiometricLogin, isBiometricEnabled } = useAuth();
  const { isSubscribed } = useSubscription();
  const { processEvent } = useGamification();
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [userProfile, setUserProfile] = useState({
    email: '',
    dateOfBirth: '',
  });
  const [editingProfile, setEditingProfile] = useState({
    email: '',
    dateOfBirth: '',
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [biometricSupport, setBiometricSupport] = useState({ isAvailable: false, isEnrolled: false, supportedTypes: [] });
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  // Load user profile data
  useEffect(() => {
    if (authState.user?.smartuserId) {
      loadUserProfile();
    }
  }, [authState.user?.smartuserId]);

  // Check biometric support and status
  useEffect(() => {
    const checkBiometrics = async () => {
      if (authState.user) {
        const support = await checkBiometricSupport();
        setBiometricSupport(support);
        
        if (support.isAvailable) {
          const enabled = await isBiometricEnabled();
          setBiometricEnabled(enabled);
        }
      }
    };
    
    checkBiometrics();
  }, [authState.user]);

  const loadUserProfile = async () => {
    if (!authState.user?.smartuserId) return;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('email, date_of_birth')
        .eq('smartuser_id', authState.user.smartuserId)
        .single();

      if (error) {
        console.error('Error loading user profile:', error);
        return;
      }

      const profile = {
        email: data.email || '',
        dateOfBirth: data.date_of_birth || '',
      };

      setUserProfile(profile);
      setEditingProfile(profile);
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (selectedDate) {
      // Format date in local timezone to avoid timezone conversion issues
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}`;
      setEditingProfile(prev => ({ ...prev, dateOfBirth: formattedDate }));
    }
  };

  const confirmDateSelection = () => {
    setShowDatePicker(false);
    setShowProfileEditor(true);
  };

  const cancelDateSelection = () => {
    setShowDatePicker(false);
    setShowProfileEditor(true);
  };

  const openDatePicker = () => {
    if (Platform.OS === 'web') {
      // For web, focus on the input to trigger native date picker
      const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
      if (dateInput) {
        dateInput.focus();
        dateInput.showPicker?.();
      }
    } else {
     // Hide the modal first to prevent layering issues
     setShowProfileEditor(false);
      setShowDatePicker(true);
    }
  };

  const getDateValue = () => {
    if (editingProfile.dateOfBirth) {
      return new Date(editingProfile.dateOfBirth + 'T00:00:00');
    }
    return new Date();
  };

  const updateUserProfile = async () => {
    if (!authState.user?.smartuserId) return;

    setIsUpdating(true);
    try {
      // Store previous profile state to detect changes
      const previousProfile = { ...userProfile };
      console.log('Previous profile:', previousProfile);
      console.log('New profile:', editingProfile);

      const { error } = await supabase
        .from('users')
        .update({
          email: editingProfile.email || null,
          date_of_birth: editingProfile.dateOfBirth || null,
          updated_at: new Date().toISOString(),
        })
        .eq('smartuser_id', authState.user.smartuserId);

      if (error) {
        console.error('Error updating user profile:', error);
        Alert.alert(t('error'), 'Failed to update profile');
        return;
      }

      // Update local state first
      setUserProfile(editingProfile);
      setShowProfileEditor(false);

      // Check for gamification events
      const emailProvided = !previousProfile.email && editingProfile.email.trim();
      const birthDateProvided = !previousProfile.dateOfBirth && editingProfile.dateOfBirth.trim();

      console.log('Gamification checks:', {
        emailProvided,
        birthDateProvided,
        previousEmail: previousProfile.email,
        newEmail: editingProfile.email,
        previousBirthDate: previousProfile.dateOfBirth,
        newBirthDate: editingProfile.dateOfBirth
      });

      // Process individual field events first
      if (emailProvided) {
        console.log('Processing email_provided event');
        await processEvent('email_provided', {
          email: editingProfile.email,
          providedAt: new Date().toISOString()
        });
      }
      
      if (birthDateProvided) {
        console.log('Processing birth_date_provided event');
        await processEvent('birth_date_provided', {
          dateOfBirth: editingProfile.dateOfBirth,
          providedAt: new Date().toISOString()
        });
      }

      // Check if profile became complete with this update
      const profileBecameComplete = editingProfile.email.trim() && 
                                   editingProfile.dateOfBirth.trim() && 
                                   (emailProvided || birthDateProvided);

      if (profileBecameComplete) {
        console.log('Processing complete_profile event');
        await processEvent('complete_profile', {
          email: editingProfile.email,
          dateOfBirth: editingProfile.dateOfBirth,
          completedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error updating user profile:', error);
      Alert.alert(t('error'), 'Failed to update profile');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleBiometric = async () => {
    console.log('🔐 handleToggleBiometric called with state:', {
      platform: Platform.OS,
      biometricSupportAvailable: biometricSupport.isAvailable,
      biometricEnabled,
      hasUser: !!authState.user,
      hasToken: !!authState.token,
      supportedTypes: biometricSupport.supportedTypes
    });

    if (!biometricSupport.isAvailable) {
      console.log('🔐 Biometric not available, showing alert');
     Alert.alert(t('error'), t('biometricNotAvailable'));
      return;
    }

    if (biometricEnabled) {
      console.log('🔐 Disabling biometric login...');
      // Disable biometric login
      const success = await disableBiometricLogin();
      console.log('🔐 Disable biometric result:', success);
      if (success) {
        setBiometricEnabled(false);
       const successMessage = Platform.OS === 'web' 
         ? t('webauthnLoginDisabled')
         : biometricSupport.supportedTypes.includes('Face ID')
           ? t('faceIdLoginDisabled')
           : biometricSupport.supportedTypes.includes('Touch ID')
             ? t('touchIdLoginDisabled')
             : t('biometricLoginDisabled');
       Alert.alert(t('success'), successMessage);
      } else {
       const errorMessage = Platform.OS === 'web' 
         ? t('failedToDisableWebauthn')
         : t('failedToDisableBiometric');
       Alert.alert(t('error'), errorMessage);
      }
    } else {
      console.log('🔐 Enabling biometric login...');
      // Enable biometric login
      const success = Platform.OS === 'web' 
        ? await enableBiometricLogin(authState.user, authState.token)
        : await enableBiometricLogin();
      console.log('🔐 Enable biometric result:', success);
      if (success) {
        setBiometricEnabled(true);
       const successMessage = Platform.OS === 'web' 
         ? t('webauthnLoginEnabled')
         : biometricSupport.supportedTypes.includes('Face ID')
           ? t('faceIdLoginEnabled')
           : biometricSupport.supportedTypes.includes('Touch ID')
             ? t('touchIdLoginEnabled')
             : t('biometricLoginEnabled');
       Alert.alert(t('success'), successMessage);
      } else {
       const errorMessage = Platform.OS === 'web' 
         ? t('failedToEnableWebauthn')
         : t('failedToEnableBiometric');
       Alert.alert(t('error'), errorMessage);
      }
    }
  };

  const menuItems = [
    { icon: Globe, title: t('language'), onPress: () => setShowLanguageSelector(true) },
    { icon: Bell, title: t('notifications'), onPress: () => {} },
    { icon: Shield, title: t('privacyPolicy'), onPress: () => {} },
    { icon: FileText, title: t('termsConditions'), onPress: () => {} },
  ];

  const handleSignIn = () => {
    router.push('/login');
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <>
    <SafeAreaView style={styles.container}>
      <View style={styles.desktopContainer}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <RNImage 
              source={require('@/assets/images/logo-dp.png')} 
              style={styles.logoImage}
              resizeMode="contain"
            />
            {authState.user && (
              <TouchableOpacity 
                style={styles.headerIconButton}
                onPress={() => router.push('/rewards')}
              >
                <Gift size={24} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* User Section */}
        <View style={styles.userSection}>
          <View style={styles.userInfo}>
            <View style={styles.avatar}>
              <User size={32} color="#666" />
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.userName}>
                {authState.user ? authState.user.email.split('@')[0] : 'Guest'}
              </Text>
              <View style={styles.userIdContainer}>
                <Text style={styles.userId}>
                  {authState.user ? `ID ${authState.user.id}946194766` : 'ID 3946194766'}
                </Text>
                <TouchableOpacity style={styles.copyButton}>
                  <Copy size={12} color="#666" />
                </TouchableOpacity>
              </View>
            </View>
            {!authState.user ? (
              <TouchableOpacity style={styles.signInButton} onPress={handleSignIn}>
                <Text style={styles.signInText}>{t('signIn')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          
          {authState.user && !isSubscribed && (
            <TouchableOpacity style={styles.subscribeButton}>
              <Text style={styles.subscribeText}>{t('subscribeToPremium')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* User Profile Information */}
        {authState.user && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('profileInformation')}</Text>
              <TouchableOpacity 
                onPress={() => {
                  console.log('Edit button pressed');
                  setShowProfileEditor(true);
                }}
              >
                <Edit3 size={20} color="#FF1B8D" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.profileInfoContainer}>
              <View style={styles.profileInfoItem}>
                <Mail size={16} color="#666" />
                <TouchableOpacity 
                  style={styles.profileInfoContent} 
                  onPress={() => setShowProfileEditor(true)}
                >
                  <Text style={styles.profileInfoLabel}>{t('email')}</Text>
                  <Text style={styles.profileInfoValue}>
                    {userProfile.email || t('notProvided')}
                  </Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.profileInfoItem}>
                <Calendar size={16} color="#666" />
                <TouchableOpacity 
                  style={styles.profileInfoContent} 
                  onPress={() => setShowProfileEditor(true)}
                >
                  <Text style={styles.profileInfoLabel}>{t('dateOfBirth')}</Text>
                  <Text style={styles.profileInfoValue}>
                    {userProfile.dateOfBirth ? new Date(userProfile.dateOfBirth).toLocaleDateString() : t('notProvided')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Biometric Authentication Section - iOS only */}
        {authState.user && biometricSupport.isAvailable && (Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'web') && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Security</Text>
            
            <View style={styles.biometricContainer}>
              <TouchableOpacity 
                style={styles.biometricItem}
                onPress={handleToggleBiometric}
              >
                <View style={styles.biometricIcon}>
                  <Fingerprint size={20} color="#FF1B8D" />
                </View>
                <View style={styles.biometricContent}>
                  <Text style={styles.biometricTitle}>
                    {Platform.OS === 'web' 
                      ? 'WebAuthn Login'
                      : Platform.OS === 'android'
                        ? 'Biometric Login'
                        : `${biometricSupport.supportedTypes[0] || 'Biometric'} Login`
                    }
                  </Text>
                  <Text style={styles.biometricDescription}>
                    {Platform.OS === 'web' 
                      ? (biometricEnabled 
                          ? 'Use WebAuthn to sign in quickly'
                          : 'Enable WebAuthn for quick sign in'
                        )
                      : Platform.OS === 'android'
                        ? (biometricEnabled 
                            ? 'Use fingerprint or face unlock to sign in quickly'
                            : 'Enable fingerprint or face unlock for quick sign in'
                          )
                        : (biometricEnabled 
                            ? `Use ${biometricSupport.supportedTypes[0]} to sign in quickly`
                            : `Enable ${biometricSupport.supportedTypes[0]} for quick sign in`
                        )
                    }
                  </Text>
                </View>
                <View style={[
                  styles.biometricToggle, 
                  biometricEnabled && styles.biometricToggleActive
                ]}>
                  <View style={[
                    styles.biometricToggleThumb, 
                    biometricEnabled && styles.biometricToggleThumbActive
                  ]} />
                </View>
              </TouchableOpacity>
            </View>
          </View>
        )}
        {/* Menu Items */}
        <View style={styles.menuSection}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={item.onPress}
            >
              <item.icon size={20} color="#fff" />
              <Text style={styles.menuText}>{item.title}</Text>
              <ChevronRight size={16} color="#666" />
            </TouchableOpacity>
          ))}
          
          {authState.user && (
            <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
              <User size={20} color="#ff4444" />
              <Text style={[styles.menuText, { color: '#ff4444' }]}>{t('signOut')}</Text>
              <ChevronRight size={16} color="#666" />
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
      </View>
    </SafeAreaView>

    <LanguageSelector
        visible={showLanguageSelector}
        onClose={() => setShowLanguageSelector(false)}
      />

    {/* Profile Editor Modal */}
    <Modal
        visible={showProfileEditor}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProfileEditor(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('editProfile')}</Text>
              <TouchableOpacity onPress={() => setShowProfileEditor(false)}>
                <X size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>{t('email')}</Text>
                <TextInput
                  style={styles.input}
                  value={editingProfile.email}
                  onChangeText={(text) => setEditingProfile(prev => ({ ...prev, email: text }))}
                  placeholder={t('enterEmail')}
                  placeholderTextColor="#666"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>{t('dateOfBirth')}</Text>
                {Platform.OS === 'web' ? (
                  <input
                    type="date"
                    value={editingProfile.dateOfBirth}
                    onChange={(e) => setEditingProfile(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                    style={{
                      backgroundColor: '#333',
                      borderRadius: '8px',
                      padding: '12px',
                      color: '#fff',
                      fontSize: '16px',
                      border: '1px solid #444',
                      width: '100%',
                      fontFamily: 'inherit'
                    }}
                  />
                ) : (
                  <TouchableOpacity style={styles.input} onPress={openDatePicker}>
                    <Text style={[styles.dateText, !editingProfile.dateOfBirth && styles.placeholderText]}>
                      {editingProfile.dateOfBirth || 'YYYY-MM-DD'}
                    </Text>
                  </TouchableOpacity>
                )}
                <Text style={styles.inputHint}>{t('dateFormatHint')}</Text>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setEditingProfile(userProfile);
                  setShowProfileEditor(false);
                }}
              >
                <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.saveButton, isUpdating && styles.buttonDisabled]}
                onPress={updateUserProfile}
                disabled={isUpdating}
              >
                <Check size={16} color="#fff" />
                <Text style={styles.saveButtonText}>
                  {isUpdating ? t('saving') : t('save')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Native Date Picker for React Native */}
      {Platform.OS !== 'web' && showDatePicker && (
        <View style={styles.datePickerContainer}>
          <View style={styles.datePickerModal}>
            <View style={styles.datePickerHeader}>
              <TouchableOpacity onPress={cancelDateSelection} style={styles.datePickerButton}>
                <Text style={styles.datePickerButtonText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <Text style={styles.datePickerTitle}>{t('dateOfBirth')}</Text>
              <TouchableOpacity onPress={confirmDateSelection} style={styles.datePickerButton}>
                <Text style={[styles.datePickerButtonText, styles.datePickerOkButton]}>OK</Text>
              </TouchableOpacity>
            </View>
            <RNDateTimePicker
              value={getDateValue()}
              mode="date"
              display="spinner"
              onChange={handleDateChange}
              maximumDate={new Date()}
              minimumDate={new Date(1900, 0, 1)}
              textColor="#fff"
              style={styles.datePicker}
            />
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  desktopContainer: {
    flex: 1,
    maxWidth: Platform.OS === 'web' ? 1024 : undefined,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: 120,
    height: 32,
  },
  userSection: {
    padding: 20,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  userIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userId: {
    color: '#888',
    fontSize: 14,
    marginRight: 8,
  },
  copyButton: {
    padding: 4,
  },
  signInButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  signInText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  subscribeButton: {
    backgroundColor: '#FF1B8D',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  subscribeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  menuSection: {
    paddingHorizontal: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  menuText: {
    color: '#fff',
    fontSize: 16,
    flex: 1,
    marginLeft: 16,
  },
  profileInfoContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
  },
  profileInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  profileInfoContent: {
    flex: 1,
    marginLeft: 12,
  },
  profileInfoLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 2,
  },
  profileInfoValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#2a2a2a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    minHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  modalContent: {
    padding: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#444',
  },
  inputHint: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#FF1B8D',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  dateText: {
    color: '#fff',
    fontSize: 16,
  },
  placeholderText: {
    color: '#666',
  },
  datePickerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  datePickerModal: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    margin: 20,
    overflow: 'hidden',
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  datePickerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  datePickerButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  datePickerButtonText: {
    color: '#888',
    fontSize: 16,
  },
  datePickerOkButton: {
    color: '#FF1B8D',
    fontWeight: '600',
  },
  datePicker: {
    backgroundColor: '#2a2a2a',
    color: '#fff',
  },
  biometricContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
  },
  biometricItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  biometricIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 27, 141, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  biometricContent: {
    flex: 1,
  },
  biometricTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  biometricDescription: {
    color: '#888',
    fontSize: 14,
  },
  biometricToggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#444',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  biometricToggleActive: {
    backgroundColor: '#FF1B8D',
  },
  biometricToggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  biometricToggleThumbActive: {
    alignSelf: 'flex-end',
  },
});