import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ImageBackground, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AuthContext } from '../../App';
import AppIcon from '../components/AppIcon';
import CustomerBottomNav from '../components/CustomerBottomNav';
import NotificationBell from '../components/NotificationBell';
import OrderStatusTracker from '../components/OrderStatusTracker';
import { formatCurrency, formatOrderNumber, formatOrderReference, getCustomerPaymentStatusLabel, WATER_PRODUCT } from '../data/orderModule';
import { useLang } from '../i18n/LanguageContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import {
  createOrder,
  subscribeToInventoryStock,
  getFriendlyOrderMessage,
  OrderRecord,
  subscribeToCustomerOrders
} from '../services/firebaseService';
import waterCanImage from '../assets/20-l-water-can1.jpg';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'CustomerHome'>;
type CustomerHomeRouteProp = RouteProp<RootStackParamList, 'CustomerHome'>;
type OrderModalMode = 'repeat' | null;
const isSameOrderFeed = (prev: OrderRecord[], next: OrderRecord[]) =>
  prev.length === next.length &&
  prev.every((order, index) => {
    const candidate = next[index];
    return (
      order.id === candidate?.id &&
      order.orderNumber === candidate?.orderNumber &&
      order.status === candidate?.status &&
      order.updatedAt === candidate?.updatedAt &&
      order.deliveredQuantity === candidate?.deliveredQuantity &&
      order.pendingQuantity === candidate?.pendingQuantity &&
      order.paymentStatus === candidate?.paymentStatus &&
      order.paidAmount === candidate?.paidAmount &&
      !!order.paymentApproved === !!candidate?.paymentApproved
    );
  });

