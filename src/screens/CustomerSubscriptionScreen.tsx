import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useContext } from 'react';
import { AuthContext } from '../../App';
import AppIcon from '../components/AppIcon';
import CustomerBottomNav from '../components/CustomerBottomNav';
import ScreenHeader from '../components/ScreenHeader';
import { useLang } from '../i18n/LanguageContext';
import { createShadow } from '../styles/shadows';
import { theme } from '../styles/theme';

const CustomerSubscriptionScreen = () => {
  const { t } = useLang();
  const { profile } = useContext(AuthContext);
  const storageKey = `customerSubscription_${profile?.uid ?? 'guest'}`;
  const [showForm, setShowForm] = useState(false);
  const [qty, setQty] = useState(0);
  const [qtyText, setQtyText] = useState('0');
  const [frequency, setFrequency] = useState<'Daily' | 'Weekly' | 'Monthly'>('Daily');
  const [time, setTime] = useState<'Morning' | 'Afternoon' | 'Evening'>('Morning');
  const [activeSubscription, setActiveSubscription] = useState<{
    qty: number;
    frequency: 'Daily' | 'Weekly' | 'Monthly';
    time: 'Morning' | 'Afternoon' | 'Evening';
  } | null>(null);
  const [loaded, setLoaded] = useState(false);

  const loadSubscription = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.qty && parsed?.frequency && parsed?.time) {
          setActiveSubscription(parsed);
          setShowForm(false);
        } else {
          setActiveSubscription(null);
          setShowForm(false);
        }
      } else {
        setActiveSubscription(null);
        setShowForm(false);
      }
    } catch {
      setActiveSubscription(null);
      setShowForm(false);
    } finally {
      setLoaded(true);
    }
  }, [storageKey]);

  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  useFocusEffect(
    useCallback(() => {
      loadSubscription();
    }, [loadSubscription])
  );

  const handleSave = async () => {
    const payload = { qty, frequency, time };
    await AsyncStorage.setItem(storageKey, JSON.stringify(payload));
    setActiveSubscription(payload);
    setShowForm(false);
  };

  const syncQty = (value: number) => {
    const next = Math.max(0, value);
    setQty(next);
    setQtyText(String(next));
  };

  const handleQtyChange = (value: string) => {
    const digitsOnly = value.replace(/[^0-9]/g, '');
    setQtyText(digitsOnly);
    if (!digitsOnly) {
      return;
    }
    const parsed = parseInt(digitsOnly, 10);
    if (Number.isFinite(parsed)) {
      setQty(Math.max(0, parsed));
    }
  };

  const handleQtyBlur = () => {
    if (!qtyText.trim()) {
      syncQty(0);
      return;
    }
    const parsed = parseInt(qtyText, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      syncQty(0);
      return;
    }
    syncQty(parsed);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t.subscriptionTitle} subtitle={t.subscriptionSubtitle} />

        {loaded && !activeSubscription && !showForm ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <AppIcon name="calendar-outline" size={28} color={theme.colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>{t.noSubscription}</Text>
            <Text style={styles.emptyText}>{t.noSubscriptionText}</Text>
            <Pressable style={styles.primaryButton} onPress={() => setShowForm(true)}>
              <AppIcon name="add-circle-outline" size={18} color="#fff" />
              <Text style={styles.primaryButtonText}>{t.createSubscription}</Text>
            </Pressable>
          </View>
        ) : null}

        {showForm ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t.planDetails}</Text>
            <Text style={styles.cardSubtitle}>{t.planDetailsSubtitle}</Text>

            <Text style={styles.label}>{t.quantity}</Text>
            <View style={styles.qtyShell}>
              <AppIcon name="cube-outline" size={18} color={theme.colors.textTertiary} />
              <TextInput
                style={styles.qtyInput}
                value={qtyText}
                onChangeText={handleQtyChange}
                onBlur={handleQtyBlur}
                keyboardType="number-pad"
                returnKeyType="done"
                selectTextOnFocus
                maxLength={3}
                placeholder="0"
                placeholderTextColor={theme.colors.textTertiary}
              />
            </View>

            <Text style={styles.label}>{t.frequency}</Text>
            <View style={styles.chipRow}>
              {(['Daily', 'Weekly', 'Monthly'] as const).map((option) => (
                <Pressable key={option} style={[styles.choiceChip, frequency === option && styles.choiceChipActive]} onPress={() => setFrequency(option)}>
                  <Text style={[styles.choiceText, frequency === option && styles.choiceTextActive]}>
                    {option === 'Daily' ? t.daily : option === 'Weekly' ? t.weekly : t.monthly}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>{t.preferredTime}</Text>
            <View style={styles.chipRow}>
              {(['Morning', 'Afternoon', 'Evening'] as const).map((option) => (
                <Pressable key={option} style={[styles.choiceChip, time === option && styles.choiceChipActive]} onPress={() => setTime(option)}>
                  <Text style={[styles.choiceText, time === option && styles.choiceTextActive]}>
                    {option === 'Morning' ? t.morning : option === 'Afternoon' ? t.afternoon : t.evening}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {activeSubscription && !showForm ? (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>{t.activePlan}</Text>
              <View style={styles.activeBadge}>
                <AppIcon name="checkmark-circle" size={14} color={theme.colors.secondary} />
                <Text style={styles.activeBadgeText}>{t.activeLabel}</Text>
              </View>
            </View>
            <View style={styles.planRow}>
              <View style={styles.planTile}>
                <Text style={styles.tileLabel}>{t.quantity}</Text>
                <Text style={styles.tileValue}>{activeSubscription.qty} cans</Text>
              </View>
              <View style={styles.planTile}>
                <Text style={styles.tileLabel}>{t.frequency}</Text>
                <Text style={styles.tileValue}>{activeSubscription.frequency === 'Daily' ? t.daily : activeSubscription.frequency === 'Weekly' ? t.weekly : t.monthly}</Text>
              </View>
              <View style={styles.planTile}>
                <Text style={styles.tileLabel}>{t.preferredTime}</Text>
                <Text style={styles.tileValue}>{activeSubscription.time === 'Morning' ? t.morning : activeSubscription.time === 'Afternoon' ? t.afternoon : t.evening}</Text>
              </View>
            </View>
            <Pressable style={styles.secondaryButton} onPress={() => setShowForm(true)}>
              <AppIcon name="create-outline" size={18} color={theme.colors.primary} />
              <Text style={styles.secondaryButtonText}>{t.editSubscription}</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      {showForm ? (
        <View style={styles.bottomBar}>
          <Pressable style={styles.saveButton} onPress={handleSave}>
            <AppIcon name="checkmark-circle-outline" size={18} color="#fff" />
            <Text style={styles.saveButtonText}>{t.saveSubscription}</Text>
          </Pressable>
        </View>
      ) : null}

      <CustomerBottomNav active="CustomerSubscription" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, paddingBottom: 180 },
  bottomBar: {
    paddingHorizontal: 16,
    paddingBottom: 90,
    paddingTop: 12,
    backgroundColor: theme.colors.background,
  },
  saveButton: {
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  emptyState: {
    marginTop: 6,
    borderRadius: 30,
    padding: 24,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.stroke,
    alignItems: 'center',
    ...createShadow({ color: '#163456', opacity: 0.1, radius: 18, elevation: 6 })
  },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft
  },
  emptyTitle: {
    marginTop: 16,
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '800'
  },
  emptyText: {
    marginTop: 8,
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center'
  },
  card: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.stroke,
    ...createShadow({ color: '#163456', opacity: 0.08, radius: 12, elevation: 4 })
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '800'
  },
  cardSubtitle: {
    marginTop: 4,
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18
  },
  label: {
    marginTop: 12,
    marginBottom: 8,
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7
  },
  qtyShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 20,
    paddingHorizontal: 14,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.stroke
  },
  qtyInput: {
    flex: 1,
    paddingVertical: 11,
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: '700'
  },
  chipRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap'
  },
  choiceChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.stroke
  },
  choiceChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary
  },
  choiceText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textSecondary
  },
  choiceTextActive: {
    color: '#fff'
  },
  primaryButton: {
    marginTop: 18,
    borderRadius: 20,
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
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: '#F1FBF4',
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  activeBadgeText: {
    color: theme.colors.secondary,
    fontSize: 12,
    fontWeight: '700'
  },
  planRow: {
    marginTop: 16,
    gap: 10
  },
  planTile: {
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceMuted,
    padding: 14
  },
  tileLabel: {
    color: theme.colors.textTertiary,
    fontSize: 12,
    fontWeight: '700'
  },
  tileValue: {
    marginTop: 6,
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '800'
  },
  secondaryButton: {
    marginTop: 16,
    borderRadius: 18,
    backgroundColor: theme.colors.primarySoft,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8
  },
  secondaryButtonText: {
    color: theme.colors.primary,
    fontSize: 15,
    fontWeight: '800'
  }
});

export default CustomerSubscriptionScreen;
