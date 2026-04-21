import React, { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import TopNav from '../components/TopNav';
import OwnerBottomNav from '../components/OwnerBottomNav';
import { fetchCustomers, fetchOwnerOrders, OrderRecord, UserProfileData } from '../services/firebaseService';
import { useLang } from '../i18n/LanguageContext';

const OwnerCustomersScreen = () => {
  const { t } = useLang();
  const [customers, setCustomers] = useState<UserProfileData[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);

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

  const totalCustomers = customers.length;
  const pendingCustomers = customers.filter((cust) => !cust.approved).length;

  return (
    <SafeAreaView style={styles.container}>
      <TopNav />
      <View style={styles.body}>
        <View style={styles.content}>
          <Text style={styles.title}>{t.customersTitle}</Text>
          <Text style={styles.subtitle}>{t.customersSubtitle}</Text>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>{t.totalLabel}</Text>
              <Text style={styles.statValue}>{totalCustomers}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>{t.pendingLabel}</Text>
              <Text style={styles.statValue}>{pendingCustomers}</Text>
            </View>
          </View>
          <View style={styles.listCard}>
            {customers.map((cust) => {
              const lastOrder = lastOrderByCustomer[cust.uid];
              return (
                <View key={cust.uid} style={styles.listRow}>
                  <View>
                    <Text style={styles.listPrimary}>{cust.name}</Text>
                    <Text style={styles.listSecondary}>{cust.phone}</Text>
                  </View>
                  <View style={styles.listRight}>
                    <Text style={styles.listStatus}>{cust.approved ? t.approved : t.pendingApproval}</Text>
                    <Text style={styles.listSecondary}>
                      {lastOrder ? new Date(lastOrder.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : t.noOrders2}
                    </Text>
                  </View>
                </View>
              );
            })}
            {customers.length === 0 ? (
              <Text style={styles.emptyText}>{t.noCustomers}</Text>
            ) : null}
          </View>
        </View>
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
    gap: 12,
    marginTop: 16,
    marginBottom: 16
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 14,
    boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.08)'
  },
  statLabel: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6
  },
  statValue: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800'
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
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: '#E5E7EB'
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
  listStatus: {
    color: '#0B61A4',
    fontWeight: '800',
    fontSize: 12
  },
  emptyText: {
    textAlign: 'center',
    color: '#6B7280',
    marginTop: 12
  }
});

export default OwnerCustomersScreen;
