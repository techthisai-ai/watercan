import React, { useEffect, useState } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import TopNav from '../components/TopNav';
import OwnerBottomNav from '../components/OwnerBottomNav';
import { useLang } from '../i18n/LanguageContext';
import {
  addInventoryActivity,
  fetchInventoryActivity,
  fetchInventorySummary,
  fetchOwnerOrders,
  InventoryActivity,
  InventorySummary,
  OrderRecord,
  updateInventorySummary
} from '../services/firebaseService';

const OwnerInventoryScreen = () => {
  const { t } = useLang();
  const [inventory, setInventory] = useState<InventorySummary | null>(null);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [activities, setActivities] = useState<InventoryActivity[]>([]);
  const [addQty, setAddQty] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingStock, setEditingStock] = useState(false);
  const [totalStockText, setTotalStockText] = useState('');

  useEffect(() => {
    const loadData = async () => {
      const [inv, ord, act] = await Promise.all([
        fetchInventorySummary(),
        fetchOwnerOrders(),
        fetchInventoryActivity()
      ]);
      const restockLogged = act
        .filter((entry) => entry.type === 'restock')
        .reduce((sum, entry) => sum + entry.quantity, 0);
      const missingRestock = Math.max((inv.restockedCans ?? 0) - restockLogged, 0);

      if (missingRestock > 0) {
        const backfill = await addInventoryActivity({
          type: 'restock',
          quantity: missingRestock,
          createdAt: Date.now()
        });
        setActivities([backfill, ...act]);
      } else {
        setActivities(act);
      }
      setInventory(inv);
      setOrders(ord);
    };
    loadData();
  }, []);

  const soldCans = orders.reduce((sum, order) => sum + order.quantity, 0);
  const sellPrice = inventory?.sellPrice ?? 20;
  const purchasePrice = inventory?.purchasePrice ?? 12;
  const revenue = soldCans * sellPrice;
  const cost = soldCans * purchasePrice;
  const profit = revenue - cost;
  const openingStock = inventory?.openingStock ?? 0;
  const restocked = inventory?.restockedCans ?? 0;
  const totalStock = openingStock + restocked;
  const available = Math.max(totalStock - soldCans, 0);

  const handleEditTotalStock = async () => {
    const newTotal = parseInt(totalStockText, 10);
    if (!Number.isFinite(newTotal) || newTotal < 0) { setEditingStock(false); return; }
    setSaving(true);
    try {
      await updateInventorySummary({ openingStock: newTotal, restockedCans: 0 });
      setInventory((prev) => prev ? { ...prev, openingStock: newTotal, restockedCans: 0 } : prev);
      setEditingStock(false);
    } finally {
      setSaving(false);
    }
  };

  const handleAddStock = async () => {
    const qty = parseInt(addQty, 10);
    if (!Number.isFinite(qty) || qty <= 0) {
      return;
    }
    setSaving(true);
    const timestamp = Date.now();
    try {
      await updateInventorySummary({ restockedCans: restocked + qty });
      const activity = await addInventoryActivity({
        type: 'restock',
        quantity: qty,
        createdAt: timestamp
      });
      setInventory((prev) =>
        prev ? { ...prev, restockedCans: (prev.restockedCans ?? 0) + qty } : prev
      );
      setActivities((prev) => [activity, ...prev]);
      setAddQty('');
    } finally {
      setSaving(false);
    }
  };

  const activityWithBalance = () => {
    const chronological = [...activities].sort((a, b) => a.createdAt - b.createdAt);
    let running = openingStock;
    const mapped = chronological.map((activity) => {
      if (activity.type === 'restock') {
        running += activity.quantity;
      } else {
        running -= activity.quantity;
      }
      return { ...activity, availableAfter: Math.max(running, 0) };
    });
    return mapped.sort((a, b) => b.createdAt - a.createdAt);
  };

  const recentActivities = activityWithBalance().slice(0, 4);

  return (
    <SafeAreaView style={styles.container}>
      <TopNav />

      {/* Edit Total Stock Modal */}
      <Modal transparent visible={editingStock} animationType="fade" onRequestClose={() => setEditingStock(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t.totalStock}</Text>
            <Text style={styles.modalSubtitle}>Enter the new total stock value</Text>
            <TextInput
              style={styles.modalInput}
              value={totalStockText}
              onChangeText={(v) => setTotalStockText(v.replace(/[^0-9]/g, '').slice(0, 6))}
              keyboardType="numeric"
              autoFocus
              selectTextOnFocus
              placeholder="0"
              maxLength={6}
            />
            <View style={styles.modalBtnRow}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setEditingStock(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSaveBtn} onPress={handleEditTotalStock} disabled={saving}>
                <Text style={styles.modalSaveText}>{saving ? 'Saving...' : 'Save'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <View style={styles.body}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <Text style={styles.title}>{t.inventoryScreenTitle}</Text>
          <Text style={styles.subtitle}>{t.inventorySubtitle}</Text>
          <View style={styles.metricRow}>
            <View style={styles.metricCard}>
              <Text style={styles.label}>{t.totalStock}</Text>
              <Pressable onPress={() => { setTotalStockText(String(totalStock)); setEditingStock(true); }}>
                <Text style={styles.value}>{totalStock}</Text>
                <Text style={styles.editHint}>Tap to edit</Text>
              </Pressable>
              <Text style={styles.deltaText}>+{restocked} {t.add}ed</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.label}>{t.sold}</Text>
              <Text style={styles.value}>{soldCans}</Text>
              <Text style={styles.deltaText}>-{soldCans} used</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.label}>{t.available}</Text>
              <Text style={styles.value}>{available}</Text>
              <Text style={styles.deltaText}>{t.current}</Text>
            </View>
          </View>


          <View style={styles.metricRow}>
            <View style={styles.metricCard}>
              <Text style={styles.label}>{t.purchasePrice}</Text>
              <Text style={styles.value}>{`\u20B9${purchasePrice}`}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.label}>{t.sellPrice}</Text>
              <Text style={styles.value}>{`\u20B9${sellPrice}`}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.label}>{t.profit}</Text>
              <Text style={styles.value}>{`\u20B9${profit}`}</Text>
            </View>
          </View>

          <View style={styles.metricRow}>
            <View style={styles.metricCardWide}>
              <Text style={styles.label}>{t.revenueLabel}</Text>
              <Text style={styles.value}>{`\u20B9${revenue}`}</Text>
            </View>
            <View style={styles.metricCardWide}>
              <Text style={styles.label}>{t.cost}</Text>
              <Text style={styles.value}>{`\u20B9${cost}`}</Text>
            </View>
          </View>

          <View style={styles.recentCard}>
            <Text style={styles.sectionTitle}>{t.recentActivity}</Text>
            {recentActivities.map((activity) => {
              const isRestock = activity.type === 'restock';
              const sign = isRestock ? '+' : '-';
              const toneStyle = isRestock ? styles.recentTextPositive : styles.recentTextNegative;
              const label = isRestock ? t.stockAdded : activity.customerName ?? t.customer;
              const orderLabel = isRestock ? t.restock : `Order #${String(activity.orderNumber ?? 0).padStart(5, '0')}`;

              return (
                <View key={activity.id ?? activity.createdAt} style={styles.recentRow}>
                  <View>
                    <Text style={toneStyle}>
                      {sign} {activity.quantity} cans
                    </Text>
                    <Text style={styles.recentCustomer}>{label}</Text>
                  </View>
                  <View style={styles.recentRight}>
                    <Text style={styles.recentMeta}>Available: {activity.availableAfter}</Text>
                    <Text style={styles.recentMeta}>{orderLabel}</Text>
                  </View>
                </View>
              );
            })}
            {recentActivities.length === 0 ? <Text style={styles.emptyText}>{t.noActivity}</Text> : null}
          </View>
        </ScrollView>
      </View>
      <OwnerBottomNav active="OwnerInventory" />
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
  scroll: {
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
  metricRow: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 12
  },
  metricCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 14,
    boxShadow: '0px 6px 18px rgba(0, 0, 0, 0.08)'
  },
  metricCardWide: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 14,
    boxShadow: '0px 6px 18px rgba(0, 0, 0, 0.08)'
  },
  label: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6
  },
  value: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800'
  },
  deltaText: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 6
  },
  addStockCard: {
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 14,
    marginTop: 16,
    boxShadow: '0px 6px 18px rgba(0, 0, 0, 0.08)'
  },
  sectionTitle: {
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10
  },
  addRow: {
    flexDirection: 'row',
    gap: 10
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  addButton: {
    backgroundColor: '#0B61A4',
    borderRadius: 12,
    paddingHorizontal: 18,
    justifyContent: 'center'
  },
  addButtonText: {
    color: 'white',
    fontWeight: '800'
  },
  recentCard: {
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 14,
    marginTop: 16,
    boxShadow: '0px 6px 18px rgba(0, 0, 0, 0.08)'
  },
  recentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderColor: '#E5E7EB'
  },
  recentTextNegative: {
    fontWeight: '800',
    color: '#DC2626'
  },
  recentTextPositive: {
    fontWeight: '800',
    color: '#16A34A'
  },
  recentCustomer: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2
  },
  recentMeta: {
    color: '#64748B',
    fontSize: 12
  },
  recentRight: {
    alignItems: 'flex-end',
    gap: 2
  },
  emptyText: {
    color: '#64748B',
    marginTop: 8
  },
  editStockRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4
  },
  editStockInput: {
    flex: 1, borderWidth: 1, borderColor: '#0B61A4',
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6,
    fontSize: 18, fontWeight: '800', color: '#0F172A'
  },
  editStockSave: {
    backgroundColor: '#0B61A4', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8
  },
  editStockSaveText: { color: 'white', fontWeight: '900', fontSize: 16 },
  editHint: { color: '#0B61A4', fontSize: 11, marginTop: 2 },
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 24
  },
  modalCard: {
    backgroundColor: 'white', borderRadius: 24,
    padding: 24, width: '100%'
  },
  modalTitle: {
    fontSize: 20, fontWeight: '900', color: '#0F172A', marginBottom: 4
  },
  modalSubtitle: {
    fontSize: 13, color: '#64748B', marginBottom: 16
  },
  modalInput: {
    borderWidth: 1.5, borderColor: '#0B61A4', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 24, fontWeight: '800', color: '#0F172A',
    textAlign: 'center', marginBottom: 20
  },
  modalBtnRow: {
    flexDirection: 'row', gap: 12
  },
  modalCancelBtn: {
    flex: 1, borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB',
    paddingVertical: 14, alignItems: 'center'
  },
  modalCancelText: { color: '#64748B', fontWeight: '800', fontSize: 15 },
  modalSaveBtn: {
    flex: 1, borderRadius: 14, backgroundColor: '#0B61A4',
    paddingVertical: 14, alignItems: 'center'
  },
  modalSaveText: { color: 'white', fontWeight: '800', fontSize: 15 }
});

export default OwnerInventoryScreen;
