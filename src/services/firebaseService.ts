import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import {
  addDoc as liteAddDoc,
  collection as liteCollection,
  doc as liteDoc,
  getDoc as getLiteDoc,
  getDocs as getLiteDocs,
  getFirestore as getLiteFirestore,
  limit as liteLimit,
  orderBy as liteOrderBy,
  query as liteQuery,
  setDoc as liteSetDoc,
  where as liteWhere
} from 'firebase/firestore/lite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { Platform } from 'react-native';
import { auth, db, firebaseApp } from '../firebaseConfig';
const PHONE_LOGIN_PASSWORD = 'PhoneLogin#1';
const USER_PROFILE_CACHE_PREFIX = 'userProfile:';
const liteDb = Platform.OS === 'web' ? getLiteFirestore(firebaseApp) : null;
const localOnlyProfileUserIds = new Set<string>();

const normalizePhone = (phone: string) => phone.replace(/[^0-9+]/g, '');
const isPhoneLoginCredentialError = (code?: string) =>
  code === 'auth/user-not-found' || code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials';

const phoneToEmail = (phone: string) => {
  const normalized = normalizePhone(phone).replace(/^\+/, '');
  return `${normalized}@phone.local`;
};

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'pending';

export type DeliverySlot = 'Morning' | 'Afternoon' | 'Evening' | 'Express delivery';

export type OrderRecord = {
  id?: string;
  orderNumber?: number;
  customerId: string;
  ownerId?: string;
  customerName: string;
  phone?: string;
  address?: string;
  productName: string;
  quantity: number;
  pricePerCan: number;
  deliveryCharge: number;
  totalAmount: number;
  availableStock?: number;
  note?: string;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  paidAmount?: number;
  deliverySlot: DeliverySlot;
  expectedDeliveryTime?: string;
  subscription?: boolean;
  status: OrderStatus;
  createdAt: number;
  updatedAt: number;
};

export type UserProfileData = {
  uid: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  role: 'customer' | 'owner';
  approved: boolean;
};

export type InventorySummary = {
  openingStock: number;
  restockedCans: number;
  soldCans: number;
  purchasePrice: number;
  sellPrice: number;
};

export type InventoryActivity = {
  id?: string;
  type: 'restock' | 'order';
  quantity: number;
  createdAt: number;
  orderId?: string;
  orderNumber?: number;
  customerName?: string;
};

type CreateOrderInput = Omit<OrderRecord, 'id' | 'createdAt' | 'updatedAt' | 'status'>;
type UpdateOrderInput = Partial<
  Omit<OrderRecord, 'id' | 'createdAt' | 'updatedAt' | 'orderNumber' | 'status'>
>;

const getUserProfileCacheKey = (uid: string) => `${USER_PROFILE_CACHE_PREFIX}${uid}`;

const cacheUserProfile = async (profile: UserProfileData) => {
  await AsyncStorage.setItem(getUserProfileCacheKey(profile.uid), JSON.stringify(profile));
};

const clearCachedUserProfile = async (uid: string) => {
  await AsyncStorage.removeItem(getUserProfileCacheKey(uid));
};

const getCachedUserProfile = async (uid: string): Promise<UserProfileData | null> => {
  const cached = await AsyncStorage.getItem(getUserProfileCacheKey(uid));
  if (!cached) {
    return null;
  }

  try {
    return JSON.parse(cached) as UserProfileData;
  } catch {
    return null;
  }
};

const phoneFromEmail = (email?: string | null) => {
  if (!email?.endsWith('@phone.local')) {
    return '';
  }

  const raw = email.replace('@phone.local', '');
  if (raw.length === 12 && raw.startsWith('91')) {
    return `+${raw}`;
  }

  return raw ? `+${raw}` : '';
};

const buildFallbackUserProfile = (uid: string): UserProfileData | null => {
  const user = auth.currentUser;
  if (!user || user.uid !== uid) {
    return null;
  }

  const email = user.email ?? '';
  const derivedName = user.displayName?.trim() || (email.endsWith('@phone.local') ? 'Customer' : email.split('@')[0] || 'Customer');

  return {
    uid,
    name: derivedName,
    email,
    phone: phoneFromEmail(email),
    address: '',
    role: 'customer',
    approved: true
  };
};

