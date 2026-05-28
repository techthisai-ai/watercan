import React, { useEffect, useState } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AppIcon from '../components/AppIcon';
import TopNav from '../components/TopNav';
import OwnerBottomNav from '../components/OwnerBottomNav';
import { formatCurrency, formatOrderDate, formatOrderNumber } from '../data/orderModule';
import { RootStackParamList } from '../navigation/AppNavigator';
import { fetchCustomers, fetchOwnerOrders, OrderRecord, UserProfileData } from '../services/firebaseService';
import { useLang } from '../i18n/LanguageContext';

type CustomerFilter = 'all' | 'active' | 'inactive';
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

const OwnerCustomersScreen = () => {
  const { t } = useLang();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [customers, setCustomers] = useState<UserProfileData[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<UserProfileData | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<CustomerFilter>('all');
  const [showDetails, setShowDetails] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const [cust, ord] = await Promise.all([fetchCustomers(), fetchOwnerOrders()]);
      setCustomers(cust);
      setOrders(ord);
    };
    loadData();
  }, []);

  const lastOrderByCustomer = orders.reduce<Record<string, OrderRecord>>((acc, order) => {
    const existing = acc[order.customerId];
    if (!existing || order.createdAt > existing.createdAt) {
      acc[order.customerId] = order;
    }
    return acc;
  }, {});
  const pendingByCustomer = orders.reduce<Record<string, number>>((acc, order) => {
    const paid = order.paymentStatus === 'paid' ? order.totalAmount : order.paidAmount ?? 0;
    const pending = Math.max(order.totalAmount - paid, 0);
    acc[order.customerId] = (acc[order.customerId] ?? 0) + pending;
    return acc;
  }, {});

  const totalCustomers = customers.length;
  const now = Date.now();
  const activeCustomerIds = new Set(
    customers
      .filter((customer) => {
        const lastOrder = lastOrderByCustomer[customer.uid];
        if (!lastOrder) {
          return false;
        }
        return now - lastOrder.createdAt < THREE_DAYS_MS;
      })
      .map((customer) => customer.uid)
  );
  const activeCustomers = customers.filter((customer) => activeCustomerIds.has(customer.uid));
  const inactiveCustomers = customers.filter((customer) => !activeCustomerIds.has(customer.uid));
  const filteredCustomers =
    selectedFilter === 'active'
      ? activeCustomers
      : selectedFilter === 'inactive'
        ? inactiveCustomers
        : customers;
  const activeCustomersCount = activeCustomers.length;
  const inactiveCustomersCount = inactiveCustomers.length;
  const selectedCustomerIsActive = selectedCustomer ? activeCustomerIds.has(selectedCustomer.uid) : false;
  const selectedOrders = selectedCustomer
    ? orders.filter((order) => order.customerId === selectedCustomer.uid)
    : [];
  const activeOrders = selectedOrders.filter((order) => order.status !== 'delivered' && order.status !== 'cancelled');
  const deliveredOrders = selectedOrders.filter((order) => order.status === 'delivered');
  const cancelledOrders = selectedOrders.filter((order) => order.status === 'cancelled');
  const totalAmount = selectedOrders.reduce((sum, order) => sum + order.totalAmount, 0);

  return (
    <SafeAreaView style={styles.container}>
      <Modal
        transparent
        animationType="fade"
        visible={!!selectedCustomer}
        onRequestClose={() => setSelectedCustomer(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderBody}>
                  <Text style={styles.modalTitle}>{selectedCustomer?.name}</Text>
                  <Text style={styles.modalMeta}>{selectedCustomer?.phone}</Text>
                </View>
                <Pressable style={styles.closeButton} onPress={() => setSelectedCustomer(null)}>
                  <Text style={styles.closeText}>Close</Text>
                </Pressable>
              </View>

              <View style={styles.detailBox}>
                <Text style={styles.detailLabel}>Status</Text>
                <Text style={[styles.detailValue, selectedCustomerIsActive ? styles.statusActiveText : styles.statusInactiveText]}>
                  {selectedCustomerIsActive ? 'Active' : 'Inactive'}
                </Text>
              </View>
              <View style={styles.detailBox}>
                <Text style={styles.detailLabel}>Address</Text>
                <Text style={styles.detailValue}>{selectedCustomer?.address?.trim() || 'No address saved'}</Text>
              </View>

              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{selectedOrders.length}</Text>
                  <Text style={styles.summaryLabel}>Orders</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{activeOrders.length}</Text>
                  <Text style={styles.summaryLabel}>Active</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{deliveredOrders.length}</Text>
                  <Text style={styles.summaryLabel}>Delivered</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{cancelledOrders.length}</Text>
                  <Text style={styles.summaryLabel}>Cancelled</Text>
                </View>
              </View>

              <View style={styles.totalBox}>
                <Text style={styles.detailLabel}>Total order amount</Text>
                <Text style={styles.totalValue}>{formatCurrency(totalAmount)}</Text>
              </View>

              <Text style={styles.modalSectionTitle}>Related orders</Text>
              {selectedOrders.length ? (
                selectedOrders.map((order) => (
                  <Pressable
                    key={order.id}
                    style={styles.orderRow}
                    onPress={() => {
                      setSelectedCustomer(null);
                      navigation.navigate('OrderDetails', { orderId: order.id! });
                    }}
                  >
                    <View>
                      <Text style={styles.orderTitle}>{formatOrderNumber(order)}</Text>
                      <Text style={styles.orderMeta}>{formatOrderDate(order.createdAt)} | {order.status.replace(/_/g, ' ')}</Text>
                    </View>
                    <View style={styles.orderRight}>
                      <Text style={styles.orderTitle}>{order.quantity} cans</Text>
                      <Text style={styles.orderMeta}>{formatCurrency(order.totalAmount)}</Text>
                    </View>
                  </Pressable>
                ))
              ) : (
                <Text style={styles.emptyText}>{t.noOrders2}</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <TopNav />
      <View style={styles.body}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>{t.customersTitle}</Text>
          <Text style={styles.subtitle}>{t.customersSubtitle}</Text>
          <View style={styles.statsRow}>
            <Pressable
              style={[styles.statCard, styles.filterCard, showDetails && styles.filterCardSelected]}
              onPress={() => {
                setSelectedFilter('all');
                setShowDetails((prev) => !prev);
              }}
            >
              <View style={[styles.statIconWrap, styles.statIconWrapNeutral]}>
                <AppIcon name="people-outline" size={18} color="#0B61A4" />
              </View>
              <Text style={styles.statLabel}>{t.totalLabel}</Text>
              <Text style={styles.statValue}>{totalCustomers}</Text>
            </Pressable>
            <Pressable
              style={[styles.statCard, styles.filterCard, selectedFilter === 'active' && styles.filterCardActive]}
              onPress={() => {
                setSelectedFilter((prev) => (prev === 'active' ? 'all' : 'active'));
                setShowDetails(true);
              }}
            >
              <View style={[styles.statIconWrap, styles.statIconWrapActive]}>
                <AppIcon name="person-circle-outline" size={18} color="#047857" />
              </View>
              <Text style={styles.statLabel}>Active Customers</Text>
              <Text style={styles.statValue}>{activeCustomersCount}</Text>
            </Pressable>
            <Pressable
              style={[styles.statCard, styles.filterCard, selectedFilter === 'inactive' && styles.filterCardInactive]}
              onPress={() => {
                setSelectedFilter((prev) => (prev === 'inactive' ? 'all' : 'inactive'));
                setShowDetails(true);
              }}
            >
              <View style={[styles.statIconWrap, styles.statIconWrapInactive]}>
                <AppIcon name="person-remove-outline" size={18} color="#B45309" />
              </View>
              <Text style={styles.statLabel}>Deactivate Customer</Text>
              <Text style={styles.statValue}>{inactiveCustomersCount}</Text>
            </Pressable>
          </View>
          {showDetails ? (
            <View style={styles.listCard}>
              {filteredCustomers.map((cust) => {
                const lastOrder = lastOrderByCustomer[cust.uid];
                const pendingAmount = pendingByCustomer[cust.uid] ?? 0;
                const isActiveCustomer = activeCustomerIds.has(cust.uid);
                return (
                  <Pressable key={cust.uid} style={styles.listRow} onPress={() => setSelectedCustomer(cust)}>
                    <View style={styles.listLeft}>
                      <Text style={styles.listPrimary}>{cust.name}</Text>
                      <Text style={styles.listSecondary}>{cust.phone}</Text>
                    </View>
                    <View style={styles.listRight}>
                      <View style={[styles.statusPill, isActiveCustomer ? styles.statusPillActive : styles.statusPillInactive]}>
                        <Text style={[styles.statusPillText, isActiveCustomer ? styles.statusPillTextActive : styles.statusPillTextInactive]}>
                          {isActiveCustomer ? 'Active' : 'Inactive'}
                        </Text>
                      </View>
                      {pendingAmount > 0 ? (
                        <Text style={styles.listPendingAmount}>- {formatCurrency(pendingAmount)}</Text>
                      ) : null}
                      <Text style={styles.listSecondary}>
                        {lastOrder ? new Date(lastOrder.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : t.noOrders2}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
              {filteredCustomers.length === 0 ? (
                <Text style={styles.emptyText}>{t.noCustomers}</Text>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      </View>
      <OwnerBottomNav active="OwnerCustomers" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F8FF'
  },
  body: {
    flex: 1
  },
  content: {
    padding: 24,
    paddingBottom: 120
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8
  },
  subtitle: {
    color: '#64748B'
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 12,
    marginTop: 16,
    marginBottom: 16
  },
  statCard: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.08)'
  },
  statIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  statIconWrapNeutral: {
    backgroundColor: '#E0F2FE'
  },
  statIconWrapActive: {
    backgroundColor: '#DCFCE7'
  },
  statIconWrapInactive: {
    backgroundColor: '#FFEDD5'
  },
  statLabel: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 13,
    marginTop: 6,
    textAlign: 'center',
    minHeight: 26
  },
  statValue: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4
  },
  filterCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  filterCardSelected: {
    borderColor: '#0B61A4',
    backgroundColor: '#F0F8FF'
  },
  filterCardActive: {
    borderColor: '#16A34A',
    backgroundColor: '#F0FDF4'
  },
  filterCardInactive: {
    borderColor: '#D97706',
    backgroundColor: '#FFFBEB'
  },
  listCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 12,
    boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.08)'
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: '#E5E7EB'
  },
  listLeft: {
    flex: 1
  },
  listPrimary: {
    fontWeight: '700',
    color: '#0F172A'
  },
  listSecondary: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 4
  },
  listRight: {
    alignItems: 'flex-end'
  },
  statusPill: {
    marginTop: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start'
  },
  statusPillActive: {
    backgroundColor: '#ECFDF5'
  },
  statusPillInactive: {
    backgroundColor: '#FFF7ED'
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800'
  },
  statusPillTextActive: {
    color: '#047857'
  },
  statusPillTextInactive: {
    color: '#B45309'
  },
  listPendingAmount: {
    color: '#DC2626',
    fontWeight: '800',
    fontSize: 12
  },
  emptyText: {
    textAlign: 'center',
    color: '#6B7280',
    marginTop: 12
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: 20
  },
  modalCard: {
    maxHeight: '86%',
    backgroundColor: 'white',
    borderRadius: 22,
    padding: 18
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start'
  },
  modalHeaderBody: {
    flex: 1
  },
  modalTitle: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '900'
  },
  modalMeta: {
    color: '#64748B',
    marginTop: 5
  },
  closeButton: {
    borderRadius: 12,
    backgroundColor: '#EAF3FB',
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  closeText: {
    color: '#0B61A4',
    fontWeight: '800'
  },
  detailBox: {
    marginTop: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12
  },
  detailLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  detailValue: {
    color: '#0F172A',
    marginTop: 6,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21
  },
  statusActiveText: {
    color: '#047857'
  },
  statusInactiveText: {
    color: '#B45309'
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14
  },
  summaryItem: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12
  },
  summaryValue: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '900'
  },
  summaryLabel: {
    color: '#64748B',
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700'
  },
  totalBox: {
    marginTop: 14,
    backgroundColor: '#EAF3FB',
    borderRadius: 14,
    padding: 12
  },
  totalValue: {
    color: '#0B61A4',
    marginTop: 6,
    fontSize: 18,
    fontWeight: '900'
  },
  modalSectionTitle: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 18,
    marginBottom: 8
  },
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: '#E5E7EB'
  },
  orderTitle: {
    color: '#0F172A',
    fontWeight: '900'
  },
  orderMeta: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4
  },
  orderRight: {
    alignItems: 'flex-end'
  }
});

export default OwnerCustomersScreen;
