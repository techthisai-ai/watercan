import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, Platform } from 'react-native';
import { AuthContext } from '../../App';
import AppIcon from '../components/AppIcon';
import CustomerBottomNav from '../components/CustomerBottomNav';
import OrderHistoryCard from '../components/OrderHistoryCard';
import ScreenHeader from '../components/ScreenHeader';
import { RootStackParamList } from '../navigation/AppNavigator';
import { cancelOrder, getFriendlyOrderMessage, OrderRecord, subscribeToCustomerOrders } from '../services/firebaseService';
import { useLang } from '../i18n/LanguageContext';
import { createShadow } from '../styles/shadows';
import { theme } from '../styles/theme';

type FilterKey = 'Active' | 'Delivered' | 'Cancelled';
type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'CustomerOrders'>;

const filters: Array<{ key: FilterKey; icon: string }> = [
  { key: 'Active', icon: 'time-outline' },
  { key: 'Delivered', icon: 'checkmark-circle-outline' },
  { key: 'Cancelled', icon: 'close-circle-outline' }
];
const isSameOrderFeed = (prev: OrderRecord[], next: OrderRecord[]) =>
  prev.length === next.length &&
  prev.every((order, index) => {
    const candidate = next[index];
    return (
      order.id === candidate?.id &&
      order.status === candidate?.status &&
      order.updatedAt === candidate?.updatedAt &&
      order.deliveredQuantity === candidate?.deliveredQuantity &&
      order.pendingQuantity === candidate?.pendingQuantity &&
      order.paymentStatus === candidate?.paymentStatus &&
      order.paidAmount === candidate?.paidAmount &&
      !!order.paymentApproved === !!candidate?.paymentApproved
    );
  });