const buildUpdatedCachedProfile = async (
  uid: string,
  updates: Partial<UserProfileData>
): Promise<UserProfileData | null> => {
  const cached = await getCachedUserProfile(uid);
  const baseProfile = cached ?? buildFallbackUserProfile(uid);
  if (!baseProfile) {
    return null;
  }

  return {
    ...baseProfile,
    ...updates,
    uid: baseProfile.uid,
    approved: updates.approved ?? baseProfile.approved
  };
};

const normalizeStatus = (status: string | undefined): OrderStatus => {
  switch (status) {
    case 'confirmed':
      return 'confirmed';
    case 'preparing':
      return 'preparing';
    case 'out_for_delivery':
    case 'dispatched':
      return 'out_for_delivery';
    case 'delivered':
      return 'delivered';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'pending';
  }
};

const normalizeOrderRecord = (id: string, data: Partial<OrderRecord>): OrderRecord => {
  const quantity = data.quantity ?? 0;
  const pricePerCan = data.pricePerCan ?? 20;
  const deliveryCharge = data.deliveryCharge ?? 0;
  const paidAmount = data.paidAmount ?? 0;
  const paymentMethod = data.paymentMethod ?? 'Cash on Delivery';
  const paymentStatus =
    data.paymentStatus ??
    (paymentMethod === 'Cash on Delivery' ? 'unpaid' : paidAmount > 0 ? 'paid' : 'pending');
  const totalAmount = data.totalAmount ?? quantity * pricePerCan + deliveryCharge;

  return {
    id,
    orderNumber: data.orderNumber ?? 0,
    customerId: data.customerId ?? '',
    ownerId: data.ownerId,
    customerName: data.customerName ?? 'Customer',
    phone: data.phone ?? '',
    address: data.address ?? '',
    productName: data.productName ?? '20L Drinking Water Can',
    quantity,
    pricePerCan,
    deliveryCharge,
    totalAmount,
    availableStock: data.availableStock ?? 0,
    note: data.note ?? '',
    paymentMethod,
    paymentStatus,
    paidAmount,
    deliverySlot: data.deliverySlot ?? 'Morning',
    expectedDeliveryTime: data.expectedDeliveryTime ?? 'Today, 30-45 min',
    subscription: data.subscription ?? false,
    status: normalizeStatus(data.status),
    createdAt: data.createdAt ?? Date.now(),
    updatedAt: data.updatedAt ?? data.createdAt ?? Date.now()
  };
};

export const onAuthStateChangedListener = (callback: (user: any) => void) => onAuthStateChanged(auth, callback);

export const signInWithPhone = async (phone: string) => {
  const email = phoneToEmail(phone);
  try {
    return await signInWithEmailAndPassword(auth, email, PHONE_LOGIN_PASSWORD);
  } catch (error: any) {
    const normalized = normalizePhone(phone).replace(/^\+/, '');
    if (isPhoneLoginCredentialError(error?.code) && normalized.length === 10) {
      const withCountry = `91${normalized}`;
      try {
        return await signInWithEmailAndPassword(auth, `${withCountry}@phone.local`, PHONE_LOGIN_PASSWORD);
      } catch (retryError: any) {
        if (isPhoneLoginCredentialError(retryError?.code)) {
          const notFoundError = new Error('Phone number not found');
          (notFoundError as Error & { code?: string }).code = 'auth/user-not-found';
          throw notFoundError;
        }
        throw retryError;
      }
    }
    if (isPhoneLoginCredentialError(error?.code)) {
      const notFoundError = new Error('Phone number not found');
      (notFoundError as Error & { code?: string }).code = 'auth/user-not-found';
      throw notFoundError;
    }
    throw error;
  }
};

export const registerUserWithPhone = async (name: string, phone: string, role: 'customer' | 'owner') => {
  const email = phoneToEmail(phone);
  const credential = await createUserWithEmailAndPassword(auth, email, PHONE_LOGIN_PASSWORD);
  const user = credential.user;
  if (!user) {
    throw new Error('Unable to create user account');
  }
  const profile: UserProfileData = {
    uid: user.uid,
    name,
    email,
    phone: normalizePhone(phone),
    address: '',
    role,
    approved: true
  };
  await setDoc(doc(db, 'users', user.uid), profile);
  await cacheUserProfile(profile);
  return profile;
};

