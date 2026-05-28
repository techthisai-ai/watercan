import React, { useContext, useMemo, useRef, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AuthContext } from '../../App';
import AppIcon from '../components/AppIcon';
import ScreenHeader from '../components/ScreenHeader';
import { formatOrderNumber } from '../data/orderModule';
import {
  NotificationRecord,
  deleteNotification,
  markNotificationsAsRead,
  subscribeToCustomerNotifications
} from '../services/firebaseService';

const relativeTime = (timestamp: number) => {
  const diffMs = Date.now() - timestamp;
  const mins = Math.max(1, Math.floor(diffMs / 60000));
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

const CustomerNotificationsScreen = () => {
  const { profile } = useContext(AuthContext);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const markInFlightIdsRef = useRef<Set<string>>(new Set());

  React.useEffect(() => {
    if (!profile?.uid) {
      setNotifications([]);
      return;
    }
    return subscribeToCustomerNotifications(profile.uid, setNotifications);
  }, [profile?.uid]);

  React.useEffect(() => {
    const unreadIds = notifications
      .filter((n) => !n.read && !!n.id && !markInFlightIdsRef.current.has(n.id))
      .map((n) => n.id || '');
    if (unreadIds.length) {
      unreadIds.forEach((id) => markInFlightIdsRef.current.add(id));
      setNotifications((current) =>
        current.map((item) => (item.id && unreadIds.includes(item.id) ? { ...item, read: true } : item))
      );
      markNotificationsAsRead(unreadIds)
        .catch(() => {})
        .finally(() => {
          unreadIds.forEach((id) => markInFlightIdsRef.current.delete(id));
        });
    }
  }, [notifications]);

  const topNotifications = useMemo(() => notifications.slice(0, 100), [notifications]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader back title="Notifications" />
        {topNotifications.length === 0 ? (
          <View style={styles.emptyWrap}>
            <AppIcon name="notifications-off-outline" size={24} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptyText}>Order status updates will appear here.</Text>
          </View>
        ) : (
          topNotifications.map((notification) => (
            <View key={notification.id} style={[styles.item, !notification.read && styles.itemUnread]}>
              <View style={styles.itemHead}>
                <Text style={styles.itemOrder}>{`Order ${formatOrderNumber({ orderNumber: notification.orderNumber })}`}</Text>
                <Text style={styles.itemTime}>{relativeTime(notification.createdAt)}</Text>
              </View>
              <Text style={styles.itemMessage}>{notification.message}</Text>
              <Text style={styles.itemDate}>{new Date(notification.createdAt).toLocaleString()}</Text>
              <View style={styles.itemActions}>
                <View style={[styles.stateDot, notification.read ? styles.stateRead : styles.stateUnread]} />
                <Text style={styles.stateText}>{notification.read ? 'Read' : 'Unread'}</Text>
                <Pressable
                  style={styles.deleteBtn}
                  onPress={() => notification.id && deleteNotification(notification.id).catch(() => {})}
                >
                  <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F8FC' },
  content: { padding: 18, paddingBottom: 120 },
  item: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 12,
    marginBottom: 10
  },
  itemUnread: {
    backgroundColor: '#F0F7FF',
    borderColor: '#BFDBFE'
  },
  itemHead: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  itemOrder: { color: '#0F172A', fontSize: 14, fontWeight: '900' },
  itemTime: { color: '#64748B', fontSize: 11, fontWeight: '700' },
  itemMessage: { marginTop: 6, color: '#1E293B', fontSize: 13, fontWeight: '700' },
  itemDate: { marginTop: 5, color: '#94A3B8', fontSize: 11 },
  itemActions: { marginTop: 8, flexDirection: 'row', alignItems: 'center' },
  stateDot: { width: 8, height: 8, borderRadius: 4 },
  stateRead: { backgroundColor: '#94A3B8' },
  stateUnread: { backgroundColor: '#2563EB' },
  stateText: { marginLeft: 6, color: '#475569', fontSize: 11, fontWeight: '700' },
  deleteBtn: { marginLeft: 'auto' },
  deleteText: { color: '#B91C1C', fontSize: 11, fontWeight: '800' },
  emptyWrap: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 16
  },
  emptyTitle: { marginTop: 10, color: '#1E293B', fontSize: 15, fontWeight: '800' },
  emptyText: { marginTop: 6, color: '#64748B', fontSize: 12, fontWeight: '600' }
});

export default CustomerNotificationsScreen;