const CustomerOrdersScreen = () => {
  const { profile } = useContext(AuthContext);
  const { t } = useLang();
  const navigation = useNavigation<NavigationProp>();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<FilterKey>('Active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);

  const loadOrders = useCallback(() => {
    if (!profile?.uid) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');

    return subscribeToCustomerOrders(profile.uid, (data) => {
      setOrders((current) => (isSameOrderFeed(current, data) ? current : data));
      setError('');
      setLoading(false);
    });
  }, [profile?.uid]);

  useEffect(() => {
    const unsubscribe = loadOrders();
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    switch (selectedFilter) {
      case 'Delivered':
        return orders.filter((o) => o.status === 'delivered');
      case 'Cancelled':
        return orders.filter((o) => o.status === 'cancelled');
      default:
        return orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled');
    }
  }, [orders, selectedFilter]);

  const activeOrders = useMemo(
    () => orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled'),
    [orders]
  );
  const historyOrders = useMemo(
    () => orders.filter((o) => o.status === 'delivered' || o.status === 'cancelled'),
    [orders]
  );

  const cancelSelectedOrder = async (order: OrderRecord) => {
    if (!order.id || cancellingOrderId) {
      return;
    }

    setCancellingOrderId(order.id);
    try {
      await cancelOrder(order.id);
      setOrders((prev) =>
        prev.map((o) => o.id === order.id ? { ...o, status: 'cancelled' } : o)
      );
      setSelectedFilter('Cancelled');
    } catch (cancelError) {
      Alert.alert(t.orderFailed, getFriendlyOrderMessage(cancelError));
    } finally {
      setCancellingOrderId(null);
    }
  };

  const handleCancel = (order: OrderRecord) => {
    if (Platform.OS === 'web') {
      if (window.confirm(t.cancelOrderConfirm)) {
        cancelSelectedOrder(order);
      }
    } else {
      Alert.alert(t.cancelOrder, t.cancelOrderConfirm, [
        { text: t.no, style: 'cancel' },
        {
          text: t.yesCancel,
          style: 'destructive',
          onPress: () => cancelSelectedOrder(order)
        }
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerWrap}>
          <ScreenHeader title={t.orders} profile notifications />
        </View>

        <View style={styles.summaryRow}>
          <Pressable
            style={[styles.summaryCard, selectedFilter === 'Active' && styles.summaryCardSelected]}
            onPress={() => setSelectedFilter('Active')}
          >
            <AppIcon name="time-outline" size={18} color={theme.colors.warning} />
            <Text style={styles.summaryValue}>{activeOrders.length}</Text>
            <Text style={styles.summaryLabel}>{t.activeOrders}</Text>
          </Pressable>
          <Pressable
            style={[
              styles.summaryCard,
              (selectedFilter === 'Delivered' || selectedFilter === 'Cancelled') && styles.summaryCardSelected
            ]}
            onPress={() => setSelectedFilter('Delivered')}
          >
            <AppIcon name="albums-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.summaryValue}>{historyOrders.length}</Text>
            <Text style={styles.summaryLabel}>{t.history}</Text>
          </Pressable>
        </View>

        <View style={styles.filterRow}>
          {filters.map((filter) => {
            const selected = filter.key === selectedFilter;
            return (
              <Pressable
                key={filter.key}
                style={[styles.filterChip, selected && styles.filterChipSelected]}
                onPress={() => setSelectedFilter(filter.key)}
              >
                <AppIcon name={filter.icon} size={16} color={selected ? '#fff' : theme.colors.textSecondary} />
                <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>{filter.key === 'Active' ? t.active : filter.key === 'Delivered' ? t.delivered : t.cancelled}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.section}>
          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>{t.loadingOrders}</Text>
            </View>
          ) : error ? (
            <Pressable style={styles.errorCard} onPress={loadOrders}>
              <AppIcon name="refresh-outline" size={22} color={theme.colors.primary} />
              <Text style={styles.errorText}>{error}</Text>
            </Pressable>
          ) : filteredOrders.length ? (
            filteredOrders.map((order) => (
              <View key={order.id} style={styles.orderWrap}>
                <OrderHistoryCard
                  order={order}
                  onPayment={() => navigation.navigate('CustomerPay')}
                  onTrack={() => navigation.navigate('OrderTracking', { orderId: order.id })}
                  onCancel={cancellingOrderId === order.id ? undefined : () => handleCancel(order)}
                />
              </View>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <AppIcon name="file-tray-outline" size={26} color={theme.colors.textTertiary} />
              <Text style={styles.emptyTitle}>{t.noOrders.replace('{filter}', selectedFilter === 'Active' ? t.active : selectedFilter === 'Delivered' ? t.delivered : t.cancelled)}</Text>
              <Text style={styles.emptyText}>{t.ordersAppearHere}</Text>
              {selectedFilter === 'Active' ? (
                <Pressable style={styles.newOrderButton} onPress={() => navigation.navigate('NewOrder', {})}>
                  <Text style={styles.newOrderButtonText}>{t.placeAnOrder}</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>
      </ScrollView>
      <CustomerBottomNav active="CustomerOrders" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 18, paddingBottom: 120 },
  headerWrap: { marginBottom: -8 },
  summaryRow: { flexDirection: 'row', gap: 12 },
  summaryCard: {
    flex: 1, borderRadius: 24, padding: 16,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.stroke,
    ...createShadow({ color: '#163456', opacity: 0.08, radius: 16, elevation: 5 })
  },
  summaryCardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: '#EEF6FF'
  },
  summaryValue: { marginTop: 14, color: theme.colors.text, fontSize: 24, fontWeight: '800' },
  summaryLabel: { marginTop: 4, color: theme.colors.textSecondary, fontSize: 13 },
  filterRow: { marginTop: 16, flexDirection: 'row', gap: 10 },
  filterChip: {
    flex: 1, borderRadius: 18, backgroundColor: theme.colors.surface,
    paddingVertical: 12, alignItems: 'center', justifyContent: 'center',
    gap: 6, borderWidth: 1, borderColor: theme.colors.stroke
  },
  filterChipSelected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  filterChipText: { color: theme.colors.text, fontSize: 9, fontWeight: '800' },
  filterChipTextSelected: { color: '#fff' },
  section: { marginTop: 20 },
  sectionTitle: { color: theme.colors.text, fontSize: 20, fontWeight: '800', marginBottom: 12 },
  orderWrap: { marginBottom: 14 },
  centerBox: { alignItems: 'center', paddingVertical: 40 },
  loadingText: { marginTop: 12, color: theme.colors.textSecondary, fontSize: 14 },
  errorCard: {
    borderRadius: 24, padding: 20, backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.stroke, alignItems: 'center', gap: 10,
    ...createShadow({ color: '#163456', opacity: 0.08, radius: 16, elevation: 5 })
  },
  errorText: { color: theme.colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 21 },
  emptyCard: {
    borderRadius: 28, padding: 24, backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.stroke, alignItems: 'center',
    ...createShadow({ color: '#163456', opacity: 0.08, radius: 16, elevation: 5 })
  },
  emptyTitle: { marginTop: 12, color: theme.colors.text, fontSize: 18, fontWeight: '800' },
  emptyText: { marginTop: 8, color: theme.colors.textSecondary, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  newOrderButton: {
    marginTop: 16, backgroundColor: theme.colors.primary,
    borderRadius: 16, paddingHorizontal: 24, paddingVertical: 12
  },
  newOrderButtonText: { color: '#fff', fontSize: 14, fontWeight: '800' }
});

export default CustomerOrdersScreen;
