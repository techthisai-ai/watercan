import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { Linking, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import AppIcon from '../components/AppIcon';
import OwnerBottomNav from '../components/OwnerBottomNav';
import ScreenHeader from '../components/ScreenHeader';
import {
  formatCurrency,
  formatQuantityLabel,
  OWNER_STATUS_GROUPS
} from '../data/orderModule';
import { fetchOwnerOrders, OrderRecord, OrderStatus, updateOrder, updateOrderDeliveryProgress, updateOrderStatus } from '../services/firebaseService';
import { useLang } from '../i18n/LanguageContext';
import { createShadow } from '../styles/shadows';
import { theme } from '../styles/theme';

const ownerNextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'confirmed',
  confirmed: 'out_for_delivery',
  preparing: 'out_for_delivery',
  out_for_delivery: 'delivered'
};

type OrderTypeFilter = 'all' | 'single' | 'bulk';

const ORDER_TYPE_FILTER_LABELS: Record<OrderTypeFilter, string> = {
  all: 'All',
  single: 'Single',
  bulk: 'Bulk'
};

const OwnerOrdersScreen = () => {
  const { t } = useLang();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>('confirmed');
  const [orderTypeFilter, setOrderTypeFilter] = useState<OrderTypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [editingQuantity, setEditingQuantity] = useState('');
  const [editingDelivered, setEditingDelivered] = useState('');
  const [editingPending, setEditingPending] = useState('');
  const [approvingPaymentOrderId, setApprovingPaymentOrderId] = useState<string | null>(null);
  const loadOrders = useCallback(async () => {
    const data = await fetchOwnerOrders().catch(() => []);
    setOrders(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [loadOrders])
  );

  const typeFilteredOrders = useMemo(() => {
    if (orderTypeFilter === 'all') {
      return orders;
    }
    return orders.filter((order) =>
      orderTypeFilter === 'bulk'
        ? (order as any).orderType === 'bulk'
        : (order as any).orderType !== 'bulk'
    );
  }, [orders, orderTypeFilter]);

  const searchFilteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return typeFilteredOrders;
    }

    return typeFilteredOrders.filter((order) => {
      const customerName = (order.customerName ?? '').toLowerCase();
      const address = (order.address ?? '').toLowerCase();
      return customerName.includes(query) || address.includes(query);
    });
  }, [typeFilteredOrders, searchQuery]);

  const filteredOrders = useMemo(
    () => searchFilteredOrders.filter((order) => order.status === selectedStatus),
    [searchFilteredOrders, selectedStatus]
  );

  const counts = useMemo(() => {
    return OWNER_STATUS_GROUPS.reduce<Record<OrderStatus, number>>(
      (acc, group) => {
        acc[group.key] = typeFilteredOrders.filter((order) => order.status === group.key).length;
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
  }, [typeFilteredOrders]);

  const visibleStatusGroups = useMemo(
    () => OWNER_STATUS_GROUPS.filter((group) => group.key !== 'pending' && group.key !== 'preparing'),
    []
  );

  const handleStatusUpdate = async (order: OrderRecord) => {
    const next = ownerNextStatus[order.status];
    if (!next || !order.id || updatingOrderId) {
      return;
    }
    const draftDelivered =
      selectedOrder?.id === order.id
        ? Math.max(0, Math.min(order.quantity, parseWholeNumber(editingDelivered)))
        : Math.max(0, Math.min(order.quantity, order.deliveredQuantity ?? (order.status === 'delivered' ? order.quantity : 0)));
  const draftPending = Math.max(order.quantity - draftDelivered, 0);
    const effectiveNext: OrderStatus = next === 'delivered' && draftPending > 0 ? 'out_for_delivery' : next;
    const nextDeliveredQuantity =
      effectiveNext === 'delivered'
        ? order.quantity
        : draftDelivered;
    const nextPendingQuantity =
      effectiveNext === 'delivered'
        ? 0
        : Math.max(order.quantity - nextDeliveredQuantity, 0);

    setUpdatingOrderId(order.id);
    setSelectedStatus(effectiveNext);
    setOrders((current) =>
      current.map((item) =>
        item.id === order.id
          ? {
              ...item,
              status: effectiveNext,
              deliveredQuantity: nextDeliveredQuantity,
              pendingQuantity: nextPendingQuantity,
              updatedAt: Date.now()
            }
          : item
      )
    );
    setSelectedOrder((current) =>
      current && current.id === order.id
        ? {
            ...current,
            status: effectiveNext,
            deliveredQuantity: nextDeliveredQuantity,
            pendingQuantity: nextPendingQuantity,
            updatedAt: Date.now()
          }
        : current
    );
    if (selectedOrder?.id === order.id) {
      setEditingDelivered(String(nextDeliveredQuantity));
      setEditingPending(String(nextPendingQuantity));
    }

    try {
      if (effectiveNext === 'delivered') {
        await updateOrderDeliveryProgress(order.id, order.quantity);
      } else if (effectiveNext === 'out_for_delivery') {
        await updateOrderDeliveryProgress(order.id, nextDeliveredQuantity);
      } else {
        await updateOrderStatus(order.id, effectiveNext);
      }
    } catch {
      await loadOrders();
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const selectedOrderNextStatus = selectedOrder ? ownerNextStatus[selectedOrder.status] : null;
  const parseWholeNumber = (value: string) => {
    const onlyDigits = value.replace(/[^0-9]/g, '');
    if (!onlyDigits) {
      return 0;
    }
    const parsed = Number.parseInt(onlyDigits, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const applyDeliveredEdit = (value: string) => {
    if (!selectedOrder) return;
    const qty = Math.max(1, parseWholeNumber(editingQuantity) || selectedOrder.quantity || 1);
    const delivered = Math.max(0, Math.min(qty, parseWholeNumber(value)));
    const pending = Math.max(qty - delivered, 0);
    setEditingDelivered(String(delivered));
    setEditingPending(String(pending));
  };

  const applyPendingEdit = (value: string) => {
    if (!selectedOrder) return;
    const qty = Math.max(1, parseWholeNumber(editingQuantity) || selectedOrder.quantity || 1);
    const pending = Math.max(0, Math.min(qty, parseWholeNumber(value)));
    const delivered = Math.max(qty - pending, 0);
    setEditingPending(String(pending));
    setEditingDelivered(String(delivered));
  };

  const applyQuantityEdit = (value: string) => {
    if (!selectedOrder) return;
    const qty = Math.max(1, parseWholeNumber(value));
    const currentDelivered = 0;
    const currentPending = qty;
    setEditingQuantity(String(qty));
    setEditingDelivered(String(currentDelivered));
    setEditingPending(String(currentPending));
  };

  const openOrderDetails = (order: OrderRecord) => {
    const delivered = Math.max(0, Math.min(order.quantity, order.deliveredQuantity ?? (order.status === 'delivered' ? order.quantity : 0)));
    const pending = Math.max(0, Math.min(order.quantity, order.pendingQuantity ?? (order.quantity - delivered)));
    setSelectedOrder(order);
    setEditingQuantity(String(order.quantity));
    setEditingDelivered(String(delivered));
    setEditingPending(String(pending));
  };

  const handleSaveDeliveryEdit = async () => {
    if (!selectedOrder?.id || updatingOrderId) {
      return;
    }
    const quantity = Math.max(1, parseWholeNumber(editingQuantity) || selectedOrder.quantity || 1);
    const delivered = Math.max(0, Math.min(quantity, parseWholeNumber(editingDelivered)));
    const pending = Math.max(quantity - delivered, 0);
    const nextStatus: OrderStatus = pending === 0 ? 'delivered' : 'out_for_delivery';

    setUpdatingOrderId(selectedOrder.id);
    setEditingDelivered(String(delivered));
    setEditingPending(String(pending));
    setOrders((current) =>
      current.map((item) =>
        item.id === selectedOrder.id
          ? { ...item, quantity, deliveredQuantity: delivered, pendingQuantity: pending, status: nextStatus, updatedAt: Date.now() }
          : item
      )
    );
    setSelectedOrder((current) =>
      current && current.id === selectedOrder.id
        ? { ...current, quantity, deliveredQuantity: delivered, pendingQuantity: pending, status: nextStatus, updatedAt: Date.now() }
        : current
    );
    setEditingQuantity(String(quantity));

    try {
      await updateOrder(selectedOrder.id, { quantity });
      await updateOrderDeliveryProgress(selectedOrder.id, delivered);
    } catch {
      await loadOrders();
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleApprovePayment = async (order: OrderRecord) => {
    if (!order.id || approvingPaymentOrderId || updatingOrderId) {
      return;
    }
    setApprovingPaymentOrderId(order.id);
    setOrders((current) =>
      current.map((item) => (item.id === order.id ? { ...item, paymentApproved: true, updatedAt: Date.now() } : item))
    );
    setSelectedOrder((current) =>
      current && current.id === order.id ? { ...current, paymentApproved: true, updatedAt: Date.now() } : current
    );
    try {
      await updateOrder(order.id, { paymentApproved: true });
    } catch {
      await loadOrders();
    } finally {
      setApprovingPaymentOrderId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Modal
        transparent
        animationType="fade"
        visible={!!selectedOrder}
        onRequestClose={() => setSelectedOrder(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {selectedOrder ? (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.customerRow}>
                    <View style={styles.customerIcon}>
                      <AppIcon name="person-outline" size={18} color={theme.colors.primary} />
                    </View>
                    <View style={styles.customerBody}>
                      <Text style={styles.customerName}>{selectedOrder.customerName}</Text>
                      <Text style={styles.orderInfo}>{selectedOrder.phone}</Text>
                      <Text style={styles.orderInfo}>{selectedOrder.address}</Text>
                    </View>
                  </View>
                  <Pressable style={styles.closeButton} onPress={() => setSelectedOrder(null)}>
                    <AppIcon name="close-outline" size={18} color={theme.colors.textSecondary} />
                  </Pressable>
                </View>

                <View style={styles.infoGrid}>
                  <View style={styles.infoCell}>
                    <View style={styles.infoHead}>
                      <AppIcon name="cube-outline" size={14} color={theme.colors.primary} />
                      <Text style={styles.infoLabel}>{t.quantityLabel}</Text>
                    </View>
                    <View style={styles.editInputWrap}>
                      <TextInput
                        value={editingQuantity}
                        onChangeText={applyQuantityEdit}
                        keyboardType="number-pad"
                        style={styles.editCountInput}
                      />
                    </View>
                  </View>
                  <View style={styles.infoCell}>
                    <View style={styles.infoHead}>
                      <AppIcon name="cash-outline" size={14} color={theme.colors.primary} />
                      <Text style={styles.infoLabel}>{t.amountLabel}</Text>
                    </View>
                    <Text style={[styles.infoValue, styles.infoValueAmount]}>{formatCurrency(selectedOrder.totalAmount)}</Text>
                  </View>
                  <View style={styles.infoCell}>
                    <View style={styles.infoHead}>
                      <AppIcon name="card-outline" size={14} color={theme.colors.primary} />
                      <Text style={styles.infoLabel}>{t.paymentLabel}</Text>
                    </View>
                    <Text style={styles.infoValue}>{selectedOrder.paymentMethod}</Text>
                  </View>
                </View>

                <View style={styles.infoGrid}>
                  <View style={styles.infoCell}>
                    <View style={styles.infoHead}>
                      <AppIcon name="checkmark-circle-outline" size={14} color={theme.colors.primary} />
                      <Text style={styles.infoLabel}>Delivered cans</Text>
                    </View>
                    <View style={styles.editInputWrap}>
                      <TextInput
                        value={editingDelivered}
                        onChangeText={applyDeliveredEdit}
                        keyboardType="number-pad"
                        style={styles.editCountInput}
                      />
                    </View>
                  </View>
                  <View style={styles.infoCell}>
                    <View style={styles.infoHead}>
                      <AppIcon name="time-outline" size={14} color={theme.colors.primary} />
                      <Text style={styles.infoLabel}>Pending cans</Text>
                    </View>
                    <View style={styles.editInputWrap}>
                      <TextInput
                        value={editingPending}
                        onChangeText={applyPendingEdit}
                        keyboardType="number-pad"
                        style={styles.editCountInput}
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.actionRow}>
                  {selectedOrderNextStatus ? (
                    <Pressable
                      style={[
                        styles.primaryButton,
                        updatingOrderId === selectedOrder.id && styles.primaryButtonDisabled
                      ]}
                      onPress={() => handleStatusUpdate(selectedOrder)}
                      disabled={updatingOrderId === selectedOrder.id}
                    >
                      <AppIcon name="arrow-forward-circle-outline" size={18} color="#fff" />
                      <Text style={styles.primaryButtonText} numberOfLines={1}>
                        {updatingOrderId === selectedOrder.id
                          ? 'Updating...'
                          : selectedOrder.status === 'pending'
                            ? t.confirmOrder
                            : selectedOrder.status === 'confirmed'
                              ? t.markOutForDelivery
                              : selectedOrder.status === 'preparing'
                                ? t.markOutForDelivery
                                : t.markDelivered}
                      </Text>
                    </Pressable>
                  ) : null}

                  <Pressable style={styles.secondaryButton} onPress={() => Linking.openURL(`tel:${selectedOrder.phone}`)}>
                    <AppIcon name="call-outline" size={18} color={theme.colors.primary} />
                    <Text style={styles.secondaryButtonText}>{t.callCustomer}</Text>
                  </Pressable>

                  {selectedOrder.status === 'confirmed' && selectedOrder.paymentStatus !== 'unpaid' && !selectedOrder.paymentApproved ? (
                    <Pressable
                      style={[styles.secondaryButton, { minWidth: 120 }]}
                      onPress={() => handleApprovePayment(selectedOrder)}
                      disabled={approvingPaymentOrderId === selectedOrder.id}
                    >
                      <AppIcon name="checkmark-done-outline" size={18} color={theme.colors.primary} />
                      <Text style={styles.secondaryButtonText}>
                        {approvingPaymentOrderId === selectedOrder.id ? 'Approving...' : 'Payment Approval'}
                      </Text>
                    </Pressable>
                  ) : null}

                  <Pressable
                    style={[styles.secondaryButton, { minWidth: 120 }]}
                    onPress={handleSaveDeliveryEdit}
                    disabled={updatingOrderId === selectedOrder.id}
                  >
                    <AppIcon name="create-outline" size={18} color={theme.colors.primary} />
                    <Text style={styles.secondaryButtonText}>{updatingOrderId === selectedOrder.id ? 'Saving...' : 'Save Edit'}</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          title={t.ownerOrdersTitle}
          subtitle=""
          titleRight={
            <View style={styles.filterGroup}>
              {(['all', 'single', 'bulk'] as OrderTypeFilter[]).map((filter) => {
                const selected = orderTypeFilter === filter;
                return (
                  <Pressable
                    key={filter}
                    style={[styles.filterChip, selected && styles.filterChipSelected]}
                    onPress={() => setOrderTypeFilter(filter)}
                  >
                    <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>
                      {ORDER_TYPE_FILTER_LABELS[filter]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          }
        />

        <View style={[styles.searchWrap, searchFocused && styles.searchWrapFocused]}>
          <View style={styles.searchIconCell}>
            <AppIcon
              name="search-outline"
              size={18}
              color={searchFocused ? theme.colors.primary : theme.colors.textTertiary}
            />
          </View>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by customer name or address"
            placeholderTextColor={theme.colors.textTertiary}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
        </View>

        <View style={styles.statusTabs}>
          {visibleStatusGroups.map((group) => {
            const selected = group.key === selectedStatus;
            return (
              <Pressable
                key={group.key}
                style={[styles.statusTab, selected && styles.statusTabSelected]}
                onPress={() => setSelectedStatus(group.key)}
              >
                <Text
                  style={[styles.statusTabText, selected && styles.statusTabTextSelected]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {group.label}
                </Text>
                <View style={[styles.statusCount, selected && styles.statusCountSelected]}>
                  <Text style={[styles.statusCountText, selected && styles.statusCountTextSelected]}>{counts[group.key]}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {filteredOrders.length ? (
          filteredOrders.map((order) => {
            const isPaid =
              (order.paymentStatus === 'paid' ||
                (typeof order.paidAmount === 'number' && order.paidAmount >= order.totalAmount)) &&
              !!order.paymentApproved;
            const deliveredCans = Math.max(
              0,
              Math.min(order.quantity, order.deliveredQuantity ?? (order.status === 'delivered' ? order.quantity : 0))
            );
            const pendingCans = Math.max(0, Math.min(order.quantity, order.pendingQuantity ?? (order.quantity - deliveredCans)));
            const statusLabel =
              order.status === 'out_for_delivery' && deliveredCans > 0 && pendingCans > 0
                ? 'Partially Delivered'
                : order.status.replace(/_/g, ' ');
            return (
              <Pressable
                key={order.id}
                onPress={() => openOrderDetails(order)}
                style={[
                styles.orderCard,
                (order as any).orderType === 'bulk' && styles.orderCardBulk
              ]}
              >
                <View style={styles.simpleRow}>
                  <View style={styles.simpleIconWrap}>
                    <AppIcon name={(order as any).orderType === 'bulk' ? 'layers-outline' : 'cube-outline'} size={16} color={theme.colors.primary} />
                  </View>
                  <View style={styles.simpleContent}>
                    <Text style={styles.simpleTitle}>{order.customerName}</Text>
                    <Text style={styles.simpleSubtitle}>
                      {formatQuantityLabel(order)} • {order.paymentMethod}
                    </Text>
                  </View>
                  <View style={styles.simpleRight}>
                    <View style={[styles.simpleStatusPill, styles.simplePaymentPill, isPaid ? styles.paidStatusPill : styles.unpaidStatusPill]}>
                      <Text style={[styles.orderStatusText, isPaid ? styles.paidStatusText : styles.unpaidStatusText]}>
                        {isPaid ? 'paid' : 'unpaid'}
                      </Text>
                    </View>
                    <View style={[styles.simpleStatusPill, styles.simpleOrderPill]}>
                      <Text style={styles.simpleOrderPillText}>{statusLabel}</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
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
  searchWrap: {
    marginTop: 10,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#8BB8E8',
    backgroundColor: '#EAF4FF',
    borderRadius: 20,
    overflow: 'hidden'
  },
  searchWrapFocused: {
    borderColor: '#1A7FD4'
  },
  searchIconCell: {
    width: 44,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.28)'
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 15,
    paddingRight: 14,
    outlineStyle: 'none'
  },
  statusTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  filterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.stroke,
    backgroundColor: theme.colors.surface
  },
  filterChipSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft
  },
  filterChipText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '800'
  },
  filterChipTextSelected: {
    color: theme.colors.primary
  },
  statusTab: {
    width: '48%',
    minHeight: 110,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: theme.colors.stroke,
    ...createShadow({ color: '#163456', opacity: 0.05, radius: 10, elevation: 2 })
  },
  statusTabSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary
  },
  statusTabText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
    textAlign: 'center'
  },
  statusTabTextSelected: {
    color: '#fff'
  },
  statusCount: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
    paddingVertical: 0,
    paddingHorizontal: 10,
    alignSelf: 'center'
  },
  statusCountSelected: {
    backgroundColor: 'rgba(255,255,255,0.18)'
  },
  statusCountText: {
    color: theme.colors.primary,
    fontSize: 15,
    fontWeight: '800'
  },
  statusCountTextSelected: {
    color: '#fff'
  },
  orderCard: {
    marginTop: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.stroke,
    ...createShadow({ color: '#163456', opacity: 0.08, radius: 16, elevation: 5 })
  },
  orderCardBulk: {
    borderColor: '#7C3AED',
    borderWidth: 2,
    backgroundColor: '#FDFAFF'
  },
  bulkBadge: {
    backgroundColor: '#7C3AED',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  bulkBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900'
  },
  singleBadge: {
    backgroundColor: '#E0F2FE',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  singleBadgeText: {
    color: '#0369A1',
    fontSize: 10,
    fontWeight: '900'
  },
  infoValueAmount: {
    color: theme.colors.primary,
    fontSize: 16
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12
  },
  simpleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  simpleIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft
  },
  simpleContent: {
    flex: 1,
    minWidth: 0
  },
  simpleTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '900'
  },
  simpleSubtitle: {
    marginTop: 3,
    color: theme.colors.textSecondary,
    fontSize: 12
  },
  simpleRight: {
    alignItems: 'flex-end',
    gap: 6
  },
  simpleStatusPill: {
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  simplePaymentPill: {
    minWidth: 64,
    alignItems: 'center'
  },
  simpleOrderPill: {
    backgroundColor: '#EAF1FB'
  },
  simpleOrderPillText: {
    color: theme.colors.primary,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'lowercase'
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
  paidStatusPill: {
    backgroundColor: '#DCFCE7'
  },
  unpaidStatusPill: {
    backgroundColor: '#FEE2E2'
  },
  paidStatusText: {
    color: '#166534'
  },
  unpaidStatusText: {
    color: '#991B1B'
  },
  customerRow: {
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
    flexWrap: 'nowrap',
    alignItems: 'stretch'
  },
  infoCell: {
    flex: 1,
    minWidth: 0,
    minHeight: 86,
    borderRadius: 18,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  editInputWrap: {
    width: '100%',
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  infoHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  infoLabel: {
    color: theme.colors.textTertiary,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center'
  },
  infoValue: {
    marginTop: 6,
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center'
  },
  editCountInput: {
    width: '100%',
    maxWidth: 120,
    minWidth: 0,
    height: 38,
    borderWidth: 1,
    borderColor: theme.colors.stroke,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 0,
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    alignSelf: 'center'
  },
  actionRow: {
    marginTop: 16,
    gap: 10
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.38)',
    justifyContent: 'center',
    padding: 20
  },
  modalCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    padding: 18,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: theme.colors.stroke,
    ...createShadow({ color: '#163456', opacity: 0.12, radius: 18, elevation: 8 })
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceMuted
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
  primaryButtonDisabled: {
    opacity: 0.7
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    flexShrink: 1
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