const demoUsers = [
  { name: 'Sample Owner', phone: '+91 99000 02222', role: 'owner' as const, approved: true },
  { name: 'Sample Customer', phone: '+91 99000 01111', role: 'customer' as const, approved: false }
];

export const ensureDemoUsers = async () => {
  for (const demo of demoUsers) {
    const email = phoneToEmail(demo.phone);
    let user = auth.currentUser;
    if (!user || user.email !== email) {
      try {
        user = (await signInWithEmailAndPassword(auth, email, PHONE_LOGIN_PASSWORD)).user;
      } catch (error: any) {
        if (isPhoneLoginCredentialError(error?.code)) {
          user = (await createUserWithEmailAndPassword(auth, email, PHONE_LOGIN_PASSWORD)).user;
        } else {
          throw error;
        }
      }
    }

    if (user) {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          uid: user.uid,
          name: demo.name,
          email,
          phone: normalizePhone(demo.phone),
          address: '',
          role: demo.role,
          approved: demo.approved
        },
        { merge: true }
      );
    }
    await signOut(auth);
  }
};

export const signOutUser = async () => {
  const uid = auth.currentUser?.uid;
  if (uid) {
    localOnlyProfileUserIds.delete(uid);
    await clearCachedUserProfile(uid);
  }
  await signOut(auth);
};

export const getUserProfile = async (uid: string): Promise<UserProfileData | null> => {
  try {
    const snapshot =
      Platform.OS === 'web' && liteDb
        ? await getLiteDoc(liteDoc(liteDb, 'users', uid))
        : await getDoc(doc(db, 'users', uid));

    if (snapshot.exists()) {
      const profile = snapshot.data() as UserProfileData;
      await cacheUserProfile(profile);
      localOnlyProfileUserIds.delete(uid);
      return profile;
    }
  } catch {
    // fall through to cache
  }

  const cachedProfile = await getCachedUserProfile(uid);
  if (cachedProfile) return cachedProfile;

  const fallbackProfile = buildFallbackUserProfile(uid);
  if (fallbackProfile) {
    await cacheUserProfile(fallbackProfile);
    return fallbackProfile;
  }

  return null;
};

export const updateUserProfile = async (uid: string, updates: Partial<UserProfileData>) => {
  if (Platform.OS === 'web' && liteDb) {
    await liteSetDoc(liteDoc(liteDb, 'users', uid), updates, { merge: true });
  } else {
    await setDoc(doc(db, 'users', uid), updates, { merge: true });
  }
  const nextProfile = await buildUpdatedCachedProfile(uid, updates);
  if (nextProfile) {
    await cacheUserProfile(nextProfile);
  }
};

export const findAvailableOwner = async (): Promise<string | null> => {
  const querySnapshot =
    Platform.OS === 'web' && liteDb
      ? await getLiteDocs(liteQuery(liteCollection(liteDb, 'users'), liteWhere('role', '==', 'owner'), liteLimit(1)))
      : await getDocs(query(collection(db, 'users'), where('role', '==', 'owner'), limit(1)));
  return querySnapshot.empty ? null : querySnapshot.docs[0].id;
};

