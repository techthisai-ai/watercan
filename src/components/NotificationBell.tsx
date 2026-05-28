import React, { useContext, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthContext } from '../../App';
import {
  NotificationRecord,
  subscribeToCustomerNotifications
} from '../services/firebaseService';
import { RootStackParamList } from '../navigation/AppNavigator';
import AppIcon from './AppIcon';

const NotificationBell = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { profile } = useContext(AuthContext);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);

  React.useEffect(() => {
    if (!profile?.uid) {
      setNotifications([]);
      return;
    }
    return subscribeToCustomerNotifications(profile.uid, setNotifications);
  }, [profile?.uid]);

  const unreadCount = useMemo(() => notifications.filter((item) => !item.read).length, [notifications]);

  return (
    <Pressable style={styles.bellBtn} onPress={() => navigation.navigate('CustomerNotifications')}>
      <AppIcon name="notifications-outline" size={20} color="#12314D" />
      {unreadCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  bellBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C9DFF2',
    alignItems: 'center',
    justifyContent: 'center'
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900'
  },
});

export default NotificationBell;
