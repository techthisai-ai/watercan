import React, { useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AuthContext } from '../../App';
import AppIcon from '../components/AppIcon';
import CustomerBottomNav from '../components/CustomerBottomNav';
import PaymentOptionCard from '../components/PaymentOptionCard';
import ScreenHeader from '../components/ScreenHeader';
import { formatCurrency, formatOrderReference, formatQuantityLabel, getCustomerPaymentStatusLabel, getOrderProductType } from '../data/orderModule';
import { OrderRecord, subscribeToCustomerOrders, updateOrder } from '../services/firebaseService';
import { createShadow } from '../styles/shadows';
import { theme } from '../styles/theme';

const formatAmount = (amount: number) => `Rs ${Math.max(0, Math.round(amount))}`;
type PaymentFilter = 'paid' | 'pending';

const getPaymentSplit = (order: OrderRecord) => {
  const paid = order.paymentStatus === 'paid' ? order.totalAmount : order.paidAmount ?? 0;
  const pending = Math.max(order.totalAmount - paid, 0);
  return { paid, pending };
};

const formatShortDate = (timestamp: number) =>
  new Date(timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
const isSameOrderFeed = (prev: OrderRecord[], next: OrderRecord[]) =>
  prev.length === next.length &&
  prev.every((order, index) => {
    const candidate = next[index];
    return (
      order.id === candidate?.id &&
      order.status === candidate?.status &&
      order.updatedAt === candidate?.updatedAt &&
      order.paymentStatus === candidate?.paymentStatus &&
      order.paidAmount === candidate?.paidAmount &&
      !!order.paymentApproved === !!candidate?.paymentApproved
    );
  });

const CustomerPayScreen = () => {
  const { profile } = useContext(AuthContext);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<PaymentFilter>('pending');
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const [payingAll, setPayingAll] = useState(false);
  const [showPayAllModal, setShowPayAllModal] = useState(false);
  const [cashAmountInput, setCashAmountInput] = useState('');

  useEffect(() => {
    if (!profile?.uid) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToCustomerOrders(profile.uid, (data) => {
      setOrders((current) => (isSameOrderFeed(current, data) ? current : data));
      setLoading(false);
    });

    return unsubscribe;
  }, [profile?.uid]);

  const totals = useMemo(() => {
    const activePaymentOrders = orders.filter((order) => order.status !== 'cancelled');
    return activePaymentOrders.reduce(
      (summary, order) => {
        const { paid, pending } = getPaymentSplit(order);
        const approved = !!order.paymentApproved;

        return {
          paid: summary.paid + paid,
          pending: summary.pending + pending,
          paidOrders: summary.paidOrders + (pending <= 0 && order.paymentStatus === 'paid' && approved ? 1 : 0),
          pendingOrders:
            summary.pendingOrders +
            (pending > 0 || (pending <= 0 && !approved && (order.paymentStatus === 'paid' || order.paymentStatus === 'partial')) ? 1 : 0)
        };
      },
      { paid: 0, pending: 0, paidOrders: 0, pendingOrders: 0 }
    );
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (order.status === 'cancelled') {
        return false;
      }
      const paymentLabel = getCustomerPaymentStatusLabel(order);
      const { pending } = getPaymentSplit(order);
      return selectedFilter === 'paid'
        ? pending <= 0 && paymentLabel === 'Paid'
        : pending > 0 || paymentLabel === 'Approval Pending';
    });
  }, [orders, selectedFilter]);

  const selectedPendingAmount = selectedOrder ? getPaymentSplit(selectedOrder).pending : 0;

  const openPendingPayment = (order: OrderRecord) => {
    const { pending } = getPaymentSplit(order);
    if (pending <= 0) {
      return;
    }
    setSelectedOrder(order);
    setCashAmountInput(String(Math.max(1, Math.round(pending))));
  };

  const completeGooglePayPayment = async () => {
    if (!selectedOrder?.id || payingOrderId || payingAll) {
      return;
    }
    const currentSplit = getPaymentSplit(selectedOrder);
    const enteredCash = Number.parseFloat(cashAmountInput);
    if (!Number.isFinite(enteredCash) || enteredCash <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid cash amount.');
      return;
    }
    if (enteredCash > currentSplit.pending) {
      Alert.alert('Invalid amount', `Entered amount is greater than pending amount ${formatCurrency(currentSplit.pending)}.`);
      return;
    }

    const nextPaidAmount = Math.min(selectedOrder.totalAmount, (selectedOrder.paidAmount ?? 0) + enteredCash);
    const nextPendingAmount = Math.max(selectedOrder.totalAmount - nextPaidAmount, 0);
    const nextPaymentStatus = nextPendingAmount > 0 ? 'partial' : 'paid';

    setPayingOrderId(selectedOrder.id);
    try {
      await updateOrder(selectedOrder.id, {
        paymentMethod: 'Google Pay',
        paymentStatus: nextPaymentStatus,
        paidAmount: nextPaidAmount,
        paymentApproved: false
      });
      setOrders((current) =>
        current.map((order) =>
          order.id === selectedOrder.id
            ? { ...order, paymentMethod: 'Google Pay', paymentStatus: nextPaymentStatus, paidAmount: nextPaidAmount, paymentApproved: false }
            : order
        )
      );
      const productType = getOrderProductType(selectedOrder);
      setSelectedOrder(null);
      setCashAmountInput('');
      Alert.alert(
        'Payment successful',
        nextPendingAmount > 0
          ? `${formatCurrency(enteredCash)} received for ${productType} ${formatOrderReference(selectedOrder)}. Remaining ${formatCurrency(nextPendingAmount)} is pending.`
          : `GPay payment for ${productType} ${formatOrderReference(selectedOrder)} is completed and awaiting admin approval.`
      );
    } catch {
      Alert.alert('Payment failed', 'Unable to complete GPay payment right now. Please try again.');
    } finally {
      setPayingOrderId(null);
    }
  };

  const openPayAllPopup = () => {
    if (payingAll || payingOrderId) {
      return;
    }
    const pendingOrders = orders.filter((order) => getPaymentSplit(order).pending > 0 && !!order.id);
    if (!pendingOrders.length) {
      Alert.alert('Nothing to pay', 'There are no pending payment orders.');
      return;
    }
    setShowPayAllModal(true);
  };

  const payAllPendingPayments = async () => {
    if (payingAll || payingOrderId) {
      return;
    }

    const pendingOrders = orders.filter((order) => getPaymentSplit(order).pending > 0 && !!order.id);
    if (!pendingOrders.length) {
      Alert.alert('Nothing to pay', 'There are no pending payment orders.');
      return;
    }

    setPayingAll(true);
    try {
      await Promise.all(
        pendingOrders.map((order) =>
          updateOrder(order.id!, {
            paymentMethod: 'Google Pay',
            paymentStatus: 'paid',
            paidAmount: order.totalAmount,
            paymentApproved: false
          })
        )
      );

      const pendingById = new Set(pendingOrders.map((order) => order.id));
      setOrders((current) =>
        current.map((order) =>
          order.id && pendingById.has(order.id)
            ? { ...order, paymentMethod: 'Google Pay', paymentStatus: 'paid', paidAmount: order.totalAmount, paymentApproved: false }
            : order
        )
      );
      setSelectedOrder(null);
      setShowPayAllModal(false);
      setSelectedFilter('pending');
      Alert.alert('Payment Successful', `Paid ${pendingOrders.length} pending order${pendingOrders.length > 1 ? 's' : ''}. Awaiting admin approval.`);
    } catch {
      Alert.alert('Payment failed', 'Unable to complete all pending payments right now. Please try again.');
    } finally {
      setPayingAll(false);
    }
  };

  const getStatusBadgeStyle = (statusLabel: string) => {
    switch (statusLabel) {
      case 'Paid':
        return {
          badge: styles.statusBadgePaid,
          text: styles.statusBadgeTextPaid
        };
      case 'Partial':
        return {
          badge: styles.statusBadgePartial,
          text: styles.statusBadgeTextPartial
        };
      case 'Approval Pending':
        return {
          badge: styles.statusBadgeApprovalPending,
          text: styles.statusBadgeTextApprovalPending
        };
      default:
        return {
          badge: styles.statusBadgeUnpaid,
          text: styles.statusBadgeTextUnpaid
        };
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Modal
        visible={!!selectedOrder}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedOrder(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Choose payment option</Text>
            <Text style={styles.modalSubtitle}>
              {selectedOrder ? getOrderProductType(selectedOrder) : 'Order'} {selectedOrder ? formatOrderReference(selectedOrder) : '#-----'} · {formatCurrency(selectedPendingAmount)}
            </Text>
            <View style={styles.paymentOptionWrap}>
              <PaymentOptionCard
                title="Google Pay"
                subtitle="Tap to complete this pending payment"
                selected
                onPress={completeGooglePayPayment}
              />
            </View>
            <View style={styles.cashInputWrap}>
              <Text style={styles.cashInputLabel}>Cash paying now</Text>
              <TextInput
                value={cashAmountInput}
                onChangeText={(text) => setCashAmountInput(text.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder="Enter amount"
                placeholderTextColor={theme.colors.textTertiary}
                style={styles.cashInput}
              />
            </View>
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalSecondaryButton}
                onPress={() => setSelectedOrder(null)}
                disabled={!!payingOrderId}
              >
                <Text style={styles.modalSecondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalPrimaryButton, !!payingOrderId && styles.disabledButton]}
                onPress={completeGooglePayPayment}
                disabled={!!payingOrderId}
              >
                <Text style={styles.modalPrimaryButtonText}>{payingOrderId ? 'Processing' : 'Pay with GPay'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={showPayAllModal}
        transparent
        animationType="fade"
        onRequestClose={() => (!payingAll ? setShowPayAllModal(false) : undefined)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Complete GPay payment</Text>
            <Text style={styles.modalSubtitle}>
              Pending total: {formatCurrency(totals.pending)} for {totals.pendingOrders} order{totals.pendingOrders > 1 ? 's' : ''}
            </Text>
            <View style={styles.paymentOptionWrap}>
              <PaymentOptionCard
                title="Google Pay"
                subtitle="Tap to pay all pending orders"
                selected
                onPress={payAllPendingPayments}
              />
            </View>
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalSecondaryButton}
                onPress={() => setShowPayAllModal(false)}
                disabled={payingAll}
              >
                <Text style={styles.modalSecondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalPrimaryButton, payingAll && styles.disabledButton]}
                onPress={payAllPendingPayments}
                disabled={payingAll}
              >
                <Text style={styles.modalPrimaryButtonText}>{payingAll ? 'Processing' : 'Pay all with GPay'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Pay" profile notifications />

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={theme.colors.primary} />
            <Text style={styles.loadingText}>Loading payment summary</Text>
          </View>
        ) : (
          <>
            <View style={styles.summaryGrid}>
              <Pressable
                style={[styles.summaryCard, styles.paidCard, selectedFilter === 'paid' && styles.summaryCardSelected]}
                onPress={() => setSelectedFilter('paid')}
              >
                <View style={styles.summaryIcon}>
                  <AppIcon name="checkmark-circle-outline" size={22} color="#1E7A45" />
                </View>
                <Text style={styles.summaryLabel}>Paid</Text>
                <Text style={styles.summaryValue}>{formatAmount(totals.paid)}</Text>
                <Text style={styles.summaryMeta}>{totals.paidOrders} paid orders</Text>
              </Pressable>

              <Pressable
                style={[styles.summaryCard, styles.pendingCard, selectedFilter === 'pending' && styles.summaryCardSelected]}
                onPress={() => setSelectedFilter('pending')}
              >
                <View style={styles.summaryIcon}>
                  <AppIcon name="time-outline" size={22} color="#A15A00" />
                </View>
                <Text style={styles.summaryLabel}>Pending</Text>
                <Text style={styles.summaryValue}>{formatAmount(totals.pending)}</Text>
                <Text style={styles.summaryMeta}>{totals.pendingOrders} pending orders</Text>
              </Pressable>
            </View>

            <View style={styles.orderListCard}>
              <View style={styles.orderListHeader}>
                <Text style={styles.orderListTitle}>{selectedFilter === 'paid' ? 'Paid orders' : 'Pending orders'}</Text>
                <View style={styles.orderListHeaderActions}>
                  {selectedFilter === 'pending' && totals.pendingOrders > 0 ? (
                    <Pressable
                      style={[styles.payAllButton, (payingAll || !!payingOrderId) && styles.disabledButton]}
                      onPress={openPayAllPopup}
                      disabled={payingAll || !!payingOrderId}
                    >
                      <Text style={styles.payAllButtonText}>{payingAll ? 'Paying...' : 'Pay all pending'}</Text>
                    </Pressable>
                  ) : null}
                  <Text style={styles.orderListCount}>{filteredOrders.length}</Text>
                </View>
              </View>

              {filteredOrders.length ? (
                filteredOrders.map((order) => {
                  const timestamp = order.createdAt ?? Date.now();
                  const paymentSplit = getPaymentSplit(order);
                  const isPending = paymentSplit.pending > 0 || !order.paymentApproved;
                  const dueAmount = selectedFilter === 'paid' ? paymentSplit.paid : paymentSplit.pending;
                  const pendingStatusLabel = selectedFilter === 'paid' ? 'Paid' : getCustomerPaymentStatusLabel(order);
                  const statusBadgeStyle = getStatusBadgeStyle(pendingStatusLabel);
                  return (
                    <Pressable
                      key={order.id ?? `${order.orderNumber}-${timestamp}`}
                      style={({ pressed }) => [styles.canRow, pressed && isPending && styles.canRowPressed]}
                      onPress={() => openPendingPayment(order)}
                      disabled={!isPending || payingAll}
                    >
                      <View style={styles.detailPanel}>
                        <View style={styles.orderCardTopRow}>
                          <View style={styles.orderMetaLeft}>
                            <Text style={styles.orderNoValue}>{formatOrderReference(order)}</Text>
                            <Text style={styles.dateValue}>{formatShortDate(timestamp)}</Text>
                          </View>
                          <Text style={styles.amountValue}>{formatCurrency(dueAmount)}</Text>
                        </View>
                        <View style={styles.orderCardBottomRow}>
                          <View style={styles.quantityWrap}>
                            <Text style={styles.quantityLabel}>Quantity</Text>
                            <Text style={styles.quantityValue}>
                              {formatQuantityLabel(order)}
                            </Text>
                          </View>
                          <View style={[styles.statusBadge, statusBadgeStyle.badge]}>
                            <Text style={[styles.statusBadgeText, statusBadgeStyle.text]}>{pendingStatusLabel}</Text>
                          </View>
                        </View>
                      </View>
                    </Pressable>
                  );
                })
              ) : (
                <View style={styles.emptyList}>
                  <Text style={styles.emptyListText}>No {selectedFilter === 'pending' ? 'pending orders' : 'paid orders'} found.</Text>
                </View>
              )}
            </View>

            <View style={styles.statusCard}>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Total orders</Text>
                <Text style={styles.statusValue}>{orders.length}</Text>
              </View>
              <View style={styles.statusDivider} />
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Payment status</Text>
                <Text style={[styles.statusValue, totals.pending > 0 ? styles.pendingText : styles.paidText]}>
                  {totals.pending > 0 ? 'Pending payment' : 'All clear'}
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
      <CustomerBottomNav active="CustomerPay" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 110 },
  loadingCard: {
    borderRadius: 28,
    padding: 24,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.stroke,
    alignItems: 'center'
  },
  loadingText: { marginTop: 12, color: theme.colors.textSecondary, fontSize: 14, fontWeight: '700' },
  summaryGrid: { flexDirection: 'row', gap: 12 },
  summaryCard: {
    flex: 1,
    minHeight: 178,
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    ...createShadow({ color: '#163456', opacity: 0.08, radius: 16, elevation: 5 })
  },
  paidCard: { backgroundColor: '#F0FBF4', borderColor: '#BFE8CC' },
  pendingCard: { backgroundColor: '#FFF7EA', borderColor: '#FFE1A6' },
  summaryCardSelected: {
    borderColor: theme.colors.primary,
    borderWidth: 2
  },
  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF'
  },
  summaryLabel: { marginTop: 16, color: theme.colors.textSecondary, fontSize: 13, fontWeight: '900', textTransform: 'uppercase' },
  summaryValue: { marginTop: 8, color: theme.colors.text, fontSize: 25, fontWeight: '900' },
  summaryMeta: { marginTop: 8, color: theme.colors.textSecondary, fontSize: 12, fontWeight: '700', lineHeight: 17 },
  orderListCard: {
    marginTop: 14,
    borderRadius: 26,
    padding: 18,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.stroke
  },
  orderListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 4
  },
  orderListHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  payAllButton: {
    borderRadius: 999,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  payAllButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900'
  },
  orderListTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '900'
  },
  orderListCount: {
    minWidth: 30,
    textAlign: 'center',
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '900',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: theme.colors.primarySoft
  },
  canRow: {
    marginTop: 12
  },
  canRowPressed: {
    opacity: 0.9
  },
  detailPanel: {
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: '#F8FBFF',
    borderWidth: 1,
    borderColor: '#D9E6F2',
    ...createShadow({ color: '#10304C', opacity: 0.08, radius: 12, elevation: 3 })
  },
  orderCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 30
  },
  orderMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0
  },
  orderNoValue: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '900'
  },
  dateValue: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '800'
  },
  amountValue: {
    color: '#0C3D67',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'right',
    minWidth: 88
  },
  orderCardBottomRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 36
  },
  quantityWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    minWidth: 0
  },
  quantityLabel: {
    color: theme.colors.textTertiary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  quantityValue: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '900'
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    minWidth: 108,
    alignItems: 'center'
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.3
  },
  statusBadgePaid: {
    backgroundColor: '#EAF8F0',
    borderColor: '#BDE6CD'
  },
  statusBadgeTextPaid: {
    color: '#1E7A45'
  },
  statusBadgePartial: {
    backgroundColor: '#FFF6E9',
    borderColor: '#FFD8A0'
  },
  statusBadgeTextPartial: {
    color: '#9A5A00'
  },
  statusBadgeUnpaid: {
    backgroundColor: '#FFF0F0',
    borderColor: '#F5CACA'
  },
  statusBadgeTextUnpaid: {
    color: '#A53A3A'
  },
  statusBadgeApprovalPending: {
    backgroundColor: '#EEF4FF',
    borderColor: '#C9D9FF'
  },
  statusBadgeTextApprovalPending: {
    color: '#2A5CAA'
  },
  emptyList: {
    marginTop: 14,
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceMuted
  },
  emptyListText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700'
  },
  statusCard: {
    marginTop: 14,
    borderRadius: 26,
    padding: 18,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.stroke
  },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  statusDivider: { height: 1, backgroundColor: '#EDF3F8', marginVertical: 14 },
  statusLabel: { color: theme.colors.textSecondary, fontSize: 14, fontWeight: '800' },
  statusValue: { color: theme.colors.text, fontSize: 15, fontWeight: '900', textAlign: 'right' },
  paidText: { color: '#1E7A45' },
  pendingText: { color: '#A15A00' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(18, 49, 77, 0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.stroke
  },
  modalTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '900'
  },
  modalSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 6
  },
  paymentOptionWrap: {
    marginTop: 16
  },
  cashInputWrap: {
    marginTop: 12
  },
  cashInputLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6
  },
  cashInput: {
    borderWidth: 1,
    borderColor: theme.colors.stroke,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
    backgroundColor: theme.colors.surfaceMuted
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18
  },
  modalSecondaryButton: {
    flex: 1,
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 13
  },
  modalSecondaryButtonText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '800'
  },
  modalPrimaryButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 13
  },
  modalPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800'
  },
  disabledButton: {
    opacity: 0.6
  }
});

export default CustomerPayScreen;

