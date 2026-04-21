import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useContext, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { AuthContext } from '../../App';
import OrderStatusTracker from '../components/OrderStatusTracker';
import { formatCurrency, ORDER_STATUS_META } from '../data/orderModule';
import { RootStackParamList } from '../navigation/AppNavigator';
import { fetchCustomerOrders, OrderRecord, subscribeToOrder } from '../services/firebaseService';
import { useLang } from '../i18n/LanguageContext';

type RouteProps = RouteProp<RootStackParamList, 'OrderTracking'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const OWNER_PHONE = '+91 99000 02222';

const OrderTrackingScreen = () => {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProp>();
  const { profile } = useContext(AuthContext);
  const { t } = useLang();
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let active = true;

    const load = async () => {
      const orderId = route.params?.orderId;
      if (orderId) {
        unsubscribe = subscribeToOrder(orderId, (next) => {
          if (active) { setOrder(next); setLoading(false); }
        });
        return;
      }
      if (!profile?.uid) { setLoading(false); return; }
      const orders = await fetchCustomerOrders(profile.uid).catch(() => []);
      const active_ = orders.find((o) => o.status !== 'delivered' && o.status !== 'cancelled') ?? orders[0] ?? null;
      if (active) { setOrder(active_); setLoading(false); }
      if (active_?.id) {
        unsubscribe = subscribeToOrder(active_.id, (next) => { if (active) setOrder(next); });
      }
    };

    load();
    return () => { active = false; unsubscribe?.(); };
  }, [profile?.uid, route.params?.orderId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loader}>
        <ActivityIndicator size="large" color="#1E7A45" />
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{t.noActiveOrder}</Text>
          <Text style={styles.emptyText}>{t.placeOrderToTrack}</Text>
          <Pressable style={styles.primaryBtn} onPress={() => navigation.navigate('NewOrder', {})}>
            <Text style={styles.primaryBtnText}>{t.bookWaterNow}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const statusMeta = ORDER_STATUS_META[order.status];
  const contactPhone = order.phone || OWNER_PHONE;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>{t.back}</Text>
          </Pressable>
          <View style={[styles.statusBadge, { backgroundColor: statusMeta.background }]}>
            <Text style={[styles.statusBadgeText, { color: statusMeta.text }]}>{statusMeta.label}</Text>
          </View>
        </View>

        {/* Hero */}
        <View style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View style={styles.heroChip}>
              <Text style={styles.heroChipText}>{order.quantity} {t.cans}</Text>
            </View>
            <View style={styles.heroChip}>
              <Text style={styles.heroChipText}>{formatCurrency(order.totalAmount)}</Text>
            </View>
            <View style={styles.heroChip}>
              <Text style={styles.heroChipText}>{order.deliverySlot}</Text>
            </View>
          </View>
        </View>

        {/* Status steps */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.orderSteps}</Text>
          <OrderStatusTracker status={order.status} />
        </View>

        {/* Product details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.productDetails}</Text>
          <View style={styles.productRow}>
            <View style={styles.productIcon}>
              <Text style={styles.productIconText}>💧</Text>
            </View>
            <View style={styles.productInfo}>
              <Text style={styles.productName}>{order.productName}</Text>
              <Text style={styles.productMeta}>{order.quantity} cans × {formatCurrency(order.pricePerCan)}</Text>
              <Text style={order.deliveryCharge > 0 ? styles.productMeta : styles.productMetaGreen}>
                {order.deliveryCharge > 0 ? t.deliveryCharge.replace('{amt}', formatCurrency(order.deliveryCharge)) : t.freeDelivery}
              </Text>
            </View>
            <Text style={styles.productTotal}>{formatCurrency(order.totalAmount)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t.payment}</Text>
            <Text style={styles.infoValue}>{order.paymentMethod}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t.paymentStatus}</Text>
            <View style={styles.payBadge}>
              <Text style={styles.payBadgeText}>
                {order.paymentStatus === 'paid' ? t.paid : t.payOnDelivery}
              </Text>
            </View>
          </View>
        </View>

        {/* Delivery address */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.deliveryAddress2}</Text>
          <View style={styles.addressBox}>
            <Text style={styles.addressName}>{order.customerName}</Text>
            <Text style={styles.addressPhone}>{order.phone}</Text>
            <Text style={styles.addressText}>{order.address || t.noAddressSaved}</Text>
          </View>
        </View>

        {/* Call & Message */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.contactDeliveryTeam}</Text>
          <Text style={styles.contactHint}>{t.callOrMessage}</Text>
          <View style={styles.contactRow}>
            <Pressable style={styles.callBtn} onPress={() => Linking.openURL(`tel:${contactPhone}`)}>
              <Text style={styles.contactIcon}>📞</Text>
              <Text style={styles.callBtnText}>{t.call}</Text>
            </Pressable>
            <Pressable style={styles.msgBtn} onPress={() => Linking.openURL(`sms:${contactPhone}`)}>
              <Text style={styles.contactIcon}>💬</Text>
              <Text style={styles.msgBtnText}>{t.message}</Text>
            </Pressable>
            <Pressable style={styles.waBtn} onPress={() => Linking.openURL(`https://wa.me/${contactPhone.replace(/[^0-9]/g, '')}`)}>
              <Text style={styles.contactIcon}>🟢</Text>
              <Text style={styles.waBtnText}>{t.whatsapp}</Text>
            </Pressable>
          </View>
        </View>

        <Pressable style={styles.detailsBtn} onPress={() => navigation.navigate('OrderDetails', { orderId: order.id! })}>
          <Text style={styles.detailsBtnText}>{t.viewFullDetails}</Text>
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F7F4' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F7F4' },
  content: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  backBtn: { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9, borderWidth: 1, borderColor: '#D6E6DC' },
  backBtnText: { color: '#1E7A45', fontSize: 14, fontWeight: '800' },
  statusBadge: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  statusBadgeText: { fontSize: 12, fontWeight: '800' },
  heroCard: { backgroundColor: '#1E7A45', borderRadius: 28, padding: 22, marginBottom: 14 },
  heroRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  heroChip: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7 },
  heroChipText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#E0EDE6' },
  cardTitle: { color: '#173726', fontSize: 17, fontWeight: '900', marginBottom: 14 },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  productIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#E8F7EE', alignItems: 'center', justifyContent: 'center' },
  productIconText: { fontSize: 26 },
  productInfo: { flex: 1 },
  productName: { color: '#173726', fontSize: 15, fontWeight: '800' },
  productMeta: { color: '#6B8174', fontSize: 13, marginTop: 3 },
  productMetaGreen: { color: '#1E7A45', fontSize: 13, marginTop: 3, fontWeight: '700' },
  productTotal: { color: '#173726', fontSize: 18, fontWeight: '900' },
  divider: { height: 1, backgroundColor: '#EDF4EF', marginVertical: 14 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  infoLabel: { color: '#6B8174', fontSize: 13, fontWeight: '700' },
  infoValue: { color: '#173726', fontSize: 14, fontWeight: '800' },
  payBadge: { backgroundColor: '#E8F7EE', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  payBadgeText: { color: '#1E7A45', fontSize: 12, fontWeight: '800' },
  addressBox: { backgroundColor: '#F4FBF6', borderRadius: 18, padding: 14 },
  addressName: { color: '#173726', fontSize: 15, fontWeight: '800' },
  addressPhone: { color: '#6B8174', fontSize: 13, marginTop: 3 },
  addressText: { color: '#173726', fontSize: 14, marginTop: 6, lineHeight: 21 },
  contactHint: { color: '#6B8174', fontSize: 13, marginBottom: 14 },
  contactRow: { flexDirection: 'row', gap: 10 },
  callBtn: { flex: 1, backgroundColor: '#1E7A45', borderRadius: 18, paddingVertical: 14, alignItems: 'center', gap: 4 },
  callBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  msgBtn: { flex: 1, backgroundColor: '#E8F7EE', borderRadius: 18, paddingVertical: 14, alignItems: 'center', gap: 4 },
  msgBtnText: { color: '#1E7A45', fontSize: 13, fontWeight: '800' },
  waBtn: { flex: 1, backgroundColor: '#E8F7EE', borderRadius: 18, paddingVertical: 14, alignItems: 'center', gap: 4 },
  waBtnText: { color: '#1E7A45', fontSize: 13, fontWeight: '800' },
  contactIcon: { fontSize: 18 },
  detailsBtn: { backgroundColor: '#fff', borderRadius: 18, paddingVertical: 15, alignItems: 'center', borderWidth: 1, borderColor: '#D6E6DC' },
  detailsBtnText: { color: '#1E7A45', fontSize: 15, fontWeight: '800' },
  primaryBtn: { backgroundColor: '#1E7A45', borderRadius: 18, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  emptyCard: { margin: 18, backgroundColor: '#fff', borderRadius: 24, padding: 24, alignItems: 'center' },
  emptyTitle: { color: '#173726', fontSize: 20, fontWeight: '800' },
  emptyText: { color: '#6B8174', fontSize: 14, marginTop: 8, marginBottom: 16, textAlign: 'center', lineHeight: 21 }
});

export default OrderTrackingScreen;
