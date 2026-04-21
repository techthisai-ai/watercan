import React, { useContext, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthContext } from '../../App';
import AppIcon from '../components/AppIcon';
import { RootStackParamList } from '../navigation/AppNavigator';
import { signInWithPhone } from '../services/firebaseService';
import { useLang } from '../i18n/LanguageContext';
import { createShadow } from '../styles/shadows';
import { theme, typography } from '../styles/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const LoginScreen = ({ navigation }: Props) => {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { profile, authError } = useContext(AuthContext);
  const { t } = useLang();

  React.useEffect(() => {
    if (authError) {
      setErrorMessage(authError);
    }
  }, [authError]);

  const handleLogin = async () => {
    if (!phone.trim()) {
      setErrorMessage('Please provide your phone number.');
      return;
    }
    setLoading(true);
    setErrorMessage('');
    try {
      await signInWithPhone(phone.trim());
    } catch (error: any) {
      const code = error?.code as string | undefined;
      if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
        setErrorMessage('Phone number not found. Please sign up first.');
        navigation.navigate('Signup');
      } else if (code === 'auth/network-request-failed') {
        setErrorMessage('Connection blocked. Disable browser blocker or extension and try again.');
      } else {
        setErrorMessage(error.message || 'Unable to sign in.');
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
              <Text style={styles.brandTag}>Light, clean, fast ordering</Text>
            </View>
          </View>
          <Text style={styles.title}>{t.signInTitle}</Text>
          <Text style={styles.subtitle}>
            A lighter iPhone-style layout with your deliveries, payments, and account actions exactly where users expect them.
          </Text>
          <View style={styles.featureRow}>
            <View style={styles.featureChip}>
              <AppIcon name="star-outline" size={16} color={theme.colors.primary} />
              <Text style={styles.featureText}>Fast sign-in</Text>
            </View>
            <View style={styles.featureChip}>
              <AppIcon name="shield-checkmark-outline" size={16} color={theme.colors.secondary} />
              <Text style={styles.featureText}>Secure access</Text>
            </View>
          </View>
        </View>

        <View style={styles.formCard}>
          <View style={styles.inputLabelRow}>
            <Text style={styles.formLabel}>{t.phoneNumber}</Text>
            <AppIcon name="call-outline" size={16} color={theme.colors.textTertiary} />
          </View>
          <View style={styles.inputShell}>
            <AppIcon name="phone-portrait-outline" size={18} color={theme.colors.textTertiary} />
            <TextInput
              style={styles.input}
              placeholder="+91 99000 02222"
              placeholderTextColor={theme.colors.textTertiary}
              value={phone}
              keyboardType="phone-pad"
              onChangeText={setPhone}
            />
          </View>
          <Text style={styles.helperText}>Use the same number you registered with, including the country code.</Text>
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

          <View style={styles.secondaryCard}>
            <AppIcon name="lock-closed-outline" size={18} color={theme.colors.textSecondary} />
            <Text style={styles.secondaryCardText}>
              Customers can order after approval. Owners get order, inventory, and customer controls.
            </Text>
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
  brandTag: {
    marginTop: 4,
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700'
  },
  title: {
    ...typography.title,
    color: theme.colors.text,
    marginTop: 20
  },
  subtitle: {
    ...typography.body,
    color: theme.colors.textSecondary,
    marginTop: 10
  },
  featureRow: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap'
  },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.colors.stroke
  },
  featureText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700'
  },
  formCard: {
    marginTop: 18,
    backgroundColor: theme.colors.surface,
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: theme.colors.stroke,
    ...createShadow({ color: '#163456', opacity: 0.1, radius: 20, elevation: 8 })
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
    gap: 10,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.stroke,
    paddingHorizontal: 14
  },
  input: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 17,
    paddingVertical: 15
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
  secondaryCard: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 18,
    padding: 14
  },
  secondaryCardText: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20
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