const CustomerHomeScreen = () => {
  const { profile } = useContext(AuthContext);
  const { t } = useLang();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<CustomerHomeRouteProp>();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [liveStock, setLiveStock] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [ordering, setOrdering] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<{ orderNumber?: number } | null>(null);
  const [orderModalMode, setOrderModalMode] = useState<OrderModalMode>(null);
  const orderSubmitInFlight = useRef(false);

  useEffect(() => {
    // Subscribe to inventory stock in real time.
    const unsubscribeStock = subscribeToInventoryStock((stock) => {
      setLiveStock(stock);
    });
    return unsubscribeStock;
  }, []);

  useEffect(() => {
    if (!profile?.uid) {
      setOrders([]);
      return;
    }
    let active = true;
    const unsubscribeOrders = subscribeToCustomerOrders(profile.uid, (data) => {
      if (active) {
        setOrders((current) => (isSameOrderFeed(current, data) ? current : data));
        setTotalOrders(data.filter((order) => order.status !== 'cancelled').length);
      }
    });
    return () => {
      active = false;
      unsubscribeOrders?.();
    };
  }, [profile?.uid]);

  useEffect(() => {
    const reorderOrderId = route.params?.reorderOrderId;
    if (!reorderOrderId) {
      return;
    }
    navigation.navigate('NewOrder', { orderId: reorderOrderId });
    navigation.setParams({ reorderOrderId: undefined });
  }, [navigation, route.params?.reorderOrderId]);

  useEffect(() => {
    const editOrderId = route.params?.editOrderId;
    if (!editOrderId) {
      return;
    }
    navigation.navigate('NewOrder', { orderId: editOrderId });
    navigation.setParams({ editOrderId: undefined });
  }, [navigation, route.params?.editOrderId]);

  const countedOrders = useMemo(() => orders.filter((order) => order.status !== 'cancelled'), [orders]);
  const activeOrders = useMemo(() => countedOrders.filter((order) => order.status !== 'delivered'), [countedOrders]);
  const activeOrder = activeOrders[0] ?? null;
  const activeOrderDelivered = activeOrder
    ? Math.max(
        0,
        Math.min(activeOrder.quantity, activeOrder.deliveredQuantity ?? (activeOrder.status === 'delivered' ? activeOrder.quantity : 0))
      )
    : 0;
  const activeOrderPending = activeOrder
    ? Math.max(0, Math.min(activeOrder.quantity, activeOrder.pendingQuantity ?? (activeOrder.quantity - activeOrderDelivered)))
    : 0;
  const activeOrderStatusLabel =
    activeOrder && activeOrder.status === 'out_for_delivery' && activeOrderDelivered > 0 && activeOrderPending > 0
      ? 'Partial'
      : null;
  const activeOrderPaymentLabel = activeOrder ? getCustomerPaymentStatusLabel(activeOrder) : 'Unpaid';

  useEffect(() => {
    const latestOrder = orders[0];
    if (!latestOrder) {
      setQuantity((current) => (current < 1 ? 1 : current));
      return;
    }

    const nextQuantity = Math.max(1, Math.min(liveStock, latestOrder.quantity));
    setQuantity((current) => (current === nextQuantity ? current : nextQuantity));
  }, [orders, liveStock]);

  const validateOrder = (stock = liveStock, shouldNavigateToProfile = true) => {
    if (!profile) {
      Alert.alert(t.orderFailed, 'Please sign in again.');
      return false;
    }
    if (profile.role !== 'customer') {
      Alert.alert(t.orderFailed, 'Only customer accounts can place new orders.');
      return false;
    }
    if (!profile.address?.trim()) {
      Alert.alert(t.orderFailed, 'Please add your delivery address in Profile before placing an order.');
      if (shouldNavigateToProfile) {
        navigation.navigate('Profile');
      }
      return false;
    }
    if (stock <= 0) {
      Alert.alert(t.orderFailed, 'Water cans are currently out of stock.');
      return false;
    }
    if (quantity > stock) {
      Alert.alert(t.orderFailed, `Only ${stock} cans are available right now.`);
      return false;
    }
    return true;
  };

  const submitOrder = async () => {
    if (ordering || orderSubmitInFlight.current) {
      return;
    }

    if (!validateOrder(liveStock, false) || !profile) {
      return;
    }

    orderSubmitInFlight.current = true;
    setOrdering(true);
    try {
      const totalAmount = quantity * WATER_PRODUCT.pricePerCan;
      const result = await createOrder({
        customerId: profile.uid,
        customerName: profile.name,
        phone: profile.phone,
        address: profile.address?.trim() || '',
        productName: WATER_PRODUCT.name,
        orderType: 'single',
        packName: '',
        quantity,
        pricePerCan: WATER_PRODUCT.pricePerCan,
        deliveryCharge: 0,
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
      setOrders((current) => {
        const nextOrder = result as OrderRecord;
        return current.some((order) => order.id === nextOrder.id)
          ? current
          : [nextOrder, ...current];
      });
      setLiveStock((current) => Math.max(0, current - quantity));
      setOrderSuccess({ orderNumber: result.orderNumber });
      setOrderModalMode(null);
      setTimeout(() => setOrderSuccess(null), 3500);
    } catch (e: any) {
      Alert.alert(t.orderFailed, getFriendlyOrderMessage(e));
    } finally {
      orderSubmitInFlight.current = false;
      setOrdering(false);
    }
  };

  const handleOrder = async () => {
    if (!validateOrder()) {
      return;
    }
    if (activeOrder) {
      setOrderModalMode('repeat');
      return;
    }

    submitOrder();
  };

  const handleOrderAgain = async () => {
    submitOrder();
  };

  return (
    <SafeAreaView style={styles.container}>
      <Modal
        visible={orderModalMode !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setOrderModalMode(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {orderModalMode === 'repeat' ? (
              <>
                <Text style={styles.modalTitle}>You have already placed an order. Do you want to place again?</Text>
                <View style={styles.modalActions}>
                  <Pressable style={styles.modalSecondaryButton} onPress={() => setOrderModalMode(null)}>
                    <Text style={styles.modalSecondaryButtonText}>Close</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.modalPrimaryButton, ordering && styles.disabledButton]}
                    onPress={handleOrderAgain}
                    disabled={ordering}
                  >
                    <Text style={styles.modalPrimaryButtonText}>{ordering ? t.placingOrder : 'Order Again'}</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{t.hello}, {profile?.name?.split(' ')[0] || t.customer}</Text>
            <Text style={styles.appName}>{t.appName}</Text>
          </View>
          <View style={styles.headerActions}>
            <NotificationBell />
            <Pressable style={styles.profileButton} onPress={() => navigation.navigate('Profile')}>
              <AppIcon name="person" size={20} color="#0F6CBD" />
            </Pressable>
          </View>
        </View>

        {orderSuccess ? (
          <View style={styles.successBanner}>
            <AppIcon name="checkmark-circle" size={20} color="#1E7A45" />
            <View style={styles.successCopy}>
              <Text style={styles.successTitle}>Order Successful</Text>
              <Text style={styles.successText}>
                {orderSuccess.orderNumber ? `Order ${formatOrderNumber(orderSuccess)} is now being tracked below.` : 'Your order is now being tracked below.'}
              </Text>
            </View>
            <Pressable style={styles.successClose} onPress={() => setOrderSuccess(null)}>
              <Text style={styles.successCloseText}>×</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Horizontal tracking bar */}
        {activeOrder ? (
          <View style={styles.trackBar}>
            <View style={styles.trackHeader}>
              <Text style={styles.trackLabelText}>
                {activeOrderStatusLabel ? `${activeOrderStatusLabel} • ` : ''}Tracking {formatOrderReference(activeOrder)}
              </Text>
              <View style={[styles.paymentStatusPill, activeOrderPaymentLabel === 'Paid' ? styles.paymentStatusPaid : styles.paymentStatusPending]}>
                <Text style={[styles.paymentStatusText, activeOrderPaymentLabel === 'Paid' ? styles.paymentStatusTextPaid : styles.paymentStatusTextPending]}>
                  Payment: {activeOrderPaymentLabel === 'Approval Pending' ? 'Approval Pending' : activeOrderPaymentLabel}
                </Text>
              </View>
            </View>
            <OrderStatusTracker status={activeOrder.status} compact />
          </View>
        ) : (
          <View style={styles.noOrderBar}>
            <AppIcon name="water-outline" size={18} color="#7B93AA" />
            <Text style={styles.noOrderText}>No water can order placed</Text>
          </View>
        )}

        <View style={styles.productDetailsBox}>
          <View style={styles.productDetailsHeader}>
            <Text style={styles.productDetailsTitle}>Product details</Text>
            <Text style={styles.productPrice}>{formatCurrency(WATER_PRODUCT.pricePerCan)}</Text>
          </View>
          <View style={styles.productStatsRow}>
            <View style={styles.productStat}>
              <AppIcon name="cube-outline" size={16} color="#0F6CBD" />
              <View>
                <Text style={styles.productStatLabel}>Stock</Text>
                <Text style={styles.productStatValue}>{liveStock} cans</Text>
              </View>
            </View>
            <View style={styles.productStat}>
              <AppIcon name="receipt-outline" size={16} color="#0F6CBD" />
              <View>
                <Text style={styles.productStatLabel}>Orders</Text>
                <Text style={styles.productStatValue}>{totalOrders}</Text>
              </View>
            </View>
          </View>
        </View>

        <ImageBackground source={waterCanImage} resizeMode="contain" imageStyle={styles.bgCanImage} style={styles.heroCard}>
          <View style={styles.bgWash} />
          <View style={styles.heroQuantityOverlay}>
            <Pressable
              style={[styles.stepperButton, ordering && styles.disabledButton]}
              onPress={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={ordering}
            >
              <Text style={styles.stepperText}>-</Text>
            </Pressable>
            <View style={styles.quantityValueWrap}>
              <Text style={styles.quantityValue}>{quantity}</Text>
              <Text style={styles.quantityHint}>cans</Text>
            </View>
            <Pressable
              style={[styles.stepperButton, ordering && styles.disabledButton]}
              onPress={() => setQuantity((q) => Math.min(liveStock, q + 1))}
              disabled={ordering}
            >
              <Text style={styles.stepperText}>+</Text>
            </Pressable>
          </View>
        </ImageBackground>

        <View style={[styles.card, styles.orderCard]}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatCurrency(quantity * WATER_PRODUCT.pricePerCan)}</Text>
          </View>
          <Pressable style={[styles.orderButton, ordering && styles.disabledButton]} onPress={handleOrder} disabled={ordering}>
            <Text style={styles.orderButtonText}>
              {ordering ? t.placingOrder : `Order ${quantity} Can${quantity > 1 ? 's' : ''}`}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <CustomerBottomNav active="CustomerHome" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F8FC'
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 120
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  greeting: {
    color: '#56708A',
    fontSize: 13,
    fontWeight: '600'
  },
  appName: {
    color: '#12314D',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 2
  },
  profileButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#C9DFF2',
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  heroCard: {
    height: 220,
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 0,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center'
  },
  bgCanImage: {
    width: '100%',
    height: '100%'
  },
  bgWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.15)'
  },
  heroQuantityOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '85%',
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  heroProductName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900'
  },
  heroPriceText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: 'rgba(15,108,189,0.85)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  statusPillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800'
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#E8F7EE',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#BDE8CA',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12
  },
  successCopy: {
    flex: 1,
    minWidth: 0
  },
  successTitle: {
    color: '#1E7A45',
    fontSize: 15,
    fontWeight: '900'
  },
  successText: {
    color: '#4E725C',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 2
  },
  successClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D6F0DE'
  },
  successCloseText: {
    color: '#1E7A45',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 22
  },
  card: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#DBE8F4'
  },
  productDetailsBox: {
    marginBottom: 10,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DBE8F4',
    padding: 14
  },
  productDetailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  productDetailsTitle: {
    color: '#12314D',
    fontSize: 15,
    fontWeight: '900'
  },
  productPrice: {
    color: '#0F6CBD',
    fontSize: 18,
    fontWeight: '900'
  },
  productStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12
  },
  productStat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    backgroundColor: '#F5F9FD',
    borderWidth: 1,
    borderColor: '#E2EEF8',
    paddingHorizontal: 10,
    paddingVertical: 10
  },
  productStatLabel: {
    color: '#7B93AA',
    fontSize: 11,
    fontWeight: '800'
  },
  productStatValue: {
    color: '#12314D',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 2
  },
  orderCard: {
    marginTop: 0
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18
  },
  stepperButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EAF3FB',
    alignItems: 'center',
    justifyContent: 'center'
  },
  stepperText: {
    color: '#0F6CBD',
    fontSize: 24,
    fontWeight: '900'
  },
  quantityValueWrap: {
    alignItems: 'center'
  },
  quantityValue: {
    color: '#12314D',
    fontSize: 30,
    fontWeight: '900'
  },
  quantityHint: {
    color: '#7791A8',
    fontSize: 12,
    marginTop: 2
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 22,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E7F0F8'
  },
  totalLabel: {
    color: '#6D869E',
    fontSize: 14,
    fontWeight: '700'
  },
  totalValue: {
    color: '#12314D',
    fontSize: 22,
    fontWeight: '900'
  },
  orderButton: {
    marginTop: 18,
    backgroundColor: '#0F6CBD',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16
  },
  successButton: {
    backgroundColor: '#1E7A45'
  },
  orderButtonText: {
    color: '#eeeeee',
    fontSize: 16,
    fontWeight: '900'
  },
  disabledButton: {
    opacity: 0.6
  },
  trackBar: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: 14,
    overflow: 'hidden'
  },
  trackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 2
  },
  trackLabelText: {
    color: '#12314D',
    fontSize: 14,
    fontWeight: '900'
  },
  paymentStatusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  paymentStatusPaid: {
    backgroundColor: '#E8F7EE'
  },
  paymentStatusPending: {
    backgroundColor: '#FFF4D6'
  },
  paymentStatusText: {
    fontSize: 11,
    fontWeight: '900'
  },
  paymentStatusTextPaid: {
    color: '#1E7A45'
  },
  paymentStatusTextPending: {
    color: '#A15A00'
  },
  noOrderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#DBE8F4'
  },
  noOrderText: {
    color: '#7B93AA',
    fontSize: 13,
    fontWeight: '700'
  },
  trackStep: {
    alignItems: 'center',
    gap: 5
  },
  trackDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#D6E8F7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#C0D8EE'
  },
  trackDotDone: {
    backgroundColor: '#0F6CBD',
    borderColor: '#0F6CBD'
  },
  trackDotActive: {
    backgroundColor: '#0F6CBD',
    borderColor: '#0F6CBD',
    boxShadow: '0px 0px 6px rgba(15,108,189,0.4)'
  },
  trackLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#D6E8F7',
    marginBottom: 16
  },
  trackLineDone: {
    backgroundColor: '#0F6CBD'
  },
  trackLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#A0B8CC',
    textAlign: 'center'
  },
  trackLabelDone: {
    color: '#0F6CBD'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(18, 49, 77, 0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#DBE8F4'
  },
  modalTitle: {
    color: '#12314D',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 26
  },
  modalSubtitle: {
    color: '#6D869E',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 6
  },
  paymentList: {
    gap: 10,
    marginTop: 16
  },
  upiBox: {
    marginTop: 14,
    backgroundColor: '#F5F9FD',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DBE8F4',
    padding: 14
  },
  upiLabel: {
    color: '#12314D',
    fontSize: 14,
    fontWeight: '800'
  },
  upiInput: {
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C9DFF2',
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: '#12314D',
    fontSize: 14
  },
  upiHelp: {
    color: '#56708A',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 8
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18
  },
  modalSecondaryButton: {
    flex: 1,
    backgroundColor: '#eaf3fb00',
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 13
  },
  modalSecondaryButtonText: {
    color: '#0F6CBD',
    fontSize: 14,
    fontWeight: '800'
  },
  modalPrimaryButton: {
    flex: 1,
    backgroundColor: '#0F6CBD',
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 13
  },
  modalPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800'
  }
});

export default CustomerHomeScreen;
