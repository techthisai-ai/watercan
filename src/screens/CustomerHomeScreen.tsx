import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useContext, useState } from 'react';
import { Alert, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AuthContext } from '../../App';
import AppIcon from '../components/AppIcon';
import CustomerBottomNav from '../components/CustomerBottomNav';
import { formatCurrency, WATER_PRODUCT } from '../data/orderModule';
import { RootStackParamList } from '../navigation/AppNavigator';
import { createOrder, fetchCustomerOrders, fetchInventorySummary, OrderRecord, autoProgressOrders } from '../services/firebaseService';
import { useLang } from '../i18n/LanguageContext';
import waterCanImage from '../assets/20-l-water-can1.jpg';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'CustomerHome'>;

const CustomerHomeScreen = () => {
  const { profile } = useContext(AuthContext);
  const { t } = useLang();
  const navigation = useNavigation<NavigationProp>();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [liveStock, setLiveStock] = useState(WATER_PRODUCT.availableStock);
  const [quantity, setQuantity] = useState(1);
  const [ordering, setOrdering] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<{ orderId: string; orderNumber?: number } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const load = async () => {
        if (!profile?.uid) { setOrders([]); return; }
        await autoProgressOrders(profile.uid).catch(() => {});
        const [data, inv] = await Promise.all([
          fetchCustomerOrders(profile.uid).catch(() => []),
          fetchInventorySummary().catch(() => null)
        ]);
        if (!active) return;
        setOrders(data);
        if (inv) setLiveStock(Math.max(0, (inv.openingStock ?? 0) + (inv.restockedCans ?? 0) - (inv.soldCans ?? 0)));
      };
      load();
      return () => { active = false; };
    }, [profile?.uid])
  );

  const handleQuickOrder = async () => {
    if (!profile) return;
    setOrdering(true);
    try {
      const deliveryCharge = 0;
      const totalAmount = quantity * WATER_PRODUCT.pricePerCan;
      const result = await createOrder({
        customerId: profile.uid,
        customerName: profile.name,
        phone: profile.phone,
        address: profile.address?.trim() || '',
        productName: WATER_PRODUCT.name,
        quantity,
        pricePerCan: WATER_PRODUCT.pricePerCan,
        deliveryCharge,
        totalAmount,
        availableStock: liveStock,
        note: '',
        paymentMethod: 'Cash on Delivery',
        paymentStatus: 'unpaid',
        paidAmount: 0,
        deliverySlot: 'Morning',
        expectedDeliveryTime: '7:00 AM - 10:00 AM',
        subscription: false
      });
      setOrders((prev) => [result as any, ...prev]);
      setOrderSuccess({ orderId: result.id!, orderNumber: result.orderNumber });
    } catch (e: any) {
      Alert.alert(t.orderFailed, e.message || t.couldNotPlace);
    } finally {
      setOrdering(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Top bar */}
        <View style={styles.topBar}>
          <View>
            <Text style={styles.greeting}>{t.hello}, {profile?.name?.split(' ')[0] || t.customer} 👋</Text>
            <Text style={styles.shopName}>{t.appName}</Text>
          </View>
          <Pressable style={styles.profileBtn} onPress={() => navigation.navigate('Profile')}>
            <AppIcon name="person" size={20} color="#1E7A45" />
          </Pressable>
        </View>

        {/* Hero image */}
        <View style={styles.heroCard}>
          <Image source={waterCanImage} style={styles.heroImage} resizeMode="cover" />
          <View style={styles.heroOverlay}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>{t.freshPureFast}</Text>
            </View>
            <Text style={styles.heroTitle}>{t.waterCanTitle}</Text>
          </View>
        </View>

        {/* Order card */}
        <View style={styles.orderCard}>
          <View style={styles.orderCardHeader}>
            <Image source={waterCanImage} style={styles.orderCardImage} resizeMode="cover" />
            <View style={styles.orderCardInfo}>
              <Text style={styles.orderCardTitle}>20L Water Can</Text>
              <Text style={styles.orderCardPrice}>{formatCurrency(WATER_PRODUCT.pricePerCan)} {t.perCan}</Text>
            </View>
          </View>

          {orderSuccess && (
            <View style={styles.successBanner}>
              <AppIcon name="checkmark-circle" size={20} color="#1E7A45" />
              <View style={{ flex: 1 }}>
                <Text style={styles.successBannerTitle}>{t.orderPlaced.replace('{n}', String(orderSuccess.orderNumber))}</Text>
                <Text style={styles.successBannerSub}>{t.deliverSoon}</Text>
              </View>
              <Pressable onPress={() => setOrderSuccess(null)}>
                <AppIcon name="close" size={18} color="#6A90B0" />
              </Pressable>
            </View>
          )}
          <View style={styles.qtyRow}>
            <Text style={styles.qtyLabel}>{t.quantity}</Text>
            <View style={styles.qtyControls}>
              <Pressable style={styles.qtyBtn} onPress={() => setQuantity(q => Math.max(1, q - 1))}>
                <Text style={styles.qtyBtnText}>−</Text>
              </Pressable>
              <Text style={styles.qtyValue}>{quantity}</Text>
              <Pressable style={styles.qtyBtn} onPress={() => setQuantity(q => Math.min(liveStock, q + 1))}>
                <Text style={styles.qtyBtnText}>+</Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.orderSummaryRow}>
            <Text style={styles.orderSummaryLabel}>{t.total}</Text>
            <Text style={styles.orderSummaryValue}>{formatCurrency(quantity * WATER_PRODUCT.pricePerCan)}</Text>
          </View>
          <Pressable style={[styles.orderBtn, ordering && styles.orderBtnDisabled]} onPress={handleQuickOrder} disabled={ordering}>
            <AppIcon name="flash" size={20} color="#fff" />
            <Text style={styles.orderBtnText}>{ordering ? t.placingOrder : t.orderCansNow.replace('{n}', String(quantity)).replace('{s}', quantity > 1 ? 's' : '')}</Text>
          </Pressable>
        </View>

        {/* Product details card */}
        <View style={styles.productCard}>
          <View style={styles.productRow}>
            <View style={styles.productInfo}>
              <Text style={styles.productName}>{WATER_PRODUCT.name}</Text>
              <Text style={styles.productSubtitle}>{WATER_PRODUCT.subtitle}</Text>
            </View>
            <View style={styles.priceBox}>
              <Text style={styles.priceValue}>{formatCurrency(WATER_PRODUCT.pricePerCan)}</Text>
              <Text style={styles.priceLabel}>per can</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <AppIcon name="cube-outline" size={16} color="#1A7FD4" />
              <Text style={styles.statValue}>{liveStock}</Text>
              <Text style={styles.statLabel}>{t.inStock}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <AppIcon name="time-outline" size={16} color="#1A7FD4" />
              <Text style={styles.statValue}>30 min</Text>
              <Text style={styles.statLabel}>{t.express}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <AppIcon name="receipt-outline" size={16} color="#1A7FD4" />
              <Text style={styles.statValue}>{orders.length}</Text>
              <Text style={styles.statLabel}>{t.myOrders}</Text>
            </View>
          </View>

          {liveStock <= WATER_PRODUCT.lowStockThreshold ? (
            <View style={styles.lowStockBanner}>
              <AppIcon name="warning-outline" size={14} color="#B45309" />
              <Text style={styles.lowStockText}>{t.lowStock.replace('{n}', String(liveStock))}</Text>
            </View>
          ) : null}
        </View>

        {/* Recent orders */}
        {orders.length > 0 && (
          <View style={styles.recentBox}>
            <View style={styles.recentHeader}>
              <Text style={styles.recentTitle}>{t.recentOrders}</Text>
              <Pressable onPress={() => navigation.navigate('CustomerOrders')}>
                <Text style={styles.recentSeeAll}>{t.seeAll}</Text>
              </Pressable>
            </View>
            {orders.slice(0, 3).map(order => (
              <View key={order.id} style={styles.recentItem}>
                <View style={[styles.recentDot, { backgroundColor: order.status === 'delivered' ? '#1E7A45' : order.status === 'cancelled' ? '#DC2626' : '#1A7FD4' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.recentOrderNum}>Order #{order.orderNumber} · {order.quantity} can{order.quantity > 1 ? 's' : ''}</Text>
                  <Text style={styles.recentOrderStatus}>{order.status.replace('_', ' ')}</Text>
                </View>
                <Text style={styles.recentOrderAmt}>{formatCurrency(order.totalAmount)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Quick command box */}
        <View style={styles.commandBox}>
          <Text style={styles.commandTitle}>{t.quickActions}</Text>
          <View style={styles.commandGrid}>
            <Pressable style={styles.commandItem} onPress={() => navigation.navigate('CustomerOrders')}>
              <View style={styles.commandIcon}>
                <AppIcon name="receipt-outline" size={22} color="#1A7FD4" />
              </View>
              <Text style={styles.commandLabel}>{t.myOrders}</Text>
            </Pressable>
            <Pressable style={styles.commandItem} onPress={() => navigation.navigate('OrderTracking', {})}>
              <View style={styles.commandIcon}>
                <AppIcon name="navigate-outline" size={22} color="#1A7FD4" />
              </View>
              <Text style={styles.commandLabel}>{t.track}</Text>
            </Pressable>
            <Pressable style={styles.commandItem} onPress={() => navigation.navigate('CustomerWallet')}>
              <View style={styles.commandIcon}>
                <AppIcon name="wallet-outline" size={22} color="#1A7FD4" />
              </View>
              <Text style={styles.commandLabel}>{t.wallet}</Text>
            </Pressable>
            <Pressable style={styles.commandItem} onPress={() => navigation.navigate('CustomerSubscription')}>
              <View style={styles.commandIcon}>
                <AppIcon name="calendar-outline" size={22} color="#1A7FD4" />
              </View>
              <Text style={styles.commandLabel}>{t.plan}</Text>
            </Pressable>
            <Pressable style={styles.commandItem} onPress={() => navigation.navigate('Profile')}>
              <View style={styles.commandIcon}>
                <AppIcon name="person-outline" size={22} color="#1A7FD4" />
              </View>
              <Text style={styles.commandLabel}>{t.profile}</Text>
            </Pressable>
          </View>
        </View>

      </ScrollView>
      <CustomerBottomNav active="CustomerHome" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EEF6FF' },
  content: { paddingBottom: 120 },

  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12
  },
  greeting: { color: '#3A6080', fontSize: 13, fontWeight: '600' },
  shopName: { color: '#0A2540', fontSize: 22, fontWeight: '900', marginTop: 2 },
  profileBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#D6EEFF', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#A8C8E8'
  },

  heroCard: { marginHorizontal: 18, borderRadius: 28, overflow: 'hidden', height: 220 },
  heroImage: { width: '100%', height: '100%' },
  heroOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 18, backgroundColor: 'rgba(0,30,60,0.38)'
  },
  heroBadge: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 8
  },
  heroBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  heroTitle: { color: '#fff', fontSize: 26, fontWeight: '900', lineHeight: 32 },

  productCard: {
    marginHorizontal: 18, marginTop: 14,
    backgroundColor: '#fff', borderRadius: 24, padding: 18,
    borderWidth: 1, borderColor: '#C8DFF5'
  },
  productRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  productInfo: { flex: 1 },
  productName: { color: '#0A2540', fontSize: 17, fontWeight: '900' },
  productSubtitle: { color: '#3A6080', fontSize: 13, marginTop: 4 },
  priceBox: { alignItems: 'flex-end' },
  priceValue: { color: '#1A7FD4', fontSize: 22, fontWeight: '900' },
  priceLabel: { color: '#6A90B0', fontSize: 12, marginTop: 2 },

  statsRow: {
    flexDirection: 'row', marginTop: 16,
    backgroundColor: '#EAF4FF', borderRadius: 18, padding: 14
  },
  statBox: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { color: '#0A2540', fontSize: 15, fontWeight: '900' },
  statLabel: { color: '#6A90B0', fontSize: 11 },
  statDivider: { width: 1, backgroundColor: '#A8C8E8' },

  lowStockBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 12, backgroundColor: '#FEF3C7', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8
  },
  lowStockText: { color: '#B45309', fontSize: 12, fontWeight: '700' },

  orderCard: {
    marginHorizontal: 18, marginTop: 16,
    backgroundColor: '#fff', borderRadius: 24, padding: 18,
    borderWidth: 1, borderColor: '#C8DFF5'
  },
  orderCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14
  },
  orderCardImage: {
    width: 56, height: 56, borderRadius: 14
  },
  orderCardInfo: { flex: 1 },
  orderCardTitle: { color: '#0A2540', fontSize: 16, fontWeight: '900' },
  orderCardPrice: { color: '#1A7FD4', fontSize: 13, fontWeight: '700', marginTop: 3 },
  successBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#E7F7EA', borderRadius: 16, padding: 14, marginBottom: 14
  },
  successBannerTitle: { color: '#1E7A45', fontSize: 14, fontWeight: '900' },
  successBannerSub: { color: '#3A6080', fontSize: 12, marginTop: 2 },
  qtyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  qtyLabel: { color: '#3A6080', fontSize: 15, fontWeight: '700' },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  qtyBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#EAF4FF', alignItems: 'center', justifyContent: 'center'
  },
  qtyBtnText: { color: '#1A7FD4', fontSize: 22, fontWeight: '900', lineHeight: 26 },
  qtyValue: { color: '#0A2540', fontSize: 22, fontWeight: '900', minWidth: 28, textAlign: 'center' },
  orderSummaryRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#EAF4FF', marginBottom: 14
  },
  orderSummaryLabel: { color: '#6A90B0', fontSize: 14, fontWeight: '700' },
  orderSummaryValue: { color: '#0A2540', fontSize: 18, fontWeight: '900' },
  orderBtn: {
    backgroundColor: '#1A7FD4', borderRadius: 18,
    paddingVertical: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8
  },
  orderBtnDisabled: { opacity: 0.6 },
  orderBtnText: { color: '#fff', fontSize: 17, fontWeight: '900' },
  recentBox: {
    marginHorizontal: 18, marginTop: 14,
    backgroundColor: '#fff', borderRadius: 24, padding: 18,
    borderWidth: 1, borderColor: '#C8DFF5'
  },
  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  recentTitle: { color: '#0A2540', fontSize: 17, fontWeight: '900' },
  recentSeeAll: { color: '#1A7FD4', fontSize: 13, fontWeight: '800' },
  recentItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#EAF4FF' },
  recentDot: { width: 10, height: 10, borderRadius: 5 },
  recentOrderNum: { color: '#0A2540', fontSize: 14, fontWeight: '800' },
  recentOrderStatus: { color: '#6A90B0', fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  recentOrderAmt: { color: '#1A7FD4', fontSize: 14, fontWeight: '900' },

  card: {
    marginHorizontal: 18, marginTop: 14,
    backgroundColor: '#fff', borderRadius: 24, padding: 18,
    borderWidth: 1, borderColor: '#C8DFF5'
  },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: '#0A2540', fontSize: 17, fontWeight: '900' },
  cardSub: { color: '#6A90B0', fontSize: 13, marginTop: 3 },
  trackBtn: {
    backgroundColor: '#D6EEFF', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 8
  },
  trackBtnText: { color: '#1A7FD4', fontSize: 13, fontWeight: '800' },
  tileRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  tile: { flex: 1, backgroundColor: '#EAF4FF', borderRadius: 16, padding: 12 },
  tileLabel: { color: '#6A90B0', fontSize: 11, fontWeight: '700' },
  tileValue: { color: '#0A2540', fontSize: 14, fontWeight: '800', marginTop: 4 },

  lastOrderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  lastOrderNum: { color: '#0A2540', fontSize: 15, fontWeight: '800' },
  lastOrderStatus: { color: '#6A90B0', fontSize: 13 },

  reorderBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', marginTop: 14,
    backgroundColor: '#D6EEFF', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 9
  },
  reorderBtnText: { color: '#1A7FD4', fontSize: 13, fontWeight: '800' },

  commandBox: {
    marginHorizontal: 18, marginTop: 14,
    backgroundColor: '#fff', borderRadius: 24, padding: 18,
    borderWidth: 1, borderColor: '#C8DFF5'
  },
  commandTitle: { color: '#0A2540', fontSize: 17, fontWeight: '900', marginBottom: 14 },
  commandGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  commandItem: { width: '30%', alignItems: 'center', gap: 8, paddingVertical: 10 },
  commandIcon: {
    width: 52, height: 52, borderRadius: 18,
    backgroundColor: '#D6EEFF', alignItems: 'center', justifyContent: 'center'
  },
  commandLabel: { color: '#0A2540', fontSize: 12, fontWeight: '700', textAlign: 'center' },

  reviewBox: {
    marginHorizontal: 18, marginTop: 14, marginBottom: 4,
    backgroundColor: '#fff', borderRadius: 24, padding: 18,
    borderWidth: 1, borderColor: '#C8DFF5'
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  reviewTitle: { color: '#0A2540', fontSize: 16, fontWeight: '800' },
  reviewUser: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  reviewAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#1A7FD4', alignItems: 'center', justifyContent: 'center'
  },
  reviewAvatarText: { color: '#fff', fontSize: 18, fontWeight: '900' },
  reviewName: { color: '#0A2540', fontSize: 15, fontWeight: '800' },
  reviewSubtext: { color: '#6A90B0', fontSize: 12, marginTop: 2 },
  starsRow: { flexDirection: 'row', gap: 8 },
  starBtn: { padding: 2 },
  reviewDone: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  reviewDoneText: { color: '#1A7FD4', fontSize: 13, fontWeight: '700' },
  reviewHint: { color: '#6A90B0', fontSize: 12, marginTop: 10 },


});

export default CustomerHomeScreen;
