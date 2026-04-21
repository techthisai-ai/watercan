import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type PaymentOptionCardProps = {
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
};

const PaymentOptionCard = ({ title, subtitle, selected, onPress }: PaymentOptionCardProps) => {
  return (
    <Pressable style={[styles.card, selected && styles.cardSelected]} onPress={onPress}>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, selected && styles.titleSelected]}>{title}</Text>
        <Text style={[styles.subtitle, selected && styles.subtitleSelected]}>{subtitle}</Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FBFEFC',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#DCE8E0',
    flexDirection: 'row',
    alignItems: 'center'
  },
  cardSelected: {
    backgroundColor: '#E7F7EA',
    borderColor: '#1E7A45'
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#8DAA98',
    alignItems: 'center',
    justifyContent: 'center'
  },
  radioSelected: {
    borderColor: '#1E7A45'
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1E7A45'
  },
  content: {
    flex: 1,
    marginLeft: 14
  },
  title: {
    color: '#173726',
    fontSize: 16,
    fontWeight: '800'
  },
  titleSelected: {
    color: '#1E7A45'
  },
  subtitle: {
    marginTop: 4,
    color: '#6B8174',
    fontSize: 12,
    lineHeight: 18
  },
  subtitleSelected: {
    color: '#2E6644'
  }
});

export default PaymentOptionCard;
