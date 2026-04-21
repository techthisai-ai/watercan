import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useContext, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import {
  canCancelOrder,
  canModifyOrder,
  formatCurrency,
  formatOrderDate,
  formatOrderNumber,
  ORDER_STATUS_META
} from '../data/orderModule';
import { RootStackParamList } from '../navigation/AppNavigator';
import { cancelOrder, getOrderById, OrderRecord, OrderStatus, updateOrderStatus } from '../services/firebaseService';
import { useLang } from '../i18n/LanguageContext';

type RouteProps = RouteProp<RootStackParamList, 'OrderDetails'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const ownerFlow: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'];
const nextStatusLabel: Record<OrderStatus, string> = {
  pending: 'Confirm Order',
  confirmed: 'Mark Preparing',
  preparing: 'Mark Out for Delivery',
  out_for_delivery: 'Mark Delivered',
  delivered: 'Delivered',
  cancelled: 'Cancelled'
};

const OWNER_PHONE = '+91 99000 02222';

const OrderDetailsScreen = () => {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProp>();
  const { profile } = useContext(AuthContext);
  const { t } = useLang();
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    getOrderById(route.params.orderId).then((data) => {
      if (active) { setOrder(data); setLoading(false); }
    });
    return () => { active = false; };
  }, [route.params.orderId]);

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
          <Text style={styles.emptyTitle}>{t.orderNotFound}</Text>
          <Pressable style={styles.primaryBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.primaryBtnText}>{t.goBack}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isOwner = profile?.role === 'owner';
  const statusMeta = ORDER_STATUS_META[order.status];
  const currentIndex = ownerFlow.indexOf(order.status);
  const nextStatus = currentIndex >= 0 && currentIndex < ownerFlow.length - 1 ? ownerFlow[currentIndex + 1] : null;

  const handleAdvanceStatus = async () => {
    if (!nextStatus) return;
    setSaving(true);
    try {
      await updateOrderStatus(order.id!, nextStatus);
      setOrder({ ...order, status: nextStatus });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(t.cancelOrder, t.cancelOrderConfirm, [
      { text: t.no },
      {
        text: t.yesCancel, style: 'destructive',
        onPress: async () => {
          await cancelOrder(order.id!);
          setOrder({ ...order, status: 'cancelled' });
        }
      }
    ]);
  };

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
          <Text style={styles.heroEyebrow}>{t.orderDetails}</Text>
          <Text style={styles.heroOrderNum}>{formatOrderNumber(order)}</Text>
          <Text style={styles.heroDate}>{formatOrderDate(order.createdAt)}</Text>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatVal}>{order.quantity}</Text>
              <Text style={styles.heroStatLbl}>{t.cans}</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatVal}>{formatCurrency(order.totalAmount)}</Text>
              <Text style={styles.heroStatLbl}>{t.total}</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatVal}>{order.deliverySlot}</Text>
              <Text style={styles.heroStatLbl}>{t.slot}</Text>
            </View>
          </View>
        </View>

        {/* Delivery Tracking */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.deliveryTracking}</Text>
          <OrderStatusTracker status={order.status} />
        </View>

        {/* Product Details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.productDetails}</Text>
          <View style={styles.productRow}>
            <View style={styles.productIcon}>
              <Text style={styles.productIconText}>💧</Text>
            </View>
            <View style={styles.productInfo}>
              <Text style={styles.productName}>{order.productName}</Text>
              <Text style={styles.productMeta}>{order.quantity} cans × {formatCurrency(order.pricePerCan)}</Text>
              {order.deliveryCharge > 0 ? (
                <Text style={styles.productMeta}>{t.deliveryCharge.replace('{amt}', formatCurrency(order.deliveryCharge))}</Text>
              ) : (
                <Text style={styles.productMetaGreen}>{t.freeDelivery}</Text>
              )}
            </View>
            <Text style={styles.productTotal}>{formatCurrency(order.totalAmount)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t.payment}</Text>
            <Text style={styles.infoValue}>{order.paymentMethod}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t.paymentStatusLabel}</Text>
            <View style={styles.payBadge}>
              <Text style={styles.payBadgeText}>
                {order.paymentStatus === 'paid' ? t.paid : order.paymentStatus === 'partial' ? t.partPaid : t.payOnDelivery}
              </Text>
            </View>
          </View>
          {order.note ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t.note}</Text>
              <Text style={styles.infoValue}>{order.note}</Text>
            </View>
          ) : null}
        </View>

        {/* Delivery Address */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.deliveryAddress2}</Text>
          <View style={styles.addressBox}>
            <Text style={styles.addressName}>{order.customerName}</Text>
            <Text style={styles.addressPhone}>{order.phone}</Text>
            <Text style={styles.addressText}>{order.address || t.noAddressSaved}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t.expectedArrival}</Text>
            <Text style={styles.infoValue}>{order.expectedDeliveryTime}</Text>
          </View>
        </View>

        {/* Contact */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.contact}</Text>
          <Text style={styles.contactHint}>{t.callOrMessageDelivery}</Text>
          <View style={styles.contactRow}>
            <Pressable style={styles.callBtn} onPress={() => Linking.openURL(`tel:${contactPhone}`)}>
              <Text style={styles.callBtnIcon}>📞</Text>
              <Text style={styles.callBtnText}>{t.call}</Text>
            </Pressable>
            <Pressable style={styles.msgBtn} onPress={() => Linking.openURL(`sms:${contactPhone}`)}>
              <Text style={styles.msgBtnIcon}>💬</Text>
              <Text style={styles.msgBtnText}>{t.message}</Text>
            </Pressable>
            <Pressable style={styles.waBtn} onPress={() => Linking.openURL(`https://wa.me/${contactPhone.replace(/[^0-9]/g, '')}`)}>
              <Text style={styles.waBtnIcon}>🟢</Text>
              <Text style={styles.waBtnText}>{t.whatsapp}</Text>
            </Pressable>
          </View>
        </View>

        {/* Actions */}
        {isOwner ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t.updateOrderStatus}</Text>
            <Pressable
              style={[styles.primaryBtn, (!nextStatus || saving) && styles.disabledBtn]}
              onPress={handleAdvanceStatus}
              disabled={!nextStatus || saving}
            >
              <Text style={styles.primaryBtnText}>
                {saving ? t.updating : nextStatus ? nextStatusLabel[order.status] : t.orderComplete}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <Pressable style={styles.primaryBtn} onPress={() => navigation.navigate('OrderTracking', { orderId: order.id })}>
              <Text style={styles.primaryBtnText}>{t.trackThisOrder}</Text>
            </Pressable>
            {canModifyOrder(order.status) ? (
              <Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate('NewOrder', { orderId: order.id })}>
                <Text style={styles.secondaryBtnText}>{t.modifyOrder}</Text>
              </Pressable>
            ) : null}
            {canCancelOrder(order.status) ? (
              <Pressable style={styles.cancelBtn} onPress={handleCancel}>
                <Text style={styles.cancelBtnText}>{t.cancelOrder}</Text>
              </Pressable>
            ) : null}
          </View>
        )}
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
  heroEyebrow: { color: '#A8F0C0', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  heroOrderNum: { color: '#fff', fontSize: 32, fontWeight: '900', marginTop: 6 },
  heroDate: { color: '#C8F0D8', fontSize: 13, marginTop: 4 },
  heroStats: { flexDirection: 'row', marginTop: 18, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 18, padding: 14 },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatVal: { color: '#fff', fontSize: 16, fontWeight: '900' },
  heroStatLbl: { color: '#C8F0D8', fontSize: 11, marginTop: 4 },
  heroStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
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
  infoValue: { color: '#173726', fontSize: 14, fontWeight: '800', flex: 1, textAlign: 'right' },
  payBadge: { backgroundColor: '#E8F7EE', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  payBadgeText: { color: '#1E7A45', fontSize: 12, fontWeight: '800' },
  addressBox: { backgroundColor: '#F4FBF6', borderRadius: 18, padding: 14, marginBottom: 10 },
  addressName: { color: '#173726', fontSize: 15, fontWeight: '800' },
  addressPhone: { color: '#6B8174', fontSize: 13, marginTop: 3 },
  addressText: { color: '#173726', fontSize: 14, marginTop: 6, lineHeight: 21 },
  contactHint: { color: '#6B8174', fontSize: 13, marginBottom: 14 },
  contactRow: { flexDirection: 'row', gap: 10 },
  callBtn: { flex: 1, backgroundColor: '#1E7A45', borderRadius: 18, paddingVertical: 14, alignItems: 'center', gap: 4 },
  callBtnIcon: { fontSize: 18 },
  callBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  msgBtn: { flex: 1, backgroundColor: '#E8F7EE', borderRadius: 18, paddingVertical: 14, alignItems: 'center', gap: 4 },
  msgBtnIcon: { fontSize: 18 },
  msgBtnText: { color: '#1E7A45', fontSize: 13, fontWeight: '800' },
  waBtn: { flex: 1, backgroundColor: '#E8F7EE', borderRadius: 18, paddingVertical: 14, alignItems: 'center', gap: 4 },
  waBtnIcon: { fontSize: 18 },
  waBtnText: { color: '#1E7A45', fontSize: 13, fontWeight: '800' },
  primaryBtn: { backgroundColor: '#1E7A45', borderRadius: 18, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  secondaryBtn: { backgroundColor: '#E8F7EE', borderRadius: 18, paddingVertical: 15, alignItems: 'center', marginTop: 10 },
  secondaryBtnText: { color: '#1E7A45', fontSize: 16, fontWeight: '800' },
  cancelBtn: { backgroundColor: '#FFF1F1', borderRadius: 18, paddingVertical: 15, alignItems: 'center', marginTop: 10 },
  cancelBtnText: { color: '#B42318', fontSize: 16, fontWeight: '800' },
  disabledBtn: { opacity: 0.5 },
  emptyCard: { margin: 18, backgroundColor: '#fff', borderRadius: 24, padding: 24, alignItems: 'center' },
  emptyTitle: { color: '#173726', fontSize: 20, fontWeight: '800', marginBottom: 16 }
});

export default OrderDetailsScreen;