export const createOrder = async (order: CreateOrderInput) => {
  const timestamp = Date.now();
  let nextNumber = 1;

  if (Platform.OS === 'web' && liteDb) {
    const counterRef = liteDoc(liteDb, 'meta', 'orderCounter');
    const snap = await getLiteDoc(counterRef);
    if (!snap.exists()) {
      await liteSetDoc(counterRef, { value: 1 });
      nextNumber = 1;
    } else {
      nextNumber = (snap.data().value ?? 0) + 1;
      await liteSetDoc(counterRef, { value: nextNumber }, { merge: true });
    }
  } else {
    const counterRef = doc(db, 'meta', 'orderCounter');
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(counterRef);
      if (!snap.exists()) {
        tx.set(counterRef, { value: 1 });
        nextNumber = 1;
        return;
      }
      const current = snap.data().value ?? 0;
      nextNumber = current + 1;
      tx.update(counterRef, { value: nextNumber });
    });
  }

  const orderRecord: OrderRecord = {
    ...order,
    orderNumber: nextNumber,
    status: 'pending',
    createdAt: timestamp,
    updatedAt: timestamp
  };

  let orderId: string;
  if (Platform.OS === 'web' && liteDb) {
    const docRef = await liteAddDoc(liteCollection(liteDb, 'orders'), orderRecord);
    orderId = docRef.id;
    await liteAddDoc(liteCollection(liteDb, 'inventoryActivity'), {
      type: 'order',
      quantity: order.quantity,
      createdAt: timestamp,
      orderId,
      orderNumber: nextNumber,
      customerName: order.customerName
    });
    // Decrement stock
    const invRef = liteDoc(liteDb, 'inventory', 'summary');
    const invSnap = await getLiteDoc(invRef);
    if (invSnap.exists()) {
      const current = invSnap.data() as InventorySummary;
      const newSold = (current.soldCans ?? 0) + order.quantity;
      const newStock = Math.max(0, (current.openingStock ?? 0) + (current.restockedCans ?? 0) - newSold);
      await liteSetDoc(invRef, { soldCans: newSold, openingStock: newStock }, { merge: true });
    }
  } else {
    const docRef = await addDoc(collection(db, 'orders'), orderRecord);
    orderId = docRef.id;
    await addDoc(collection(db, 'inventoryActivity'), {
      type: 'order',
      quantity: order.quantity,
      createdAt: timestamp,
      orderId,
      orderNumber: nextNumber,
      customerName: order.customerName
    });
    // Decrement stock
    await runTransaction(db, async (tx) => {
      const invRef = doc(db, 'inventory', 'summary');
      const invSnap = await tx.get(invRef);
      if (invSnap.exists()) {
        const current = invSnap.data() as InventorySummary;
        const newSold = (current.soldCans ?? 0) + order.quantity;
        const newStock = Math.max(0, (current.openingStock ?? 0) + (current.restockedCans ?? 0) - newSold);
        tx.update(invRef, { soldCans: newSold, openingStock: newStock });
      }
    });
  }

  return { id: orderId, ...orderRecord };
};

export const updateOrder = async (orderId: string, updates: UpdateOrderInput) => {
  const payload = { ...updates, updatedAt: Date.now() };
  if (Platform.OS === 'web' && liteDb) {
    await liteSetDoc(liteDoc(liteDb, 'orders', orderId), payload, { merge: true });
  } else {
    await updateDoc(doc(db, 'orders', orderId), payload);
  }
};

export const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
  const payload = { status, updatedAt: Date.now() };
  if (Platform.OS === 'web' && liteDb) {
    await liteSetDoc(liteDoc(liteDb, 'orders', orderId), payload, { merge: true });
  } else {
    await updateDoc(doc(db, 'orders', orderId), payload);
  }
};

export const cancelOrder = async (orderId: string) => {
  await updateOrderStatus(orderId, 'cancelled');
};

// Auto-progress orders: pending→confirmed after 8h, confirmed→preparing after 2h,
// preparing→out_for_delivery after 2h, out_for_delivery→delivered after 2h
const AUTO_PROGRESS_MS: Partial<Record<OrderStatus, { next: OrderStatus; delay: number }>> = {
  pending:          { next: 'confirmed',        delay: 8 * 60 * 60 * 1000 },
  confirmed:        { next: 'preparing',        delay: 2 * 60 * 60 * 1000 },
  preparing:        { next: 'out_for_delivery', delay: 2 * 60 * 60 * 1000 },
  out_for_delivery: { next: 'delivered',        delay: 2 * 60 * 60 * 1000 },
};

export const autoProgressOrders = async (customerId: string) => {
  const orders = await fetchCustomerOrders(customerId).catch(() => []);
  const now = Date.now();
  for (const order of orders) {
    const rule = AUTO_PROGRESS_MS[order.status];
    if (!rule) continue;
    const elapsed = now - (order.updatedAt || order.createdAt);
    if (elapsed >= rule.delay) {
      await updateOrderStatus(order.id!, rule.next).catch(() => {});
    }
  }
};

export const deleteOrder = async (orderId: string) => {
  await deleteDoc(doc(db, 'orders', orderId));
};

const mapOrders = async (ordersQuery: ReturnType<typeof query>) => {
  const querySnapshot = await getDocs(ordersQuery);
  return querySnapshot.docs.map((docSnap) => normalizeOrderRecord(docSnap.id, docSnap.data() as Partial<OrderRecord>));
};

