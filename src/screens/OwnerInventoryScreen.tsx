import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View, ActivityIndicator } from 'react-native';
import TopNav from '../components/TopNav';
import OwnerBottomNav from '../components/OwnerBottomNav';
import {
  adjustInventoryVariantStock,
  calculateStockOverview,
  fetchInventorySummary,
  fetchInventoryVariants,
  fetchOwnerOrders,
  ensureCanonicalBottlePrices,
  updateInventorySummary,
  InventorySummary,
  InventoryVariant,
  OrderRecord,
  updateInventoryVariant
} from '../services/firebaseService';

type InventoryMode = 'single' | 'bulk';
type StockFilter = 'day' | 'week' | 'month' | 'year';
type BulkSize = '300ml' | '500ml' | '1L';
type PnlPoint = { label: string; profit: number; loss: number; key: string };

const OwnerInventoryScreen = () => {
  const [inventory, setInventory] = useState<InventorySummary | null>(null);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [variants, setVariants] = useState<InventoryVariant[]>([]);
  const [mode, setMode] = useState<InventoryMode>('single');
  const [stockFilter, setStockFilter] = useState<StockFilter>('day');
  const [selectedSize, setSelectedSize] = useState<BulkSize>('300ml');
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [chartWidth, setChartWidth] = useState(0);
  const [activePoint, setActivePoint] = useState<{ index: number; metric: 'profit' | 'loss' } | null>(null);
  const [activeGraph, setActiveGraph] = useState<'pnl' | 'sales'>('pnl');

  // Single mode editing state
  const [singleModalVisible, setSingleModalVisible] = useState(false);
  const [singleTotalStock, setSingleTotalStock] = useState('');
  const [singlePurchasePrice, setSinglePurchasePrice] = useState('');
  const [singleSellPrice, setSingleSellPrice] = useState('');
  const [savingSingle, setSavingSingle] = useState(false);

  // Bulk mode editing state
  const [editingVariant, setEditingVariant] = useState<InventoryVariant | null>(null);
  const [bulkAddStock, setBulkAddStock] = useState('');
  const [bulkSellPrice, setBulkSellPrice] = useState('');
  const [savingBulk, setSavingBulk] = useState(false);
  const [bulkMetricsModalVisible, setBulkMetricsModalVisible] = useState(false);
  const [bulkTotalStock, setBulkTotalStock] = useState('');
  const [bulkPurchasePrice, setBulkPurchasePrice] = useState('');
  const [bulkMetricSellPrice, setBulkMetricSellPrice] = useState('');
  const [savingBulkMetrics, setSavingBulkMetrics] = useState(false);

  const chartAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const loadData = async () => {
        setLoadingAnalytics(true);
        await ensureCanonicalBottlePrices().catch(() => {});
        const [inv, ord, variantData] = await Promise.all([
          fetchInventorySummary(),
          fetchOwnerOrders(),
          fetchInventoryVariants().catch(() => [])
        ]);

        if (!active) return;
        setInventory(inv);
        setOrders(ord);
        setVariants(variantData);
        setLoadingAnalytics(false);
      };

      loadData();
      return () => {
        active = false;
      };
    }, [])
  );

  const getPeriodStart = useCallback((filter: StockFilter) => {
    const now = new Date();
    const from = new Date(now);
    if (filter === 'day') {
      from.setHours(0, 0, 0, 0);
    } else if (filter === 'week') {
      const mondayOffset = (from.getDay() + 6) % 7;
      from.setDate(now.getDate() - mondayOffset);
      from.setHours(0, 0, 0, 0);
    } else if (filter === 'month') {
      from.setDate(1);
      from.setHours(0, 0, 0, 0);
    } else {
      from.setMonth(0, 1);
      from.setHours(0, 0, 0, 0);
    }
    return from.getTime();
  }, []);

  const stockOverview = useMemo(() => calculateStockOverview(inventory, orders), [inventory, orders]);
  const purchasePrice = inventory?.purchasePrice ?? 12;
  const sellPrice = inventory?.sellPrice ?? 20;

  const singleOrders = useMemo(() => {
    const fromTs = getPeriodStart(stockFilter);
    return orders.filter(
      (order) =>
        order.orderType !== 'bulk' &&
        order.status !== 'cancelled' &&
        order.createdAt >= fromTs
    );
  }, [getPeriodStart, orders, stockFilter]);

  const singleStats = useMemo(() => {
    const soldQty = singleOrders.reduce((sum, order) => sum + order.quantity, 0);
    const revenue = singleOrders.reduce((sum, order) => sum + order.quantity * order.pricePerCan, 0);
    const cost = soldQty * purchasePrice;
    const profit = revenue - cost;
    const totalStock = Math.max(stockOverview.totalStock, 0);
    const availableStock = Math.max(totalStock - soldQty, 0);
    return {
      stock: totalStock,
      sold: soldQty,
      available: availableStock,
      purchase: purchasePrice,
      sell: sellPrice,
      revenue,
      cost,
      profit
    };
  }, [singleOrders, purchasePrice, sellPrice, stockOverview]);

  const selectedVariants = useMemo(
    () => variants.filter((variant) => variant.sizeName === selectedSize),
    [selectedSize, variants]
  );
  const selectedVariantIds = useMemo(() => new Set(selectedVariants.map((variant) => variant.id)), [selectedVariants]);

  const bulkOrders = useMemo(() => {
    const fromTs = getPeriodStart(stockFilter);
    return orders.filter((order) => {
      if (order.orderType !== 'bulk' || order.status === 'cancelled' || order.createdAt < fromTs) return false;
      if (order.variantId && selectedVariantIds.has(order.variantId)) return true;
      return (order.packName ?? '').toLowerCase().includes(selectedSize.toLowerCase());
    });
  }, [getPeriodStart, orders, selectedSize, selectedVariantIds, stockFilter]);

  const bulkStats = useMemo(() => {
    const stock = selectedVariants.reduce((sum, variant) => sum + variant.stockQty + variant.soldQty, 0);
    const sold = bulkOrders.reduce((sum, order) => sum + order.quantity, 0);
    const available = Math.max(stock - sold, 0);
    const revenue = bulkOrders.reduce((sum, order) => sum + order.quantity * order.pricePerCan, 0);
    const avgSell = sold > 0 ? revenue / sold : selectedVariants[0]?.pricePerCan ?? 0;
    const cost = sold * purchasePrice;
    const profit = revenue - cost;
    return {
      stock,
      sold,
      available,
      purchase: purchasePrice,
      sell: avgSell,
      revenue,
      cost,
      profit
    };
  }, [bulkOrders, purchasePrice, selectedVariants]);

  const activeOrders = mode === 'single' ? singleOrders : bulkOrders;
  const activeStats = mode === 'single' ? singleStats : bulkStats;

  const pnlData = useMemo(() => {
    const now = new Date();
    const dayLabels = ['12a', '4a', '8a', '12p', '4p', '8p'];
    const weekLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const yearLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let points: PnlPoint[] = [];
    let bucketForTimestamp: (timestamp: number) => number | null = () => null;

    if (stockFilter === 'day') {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const fromTs = start.getTime();
      points = dayLabels.map((label, index) => ({ label, profit: 0, loss: 0, key: `d-${index}` }));
      bucketForTimestamp = (timestamp) => {
        if (timestamp < fromTs) return null;
        const hour = new Date(timestamp).getHours();
        return Math.min(Math.floor(hour / 4), points.length - 1);
      };
    } else if (stockFilter === 'week') {
      const start = new Date(now);
      const mondayOffset = (start.getDay() + 6) % 7;
      start.setDate(now.getDate() - mondayOffset);
      start.setHours(0, 0, 0, 0);
      const fromTs = start.getTime();
      points = weekLabels.map((label, index) => ({ label, profit: 0, loss: 0, key: `w-${index}` }));
      bucketForTimestamp = (timestamp) => {
        if (timestamp < fromTs) return null;
        const startDay = new Date(fromTs);
        startDay.setHours(0, 0, 0, 0);
        const currentDay = new Date(timestamp);
        currentDay.setHours(0, 0, 0, 0);
        const diffDays = Math.round((currentDay.getTime() - startDay.getTime()) / (24 * 60 * 60 * 1000));
        return diffDays >= 0 && diffDays < points.length ? diffDays : null;
      };
    } else {
      if (stockFilter === 'month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const fromTs = start.getTime();
        const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        points = Array.from({ length: totalDays }, (_, index) => ({
          label: `${index + 1}`,
          profit: 0,
          loss: 0,
          key: `m-${index + 1}`
        }));
        bucketForTimestamp = (timestamp) => {
          if (timestamp < fromTs) return null;
          const day = new Date(timestamp).getDate() - 1;
          return day >= 0 && day < points.length ? day : null;
        };
      } else {
        const start = new Date(now.getFullYear(), 0, 1);
        const fromTs = start.getTime();
        points = yearLabels.map((label, index) => ({ label, profit: 0, loss: 0, key: `y-${index}` }));
        bucketForTimestamp = (timestamp) => {
          if (timestamp < fromTs) return null;
          return new Date(timestamp).getMonth();
        };
      }
    }

    let revenueTotal = 0;
    let expenseTotal = 0;
    let profitTotal = 0;
    let lossTotal = 0;

    activeOrders.forEach((order) => {
      const idx = bucketForTimestamp(order.createdAt);
      if (idx == null || !points[idx]) return;
      const revenue = order.quantity * order.pricePerCan;
      const cost = order.quantity * purchasePrice;
      const net = revenue - cost;
      revenueTotal += revenue;
      expenseTotal += cost;
      if (net >= 0) {
        profitTotal += net;
        points[idx].profit += net;
      } else {
        const loss = Math.abs(net);
        lossTotal += loss;
        points[idx].loss += loss;
      }
    });

    return {
      points,
      revenueTotal,
      expenseTotal,
      profitTotal,
      lossTotal,
      net: profitTotal - lossTotal
    };
  }, [activeOrders, purchasePrice, stockFilter]);

  const salesData = useMemo(() => {
    const now = new Date();
    const dayLabels = ['12a', '4a', '8a', '12p', '4p', '8p'];
    const weekLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const yearLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let points: Array<{ label: string; value: number; key: string }> = [];
    let bucketForTimestamp: (timestamp: number) => number | null = () => null;

    if (stockFilter === 'day') {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const fromTs = start.getTime();
      points = dayLabels.map((label, index) => ({ label, value: 0, key: `sd-${index}` }));
      bucketForTimestamp = (timestamp) => {
        if (timestamp < fromTs) return null;
        const hour = new Date(timestamp).getHours();
        return Math.min(Math.floor(hour / 4), points.length - 1);
      };
    } else if (stockFilter === 'week') {
      const start = new Date(now);
      const mondayOffset = (start.getDay() + 6) % 7;
      start.setDate(now.getDate() - mondayOffset);
      start.setHours(0, 0, 0, 0);
      const fromTs = start.getTime();
      points = weekLabels.map((label, index) => ({ label, value: 0, key: `sw-${index}` }));
      bucketForTimestamp = (timestamp) => {
        if (timestamp < fromTs) return null;
        const startDay = new Date(fromTs);
        startDay.setHours(0, 0, 0, 0);
        const currentDay = new Date(timestamp);
        currentDay.setHours(0, 0, 0, 0);
        const diffDays = Math.round((currentDay.getTime() - startDay.getTime()) / (24 * 60 * 60 * 1000));
        return diffDays >= 0 && diffDays < points.length ? diffDays : null;
      };
    } else if (stockFilter === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const fromTs = start.getTime();
      const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      points = Array.from({ length: totalDays }, (_, index) => ({
        label: `${index + 1}`,
        value: 0,
        key: `sm-${index + 1}`
      }));
      bucketForTimestamp = (timestamp) => {
        if (timestamp < fromTs) return null;
        const day = new Date(timestamp).getDate() - 1;
        return day >= 0 && day < points.length ? day : null;
      };
    } else {
      const start = new Date(now.getFullYear(), 0, 1);
      const fromTs = start.getTime();
      points = yearLabels.map((label, index) => ({ label, value: 0, key: `sy-${index}` }));
      bucketForTimestamp = (timestamp) => {
        if (timestamp < fromTs) return null;
        return new Date(timestamp).getMonth();
      };
    }

    activeOrders.forEach((order) => {
      const idx = bucketForTimestamp(order.createdAt);
      if (idx == null || !points[idx]) return;
      points[idx].value += order.quantity;
    });

    const maxValue = Math.max(...points.map((point) => point.value), 1);
    return { points, maxValue };
  }, [activeOrders, stockFilter]);

  const maxYAxisValue = Math.max(...pnlData.points.flatMap((point) => [point.profit, point.loss]), 1);
  const yTicks = [1, 0.75, 0.5, 0.25, 0].map((ratio) => Math.round(maxYAxisValue * ratio));

  useEffect(() => {
    chartAnim.setValue(0);
    Animated.timing(chartAnim, {
      toValue: 1,
      duration: 450,
      useNativeDriver: false
    }).start();
  }, [chartAnim, pnlData.points, stockFilter, mode, selectedSize]);

  const openSingleModal = () => {
    const currentTotalStock = Math.max((inventory?.openingStock ?? 0) + (inventory?.restockedCans ?? 0), 0);
    setSingleTotalStock(String(currentTotalStock));
    setSinglePurchasePrice(String(inventory?.purchasePrice || 12));
    setSingleSellPrice(String(inventory?.sellPrice || 20));
    setSingleModalVisible(true);
  };

  const handleSaveSingle = async () => {
    if (!inventory) return;
    setSavingSingle(true);
    try {
      const editedTotalStock = parseInt(singleTotalStock || String((inventory.openingStock ?? 0) + (inventory.restockedCans ?? 0)), 10);
      const newPurchase = parseFloat(singlePurchasePrice || String(inventory.purchasePrice));
      const newSell = parseFloat(singleSellPrice || String(inventory.sellPrice));
      
      const updates = {
        openingStock: Math.max(0, isNaN(editedTotalStock) ? (inventory.openingStock ?? 0) + (inventory.restockedCans ?? 0) : editedTotalStock),
        restockedCans: 0,
        purchasePrice: isNaN(newPurchase) ? inventory.purchasePrice : newPurchase,
        sellPrice: isNaN(newSell) ? inventory.sellPrice : newSell
      };
      
      await updateInventorySummary(updates);
      setInventory({ ...inventory, ...updates });
      setSingleModalVisible(false);
    } finally {
      setSavingSingle(false);
    }
  };

  const openBulkModal = (variant: InventoryVariant) => {
    setBulkAddStock('');
    setBulkSellPrice(String(variant.pricePerCan || 0));
    setEditingVariant(variant);
  };

  const handleSaveBulk = async () => {
    if (!editingVariant) return;
    setSavingBulk(true);
    try {
      const addStock = parseInt(bulkAddStock || '0', 10);
      const newSell = parseFloat(bulkSellPrice || String(editingVariant.pricePerCan));
      
      if (!isNaN(addStock) && addStock !== 0) {
        await adjustInventoryVariantStock(editingVariant.id, addStock, 0);
      }
      
      const updates: Partial<InventoryVariant> = {};
      if (!isNaN(newSell) && newSell !== editingVariant.pricePerCan) updates.pricePerCan = newSell;
      
      if (Object.keys(updates).length > 0) {
        await updateInventoryVariant(editingVariant.id, updates);
      }
      
      setVariants((prev) =>
        prev.map((v) =>
          v.id === editingVariant.id
            ? {
                ...v,
                ...updates,
                stockQty: v.stockQty + (isNaN(addStock) ? 0 : addStock)
              }
            : v
        )
      );
      setEditingVariant(null);
    } finally {
      setSavingBulk(false);
    }
  };

  const openBulkMetricsModal = () => {
    const currentBulkStock = selectedVariants.reduce((sum, variant) => sum + variant.stockQty, 0);
    setBulkTotalStock(String(currentBulkStock));
    setBulkPurchasePrice(String(purchasePrice));
    setBulkMetricSellPrice(String(Math.round(bulkStats.sell || 0)));
    setBulkMetricsModalVisible(true);
  };

  const handleSaveBulkMetrics = async () => {
    if (!selectedVariants.length) return;
    setSavingBulkMetrics(true);
    try {
      const parsedTotalStock = parseInt(bulkTotalStock || '0', 10);
      const parsedPurchase = parseFloat(bulkPurchasePrice || String(purchasePrice));
      const parsedSell = parseFloat(bulkMetricSellPrice || String(bulkStats.sell || 0));

      const currentBulkStock = selectedVariants.reduce((sum, variant) => sum + variant.stockQty, 0);
      const desiredStock = Math.max(0, isNaN(parsedTotalStock) ? currentBulkStock : parsedTotalStock);
      const stockDelta = desiredStock - currentBulkStock;

      if (stockDelta !== 0) {
        const targetVariant = selectedVariants[0];
        await adjustInventoryVariantStock(targetVariant.id, stockDelta, 0);
        setVariants((prev) =>
          prev.map((variant) =>
            variant.id === targetVariant.id
              ? { ...variant, stockQty: Math.max(0, variant.stockQty + stockDelta) }
              : variant
          )
        );
      }

      if (!isNaN(parsedSell)) {
        await Promise.all(selectedVariants.map((variant) => updateInventoryVariant(variant.id, { pricePerCan: parsedSell })));
        setVariants((prev) =>
          prev.map((variant) => (variant.sizeName === selectedSize ? { ...variant, pricePerCan: parsedSell } : variant))
        );
      }

      if (!isNaN(parsedPurchase)) {
        await updateInventorySummary({ purchasePrice: parsedPurchase });
        setInventory((prev) => (prev ? { ...prev, purchasePrice: parsedPurchase } : prev));
      }

      setBulkMetricsModalVisible(false);
    } finally {
      setSavingBulkMetrics(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Single Can Edit Modal */}
      <Modal visible={singleModalVisible} transparent animationType="fade" onRequestClose={() => setSingleModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Manage Single Can Stock</Text>
              <Pressable style={styles.closeButton} onPress={() => setSingleModalVisible(false)}>
                <Text style={styles.closeText}>Close</Text>
              </Pressable>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Total Stock</Text>
              <TextInput style={styles.input} keyboardType="numeric" placeholder="e.g. 210" value={singleTotalStock} onChangeText={setSingleTotalStock} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Purchase Price (₹)</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={singlePurchasePrice} onChangeText={setSinglePurchasePrice} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Sell Price (₹)</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={singleSellPrice} onChangeText={setSingleSellPrice} />
            </View>
            <Pressable style={styles.saveButton} onPress={handleSaveSingle} disabled={savingSingle}>
              {savingSingle ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Bulk Variant Edit Modal */}
      <Modal visible={!!editingVariant} transparent animationType="fade" onRequestClose={() => setEditingVariant(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit {editingVariant?.productName} ({editingVariant?.sizeName})</Text>
              <Pressable style={styles.closeButton} onPress={() => setEditingVariant(null)}>
                <Text style={styles.closeText}>Close</Text>
              </Pressable>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Add Stock Qty (Packets)</Text>
              <TextInput style={styles.input} keyboardType="numeric" placeholder="e.g. 10" value={bulkAddStock} onChangeText={setBulkAddStock} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Sell Price (₹)</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={bulkSellPrice} onChangeText={setBulkSellPrice} />
            </View>
            <Pressable style={styles.saveButton} onPress={handleSaveBulk} disabled={savingBulk}>
              {savingBulk ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>
      <Modal visible={bulkMetricsModalVisible} transparent animationType="fade" onRequestClose={() => setBulkMetricsModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit {selectedSize} Metrics</Text>
              <Pressable style={styles.closeButton} onPress={() => setBulkMetricsModalVisible(false)}>
                <Text style={styles.closeText}>Close</Text>
              </Pressable>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Total Stock</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={bulkTotalStock} onChangeText={setBulkTotalStock} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Purchase Price (₹)</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={bulkPurchasePrice} onChangeText={setBulkPurchasePrice} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Sell Price (₹)</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={bulkMetricSellPrice} onChangeText={setBulkMetricSellPrice} />
            </View>
            <Pressable style={styles.saveButton} onPress={handleSaveBulkMetrics} disabled={savingBulkMetrics}>
              {savingBulkMetrics ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>

      <TopNav />
      <View style={styles.body}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <Text style={styles.title}>Inventory</Text>
          {loadingAnalytics ? <Text style={styles.loadingInline}>Refreshing analytics...</Text> : null}

          <View style={styles.modeRow}>
            <Pressable style={[styles.modeCard, mode === 'single' && styles.modeCardSelected]} onPress={() => setMode('single')}>
              <Text style={[styles.modeTitle, mode === 'single' && styles.modeTitleSelected]}>Single Can</Text>
            </Pressable>
            <Pressable style={[styles.modeCard, mode === 'bulk' && styles.modeCardSelected]} onPress={() => setMode('bulk')}>
              <Text style={[styles.modeTitle, mode === 'bulk' && styles.modeTitleSelected]}>Bulk Packet</Text>
            </Pressable>
          </View>

          {mode === 'single' ? null : (
            <View style={styles.variantCard}>
              <View style={styles.sizeButtonRow}>
                {(['300ml', '500ml', '1L'] as BulkSize[]).map((size) => {
                  const selected = selectedSize === size;
                  return (
                    <Pressable
                      key={size}
                      style={[styles.sizeButton, selected && styles.sizeButtonSelected]}
                      onPress={() => setSelectedSize(size)}
                    >
                      <Text style={[styles.sizeButtonText, selected && styles.sizeButtonTextSelected]}>{size}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.variantsList}>
                {selectedVariants.length === 0 ? <Text style={styles.emptyText}>No variants found.</Text> : null}
              </View>
            </View>
          )}

          <View style={styles.stockFilterRow}>
            {(['day', 'week', 'month', 'year'] as StockFilter[]).map((option) => {
              const selected = stockFilter === option;
              return (
                <Pressable
                  key={option}
                  style={[styles.stockFilterChip, selected && styles.stockFilterChipSelected]}
                  onPress={() => setStockFilter(option)}
                >
                  <Text style={[styles.stockFilterChipText, selected && styles.stockFilterChipTextSelected]}>
                    {option === 'day' ? 'Day' : option === 'week' ? 'Week' : option === 'month' ? 'Month' : 'Year'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.metricGrid}>
            <Pressable style={[styles.metricCard, styles.editableMetricCard]} onPress={mode === 'single' ? openSingleModal : openBulkMetricsModal}>
              <Text style={styles.label}>Total Stock</Text>
              <Text style={styles.value}>{activeStats.stock}</Text>
              <Text style={styles.editHint}>Edit</Text>
            </Pressable>
            <View style={styles.metricCard}><Text style={styles.label}>Sold</Text><Text style={styles.value}>{activeStats.sold}</Text></View>
            <View style={styles.metricCard}>
              <Text style={styles.label}>Available Stock</Text>
              <Text style={[styles.value, activeStats.available <= 5 && styles.lowStockValue]}>{activeStats.available}</Text>
            </View>
            <Pressable style={[styles.metricCard, styles.editableMetricCard]} onPress={mode === 'single' ? openSingleModal : openBulkMetricsModal}>
              <Text style={styles.label}>Purchase</Text>
              <Text style={styles.value}>{`₹${Math.round(activeStats.purchase)}`}</Text>
              <Text style={styles.editHint}>Edit</Text>
            </Pressable>
            <View style={styles.metricCard}><Text style={styles.label}>Cost</Text><Text style={styles.value}>{`₹${Math.round(activeStats.cost)}`}</Text></View>
            <Pressable style={[styles.metricCard, styles.editableMetricCard]} onPress={mode === 'single' ? openSingleModal : openBulkMetricsModal}>
              <Text style={styles.label}>Sell Price</Text>
              <Text style={styles.value}>{`₹${Math.round(activeStats.sell)}`}</Text>
              <Text style={styles.editHint}>Edit</Text>
            </Pressable>
          </View>

          <View style={styles.pnlCard}>
            <View style={styles.graphHeaderRow}>
              <Text style={styles.sectionTitle}>Profit & Loss Graph</Text>
              <Pressable
                style={[styles.graphToggleButton, activeGraph === 'sales' && styles.graphToggleButtonActive]}
                onPress={() => {
                  setActivePoint(null);
                  setActiveGraph((prev) => (prev === 'pnl' ? 'sales' : 'pnl'));
                }}
              >
                <Text style={[styles.graphToggleText, activeGraph === 'sales' && styles.graphToggleTextActive]}>
                  {activeGraph === 'pnl' ? 'Can Sales' : 'P&L'}
                </Text>
              </Pressable>
            </View>
            <View style={styles.graphWrap} onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)}>
              <View style={styles.graphBody}>
                <View style={styles.yAxisCol}>
                  {activeGraph === 'pnl'
                    ? yTicks.map((tick, index) => <Text key={`tick-${index}`} style={styles.yAxisText}>{`₹${tick}`}</Text>)
                    : [1, 0.75, 0.5, 0.25, 0].map((ratio, index) => (
                        <Text key={`sales-tick-${index}`} style={styles.yAxisText}>
                          {Math.round(salesData.maxValue * ratio)}
                        </Text>
                      ))}
                </View>
                <View style={styles.plotArea}>
                  {yTicks.map((_, index) => <View key={`grid-${index}`} style={styles.gridLine} />)}
                  <View style={styles.barsRow}>
                    {(activeGraph === 'pnl' ? pnlData.points : salesData.points).map((point: any, index) => {
                      if (activeGraph === 'sales') {
                        const salesHeight = Math.max((point.value / salesData.maxValue) * 150, point.value > 0 ? 6 : 0);
                        const animatedSalesHeight = chartAnim.interpolate({ inputRange: [0, 1], outputRange: [0, salesHeight] });
                        const isActiveSales = activePoint?.index === index;
                        return (
                          <Pressable
                            key={point.key}
                            style={styles.barGroup}
                            onPress={() => setActivePoint(isActiveSales ? null : { index, metric: 'profit' })}
                          >
                            <View style={styles.barPair}>
                              {point.value > 0 ? (
                                <Animated.View style={[styles.graphBar, styles.graphBarProfit, isActiveSales && styles.graphBarActive, { height: animatedSalesHeight }]} />
                              ) : null}
                            </View>
                            <Text style={styles.xAxisLabel}>{point.label}</Text>
                          </Pressable>
                        );
                      }

                      const profitHeight = Math.max((point.profit / maxYAxisValue) * 150, point.profit > 0 ? 6 : 0);
                      const lossHeight = Math.max((point.loss / maxYAxisValue) * 150, point.loss > 0 ? 6 : 0);
                      const animatedProfitHeight = chartAnim.interpolate({ inputRange: [0, 1], outputRange: [0, profitHeight] });
                      const animatedLossHeight = chartAnim.interpolate({ inputRange: [0, 1], outputRange: [0, lossHeight] });
                      const isActive = activePoint?.index === index;

                      return (
                        <Pressable
                          key={point.key}
                          style={styles.barGroup}
                          onPress={() => setActivePoint(isActive ? null : { index, metric: point.profit >= point.loss ? 'profit' : 'loss' })}
                        >
                          <View style={styles.barPair}>
                            {point.profit > 0 ? (
                              <Animated.View style={[styles.graphBar, styles.graphBarProfit, isActive && styles.graphBarActive, { height: animatedProfitHeight }]} />
                            ) : null}
                            {point.loss > 0 ? (
                              <Animated.View style={[styles.graphBar, styles.graphBarLoss, isActive && styles.graphBarActive, { height: animatedLossHeight }]} />
                            ) : null}
                          </View>
                          <Text style={styles.xAxisLabel}>{point.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>
              {activePoint && chartWidth > 0 ? (
                <View style={[styles.chartTooltip, { left: Math.max(52, Math.min(chartWidth - 120, 52 + ((chartWidth - 76) / Math.max((activeGraph === 'pnl' ? pnlData.points : salesData.points).length, 1)) * activePoint.index)) }]}>
                  {activeGraph === 'pnl' ? (
                    <>
                      <Text style={styles.chartTooltipTitle}>{pnlData.points[activePoint.index].label}</Text>
                      <Text style={styles.chartTooltipValue}>
                        {pnlData.points[activePoint.index].profit >= pnlData.points[activePoint.index].loss ? 'Profit' : 'Loss'}: {`₹${Math.round(pnlData.points[activePoint.index].profit >= pnlData.points[activePoint.index].loss ? pnlData.points[activePoint.index].profit : pnlData.points[activePoint.index].loss)}`}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.chartTooltipTitle}>{salesData.points[activePoint.index].label}</Text>
                      <Text style={styles.chartTooltipValue}>Cans: {Math.round(salesData.points[activePoint.index].value)}</Text>
                    </>
                  )}
                </View>
              ) : null}
            </View>
            <View style={styles.metricRow}>
              <View style={[styles.metricCard, styles.metricCardHorizontal]}>
                <Text style={styles.label}>Revenue</Text>
                <Text style={[styles.value, styles.metricValueBelow]}>{`₹${Math.round(pnlData.revenueTotal)}`}</Text>
              </View>
              <View style={[styles.metricCard, styles.metricCardHorizontal]}>
                <Text style={styles.label}>Expense</Text>
                <Text style={[styles.value, styles.metricValueBelow]}>{`₹${Math.round(pnlData.expenseTotal)}`}</Text>
              </View>
              <View style={[styles.metricCard, styles.metricCardHorizontal]}>
                <Text style={styles.label}>Net</Text>
                <Text style={[styles.value, styles.metricValueBelow, pnlData.net >= 0 ? styles.netPositive : styles.netNegative]}>{`₹${Math.round(pnlData.net)}`}</Text>
              </View>
            </View>
          </View>

        </ScrollView>
      </View>
      <OwnerBottomNav active="OwnerInventory" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F8FF' },
  body: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 24, paddingBottom: 120 },
  title: { fontSize: 24, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  subtitle: { color: '#64748B' },
  loadingInline: { marginTop: 6, color: '#0B61A4', fontSize: 12, fontWeight: '700' },
  modeRow: { marginTop: 16, flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  modeCard: { flexGrow: 1, flexBasis: 140, backgroundColor: '#EAF3FB', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#D7E7F8', marginHorizontal: 2 },
  modeCardSelected: { backgroundColor: '#0B61A4', borderColor: '#0B61A4' },
  modeTitle: { fontSize: 14, fontWeight: '900', color: '#0F172A' },
  modeTitleSelected: { color: '#FFFFFF' },
  modeSub: { marginTop: 4, fontSize: 11, color: '#64748B', fontWeight: '700' },
  modeSubSelected: { color: '#DBEAFE' },
  sectionTitle: { fontWeight: '800', color: '#0F172A', marginBottom: 10 },
  graphHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  graphToggleButton: { borderRadius: 999, backgroundColor: '#EAF3FB', paddingHorizontal: 10, paddingVertical: 6 },
  graphToggleButtonActive: { backgroundColor: '#0B61A4' },
  graphToggleText: { color: '#0B61A4', fontSize: 11, fontWeight: '800' },
  graphToggleTextActive: { color: '#FFFFFF' },
  variantCard: { backgroundColor: 'white', borderRadius: 20, padding: 16, marginTop: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  sizeButtonRow: { flexDirection: 'row', gap: 10, marginTop: 6, flexWrap: 'wrap' },
  sizeButton: {
    borderRadius: 999,
    backgroundColor: '#EAF3FB',
    borderWidth: 1,
    borderColor: '#CFE2F5',
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  sizeButtonSelected: {
    backgroundColor: '#0B61A4',
    borderColor: '#0B61A4'
  },
  sizeButtonText: {
    color: '#12314D',
    fontSize: 13,
    fontWeight: '800'
  },
  sizeButtonTextSelected: {
    color: '#FFFFFF'
  },
  stockFilterHeader: { marginTop: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  stockFilterTitle: { color: '#0F172A', fontSize: 14, fontWeight: '800' },
  stockFilterSubTitle: { color: '#64748B', fontSize: 12, fontWeight: '700' },
  stockFilterRow: { marginTop: 10, flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  stockFilterChip: { borderRadius: 999, backgroundColor: '#EAF3FB', paddingHorizontal: 12, paddingVertical: 7 },
  stockFilterChipSelected: { backgroundColor: '#0B61A4' },
  stockFilterChipText: { color: '#0B61A4', fontSize: 12, fontWeight: '800' },
  stockFilterChipTextSelected: { color: '#FFFFFF' },
  metricRow: { marginTop: 12, flexDirection: 'row', gap: 8, flexWrap: 'nowrap' },
  metricGrid: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  metricCard: { width: '32%', marginBottom: 12, backgroundColor: 'white', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', minHeight: 92, position: 'relative' },
  metricCardHorizontal: { flex: 1, minWidth: 0, flexBasis: 0, flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', minHeight: 64 },
  metricValueBelow: { marginTop: 6 },
  editableMetricCard: { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1' },
  editHint: { position: 'absolute', bottom: 10, right: 10, color: '#0B61A4', fontSize: 10, fontWeight: '800' },
  label: { color: '#6B7280', fontSize: 12, fontWeight: '700', marginBottom: 6 },
  value: { color: '#0F172A', fontSize: 18, fontWeight: '800' },
  pnlCard: { backgroundColor: 'white', borderRadius: 20, padding: 16, marginTop: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  graphWrap: { position: 'relative', marginTop: 8, minHeight: 260, borderRadius: 16, backgroundColor: '#F9FBFF', borderWidth: 1, borderColor: '#E2E8F0', paddingLeft: 10, paddingRight: 14, paddingTop: 12, paddingBottom: 14, overflow: 'hidden' },
  graphBody: { flexDirection: 'row', alignItems: 'stretch' },
  yAxisCol: { width: 40, height: 180, justifyContent: 'space-between', paddingBottom: 20 },
  yAxisText: { color: '#64748B', fontSize: 10, fontWeight: '700' },
  plotArea: { flex: 1, height: 180, justifyContent: 'space-between', paddingLeft: 0, paddingRight: 0 },
  gridLine: { borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  barsRow: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 20 },
  barGroup: { alignItems: 'center', flex: 1, minWidth: 20 },
  barPair: { height: 150, width: 32, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 4 },
  graphBar: { width: 14, borderRadius: 14, minHeight: 0, opacity: 0.8 },
  graphBarActive: { opacity: 1, boxShadow: '0px 2px 3px rgba(15,23,42,0.15)', elevation: 3 },
  graphBarProfit: { backgroundColor: '#16A34A' },
  graphBarLoss: { backgroundColor: '#DC2626' },
  xAxisLabel: { marginTop: 6, color: '#475569', fontSize: 10, fontWeight: '700' },
  chartTooltip: { position: 'absolute', top: 8, width: 110, borderRadius: 10, backgroundColor: '#0F172A', paddingHorizontal: 10, paddingVertical: 8 },
  chartTooltipTitle: { color: '#E2E8F0', fontSize: 10, fontWeight: '700' },
  chartTooltipValue: { marginTop: 3, color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  netPositive: { color: '#16A34A' },
  netNegative: { color: '#DC2626' },
  lowStockValue: { color: '#DC2626' },
  emptyText: { color: '#64748B', marginTop: 8 },
  
  // New Styles
  manageSection: { marginTop: 16 },
  manageButton: { backgroundColor: '#0B61A4', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  manageButtonText: { color: 'white', fontWeight: '800', fontSize: 14 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: 'white', borderRadius: 22, padding: 20, boxShadow: '0px 10px 15px rgba(0,0,0,0.1)', elevation: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: '#0F172A', fontSize: 18, fontWeight: '900' },
  closeButton: { backgroundColor: '#EAF3FB', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  closeText: { color: '#0B61A4', fontWeight: '800', fontSize: 12 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { color: '#64748B', fontSize: 12, fontWeight: '800', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: '#0F172A', fontSize: 16, fontWeight: '600' },
  saveButton: { backgroundColor: '#0B61A4', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  saveButtonText: { color: 'white', fontWeight: '800', fontSize: 16 },
  variantsList: { marginTop: 16, borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 10 },
  variantItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  variantItemInfo: { flex: 1 },
  variantItemName: { color: '#0F172A', fontSize: 15, fontWeight: '800' },
  variantItemStock: { color: '#64748B', fontSize: 13, marginTop: 3, fontWeight: '600' },
  editVariantBtn: { backgroundColor: '#EAF3FB', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  editVariantBtnText: { color: '#0B61A4', fontWeight: '800', fontSize: 13 }
});

export default OwnerInventoryScreen;







