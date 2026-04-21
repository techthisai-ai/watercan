import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthContext } from '../../App';
import CustomerHomeScreen from '../screens/CustomerHomeScreen';
import CustomerOrdersScreen from '../screens/CustomerOrdersScreen';
import CustomerSubscriptionScreen from '../screens/CustomerSubscriptionScreen';
import CustomerWalletScreen from '../screens/CustomerWalletScreen';
import LoadingScreen from '../screens/LoadingScreen';
import LoginScreen from '../screens/LoginScreen';
import NewOrderScreen from '../screens/NewOrderScreen';
import OrderConfirmedScreen from '../screens/OrderConfirmedScreen';
import OrderDetailsScreen from '../screens/OrderDetailsScreen';
import OrderTrackingScreen from '../screens/OrderTrackingScreen';
import OwnerApprovalsScreen from '../screens/OwnerApprovalsScreen';
import OwnerCustomersScreen from '../screens/OwnerCustomersScreen';
import OwnerHomeScreen from '../screens/OwnerHomeScreen';
import OwnerInventoryScreen from '../screens/OwnerInventoryScreen';
import OwnerOrdersScreen from '../screens/OwnerOrdersScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SignupScreen from '../screens/SignupScreen';

export type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  CustomerHome: undefined;
  CustomerOrders: undefined;
  CustomerSubscription: undefined;
  CustomerWallet: undefined;
  OwnerHome: undefined;
  NewOrder: { orderId?: string; reorder?: boolean } | undefined;
  OrderConfirmed: { orderId: string };
  OrderTracking: { orderId?: string } | undefined;
  OrderDetails: { orderId: string };
  Profile: undefined;
  OwnerOrders: undefined;
  OwnerApprovals: undefined;
  OwnerInventory: undefined;
  OwnerCustomers: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator = () => {
  const { user, profile, initializing } = useContext(AuthContext);

  if (initializing) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
          </>
        ) : profile?.role === 'owner' ? (
          <>
            <Stack.Screen name="OwnerHome" component={OwnerHomeScreen} />
            <Stack.Screen name="OwnerOrders" component={OwnerOrdersScreen} />
            <Stack.Screen name="OwnerApprovals" component={OwnerApprovalsScreen} />
            <Stack.Screen name="OwnerInventory" component={OwnerInventoryScreen} />
            <Stack.Screen name="OwnerCustomers" component={OwnerCustomersScreen} />
            <Stack.Screen name="OrderDetails" component={OrderDetailsScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="CustomerHome" component={CustomerHomeScreen} />
            <Stack.Screen name="CustomerOrders" component={CustomerOrdersScreen} />
            <Stack.Screen name="CustomerSubscription" component={CustomerSubscriptionScreen} />
            <Stack.Screen name="CustomerWallet" component={CustomerWalletScreen} />
            <Stack.Screen name="NewOrder" component={NewOrderScreen} />
            <Stack.Screen name="OrderConfirmed" component={OrderConfirmedScreen} />
            <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} />
            <Stack.Screen name="OrderDetails" component={OrderDetailsScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
