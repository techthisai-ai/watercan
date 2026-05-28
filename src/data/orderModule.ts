import { OrderRecord, OrderStatus } from '../services/firebaseService';

export const WATER_PRODUCT = {
  id: 'twenty-liter-can',
  name: '20L Drinking Water Can',
  subtitle: 'Fresh drinking water for home delivery',
  pricePerCan: 20,
  availableStock: 14,
  lowStockThreshold: 5
};

export const DELIVERY_SLOTS = ['Morning', 'Afternoon', 'Evening', 'Express delivery'] as const;
export type DeliverySlotOption = (typeof DELIVERY_SLOTS)[number];

export const PAYMENT_OPTIONS = [
  {
    id: 'Cash on Delivery',
    title: 'Cash on Delivery',
    subtitle: 'Pay the delivery person after the cans arrive'
  },
  {
    id: 'UPI ID',
    title: 'UPI ID',
    subtitle: 'Pay directly to the shop UPI ID'
  },
  {
    id: 'Google Pay',
    title: 'Google Pay',
    subtitle: 'Complete payment with Google Pay'
  }
] as const;

export const ORDER_STATUS_STEPS: Array<{
  id: Exclude<OrderStatus, 'cancelled'>;
  label: string;
  shortLabel: string;
}> = [
  { id: 'pending', label: 'Order Placed', shortLabel: 'Placed' },
  { id: 'confirmed', label: 'Confirmed', shortLabel: 'Confirmed' },
  { id: 'preparing', label: 'Preparing', shortLabel: 'Preparing' },
  { id: 'out_for_delivery', label: 'Out for Delivery', shortLabel: 'On the way' },
  { id: 'delivered', label: 'Delivered', shortLabel: 'Delivered' }
];

export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; background: string; text: string; accent: string }
> = {
  pending: {
    label: 'Order Placed',
    background: '#FFF4D6',
    text: '#9A6400',
    accent: '#F2B300'
  },
  confirmed: {
    label: 'Confirmed',
    background: '#E3F0FF',
    text: '#0D63A8',
    accent: '#1D8CD8'
  },
  preparing: {
    label: 'Preparing',
    background: '#EAF7FF',
    text: '#0B7AA7',
    accent: '#43B3E6'
  },
  out_for_delivery: {
    label: 'Out for Delivery',
    background: '#DFF6FF',
    text: '#006B8F',
    accent: '#1AA7D7'
  },
  delivered: {
    label: 'Delivered',
    background: '#DCFCE7',
    text: '#166534',
    accent: '#34C759'
  },
  cancelled: {
    label: 'Cancelled',
    background: '#FEE2E2',
    text: '#B42318',
    accent: '#EF4444'
  }
};

export const QUICK_REORDER_SUGGESTIONS = [
  'You usually order every 3 days. Need water today?',
  'One tap reorder is ready for your last 2-can order.',
  'Weekly Water Plan can save daily booking time.'
];

export const OWNER_STATUS_GROUPS: Array<{ key: OrderStatus; label: string }> = [
  { key: 'pending', label: 'New Orders' },
  { key: 'confirmed', label: 'Confirmed Orders' },
  { key: 'preparing', label: 'Preparing Orders' },
  { key: 'out_for_delivery', label: 'Out for Delivery' },
  { key: 'delivered', label: 'Delivered Orders' },
  { key: 'cancelled', label: 'Cancelled Orders' }
];

export const formatQuantityLabel = (
  order: Pick<OrderRecord, 'quantity' | 'orderType' | 'packName' | 'productName' | 'variantSize'>
) => {
  const productType = getOrderProductType(order);
  const pluralType = `${productType}${order.quantity !== 1 ? 's' : ''}`;
  if (order.orderType === 'bulk') {
    const packSize = order.packName?.match(/(\d+)/)?.[1];
    if (packSize) {
      const packets = Math.round(order.quantity / Number(packSize));
      return `${packets} packet${packets !== 1 ? 's' : ''} (${order.quantity} ${pluralType})`;
    }
    return `${order.quantity} ${pluralType} (bulk)`;
  }
  return `${order.quantity} ${pluralType}`;
};

export const getOrderProductType = (
  order: Pick<OrderRecord, 'productName' | 'orderType' | 'packName' | 'variantSize'>
) => {
  const raw = `${order.productName ?? ''} ${order.variantSize ?? ''} ${order.packName ?? ''}`.toLowerCase();
  if (raw.includes('bottle') || raw.includes('ml') || raw.includes(' litre') || raw.includes(' liter')) {
    return 'Bottle' as const;
  }
  return 'Can' as const;
};

export const formatCurrency = (amount: number) => {
  const hasFraction = Math.abs(amount % 1) > 0.000001;
  return `Rs ${hasFraction ? amount.toFixed(2).replace(/\.?0+$/, '') : amount.toFixed(0)}`;
};

export const formatOrderNumber = (order?: Pick<OrderRecord, 'orderNumber' | 'id'> | null) => {
  const rawNumber = Number(order?.orderNumber ?? 0);
  if (Number.isFinite(rawNumber) && rawNumber > 0) {
    return `#${String(Math.floor(rawNumber)).padStart(5, '0')}`;
  }
  const fallback = order?.id ? order.id.slice(-5).toUpperCase() : '-----';
  return `#${fallback}`;
};

export const formatOrderReference = (order?: Pick<OrderRecord, 'orderNumber' | 'id'> | null) => {
  const rawNumber = Number(order?.orderNumber ?? 0);
  if (Number.isFinite(rawNumber) && rawNumber > 0) {
    return `#${String(Math.floor(rawNumber)).padStart(5, '0')}`;
  }
  const fallback = order?.id ? order.id.slice(-5).toUpperCase() : '-----';
  return `#${fallback}`;
};

export const getCustomerPaymentStatusLabel = (
  order: Pick<OrderRecord, 'paymentStatus' | 'paymentApproved' | 'paidAmount' | 'totalAmount'>
) => {
  const paidAmount = Math.max(0, order.paidAmount ?? 0);
  const isApproved = !!order.paymentApproved;
  const hasCustomerPayment = paidAmount > 0 || order.paymentStatus === 'paid' || order.paymentStatus === 'partial';
  if (hasCustomerPayment && !isApproved) {
    return 'Approval Pending';
  }
  if (order.paymentStatus === 'paid' || paidAmount >= order.totalAmount) {
    return 'Paid';
  }
  if (order.paymentStatus === 'partial' || (paidAmount > 0 && paidAmount < order.totalAmount)) {
    return 'Partial';
  }
  return 'Unpaid';
};

export const formatOrderDate = (value?: number) => {
  if (!value) {
    return 'Today';
  }
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

export const canCancelOrder = (status: OrderStatus) =>
  status === 'pending' || status === 'confirmed' || status === 'preparing';

export const canModifyOrder = (status: OrderStatus) => status === 'pending';

export const getSuggestedQuantity = (orders: OrderRecord[]) => {
  if (!orders.length) {
    return 2;
  }
  return orders[0].quantity;
};

export const getReminderText = (orders: OrderRecord[]) => {
  if (orders.length < 2) {
    return QUICK_REORDER_SUGGESTIONS[0];
  }

  const last = orders[0].createdAt;
  const previous = orders[1].createdAt;
  const days = Math.max(1, Math.round((last - previous) / (1000 * 60 * 60 * 24)));
  return `You usually order every ${days} day${days === 1 ? '' : 's'}. Need water today?`;
};
