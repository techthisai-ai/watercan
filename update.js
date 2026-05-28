const fs = require('fs');

let content = fs.readFileSync('src/screens/OwnerInventoryScreen.tsx', 'utf8');

const replacementJsx = `
  return (
    <SafeAreaView style={styles.container}>
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
              <Text style={styles.inputLabel}>Add Restock Qty</Text>
              <TextInput style={styles.input} keyboardType="numeric" placeholder="e.g. 50" value={singleRestockQty} onChangeText={setSingleRestockQty} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Purchase Price (\\u20B9)</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={singlePurchasePrice} onChangeText={setSinglePurchasePrice} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Sell Price (\\u20B9)</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={singleSellPrice} onChangeText={setSingleSellPrice} />
            </View>
            <Pressable style={styles.saveButton} onPress={handleSaveSingle} disabled={savingSingle}>
              {savingSingle ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>

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
              <Text style={styles.inputLabel}>Purchase Price (\\u20B9)</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={bulkPurchasePrice} onChangeText={setBulkPurchasePrice} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Sell Price (\\u20B9)</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={bulkSellPrice} onChangeText={setBulkSellPrice} />
            </View>
            <Pressable style={styles.saveButton} onPress={handleSaveBulk} disabled={savingBulk}>
              {savingBulk ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>

      <TopNav />
      <View style={styles.body}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>Inventory</Text>
              <Text style={styles.subtitle}>Track Single Can and Bulk Packet analytics separately</Text>
            </View>
          </View>
          
          {loadingAnalytics ? <Text style={styles.loadingInline}>Refreshing analytics...</Text> : null}

          <View style={styles.modeRow}>
            <Pressable style={[styles.modeCard, mode === 'single' && styles.modeCardSelected]} onPress={() => setMode('single')}>
              <Text style={[styles.modeTitle, mode === 'single' && styles.modeTitleSelected]}>Single Can</Text>
              <Text style={[styles.modeSub, mode === 'single' && styles.modeSubSelected]}>General can stock & revenue</Text>
            </Pressable>
            <Pressable style={[styles.modeCard, mode === 'bulk' && styles.modeCardSelected]} onPress={() => setMode('bulk')}>
              <Text style={[styles.modeTitle, mode === 'bulk' && styles.modeTitleSelected]}>Bulk Packet</Text>
              <Text style={[styles.modeSub, mode === 'bulk' && styles.modeSubSelected]}>Variant-wise packet analytics</Text>
            </Pressable>
          </View>

          {mode === 'single' ? (
            <View style={styles.manageSection}>
              <Pressable style={styles.manageButton} onPress={openSingleModal}>
                <Text style={styles.manageButtonText}>Manage Stock & Pricing</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.variantCard}>
              <View style={styles.variantHeaderRow}>
                <Text style={styles.sectionTitle}>Bulk Packet Size</Text>
              </View>
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
                {selectedVariants.length > 0 ? selectedVariants.map((variant) => (
                  <View key={variant.id} style={styles.variantItem}>
                    <View style={styles.variantItemInfo}>
                      <Text style={styles.variantItemName}>{variant.productName}</Text>
                      <Text style={styles.variantItemStock}>{variant.stockQty} packets in stock</Text>
                    </View>
                    <Pressable style={styles.editVariantBtn} onPress={() => openBulkModal(variant)}>
                      <Text style={styles.editVariantBtnText}>Adjust</Text>
                    </Pressable>
                  </View>
                )) : <Text style={styles.emptyText}>No variants found for this size.</Text>}
              </View>
            </View>
          )}

          <View style={styles.stockFilterHeader}>
            <Text style={styles.stockFilterTitle}>{mode === 'single' ? 'Single Can Analytics' : \`\${selectedSize} Analytics\`}</Text>
            <Text style={styles.stockFilterSubTitle}>
              {stockFilter === 'day' ? 'Today' : stockFilter === 'week' ? 'This week' : stockFilter === 'month' ? 'This month' : 'This year'}
            </Text>
          </View>
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
            <View style={styles.metricCard}><Text style={styles.label}>Total Stock</Text><Text style={styles.value}>{activeStats.stock}</Text></View>
            <View style={styles.metricCard}><Text style={styles.label}>Sold</Text><Text style={styles.value}>{activeStats.sold}</Text></View>
            <View style={styles.metricCard}><Text style={styles.label}>Available Stock</Text><Text style={[styles.value, activeStats.available <= 5 && styles.lowStockValue]}>{activeStats.available}</Text></View>
            <View style={styles.metricCard}><Text style={styles.label}>Purchase</Text><Text style={styles.value}>{\`\\u20B9\${Math.round(activeStats.purchase)}\`}</Text></View>
            <View style={styles.metricCard}><Text style={styles.label}>Revenue</Text><Text style={styles.value}>{\`\\u20B9\${Math.round(activeStats.revenue)}\`}</Text></View>
            <View style={styles.metricCard}><Text style={styles.label}>Cost</Text><Text style={styles.value}>{\`\\u20B9\${Math.round(activeStats.cost)}\`}</Text></View>
            <View style={styles.metricCard}><Text style={styles.label}>Profit</Text><Text style={[styles.value, activeStats.profit >= 0 ? styles.netPositive : styles.netNegative]}>{\`\\u20B9\${Math.round(activeStats.profit)}\`}</Text></View>
            <View style={styles.metricCard}><Text style={styles.label}>Sell Price</Text><Text style={styles.value}>{\`\\u20B9\${Math.round(activeStats.sell)}\`}</Text></View>
          </View>

          <View style={styles.pnlCard}>
            <Text style={styles.sectionTitle}>Profit & Loss Graph</Text>
            <View style={styles.graphWrap} onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)}>
              <View style={styles.graphBody}>
                <View style={styles.yAxisCol}>
                  {yTicks.map((tick, index) => <Text key={\`tick-\${index}\`} style={styles.yAxisText}>{\`\\u20B9\${tick}\`}</Text>)}
                </View>
                <View style={styles.plotArea}>
                  {yTicks.map((_, index) => <View key={\`grid-\${index}\`} style={styles.gridLine} />)}
                  <View style={styles.barsRow}>
                    {pnlData.points.map((point, index) => {
                      const profitHeight = Math.max((point.profit / maxYAxisValue) * 150, point.profit > 0 ? 6 : 0);
                      const lossHeight = Math.max((point.loss / maxYAxisValue) * 150, point.loss > 0 ? 6 : 0);
                      const animatedProfitHeight = chartAnim.interpolate({ inputRange: [0, 1], outputRange: [0, profitHeight] });
                      const animatedLossHeight = chartAnim.interpolate({ inputRange: [0, 1], outputRange: [0, lossHeight] });
                      
                      const isActive = activePoint?.index === index;
                      
                      return (
                        <Pressable key={point.key} style={styles.barGroup} onPress={() => setActivePoint(isActive ? null : { index, metric: point.profit >= point.loss ? 'profit' : 'loss' })}>
                          <View style={styles.barPair}>
                            <Animated.View style={[styles.graphBar, styles.graphBarProfit, isActive && styles.graphBarActive, { height: animatedProfitHeight }]} />
                            <Animated.View style={[styles.graphBar, styles.graphBarLoss, isActive && styles.graphBarActive, { height: animatedLossHeight }]} />
                          </View>
                          <Text style={styles.xAxisLabel}>{point.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>
              {activePoint && chartWidth > 0 ? (
                <View style={[styles.chartTooltip, { left: Math.max(52, Math.min(chartWidth - 120, 52 + ((chartWidth - 76) / Math.max(pnlData.points.length, 1)) * activePoint.index)) }]}>
                  <Text style={styles.chartTooltipTitle}>{pnlData.points[activePoint.index].label}</Text>
                  <Text style={styles.chartTooltipValue}>
                    {pnlData.points[activePoint.index].profit >= pnlData.points[activePoint.index].loss ? 'Profit' : 'Loss'}: {\`\\u20B9\${Math.round(pnlData.points[activePoint.index].profit >= pnlData.points[activePoint.index].loss ? pnlData.points[activePoint.index].profit : pnlData.points[activePoint.index].loss)}\`}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.metricRow}>
              <View style={styles.metricCard}><Text style={styles.label}>Revenue</Text><Text style={styles.value}>{\`\\u20B9\${Math.round(pnlData.revenueTotal)}\`}</Text></View>
              <View style={styles.metricCard}><Text style={styles.label}>Expense</Text><Text style={styles.value}>{\`\\u20B9\${Math.round(pnlData.expenseTotal)}\`}</Text></View>
              <View style={styles.metricCard}><Text style={styles.label}>Net</Text><Text style={[styles.value, pnlData.net >= 0 ? styles.netPositive : styles.netNegative]}>{\`\\u20B9\${Math.round(pnlData.net)}\`}</Text></View>
            </View>
          </View>

        </ScrollView>
      </View>
      <OwnerBottomNav active="OwnerInventory" />
    </SafeAreaView>
  );
};
`;

