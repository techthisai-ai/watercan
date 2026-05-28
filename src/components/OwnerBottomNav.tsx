import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { createShadow } from '../styles/shadows';
import { theme } from '../styles/theme';
import AppIcon from './AppIcon';

type TabKey = 'OwnerHome' | 'OwnerOrders' | 'OwnerApprovals' | 'OwnerInventory' | 'OwnerCustomers';

const tabs: Array<{ key: TabKey; label: string; icon: string; activeIcon: string }> = [
  { key: 'OwnerHome', label: 'Home', icon: 'grid-outline', activeIcon: 'grid' },
  { key: 'OwnerOrders', label: 'Orders', icon: 'cube-outline', activeIcon: 'cube' },
  { key: 'OwnerApprovals', label: 'Confirm', icon: 'checkmark-done-outline', activeIcon: 'checkmark-done' },
  { key: 'OwnerInventory', label: 'Stock', icon: 'layers-outline', activeIcon: 'layers' },
  { key: 'OwnerCustomers', label: 'Customers', icon: 'people-outline', activeIcon: 'people' }
];

const OwnerBottomNav = ({ active }: { active: TabKey }) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <Pressable key={tab.key} style={styles.item} onPress={() => navigation.navigate(tab.key)}>
            <View style={[styles.iconWrap, selected && styles.iconWrapSelected]}>
              <AppIcon
                name={selected ? tab.activeIcon : tab.icon}
                size={18}
                color={selected ? theme.colors.primary : theme.colors.textSecondary}
              />
            </View>
            <Text style={[styles.label, selected && styles.labelSelected]}>{tab.label}</Text>
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
    fontSize: 10,
    fontWeight: '700'
  },
  labelSelected: {
    color: theme.colors.primary
  }
});

export default OwnerBottomNav;
