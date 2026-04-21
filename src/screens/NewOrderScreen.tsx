import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
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
  fetchInventorySummary,
  getOrderById,
  PaymentStatus,
  updateOrder
} from '../services/firebaseService';
import waterCanImage from '../assets/20-l-water-can.png';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'NewOrder'>;

const subscriptionStorageKey = 'customerSubscription';
const walletBalance = 80;
const checkoutSteps = ['Address', 'Schedule', 'Payment'];

const slotWindows: Record<DeliverySlot, string> = {
  Morning: '7:00 AM - 10:00 AM',
  Afternoon: '12:00 PM - 3:00 PM',
  Evening: '5:00 PM - 8:00 PM',
  'Express delivery': 'Within 30-45 minutes'
};

const NewOrderScreen = () => {
  const { profile } = useContext(AuthContext);
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const params = (route.params ?? {}) as RootStackParamList['NewOrder'];
  const editingOrderId = params?.orderId;

  const [quantity, setQuantity] = useState(2);
  const [note, setNote] = useState('');
  const [deliverySlot, setDeliverySlot] = useState<DeliverySlot>('Morning');
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_OPTIONS)[number]['id']>('Cash on Delivery');
  const [showSummary, setShowSummary] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [upiId, setUpiId] = useState('thannican@upi');
  const [availableStock, setAvailableStock] = useState(WATER_PRODUCT.availableStock);

  useEffect(() => {
    fetchInventorySummary().then((inv) => {
      const stock = Math.max(0, (inv.openingStock ?? 0) + (inv.restockedCans ?? 0) - (inv.soldCans ?? 0));
      setAvailableStock(stock);
    }).catch(() => {});
  }, []);

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
            setPaymentMethod(
              lastOrder.paymentMethod === 'Wallet balance'
                ? 'Wallet balance'
                : lastOrder.paymentMethod === 'UPI / GPay / PhonePe'
                  ? 'UPI / GPay / PhonePe'
                  : 'Cash on Delivery'
            );
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
      setPaymentMethod(
        order.paymentMethod === 'Wallet balance'
          ? 'Wallet balance'
          : order.paymentMethod === 'UPI / GPay / PhonePe'
            ? 'UPI / GPay / PhonePe'
            : 'Cash on Delivery'
      );
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
  const paymentStatus: PaymentStatus =
    paymentMethod === 'Cash on Delivery'
      ? 'unpaid'
      : paymentMethod === 'Wallet balance'
        ? walletBalance >= totalAmount
          ? 'paid'
          : 'pending'
        : 'paid';

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
    if (!profile.address?.trim()) {
      return 'Please add your delivery address in Profile first.';
    }
    if (quantity <= 0) {
      return 'Please select at least 1 can.';
    }
    if (paymentMethod === 'Wallet balance' && walletBalance < totalAmount) {
      return 'Wallet balance is low. Choose Cash on Delivery or UPI.';
    }
    return '';
  }, [paymentMethod, profile, quantity, totalAmount]);

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
        qty: quantity,
        frequency: 'Weekly',
        time: deliverySlot,
        note
      })
    );
    Alert.alert('Weekly Water Plan added', 'Your subscription preference has been saved.');
  };

  const handlePlaceOrUpdateOrder = async () => {
    const error = validateOrder();
    setErrorMessage(error);
    if (error || !profile) {
      return;
    }

    setLoading(true);
    try {
      const payload = {
        customerId: profile.uid,
        customerName: profile.name,
        phone: profile.phone,
        address: profile.address?.trim(),
        productName: WATER_PRODUCT.name,
        quantity,
        pricePerCan: WATER_PRODUCT.pricePerCan,
        deliveryCharge,
        totalAmount,
        availableStock: availableStock,
        note,
        paymentMethod,
        paymentStatus,
        paidAmount: paymentStatus === 'paid' ? totalAmount : 0,
        deliverySlot,
        expectedDeliveryTime: etaLabel,
        subscription: false
      };

      if (editingOrderId) {
        await updateOrder(editingOrderId, payload);
        setShowPayment(false);
        setShowSummary(false);
        Alert.alert('Order updated', 'Your order quantity and delivery slot were updated.');
        navigation.navigate('CustomerOrders');
        return;
      }

      const result = await createOrder(payload);
      setShowPayment(false);
      setShowSummary(false);
      navigation.replace('OrderConfirmed', { orderId: result.id! });
    } catch (error: any) {
      setErrorMessage(error.message || 'Unable to complete the order right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {navigation.canGoBack() ? (
            <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
              <Text style={styles.backButtonText}>{'< Back'}</Text>
            </Pressable>
          ) : null}
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>Quick water delivery</Text>
          </View>
          <Text style={styles.title}>{isEditing ? 'Modify your order' : 'Book water cans in one minute'}</Text>
          <Text style={styles.subtitle}>
            Simple ordering for home delivery. Large buttons, clear prices, and easy delivery tracking.
          </Text>

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{formatCurrency(WATER_PRODUCT.pricePerCan)}</Text>
              <Text style={styles.heroStatLabel}>Per can</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{quantity} cans</Text>
              <Text style={styles.heroStatLabel}>In this order</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{etaLabel}</Text>
              <Text style={styles.heroStatLabel}>Delivery window</Text>
            </View>
          </View>

          <View style={styles.stepRow}>
            {checkoutSteps.map((step, index) => (
              <View key={step} style={styles.stepItem}>
                <View style={styles.stepIndex}>
                  <Text style={styles.stepIndexText}>{index + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>
        </View>

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

        <View style={styles.spacer} />

        <QuantitySelector
          quantity={quantity}
          onDecrease={() => setQuantity((current) => Math.max(1, current - 1))}
          onIncrease={() => setQuantity((current) => current + 1)}
          totalAmount={totalAmount}
          pricePerCan={WATER_PRODUCT.pricePerCan}
          disabledDecrease={quantity <= 1}
          disabledIncrease={quantity >= availableStock}
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
          {paymentMethod === 'UPI / GPay / PhonePe' ? (
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
          {paymentMethod === 'Wallet balance' ? (
            <View style={styles.walletCard}>
              <Text style={styles.walletTitle}>Wallet balance</Text>
              <Text style={styles.walletText}>
                Available balance: {formatCurrency(walletBalance)}.{' '}
                {walletBalance >= totalAmount
                  ? 'Enough balance for this order.'
                  : 'Please add money or choose another payment method.'}
              </Text>
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

        <Pressable style={styles.primaryButton} onPress={openSummary} disabled={loading}>
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
              onPress={() => {
                setShowSummary(false);
                setShowPayment(true);
              }}
            >
              <Text style={styles.primaryButtonText}>Confirm Order</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => setShowSummary(false)}>
              <Text style={styles.secondaryButtonText}>Edit Order</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={showPayment} animationType="fade" onRequestClose={() => setShowPayment(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.ticketCap} />
            <Text style={styles.modalTitle}>Complete Payment</Text>
            <Text style={styles.paymentSummaryText}>
              Pay using {paymentMethod}. Total payable amount: {formatCurrency(totalAmount)}.
            </Text>
            {paymentMethod === 'UPI / GPay / PhonePe' ? (
              <View style={styles.paymentBlock}>
                <Text style={styles.paymentBlockTitle}>UPI apps supported</Text>
                <Text style={styles.paymentBlockText}>GPay, PhonePe, Paytm or any UPI app can complete this payment.</Text>
              </View>
            ) : null}
            {paymentMethod === 'Cash on Delivery' ? (
              <View style={styles.paymentBlock}>
                <Text style={styles.paymentBlockTitle}>Cash on delivery</Text>
                <Text style={styles.paymentBlockText}>Please keep the amount ready if possible for a faster handoff.</Text>
              </View>
            ) : null}
            {paymentMethod === 'Wallet balance' ? (
              <View style={styles.paymentBlock}>
                <Text style={styles.paymentBlockTitle}>Wallet checkout</Text>
                <Text style={styles.paymentBlockText}>The order amount will be adjusted from your wallet balance.</Text>
              </View>
            ) : null}
            <Pressable style={styles.primaryButton} onPress={handlePlaceOrUpdateOrder} disabled={loading}>
              <Text style={styles.primaryButtonText}>{loading ? 'Please wait...' : isEditing ? 'Save Order Changes' : 'Place Order'}</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => setShowPayment(false)}>
              <Text style={styles.secondaryButtonText}>Back</Text>
            </Pressable>
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
  hero: {
    backgroundColor: '#E3F4EA',
    borderRadius: 30,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#CFE7D8'
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#CFE2D6'
  },
  backButtonText: {
    color: '#216A45',
    fontSize: 14,
    fontWeight: '800'
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  heroBadgeText: {
    color: '#216A45',
    fontSize: 12,
    fontWeight: '800'
  },
  title: {
    marginTop: 12,
    color: '#173726',
    fontSize: 28,
    fontWeight: '900'
  },
  subtitle: {
    marginTop: 8,
    color: '#4E6E5D',
    fontSize: 14,
    lineHeight: 22
  },
  heroStatsRow: {
    marginTop: 18,
    gap: 10
  },
  heroStat: {
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.84)',
    padding: 14
  },
  heroStatValue: {
    color: '#173726',
    fontSize: 16,
    fontWeight: '900'
  },
  heroStatLabel: {
    marginTop: 4,
    color: '#5A7968',
    fontSize: 12,
    fontWeight: '700'
  },
  stepRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 8
  },
  stepIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#216A45',
    alignItems: 'center',
    justifyContent: 'center'
  },
  stepIndexText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900'
  },
  stepText: {
    marginTop: 8,
    color: '#1E3B2A',
    fontSize: 12,
    fontWeight: '800'
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
