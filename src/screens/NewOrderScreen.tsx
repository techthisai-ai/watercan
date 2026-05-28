import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { AuthContext } from '../../App';
import PaymentOptionCard from '../components/PaymentOptionCard';
import ProductCard from '../components/ProductCard';
import QuantitySelector from '../components/QuantitySelector';
import {
  DELIVERY_SLOTS,
  formatCurrency,
  PAYMENT_OPTIONS,
  WATER_PRODUCT
} from '../data/orderModule';
import { RootStackParamList } from '../navigation/AppNavigator';
import {
  createOrder,
  DeliverySlot,
  fetchCustomerOrders,
  fetchCustomerAvailableStock,
  getFriendlyOrderMessage,
  getOrderById,
  PaymentStatus,
  updateOrder
} from '../services/firebaseService';
import waterCanImage from '../assets/20-l-water-can.png';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'NewOrder'>;

const subscriptionStorageKey = 'customerSubscription';
const defaultUpiId = 'thannican@upi';

const normalizePaymentMethod = (method?: string): (typeof PAYMENT_OPTIONS)[number]['id'] => {
  if (method === 'Google Pay') {
    return 'Google Pay';
  }
  if (method === 'UPI ID' || method === 'UPI / GPay / PhonePe' || method === 'Wallet balance') {
    return 'UPI ID';
  }
  return 'Cash on Delivery';
};

const slotWindows: Record<DeliverySlot, string> = {
  Morning: '7:00 AM - 10:00 AM',
  Afternoon: '12:00 PM - 3:00 PM',
  Evening: '5:00 PM - 8:00 PM',
  'Express delivery': 'Within 30-45 minutes'
};