const startIndex = content.indexOf('  return (');
const endIndex = content.indexOf('const styles = StyleSheet.create({');

if (startIndex > -1 && endIndex > -1) {
  content = content.substring(0, startIndex) + replacementJsx + '\\n' + content.substring(endIndex);
  
  // Also inject new styles
  const newStyles = `
  manageSection: { marginTop: 16 },
  manageButton: { backgroundColor: '#0B61A4', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  manageButtonText: { color: 'white', fontWeight: '800', fontSize: 14 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: 'white', borderRadius: 22, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: '#0F172A', fontSize: 18, fontWeight: '900' },
  closeButton: { backgroundColor: '#EAF3FB', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  closeText: { color: '#0B61A4', fontWeight: '800', fontSize: 12 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { color: '#64748B', fontSize: 12, fontWeight: '800', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: '#0F172A', fontSize: 16, fontWeight: '600' },
  saveButton: { backgroundColor: '#0B61A4', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  saveButtonText: { color: 'white', fontWeight: '800', fontSize: 16 },
  variantHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  variantsList: { marginTop: 16, borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 10 },
  variantItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  variantItemInfo: { flex: 1 },
  variantItemName: { color: '#0F172A', fontSize: 14, fontWeight: '800' },
  variantItemStock: { color: '#64748B', fontSize: 12, marginTop: 2, fontWeight: '600' },
  editVariantBtn: { backgroundColor: '#EAF3FB', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  editVariantBtnText: { color: '#0B61A4', fontWeight: '800', fontSize: 12 },
`;

  // Make graphBar sleeker and add active styling
  content = content.replace(
    /graphBar: \{ width: 8, borderRadius: 8, minHeight: 0 \},/,
    "graphBar: { width: 14, borderRadius: 14, minHeight: 0, opacity: 0.9 },\\n  graphBarActive: { opacity: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },"
  );

  const styleEndIndex = content.lastIndexOf('});');
  if (styleEndIndex > -1) {
    content = content.substring(0, styleEndIndex) + newStyles + content.substring(styleEndIndex);
  }

  fs.writeFileSync('src/screens/OwnerInventoryScreen.tsx', content);
  console.log('Successfully updated OwnerInventoryScreen.tsx');
} else {
  console.log('Failed to find replace indices.');
}
