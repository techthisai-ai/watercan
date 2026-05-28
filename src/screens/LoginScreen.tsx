import React, { useContext, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthContext } from '../../App';
import AppIcon from '../components/AppIcon';
import { RootStackParamList } from '../navigation/AppNavigator';
import { getFriendlyFirebaseAuthMessage, signInWithPhone } from '../services/firebaseService';
import { useLang } from '../i18n/LanguageContext';
import { createShadow } from '../styles/shadows';
import { theme } from '../styles/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const PHONE_COUNTRY_CODE = '+91';
const normalizePhoneInput = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return digits.startsWith('91') && digits.length > 10
    ? digits.slice(2, 12)
    : digits.slice(0, 10);
};

const LoginScreen = ({ navigation }: Props) => {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [phoneFocused, setPhoneFocused] = useState(false);
  const { profile, authError } = useContext(AuthContext);
  const { t } = useLang();

  React.useEffect(() => {
    if (authError) {
      setErrorMessage(authError);
    }
  }, [authError]);

  const handlePhoneChange = (value: string) => {
    setPhone(normalizePhoneInput(value));
  };

  const handleLogin = async () => {
    if (!phone.trim()) {
      setErrorMessage('Please provide your phone number.');
      return;
    }
    if (phone.length !== 10) {
      setErrorMessage('Please enter a valid 10 digit phone number.');
      return;
    }
    setLoading(true);
    setErrorMessage('');
    try {
      await signInWithPhone(phone.trim());
      // Navigation handled automatically by onAuthStateChanged in App.tsx
    } catch (error: any) {
      const code = error?.code as string | undefined;
      if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
        setErrorMessage('Phone number not found. Please sign up first.');
        navigation.navigate('Signup', { phone: phone.trim() });
      } else {
        setErrorMessage(getFriendlyFirebaseAuthMessage(error, 'login'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topGlow} />
      <View style={styles.bottomGlow} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.brandRow}>
            <View style={styles.brandIcon}>
              <AppIcon name="water" size={28} color={theme.colors.primary} />
            </View>
            <View style={styles.brandCopy}>
              <Text style={styles.brand}>{t.appName}</Text>
            </View>
          </View>
          <View style={styles.loginPanel}>
            <View style={styles.inputLabelRow}>
              <Text style={styles.formLabel}>{t.phoneNumber}</Text>
              <AppIcon name="call-outline" size={16} color={theme.colors.textTertiary} />
            </View>
            <View style={[styles.inputShell, phoneFocused && styles.inputShellFocused]}>
              <View style={styles.inputIconCell}>
                <AppIcon name="phone-portrait-outline" size={18} color={phoneFocused ? theme.colors.primary : theme.colors.textTertiary} />
              </View>
              <Text style={styles.phonePrefix}>{PHONE_COUNTRY_CODE}</Text>
              <TextInput
                style={styles.input}
                placeholder="9900002222"
                placeholderTextColor={theme.colors.textTertiary}
                value={phone}
                keyboardType="phone-pad"
                maxLength={10}
                onChangeText={handlePhoneChange}
                onFocus={() => setPhoneFocused(true)}
                onBlur={() => setPhoneFocused(false)}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
            </View>
            <Text style={styles.helperText}>Enter the 10 digit phone number you registered with.</Text>
            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed,
                loading && styles.buttonDisabled
              ]}
              onPress={handleLogin}
              disabled={loading}
            >
              <AppIcon name="arrow-forward-circle" size={18} color="#fff" />
              <Text style={styles.primaryButtonText}>{loading ? t.signingIn : t.continue}</Text>
            </Pressable>
          </View>
        </View>

        <Pressable style={styles.linkButton} onPress={() => navigation.navigate('Signup')}>
          <Text style={styles.linkButtonText}>{t.createNewAccount}</Text>
          <AppIcon name="chevron-forward" size={16} color={theme.colors.primary} />
        </Pressable>

        {profile ? <Text style={styles.roleTag}>Signed in as {profile.role}</Text> : null}
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
    top: -70,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#E3F0FF'
  },
  bottomGlow: {
    position: 'absolute',
    bottom: -40,
    left: -20,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#EEF4FF'
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 28
  },
  hero: {
    padding: 24,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderWidth: 1,
    borderColor: theme.colors.stroke,
    ...createShadow({ color: '#163456', opacity: 0.1, radius: 24, elevation: 8 })
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14
  },
  brandIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft
  },
  brandCopy: {
    flex: 1
  },
  brand: {
    fontSize: 28,
    fontWeight: '900',
    color: theme.colors.text
  },
  loginPanel: {
    marginTop: 16
  },
  inputLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  formLabel: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.stroke,
    overflow: 'hidden'
  },
  inputShellFocused: {
    borderColor: '#1A7FD4',
    backgroundColor: '#EAF4FF',
    ...createShadow({ color: '#1A7FD4', opacity: 0.18, radius: 10, elevation: 3 })
  },
  inputIconCell: {
    width: 42,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.28)'
  },
  input: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 17,
    paddingVertical: 15,
    paddingRight: 14,
    outlineStyle: 'none'
  },
  phonePrefix: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: '800',
    paddingLeft: 12,
    paddingRight: 8
  },
  helperText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10
  },
  errorText: {
    color: theme.colors.danger,
    fontWeight: '700',
    marginTop: 8
  },
  primaryButton: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 20,
    paddingVertical: 16
  },
  primaryButtonPressed: {
    opacity: 0.9
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800'
  },
  buttonDisabled: {
    opacity: 0.7
  },
  linkButton: {
    marginTop: 18,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  linkButtonText: {
    color: theme.colors.primary,
    fontSize: 15,
    fontWeight: '800'
  },
  roleTag: {
    marginTop: 20,
    textAlign: 'center',
    color: theme.colors.textSecondary,
    fontWeight: '600'
  }
});

export default LoginScreen;
