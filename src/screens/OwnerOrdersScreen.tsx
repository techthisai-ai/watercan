import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import AppIcon from '../components/AppIcon';
import OwnerBottomNav from '../components/OwnerBottomNav';
import ScreenHeader from '../components/ScreenHeader';
import {
  formatCurrency,
  formatOrderDate,
  formatOrderNumber,
  ORDER_STATUS_META,
  OWNER_STATUS_GROUPS
} from '../data/orderModule';
import { RootStackParamList } from '../navigation/AppNavigator';
import { fetchOwnerOrders, OrderRecord, OrderStatus, updateOrderStatus } from '../services/firebaseService';
import { useLang } from '../i18n/LanguageContext';
import { createShadow } from '../styles/shadows';
import { theme } from '../styles/theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'OwnerOrders'>;

const ownerNextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'confirmed',
  confirmed: 'preparing',
  preparing: 'out_for_delivery',
  out_for_delivery: 'delivered'
};

const actionLabel: Partial<Record<OrderStatus, string>> = {
  pending: 'Confirm order',
  confirmed: 'Mark preparing',
  preparing: 'Mark out for delivery',
  out_for_delivery: 'Mark delivered'
};

const OwnerOrdersScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useLang();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>('pending');

  const loadOrders = useCallback(async () => {
    const data = await fetchOwnerOrders().catch(() => []);
    setOrders(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [loadOrders])
  );

  const filteredOrders = useMemo(
    () => orders.filter((order) => order.status === selectedStatus),
    [orders, selectedStatus]
  );

  const counts = useMemo(() => {
    return OWNER_STATUS_GROUPS.reduce<Record<OrderStatus, number>>(
      (acc, group) => {
        acc[group.key] = orders.filter((order) => order.status === group.key).length;
        return acc;
      },
      {
        pending: 0,
        confirmed: 0,
        preparing: 0,
        out_for_delivery: 0,
        delivered: 0,
        cancelled: 0
      }
    );
  }, [orders]);

  const handleStatusUpdate = async (order: OrderRecord) => {
    const next = ownerNextStatus[order.status];
    if (!next) {
      return;
    }
    await updateOrderStatus(order.id!, next);
    loadOrders();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          title={t.ownerOrdersTitle}
          subtitle=""
        />

        <View style={styles.statusTabs}>
          {OWNER_STATUS_GROUPS.map((group) => {
            const selected = group.key === selectedStatus;
            return (
              <Pressable
                key={group.key}
                style={[styles.statusTab, selected && styles.statusTabSelected]}
                onPress={() => setSelectedStatus(group.key)}
              >
                <Text style={[styles.statusTabText, selected && styles.statusTabTextSelected]}>{group.label}</Text>
                <View style={[styles.statusCount, selected && styles.statusCountSelected]}>
                  <Text style={[styles.statusCountText, selected && styles.statusCountTextSelected]}>{counts[group.key]}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {filteredOrders.length ? (
          filteredOrders.map((order) => {
            const meta = ORDER_STATUS_META[order.status];
            const next = ownerNextStatus[order.status];
            return (
              <View key={order.id} style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <View>
                    <Text style={styles.orderNumber}>{formatOrderNumber(order)}</Text>
                    <Text style={styles.orderTime}>{formatOrderDate(order.createdAt)}</Text>
                  </View>
                  <View style={[styles.orderStatusPill, { backgroundColor: meta.background }]}>
                    <Text style={[styles.orderStatusText, { color: meta.text }]}>{meta.label}</Text>
                  </View>
                </View>

                <View style={styles.customerRow}>
                  <View style={styles.customerIcon}>
                    <AppIcon name="person-outline" size={18} color={theme.colors.primary} />
                  </View>
                  <View style={styles.customerBody}>
                    <Text style={styles.customerName}>{order.customerName}</Text>
                    <Text style={styles.orderInfo}>{order.phone}</Text>
                    <Text style={styles.orderInfo}>{order.address}</Text>
                  </View>
                </View>

                <View style={styles.infoGrid}>
                  <View style={styles.infoCell}>
                    <Text style={styles.infoLabel}>{t.quantityLabel}</Text>
                    <Text style={styles.infoValue}>{order.quantity} cans</Text>
                  </View>
                  <View style={styles.infoCell}>
                    <Text style={styles.infoLabel}>{t.amountLabel}</Text>
                    <Text style={styles.infoValue}>{formatCurrency(order.totalAmount)}</Text>
                  </View>
                  <View style={styles.infoCell}>
                    <Text style={styles.infoLabel}>{t.paymentLabel}</Text>
                    <Text style={styles.infoValue}>{order.paymentMethod}</Text>
                  </View>
                  <View style={styles.infoCell}>
                    <Text style={styles.infoLabel}>{t.slotLabel}</Text>
                    <Text style={styles.infoValue}>{order.deliverySlot}</Text>
                  </View>
                </View>

                <View style={styles.actionRow}>
                  {next ? (
                    <Pressable style={styles.primaryButton} onPress={() => handleStatusUpdate(order)}>
                      <AppIcon name="arrow-forward-circle-outline" size={18} color="#fff" />
                      <Text style={styles.primaryButtonText}>
                        {order.status === 'pending' ? t.confirmOrder : order.status === 'confirmed' ? t.markPreparing : order.status === 'preparing' ? t.markOutForDelivery : t.markDelivered}
                      </Text>
                    </Pressable>
                  ) : null}
                  <Pressable style={styles.secondaryButton} onPress={() => Linking.openURL(`tel:${order.phone}`)}>
                    <AppIcon name="call-outline" size={18} color={theme.colors.primary} />
                    <Text style={styles.secondaryButtonText}>{t.callCustomer}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => navigation.navigate('OrderDetails', { orderId: order.id! })}
                  >
                    <AppIcon name="document-text-outline" size={18} color={theme.colors.primary} />
                    <Text style={styles.secondaryButtonText}>{t.viewDetails}</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyCard}>
            <AppIcon name="file-tray-outline" size={28} color={theme.colors.textTertiary} />
            <Text style={styles.emptyTitle}>{t.noOrdersStage}</Text>
            <Text style={styles.emptyText}>{t.noOrdersStageText}</Text>
          </View>
        )}
      </ScrollView>
      <OwnerBottomNav active="OwnerOrders" />
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
  statusTabs: {
    gap: 10
  },
  statusTab: {
    backgroundColor: theme.colors.surface,
    borderRadius: 22,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.stroke
  },
  statusTabSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary
  },
  statusTabText: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '800'
  },
  statusTabTextSelected: {
    color: '#fff'
  },
  statusCount: {
    minWidth: 34,
    alignItems: 'center',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
    paddingVertical: 6,
    paddingHorizontal: 8
  },
  statusCountSelected: {
    backgroundColor: 'rgba(255,255,255,0.18)'
  },
  statusCountText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '800'
  },
  statusCountTextSelected: {
    color: '#fff'
  },
  orderCard: {
    marginTop: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.stroke,
    ...createShadow({ color: '#163456', opacity: 0.08, radius: 16, elevation: 5 })
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  orderNumber: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '900'
  },
  orderTime: {
    marginTop: 5,
    color: theme.colors.textSecondary,
    fontSize: 12
  },
  orderStatusPill: {
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  orderStatusText: {
    fontSize: 11,
    fontWeight: '800'
  },
  customerRow: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 12
  },
  customerIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft
  },
  customerBody: {
    flex: 1
  },
  customerName: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800'
  },
  orderInfo: {
    marginTop: 4,
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20
  },
  infoGrid: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap'
  },
  infoCell: {
    width: '48%',
    borderRadius: 18,
    backgroundColor: theme.colors.surfaceMuted,
    padding: 12
  },
  infoLabel: {
    color: theme.colors.textTertiary,
    fontSize: 11,
    fontWeight: '700'
  },
  infoValue: {
    marginTop: 6,
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '800'
  },
  actionRow: {
    marginTop: 16,
    gap: 10
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 20,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800'
  },
  secondaryButton: {
    backgroundColor: theme.colors.primarySoft,
    borderRadius: 20,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8
  },
  secondaryButtonText: {
    color: theme.colors.primary,
    fontSize: 15,
    fontWeight: '800'
  },
  emptyCard: {
    marginTop: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.stroke,
    ...createShadow({ color: '#163456', opacity: 0.08, radius: 16, elevation: 5 })
  },
  emptyTitle: {
    marginTop: 12,
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '800'
  },
  emptyText: {
    marginTop: 8,
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center'
  }
});

export default OwnerOrdersScreen;
