import React, { useContext, useEffect, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from '../../App';
import AppIcon from '../components/AppIcon';
import ScreenHeader from '../components/ScreenHeader';
import { useLang } from '../i18n/LanguageContext';
import { Language } from '../i18n/translations';
import { updateUserProfile } from '../services/firebaseService';
import { createShadow } from '../styles/shadows';
import { theme } from '../styles/theme';

const ProfileScreen = () => {
  const { profile, signOut, setProfile } = useContext(AuthContext);
  const { language, setLanguage, t } = useLang();
  const LANGUAGES: Language[] = ['English', 'Tamil'];
  const [address, setAddress] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setAddress(profile?.address ?? '');
    setEditing(!profile?.address?.trim());
  }, [profile]);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    setMessage('');
    const nextAddress = address.trim();
    setProfile((current) => (current ? { ...current, address: nextAddress } : current));
    try {
      await updateUserProfile(profile.uid, { address: nextAddress });
      setMessage(t.addressSaved);
    } catch {
      setMessage(t.addressSavedLocally);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <ScreenHeader back title={t.profile} subtitle="" />

        <View style={styles.heroCard}>
          <View style={styles.avatar}>
            <AppIcon name="person" size={30} color={theme.colors.primary} />
          </View>
          <View style={styles.heroBody}>
            <Text style={styles.name}>{profile?.name ?? 'Unknown user'}</Text>
            <Text style={styles.meta}>{profile?.phone ?? 'No phone available'}</Text>
            <View style={styles.badgeRow}>
              <View style={styles.badge}>
                <AppIcon name={profile?.role === 'owner' ? 'business-outline' : 'home-outline'} size={14} color={theme.colors.primary} />
                <Text style={styles.badgeText}>{profile?.role === 'owner' ? t.owner : t.customer}</Text>
              </View>
              {profile?.role === 'customer' ? (
                <View style={[styles.badge, profile.approved ? styles.approvedBadge : styles.pendingBadge]}>
                  <AppIcon
                    name={profile.approved ? 'checkmark-circle' : 'time-outline'}
                    size={14}
                    color={profile.approved ? theme.colors.secondary : theme.colors.warning}
                  />
                  <Text style={styles.badgeText}>{profile.approved ? t.approved : t.pendingApproval}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionTitle}>{t.deliveryAddress}</Text>
            {!editing && profile?.address?.trim() ? (
              <Pressable style={styles.editButton} onPress={() => { setEditing(true); setMessage(''); }}>
                <AppIcon name="pencil-outline" size={15} color={theme.colors.primary} />
                <Text style={styles.editButtonText}>{t.edit}</Text>
              </Pressable>
            ) : null}
          </View>

          {!editing && profile?.address?.trim() ? (
            <View style={styles.addressDisplay}>
              <AppIcon name="location-outline" size={18} color={theme.colors.primary} />
              <Text style={styles.addressDisplayText}>{profile.address.trim()}</Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionSubtitle}>{t.keepAddressUpdated}</Text>
              <TextInput
                style={styles.input}
                value={address}
                onChangeText={setAddress}
                placeholder={t.addAddress}
                placeholderTextColor={theme.colors.textTertiary}
                multiline
                numberOfLines={4}
                autoFocus={editing && !!profile?.address?.trim()}
              />
              <View style={styles.buttonRow}>
                {profile?.address?.trim() ? (
                  <Pressable style={styles.cancelButton} onPress={() => { setAddress(profile.address ?? ''); setEditing(false); setMessage(''); }}>
                    <Text style={styles.cancelButtonText}>{t.cancel}</Text>
                  </Pressable>
                ) : null}
                <Pressable style={[styles.primaryButton, saving && styles.disabled, profile?.address?.trim() ? styles.primaryButtonFlex : null]} onPress={handleSave} disabled={saving}>
                  <AppIcon name="save-outline" size={18} color="#fff" />
                  <Text style={styles.primaryButtonText}>{saving ? t.saving : t.saveAddress}</Text>
                </Pressable>
              </View>
            </>
          )}
          {message ? <Text style={styles.messageText}>{message}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t.language}</Text>
          <Text style={styles.sectionSubtitle}>{t.chooseLanguage}</Text>
          <View style={styles.langRow}>
            {LANGUAGES.map(lang => (
              <Pressable
                key={lang}
                style={[styles.langChip, language === lang && styles.langChipSelected]}
                onPress={() => setLanguage(lang)}
              >
                <Text style={[styles.langChipText, language === lang && styles.langChipTextSelected]}>
                  {lang === 'Tamil' ? 'தமிழ்' : 'English'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable style={styles.signOutButton} onPress={signOut}>
          <AppIcon name="log-out-outline" size={18} color={theme.colors.danger} />
          <Text style={styles.signOutText}>{t.signOut}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  content: {
    flex: 1,
    padding: 18
  },
  heroCard: {
    flexDirection: 'row',
    gap: 14,
    borderRadius: 28,
    padding: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.stroke,
    ...createShadow({ color: '#163456', opacity: 0.1, radius: 18, elevation: 6 })
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft
  },
  heroBody: {
    flex: 1
  },
  name: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '800'
  },
  meta: {
    marginTop: 6,
    color: theme.colors.textSecondary,
    fontSize: 14
  },
  badgeRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap'
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  approvedBadge: {
    backgroundColor: '#F1FBF4'
  },
  pendingBadge: {
    backgroundColor: '#FFF7EA'
  },
  badgeText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '700'
  },
  card: {
    marginTop: 16,
    borderRadius: 28,
    padding: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.stroke,
    ...createShadow({ color: '#163456', opacity: 0.1, radius: 18, elevation: 6 })
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.primarySoft,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  editButtonText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '700'
  },
  addressDisplay: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 18,
    padding: 14,
    alignItems: 'flex-start'
  },
  addressDisplayText: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16
  },
  cancelButton: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.stroke,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cancelButtonText: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    fontWeight: '700'
  },
  primaryButtonFlex: {
    flex: 1,
    marginTop: 0
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '800'
  },
  sectionSubtitle: {
    marginTop: 6,
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 21
  },
  input: {
    marginTop: 16,
    borderRadius: 22,
    padding: 16,
    minHeight: 112,
    textAlignVertical: 'top',
    color: theme.colors.text,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.stroke
  },
  primaryButton: {
    marginTop: 16,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800'
  },
  disabled: {
    opacity: 0.7
  },
  messageText: {
    marginTop: 12,
    color: theme.colors.textSecondary,
    fontWeight: '600'
  },
  signOutButton: {
    marginTop: 16,
    borderRadius: 18,
    paddingVertical: 15,
    backgroundColor: '#FFF4F3',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8
  },
  signOutText: {
    color: theme.colors.danger,
    fontSize: 15,
    fontWeight: '800'
  },
  langRow: {
    flexDirection: 'row', gap: 10, marginTop: 14, flexWrap: 'wrap'
  },
  langChip: {
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 999, borderWidth: 1,
    borderColor: theme.colors.stroke,
    backgroundColor: theme.colors.surfaceMuted
  },
  langChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary
  },
  langChipText: {
    color: theme.colors.text, fontSize: 14, fontWeight: '700'
  },
  langChipTextSelected: {
    color: '#fff'
  }
});

export default ProfileScreen;