export const fetchCustomerOrders = async (customerId: string) => {
  if (Platform.OS === 'web' && liteDb) {
    const querySnapshot = await getLiteDocs(
      liteQuery(liteCollection(liteDb, 'orders'), liteWhere('customerId', '==', customerId))
    );
    return querySnapshot.docs
      .map((docSnap) => normalizeOrderRecord(docSnap.id, docSnap.data() as Partial<OrderRecord>))
      .sort((a, b) => b.createdAt - a.createdAt);
  }
  return mapOrders(query(collection(db, 'orders'), where('customerId', '==', customerId), orderBy('createdAt', 'desc')));
};

export const fetchOwnerOrders = async () => {
  if (Platform.OS === 'web' && liteDb) {
    const querySnapshot = await getLiteDocs(liteQuery(liteCollection(liteDb, 'orders')));
    return querySnapshot.docs
      .map((docSnap) => normalizeOrderRecord(docSnap.id, docSnap.data() as Partial<OrderRecord>))
      .sort((a, b) => b.createdAt - a.createdAt);
  }
  return mapOrders(query(collection(db, 'orders'), orderBy('createdAt', 'desc')));
};

export const getOrderById = async (orderId: string) => {
  const snapshot =
    Platform.OS === 'web' && liteDb
      ? await getLiteDoc(liteDoc(liteDb, 'orders', orderId))
      : await getDoc(doc(db, 'orders', orderId));
  return snapshot.exists() ? normalizeOrderRecord(snapshot.id, snapshot.data() as Partial<OrderRecord>) : null;
};

export const subscribeToOrder = (orderId: string, callback: (order: OrderRecord | null) => void) => {
  if (Platform.OS === 'web') {
    let active = true;

    const loadOrder = async () => {
      try {
        const order = await getOrderById(orderId);
        if (active) {
          callback(order);
        }
      } catch {
        if (active) {
          callback(null);
        }
      }
    };

    loadOrder();
    const intervalId = setInterval(loadOrder, 10000);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }

  return onSnapshot(doc(db, 'orders', orderId), (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }
    callback(normalizeOrderRecord(snapshot.id, snapshot.data() as Partial<OrderRecord>));
  });
};

export const fetchPendingCustomers = async () => {
  const querySnapshot =
    Platform.OS === 'web' && liteDb
      ? await getLiteDocs(
          liteQuery(liteCollection(liteDb, 'users'), liteWhere('role', '==', 'customer'), liteWhere('approved', '==', false))
        )
      : await getDocs(query(collection(db, 'users'), where('role', '==', 'customer'), where('approved', '==', false)));
  return querySnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as UserProfileData) }));
};

export const fetchCustomers = async () => {
  const querySnapshot =
    Platform.OS === 'web' && liteDb
      ? await getLiteDocs(liteQuery(liteCollection(liteDb, 'users'), liteWhere('role', '==', 'customer')))
      : await getDocs(query(collection(db, 'users'), where('role', '==', 'customer')));
  return querySnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as UserProfileData) }));
};

export const approveCustomer = async (userId: string) => {
  await updateDoc(doc(db, 'users', userId), { approved: true });
};

export const fetchInventorySummary = async (): Promise<InventorySummary> => {
  const snapshot =
    Platform.OS === 'web' && liteDb
      ? await getLiteDoc(liteDoc(liteDb, 'inventory', 'summary'))
      : await getDoc(doc(db, 'inventory', 'summary'));
  if (snapshot.exists()) {
    return snapshot.data() as InventorySummary;
  }

  const defaults: InventorySummary = {
    openingStock: 100,
    restockedCans: 0,
    soldCans: 0,
    purchasePrice: 12,
    sellPrice: 20
  };
  await setDoc(doc(db, 'inventory', 'summary'), defaults);
  return defaults;
};

export const updateInventorySummary = async (updates: Partial<InventorySummary>) => {
  await setDoc(doc(db, 'inventory', 'summary'), updates, { merge: true });
};

export const addInventoryActivity = async (activity: Omit<InventoryActivity, 'id'>) => {
  const docRef = await addDoc(collection(db, 'inventoryActivity'), activity);
  return { id: docRef.id, ...activity };
};

