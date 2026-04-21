import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useContext, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AuthContext } from '../../App';
import AppIcon from '../components/AppIcon';
import CustomerBottomNav from '../components/CustomerBottomNav';
import OrderHistoryCard from '../components/OrderHistoryCard';
import ScreenHeader from '../components/ScreenHeader';
import { RootStackParamList } from '../navigation/AppNavigator';
import { cancelOrder, fetchCustomerOrders, OrderRecord } from '../services/firebaseService';
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

const CustomerOrdersScreen = () => {
  const { profile } = useContext(AuthContext);
  const { t } = useLang();
  const navigation = useNavigation<NavigationProp>();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<FilterKey>('Active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOrders = useCallback(async () => {
    if (!profile?.uid) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await fetchCustomerOrders(profile.uid);
      setOrders(data);
    } catch (e: any) {
      const msg: string = e?.message ?? '';
      if (msg.includes('failed-precondition') || msg.includes('index')) {
        setError('Setting up your orders list. Please wait a moment and refresh.');
      } else {
        setError('Could not load orders. Tap to retry.');
      }
    } finally {
      setLoading(false);
    }
  }, [profile?.uid]);

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [loadOrders])
  );

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

  const activeOrders = orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled');
  const historyOrders = orders.filter((o) => o.status === 'delivered' || o.status === 'cancelled');

  const handleCancel = (order: OrderRecord) => {
    if (window.confirm(`${t.cancelOrderConfirm}`)) {
      cancelOrder(order.id!).then(() => {
        setOrders((prev) =>
          prev.map((o) => o.id === order.id ? { ...o, status: 'cancelled' } : o)
        );
        setSelectedFilter('Cancelled');
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          title={t.orders}
          subtitle={t.ordersSubtitle}
        />

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <AppIcon name="time-outline" size={18} color={theme.colors.warning} />
            <Text style={styles.summaryValue}>{activeOrders.length}</Text>
            <Text style={styles.summaryLabel}>{t.activeOrders}</Text>
          </View>
          <View style={styles.summaryCard}>
            <AppIcon name="albums-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.summaryValue}>{historyOrders.length}</Text>
            <Text style={styles.summaryLabel}>{t.history}</Text>
          </View>
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
          <Text style={styles.sectionTitle}>{t.noOrders.replace('{filter}', selectedFilter === 'Active' ? t.active : selectedFilter === 'Delivered' ? t.delivered : t.cancelled).replace('இல்லை', '').trim()} {t.orders}</Text>

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
                  onViewDetails={() => navigation.navigate('OrderDetails', { orderId: order.id! })}
                  onTrack={() => navigation.navigate('OrderTracking', { orderId: order.id })}
                  onReorder={() => navigation.navigate('NewOrder', { reorder: true })}
                  onCancel={() => handleCancel(order)}
                  onModify={() => navigation.navigate('NewOrder', { orderId: order.id })}
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
  summaryRow: { flexDirection: 'row', gap: 12 },
  summaryCard: {
    flex: 1, borderRadius: 24, padding: 16,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.stroke,
    ...createShadow({ color: '#163456', opacity: 0.08, radius: 16, elevation: 5 })
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
