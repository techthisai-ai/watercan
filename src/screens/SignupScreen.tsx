import React, { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppIcon from '../components/AppIcon';
import { RootStackParamList } from '../navigation/AppNavigator';
import { registerUserWithPhone } from '../services/firebaseService';
import { useLang } from '../i18n/LanguageContext';
import { createShadow } from '../styles/shadows';
import { theme, typography } from '../styles/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Signup'>;

const SignupScreen = ({ navigation }: Props) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'customer' | 'owner'>('customer');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { t } = useLang();

  const handleSignup = async () => {
    if (!name.trim() || !phone.trim()) {
      setErrorMessage('Please provide your name and phone number.');
      return;
    }
    setLoading(true);
    setErrorMessage('');
    try {
      const profile = await registerUserWithPhone(name.trim(), phone.trim(), role);
      // Navigation is handled automatically by AppNavigator based on profile.role
    } catch (error: any) {
      setErrorMessage(error.message || 'Unable to create account.');
    } finally {
      setLoading(false);
    }
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
          <Text style={styles.title}>Create a clean, simple delivery account</Text>
          <Text style={styles.subtitle}>
            Choose whether this account manages deliveries or places them. The design follows a light iPhone-style layout with roomy cards and clear actions.
          </Text>
        </View>

        <View style={styles.formCard}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t.fullName}</Text>
            <View style={styles.inputShell}>
              <AppIcon name="person-outline" size={18} color={theme.colors.textTertiary} />
              <TextInput
                style={styles.input}
                placeholder="Your full name"
                placeholderTextColor={theme.colors.textTertiary}
                value={name}
                onChangeText={setName}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t.phoneNumber}</Text>
            <View style={styles.inputShell}>
              <AppIcon name="call-outline" size={18} color={theme.colors.textTertiary} />
              <TextInput
                style={styles.input}
                placeholder="+91 99000 01111"
                placeholderTextColor={theme.colors.textTertiary}
                value={phone}
                keyboardType="phone-pad"
                onChangeText={setPhone}
              />
            </View>
            <Text style={styles.helperText}>Include the country code so sign-in matches your account record.</Text>
          </View>

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <Text style={styles.roleHeading}>{t.chooseAccountType}</Text>
          <View style={styles.roleRow}>
            <Pressable
              style={[styles.roleCard, role === 'customer' && styles.roleCardActive]}
              onPress={() => setRole('customer')}
            >
              <View style={[styles.roleIcon, role === 'customer' && styles.roleIconActive]}>
                <AppIcon
                  name="home-outline"
                  size={18}
                  color={role === 'customer' ? theme.colors.primary : theme.colors.textSecondary}
                />
              </View>
              <Text style={[styles.roleTitle, role === 'customer' && styles.roleTitleActive]}>{t.customer}</Text>
              <Text style={styles.roleDescription}>Order water, track deliveries, manage subscriptions.</Text>
            </Pressable>

            <Pressable
              style={[styles.roleCard, role === 'owner' && styles.roleCardActive]}
              onPress={() => setRole('owner')}
            >
              <View style={[styles.roleIcon, role === 'owner' && styles.roleIconActive]}>
                <AppIcon
                  name="business-outline"
                  size={18}
                  color={role === 'owner' ? theme.colors.primary : theme.colors.textSecondary}
                />
              </View>
              <Text style={[styles.roleTitle, role === 'owner' && styles.roleTitleActive]}>{t.owner}</Text>
              <Text style={styles.roleDescription}>Run orders, inventory, approvals, and customer operations.</Text>
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
  title: {
    ...typography.title,
    color: theme.colors.text
  },
  subtitle: {
    ...typography.body,
    color: theme.colors.textSecondary,
    marginTop: 10
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
    gap: 10,
    paddingHorizontal: 14,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.stroke,
    borderRadius: 20
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    color: theme.colors.text,
    fontSize: 16
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
    gap: 12
  },
  roleCard: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.stroke
  },
  roleCardActive: {
    borderColor: '#B8D6FF',
    backgroundColor: '#F2F8FF'
  },
  roleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface
  },
  roleIconActive: {
    backgroundColor: theme.colors.primarySoft
  },
  roleTitle: {
    marginTop: 12,
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '800'
  },
  roleTitleActive: {
    color: theme.colors.primary
  },
  roleDescription: {
    marginTop: 6,
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20
  },
  primaryButton: {
    marginTop: 18,
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
