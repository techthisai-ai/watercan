import React, { useCallback, useContext, useEffect, useMemo, useState, useRef } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthContext } from '../../App';
import AppIcon from '../components/AppIcon';
import OwnerBottomNav from '../components/OwnerBottomNav';
import ScreenHeader from '../components/ScreenHeader';
import { RootStackParamList } from '../navigation/AppNavigator';
import { fetchInventorySummary, fetchOwnerOrders, InventorySummary, OrderRecord } from '../services/firebaseService';
import { useLang } from '../i18n/LanguageContext';
import { createShadow } from '../styles/shadows';
import { theme } from '../styles/theme';

const OwnerHomeScreen = () => {
  const { profile } = useContext(AuthContext);
  const { t } = useLang();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const [editingOrder, setEditingOrder] = useState<{ id: string; quantity?: number } | null>(null);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [inventory, setInventory] = useState<InventorySummary | null>(null);
  const [filter, setFilter] = useState<'Today' | 'This week' | 'Month' | 'Year'>('Today');

  const FILTERS = [
    { key: 'Today' as const,     label: t.today },
    { key: 'This week' as const, label: t.thisWeek },
    { key: 'Month' as const,     label: t.month },
    { key: 'Year' as const,      label: 'Year' },
  ];

   const lastCallRef = useRef(0);

   useFocusEffect(
     useCallback(() => {
       let active = true;
       const throttleDelay = 5000; // 5 seconds

       const loadOrders = async () => {
         try {
           const [data, inv] = await Promise.all([
             fetchOwnerOrders(),
             fetchInventorySummary().catch(() => null)
           ]);
           if (active) {
             setOrders(data);
             setInventory(inv);
           }
         } catch {
           if (active) {
             setOrders([]);
             setInventory(null);
           }
         }
       };

       const loadOrdersThrottled = () => {
         const now = Date.now();
         if (now - lastCallRef.current >= throttleDelay) {
           lastCallRef.current = now;
           loadOrders();
         }
       };

       // Initial load
       loadOrdersThrottled();

       return () => {
         active = false;
       };
     }, [])
   );

    const editOrderId = (route.params as any)?.editOrderId as string | undefined;
    const editQuantity = (route.params as any)?.editQuantity as number | undefined;
    useEffect(() => {
      if (editOrderId) {
        // capture the edit request on Home and clear the params so it doesn't trigger again
        setEditingOrder({ id: editOrderId, quantity: editQuantity });
        navigation.setParams({ editOrderId: undefined, editQuantity: undefined } as any);
      }
    }, [editOrderId, editQuantity, navigation]);

  const filterStart = useMemo(() => {
    const now = new Date();
    const d = new Date(now);
    switch (filter) {
      case 'Today':
        d.setHours(0, 0, 0, 0);
        return d;
      case 'This week': {
        const diff = (d.getDay() + 6) % 7;
        d.setDate(d.getDate() - diff);
        d.setHours(0, 0, 0, 0);
        return d;
      }
      case 'Month':
        return new Date(d.getFullYear(), d.getMonth(), 1);
      case 'Year':
        return new Date(d.getFullYear(), 0, 1);
      default:
        return d;
    }
  }, [filter]);

  const filteredOrders = useMemo(
    () => orders.filter((order) => new Date(order.createdAt) >= filterStart),
    [orders, filterStart]
  );

  const deliveredOrders = filteredOrders.filter((o) => o.status === 'delivered');
  const pendingOrders   = filteredOrders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled');
  const revenue = deliveredOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const recentOrders = filteredOrders.slice(0, 4);
  const totalStock = Math.max((inventory?.openingStock ?? 0) + (inventory?.restockedCans ?? 0), 0);
  const availableStock = Math.max(
    Number(inventory?.availableStock ?? (totalStock - (inventory?.soldCans ?? 0))),
    0
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          eyebrow={profile?.name ? `Owner ${profile.name.split(' ')[0]}` : 'Owner'}
          title={t.ownerDashboard}
          profile
        />

        <View style={styles.filterRow}>
          {FILTERS.map(({ key, label }) => (
            <Pressable
              key={key}
              style={[styles.filterChip, key === filter && styles.filterChipActive]}
              onPress={() => setFilter(key)}
            >
              <Text style={[styles.filterText, key === filter && styles.filterTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.statsGrid}>
          <Pressable style={styles.statCard} onPress={() => navigation.navigate('OwnerOrders')}>
            <AppIcon name="receipt-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.statValue}>{filteredOrders.length}</Text>
            <Text style={styles.statLabel}>{t.ordersLabel}</Text>
          </Pressable>
          <Pressable style={styles.statCard} onPress={() => navigation.navigate('OwnerOrders')}>
            <AppIcon name="checkmark-circle-outline" size={18} color={theme.colors.secondary} />
            <Text style={styles.statValue}>{deliveredOrders.length}</Text>
            <Text style={styles.statLabel}>{t.deliveredLabel}</Text>
          </Pressable>
          <Pressable style={styles.statCard} onPress={() => navigation.navigate('OwnerOrders')}>
            <AppIcon name="time-outline" size={18} color={theme.colors.warning} />
            <Text style={styles.statValue}>{pendingOrders.length}</Text>
            <Text style={styles.statLabel}>{t.pending}</Text>
          </Pressable>
          <Pressable style={styles.statCard} onPress={() => navigation.navigate('OwnerOrders')}>
            <AppIcon name="cash-outline" size={18} color="#16A34A" />
            <Text style={[styles.statValue, styles.revenueValue]}>Rs {revenue.toFixed(0)}</Text>
            <Text style={styles.statLabel}>{t.revenue} (delivered)</Text>
          </Pressable>
          <Pressable style={styles.statCard} onPress={() => navigation.navigate('OwnerInventory')}>
            <Text style={styles.statValue}>{totalStock}</Text>
            <Text style={styles.statLabel}>Total Stock</Text>
          </Pressable>
          <Pressable style={[styles.statCard, availableStock <= 5 && styles.statCardLow]} onPress={() => navigation.navigate('OwnerInventory')}>
            <Text style={[styles.statValue, availableStock <= 5 && styles.statValueLow]}>{availableStock}</Text>
            <Text style={styles.statLabel}>Available Stock{availableStock <= 5 ? ' ⚠️' : ''}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{t.recentOrdersOwner}</Text>
            <Pressable onPress={() => navigation.navigate('OwnerOrders')}>
              <Text style={styles.linkText}>{t.viewAll}</Text>
            </Pressable>
          </View>
          {recentOrders.length ? (
            recentOrders.map((order) => (
              <Pressable
                key={order.id}
                style={styles.orderRow}
                onPress={() => navigation.navigate('OwnerOrders')}
              >
                <View style={styles.orderIcon}>
                  <AppIcon name="cube-outline" size={18} color={theme.colors.primary} />
                </View>
                <View style={styles.orderBody}>
                  <Text style={styles.orderPrimary}>{order.customerName}</Text>
                  <Text style={styles.orderSecondary}>{order.quantity} cans • {order.paymentMethod}</Text>
                </View>
                <View style={styles.statusPill}>
                  <Text style={styles.statusText}>{order.status.replace(/_/g, ' ')}</Text>
                </View>
              </Pressable>
            ))
          ) : (
            <Text style={styles.emptyText}>{t.noOrdersPeriod}</Text>
          )}
        </View>

      </ScrollView>
      <OwnerBottomNav active="OwnerHome" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  content: {
    padding: 18,
    paddingBottom: 120
  },
  heroCard: {
    borderRadius: 30,
    padding: 22,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.stroke,
    ...createShadow({ color: '#163456', opacity: 0.1, radius: 20, elevation: 6 })
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  heroBadgeText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '700'
  },
  heroTitle: {
    marginTop: 16,
    color: theme.colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800'
  },
  heroSubtitle: {
    marginTop: 10,
    color: theme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22
  },
  filterRow: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap'
  },
  filterChip: {
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.colors.stroke
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary
  },
  filterText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700'
  },
  filterTextActive: {
    color: '#fff'
  },
  statsGrid: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap'
  },
  statCard: {
    width: '31%',
    borderRadius: 24,
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.stroke,
    ...createShadow({ color: '#163456', opacity: 0.08, radius: 16, elevation: 5 })
  },
  statValue: {
    marginTop: 14,
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '800'
  },
  statLabel: {
    marginTop: 4,
    color: theme.colors.textSecondary,
    fontSize: 13
  },
  revenueValue: {
    color: '#16A34A'
  },
  statCardLow: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFF5F5'
  },
  statValueLow: {
    color: '#DC2626'
  },
  card: {
    marginTop: 16,
    borderRadius: 28,
    padding: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.stroke,
    ...createShadow({ color: '#163456', opacity: 0.08, radius: 16, elevation: 5 })
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '800'
  },
  linkText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '700'
  },
  orderRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  orderIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft
  },
  orderBody: {
    flex: 1
  },
  orderPrimary: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '800'
  },
  orderSecondary: {
    marginTop: 4,
    color: theme.colors.textSecondary,
    fontSize: 13
  },
  statusPill: {
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  statusText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700'
  },
  emptyText: {
    marginTop: 12,
    color: theme.colors.textSecondary,
    fontSize: 14
  }
});

export default OwnerHomeScreen;
