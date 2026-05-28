import React from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AppIcon from './AppIcon';
import {
  canCancelOrder,
  formatCurrency,
  formatOrderDate,
  formatOrderReference,
  formatQuantityLabel,
  ORDER_STATUS_META
} from '../data/orderModule';
import { OrderRecord } from '../services/firebaseService';
import { createShadow } from '../styles/shadows';
import { theme } from '../styles/theme';

const formatOrderDateTime = (value?: number) => {
  if (!value) {
    return 'Today';
  }
  const date = formatOrderDate(value);
  const time = new Date(value).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit'
  });
  return `${date} ${time}`;
};

type OrderHistoryCardProps = {
  order: OrderRecord;
  onPayment: () => void;
  onTrack?: () => void;
  onCancel?: () => void;
};

const OrderHistoryCard = ({
  order,
  onPayment,
  onTrack,
  onCancel
}: OrderHistoryCardProps) => {
  const meta = ORDER_STATUS_META[order.status];
  const deliveredCans = Math.max(
    0,
    Math.min(order.quantity, order.deliveredQuantity ?? (order.status === 'delivered' ? order.quantity : 0))
  );
  const pendingCans = Math.max(0, Math.min(order.quantity, order.pendingQuantity ?? (order.quantity - deliveredCans)));
  const statusLabel =
    order.status === 'out_for_delivery' && deliveredCans > 0 && pendingCans > 0
      ? 'Partial'
      : meta.label;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.orderNumber}>{formatOrderReference(order)}</Text>
          <Text style={styles.dateText}>{formatOrderDateTime(order.createdAt)}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: meta.background }]}>
          <Text style={[styles.statusText, { color: meta.text }]}>{statusLabel}</Text>
        </View>
      </View>

      <View style={styles.infoRow}>
        <View style={styles.infoCell}>
          <AppIcon name="cube-outline" size={16} color={theme.colors.primary} />
          <Text style={styles.infoLabel}>Quantity</Text>
          <Text style={styles.infoValue}>{formatQuantityLabel(order)}</Text>
        </View>
        <View style={styles.infoCell}>
          <AppIcon name="cash-outline" size={16} color={theme.colors.secondary} />
          <Text style={styles.infoLabel}>Amount</Text>
          <Text style={styles.infoValue}>{formatCurrency(order.totalAmount)}</Text>
        </View>
      </View>

      <View style={styles.infoRow}>
        <View style={styles.infoCell}>
          <AppIcon name="card-outline" size={16} color={theme.colors.primary} />
          <Text style={styles.infoLabel}>Payment</Text>
          <Text style={styles.infoValue}>{order.paymentMethod}</Text>
        </View>
        <View style={styles.infoCell}>
          <AppIcon name="checkmark-circle-outline" size={16} color={theme.colors.primary} />
          <Text style={styles.infoLabel}>Delivery</Text>
          <Text style={styles.infoValue}>
            {`${deliveredCans} Cans Delivered`}
          </Text>
          <Text style={styles.infoValue}>
            {`${pendingCans} Cans Pending`}
          </Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <Pressable style={styles.secondaryButton} onPress={onPayment}>
          <AppIcon name="card-outline" size={16} color={theme.colors.primary} />
          <Text style={styles.secondaryButtonText}>Payment</Text>
        </Pressable>
        {onTrack ? (
          <Pressable style={styles.secondaryButton} onPress={onTrack}>
            <AppIcon name="navigate-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.secondaryButtonText}>Track</Text>
          </Pressable>
        ) : null}
        {canCancelOrder(order.status) && onCancel ? (
          <TouchableOpacity style={styles.cancelButtonInline} onPress={onCancel} activeOpacity={0.7}>
            <AppIcon name="close-circle-outline" size={18} color={theme.colors.danger} />
            <Text style={styles.cancelButtonText}>Cancel order</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.stroke,
    ...createShadow({ color: '#163456', opacity: 0.08, radius: 16, elevation: 5 })
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  orderNumber: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: '900'
  },
  dateText: {
    marginTop: 4,
    color: theme.colors.textSecondary,
    fontSize: 12
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800'
  },
  infoRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10
  },
  infoCell: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: theme.colors.surfaceMuted,
    padding: 12
  },
  infoLabel: {
    marginTop: 10,
    color: theme.colors.textTertiary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  infoValue: {
    marginTop: 6,
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '800'
  },
  actionRow: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap'
  },
  secondaryButton: {
    flex: 1,
    minWidth: 100,
    backgroundColor: theme.colors.primarySoft,
    borderRadius: 18,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6
  },
  secondaryButtonText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '800'
  },
  cancelButtonInline: {
    flex: 1,
    minWidth: 100,
    backgroundColor: '#FFF4F3',
    borderRadius: 18,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#FECACA'
  },
  cancelButtonText: {
    color: theme.colors.danger,
    fontSize: 15,
    fontWeight: '800'
  }
});

export default React.memo(OrderHistoryCard);
