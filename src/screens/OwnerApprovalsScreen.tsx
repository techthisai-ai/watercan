import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { approveCustomer, fetchPendingCustomers, UserProfileData } from '../services/firebaseService';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import TopNav from '../components/TopNav';
import OwnerBottomNav from '../components/OwnerBottomNav';
import { useLang } from '../i18n/LanguageContext';

const OwnerApprovalsScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useLang();
  const [pending, setPending] = useState<UserProfileData[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPending = async () => {
    setLoading(true);
    try {
      const data = await fetchPendingCustomers();
      setPending(data);
    } catch (error: any) {
      Alert.alert(t.loadFailed, error.message || t.loadFailed);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPending();
  }, []);

  const handleApprove = async (userId: string) => {
    try {
      await approveCustomer(userId);
      setPending((items) => items.filter((item) => item.uid !== userId));
      Alert.alert(t.approvedAlert, t.approvedMsg);
    } catch (error: any) {
      Alert.alert(t.approvalFailed, error.message || t.approvalFailed);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <TopNav />
      <View style={styles.body}>
        <View style={styles.contentWrapper}>
          <View style={styles.header}>
            <Text style={styles.title}>{t.approvalsScreenTitle}</Text>
            <Text style={styles.subtitle}>{t.approvalsScreenSubtitle}</Text>
          </View>
          <FlatList
            data={pending}
            keyExtractor={(item) => item.uid}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={styles.emptyText}>{loading ? t.loading : t.noPendingCustomers}</Text>
            }
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.phone}>{item.phone}</Text>
                </View>
                <Pressable style={styles.approveButton} onPress={() => handleApprove(item.uid)}>
                  <Text style={styles.approveText}>{t.approve}</Text>
                </Pressable>
              </View>
            )}
          />
        </View>
      </View>
      <OwnerBottomNav active="OwnerApprovals" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5FBFF'
  },
  contentWrapper: {
    padding: 24
  },
  body: {
    flex: 1
  },
  header: {
    marginBottom: 16
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8
  },
  subtitle: {
    color: '#64748B',
    lineHeight: 22
  },
  list: {
    paddingBottom: 120
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0px 6px 18px rgba(0, 0, 0, 0.08)'
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A'
  },
  phone: {
    color: '#475569',
    marginTop: 6
  },
  approveButton: {
    backgroundColor: '#0EA5E9',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12
  },
  approveText: {
    color: 'white',
    fontWeight: '700'
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748B',
    marginTop: 40
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: 14
  },
  backText: {
    color: '#006289',
    fontWeight: '700'
  }
});

export default OwnerApprovalsScreen;
