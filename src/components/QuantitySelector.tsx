import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatCurrency } from '../data/orderModule';
import { createShadow } from '../styles/shadows';

type QuantitySelectorProps = {
  quantity: number;
  onDecrease: () => void;
  onIncrease: () => void;
  totalAmount: number;
  pricePerCan: number;
  disabledDecrease?: boolean;
  disabledIncrease?: boolean;
};

const QuantitySelector = ({
  quantity,
  onDecrease,
  onIncrease,
  totalAmount,
  pricePerCan,
  disabledDecrease,
  disabledIncrease
}: QuantitySelectorProps) => {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Select quantity</Text>
        <Text style={styles.subtitle}>{formatCurrency(pricePerCan)} each</Text>
      </View>
      <View style={styles.row}>
        <Pressable
          style={[styles.button, disabledDecrease && styles.buttonDisabled]}
          onPress={onDecrease}
          disabled={disabledDecrease}
        >
          <Text style={styles.buttonText}>-</Text>
        </Pressable>
        <View style={styles.quantityBox}>
          <Text style={styles.quantityValue}>{quantity}</Text>
          <Text style={styles.quantityLabel}>Cans</Text>
        </View>
        <Pressable
          style={[styles.button, styles.buttonPrimary, disabledIncrease && styles.buttonDisabled]}
          onPress={onIncrease}
          disabled={disabledIncrease}
        >
          <Text style={styles.buttonText}>+</Text>
        </Pressable>
      </View>
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total price</Text>
        <Text style={styles.totalValue}>{formatCurrency(totalAmount)}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 18,
    ...createShadow({ color: '#106EA9', opacity: 0.06, radius: 16, elevation: 4 })
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  title: {
    color: '#10324A',
    fontSize: 18,
    fontWeight: '800'
  },
  subtitle: {
    color: '#6D8699',
    fontSize: 13,
    fontWeight: '700'
  },
  row: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  button: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: '#DDF1FF',
    alignItems: 'center',
    justifyContent: 'center'
  },
  buttonPrimary: {
    backgroundColor: '#0D8DD8'
  },
  buttonDisabled: {
    opacity: 0.45
  },
  buttonText: {
    color: '#10324A',
    fontSize: 30,
    fontWeight: '900'
  },
  quantityBox: {
    flex: 1,
    marginHorizontal: 14,
    borderRadius: 24,
    backgroundColor: '#F5FBFF',
    borderWidth: 1,
    borderColor: '#D8ECFA',
    alignItems: 'center',
    paddingVertical: 14
  },
  quantityValue: {
    color: '#10324A',
    fontSize: 34,
    fontWeight: '900'
  },
  quantityLabel: {
    color: '#6D8699',
    fontSize: 13,
    fontWeight: '700'
  },
  totalCard: {
    marginTop: 16,
    borderRadius: 20,
    backgroundColor: '#EAF7FF',
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  totalLabel: {
    color: '#0E5D8F',
    fontSize: 14,
    fontWeight: '700'
  },
  totalValue: {
    color: '#0E5D8F',
    fontSize: 22,
    fontWeight: '900'
  }
});

export default QuantitySelector;
