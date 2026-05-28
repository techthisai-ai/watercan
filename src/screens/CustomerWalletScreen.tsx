import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AuthContext } from '../../App';
import CustomerBottomNav from '../components/CustomerBottomNav';
import ScreenHeader from '../components/ScreenHeader';
import { formatCurrency } from '../data/orderModule';
import { RootStackParamList } from '../navigation/AppNavigator';
import {
  InventoryVariant,
  createOrder,
  fetchInventoryVariants,
  getFriendlyOrderMessage
} from '../services/firebaseService';
import { createShadow } from '../styles/shadows';
import { theme } from '../styles/theme';
import can300ml from '../assets/fresh-pure-and-natural-healthy-hygienically-packed-bisleri-mineral-water-841.jpg';
import can500ml from '../assets/500-ml-round-transparent-plastic-pet-water-bottle-for-dinking-purpose-512.jpg';
import can1L from '../assets/1-liter-plastic-9-4-x-9-7-x-33-3-cm-diameter-drinking-water-bottle-694.jpg';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type PaymentMethod = 'Cash on Delivery' | 'GPay';

const ORDER_TYPE = 'bulk' as const;
const SIZE_IMAGE_MAP: Record<string, any> = {
  '300ml': can300ml,
  '500ml': can500ml,
  '1L': can1L
};
const getVariantImage = (sizeName?: string) => {
  const normalized = (sizeName ?? '').trim().toLowerCase().replace(/\s+/g, '');
  if (normalized.includes('300')) return SIZE_IMAGE_MAP['300ml'];
  if (normalized.includes('500')) return SIZE_IMAGE_MAP['500ml'];
  if (normalized.includes('1l') || normalized === '1') return SIZE_IMAGE_MAP['1L'];
  return SIZE_IMAGE_MAP['500ml'];
};

