import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useContext, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AuthContext } from '../../App';
import AppIcon from '../components/AppIcon';
import CustomerBottomNav from '../components/CustomerBottomNav';
import ScreenHeader from '../components/ScreenHeader';
import { fetchWalletBalance, fetchWalletTransactions, rechargeWallet, WalletTransaction } from '../services/firebaseService';
import { useLang } from '../i18n/LanguageContext';
import { createShadow } from '../styles/shadows';
import { theme } from '../styles/theme';

const RECHARGE_OPTIONS = [100, 200, 500, 1000];

const formatDate = (ts: number) =>
  new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const CustomerWalletScreen = () => {
  const { profile } = useContext(AuthContext);
  const { t } = useLang();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [selectedAmount, setSelectedAmount] = useState<number>(100);
  const [loading, setLoading] = useState(true);
  const [recharging, setRecharging] = useState(false);

  const loadWallet = useCallback(async () => {
    if (!profile?.uid) return;
    setLoading(true);
    try {
      const [bal, txs] = await Promise.all([
        fetchWalletBalance(profile.uid),
        fetchWalletTransactions(profile.uid)
      ]);
      setBalance(bal);
      setTransactions(txs);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [profile?.uid]);

  useFocusEffect(useCallback(() => { loadWallet(); }, [loadWallet]));

  const handleRecharge = async () => {
    if (!profile?.uid) return;
    setRecharging(true);
    try {
      const newBalance = await rechargeWallet(profile.uid, selectedAmount);
      setBalance(newBalance);
      await loadWallet();
      Alert.alert(t.rechargeSuccess, t.rsAdded.replace('{amt}', String(selectedAmount)));
    } catch {
      Alert.alert(t.rechargeFailed, t.rechargeFailedText);
    } finally {
      setRecharging(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t.walletTitle} subtitle={t.walletSubtitle} />

        {/* Balance card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceTopRow}>
            <View>
              <Text style={styles.balanceLabel}>{t.currentBalance}</Text>
              {loading ? (
                <ActivityIndicator style={{ marginTop: 10 }} color={theme.colors.primary} />
              ) : (
                <Text style={styles.balanceValue}>Rs {balance}</Text>
              )}
            </View>
            <View style={styles.balanceIcon}>
              <AppIcon name="wallet-outline" size={22} color={theme.colors.primary} />
            </View>
          </View>
          <Text style={styles.balanceHint}>{t.walletHint}</Text>
        </View>

        {/* Low balance warning */}
        {!loading && balance < 50 ? (
          <View style={styles.warningCard}>
            <AppIcon name="warning-outline" size={18} color={theme.colors.warning} />
            <View style={styles.warningBody}>
              <Text style={styles.warningTitle}>{t.lowBalance}</Text>
              <Text style={styles.warningText}>{t.lowBalanceText}</Text>
            </View>
          </View>
        ) : null}

        {/* Recharge */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionTitle}>{t.addMoney}</Text>
            <AppIcon name="add-circle-outline" size={18} color={theme.colors.primary} />
          </View>
          <Text style={styles.sectionSubtitle}>{t.pickRechargeAmount}</Text>
          <View style={styles.rechargeGrid}>
            {RECHARGE_OPTIONS.map((amt) => (
              <Pressable
                key={amt}
                style={[styles.amountChip, selectedAmount === amt && styles.amountChipSelected]}
                onPress={() => setSelectedAmount(amt)}
              >
                <Text style={[styles.amountChipText, selectedAmount === amt && styles.amountChipTextSelected]}>
                  Rs{amt}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={[styles.primaryButton, recharging && styles.disabled]} onPress={handleRecharge} disabled={recharging}>
            <AppIcon name="arrow-up-circle-outline" size={18} color="#fff" />
            <Text style={styles.primaryButtonText}>{recharging ? t.adding : t.addRs.replace('{amt}', String(selectedAmount))}</Text>
          </Pressable>
        </View>

        {/* Available balance */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionTitle}>{t.availableBalance}</Text>
            <AppIcon name="cash-outline" size={18} color={theme.colors.secondary} />
          </View>
          <View style={styles.payCard}>
            <Text style={styles.payLabel}>{t.availableToSpend}</Text>
            <Text style={styles.payValue}>Rs {balance}</Text>
            <Text style={styles.payHint}>{t.walletPayHint}</Text>
          </View>
        </View>

        {/* Transaction history */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionTitle}>{t.transactionHistory}</Text>
            <AppIcon name="time-outline" size={18} color={theme.colors.textSecondary} />
          </View>
          {loading ? (
            <ActivityIndicator style={{ marginTop: 16 }} color={theme.colors.primary} />
          ) : transactions.length === 0 ? (
            <Text style={styles.emptyText}>{t.noTransactions}</Text>
          ) : (
            transactions.map((tx) => {
              const isCredit = tx.type === 'credit';
              const statusStyle = tx.status === 'success' || tx.status === 'pending'
                ? tx.status === 'success' ? styles.statusSuccess : styles.statusPending
                : styles.statusNeutral;
              const statusTextStyle = tx.status === 'success'
                ? styles.statusTextSuccess
                : tx.status === 'pending' ? styles.statusTextPending : styles.statusTextNeutral;
              return (
                <View key={tx.id} style={styles.transactionRow}>
                  <View style={[styles.transactionIcon, isCredit ? styles.creditIcon : styles.debitIcon]}>
                    <AppIcon
                      name={isCredit ? 'arrow-down-outline' : 'arrow-up-outline'}
                      size={18}
                      color={isCredit ? theme.colors.secondary : theme.colors.danger}
                    />
                  </View>
                  <View style={styles.transactionBody}>
                    <Text style={styles.transactionTitle}>{tx.title}</Text>
                    <Text style={styles.transactionDate}>{formatDate(tx.createdAt)}</Text>
                  </View>
                  <View style={styles.transactionRight}>
                    <Text style={[styles.transactionAmount, isCredit ? styles.creditAmount : styles.debitAmount]}>
                      {isCredit ? '+' : '-'} Rs{tx.amount}
                    </Text>
                    <View style={[styles.statusBadge, statusStyle]}>
                      <Text style={[styles.statusText, statusTextStyle]}>
                        {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
      <CustomerBottomNav active="CustomerWallet" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 110 },
  balanceCard: { borderRadius: 30, padding: 22, backgroundColor: '#EDF5FF', borderWidth: 1, borderColor: '#D7E5FF' },
  balanceTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balanceLabel: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: '700' },
  balanceValue: { marginTop: 8, color: theme.colors.text, fontSize: 34, fontWeight: '900' },
  balanceIcon: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.9)' },
  balanceHint: { marginTop: 14, color: theme.colors.textSecondary, fontSize: 14, lineHeight: 21 },
  warningCard: { marginTop: 14, flexDirection: 'row', gap: 10, borderRadius: 22, padding: 16, backgroundColor: '#FFF8EA', borderWidth: 1, borderColor: '#FFE1A6' },
  warningBody: { flex: 1 },
  warningTitle: { color: '#9A5B00', fontSize: 15, fontWeight: '800' },
  warningText: { marginTop: 4, color: '#9A5B00', fontSize: 13, lineHeight: 19 },
  card: { marginTop: 14, borderRadius: 28, padding: 20, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.stroke, ...createShadow({ color: '#163456', opacity: 0.08, radius: 16, elevation: 5 }) },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: theme.colors.text, fontSize: 20, fontWeight: '800' },
  sectionSubtitle: { marginTop: 6, color: theme.colors.textSecondary, fontSize: 13, lineHeight: 20 },
  rechargeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  amountChip: { width: '47%', backgroundColor: theme.colors.surfaceMuted, borderRadius: 18, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.stroke },
  amountChipSelected: { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary },
  amountChipText: { color: theme.colors.text, fontSize: 15, fontWeight: '800' },
  amountChipTextSelected: { color: theme.colors.primary },
  primaryButton: { marginTop: 14, backgroundColor: theme.colors.primary, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingVertical: 15, flexDirection: 'row', gap: 8 },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.6 },
  payCard: { marginTop: 14, backgroundColor: theme.colors.surfaceMuted, borderRadius: 22, borderWidth: 1, borderColor: theme.colors.stroke, padding: 16 },
  payLabel: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '700' },
  payValue: { marginTop: 8, color: theme.colors.text, fontSize: 28, fontWeight: '900' },
  payHint: { marginTop: 8, color: theme.colors.textSecondary, fontSize: 13, lineHeight: 19 },
  emptyText: { marginTop: 14, color: theme.colors.textSecondary, fontSize: 14, textAlign: 'center' },
  transactionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderTopWidth: 1, borderColor: '#EDF3F8' },
  transactionIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  creditIcon: { backgroundColor: '#F1FBF4' },
  debitIcon: { backgroundColor: '#FFF3F2' },
  transactionBody: { flex: 1, paddingRight: 8 },
  transactionTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '700' },
  transactionDate: { marginTop: 4, color: theme.colors.textSecondary, fontSize: 12 },
  transactionRight: { alignItems: 'flex-end' },
  transactionAmount: { fontSize: 14, fontWeight: '800' },
  creditAmount: { color: theme.colors.secondary },
  debitAmount: { color: theme.colors.danger },
  statusBadge: { marginTop: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { fontSize: 10, fontWeight: '800' },
  statusSuccess: { backgroundColor: '#DCFCE7' },
  statusTextSuccess: { color: '#15803D' },
  statusPending: { backgroundColor: '#FEF3C7' },
  statusTextPending: { color: '#B45309' },
  statusNeutral: { backgroundColor: '#E2E8F0' },
  statusTextNeutral: { color: '#475569' }
});

export default CustomerWalletScreen;
