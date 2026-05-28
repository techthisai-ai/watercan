import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { formatCurrency, formatOrderReference, getCustomerPaymentStatusLabel, getOrderProductType } from '../data/orderModule';
import { RootStackParamList } from '../navigation/AppNavigator';
import { getOrderById, OrderRecord } from '../services/firebaseService';
import { useLang } from '../i18n/LanguageContext';

type RouteProps = RouteProp<RootStackParamList, 'OrderConfirmed'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const OrderConfirmedScreen = () => {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProp>();
  const { t } = useLang();
  const [order, setOrder] = useState<OrderRecord | null>(null);

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const tickAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    getOrderById(route.params.orderId).then((data) => {
      if (active) setOrder(data);
    });
    return () => { active = false; };
  }, [route.params.orderId]);

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 6 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true })
      ]),
      Animated.timing(tickAnim, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: false })
    ]).start();
  }, []);

  const tickScale = tickAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1.2, 1] });
  const productType = order ? getOrderProductType(order) : 'Can';
  const productTypeLabel = `${productType}${(order?.quantity ?? 0) !== 1 ? 's' : ''}`;
  const paymentLabel = order ? getCustomerPaymentStatusLabel(order) : 'Unpaid';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.pageGlow} />
      <View style={styles.ticket}>
        <View style={styles.topPanel}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{t.orderPlacedBadge}</Text>
          </View>

          <Animated.View style={[styles.checkCircle, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
            <Animated.View style={{ transform: [{ scale: tickScale }] }}>
              <View style={styles.tickOuter}>
                <View style={styles.tickStem} />
                <View style={styles.tickArm} />
              </View>
            </Animated.View>
          </Animated.View>

          <Text style={styles.title}>{t.orderConfirmedTitle}</Text>
          <Text style={styles.subtitle}>{t.orderConfirmedSubtitle}</Text>
        </View>

        <View style={styles.perforationRow}>
          <View style={styles.cutout} />
          <View style={styles.dashedLine} />
          <View style={styles.cutout} />
        </View>

        <View style={styles.detailsPanel}>
          <View style={styles.priceHero}>
            <Text style={styles.priceHeroLabel}>{t.finalAmount}</Text>
            <Text style={styles.priceHeroValue}>{formatCurrency(order?.totalAmount ?? 0)}</Text>
            <Text style={styles.priceHeroSubtext}>
              {order?.paymentMethod || 'Cash on Delivery'} • {order?.quantity ?? 0} {productTypeLabel}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t.orderNumber}</Text>
            <Text style={styles.detailValue}>{formatOrderReference(order)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t.deliveryWindow}</Text>
            <Text style={styles.detailValue}>{order?.expectedDeliveryTime || 'Today, 30-45 min'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t.deliveryAddress}</Text>
            <Text style={styles.detailValue}>{order?.address || 'Saved customer address'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t.paymentStatus}</Text>
            <Text style={styles.detailValue}>
              {paymentLabel === 'Approval Pending'
                ? 'Approval Pending'
                : paymentLabel === 'Paid'
                  ? t.paidSuccessfully
                  : paymentLabel === 'Partial'
                    ? t.partPaid
                    : t.payOnDelivery}
            </Text>
          </View>

          <View style={styles.greenNote}>
            <Text style={styles.greenNoteTitle}>{t.whatHappensNext}</Text>
            <Text style={styles.greenNoteText}>{t.step1}</Text>
            <Text style={styles.greenNoteText}>{t.step2}</Text>
            <Text style={styles.greenNoteText}>{t.step3}</Text>
          </View>
        </View>

        <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('OrderTracking', { orderId: order?.id ?? route.params.orderId })}>
          <Text style={styles.primaryButtonText}>{t.trackOrder}</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('NewOrder', { reorder: true })}>
          <Text style={styles.secondaryButtonText}>{t.orderAgain}</Text>
        </Pressable>
        <Pressable style={styles.textButton} onPress={() => navigation.navigate('CustomerHome')}>
          <Text style={styles.textButtonText}>{t.backToDashboard}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EAF7EE',
    justifyContent: 'center',
    padding: 18
  },
  pageGlow: {
    position: 'absolute',
    top: -60,
    right: -30,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#D6F0DE'
  },
  ticket: {
    backgroundColor: '#FFFFFF',
    borderRadius: 34,
    overflow: 'hidden'
  },
  topPanel: {
    backgroundColor: '#1E7A45',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 28,
    alignItems: 'center'
  },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  badgeText: {
    color: '#F2FFF5',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  checkCircle: {
    marginTop: 18,
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#F4FFF7',
    alignItems: 'center',
    justifyContent: 'center'
  },
  tickOuter: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  tickStem: {
    position: 'absolute',
    width: 5,
    height: 22,
    backgroundColor: '#1E7A45',
    borderRadius: 3,
    bottom: 2,
    right: 8,
    transform: [{ rotate: '45deg' }]
  },
  tickArm: {
    position: 'absolute',
    width: 5,
    height: 12,
    backgroundColor: '#1E7A45',
    borderRadius: 3,
    bottom: 6,
    left: 6,
    transform: [{ rotate: '-45deg' }]
  },
  title: {
    marginTop: 18,
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 35
  },
  subtitle: {
    marginTop: 10,
    color: '#D8F3E1',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center'
  },
  perforationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF'
  },
  cutout: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#EAF7EE',
    marginHorizontal: -13
  },
  dashedLine: {
    flex: 1,
    borderTopWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#D9EADB'
  },
  detailsPanel: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 10
  },
  priceHero: {
    backgroundColor: '#F4FBF6',
    borderRadius: 24,
    padding: 18,
    marginBottom: 18
  },
  priceHeroLabel: {
    color: '#5C7C69',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  priceHeroValue: {
    marginTop: 8,
    color: '#173726',
    fontSize: 30,
    fontWeight: '900'
  },
  priceHeroSubtext: {
    marginTop: 6,
    color: '#5C7C69',
    fontSize: 13,
    lineHeight: 20
  },
  detailRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF4EF'
  },
  detailLabel: {
    color: '#6E8678',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  detailValue: {
    marginTop: 6,
    color: '#173726',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 23
  },
  greenNote: {
    marginTop: 18,
    borderRadius: 22,
    backgroundColor: '#E7F7EA',
    padding: 16
  },
  greenNoteTitle: {
    color: '#1E7A45',
    fontSize: 15,
    fontWeight: '900'
  },
  greenNoteText: {
    marginTop: 8,
    color: '#2E6644',
    fontSize: 13,
    lineHeight: 19
  },
  primaryButton: {
    marginTop: 6,
    marginHorizontal: 22,
    backgroundColor: '#1E7A45',
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center'
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900'
  },
  secondaryButton: {
    marginTop: 12,
    marginHorizontal: 22,
    backgroundColor: '#ECF7EF',
    borderRadius: 20,
    paddingVertical: 15,
    alignItems: 'center'
  },
  secondaryButtonText: {
    color: '#1E7A45',
    fontSize: 16,
    fontWeight: '800'
  },
  textButton: {
    marginTop: 10,
    marginBottom: 22,
    alignItems: 'center',
    paddingVertical: 10
  },
  textButtonText: {
    color: '#2F6E48',
    fontSize: 15,
    fontWeight: '800'
  }
});

export default OrderConfirmedScreen;

