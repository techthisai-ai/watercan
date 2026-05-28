import React, { useCallback, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import AppIcon from '../components/AppIcon';
import { fetchOwnerOrders, OrderRecord, updateOrder, updateOrderStatus } from '../services/firebaseService';
import { useFocusEffect } from '@react-navigation/native';
import TopNav from '../components/TopNav';
import OwnerBottomNav from '../components/OwnerBottomNav';
import { useLang } from '../i18n/LanguageContext';
import { formatCurrency, formatOrderNumber, formatQuantityLabel } from '../data/orderModule';

const OwnerApprovalsScreen = () => {
  const { t } = useLang();
  const [pendingOrders, setPendingOrders] = useState<OrderRecord[]>([]);
  const [pendingPayments, setPendingPayments] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSection, setSelectedSection] = useState<'orders' | 'payments'>('orders');

  const loadPending = async () => {
    setLoading(true);
    try {
      const orders = await fetchOwnerOrders().catch(() => []);
      setPendingOrders(orders.filter((order) => order.status === 'pending'));
      setPendingPayments(
        orders.filter(
          (order) => {
            const hasPaymentRequest =
              (order.paidAmount ?? 0) > 0 || order.paymentStatus === 'paid' || order.paymentStatus === 'partial';
            return order.status !== 'cancelled' && hasPaymentRequest && !order.paymentApproved;
          }
        )
      );
    } catch (error: any) {
      Alert.alert(t.loadFailed, error.message || t.loadFailed);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadPending();
    }, [])
  );

  const handleApproveOrder = async (orderId: string) => {
    try {
      await updateOrderStatus(orderId, 'confirmed');
      setPendingOrders((items) => items.filter((item) => item.id !== orderId));
      Alert.alert(t.approvedAlert, 'Order confirmed.');
    } catch (error: any) {
      Alert.alert(t.approvalFailed, error.message || t.approvalFailed);
    }
  };

  const handleRejectOrder = async (orderId: string) => {
    try {
      await updateOrderStatus(orderId, 'cancelled');
      setPendingOrders((items) => items.filter((item) => item.id !== orderId));
      Alert.alert('Updated', 'Order marked as wrong.');
    } catch (error: any) {
      Alert.alert(t.approvalFailed, error.message || t.approvalFailed);
    }
  };

  const handleApprovePayment = async (orderId: string) => {
    try {
      await updateOrder(orderId, { paymentApproved: true });
      setPendingPayments((items) => items.filter((item) => item.id !== orderId));
      Alert.alert('Approved', 'Payment approved.');
    } catch (error: any) {
      Alert.alert(t.approvalFailed, error.message || t.approvalFailed);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <TopNav />
      <View style={styles.body}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.contentWrapper}>
          <View style={styles.header}>
            <Text style={styles.title}>{t.approvalsScreenTitle}</Text>
          </View>

          <View style={styles.selectorRow}>
            <Pressable
              style={[styles.selectorButton, selectedSection === 'orders' && styles.selectorButtonActive]}
              onPress={() => setSelectedSection('orders')}
            >
              <Text style={[styles.selectorText, selectedSection === 'orders' && styles.selectorTextActive]}>Can Orders</Text>
            </Pressable>
            <Pressable
              style={[styles.selectorButton, selectedSection === 'payments' && styles.selectorButtonActive]}
              onPress={() => setSelectedSection('payments')}
            >
              <Text style={[styles.selectorText, selectedSection === 'payments' && styles.selectorTextActive]}>Payments</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>{selectedSection === 'orders' ? 'Pending orders' : 'Payment approvals'}</Text>
          {selectedSection === 'orders' ? (
            pendingOrders.length ? (
              pendingOrders.map((order) => (
                <View key={order.id} style={styles.card}>
                  <View style={styles.cardBody}>
                    <Text style={styles.name}>{formatOrderNumber(order)} - {order.customerName}</Text>
                    <Text style={styles.phone}>{formatQuantityLabel(order)} | {formatCurrency(order.totalAmount)}</Text>
                    <Text style={styles.phone}>{order.phone}</Text>
                  </View>
                  <View style={styles.actionsCol}>
                    <Pressable style={styles.rightButton} onPress={() => order.id && handleApproveOrder(order.id)}>
                      <AppIcon name="checkmark" size={18} color="#FFFFFF" />
                    </Pressable>
                    <Pressable style={styles.wrongButton} onPress={() => order.id && handleRejectOrder(order.id)}>
                      <AppIcon name="close" size={18} color="#FFFFFF" />
                    </Pressable>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptySectionText}>{loading ? t.loading : 'No pending orders.'}</Text>
            )
          ) : pendingPayments.length ? (
            pendingPayments.map((order) => (
              <View key={order.id} style={styles.card}>
                <View style={styles.cardBody}>
                  <Text style={styles.name}>{formatOrderNumber(order)} - {order.customerName}</Text>
                  <Text style={styles.phone}>{formatCurrency(order.paidAmount ?? 0)} paid | {formatCurrency(Math.max(order.totalAmount - (order.paidAmount ?? 0), 0))} pending</Text>
                  <Text style={styles.phone}>Approval Pending</Text>
                </View>
                <View style={styles.actionsCol}>
                  <Pressable style={styles.rightButton} onPress={() => order.id && handleApprovePayment(order.id)}>
                    <AppIcon name="checkmark-done" size={18} color="#FFFFFF" />
                  </Pressable>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptySectionText}>{loading ? t.loading : 'No payment approvals pending.'}</Text>
          )}

        </ScrollView>
      </View>
      <OwnerBottomNav active="OwnerApprovals" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5FBFF'
  },
  contentWrapper: {
    padding: 24
  },
  body: {
    flex: 1
  },
  scroll: {
    flex: 1
  },
  header: {
    marginBottom: 16
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8
  },
  subtitle: {
    color: '#64748B',
    lineHeight: 22
  },
  sectionTitle: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
    marginTop: 8
  },
  selectorRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12
  },
  selectorButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#EAF3FB'
  },
  selectorButtonActive: {
    backgroundColor: '#0B61A4'
  },
  selectorText: {
    color: '#0B61A4',
    fontWeight: '800',
    fontSize: 13
  },
  selectorTextActive: {
    color: '#FFFFFF'
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    boxShadow: '0px 6px 18px rgba(0, 0, 0, 0.08)'
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A'
  },
  phone: {
    color: '#475569',
    marginTop: 6
  },
  cardBody: {
    flex: 1,
    paddingRight: 12
  },
  actionsCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  rightButton: {
    backgroundColor: '#16A34A',
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  wrongButton: {
    backgroundColor: '#DC2626',
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748B',
    marginTop: 40
  },
  emptySectionText: {
    color: '#64748B',
    marginBottom: 16
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: 14
  },
  backText: {
    color: '#006289',
    fontWeight: '700'
  }
});

export default OwnerApprovalsScreen;