export const fetchInventoryActivity = async () => {
  if (Platform.OS === 'web' && liteDb) {
    const querySnapshot = await getLiteDocs(liteQuery(liteCollection(liteDb, 'inventoryActivity')));
    return querySnapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as InventoryActivity) }))
      .sort((a, b) => b.createdAt - a.createdAt);
  }
  const querySnapshot = await getDocs(query(collection(db, 'inventoryActivity'), orderBy('createdAt', 'desc')));
  return querySnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as InventoryActivity) }));
};

export type WalletTransaction = {
  id?: string;
  uid: string;
  type: 'credit' | 'debit';
  amount: number;
  title: string;
  status: 'success' | 'pending' | 'failed';
  orderId?: string;
  createdAt: number;
};

export const fetchWalletBalance = async (uid: string): Promise<number> => {
  const snapshot =
    Platform.OS === 'web' && liteDb
      ? await getLiteDoc(liteDoc(liteDb, 'wallets', uid))
      : await getDoc(doc(db, 'wallets', uid));
  if (snapshot.exists()) return (snapshot.data().balance as number) ?? 0;
  return 0;
};

export const rechargeWallet = async (uid: string, amount: number): Promise<number> => {
  const timestamp = Date.now();
  if (Platform.OS === 'web' && liteDb) {
    const walletRef = liteDoc(liteDb, 'wallets', uid);
    const snap = await getLiteDoc(walletRef);
    const current = snap.exists() ? (snap.data().balance as number) ?? 0 : 0;
    const newBalance = current + amount;
    await liteSetDoc(walletRef, { uid, balance: newBalance, updatedAt: timestamp }, { merge: true });
    await liteAddDoc(liteCollection(liteDb, 'walletTransactions'), {
      uid, type: 'credit', amount, title: 'Wallet Recharge',
      status: 'success', createdAt: timestamp
    });
    return newBalance;
  }
  const walletRef = doc(db, 'wallets', uid);
  let newBalance = amount;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(walletRef);
    const current = snap.exists() ? (snap.data().balance as number) ?? 0 : 0;
    newBalance = current + amount;
    tx.set(walletRef, { uid, balance: newBalance, updatedAt: timestamp }, { merge: true });
  });
  await addDoc(collection(db, 'walletTransactions'), {
    uid, type: 'credit', amount, title: 'Wallet Recharge',
    status: 'success', createdAt: timestamp
  });
  return newBalance;
};

export const fetchWalletTransactions = async (uid: string): Promise<WalletTransaction[]> => {
  if (Platform.OS === 'web' && liteDb) {
    const snap = await getLiteDocs(
      liteQuery(liteCollection(liteDb, 'walletTransactions'), liteWhere('uid', '==', uid))
    );
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as WalletTransaction) }))
      .sort((a, b) => b.createdAt - a.createdAt);
  }
  const snap = await getDocs(
    query(collection(db, 'walletTransactions'), where('uid', '==', uid), orderBy('createdAt', 'desc'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as WalletTransaction) }));
};

export type Review = {
  id?: string;
  uid: string;
  name: string;
  rating: number;
  createdAt: number;
};

export const submitReview = async (uid: string, name: string, rating: number): Promise<void> => {
  try {
    const payload: Omit<Review, 'id'> = { uid, name, rating, createdAt: Date.now() };
    if (Platform.OS === 'web' && liteDb) {
      await liteSetDoc(liteDoc(liteDb, 'reviews', uid), payload);
    } else {
      await setDoc(doc(db, 'reviews', uid), payload);
    }
  } catch {
    // silently ignore if rules block review writes
  }
};

export const fetchUserReview = async (uid: string): Promise<Review | null> => {
  try {
    const snapshot =
      Platform.OS === 'web' && liteDb
        ? await getLiteDoc(liteDoc(liteDb, 'reviews', uid))
        : await getDoc(doc(db, 'reviews', uid));
    return snapshot.exists() ? { id: snapshot.id, ...(snapshot.data() as Review) } : null;
  } catch {
    return null;
  }
};

export const fetchAllReviews = async (): Promise<Review[]> => {
  if (Platform.OS === 'web' && liteDb) {
    const snap = await getLiteDocs(liteQuery(liteCollection(liteDb, 'reviews')));
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Review) }))
      .sort((a, b) => b.createdAt - a.createdAt);
  }
  const snap = await getDocs(query(collection(db, 'reviews'), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Review) }));
};

export { auth };
