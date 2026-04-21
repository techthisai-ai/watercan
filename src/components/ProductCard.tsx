import React from 'react';
import { Image, ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import { formatCurrency } from '../data/orderModule';
import { createShadow } from '../styles/shadows';

type ProductCardProps = {
  image: ImageSourcePropType;
  name: string;
  subtitle: string;
  pricePerCan: number;
  availableStock: number;
  lowStock: boolean;
};

const ProductCard = ({ image, name, subtitle, pricePerCan, availableStock, lowStock }: ProductCardProps) => {
  return (
    <View style={styles.card}>
      <View style={styles.imageWrap}>
        <Image source={image} style={styles.image} resizeMode="contain" />
      </View>
      <View style={styles.body}>
        <View style={styles.pricePill}>
          <Text style={styles.pricePillText}>{formatCurrency(pricePerCan)} / can</Text>
        </View>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Available stock</Text>
          <Text style={[styles.stockValue, lowStock && styles.lowStockValue]}>{availableStock} cans</Text>
        </View>
        {lowStock ? (
          <View style={styles.alertBox}>
            <Text style={styles.alertText}>Low stock alert. Order soon for same-day delivery.</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 28,
    padding: 18,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#D8ECFA',
    ...createShadow({ color: '#1277B3', opacity: 0.08, radius: 18, elevation: 5 })
  },
  imageWrap: {
    width: 108,
    height: 132,
    borderRadius: 24,
    backgroundColor: '#EAF7FF',
    alignItems: 'center',
    justifyContent: 'center'
  },
  image: {
    width: 88,
    height: 110
  },
  body: {
    flex: 1,
    marginLeft: 16
  },
  pricePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#0D8DD8',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  pricePillText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '800'
  },
  name: {
    marginTop: 12,
    color: '#10324A',
    fontSize: 20,
    fontWeight: '900'
  },
  subtitle: {
    marginTop: 6,
    color: '#5F7C91',
    fontSize: 13,
    lineHeight: 19
  },
  metaRow: {
    marginTop: 14
  },
  metaLabel: {
    color: '#6E8AA0',
    fontSize: 12,
    fontWeight: '700'
  },
  stockValue: {
    marginTop: 4,
    color: '#157347',
    fontSize: 16,
    fontWeight: '800'
  },
  lowStockValue: {
    color: '#C2410C'
  },
  alertBox: {
    marginTop: 12,
    backgroundColor: '#FFF4D6',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F5D58B'
  },
  alertText: {
    color: '#A15A00',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18
  }
});

export default ProductCard;
