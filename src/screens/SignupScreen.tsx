import React, { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppIcon from '../components/AppIcon';
import { RootStackParamList } from '../navigation/AppNavigator';
import { getFriendlyFirebaseAuthMessage, registerUserWithPhone } from '../services/firebaseService';
import { useLang } from '../i18n/LanguageContext';
import { createShadow } from '../styles/shadows';
import { theme } from '../styles/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Signup'>;

const PHONE_COUNTRY_CODE = '+91';
const normalizePhoneInput = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return digits.startsWith('91') && digits.length > 10
    ? digits.slice(2, 12)
    : digits.slice(0, 10);
};

const SignupScreen = ({ navigation, route }: Props) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState(() => normalizePhoneInput(route.params?.phone ?? ''));
  const [doorNo, setDoorNo] = useState('');
  const [street, setStreet] = useState('');
  const [place, setPlace] = useState('');
  const [role, setRole] = useState<'customer' | 'owner'>('customer');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [focusedField, setFocusedField] = useState<'phone' | 'name' | 'door_no' | 'street' | 'place' | null>(null);
  const { t } = useLang();
  const address = [doorNo.trim(), street.trim(), place.trim()].filter(Boolean).join(', ');

  const handleSignup = async () => {
    if (!name.trim() || !phone.trim() || !address.trim()) {
      setErrorMessage('Please provide your phone number, full name, and address.');
      return;
    }
    if (phone.length !== 10) {
      setErrorMessage('Please enter a valid 10 digit phone number.');
      return;
    }
    setLoading(true);
    setErrorMessage('');
    try {
      await registerUserWithPhone(name.trim(), phone.trim(), role, address.trim());
      // Navigation is handled automatically by AppNavigator based on profile.role
    } catch (error: any) {
      setErrorMessage(getFriendlyFirebaseAuthMessage(error, 'signup'));
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneChange = (value: string) => {
    setPhone(normalizePhoneInput(value));
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topGlow} />
      <View style={styles.bottomGlow} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.heroCard}>
          <View style={styles.headerRow}>
            <View style={styles.heroIcon}>
              <AppIcon name="person-add-outline" size={26} color={theme.colors.primary} />
            </View>
            <Pressable style={styles.backChip} onPress={() => navigation.navigate('Login')}>
              <AppIcon name="chevron-back" size={16} color={theme.colors.text} />
              <Text style={styles.backChipText}>{t.signIn}</Text>
            </Pressable>
          </View>
          <View style={styles.heroFields}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t.fullName}</Text>
              <View style={[styles.inputShell, focusedField === 'name' && styles.inputShellFocused]}>
                <View style={styles.inputIconCell}>
                  <AppIcon name="person-outline" size={18} color={focusedField === 'name' ? theme.colors.primary : theme.colors.textTertiary} />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Your full name"
                  placeholderTextColor={theme.colors.textTertiary}
                  value={name}
                  onChangeText={setName}
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t.phoneNumber}</Text>
              <View style={[styles.inputShell, focusedField === 'phone' && styles.inputShellFocused]}>
                <View style={styles.inputIconCell}>
                  <AppIcon name="call-outline" size={18} color={focusedField === 'phone' ? theme.colors.primary : theme.colors.textTertiary} />
                </View>
                <Text style={styles.phonePrefix}>{PHONE_COUNTRY_CODE}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="9900001111"
                  placeholderTextColor={theme.colors.textTertiary}
                  value={phone}
                  keyboardType="phone-pad"
                  maxLength={10}
                  onChangeText={handlePhoneChange}
                  onFocus={() => setFocusedField('phone')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
              <Text style={styles.helperText}>Enter your 10 digit phone number.</Text>
            </View>

            <View style={styles.inputGroupLast}>
              <Text style={styles.label}>{t.deliveryAddress}</Text>
              <View style={styles.addressFields}>
                <View style={[styles.inputShell, focusedField === 'door_no' && styles.inputShellFocused]}>
                  <View style={styles.inputIconCell}>
                    <AppIcon name="location-outline" size={18} color={focusedField === 'door_no' ? theme.colors.primary : theme.colors.textTertiary} />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Door No"
                    placeholderTextColor={theme.colors.textTertiary}
                    value={doorNo}
                    onChangeText={setDoorNo}
                    onFocus={() => setFocusedField('door_no')}
                    onBlur={() => setFocusedField(null)}
                  />
                </View>
                <View style={[styles.inputShell, focusedField === 'street' && styles.inputShellFocused]}>
                  <View style={styles.inputIconCell}>
                    <AppIcon name="navigate-outline" size={18} color={focusedField === 'street' ? theme.colors.primary : theme.colors.textTertiary} />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Street"
                    placeholderTextColor={theme.colors.textTertiary}
                    value={street}
                    onChangeText={setStreet}
                    onFocus={() => setFocusedField('street')}
                    onBlur={() => setFocusedField(null)}
                  />
                </View>
                <View style={[styles.inputShell, focusedField === 'place' && styles.inputShellFocused]}>
                  <View style={styles.inputIconCell}>
                    <AppIcon name="business-outline" size={18} color={focusedField === 'place' ? theme.colors.primary : theme.colors.textTertiary} />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Place"
                    placeholderTextColor={theme.colors.textTertiary}
                    value={place}
                    onChangeText={setPlace}
                    onFocus={() => setFocusedField('place')}
                    onBlur={() => setFocusedField(null)}
                  />
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.formCard}>
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <Text style={styles.roleHeading}>{t.chooseAccountType}</Text>
          <View style={styles.roleRow}>
            <Pressable
              style={[styles.roleCard, styles.customerCard, role === 'customer' && styles.customerCardActive]}
              onPress={() => setRole('customer')}
            >
              <View style={styles.roleCardTop}>
                <View style={[styles.roleIcon, styles.customerIcon, role === 'customer' && styles.customerIconActive]}>
                  <AppIcon name="home-outline" size={22} color={role === 'customer' ? '#fff' : '#1A7FD4'} />
                </View>
                {role === 'customer' && (
                  <View style={styles.selectedBadge}>
                    <AppIcon name="checkmark-circle" size={18} color="#1A7FD4" />
                  </View>
              )}
              </View>
              <Text style={[styles.roleTitle, role === 'customer' && styles.customerTitleActive]}>{t.customer}</Text>
            </Pressable>

            <Pressable
              style={[styles.roleCard, styles.ownerCard, role === 'owner' && styles.ownerCardActive]}
              onPress={() => setRole('owner')}
            >
              <View style={styles.roleCardTop}>
                <View style={[styles.roleIcon, styles.ownerIcon, role === 'owner' && styles.ownerIconActive]}>
                  <AppIcon name="business-outline" size={22} color={role === 'owner' ? '#fff' : '#1E7A45'} />
                </View>
                {role === 'owner' && (
                  <View style={styles.selectedBadge}>
                    <AppIcon name="checkmark-circle" size={18} color="#1E7A45" />
                  </View>
              )}
              </View>
              <Text style={[styles.roleTitle, role === 'owner' && styles.ownerTitleActive]}>{t.owner}</Text>
            </Pressable>
          </View>

          <Pressable style={[styles.primaryButton, loading && styles.buttonDisabled]} onPress={handleSignup} disabled={loading}>
            <AppIcon name="star-outline" size={18} color="#fff" />
            <Text style={styles.primaryButtonText}>{loading ? t.creatingAccount : t.createAccount}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  topGlow: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#E2EEFF'
  },
  bottomGlow: {
    position: 'absolute',
    bottom: -40,
    left: -20,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: '#EDF4FF'
  },
  content: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center'
  },
  heroCard: {
    borderRadius: 30,
    padding: 22,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: theme.colors.stroke,
    ...createShadow({ color: '#163456', opacity: 0.1, radius: 24, elevation: 8 })
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft
  },
  backChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceMuted
  },
  backChipText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700'
  },
  heroFields: {
    marginTop: 18,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: theme.colors.stroke
  },
  formCard: {
    marginTop: 18,
    backgroundColor: theme.colors.surface,
    borderRadius: 30,
    padding: 22,
    borderWidth: 1,
    borderColor: theme.colors.stroke,
    ...createShadow({ color: '#163456', opacity: 0.1, radius: 22, elevation: 8 })
  },
  inputGroup: {
    marginBottom: 14
  },
  inputGroupLast: {
    marginBottom: 0
  },
  addressFields: {
    gap: 10
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 10
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.stroke,
    borderRadius: 20,
    overflow: 'hidden'
  },
  inputShellFocused: {
    borderColor: '#1A7FD4',
    backgroundColor: '#EAF4FF',
    ...createShadow({ color: '#1A7FD4', opacity: 0.18, radius: 10, elevation: 3 })
  },
  inputIconCell: {
    width: 44,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.28)'
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    paddingRight: 14,
    color: theme.colors.text,
    fontSize: 16,
    outlineStyle: 'none'
  },
  phonePrefix: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '800',
    paddingLeft: 12,
    paddingRight: 8
  },
  helperText: {
    marginTop: 8,
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 18
  },
  errorText: {
    color: theme.colors.danger,
    fontWeight: '700',
    marginBottom: 12
  },
  roleHeading: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
    marginBottom: 12
  },
  roleRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18
  },
  roleCard: {
    flex: 1,
    borderRadius: 22,
    padding: 16,
    minHeight: 118,
    borderWidth: 2,
    borderColor: theme.colors.stroke,
    backgroundColor: theme.colors.surfaceMuted,
    justifyContent: 'space-between'
  },
  customerCard: {
    borderColor: '#C8DFF5',
    backgroundColor: '#F0F7FF'
  },
  customerCardActive: {
    borderColor: '#1A7FD4',
    backgroundColor: '#E0F0FF'
  },
  ownerCard: {
    borderColor: '#C8E6D0',
    backgroundColor: '#F0FBF4'
  },
  ownerCardActive: {
    borderColor: '#1E7A45',
    backgroundColor: '#E0F5E9'
  },
  roleCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  roleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center'
  },
  customerIcon: {
    backgroundColor: '#C8DFF5'
  },
  customerIconActive: {
    backgroundColor: '#1A7FD4'
  },
  ownerIcon: {
    backgroundColor: '#C8E6D0'
  },
  ownerIconActive: {
    backgroundColor: '#1E7A45'
  },
  selectedBadge: {
    alignSelf: 'flex-start'
  },
  roleTitle: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center'
  },
  customerTitleActive: {
    color: '#1A7FD4'
  },
  ownerTitleActive: {
    color: '#1E7A45'
  },
  primaryButton: {
    marginTop: 0,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800'
  },
  buttonDisabled: {
    opacity: 0.7
  }
});

export default SignupScreen;
