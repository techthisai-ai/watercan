import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ORDER_STATUS_META, ORDER_STATUS_STEPS } from '../data/orderModule';
import { OrderStatus } from '../services/firebaseService';

type OrderStatusTrackerProps = {
  status: OrderStatus;
  compact?: boolean;
};

const OrderStatusTracker = ({ status, compact }: OrderStatusTrackerProps) => {
  const displaySteps = ORDER_STATUS_STEPS.filter((step) => step.id !== 'preparing');
  const displayStatus = status === 'preparing' ? 'confirmed' : status;
  const activeIndex = displaySteps.findIndex((step) => step.id === displayStatus);

  if (status === 'cancelled') {
    return (
      <View style={styles.cancelledCard}>
        <Text style={styles.cancelledTitle}>Order cancelled</Text>
        <Text style={styles.cancelledText}>This order was cancelled before delivery.</Text>
      </View>
    );
  }

  const compactActiveIndex = displaySteps.findIndex((step) => step.id === displayStatus);

  if (compact) {
    return (
      <View style={[styles.card, styles.cardCompact]}>
        <View style={styles.compactRow}>
          {displaySteps.map((step, index) => {
            const isActive = index <= compactActiveIndex;
            const meta = ORDER_STATUS_META[step.id];
            const title =
              step.id === 'out_for_delivery'
                ? 'Out for\nDelivery'
                : step.shortLabel;

            return (
              <View key={step.id} style={styles.compactStep}>
                <View style={styles.compactTrackRow}>
                  <View
                    style={[
                      styles.dot,
                      styles.compactDot,
                      {
                        backgroundColor: isActive ? meta.accent : '#D7E6F1'
                      }
                    ]}
                  />
                </View>
                <Text style={[styles.compactTitle, isActive && styles.stepTitleActive]}>
                  {title}
                </Text>
              </View>
            );
          })}
          <View style={styles.compactLineLayer}>
            {displaySteps.slice(0, -1).map((step, index) => {
              const isActive = index < compactActiveIndex;
              return <View key={step.id} style={[styles.compactLine, isActive && styles.lineActive]} />;
            })}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {displaySteps.map((step, index) => {
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
              {index < displaySteps.length - 1 ? (
                <View style={[styles.line, isActive && styles.lineActive]} />
              ) : null}
            </View>
            <View style={styles.textColumn}>
              <Text style={[styles.stepTitle, isActive && styles.stepTitleActive]}>
                {step.label}
              </Text>
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
    paddingTop: 14,
    paddingBottom: 16,
    paddingHorizontal: 22
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    position: 'relative'
  },
  compactStep: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center'
  },
  compactTrackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    zIndex: 2
  },
  compactDot: {
    marginTop: 0,
    width: 16,
    height: 16,
    borderRadius: 8
  },
  compactLineLayer: {
    position: 'absolute',
    top: 7,
    left: '12.5%',
    right: '12.5%',
    flexDirection: 'row',
    zIndex: 1,
    pointerEvents: 'none'
  },
  compactLine: {
    flex: 1,
    height: 3,
    borderRadius: 999,
    backgroundColor: '#D7E6F1',
    marginHorizontal: 2
  },
  compactTitle: {
    marginTop: 8,
    color: '#547185',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 12,
    minHeight: 28,
    paddingHorizontal: 1,
    width: '100%'
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
    paddingBottom: 10,
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
