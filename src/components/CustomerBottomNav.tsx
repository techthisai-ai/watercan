import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { createShadow } from '../styles/shadows';
import { theme } from '../styles/theme';
import AppIcon from './AppIcon';

type CustomerBottomNavProps = {
  active: 'CustomerHome' | 'CustomerOrders' | 'CustomerPay' | 'CustomerWallet' | 'Profile';
};

const items = [
  { key: 'CustomerHome', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  { key: 'CustomerOrders', label: 'Orders', icon: 'receipt-outline', activeIcon: 'receipt' },
  { key: 'CustomerPay', label: 'Pay', icon: 'card-outline', activeIcon: 'card' },
  { key: 'CustomerWallet', label: 'Bottle', icon: 'wine-outline', activeIcon: 'wine' }
] as const;

const CustomerBottomNav = ({ active }: CustomerBottomNavProps) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const handleTabPress = (key: CustomerBottomNavProps['active']) => {
    if (key === active) {
      return;
    }
    navigation.navigate(key);
  };

  return (
    <View style={styles.container}>
      {items.map((item) => {
        const selected = item.key === active;
        return (
          <Pressable key={item.key} style={styles.item} onPress={() => handleTabPress(item.key)}>
            <View style={[styles.iconWrap, selected && styles.iconWrapSelected]}>
              <AppIcon
                name={selected ? item.activeIcon : item.icon}
                size={18}
                color={selected ? theme.colors.primary : theme.colors.textSecondary}
              />
            </View>
            <Text style={[styles.label, selected && styles.labelSelected]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 10,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 28,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: theme.colors.stroke,
    ...createShadow({ color: '#163456', opacity: 0.14, radius: 20, elevation: 10 })
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 6
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center'
  },
  iconWrapSelected: {
    backgroundColor: theme.colors.primarySoft
  },
  label: {
    color: theme.colors.textTertiary,
    fontSize: 11,
    fontWeight: '700'
  },
  labelSelected: {
    color: theme.colors.primary
  }
});

export default CustomerBottomNav;