const NewOrderScreen = () => {
  const { profile, refreshProfile } = useContext(AuthContext);
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const params = (route.params ?? {}) as RootStackParamList['NewOrder'];
  const editingOrderId = params?.orderId;

  const [quantity, setQuantity] = useState(2);
  const [note, setNote] = useState('');
  const [deliverySlot, setDeliverySlot] = useState<DeliverySlot>('Morning');
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_OPTIONS)[number]['id']>('Cash on Delivery');
  const [showSummary, setShowSummary] = useState(false);
  const [showOrderAgain, setShowOrderAgain] = useState(false);
  const [loading, setLoading] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [upiId, setUpiId] = useState(defaultUpiId);
  const [availableStock, setAvailableStock] = useState(WATER_PRODUCT.availableStock);
  const [selectedPack, setSelectedPack] = useState<{ label: string; qty: number } | null>(null);

  const BULK_PACKS = [
    { label: '10 Cans Pack', qty: 10 },
    { label: '15 Cans Pack', qty: 15 },
  ];

  const handlePackSelect = (pack: { label: string; qty: number }) => {
    setSelectedPack(pack);
    setQuantity(pack.qty);
  };

  const loadInventory = useCallback(async () => {
    try {
      const stock = await fetchCustomerAvailableStock(editingOrderId);
      setAvailableStock((current) => (current === stock ? current : stock));
      return stock;
    } catch {
      return WATER_PRODUCT.availableStock;
    }
  }, [editingOrderId]);

  useFocusEffect(
    useCallback(() => {
      refreshProfile().catch(() => {});
      loadInventory();
    }, [loadInventory, refreshProfile])
  );

  useEffect(() => {
    if (!editingOrderId) {
      setIsEditing(false);
    }
  }, [editingOrderId]);

  useEffect(() => {
    let active = true;

    const loadPrefill = async () => {
      if (!editingOrderId) {
        if (params?.reorder && profile?.uid) {
          const orders = await fetchCustomerOrders(profile.uid).catch(() => []);
          const lastOrder = orders[0];
          if (lastOrder && active) {
            setQuantity(lastOrder.quantity);
            setNote(lastOrder.note ?? '');
            setDeliverySlot(lastOrder.deliverySlot);
            setPaymentMethod(normalizePaymentMethod(lastOrder.paymentMethod));
          }
        }
        return;
      }

      const order = await getOrderById(editingOrderId);
      if (!active || !order) {
        return;
      }

      setIsEditing(true);
      setQuantity(order.quantity);
      setNote(order.note ?? '');
      setDeliverySlot(order.deliverySlot);
      setPaymentMethod(normalizePaymentMethod(order.paymentMethod));
    };

    loadPrefill();
    return () => {
      active = false;
    };
  }, [editingOrderId, params?.reorder, profile?.uid]);

  const deliveryCharge = deliverySlot === 'Express delivery' ? 15 : 0;
  const totalAmount = quantity * WATER_PRODUCT.pricePerCan + deliveryCharge;
  const addressReady = Boolean(profile?.address?.trim());
  const etaLabel = slotWindows[deliverySlot];
  const selectedPayment = PAYMENT_OPTIONS.find((option) => option.id === paymentMethod);
  const getPaymentStatus = (method: (typeof PAYMENT_OPTIONS)[number]['id']): PaymentStatus =>
    method === 'Cash on Delivery' ? 'unpaid' : 'paid';
  const paymentStatus = getPaymentStatus(paymentMethod);

  const summaryRows = useMemo(
    () => [
      { label: 'Customer name', value: profile?.name || 'Customer' },
      { label: 'Phone number', value: profile?.phone || 'Not available' },
      { label: 'Address', value: profile?.address?.trim() || 'Add address in profile' },
      { label: 'Number of cans', value: `${quantity}` },
      { label: 'Price per can', value: formatCurrency(WATER_PRODUCT.pricePerCan) },
      { label: 'Delivery charge', value: deliveryCharge ? formatCurrency(deliveryCharge) : 'Free' },
      { label: 'Total amount', value: formatCurrency(totalAmount) },
      { label: 'Payment method', value: paymentMethod },
      { label: 'Delivery slot', value: `${deliverySlot} (${etaLabel})` }
    ],
    [deliveryCharge, deliverySlot, etaLabel, paymentMethod, profile?.address, profile?.name, profile?.phone, quantity, totalAmount]
  );

  const validateOrder = useCallback(() => {
    if (!profile) {
      return 'Please sign in again.';
    }
    if (profile.role !== 'customer') {
      return 'Only customer accounts can place new orders.';
    }
    if (!profile.address?.trim()) {
      return 'Please add your delivery address in Profile first.';
    }
    if (quantity <= 0) {
      return 'Please select at least 1 can.';
    }
    if (paymentMethod === 'UPI ID' && !upiId.trim()) {
      return 'Please enter a valid UPI ID.';
    }
    return '';
  }, [paymentMethod, profile, quantity, upiId]);

  const openSummary = () => {
    const error = validateOrder();
    setErrorMessage(error);
    if (error) {
      return;
    }
    setShowSummary(true);
  };

  const handleSaveSubscription = async () => {
    const error = validateOrder();
    setErrorMessage(error);
    if (error) {
      return;
    }

    await AsyncStorage.setItem(
      subscriptionStorageKey,
      JSON.stringify({
        qty: 50,
        frequency: 'Weekly',
        time: deliverySlot === 'Express delivery' ? 'Morning' : deliverySlot,
        note
      })
    );
    Alert.alert('Weekly Water Plan added', 'Your subscription preference has been saved.');
  };

  const handlePlaceOrUpdateOrder = async (selectedMethod: (typeof PAYMENT_OPTIONS)[number]['id'] = paymentMethod) => {
    const error = validateOrder();
    setErrorMessage(error);
    if (error || !profile) {
      return;
    }

    setLoading(true);
    try {
      const latestStock = await loadInventory();
      const payload = {
        customerId: profile.uid,
        customerName: profile.name,
        phone: profile.phone,
        address: profile.address?.trim(),
        productName: WATER_PRODUCT.name,
        orderType: selectedPack ? 'bulk' as const : 'single' as const,
        packName: selectedPack ? selectedPack.label : '',
        quantity,
        pricePerCan: WATER_PRODUCT.pricePerCan,
        deliveryCharge,
        totalAmount,
        availableStock: latestStock,
        note,
        paymentMethod: selectedMethod === 'UPI ID' ? `UPI ID (${upiId.trim()})` : selectedMethod,
        paymentStatus: getPaymentStatus(selectedMethod),
        paidAmount: getPaymentStatus(selectedMethod) === 'paid' ? totalAmount : 0,
        deliverySlot,
        expectedDeliveryTime: etaLabel,
        subscription: false
      };

      if (editingOrderId) {
        await updateOrder(editingOrderId, payload);
        setShowOrderAgain(false);
        setShowSummary(false);
        Alert.alert('Order updated', 'Your order quantity and delivery slot were updated.');
        navigation.navigate('CustomerOrders');
        return;
      }

      const result = await createOrder(payload);
      setShowOrderAgain(false);
      setShowSummary(false);
      setOrderPlaced(true);
      setTimeout(() => {
        setOrderPlaced(false);
        navigation.replace('OrderConfirmed', { orderId: result.id! });
      }, 1500);
    } catch (error: any) {
      setErrorMessage(getFriendlyOrderMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleSummaryPrimaryAction = () => {
    setShowSummary(false);
    if (params?.reorder && !isEditing) {
      setShowOrderAgain(true);
      return;
    }
    handlePlaceOrUpdateOrder(paymentMethod);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.addressCard}>
          <View style={styles.addressHeader}>
            <View style={styles.addressCopy}>
              <Text style={styles.sectionEyebrow}>Saved address</Text>
              <Text style={styles.addressText}>{profile?.address?.trim() || 'Please add your delivery address in Profile.'}</Text>
              <Text style={styles.addressSubtext}>{profile?.name || 'Customer'} | {profile?.phone || 'No phone number'}</Text>
            </View>
            <View style={[styles.addressStatePill, addressReady ? styles.addressStateReady : styles.addressStateMissing]}>
              <Text style={[styles.addressStateText, addressReady ? styles.addressStateTextReady : styles.addressStateTextMissing]}>
                {addressReady ? 'Ready' : 'Missing'}
              </Text>
            </View>
          </View>
          {!addressReady ? (
            <Pressable style={styles.addressAction} onPress={() => navigation.navigate('Profile')}>
              <Text style={styles.addressActionText}>Add address in profile</Text>
            </Pressable>
          ) : null}
        </View>

        <ProductCard
          image={waterCanImage}
          name={WATER_PRODUCT.name}
          subtitle={WATER_PRODUCT.subtitle}
          pricePerCan={WATER_PRODUCT.pricePerCan}
          availableStock={availableStock}
          lowStock={availableStock <= WATER_PRODUCT.lowStockThreshold}
        />

        {/* Bulk Pack Selection */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Bulk Packet Order</Text>
          <Text style={styles.sectionHint}>Select a pack to order in bulk</Text>
          <View style={styles.packRow}>
            {BULK_PACKS.map((pack) => {
              const selected = selectedPack?.qty === pack.qty;
              const outOfStock = pack.qty > availableStock;
              return (
                <Pressable
                  key={pack.label}
                  style={[
                    styles.packChip,
                    selected && styles.packChipSelected,
                    outOfStock && styles.packChipOutOfStock
                  ]}
                  onPress={() => handlePackSelect(pack)}
                >
                  <Text style={[styles.packChipLabel, selected && styles.packChipLabelSelected]}>
                    {pack.label}
                  </Text>
                  <Text style={[styles.packChipQty, selected && styles.packChipQtySelected]}>
                    {pack.qty} cans · {formatCurrency(pack.qty * WATER_PRODUCT.pricePerCan)}
                  </Text>
                  {outOfStock ? <Text style={styles.packOutOfStockText}>Low stock</Text> : null}
                </Pressable>
              );
            })}
          </View>
          {selectedPack ? (
            <Pressable
              style={styles.clearPackBtn}
              onPress={() => { setSelectedPack(null); setQuantity(2); }}
            >
              <Text style={styles.clearPackBtnText}>✕ Clear pack selection</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.spacer} />

        <QuantitySelector
          quantity={quantity}
          onDecrease={() => setQuantity((current) => Math.max(1, current - 1))}
          onIncrease={() => setQuantity((current) => current + 1)}
          totalAmount={totalAmount}
          pricePerCan={WATER_PRODUCT.pricePerCan}
          disabledDecrease={quantity <= 1}
          disabledIncrease={false}
        />

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Customer note</Text>
          <Text style={styles.sectionHint}>Examples: Leave near door, Call before delivery</Text>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="Add delivery instructions"
            placeholderTextColor="#8AA5B7"
            multiline
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Preferred delivery time</Text>
          <View style={styles.slotGrid}>
            {DELIVERY_SLOTS.map((slot) => {
              const selected = slot === deliverySlot;
              return (
                <Pressable
                  key={slot}
                  style={[styles.slotChip, selected && styles.slotChipSelected]}
                  onPress={() => setDeliverySlot(slot)}
                >
                  <Text style={[styles.slotLabel, selected && styles.slotLabelSelected]}>{slot}</Text>
                  <Text style={[styles.slotSubLabel, selected && styles.slotSubLabelSelected]}>{slotWindows[slot]}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payment selection</Text>
          <View style={styles.paymentList}>
            {PAYMENT_OPTIONS.map((option) => (
              <PaymentOptionCard
                key={option.id}
                title={option.title}
                subtitle={option.subtitle}
                selected={paymentMethod === option.id}
                onPress={() => setPaymentMethod(option.id)}
              />
            ))}
          </View>
          {paymentMethod === 'UPI ID' ? (
            <View style={styles.upiCard}>
              <Text style={styles.upiTitle}>UPI payment</Text>
              <Text style={styles.upiText}>Pay to UPI ID: {upiId}</Text>
              <TextInput
                style={styles.upiInput}
                value={upiId}
                onChangeText={setUpiId}
                placeholder="thannican@upi"
                placeholderTextColor="#8AA5B7"
              />
            </View>
          ) : null}
          {paymentMethod === 'Google Pay' ? (
            <View style={styles.walletCard}>
              <Text style={styles.walletTitle}>Google Pay</Text>
              <Text style={styles.walletText}>Use Google Pay to send {formatCurrency(totalAmount)} to {defaultUpiId}.</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.smartCard}>
          <Text style={styles.smartTitle}>Smart reminder</Text>
          <Text style={styles.smartText}>You usually order every 3 days. Need water today?</Text>
          <Text style={styles.smartSubText}>One tap booking and Weekly Water Plan are ready for frequent users.</Text>
        </View>

        <View style={styles.checkoutCard}>
          <View style={styles.checkoutHeader}>
            <View>
              <Text style={styles.checkoutEyebrow}>Final checkout</Text>
              <Text style={styles.checkoutTitle}>A cleaner booking summary before payment</Text>
            </View>
            <View style={styles.checkoutTotalBadge}>
              <Text style={styles.checkoutTotalBadgeText}>{formatCurrency(totalAmount)}</Text>
            </View>
          </View>
          <View style={styles.checkoutRow}>
            <Text style={styles.checkoutLabel}>Water cans</Text>
            <Text style={styles.checkoutValue}>{quantity} x {formatCurrency(WATER_PRODUCT.pricePerCan)}</Text>
          </View>
          <View style={styles.checkoutRow}>
            <Text style={styles.checkoutLabel}>Delivery slot</Text>
            <Text style={styles.checkoutValue}>{deliverySlot}</Text>
          </View>
          <View style={styles.checkoutRow}>
            <Text style={styles.checkoutLabel}>Payment</Text>
            <Text style={styles.checkoutValue}>{selectedPayment?.title || paymentMethod}</Text>
          </View>
          <View style={styles.checkoutRow}>
            <Text style={styles.checkoutLabel}>Delivery charge</Text>
            <Text style={styles.checkoutValue}>{deliveryCharge ? formatCurrency(deliveryCharge) : 'Free'}</Text>
          </View>
          <View style={styles.checkoutDivider} />
          <View style={styles.checkoutFooterRow}>
            <View>
              <Text style={styles.checkoutFooterLabel}>Expected arrival</Text>
              <Text style={styles.checkoutFooterValue}>{etaLabel}</Text>
            </View>
            <View>
              <Text style={styles.checkoutFooterLabel}>Payable</Text>
              <Text style={styles.checkoutFooterValue}>{formatCurrency(totalAmount)}</Text>
            </View>
          </View>
        </View>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        {orderPlaced ? (
          <View style={styles.successBanner}>
            <Text style={styles.successBannerText}>✓ Order placed successfully!</Text>
          </View>
        ) : null}

        <Pressable style={styles.primaryButton} onPress={openSummary} disabled={loading || orderPlaced}>
          <Text style={styles.primaryButtonText}>{isEditing ? 'Review Changes' : 'Order Now'}</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={handleSaveSubscription}>
          <Text style={styles.secondaryButtonText}>Add to Subscription</Text>
        </Pressable>
      </ScrollView>

      <Modal transparent visible={showSummary} animationType="slide" onRequestClose={() => setShowSummary(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.ticketCap} />
            <Text style={styles.modalTitle}>Order Summary</Text>
            <Text style={styles.modalSubtitle}>One last review before the booking is locked in.</Text>
            {summaryRows.map((row) => (
              <View key={row.label} style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{row.label}</Text>
                <Text style={styles.summaryValue}>{row.value}</Text>
              </View>
            ))}
            {!!note ? (
              <View style={styles.noteSummary}>
                <Text style={styles.summaryLabel}>Instruction</Text>
                <Text style={styles.summaryValue}>{note}</Text>
              </View>
            ) : null}
            <Pressable
              style={styles.primaryButton}
              onPress={handleSummaryPrimaryAction}
            >
              <Text style={styles.primaryButtonText}>{isEditing ? 'Save Order Changes' : 'Place Order'}</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => setShowSummary(false)}>
              <Text style={styles.secondaryButtonText}>Edit Order</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={showOrderAgain} animationType="fade" onRequestClose={() => setShowOrderAgain(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.ticketCap} />
            <Text style={styles.modalTitle}>Order Again</Text>
            <Text style={styles.paymentSummaryText}>
              Place this order again with {quantity} can{quantity > 1 ? 's' : ''} using {paymentMethod} for {formatCurrency(totalAmount)}?
            </Text>
            <View style={styles.modalActionsInline}>
              <Pressable style={styles.secondaryButton} onPress={() => setShowOrderAgain(false)}>
                <Text style={styles.secondaryButtonText}>Back</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={() => handlePlaceOrUpdateOrder(paymentMethod)} disabled={loading}>
                <Text style={styles.primaryButtonText}>{loading ? 'Please wait...' : 'Order Again'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EEF7F2'
  },
  content: {
    padding: 18,
    paddingBottom: 40
  },
  addressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#D6E6DC'
  },
  addressHeader: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between'
  },
  addressCopy: {
    flex: 1
  },
  sectionEyebrow: {
    color: '#2C7A4A',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  addressText: {
    marginTop: 10,
    color: '#173726',
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 24
  },
  addressSubtext: {
    marginTop: 8,
    color: '#72897C',
    fontSize: 13
  },
  addressStatePill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  addressStateReady: {
    backgroundColor: '#E7F7EA'
  },
  addressStateMissing: {
    backgroundColor: '#FFF1DA'
  },
  addressStateText: {
    fontSize: 12,
    fontWeight: '800'
  },
  addressStateTextReady: {
    color: '#1E7A45'
  },
  addressStateTextMissing: {
    color: '#A06D06'
  },
  addressAction: {
    marginTop: 14,
    alignSelf: 'flex-start',
    borderRadius: 16,
    backgroundColor: '#173726',
    paddingHorizontal: 14,
    paddingVertical: 11
  },
  addressActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800'
  },
  spacer: {
    height: 16
  },
  card: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18
  },
  sectionTitle: {
    color: '#173726',
    fontSize: 18,
    fontWeight: '800'
  },
  sectionHint: {
    marginTop: 6,
    color: '#6E899D',
    fontSize: 12
  },
  noteInput: {
    marginTop: 14,
    minHeight: 100,
    borderRadius: 18,
    backgroundColor: '#F7FBF8',
    borderWidth: 1,
    borderColor: '#DCE8E0',
    padding: 14,
    color: '#173726',
    fontSize: 15,
    textAlignVertical: 'top'
  },
  slotGrid: {
    marginTop: 14,
    gap: 10
  },
  slotChip: {
    borderRadius: 20,
    backgroundColor: '#F7FBF8',
    borderWidth: 1,
    borderColor: '#DCE8E0',
    padding: 14
  },
  slotChipSelected: {
    backgroundColor: '#E7F7EA',
    borderColor: '#2C7A4A'
  },
  slotLabel: {
    color: '#173726',
    fontSize: 16,
    fontWeight: '800'
  },
  slotLabelSelected: {
    color: '#216A45'
  },
  slotSubLabel: {
    marginTop: 4,
    color: '#70879A',
    fontSize: 12
  },
  slotSubLabelSelected: {
    color: '#216A45'
  },
  paymentList: {
    marginTop: 14,
    gap: 10
  },
  upiCard: {
    marginTop: 14,
    borderRadius: 20,
    backgroundColor: '#F7FBF8',
    padding: 14
  },
  upiTitle: {
    color: '#173726',
    fontSize: 15,
    fontWeight: '800'
  },
  upiText: {
    marginTop: 6,
    color: '#4C6D84',
    fontSize: 13
  },
  upiInput: {
    marginTop: 10,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE8E0',
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#173726',
    fontSize: 14
  },
  walletCard: {
    marginTop: 14,
    borderRadius: 20,
    backgroundColor: '#FFF4D6',
    padding: 14
  },
  walletTitle: {
    color: '#9A6400',
    fontSize: 15,
    fontWeight: '800'
  },
  walletText: {
    marginTop: 6,
    color: '#9A6400',
    fontSize: 13,
    lineHeight: 19
  },
  smartCard: {
    marginTop: 16,
    backgroundColor: '#173726',
    borderRadius: 24,
    padding: 18
  },
  smartTitle: {
    color: '#B6F0C7',
    fontSize: 16,
    fontWeight: '800'
  },
  smartText: {
    marginTop: 8,
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 26
  },
  smartSubText: {
    marginTop: 8,
    color: '#D9F1E1',
    fontSize: 13,
    lineHeight: 20
  },
  checkoutCard: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: '#D6E6DC'
  },
  checkoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12
  },
  checkoutEyebrow: {
    color: '#2C7A4A',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  checkoutTitle: {
    marginTop: 6,
    color: '#173726',
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 28
  },
  checkoutTotalBadge: {
    alignSelf: 'flex-start',
    borderRadius: 18,
    backgroundColor: '#173726',
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  checkoutTotalBadgeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900'
  },
  checkoutRow: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16
  },
  checkoutLabel: {
    color: '#6B8174',
    fontSize: 13,
    fontWeight: '700'
  },
  checkoutValue: {
    color: '#173726',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
    flex: 1
  },
  checkoutDivider: {
    height: 1,
    backgroundColor: '#E7EFEA',
    marginTop: 16
  },
  checkoutFooterRow: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16
  },
  checkoutFooterLabel: {
    color: '#6B8174',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  checkoutFooterValue: {
    marginTop: 5,
    color: '#173726',
    fontSize: 16,
    fontWeight: '900'
  },
  errorText: {
    marginTop: 16,
    color: '#B42318',
    fontSize: 13,
    fontWeight: '700'
  },
  successBanner: {
    marginTop: 16,
    backgroundColor: '#E7F7EA',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E7A45'
  },
  successBannerText: {
    color: '#1E7A45',
    fontSize: 15,
    fontWeight: '900'
  },
  packRow: {
    marginTop: 14,
    gap: 10
  },
  packChip: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#F7FBF8',
    borderWidth: 1.5,
    borderColor: '#DCE8E0'
  },
  packChipSelected: {
    backgroundColor: '#E7F7EA',
    borderColor: '#216A45'
  },
  packChipOutOfStock: {
    opacity: 0.6,
    borderColor: '#FCA5A5',
    backgroundColor: '#FFF5F5'
  },
  packChipLabel: {
    color: '#173726',
    fontSize: 16,
    fontWeight: '900'
  },
  packChipLabelSelected: {
    color: '#216A45'
  },
  packChipQty: {
    color: '#6B8174',
    fontSize: 13,
    marginTop: 4
  },
  packChipQtySelected: {
    color: '#216A45'
  },
  packOutOfStockText: {
    marginTop: 6,
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '800'
  },
  clearPackBtn: {
    marginTop: 12,
    alignSelf: 'flex-start'
  },
  clearPackBtnText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '700'
  },
  primaryButton: {
    marginTop: 16,
    backgroundColor: '#216A45',
    borderRadius: 20,
    paddingVertical: 17,
    alignItems: 'center'
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900'
  },
  secondaryButton: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D6E6DC'
  },
  secondaryButtonText: {
    color: '#216A45',
    fontSize: 16,
    fontWeight: '800'
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(16, 36, 24, 0.42)',
    justifyContent: 'center',
    padding: 18
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 20
  },
  ticketCap: {
    width: 68,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#D6E6DC',
    alignSelf: 'center',
    marginBottom: 14
  },
  modalTitle: {
    color: '#173726',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 8
  },
  modalSubtitle: {
    color: '#5A7968',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 6
  },
  summaryRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF6FB'
  },
  summaryLabel: {
    color: '#6D8699',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  summaryValue: {
    marginTop: 5,
    color: '#173726',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 21
  },
  noteSummary: {
    marginTop: 12,
    borderRadius: 18,
    backgroundColor: '#F7FBF8',
    padding: 14
  },
  paymentSummaryText: {
    marginTop: 2,
    color: '#547185',
    fontSize: 14,
    lineHeight: 21
  },
  modalActionsInline: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 12
  },
  paymentBlock: {
    marginTop: 14,
    borderRadius: 18,
    backgroundColor: '#F7FBF8',
    padding: 14
  },
  paymentBlockTitle: {
    color: '#173726',
    fontSize: 15,
    fontWeight: '800'
  },
  paymentBlockText: {
    marginTop: 6,
    color: '#547185',
    fontSize: 13,
    lineHeight: 19
  }
});

export default NewOrderScreen;
