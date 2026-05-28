import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { createShadow } from '../styles/shadows';
import { theme, typography } from '../styles/theme';
import AppIcon from './AppIcon';
import NotificationBell from './NotificationBell';

type Props = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  back?: boolean;
  profile?: boolean;
  notifications?: boolean;
  titleRight?: React.ReactNode;
};

const ScreenHeader = ({ eyebrow, title, subtitle, back, profile, notifications, titleRight }: Props) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const allowHeaderIcons = route.name === 'CustomerHome' || route.name === 'OwnerHome';
  const showBrandPill = allowHeaderIcons && !back;
  const showNotificationIcon = allowHeaderIcons && Boolean(notifications);
  const showProfileIcon = allowHeaderIcons && Boolean(profile);
  const showTopRow = Boolean(back || showBrandPill || showNotificationIcon || showProfileIcon);

  return (
    <View style={styles.wrap}>
      {showTopRow ? (
        <View style={styles.topRow}>
          {back ? (
            <Pressable style={styles.iconButton} onPress={() => navigation.goBack()}>
              <AppIcon name="chevron-back" size={20} color={theme.colors.text} />
            </Pressable>
          ) : showBrandPill ? (
            <View style={styles.brandPill}>
              <AppIcon name="water" size={16} color={theme.colors.primary} />
              <Text style={styles.brandText}>Thanni CAN</Text>
            </View>
          ) : (
            <View style={styles.placeholder} />
          )}
          <View style={styles.rightActions}>
            {showNotificationIcon ? <NotificationBell /> : null}
            {showProfileIcon ? (
              <Pressable style={styles.iconButton} onPress={() => navigation.navigate('Profile')}>
                <AppIcon name="person-circle-outline" size={22} color={theme.colors.text} />
              </Pressable>
            ) : null}
            {!showProfileIcon && !showNotificationIcon ? <View style={styles.placeholder} /> : null}
          </View>
        </View>
      ) : null}
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        {titleRight ? <View style={styles.titleRight}>{titleRight}</View> : null}
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 20
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  brandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: theme.colors.stroke,
    ...createShadow({ color: '#163456', opacity: 0.08, radius: 12, elevation: 3 })
  },
  brandText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700'
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: theme.colors.stroke,
    ...createShadow({ color: '#163456', opacity: 0.08, radius: 12, elevation: 3 })
  },
  placeholder: {
    width: 42,
    height: 42
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  eyebrow: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  title: {
    ...typography.title,
    color: theme.colors.text
  },
  titleRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10
  },
  titleRight: {
    flexShrink: 0
  },
  subtitle: {
    ...typography.body,
    color: theme.colors.textSecondary,
    marginTop: 8
  }
});

export default ScreenHeader;