const CustomerWalletScreen = () => {
  const { profile } = useContext(AuthContext);
  const navigation = useNavigation<NavigationProp>();
  const [variants, setVariants] = useState<InventoryVariant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [packetQuantityInput, setPacketQuantityInput] = useState('1');
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  useEffect(() => {
    let active = true;
    const loadVariants = async () => {
      const data = await fetchInventoryVariants().catch(() => []);
      if (!active) return;
      const activeVariants = data.filter((variant) => variant.active);
      setVariants(activeVariants);
      setSelectedVariantId((current) => current || activeVariants[0]?.id || '');
    };
    loadVariants();
    return () => {
      active = false;
    };
  }, []);

  const selectedVariant = useMemo(
    () => variants.find((variant) => variant.id === selectedVariantId) ?? variants[0],
    [selectedVariantId, variants]
  );

  const cansPerPacket = selectedVariant?.cansPerPacket ?? 10;
  const pricePerCan = selectedVariant?.pricePerCan ?? 0;

  const refreshVariants = async () => {
    const data = await fetchInventoryVariants().catch(() => []);
    const activeVariants = data.filter((variant) => variant.active);
    setVariants(activeVariants);
    return activeVariants;
  };

  const packetQuantity = useMemo(() => {
    const parsed = Number.parseInt(packetQuantityInput, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return 1;
    }
    return parsed;
  }, [packetQuantityInput]);
  const totalCans = packetQuantity;
  const totalAmount = useMemo(
    () => packetQuantity * pricePerCan,
    [packetQuantity, pricePerCan]
  );

  const validateOrder = () => {
    if (!profile) {
      Alert.alert('Order failed', 'Please sign in again.');
      return false;
    }

    if (profile.role !== 'customer') {
      Alert.alert('Order failed', 'Only customer accounts can place orders.');
      return false;
    }

    if (!profile.address?.trim()) {
      Alert.alert('Address required', 'Please add your delivery address in Profile before placing an order.');
      navigation.navigate('Profile');
      return false;
    }
    if (!selectedVariant) {
      Alert.alert('Order failed', 'No packet variant is available right now.');
      return false;
    }

    return true;
  };

  const placeOrderWithPaymentMethod = async (paymentMethod: PaymentMethod) => {
    if (placingOrder || !validateOrder() || !profile) {
      return;
    }

    setShowPaymentModal(false);
    setPlacingOrder(true);
    try {
      const latestVariants = await refreshVariants();
      const latestSelected = latestVariants.find((variant) => variant.id === selectedVariant?.id);
      if (!latestSelected) {
        Alert.alert('Order failed', 'Selected packet is not available now.');
        return;
      }

      await createOrder({
        userId: profile.uid,
        customerId: profile.uid,
        customerName: profile.name,
        phone: profile.phone,
        address: profile.address?.trim() || '',
        productName: `${latestSelected.productName} (${latestSelected.sizeName})`,
        orderType: ORDER_TYPE,
        packName: `${latestSelected.cansPerPacket} cans packet`,
        variantId: latestSelected.id,
        variantSku: latestSelected.sku,
        variantSize: latestSelected.sizeName,
        cansPerPacket: latestSelected.cansPerPacket,
        quantity: totalCans,
        pricePerCan: latestSelected.pricePerCan,
        deliveryCharge: 0,
        totalAmount,
        note: '',
        paymentMethod,
        paymentStatus: paymentMethod === 'Cash on Delivery' ? 'unpaid' : 'pending',
        paidAmount: 0,
        deliverySlot: 'Morning',
        expectedDeliveryTime: 'Today',
        subscription: false
      });

      setOrderSuccess(true);
      setTimeout(() => setOrderSuccess(false), 2500);
      setPacketQuantityInput('1');
      await refreshVariants();
    } catch (error) {
      Alert.alert('Order failed', getFriendlyOrderMessage(error));
    } finally {
      setPlacingOrder(false);
    }
  };

  const handlePlaceOrder = () => {
    if (placingOrder || !validateOrder()) {
      return;
    }
    setShowPaymentModal(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Modal
        visible={showPaymentModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Choose payment method</Text>
            <Text style={styles.modalText}>Select how you want to pay for this order.</Text>
            <View style={styles.paymentChoiceStack}>
              <Pressable
                style={[styles.modalPrimaryBtn, placingOrder && styles.disabledButton]}
                onPress={() => placeOrderWithPaymentMethod('Cash on Delivery')}
                disabled={placingOrder}
              >
                <Text style={styles.modalPrimaryText}>Cash on Delivery</Text>
              </Pressable>
              <Pressable
                style={[styles.modalPrimaryBtn, placingOrder && styles.disabledButton]}
                onPress={() => placeOrderWithPaymentMethod('GPay')}
                disabled={placingOrder}
              >
                <Text style={styles.modalPrimaryText}>GPay</Text>
              </Pressable>
            </View>
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalSecondaryBtn}
                onPress={() => setShowPaymentModal(false)}
                disabled={placingOrder}
              >
                <Text style={styles.modalSecondaryText}>Back</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Select Water Can" profile notifications />
        {orderSuccess ? (
          <Text style={styles.orderSuccessText}>Order Successfully Placed</Text>
        ) : null}

        <View style={styles.sizePickerRow}>
          {variants.map((variant) => {
            const selected = variant.id === selectedVariant?.id;
            return (
              <Pressable
                key={variant.id}
                style={[styles.variantChip, selected && styles.variantChipSelected]}
                onPress={() => setSelectedVariantId(variant.id)}
              >
                <Text style={[styles.variantChipText, selected && styles.variantChipTextSelected]}>
                  {variant.sizeName}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Product</Text>
          <View style={styles.productCard}>
            <Text style={styles.priceText}>{selectedVariant?.sizeName ?? 'Select size'}</Text>
            <View style={styles.productMidRow}>
              <View style={styles.packetPriceBadge}>
                <Text style={styles.packetPriceLabel}>Bottle Price</Text>
                <Text style={styles.packetPriceValue}>{formatCurrency(pricePerCan)}</Text>
              </View>
              <Image
                source={getVariantImage(selectedVariant?.sizeName)}
                style={styles.productImage}
                resizeMode="contain"
              />
              <View style={styles.packetCountBadge}>
                <Text style={styles.packetPriceLabel}>Quantity</Text>
                <Text style={styles.packetPriceValue}>{cansPerPacket} cans</Text>
              </View>
            </View>
          </View>
          <View style={styles.rowHeader}>
            <Text style={styles.sectionTitle}>Bottle quantity</Text>
            <Text style={styles.sectionMeta}>{packetQuantity} bottle{packetQuantity > 1 ? 's' : ''}</Text>
          </View>
          <View style={styles.quantityControl}>
            <TextInput
              value={packetQuantityInput}
              onChangeText={(text) => setPacketQuantityInput(text.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              caretHidden
              placeholder="Enter bottles"
              placeholderTextColor={theme.colors.textSecondary}
              style={styles.packetInput}
            />
          </View>
          <View style={styles.totalAmountRow}>
            <Text style={styles.totalAmountLabel}>Total amount</Text>
            <Text style={styles.totalAmountValue}>{formatCurrency(totalAmount)}</Text>
          </View>
          <Pressable
            style={[styles.placeOrderButton, placingOrder && styles.disabledButton]}
            onPress={handlePlaceOrder}
            disabled={placingOrder}
          >
            <Text style={styles.placeOrderText}>
              {placingOrder ? 'Placing Order...' : 'Place Order'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <CustomerBottomNav active="CustomerWallet" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 110 },
  orderSuccessText: {
    marginTop: 8,
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '800'
  },
  card: {
    marginTop: 14,
    borderRadius: 22,
    padding: 14,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.stroke,
    ...createShadow({ color: '#163456', opacity: 0.06, radius: 12, elevation: 3 })
  },
  sectionTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '900' },
  sectionMeta: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: '800' },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sizePickerRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap'
  },
  productCard: {
    marginTop: 10,
    minHeight: 236,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.stroke,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 8,
    paddingHorizontal: 10
  },
  variantChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.stroke,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  variantChipSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft
  },
  variantChipText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '900'
  },
  variantChipTextSelected: {
    color: theme.colors.primary
  },
  priceText: { color: theme.colors.text, fontSize: 22, fontWeight: '900' },
  productMidRow: {
    width: '100%',
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  packetPriceBadge: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CFE2F5',
    backgroundColor: '#EAF3FB',
    paddingHorizontal: 8,
    paddingVertical: 6,
    minWidth: 66
  },
  packetCountBadge: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CFE2F5',
    backgroundColor: '#EAF3FB',
    paddingHorizontal: 8,
    paddingVertical: 6,
    minWidth: 66
  },
  packetPriceLabel: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700'
  },
  packetPriceValue: {
    marginTop: 2,
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '900'
  },
  productImage: {
    width: 120,
    height: 156,
    alignSelf: 'center',
    opacity: 1,
    backgroundColor: 'transparent'
  },
  priceSubtext: { marginTop: 4, color: theme.colors.textSecondary, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  outOfStockText: { color: '#B91C1C' },
  quantityControl: {
    marginTop: 10,
    width: '100%'
  },
  packetInput: {
    width: '100%',
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.stroke,
    paddingHorizontal: 16,
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center'
  },
  totalAmountRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  totalAmountLabel: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '800'
  },
  totalAmountValue: {
    color: theme.colors.primary,
    fontSize: 20,
    fontWeight: '900'
  },
  placeOrderButton: {
    marginTop: 12,
    marginBottom: 4,
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  placeOrderText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  disabledButton: { opacity: 0.6 }
  ,
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'center',
    paddingHorizontal: 24
  },
  modalCard: {
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.colors.stroke,
    padding: 18
  },
  modalTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '900'
  },
  modalText: {
    marginTop: 8,
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19
  },
  modalActions: {
    marginTop: 12
  },
  paymentChoiceStack: {
    marginTop: 16,
    gap: 10
  },
  modalSecondaryBtn: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.stroke,
    paddingVertical: 12,
    alignItems: 'center'
  },
  modalSecondaryText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '800'
  },
  modalPrimaryBtn: {
    width: '100%',
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    alignItems: 'center'
  },
  modalPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800'
  }
});

export default CustomerWalletScreen;
