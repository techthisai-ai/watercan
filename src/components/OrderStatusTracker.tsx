import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ORDER_STATUS_META, ORDER_STATUS_STEPS } from '../data/orderModule';
import { OrderStatus } from '../services/firebaseService';

type OrderStatusTrackerProps = {
  status: OrderStatus;
  compact?: boolean;
};

const OrderStatusTracker = ({ status, compact }: OrderStatusTrackerProps) => {
  const activeIndex = ORDER_STATUS_STEPS.findIndex((step) => step.id === status);

  if (status === 'cancelled') {
    return (
      <View style={styles.cancelledCard}>
        <Text style={styles.cancelledTitle}>Order cancelled</Text>
        <Text style={styles.cancelledText}>This order was cancelled before delivery.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      {ORDER_STATUS_STEPS.map((step, index) => {
        const isActive = index <= activeIndex;
        const meta = ORDER_STATUS_META[step.id];
        return (
          <View key={step.id} style={styles.stepRow}>
            <View style={styles.trackColumn}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: isActive ? meta.accent : '#D7E6F1'
                  }
                ]}
              />
              {index < ORDER_STATUS_STEPS.length - 1 ? (
                <View style={[styles.line, isActive && styles.lineActive]} />
              ) : null}
            </View>
            <View style={styles.textColumn}>
              <Text style={[styles.stepTitle, isActive && styles.stepTitleActive]}>
                {compact ? step.shortLabel : step.label}
              </Text>
              {!compact ? (
                <Text style={styles.stepSubtitle}>
                  {isActive ? 'Completed' : 'Waiting for update'}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 18
  },
  cardCompact: {
    paddingVertical: 10
  },
  stepRow: {
    flexDirection: 'row'
  },
  trackColumn: {
    width: 24,
    alignItems: 'center'
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginTop: 4
  },
  line: {
    width: 3,
    flex: 1,
    borderRadius: 999,
    backgroundColor: '#D7E6F1',
    marginVertical: 4
  },
  lineActive: {
    backgroundColor: '#7ED1F5'
  },
  textColumn: {
    flex: 1,
    paddingBottom: 14,
    paddingLeft: 10
  },
  stepTitle: {
    color: '#547185',
    fontSize: 16,
    fontWeight: '700'
  },
  stepTitleActive: {
    color: '#10324A'
  },
  stepSubtitle: {
    marginTop: 4,
    color: '#7B95A6',
    fontSize: 12
  },
  cancelledCard: {
    backgroundColor: '#FEE2E2',
    borderRadius: 24,
    padding: 18
  },
  cancelledTitle: {
    color: '#B42318',
    fontSize: 18,
    fontWeight: '800'
  },
  cancelledText: {
    marginTop: 6,
    color: '#B42318',
    fontSize: 13,
    lineHeight: 19
  }
});

export default OrderStatusTracker;
