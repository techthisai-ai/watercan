import React from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import AppIcon from '../components/AppIcon';
import { createShadow } from '../styles/shadows';
import { theme, typography } from '../styles/theme';

const LoadingScreen = () => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.orbLarge} />
      <View style={styles.orbSmall} />
      <View style={styles.card}>
        <View style={styles.brandRow}>
          <View style={styles.brandIcon}>
            <AppIcon name="water" size={24} color={theme.colors.primary} />
          </View>
          <View>
            <Text style={styles.brandText}>Thanni CAN</Text>
            <Text style={styles.brandSubtext}>Water delivery</Text>
          </View>
        </View>
        <ActivityIndicator size="small" color={theme.colors.primary} />
        <Text style={styles.text}>Loading your dashboard...</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background
  },
  orbLarge: {
    position: 'absolute',
    top: 80,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#E3F0FF'
  },
  orbSmall: {
    position: 'absolute',
    bottom: 120,
    left: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#EEF5FF'
  },
  card: {
    width: '84%',
    borderRadius: 28,
    padding: 24,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: theme.colors.stroke,
    alignItems: 'center',
    ...createShadow({ color: '#163456', opacity: 0.12, radius: 22, elevation: 8 })
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18
  },
  brandIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center'
  },
  brandText: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '800'
  },
  brandSubtext: {
    ...typography.caption,
    color: theme.colors.textSecondary
  },
  text: {
    marginTop: 16,
    color: theme.colors.textSecondary,
    fontSize: 15,
    fontWeight: '600'
  }
});

export default LoadingScreen;
