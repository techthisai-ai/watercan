import '../polyfills/url';

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import {
  collection as liteCollection,
  doc as liteDoc,
  getDoc as getLiteDoc,
  getDocs as getLiteDocs,
  getFirestore as getLiteFirestore,
  limit as liteLimit,
  orderBy as liteOrderBy,
  query as liteQuery,
  setDoc as liteSetDoc,
  where as liteWhere,
  writeBatch as liteWriteBatch
} from 'firebase/firestore/lite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fetchSignInMethodsForEmail,
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
  code === 'auth/user-not-found' ||
  code === 'auth/invalid-credential' ||
  code === 'auth/invalid-login-credentials' ||
  code === 'auth/wrong-password';

export const getFriendlyFirebaseAuthMessage = (error: unknown, flow: 'login' | 'signup' | 'profile' = 'login') => {
  const firebaseError = error as { code?: string; message?: string } | null;
  const code = firebaseError?.code;

  switch (code) {
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return flow === 'signup'
        ? 'This phone number is not ready to sign in yet.'
        : 'Phone number not found. Please sign up first.';
    case 'auth/email-already-in-use':
      return 'This phone number is already registered. Please sign in instead.';
    case 'auth/operation-not-allowed':
      return 'Enable Email/Password in Firebase Authentication. This app signs in phone numbers through Firebase email/password.';
    case 'auth/invalid-api-key':
    case 'auth/app-not-authorized':
    case 'auth/invalid-app-credential':
      return 'Firebase app settings do not match this build. Check the project config and Android app registration.';
    case 'auth/network-request-failed':
    case 'unavailable':
    case 'failed-precondition':
      return 'Unable to reach Firebase right now. Check your internet connection and Firebase project setup.';
    case 'permission-denied':
    case 'profile/forbidden':
      return 'Signed in, but the app cannot read this account profile. Check Firestore rules and the users collection.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    default:
      return firebaseError?.message || 'Unable to complete the Firebase request.';
  }
};

export const getFriendlyOrderMessage = (error: unknown) => {
  const firebaseError = error as { code?: string; message?: string } | null;
  const code = firebaseError?.code;

  switch (code) {
    case 'permission-denied':
      return 'Firebase blocked the order write. Check Firestore rules for orders, inventory, and meta.';
    case 'unavailable':
    case 'failed-precondition':
    case 'auth/network-request-failed':
      return 'Unable to place the order right now. Please check your connection and try again.';
    default:
      return firebaseError?.message || 'Unable to complete the order right now.';
  }
};

const phoneToEmail = (phone: string) => {
  const normalized = normalizePhone(phone).replace(/^\+/, '');
  return `${normalized}@phone.local`;
};

const toPhoneLoginIdentity = (phone: string) => {
  const normalized = normalizePhone(phone).replace(/^\+/, '');
  const withCountry = normalized.length === 10 ? `91${normalized}` : normalized;
  return {
    normalized,
    withCountry,
    primaryEmail: `${withCountry}@phone.local`,
    legacyEmail: `${normalized}@phone.local`
  };
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
export type OrderType = 'single' | 'bulk';

export type OrderRecord = {
  id?: string;
  orderNumber?: number;
  userId?: string;
  customerId: string;
  ownerId?: string;
  customerName: string;
  phone?: string;
  address?: string;
  productName: string;
  orderType?: OrderType;
  packName?: string;
  variantId?: string;
  variantSku?: string;
  variantSize?: string;
  cansPerPacket?: number;
  quantity: number;
  deliveredQuantity?: number;
  pendingQuantity?: number;
  pricePerCan: number;
  deliveryCharge: number;
  totalAmount: number;
  availableStock?: number;
  note?: string;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  paidAmount?: number;
  paymentApproved?: boolean;
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
  normalizedPhone?: string;
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
  availableStock?: number;
};

export type InventoryVariant = {
  id: string;
  productName: string;
  sizeName: string;
  sku: string;
  pricePerCan: number;
  cansPerPacket: number;
  stockQty: number;
  soldQty: number;
  lowStockThreshold: number;
  active: boolean;
  updatedAt: number;
};

export type StockOverview = {
  totalStock: number;
  soldCans: number;
  reservedCans: number;
  availableStock: number;
};

export type InventoryActivity = {
  id?: string;
  type: 'restock' | 'order' | 'cancel';
  inventoryType?: 'single' | 'bulk';
  variantId?: string;
  variantSize?: string;
  quantity: number;
  createdAt: number;
  orderId?: string;
  orderNumber?: number;
  customerName?: string;
};

export type NotificationRecord = {
  id?: string;
  customerId: string;
  orderId: string;
  orderNumber: number;
  status: 'out_for_delivery' | 'delivered';
  message: string;
  read: boolean;
  createdAt: number;
};

type CreateOrderInput = Omit<OrderRecord, 'id' | 'createdAt' | 'updatedAt' | 'status'>;
type UpdateOrderInput = Partial<
  Omit<OrderRecord, 'id' | 'createdAt' | 'updatedAt' | 'orderNumber' | 'status'>
>;

const isCashOnDelivery = (paymentMethod?: string) =>
  paymentMethod?.trim().toLowerCase() === 'cash on delivery';

const normalizeCreateOrderInput = (order: CreateOrderInput): CreateOrderInput => {
  // Ensure quantity and all numeric fields are stored as Number, never string
  const quantity = Math.max(1, Math.floor(Number(order.quantity)));
  const pricePerCan = Math.max(0, Number(order.pricePerCan ?? 0));
  const deliveryCharge = Math.max(0, Number(order.deliveryCharge ?? 0));
  const totalAmount = Math.max(0, Number(order.totalAmount ?? 0) || quantity * pricePerCan + deliveryCharge);
  const paidAmount = Math.max(0, Number(order.paidAmount ?? 0));

  const base = { ...order, quantity, pricePerCan, deliveryCharge, totalAmount, paidAmount };

  if (!isCashOnDelivery(order.paymentMethod)) {
    return base;
  }

  return {
    ...base,
    paymentMethod: 'Cash on Delivery',
    paymentStatus: 'unpaid',
    paidAmount: 0
  };
};

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

const normalizeUserProfileData = (profile: UserProfileData): UserProfileData => ({
  ...profile,
  role: ((profile.role as unknown as string) === 'admin' ? 'owner' : profile.role) as UserProfileData['role'],
  approved: ((profile.role as unknown as string) === 'admin' ? 'owner' : profile.role) === 'customer'
    ? true
    : profile.approved
});

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
    approved: baseProfile.role === 'customer' ? true : updates.approved ?? baseProfile.approved
  };
};

const findProfileByIdentity = async (phoneIdentity: ReturnType<typeof toPhoneLoginIdentity>) => {
  const candidateEmails = phoneIdentity.primaryEmail === phoneIdentity.legacyEmail
    ? [phoneIdentity.primaryEmail]
    : [phoneIdentity.primaryEmail, phoneIdentity.legacyEmail];
  const candidatePhones = [
    phoneIdentity.normalized,
    phoneIdentity.withCountry,
    `+${phoneIdentity.withCountry}`
  ];

  for (const email of candidateEmails) {
    const byEmailSnapshot =
      Platform.OS === 'web' && liteDb
        ? await getLiteDocs(liteQuery(liteCollection(liteDb, 'users'), liteWhere('email', '==', email), liteLimit(1)))
        : await getDocs(query(collection(db, 'users'), where('email', '==', email), limit(1)));
    if (!byEmailSnapshot.empty) {
      const docSnap: any = byEmailSnapshot.docs[0];
      return { id: docSnap.id, data: docSnap.data() as UserProfileData };
    }
  }

  for (const phone of candidatePhones) {
    const byPhoneSnapshot =
      Platform.OS === 'web' && liteDb
        ? await getLiteDocs(liteQuery(liteCollection(liteDb, 'users'), liteWhere('phone', '==', phone), liteLimit(1)))
        : await getDocs(query(collection(db, 'users'), where('phone', '==', phone), limit(1)));
    if (!byPhoneSnapshot.empty) {
      const docSnap: any = byPhoneSnapshot.docs[0];
      return { id: docSnap.id, data: docSnap.data() as UserProfileData };
    }
  }

  const byNormalizedPhoneSnapshot =
    Platform.OS === 'web' && liteDb
      ? await getLiteDocs(liteQuery(liteCollection(liteDb, 'users'), liteWhere('normalizedPhone', '==', phoneIdentity.withCountry), liteLimit(1)))
      : await getDocs(query(collection(db, 'users'), where('normalizedPhone', '==', phoneIdentity.withCountry), limit(1)));
  if (!byNormalizedPhoneSnapshot.empty) {
    const docSnap: any = byNormalizedPhoneSnapshot.docs[0];
    return { id: docSnap.id, data: docSnap.data() as UserProfileData };
  }

  return null;
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

const isInventoryCountedStatus = (status: OrderStatus) => status === 'delivered';

const normalizeOrderRecord = (id: string, data: Partial<OrderRecord>): OrderRecord => {
  // Always coerce to Number to guard against Firestore string values
  const quantity = Math.max(0, Math.floor(Number(data.quantity ?? 0)));
  const deliveredQuantityRaw = Number(
    data.deliveredQuantity != null
      ? data.deliveredQuantity
      : data.status === 'delivered'
        ? quantity
        : 0
  );
  const deliveredQuantity = Math.max(0, Math.min(quantity, Math.floor(deliveredQuantityRaw)));
  const pendingQuantityRaw = Number(
    data.pendingQuantity != null
      ? data.pendingQuantity
      : quantity - deliveredQuantity
  );
  const pendingQuantity = Math.max(0, Math.min(quantity, Math.floor(pendingQuantityRaw)));
  const pricePerCan = Math.max(0, Number(data.pricePerCan ?? 0) || 4.5);
  const deliveryCharge = Math.max(0, Number(data.deliveryCharge ?? 0));
  const paidAmount = Math.max(0, Number(data.paidAmount ?? 0));
  const paymentMethod = data.paymentMethod ?? 'Cash on Delivery';
  const paymentStatus =
    data.paymentStatus ??
    (paymentMethod === 'Cash on Delivery' ? 'unpaid' : paidAmount > 0 ? 'paid' : 'pending');
  const totalAmount = Math.max(0, Number(data.totalAmount ?? 0) || quantity * pricePerCan + deliveryCharge);

  return {
    id,
    orderNumber: Math.max(0, Math.floor(Number(data.orderNumber ?? 0))),
    userId: data.userId ?? data.customerId ?? '',
    customerId: data.customerId ?? '',
    ownerId: data.ownerId,
    customerName: data.customerName ?? 'Customer',
    phone: data.phone ?? '',
    address: data.address ?? '',
    productName: data.productName ?? '20L Drinking Water Can',
    orderType: data.orderType ?? 'single',
    packName: data.packName,
    variantId: data.variantId,
    variantSku: data.variantSku,
    variantSize: data.variantSize,
    cansPerPacket: data.cansPerPacket,
    quantity,
    deliveredQuantity,
    pendingQuantity,
    pricePerCan,
    deliveryCharge,
    totalAmount,
    availableStock: data.availableStock ?? 0,
    note: data.note ?? '',
    paymentMethod,
    paymentStatus,
    paidAmount,
    paymentApproved: data.paymentApproved ?? (data.paymentStatus === 'paid'),
    deliverySlot: data.deliverySlot ?? 'Morning',
    expectedDeliveryTime: data.expectedDeliveryTime ?? 'Today, 30-45 min',
    subscription: data.subscription ?? false,
    status: normalizeStatus(data.status),
    createdAt: data.createdAt ?? Date.now(),
    updatedAt: data.updatedAt ?? data.createdAt ?? Date.now()
  };
};

const defaultInventoryVariants: InventoryVariant[] = [
  {
    id: 'WB-300ML',
    productName: 'Water Bottle',
    sizeName: '300ml',
    sku: 'WB-300ML',
    pricePerCan: 5,
    cansPerPacket: 10,
    stockQty: 120,
    soldQty: 0,
    lowStockThreshold: 20,
    active: true,
    updatedAt: Date.now()
  },
  {
    id: 'WB-500ML',
    productName: 'Water Bottle',
    sizeName: '500ml',
    sku: 'WB-500ML',
    pricePerCan: 6,
    cansPerPacket: 10,
    stockQty: 80,
    soldQty: 0,
    lowStockThreshold: 20,
    active: true,
    updatedAt: Date.now()
  },
  {
    id: 'WB-1L',
    productName: 'Water Bottle',
    sizeName: '1L',
    sku: 'WB-1L',
    pricePerCan: 10,
    cansPerPacket: 10,
    stockQty: 60,
    soldQty: 0,
    lowStockThreshold: 15,
    active: true,
    updatedAt: Date.now()
  }
];

const normalizeInventoryVariant = (id: string, data: Partial<InventoryVariant>): InventoryVariant => ({
  id,
  productName: data.productName ?? 'Water Bottle',
  sizeName: data.sizeName ?? id,
  sku: data.sku ?? id,
  pricePerCan: Math.max(0, Number(data.pricePerCan ?? 0)),
  cansPerPacket: Math.max(1, Math.floor(Number(data.cansPerPacket ?? 1))),
  stockQty: Math.max(0, Math.floor(Number(data.stockQty ?? 0))),
  soldQty: Math.max(0, Math.floor(Number(data.soldQty ?? 0))),
  lowStockThreshold: Math.max(0, Math.floor(Number(data.lowStockThreshold ?? 10))),
  active: data.active ?? true,
  updatedAt: Number(data.updatedAt ?? Date.now())
});

const ensureDefaultInventoryVariants = async () => {
  const existing = await withRetry(async () =>
    Platform.OS === 'web' && liteDb
      ? await getLiteDocs(liteQuery(liteCollection(liteDb!, 'inventoryVariants')))
      : await getDocs(query(collection(db, 'inventoryVariants')))
  ).catch(() => ({ docs: [] } as any));
  const existingIds = new Set(existing.docs.map((docSnap: any) => docSnap.id));
  const missing = defaultInventoryVariants.filter((variant) => !existingIds.has(variant.id));
  if (missing.length === 0) return;
  const batch = writeBatch(db);
  missing.forEach((variant) => {
    batch.set(doc(db, 'inventoryVariants', variant.id), variant, { merge: true });
  });
  await batch.commit();
};

export const ensureCanonicalBottlePrices = async () => {
  const canonical: Record<string, number> = {
    'WB-300ML': 5,
    'WB-500ML': 6,
    'WB-1L': 10
  };
  const snap = await withRetry(async () =>
    Platform.OS === 'web' && liteDb
      ? await getLiteDocs(liteQuery(liteCollection(liteDb!, 'inventoryVariants')))
      : await getDocs(query(collection(db, 'inventoryVariants')))
  ).catch(() => ({ docs: [] } as any));
  const batch = writeBatch(db);
  let hasChanges = false;
  snap.docs.forEach((docSnap: any) => {
    const expected = canonical[docSnap.id];
    if (typeof expected !== 'number') return;
    const current = (docSnap.data() as Partial<InventoryVariant>).pricePerCan ?? 0;
    if (Math.abs(current - expected) > 0.000001) {
      hasChanges = true;
      batch.set(doc(db, 'inventoryVariants', docSnap.id), { pricePerCan: expected, updatedAt: Date.now() }, { merge: true });
    }
  });
  if (hasChanges) {
    await batch.commit();
    invalidateInventoryVariantsCache();
  }
};

export const fetchInventoryVariants = async (): Promise<InventoryVariant[]> => {
  const now = Date.now();
  if (inventoryVariantsCache && now - inventoryVariantsCache.at < FETCH_CACHE_MS) {
    return inventoryVariantsCache.data;
  }
  if (inventoryVariantsPromise) {
    return inventoryVariantsPromise;
  }
  inventoryVariantsPromise = (async () => {
  await ensureDefaultInventoryVariants().catch(() => {});
  const data = await withRetry(async () => {
    const snap =
      Platform.OS === 'web' && liteDb
        ? await getLiteDocs(liteQuery(liteCollection(liteDb!, 'inventoryVariants')))
        : await getDocs(query(collection(db, 'inventoryVariants')));
    return snap.docs
      .map((d) => normalizeInventoryVariant(d.id, d.data() as Partial<InventoryVariant>))
      .sort((a, b) => a.sizeName.localeCompare(b.sizeName));
  }).catch(() => []);
    inventoryVariantsCache = { at: Date.now(), data };
    return data;
  })();
  try {
    return await inventoryVariantsPromise;
  } finally {
    inventoryVariantsPromise = null;
  }
};

export const updateInventoryVariant = async (
  variantId: string,
  updates: Partial<Pick<InventoryVariant, 'stockQty' | 'soldQty' | 'pricePerCan' | 'cansPerPacket' | 'sizeName' | 'sku' | 'lowStockThreshold' | 'productName' | 'active'>>
) => {
  if (!variantId) {
    throw new Error('Variant id is required');
  }
  const payload = { ...updates, updatedAt: Date.now() };
  await setDoc(doc(db, 'inventoryVariants', variantId), payload, { merge: true });
  invalidateInventoryVariantsCache();
};

export const adjustInventoryVariantStock = async (
  variantId: string,
  stockDelta: number,
  soldDelta = 0
) => {
  if (!variantId) return;
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'inventoryVariants', variantId);
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      throw new Error('Variant not found');
    }
    const current = normalizeInventoryVariant(snap.id, snap.data() as Partial<InventoryVariant>);
    const nextStock = Math.max(0, current.stockQty + stockDelta);
    const nextSold = Math.max(0, current.soldQty + soldDelta);
    tx.set(ref, { stockQty: nextStock, soldQty: nextSold, updatedAt: Date.now() }, { merge: true });
  });
  invalidateInventoryVariantsCache();
};

export const onAuthStateChangedListener = (callback: (user: any) => void) => onAuthStateChanged(auth, callback);

export const signInWithPhone = async (phone: string) => {
  const identity = toPhoneLoginIdentity(phone);
  const dedupeKey = identity.withCountry;
  const existingTask = signInWithPhoneInFlight.get(dedupeKey);
  if (existingTask) {
    return existingTask;
  }

  const task = (async () => {
    const emails = identity.primaryEmail === identity.legacyEmail
      ? [identity.primaryEmail]
      : [identity.primaryEmail, identity.legacyEmail];
    const profileMatch = await findProfileByIdentity(identity).catch(() => null);
    const profileEmail = profileMatch?.data?.email;
    const loginEmails = Array.from(
      new Set([...(profileEmail ? [profileEmail] : []), ...emails].filter((v): v is string => !!v))
    );

    if (auth.currentUser?.email && loginEmails.includes(auth.currentUser.email)) {
      return { user: auth.currentUser };
    }

    for (const candidateEmail of loginEmails) {
      try {
        return await signInWithEmailAndPassword(auth, candidateEmail, PHONE_LOGIN_PASSWORD);
      } catch (error: any) {
        if (isPhoneLoginCredentialError(error?.code)) {
          continue;
        }
        throw error;
      }
    }

    if (profileMatch) {
      const existingAccountError = new Error('Account exists but sign-in failed');
      (existingAccountError as Error & { code?: string }).code = 'auth/invalid-credential';
      throw existingAccountError;
    }

    const notFoundError = new Error('Phone number not found');
    (notFoundError as Error & { code?: string }).code = 'auth/user-not-found';
    throw notFoundError;
  })();

  signInWithPhoneInFlight.set(dedupeKey, task);
  try {
    return await task;
  } finally {
    signInWithPhoneInFlight.delete(dedupeKey);
  }
};

export const registerUserWithPhone = async (name: string, phone: string, role: 'customer' | 'owner', address = '') => {
  const identity = toPhoneLoginIdentity(phone);
  const email = identity.primaryEmail;
  const dedupeKey = identity.withCountry;
  const existingTask = registerWithPhoneInFlight.get(dedupeKey);
  if (existingTask) {
    return existingTask;
  }

  const task = (async () => {
  let user = auth.currentUser;
  const acceptedEmails = identity.primaryEmail === identity.legacyEmail
    ? [identity.primaryEmail]
    : [identity.primaryEmail, identity.legacyEmail];
  if (!user || !acceptedEmails.includes(user.email ?? '')) {
    let signedIn = false;
    for (const candidateEmail of acceptedEmails) {
      const methods = await fetchSignInMethodsForEmail(auth, candidateEmail);
      if (methods.length > 0) {
        user = (await signInWithEmailAndPassword(auth, candidateEmail, PHONE_LOGIN_PASSWORD)).user;
        signedIn = true;
        break;
      }
    }
    if (!signedIn) {
      user = (await createUserWithEmailAndPassword(auth, email, PHONE_LOGIN_PASSWORD)).user;
    }
  }
  if (!user) {
    throw new Error('Unable to create user account');
  }
  const profile: UserProfileData = {
    uid: user.uid,
    name,
    email,
    phone: `+${identity.withCountry}`,
    normalizedPhone: identity.withCountry,
    address: address.trim(),
    role,
    approved: true
  };
  await setDoc(doc(db, 'users', user.uid), profile);
  await cacheUserProfile(profile);
  return profile;
  })();

  registerWithPhoneInFlight.set(dedupeKey, task);
  try {
    return await task;
  } finally {
    registerWithPhoneInFlight.delete(dedupeKey);
  }
};

const demoUsers = [
  { name: 'Sample Owner', phone: '+91 99000 02222', role: 'owner' as const, approved: true },
  { name: 'Sample Customer', phone: '+91 99000 01111', role: 'customer' as const, approved: true }
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
          normalizedPhone: toPhoneLoginIdentity(demo.phone).withCountry,
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
  if (Platform.OS === 'web') {
    const cachedProfile = await getCachedUserProfile(uid);
    if (cachedProfile) {
      return normalizeUserProfileData(cachedProfile);
    }
  }

  try {
    const snapshot = await withRetry(async () =>
      Platform.OS === 'web' && liteDb
        ? await getLiteDoc(liteDoc(liteDb!, 'users', uid))
        : await getDoc(doc(db, 'users', uid))
    );

    if (snapshot.exists()) {
      const profile = normalizeUserProfileData({ ...(snapshot.data() as UserProfileData), uid });
      await cacheUserProfile(profile);
      localOnlyProfileUserIds.delete(uid);
      return profile;
    }
    if (!snapshot.exists() && auth.currentUser?.email?.endsWith('@phone.local')) {
      const identity = toPhoneLoginIdentity(auth.currentUser.email.replace('@phone.local', ''));
      const matched = await findProfileByIdentity(identity);
      if (matched) {
        const restored: UserProfileData = normalizeUserProfileData({
          ...matched.data,
          uid
        } as UserProfileData);
        await setDoc(doc(db, 'users', uid), restored, { merge: true }).catch(() => {});
        await cacheUserProfile(restored);
        return restored;
      }
    }
  } catch {
    const cachedProfile = await getCachedUserProfile(uid);
    if (cachedProfile) {
      return normalizeUserProfileData(cachedProfile);
    }
  }

  const fallbackProfile = buildFallbackUserProfile(uid);
  if (fallbackProfile) {
    const profile = normalizeUserProfileData(fallbackProfile);
    await cacheUserProfile(profile);
    return profile;
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
  invalidateCustomersCache();
};

export const findAvailableOwner = async (): Promise<string | null> => {
  const querySnapshot =
    Platform.OS === 'web' && liteDb
      ? await getLiteDocs(liteQuery(liteCollection(liteDb, 'users'), liteWhere('role', '==', 'owner'), liteLimit(1)))
      : await getDocs(query(collection(db, 'users'), where('role', '==', 'owner'), limit(1)));
  return querySnapshot.empty ? null : querySnapshot.docs[0].id;
};

const normalizeOrderNumberValue = (value: unknown) => {
  const numberValue = Number(value);
  // Accept any positive integer — no upper cap that could reset the counter
  return Number.isFinite(numberValue) && numberValue > 0 ? Math.floor(numberValue) : 0;
};

const normalizeInventoryStockValue = (value: unknown) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.max(0, Math.floor(numberValue)) : 0;
};

const getAvailableStockFromInventorySummary = (data: Partial<InventorySummary> & { availableStock?: unknown }) => {
  const explicitAvailable = Number(data.availableStock);
  if (Number.isFinite(explicitAvailable)) {
    return Math.max(0, Math.floor(explicitAvailable));
  }
  const openingStock = normalizeInventoryStockValue(data.openingStock);
  const restockedCans = normalizeInventoryStockValue(data.restockedCans);
  const soldCans = normalizeInventoryStockValue(data.soldCans);
  return Math.max(0, openingStock + restockedCans - soldCans);
};

const INVENTORY_SUMMARY_DEFAULTS: InventorySummary = {
  availableStock: 100,
  openingStock: 100,
  restockedCans: 0,
  soldCans: 0,
  purchasePrice: 12,
  sellPrice: 20
};

const ensureCoreFirestoreDocs = async () => {
  // On web, avoid client-side bootstrap reads/writes that are often blocked by Firestore rules
  // and cause repeated 403 (Forbidden) network noise.
  if (Platform.OS === 'web') {
    return;
  }

  const now = Date.now();
  const inventoryRef = doc(db, 'inventory', 'summary');
  const counterRef = doc(db, 'meta', 'orderCounter');
  const [invSnap, counterSnap] = await Promise.all([getDoc(inventoryRef), getDoc(counterRef)]);
  if (!invSnap.exists()) {
    await setDoc(inventoryRef, INVENTORY_SUMMARY_DEFAULTS, { merge: true });
  }
  if (!counterSnap.exists()) {
    await setDoc(counterRef, { lastOrderNumber: 0, updatedAt: now }, { merge: true });
  } else {
    const storedNumber = normalizeOrderNumberValue((counterSnap.data() as { lastOrderNumber?: number }).lastOrderNumber);
    if (storedNumber === 1000) {
      await setDoc(counterRef, { lastOrderNumber: 0, updatedAt: now }, { merge: true });
    }
  }
};

export const ensureInitialFirestoreData = async () => {
  await ensureCoreFirestoreDocs();
};

const notificationDocId = (customerId: string, orderId: string, status: 'out_for_delivery' | 'delivered') =>
  `${customerId}_${orderId}_${status}`;

const getCustomerIdFromNotificationId = (notificationId: string) => {
  if (!notificationId) {
    return '';
  }
  const idx = notificationId.indexOf('_');
  return idx > 0 ? notificationId.slice(0, idx) : '';
};

const emitCustomerNotifications = (customerId: string, list: NotificationRecord[]) => {
  const normalized = [...list].sort((a, b) => b.createdAt - a.createdAt).slice(0, CUSTOMER_NOTIFICATIONS_QUERY_LIMIT);
  customerNotificationsCache.set(customerId, { at: Date.now(), data: normalized });
  customerNotificationSubscribers.get(customerId)?.forEach((cb) => cb(normalized));
};

const getOrderQuantityLabel = (order: Pick<OrderRecord, 'quantity' | 'productName' | 'orderType' | 'packName' | 'variantSize'>) => {
  const raw = `${order.productName ?? ''} ${order.variantSize ?? ''} ${order.packName ?? ''}`.toLowerCase();
  const unit = raw.includes('bottle') || raw.includes('ml') || raw.includes(' litre') || raw.includes(' liter') ? 'Bottle' : 'Can';
  return `${order.quantity} ${unit}${order.quantity === 1 ? '' : 's'}`;
};

const buildOrderStatusNotification = (order: OrderRecord, status: 'out_for_delivery' | 'delivered', createdAt: number): NotificationRecord => {
  // Format order number consistently: #00112 format
  const formattedNumber = order.orderNumber && order.orderNumber > 0
    ? `#${String(order.orderNumber).padStart(5, '0')}`
    : order.id ? `#${order.id.slice(-5).toUpperCase()}` : '#-----';
  return {
    id: notificationDocId(order.customerId, order.id ?? '', status),
    customerId: order.customerId,
    orderId: order.id ?? '',
    orderNumber: order.orderNumber ?? 0,
    status,
    message:
      status === 'out_for_delivery'
        ? `Your ${getOrderQuantityLabel(order)} order ${formattedNumber} is Out for Delivery`
        : `Your ${getOrderQuantityLabel(order)} order ${formattedNumber} has been Delivered`,
    read: false,
    createdAt
  };
};

export const createNotification = async (notification: Omit<NotificationRecord, 'id'>) => {
  if (!notification.customerId || !notification.orderId) {
    throw new Error('Invalid notification payload');
  }
  const id = notificationDocId(notification.customerId, notification.orderId, notification.status);
  const payload: NotificationRecord = { ...notification, id };
  await setDoc(doc(db, 'notifications', id), payload, { merge: false });
  const current = customerNotificationsCache.get(notification.customerId)?.data ?? [];
  const withoutSame = current.filter((item) => item.id !== id);
  emitCustomerNotifications(notification.customerId, [payload, ...withoutSame]);
  return payload;
};

export const fetchCustomerNotifications = async (customerId: string): Promise<NotificationRecord[]> => {
  if (!customerId) {
    return [];
  }
  const now = Date.now();
  const cached = customerNotificationsCache.get(customerId);
  if (cached && now - cached.at < CUSTOMER_FETCH_CACHE_MS) {
    return cached.data;
  }
  const pending = customerNotificationsPromise.get(customerId);
  if (pending) {
    return pending;
  }
  const task = (async () => {
  if (Platform.OS === 'web' && liteDb) {
    const data = await withRetry(async () => {
      const snap = await getLiteDocs(
        liteQuery(
          liteCollection(liteDb!, 'notifications'),
          liteWhere('customerId', '==', customerId),
          liteLimit(CUSTOMER_NOTIFICATIONS_QUERY_LIMIT)
        )
      );
      return snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as NotificationRecord) }))
        .sort((a, b) => b.createdAt - a.createdAt);
    }).catch(() => []);
    customerNotificationsCache.set(customerId, { at: Date.now(), data });
    return data;
  }
  const data = await withRetry(async () => {
    const snap = await getDocs(
      query(collection(db, 'notifications'), where('customerId', '==', customerId), limit(CUSTOMER_NOTIFICATIONS_QUERY_LIMIT))
    );
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as NotificationRecord) }))
      .sort((a, b) => b.createdAt - a.createdAt);
  }).catch(() => []);
  customerNotificationsCache.set(customerId, { at: Date.now(), data });
  return data;
  })();
  customerNotificationsPromise.set(customerId, task);
  try {
    return await task;
  } finally {
    customerNotificationsPromise.delete(customerId);
  }
};

export const markNotificationAsRead = async (notificationId: string) => {
  if (!notificationId) return;
  const customerId = getCustomerIdFromNotificationId(notificationId);
  if (customerId) {
    const current = customerNotificationsCache.get(customerId)?.data ?? [];
    if (current.length) {
      emitCustomerNotifications(
        customerId,
        current.map((item) => (item.id === notificationId ? { ...item, read: true } : item))
      );
    }
  }
  await updateDoc(doc(db, 'notifications', notificationId), { read: true });
};

export const markNotificationsAsRead = async (notificationIds: string[]) => {
  const ids = Array.from(new Set(notificationIds.filter(Boolean)));
  if (!ids.length) return;
  const idsSet = new Set(ids);
  const customerIds = new Set<string>();
  ids.forEach((id) => {
    const customerId = getCustomerIdFromNotificationId(id);
    if (customerId) {
      customerIds.add(customerId);
    }
  });
  customerIds.forEach((customerId) => {
    const current = customerNotificationsCache.get(customerId)?.data ?? [];
    if (current.length) {
      emitCustomerNotifications(
        customerId,
        current.map((item) => (item.id && idsSet.has(item.id) ? { ...item, read: true } : item))
      );
    }
  });
  const batch = writeBatch(db);
  ids.forEach((id) => batch.set(doc(db, 'notifications', id), { read: true }, { merge: true }));
  await batch.commit();
};

export const deleteNotification = async (notificationId: string) => {
  if (!notificationId) return;
  const customerId = getCustomerIdFromNotificationId(notificationId);
  if (customerId) {
    const current = customerNotificationsCache.get(customerId)?.data ?? [];
    if (current.length) {
      emitCustomerNotifications(
        customerId,
        current.filter((item) => item.id !== notificationId)
      );
    }
  }
  await deleteDoc(doc(db, 'notifications', notificationId));
};

export const subscribeToCustomerNotifications = (
  customerId: string,
  callback: (notifications: NotificationRecord[]) => void
) => {
  if (!customerId) {
    callback([]);
    return () => {};
  }

  if (Platform.OS === 'web') {
    const subscribers = customerNotificationSubscribers.get(customerId) ?? new Set<(notifications: NotificationRecord[]) => void>();
    subscribers.add(callback);
    customerNotificationSubscribers.set(customerId, subscribers);
    const cached = customerNotificationsCache.get(customerId);
    if (cached?.data) {
      callback(cached.data);
    }

    if (!customerNotificationPollers.has(customerId)) {
      const load = async () => {
        if (customerNotificationPolling.has(customerId)) return;
        customerNotificationPolling.add(customerId);
        try {
          const list = await fetchCustomerNotifications(customerId);
          customerNotificationSubscribers.get(customerId)?.forEach((cb) => cb(list));
        } catch {
          const fallback = customerNotificationsCache.get(customerId)?.data ?? [];
          customerNotificationSubscribers.get(customerId)?.forEach((cb) => cb(fallback));
        } finally {
          customerNotificationPolling.delete(customerId);
        }
      };
      load();
      const jitter = Math.floor(Math.random() * 10000);
      const intervalId = setInterval(load, WEB_NOTIFICATIONS_POLL_MS + jitter);
      customerNotificationPollers.set(customerId, intervalId);
    }

    return () => {
      const current = customerNotificationSubscribers.get(customerId);
      if (!current) return;
      current.delete(callback);
      if (current.size === 0) {
        customerNotificationSubscribers.delete(customerId);
        const timer = customerNotificationPollers.get(customerId);
        if (timer) {
          clearInterval(timer);
          customerNotificationPollers.delete(customerId);
        }
        customerNotificationPolling.delete(customerId);
      }
    };
  }

  return onSnapshot(
    query(collection(db, 'notifications'), where('customerId', '==', customerId), limit(CUSTOMER_NOTIFICATIONS_QUERY_LIMIT)),
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() as NotificationRecord) }))
        .sort((a, b) => b.createdAt - a.createdAt);
      callback(list);
    },
    () => callback([])
  );
};

const getNextOrderNumber = async () => {
  await ensureCoreFirestoreDocs();
  const counterId = 'orderCounter';
  const counterRef = doc(db, 'meta', counterId);

  // If counter doc is missing/outdated, align from latest orderNumber once.
  const latestOrderNumber = await withRetry(async () => {
    const latestOrderSnap = await getDocs(
      query(collection(db, 'orders'), orderBy('orderNumber', 'desc'), limit(1))
    );
    if (latestOrderSnap.empty) return 0;
    const latest = latestOrderSnap.docs[0].data() as Partial<OrderRecord>;
    return normalizeOrderNumberValue(latest.orderNumber);
  }, 0).catch(() => 0);

  return withRetry(async () =>
    runTransaction(db, async (tx) => {
      const counterSnap = await tx.get(counterRef);
      const rawStoredNumber = counterSnap.exists()
        ? normalizeOrderNumberValue((counterSnap.data() as { lastOrderNumber?: number }).lastOrderNumber)
        : 0;
      const storedNumber = rawStoredNumber === 1000 ? 0 : rawStoredNumber;
      const baseNumber = Math.max(storedNumber, latestOrderNumber);
      const nextNumber = baseNumber + 1;
      tx.set(counterRef, { lastOrderNumber: nextNumber, updatedAt: Date.now() }, { merge: true });
      return nextNumber;
    })
  );
};

export const createOrder = async (input: CreateOrderInput) => {
  const dedupeKey = JSON.stringify({
    customerId: input.customerId,
    quantity: input.quantity,
    totalAmount: input.totalAmount,
    orderType: input.orderType ?? 'single',
    variantId: input.variantId ?? '',
    address: input.address ?? ''
  });
  const existingTask = createOrderInFlight.get(dedupeKey);
  if (existingTask) {
    return existingTask;
  }

  const task = (async () => {
  const order = normalizeCreateOrderInput(input);
  const timestamp = Date.now();
  const nextNumber = await getNextOrderNumber();
  let reservedVariantStock = false;

  if (order.orderType === 'bulk' && order.variantId) {
    await runTransaction(db, async (tx) => {
      const variantRef = doc(db, 'inventoryVariants', order.variantId!);
      const variantSnap = await tx.get(variantRef);
      if (!variantSnap.exists()) {
        throw new Error('Selected packet variant not found');
      }
      const variant = normalizeInventoryVariant(variantSnap.id, variantSnap.data() as Partial<InventoryVariant>);
      tx.set(
        variantRef,
        {
          stockQty: Math.max(0, variant.stockQty - order.quantity),
          soldQty: Math.max(0, variant.soldQty + order.quantity),
          updatedAt: timestamp
        },
        { merge: true }
      );
    });
    reservedVariantStock = true;
  }

  const orderRecord: OrderRecord = {
    ...order,
    orderNumber: nextNumber,
    deliveredQuantity: 0,
    pendingQuantity: order.quantity,
    status: 'pending',
    createdAt: timestamp,
    updatedAt: timestamp
  };

  const orderRef = doc(collection(db, 'orders'));
  const batch = writeBatch(db);

  batch.set(orderRef, orderRecord);

  // Record inventory activity with correct quantity (works for both single and bulk)
  const activityRef = doc(collection(db, 'inventoryActivity'));
  batch.set(activityRef, {
    type: 'order',
    inventoryType: order.orderType === 'bulk' ? 'bulk' : 'single',
    variantId: order.variantId ?? '',
    variantSize: order.variantSize ?? '',
    quantity: order.quantity,
    createdAt: timestamp,
    orderId: orderRef.id,
    orderNumber: nextNumber,
    customerName: order.customerName,
    orderType: order.orderType ?? 'single',
    packName: order.packName ?? ''
  });

  if (order.paymentMethod === 'Wallet balance' && order.paymentStatus === 'paid' && (order.paidAmount ?? 0) > 0) {
    const walletRef = doc(db, 'wallets', order.customerId);
    batch.set(
      walletRef,
      { uid: order.customerId, balance: increment(-(order.paidAmount ?? 0)), updatedAt: timestamp },
      { merge: true }
    );

    const walletTxRef = doc(collection(db, 'walletTransactions'));
    batch.set(walletTxRef, {
      uid: order.customerId,
      type: 'debit',
      amount: order.paidAmount ?? 0,
      title: `Order #${nextNumber}`,
      status: 'success',
      orderId: orderRef.id,
      createdAt: timestamp
    });
  }
  try {
    await batch.commit();
  } catch (error) {
    if (reservedVariantStock && order.variantId) {
      await adjustInventoryVariantStock(order.variantId, order.quantity, -order.quantity).catch(() => {});
    }
    throw error;
  }
  await AsyncStorage.removeItem('inventorySummary').catch(() => {});
  invalidateOwnerOrdersCache();
  invalidateInventorySummaryCache();
  invalidateInventoryVariantsCache();
  invalidateCustomerRuntimeCaches();
  syncAvailableStockToFirestore().catch(() => {});

  return { id: orderRef.id, ...orderRecord };
  })();
  createOrderInFlight.set(dedupeKey, task);
  try {
    return await task;
  } finally {
    createOrderInFlight.delete(dedupeKey);
  }
};

export const updateOrder = async (orderId: string, updates: UpdateOrderInput) => {
  const payload = { ...updates, updatedAt: Date.now() };
  if (Platform.OS === 'web' && liteDb) {
    const orderRef = liteDoc(liteDb, 'orders', orderId);
    const orderSnap = await getLiteDoc(orderRef);
    const batch = liteWriteBatch(liteDb);

    batch.set(orderRef, payload, { merge: true });

    if (orderSnap.exists() && typeof updates.quantity === 'number') {
      const currentOrder = normalizeOrderRecord(orderSnap.id, orderSnap.data() as Partial<OrderRecord>);
      const quantityDelta = updates.quantity - currentOrder.quantity;
      if (quantityDelta !== 0 && isInventoryCountedStatus(currentOrder.status) && currentOrder.orderType !== 'bulk') {
        const invRef = liteDoc(liteDb, 'inventory', 'summary');
        const invSnap = await getLiteDoc(invRef);
        if (invSnap.exists()) {
          const current = invSnap.data() as InventorySummary;
          batch.set(invRef, { soldCans: Math.max(0, (current.soldCans ?? 0) + quantityDelta) }, { merge: true });
        }
      }
    }

    await batch.commit();
  await AsyncStorage.removeItem('inventorySummary').catch(() => {});
  invalidateCustomerRuntimeCaches();
  return;
  }

  const orderRef = doc(db, 'orders', orderId);
  const invRef = doc(db, 'inventory', 'summary');

  await runTransaction(db, async (tx) => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists()) {
      throw new Error('Order not found');
    }

    const currentOrder = normalizeOrderRecord(orderSnap.id, orderSnap.data() as Partial<OrderRecord>);
    if (
      currentOrder.orderType === 'bulk' &&
      currentOrder.variantId &&
      typeof updates.quantity === 'number' &&
      updates.quantity !== currentOrder.quantity &&
      currentOrder.status !== 'cancelled'
    ) {
      const variantRef = doc(db, 'inventoryVariants', currentOrder.variantId);
      const variantSnap = await tx.get(variantRef);
      if (variantSnap.exists()) {
        const variant = normalizeInventoryVariant(variantSnap.id, variantSnap.data() as Partial<InventoryVariant>);
        const qtyDelta = updates.quantity - currentOrder.quantity;
        tx.set(
          variantRef,
          {
            stockQty: Math.max(0, variant.stockQty - qtyDelta),
            soldQty: Math.max(0, variant.soldQty + qtyDelta),
            updatedAt: Date.now()
          },
          { merge: true }
        );
      }
    }
    const quantityDelta =
      typeof updates.quantity === 'number' && isInventoryCountedStatus(currentOrder.status) && currentOrder.orderType !== 'bulk'
        ? updates.quantity - currentOrder.quantity
        : 0;
    const invSnap = quantityDelta !== 0 ? await tx.get(invRef) : null;

    tx.set(orderRef, payload, { merge: true });

    if (invSnap?.exists()) {
      const current = invSnap.data() as InventorySummary;
      tx.set(invRef, { soldCans: Math.max(0, (current.soldCans ?? 0) + quantityDelta) }, { merge: true });
    }
  });

  await AsyncStorage.removeItem('inventorySummary').catch(() => {});
  invalidateOwnerOrdersCache();
  invalidateInventorySummaryCache();
  invalidateCustomerRuntimeCaches();
  syncAvailableStockToFirestore().catch(() => {});
};

export const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
  const updatedAt = Date.now();
  const payload = { status, updatedAt };
  let notificationToCreate: Omit<NotificationRecord, 'id'> | null = null;
  if (Platform.OS === 'web' && liteDb) {
    const orderRef = liteDoc(liteDb, 'orders', orderId);
    const orderSnap = await getLiteDoc(orderRef);
    const batch = liteWriteBatch(liteDb);
    batch.set(orderRef, payload, { merge: true });

    if (orderSnap.exists()) {
      const currentOrder = normalizeOrderRecord(orderSnap.id, orderSnap.data() as Partial<OrderRecord>);
      if (
        currentOrder.status !== status &&
        (status === 'out_for_delivery' || status === 'delivered') &&
        currentOrder.id
      ) {
        const notification = buildOrderStatusNotification(currentOrder, status, updatedAt);
        notificationToCreate = {
          customerId: notification.customerId,
          orderId: notification.orderId,
          orderNumber: notification.orderNumber,
          status: notification.status,
          message: notification.message,
          read: false,
          createdAt: notification.createdAt
        };
      }
      const wasCounted = isInventoryCountedStatus(currentOrder.status);
      const willBeCounted = isInventoryCountedStatus(status);
      const quantityDelta = wasCounted === willBeCounted ? 0 : willBeCounted ? currentOrder.quantity : -currentOrder.quantity;
      const shouldAffectSingleInventory = currentOrder.orderType !== 'bulk';

      if (quantityDelta !== 0 && shouldAffectSingleInventory) {
        const invRef = liteDoc(liteDb, 'inventory', 'summary');
        const invSnap = await getLiteDoc(invRef);
        const current = invSnap.exists() ? invSnap.data() as InventorySummary : null;
        const nextSold = Math.max(0, (current?.soldCans ?? 0) + quantityDelta);
        batch.set(invRef, { soldCans: nextSold }, { merge: true });

        if (quantityDelta > 0) {
          const activityRef = liteDoc(liteCollection(liteDb, 'inventoryActivity'));
          batch.set(activityRef, {
            type: 'order',
            quantity: currentOrder.quantity,
            createdAt: payload.updatedAt,
            orderId,
            orderNumber: currentOrder.orderNumber,
            customerName: currentOrder.customerName
          });
        }
      }
    }

    await batch.commit();
  } else {
    const orderRef = doc(db, 'orders', orderId);
    const invRef = doc(db, 'inventory', 'summary');

    await runTransaction(db, async (tx) => {
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists()) {
        throw new Error('Order not found');
      }

      const currentOrder = normalizeOrderRecord(orderSnap.id, orderSnap.data() as Partial<OrderRecord>);
      if (
        currentOrder.status !== status &&
        (status === 'out_for_delivery' || status === 'delivered') &&
        currentOrder.id
      ) {
        const notification = buildOrderStatusNotification(currentOrder, status, updatedAt);
        notificationToCreate = {
          customerId: notification.customerId,
          orderId: notification.orderId,
          orderNumber: notification.orderNumber,
          status: notification.status,
          message: notification.message,
          read: false,
          createdAt: notification.createdAt
        };
      }
      const wasCounted = isInventoryCountedStatus(currentOrder.status);
      const willBeCounted = isInventoryCountedStatus(status);
      const quantityDelta = wasCounted === willBeCounted ? 0 : willBeCounted ? currentOrder.quantity : -currentOrder.quantity;
      const shouldAffectSingleInventory = currentOrder.orderType !== 'bulk';
      const invSnap = quantityDelta !== 0 && shouldAffectSingleInventory ? await tx.get(invRef) : null;

      tx.update(orderRef, payload);

      if (quantityDelta !== 0 && shouldAffectSingleInventory) {
        const current = invSnap?.exists() ? invSnap.data() as InventorySummary : null;
        tx.set(invRef, { soldCans: Math.max(0, (current?.soldCans ?? 0) + quantityDelta) }, { merge: true });

        if (quantityDelta > 0) {
          tx.set(doc(collection(db, 'inventoryActivity')), {
            type: 'order',
            quantity: currentOrder.quantity,
            createdAt: payload.updatedAt,
            orderId,
            orderNumber: currentOrder.orderNumber,
            customerName: currentOrder.customerName
          });
        }
      }
    });
  }
  if (notificationToCreate) {
    await createNotification(notificationToCreate).catch(() => {});
  }
  await AsyncStorage.removeItem('inventorySummary').catch(() => {});
  invalidateOwnerOrdersCache();
  invalidateInventorySummaryCache();
  invalidateCustomerRuntimeCaches();
  syncAvailableStockToFirestore().catch(() => {});
};

export const updateOrderDeliveryProgress = async (orderId: string, deliveredCans: number) => {
  // Always fetch fresh from Firestore — bypass cache to avoid stale quantity
  const freshSnap = Platform.OS === 'web' && liteDb
    ? await getLiteDoc(liteDoc(liteDb!, 'orders', orderId)).catch(() => null)
    : await getDoc(doc(db, 'orders', orderId)).catch(() => null);

  if (!freshSnap?.exists()) {
    throw new Error('Order not found');
  }
  const order = normalizeOrderRecord(freshSnap.id, freshSnap.data() as Partial<OrderRecord>);

  const safeDelivered = Math.max(0, Math.min(order.quantity, Math.floor(Number(deliveredCans))));
  const pendingCans = Math.max(0, order.quantity - safeDelivered);
  const nextStatus: OrderStatus = pendingCans === 0 ? 'delivered' : safeDelivered > 0 ? 'out_for_delivery' : order.status;
  const updatedAt = Date.now();

  // Atomic single write: delivery progress + status + inventory in one transaction
  const orderRef = doc(db, 'orders', orderId);
  const invRef = doc(db, 'inventory', 'summary');

  let notificationToCreate: Omit<NotificationRecord, 'id'> | null = null;

  if (Platform.OS === 'web' && liteDb) {
    const batch = liteWriteBatch(liteDb);
    const orderRefLite = liteDoc(liteDb!, 'orders', orderId);
    batch.set(orderRefLite, {
      deliveredQuantity: safeDelivered,
      pendingQuantity: pendingCans,
      status: nextStatus,
      updatedAt
    }, { merge: true });

    if (order.status !== nextStatus && order.orderType !== 'bulk') {
      const wasCounted = isInventoryCountedStatus(order.status);
      const willBeCounted = isInventoryCountedStatus(nextStatus);
      const quantityDelta = wasCounted === willBeCounted ? 0 : willBeCounted ? order.quantity : -order.quantity;
      if (quantityDelta !== 0) {
        const invRefLite = liteDoc(liteDb!, 'inventory', 'summary');
        const invSnap = await getLiteDoc(invRefLite).catch(() => null);
        const current = invSnap?.exists() ? invSnap.data() as InventorySummary : null;
        batch.set(invRefLite, { soldCans: Math.max(0, (current?.soldCans ?? 0) + quantityDelta) }, { merge: true });
      }
    }
    await batch.commit();
  } else {
    await runTransaction(db, async (tx) => {
      const wasCounted = isInventoryCountedStatus(order.status);
      const willBeCounted = isInventoryCountedStatus(nextStatus);
      const quantityDelta =
        order.status !== nextStatus && order.orderType !== 'bulk'
          ? wasCounted === willBeCounted ? 0 : willBeCounted ? order.quantity : -order.quantity
          : 0;
      const invSnap = quantityDelta !== 0 ? await tx.get(invRef) : null;

      tx.set(orderRef, {
        deliveredQuantity: safeDelivered,
        pendingQuantity: pendingCans,
        status: nextStatus,
        updatedAt
      }, { merge: true });

      if (quantityDelta !== 0) {
        const current = invSnap?.exists() ? invSnap.data() as InventorySummary : null;
        tx.set(invRef, { soldCans: Math.max(0, (current?.soldCans ?? 0) + quantityDelta) }, { merge: true });
      }
    });
  }

  if (order.status !== nextStatus && (nextStatus === 'out_for_delivery' || nextStatus === 'delivered')) {
    const notification = buildOrderStatusNotification({ ...order, status: order.status }, nextStatus, updatedAt);
    notificationToCreate = {
      customerId: notification.customerId,
      orderId: notification.orderId,
      orderNumber: notification.orderNumber,
      status: notification.status,
      message: notification.message,
      read: false,
      createdAt: updatedAt
    };
  }

  if (notificationToCreate) {
    await createNotification(notificationToCreate).catch(() => {});
  }

  // Invalidate all caches so every page reads fresh data
  orderByIdCache.delete(orderId);
  await AsyncStorage.removeItem('inventorySummary').catch(() => {});
  invalidateOwnerOrdersCache();
  invalidateInventorySummaryCache();
  invalidateCustomerRuntimeCaches();
  syncAvailableStockToFirestore().catch(() => {});

  return {
    ...order,
    deliveredQuantity: safeDelivered,
    pendingQuantity: pendingCans,
    status: nextStatus
  };
};

export const cancelOrder = async (orderId: string) => {
  const timestamp = Date.now();

  if (Platform.OS === 'web' && liteDb) {
    const orderRef = liteDoc(liteDb, 'orders', orderId);
    const orderSnap = await getLiteDoc(orderRef);
    if (!orderSnap.exists()) {
      throw new Error('Order not found');
    }

    const order = normalizeOrderRecord(orderSnap.id, orderSnap.data() as Partial<OrderRecord>);
    if (order.status === 'cancelled') {
      return;
    }
    if (order.orderType === 'bulk' && order.variantId) {
      await adjustInventoryVariantStock(order.variantId, order.quantity, -order.quantity).catch(() => {});
    }

    const batch = liteWriteBatch(liteDb);
    batch.set(orderRef, { status: 'cancelled', updatedAt: timestamp }, { merge: true });

    if (isInventoryCountedStatus(order.status) && order.orderType !== 'bulk') {
      const invRef = liteDoc(liteDb, 'inventory', 'summary');
      const invSnap = await getLiteDoc(invRef);
      if (invSnap.exists()) {
        const current = invSnap.data() as InventorySummary;
        batch.set(invRef, { soldCans: Math.max(0, (current.soldCans ?? 0) - order.quantity) }, { merge: true });
      }
    }

    await batch.commit();

    if (isInventoryCountedStatus(order.status) && order.orderType !== 'bulk') {
      const activityRef = liteDoc(liteCollection(liteDb, 'inventoryActivity'));
      await liteSetDoc(activityRef, {
        type: 'cancel',
        inventoryType: 'single',
        variantId: order.variantId ?? '',
        variantSize: order.variantSize ?? '',
        quantity: order.quantity,
        createdAt: timestamp,
        orderId,
        orderNumber: order.orderNumber,
        customerName: order.customerName
      }).catch(() => {});
    }

    await AsyncStorage.removeItem('inventorySummary').catch(() => {});
    invalidateCustomerRuntimeCaches();
    return;
  }

  const orderRef = doc(db, 'orders', orderId);
  const invRef = doc(db, 'inventory', 'summary');
  const orderSnap = await getDoc(orderRef);
  if (!orderSnap.exists()) {
    throw new Error('Order not found');
  }

  const order = normalizeOrderRecord(orderSnap.id, orderSnap.data() as Partial<OrderRecord>);
  if (order.status === 'cancelled') {
    return;
  }
  if (order.orderType === 'bulk' && order.variantId) {
    await adjustInventoryVariantStock(order.variantId, order.quantity, -order.quantity).catch(() => {});
  }

  const batch = writeBatch(db);
  batch.update(orderRef, { status: 'cancelled', updatedAt: timestamp });

  if (isInventoryCountedStatus(order.status) && order.orderType !== 'bulk') {
    const invSnap = await getDoc(invRef);
    if (invSnap.exists()) {
      const current = invSnap.data() as InventorySummary;
      batch.set(invRef, { soldCans: Math.max(0, (current.soldCans ?? 0) - order.quantity) }, { merge: true });
    }
  }

  await batch.commit();

  if (isInventoryCountedStatus(order.status) && order.orderType !== 'bulk') {
    await addDoc(collection(db, 'inventoryActivity'), {
      type: 'cancel',
      inventoryType: 'single',
      variantId: order.variantId ?? '',
      variantSize: order.variantSize ?? '',
      quantity: order.quantity,
      createdAt: timestamp,
      orderId,
      orderNumber: order.orderNumber,
      customerName: order.customerName
    }).catch(() => {});
  }

  await AsyncStorage.removeItem('inventorySummary').catch(() => {});
  invalidateOwnerOrdersCache();
  invalidateInventorySummaryCache();
  invalidateCustomerRuntimeCaches();
  invalidateInventoryVariantsCache();
  syncAvailableStockToFirestore().catch(() => {});
};

// Auto-progress orders: pending→confirmed after 8h, confirmed→preparing after 2h,
// preparing→out_for_delivery after 2h, out_for_delivery→delivered after 2h
const AUTO_PROGRESS_MS: Partial<Record<OrderStatus, { next: OrderStatus; delay: number }>> = {
  pending:          { next: 'confirmed',        delay: 8 * 60 * 60 * 1000 },
  confirmed:        { next: 'preparing',        delay: 2 * 60 * 60 * 1000 },
  preparing:        { next: 'out_for_delivery', delay: 2 * 60 * 60 * 1000 },
  out_for_delivery: { next: 'delivered',        delay: 2 * 60 * 60 * 1000 },
};

// Throttle map to prevent repeated Firestore calls
const lastCallTime: Record<string, number> = {};
const THROTTLE_MS = 10 * 60 * 1000; // 10 minutes
const shouldThrottle = (key: string) => {
  const now = Date.now();
  if (lastCallTime[key] && now - lastCallTime[key] < THROTTLE_MS) return true;
  lastCallTime[key] = now;
  return false;
};

// Suppress resource-exhausted Firebase console warnings
if (typeof console !== 'undefined') {
  const _warn = console.warn.bind(console);
  console.warn = (...args: any[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : '';
    if (msg.includes('resource-exhausted') || msg.includes('RestConnection RPC')) return;
    _warn(...args);
  };
}

let firestoreRateLimitUntil = 0;
let firestorePermissionDeniedUntil = 0;

const isRateLimitedError = (e: any) => {
  const code = e?.code;
  const msg = typeof e?.message === 'string' ? e.message : '';
  return (
    code === 'resource-exhausted' ||
    msg.includes('429') ||
    msg.includes('Too Many Requests') ||
    msg.includes('RESOURCE_EXHAUSTED')
  );
};

// Retry with exponential backoff for transient errors and honor a global cooldown on 429.
const withRetry = async <T>(fn: () => Promise<T>, retries = 2, delayMs = 1200): Promise<T> => {
  if (firestoreRateLimitUntil > Date.now()) {
    const rateLimitError = new Error('Firestore temporarily rate-limited');
    (rateLimitError as Error & { code?: string }).code = 'resource-exhausted';
    throw rateLimitError;
  }
  if (firestorePermissionDeniedUntil > Date.now()) {
    const deniedError = new Error('Firestore access temporarily blocked (permission-denied)');
    (deniedError as Error & { code?: string }).code = 'permission-denied';
    throw deniedError;
  }
  try {
    return await fn();
  } catch (e: any) {
    const code = e?.code;
    const isPermissionDenied = code === 'permission-denied';
    const isRetryableError =
      code === 'aborted' ||
      code === 'unavailable' ||
      code === 'failed-precondition' ||
      isRateLimitedError(e) ||
      (e?.name === 'FirebaseError' && !code?.includes('auth/') && code !== 'permission-denied');

    if (isRateLimitedError(e)) {
      firestoreRateLimitUntil = Date.now() + 60_000;
    }
    if (isPermissionDenied) {
      // Avoid hammering Firestore with identical forbidden requests (web console 403 spam).
      firestorePermissionDeniedUntil = Date.now() + 5 * 60_000;
    }

    if (retries > 0 && isRetryableError) {
      const jitter = Math.random() * 1000;
      await new Promise(r => setTimeout(r, delayMs + jitter));
      return withRetry(fn, retries - 1, Math.min(delayMs * 2, 30000));
    }
    throw e;
  }
};

// Increase polling intervals to reduce request frequency
const WEB_NOTIFICATIONS_POLL_MS = 60 * 1000; // 1 minute
const WEB_ORDER_POLL_MS = 30 * 1000; // 30 seconds

const customerOrderSubscribers = new Map<string, Set<(orders: OrderRecord[]) => void>>();
const customerOrderPollers = new Map<string, ReturnType<typeof setInterval>>();
const customerOrderPolling = new Set<string>();

const customerNotificationSubscribers = new Map<string, Set<(notifications: NotificationRecord[]) => void>>();
const customerNotificationPollers = new Map<string, ReturnType<typeof setInterval>>();
const customerNotificationPolling = new Set<string>();

const orderSubscribers = new Map<string, Set<(order: OrderRecord | null) => void>>();
const orderPollers = new Map<string, ReturnType<typeof setInterval>>();
const orderPolling = new Set<string>();

const FETCH_CACHE_MS = 15000;
let ownerOrdersCache: { at: number; data: OrderRecord[] } | null = null;
let ownerOrdersPromise: Promise<OrderRecord[]> | null = null;
let customersCache: { at: number; data: UserProfileData[] } | null = null;
let customersPromise: Promise<UserProfileData[]> | null = null;
let inventorySummaryCache: { at: number; data: InventorySummary } | null = null;
let inventorySummaryPromise: Promise<InventorySummary> | null = null;
let customerVisibleStockCache: { at: number; data: number } | null = null;
let customerVisibleStockPromise: Promise<number> | null = null;
let inventoryVariantsCache: { at: number; data: InventoryVariant[] } | null = null;
let inventoryVariantsPromise: Promise<InventoryVariant[]> | null = null;
const CUSTOMER_FETCH_CACHE_MS = 10000;
const customerOrdersCache = new Map<string, { at: number; data: OrderRecord[] }>();
const customerOrdersPromise = new Map<string, Promise<OrderRecord[]>>();
const customerNotificationsCache = new Map<string, { at: number; data: NotificationRecord[] }>();
const customerNotificationsPromise = new Map<string, Promise<NotificationRecord[]>>();
const signInWithPhoneInFlight = new Map<string, Promise<{ user: any }>>();
const registerWithPhoneInFlight = new Map<string, Promise<UserProfileData>>();
const orderByIdCache = new Map<string, { at: number; data: OrderRecord | null }>();
const orderByIdPromise = new Map<string, Promise<OrderRecord | null>>();
const createOrderInFlight = new Map<string, Promise<{ id: string } & OrderRecord>>();
const CUSTOMER_ORDERS_QUERY_LIMIT = 40;
const OWNER_ORDERS_QUERY_LIMIT = 200;
const CUSTOMER_NOTIFICATIONS_QUERY_LIMIT = 60;

const invalidateOwnerOrdersCache = () => {
  ownerOrdersCache = null;
};

const invalidateCustomersCache = () => {
  customersCache = null;
};

const invalidateInventorySummaryCache = () => {
  inventorySummaryCache = null;
  customerVisibleStockCache = null;
  customerVisibleStockPromise = null;
};

const invalidateInventoryVariantsCache = () => {
  inventoryVariantsCache = null;
};
const invalidateCustomerRuntimeCaches = () => {
  customerOrdersCache.clear();
  customerOrdersPromise.clear();
  customerNotificationsCache.clear();
  customerNotificationsPromise.clear();
  orderByIdCache.clear();
  orderByIdPromise.clear();
  customerVisibleStockCache = null;
  customerVisibleStockPromise = null;
  // Also invalidate owner cache so admin side reflects changes immediately
  ownerOrdersCache = null;
  ownerOrdersPromise = null;
};

const areOrdersEqual = (a: OrderRecord[], b: OrderRecord[]) => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (
      left.id !== right.id ||
      left.orderNumber !== right.orderNumber ||
      left.status !== right.status ||
      left.updatedAt !== right.updatedAt ||
      left.quantity !== right.quantity ||
      left.deliveredQuantity !== right.deliveredQuantity ||
      left.pendingQuantity !== right.pendingQuantity ||
      left.paymentStatus !== right.paymentStatus ||
      left.paidAmount !== right.paidAmount ||
      !!left.paymentApproved !== !!right.paymentApproved
    ) {
      return false;
    }
  }
  return true;
};

export const autoProgressOrders = async (customerId: string) => {
  if (shouldThrottle(`autoProgress_${customerId}`)) return;
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
  if (Platform.OS === 'web' && liteDb) {
    const orderRef = liteDoc(liteDb, 'orders', orderId);
    const orderSnap = await getLiteDoc(orderRef);
    if (!orderSnap.exists()) {
      return;
    }

    const order = normalizeOrderRecord(orderSnap.id, orderSnap.data() as Partial<OrderRecord>);
    if (order.orderType === 'bulk' && order.variantId && order.status !== 'cancelled') {
      await adjustInventoryVariantStock(order.variantId, order.quantity, -order.quantity).catch(() => {});
    }
    const batch = liteWriteBatch(liteDb);
    batch.delete(orderRef);

    if (isInventoryCountedStatus(order.status) && order.orderType !== 'bulk') {
      const invRef = liteDoc(liteDb, 'inventory', 'summary');
      const invSnap = await getLiteDoc(invRef);
      if (invSnap.exists()) {
        const current = invSnap.data() as InventorySummary;
        batch.set(invRef, { soldCans: Math.max(0, (current.soldCans ?? 0) - order.quantity) }, { merge: true });
      }
    }

    await batch.commit();
    await AsyncStorage.removeItem('inventorySummary').catch(() => {});
    invalidateCustomerRuntimeCaches();
    return;
  }

  const orderRef = doc(db, 'orders', orderId);
  const invRef = doc(db, 'inventory', 'summary');

  await runTransaction(db, async (tx) => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists()) {
      return;
    }

    const order = normalizeOrderRecord(orderSnap.id, orderSnap.data() as Partial<OrderRecord>);
    if (order.orderType === 'bulk' && order.variantId && order.status !== 'cancelled') {
      await adjustInventoryVariantStock(order.variantId, order.quantity, -order.quantity).catch(() => {});
    }
    const invSnap = isInventoryCountedStatus(order.status) && order.orderType !== 'bulk' ? await tx.get(invRef) : null;

    tx.delete(orderRef);

    if (invSnap?.exists()) {
      const current = invSnap.data() as InventorySummary;
      tx.set(invRef, { soldCans: Math.max(0, (current.soldCans ?? 0) - order.quantity) }, { merge: true });
    }
  });

  await AsyncStorage.removeItem('inventorySummary').catch(() => {});
  invalidateCustomerRuntimeCaches();
};

const mapOrders = async (ordersQuery: ReturnType<typeof query>) => {
  const querySnapshot = await getDocs(ordersQuery);
  return querySnapshot.docs.map((docSnap) => normalizeOrderRecord(docSnap.id, docSnap.data() as Partial<OrderRecord>));
};

export const fetchCustomerOrders = async (customerId: string) => {
  if (!customerId) {
    return [];
  }
  const now = Date.now();
  const cached = customerOrdersCache.get(customerId);
  if (cached && now - cached.at < CUSTOMER_FETCH_CACHE_MS) {
    return cached.data;
  }
  const pending = customerOrdersPromise.get(customerId);
  if (pending) {
    return pending;
  }
  const task = (async () => {
  if (Platform.OS === 'web' && liteDb) {
    const data = await withRetry(async () => {
      const querySnapshot = await getLiteDocs(
        liteQuery(
          liteCollection(liteDb!, 'orders'),
          liteWhere('customerId', '==', customerId),
          liteLimit(CUSTOMER_ORDERS_QUERY_LIMIT)
        )
      );
      return querySnapshot.docs
        .map((docSnap) => normalizeOrderRecord(docSnap.id, docSnap.data() as Partial<OrderRecord>))
        .sort((a, b) => b.createdAt - a.createdAt);
    }).catch(() => []);
    customerOrdersCache.set(customerId, { at: Date.now(), data });
    return data;
  }
  const data = await withRetry(() =>
    getDocs(query(collection(db, 'orders'), where('customerId', '==', customerId), limit(CUSTOMER_ORDERS_QUERY_LIMIT)))
      .then(snap => snap.docs.map(d => normalizeOrderRecord(d.id, d.data() as Partial<OrderRecord>)).sort((a,b) => b.createdAt - a.createdAt))
  ).catch(() => []);
  customerOrdersCache.set(customerId, { at: Date.now(), data });
  return data;
  })();
  customerOrdersPromise.set(customerId, task);
  try {
    return await task;
  } finally {
    customerOrdersPromise.delete(customerId);
  }
};

export const subscribeToCustomerOrders = (
  customerId: string,
  callback: (orders: OrderRecord[]) => void
) => {
  if (!customerId) {
    callback([]);
    return () => {};
  }
  if (Platform.OS === 'web') {
    const subscribers = customerOrderSubscribers.get(customerId) ?? new Set<(orders: OrderRecord[]) => void>();
    subscribers.add(callback);
    customerOrderSubscribers.set(customerId, subscribers);
    const cached = customerOrdersCache.get(customerId);
    if (cached?.data) {
      callback(cached.data);
    }

    if (!customerOrderPollers.has(customerId)) {
      const loadOrders = async () => {
        if (customerOrderPolling.has(customerId)) return;
        customerOrderPolling.add(customerId);
        try {
          const orders = await fetchCustomerOrders(customerId);
          const previousOrders = customerOrdersCache.get(customerId)?.data ?? [];
          if (!areOrdersEqual(previousOrders, orders)) {
            customerOrdersCache.set(customerId, { at: Date.now(), data: orders });
          }
          customerOrderSubscribers.get(customerId)?.forEach((cb) => cb(orders));
        } catch {
          const fallback = customerOrdersCache.get(customerId)?.data ?? [];
          customerOrderSubscribers.get(customerId)?.forEach((cb) => cb(fallback));
        } finally {
          customerOrderPolling.delete(customerId);
        }
      };
      loadOrders();
      const jitter = Math.floor(Math.random() * 10000);
      const intervalId = setInterval(loadOrders, WEB_ORDER_POLL_MS + jitter);
      customerOrderPollers.set(customerId, intervalId);
    }

    return () => {
      const current = customerOrderSubscribers.get(customerId);
      if (!current) return;
      current.delete(callback);
      if (current.size === 0) {
        customerOrderSubscribers.delete(customerId);
        const timer = customerOrderPollers.get(customerId);
        if (timer) {
          clearInterval(timer);
          customerOrderPollers.delete(customerId);
        }
        customerOrderPolling.delete(customerId);
      }
    };
  }

  return onSnapshot(
    query(collection(db, 'orders'), where('customerId', '==', customerId), limit(CUSTOMER_ORDERS_QUERY_LIMIT)),
    (snapshot) => {
      const orders = snapshot.docs
        .map((docSnap) => normalizeOrderRecord(docSnap.id, docSnap.data() as Partial<OrderRecord>))
        .sort((a, b) => b.createdAt - a.createdAt);
      callback(orders);
    },
    () => callback([])
  );
};

export const fetchOwnerOrders = async () => {
  const now = Date.now();
  if (ownerOrdersCache && now - ownerOrdersCache.at < FETCH_CACHE_MS) {
    return ownerOrdersCache.data;
  }
  if (ownerOrdersPromise) {
    return ownerOrdersPromise;
  }
  ownerOrdersPromise = (async () => {
  if (Platform.OS === 'web' && liteDb) {
    const data = await withRetry(async () => {
      const querySnapshot = await getLiteDocs(
        liteQuery(liteCollection(liteDb!, 'orders'), liteLimit(OWNER_ORDERS_QUERY_LIMIT))
      );
      return querySnapshot.docs
        .map((docSnap) => normalizeOrderRecord(docSnap.id, docSnap.data() as Partial<OrderRecord>))
        .sort((a, b) => b.createdAt - a.createdAt);
    }).catch(() => []);
    ownerOrdersCache = { at: Date.now(), data };
    return data;
  }
  const data = await withRetry(() =>
    mapOrders(query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(OWNER_ORDERS_QUERY_LIMIT)))
  ).catch(() => []);
  ownerOrdersCache = { at: Date.now(), data };
  return data;
  })();
  try {
    return await ownerOrdersPromise;
  } finally {
    ownerOrdersPromise = null;
  }
};

export const calculateStockOverview = (
  inventory: Pick<InventorySummary, 'openingStock' | 'restockedCans' | 'soldCans'> | null | undefined,
  orders: OrderRecord[],
  excludeOrderId?: string
): StockOverview => {
  const totalStock = Math.max(0,
    Math.floor(Number(inventory?.openingStock ?? 0)) +
    Math.floor(Number(inventory?.restockedCans ?? 0))
  );
  // Use inventory.soldCans as the authoritative source (written atomically by transactions).
  // Only fall back to counting from orders if inventory doc has no soldCans yet.
  const inventorySoldCans = Math.max(0, Math.floor(Number(inventory?.soldCans ?? 0)));
  const soldCansFromOrders = orders
    .filter((order) => order.status === 'delivered' && order.orderType !== 'bulk')
    .reduce((sum, order) => sum + Math.floor(Number(order.quantity)), 0);
  // Use the larger of the two to avoid showing negative available stock,
  // but do NOT add them together (that was the double-count bug).
  const soldCans = inventorySoldCans > 0 ? inventorySoldCans : soldCansFromOrders;
  const reservedCans = orders
    .filter((order) =>
      order.id !== excludeOrderId &&
      order.orderType !== 'bulk' &&
      order.status !== 'cancelled' &&
      order.status !== 'delivered'
    )
    .reduce((sum, order) => sum + Math.floor(Number(order.quantity)), 0);

  return {
    totalStock,
    soldCans,
    reservedCans,
    availableStock: Math.max(0, totalStock - soldCans - reservedCans)
  };
};

export const fetchStockOverview = async (excludeOrderId?: string) => {
  const [inventory, orders] = await Promise.all([
    fetchInventorySummary(),
    fetchOwnerOrders().catch(() => [])
  ]);
  return calculateStockOverview(inventory, orders, excludeOrderId);
};

export const fetchCustomerAvailableStock = async (excludeOrderId?: string) => {
  const snapshot =
    Platform.OS === 'web' && liteDb
      ? await getLiteDoc(liteDoc(liteDb, 'inventory', 'summary'))
      : await getDoc(doc(db, 'inventory', 'summary'));
  if (!snapshot.exists()) {
    return 0;
  }
  const data = snapshot.data() as Partial<InventorySummary>;
  return normalizeInventoryStockValue((data as any).availableStock);
};

// Subscribe to inventory/summary doc in real time and push available stock to callback.
// Reads the 'availableStock' field written by the admin, falling back to
// openingStock + restockedCans - soldCans if the field is absent.
// This guarantees the customer always sees the exact same number as the admin.
export const subscribeToInventoryStock = (
  callback: (stock: number) => void
): (() => void) => {
  let lastKnownStock = 0;

  const emit = (data?: Partial<InventorySummary> & { availableStock?: unknown }) => {
    const next = data ? getAvailableStockFromInventorySummary(data) : lastKnownStock;
    lastKnownStock = next;
    callback(next);
  };

  getDoc(doc(db, 'inventory', 'summary'))
    .then((snapshot) => {
      if (snapshot.exists()) {
        emit(snapshot.data() as Partial<InventorySummary> & { availableStock?: unknown });
      }
    })
    .catch(() => {});

  return onSnapshot(
    doc(db, 'inventory', 'summary'),
    (snapshot) => {
      if (snapshot.exists()) {
        emit(snapshot.data() as Partial<InventorySummary> & { availableStock?: unknown });
      } else {
        callback(lastKnownStock);
      }
    },
    () => callback(lastKnownStock)
  );
};
export const getOrderById = async (orderId: string) => {
  if (!orderId) {
    return null;
  }
  const now = Date.now();
  const cached = orderByIdCache.get(orderId);
  if (cached && now - cached.at < CUSTOMER_FETCH_CACHE_MS) {
    return cached.data;
  }
  const pending = orderByIdPromise.get(orderId);
  if (pending) {
    return pending;
  }
  const task = (async () => {
    const data = await withRetry(async () => {
      const snapshot =
        Platform.OS === 'web' && liteDb
          ? await getLiteDoc(liteDoc(liteDb!, 'orders', orderId))
          : await getDoc(doc(db, 'orders', orderId));
      return snapshot.exists() ? normalizeOrderRecord(snapshot.id, snapshot.data() as Partial<OrderRecord>) : null;
    }).catch(() => null);
    orderByIdCache.set(orderId, { at: Date.now(), data });
    return data;
  })();
  orderByIdPromise.set(orderId, task);
  try {
    return await task;
  } finally {
    orderByIdPromise.delete(orderId);
  }
};

export const subscribeToOrder = (orderId: string, callback: (order: OrderRecord | null) => void) => {
  if (Platform.OS === 'web') {
    const subscribers = orderSubscribers.get(orderId) ?? new Set<(order: OrderRecord | null) => void>();
    subscribers.add(callback);
    orderSubscribers.set(orderId, subscribers);

    if (!orderPollers.has(orderId)) {
      const loadOrder = async () => {
        if (orderPolling.has(orderId)) return;
        orderPolling.add(orderId);
        try {
          // Bypass cache: always fetch fresh from Firestore for real-time accuracy
          orderByIdCache.delete(orderId);
          const order = await getOrderById(orderId);
          orderSubscribers.get(orderId)?.forEach((cb) => cb(order));
        } catch {
          orderSubscribers.get(orderId)?.forEach((cb) => cb(null));
        } finally {
          orderPolling.delete(orderId);
        }
      };
      loadOrder();
      const intervalId = setInterval(loadOrder, WEB_ORDER_POLL_MS);
      orderPollers.set(orderId, intervalId);
    }

    return () => {
      const current = orderSubscribers.get(orderId);
      if (!current) return;
      current.delete(callback);
      if (current.size === 0) {
        orderSubscribers.delete(orderId);
        const timer = orderPollers.get(orderId);
        if (timer) {
          clearInterval(timer);
          orderPollers.delete(orderId);
        }
        orderPolling.delete(orderId);
      }
    };
  }

  return onSnapshot(doc(db, 'orders', orderId), (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }
    callback(normalizeOrderRecord(snapshot.id, snapshot.data()));
  });
};

export const fetchCustomers = async () => {
  const now = Date.now();
  if (customersCache && now - customersCache.at < FETCH_CACHE_MS) {
    return customersCache.data;
  }
  if (customersPromise) {
    return customersPromise;
  }
  customersPromise = (async () => {
  const querySnapshot = await withRetry(async () =>
    Platform.OS === 'web' && liteDb
      ? await getLiteDocs(liteQuery(liteCollection(liteDb!, 'users'), liteWhere('role', '==', 'customer')))
      : await getDocs(query(collection(db, 'users'), where('role', '==', 'customer')))
  ).catch(() => ({ docs: [] } as any));
  const data = querySnapshot.docs.map((docSnap: any) =>
    normalizeUserProfileData({ id: docSnap.id, ...(docSnap.data() as UserProfileData) } as UserProfileData)
  );
    customersCache = { at: Date.now(), data };
    return data;
  })();
  try {
    return await customersPromise;
  } finally {
    customersPromise = null;
  }
};

export const fetchInventorySummary = async (): Promise<InventorySummary> => {
  await ensureCoreFirestoreDocs();
  const now = Date.now();
  if (inventorySummaryCache && now - inventorySummaryCache.at < FETCH_CACHE_MS) {
    return inventorySummaryCache.data;
  }
  if (inventorySummaryPromise) {
    return inventorySummaryPromise;
  }
  inventorySummaryPromise = (async () => {
  const snapshot = await withRetry(async () =>
    Platform.OS === 'web' && liteDb
      ? await getLiteDoc(liteDoc(liteDb!, 'inventory', 'summary'))
      : await getDoc(doc(db, 'inventory', 'summary'))
  ).catch(() => null as any);
  if (snapshot?.exists()) {
    const raw = snapshot.data() as InventorySummary;
    const data: InventorySummary = {
      openingStock: Math.max(0, Math.floor(Number(raw.openingStock ?? 0))),
      restockedCans: Math.max(0, Math.floor(Number(raw.restockedCans ?? 0))),
      soldCans: Math.max(0, Math.floor(Number(raw.soldCans ?? 0))),
      purchasePrice: Math.max(0, Number(raw.purchasePrice ?? 0)),
      sellPrice: Math.max(0, Number(raw.sellPrice ?? 0)),
      availableStock: Number.isFinite(Number(raw.availableStock))
        ? Math.max(0, Math.floor(Number(raw.availableStock)))
        : undefined
    };
    inventorySummaryCache = { at: Date.now(), data };
    return data;
  }
  await setDoc(doc(db, 'inventory', 'summary'), INVENTORY_SUMMARY_DEFAULTS, { merge: true });
  inventorySummaryCache = { at: Date.now(), data: INVENTORY_SUMMARY_DEFAULTS };
  return INVENTORY_SUMMARY_DEFAULTS;
  })();
  try {
    return await inventorySummaryPromise;
  } finally {
    inventorySummaryPromise = null;
  }
};

// Write the correct availableStock = totalStock - soldCans - reservedCans to inventory/summary.
// Called after any event that changes stock: order placed, delivered, cancelled, or admin edit.
const syncAvailableStockToFirestore = async () => {
  try {
    const invRef = Platform.OS === 'web' && liteDb
      ? liteDoc(liteDb!, 'inventory', 'summary')
      : doc(db, 'inventory', 'summary');

    const [invSnap, ordersSnap] = await Promise.all([
      Platform.OS === 'web' && liteDb
        ? getLiteDoc(invRef as any)
        : getDoc(invRef as any),
      Platform.OS === 'web' && liteDb
        ? getLiteDocs(liteQuery(liteCollection(liteDb!, 'orders'), liteLimit(OWNER_ORDERS_QUERY_LIMIT)))
        : getDocs(query(collection(db, 'orders'), limit(OWNER_ORDERS_QUERY_LIMIT)))
    ]);

    if (!invSnap.exists()) return;

    const raw = invSnap.data() as InventorySummary;
    const totalStock = Math.max(0,
      Math.floor(Number(raw.openingStock ?? 0)) +
      Math.floor(Number(raw.restockedCans ?? 0))
    );
    const soldCans = Math.max(0, Math.floor(Number(raw.soldCans ?? 0)));
    const orders = ordersSnap.docs.map(d => normalizeOrderRecord(d.id, d.data() as Partial<OrderRecord>));
    const reservedCans = orders
      .filter(o => o.orderType !== 'bulk' && o.status !== 'cancelled' && o.status !== 'delivered')
      .reduce((sum, o) => sum + o.quantity, 0);
    const availableStock = Math.max(0, totalStock - soldCans - reservedCans);

    if (Platform.OS === 'web' && liteDb) {
      await liteSetDoc(invRef as any, { availableStock }, { merge: true });
    } else {
      await setDoc(invRef as any, { availableStock }, { merge: true });
    }
  } catch {
    // non-critical: customer will fall back to totalStock - soldCans
  }
};

export const updateInventorySummary = async (updates: Partial<InventorySummary> & { availableStock?: number }) => {
  if (Platform.OS === 'web' && liteDb) {
    await liteSetDoc(liteDoc(liteDb, 'inventory', 'summary'), updates, { merge: true });
  } else {
    await setDoc(doc(db, 'inventory', 'summary'), updates, { merge: true });
  }
  await AsyncStorage.removeItem('inventorySummary').catch(() => {});
  invalidateInventorySummaryCache();
  // Recompute and persist availableStock after the admin edits stock
  await syncAvailableStockToFirestore();
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
  if (amount <= 0) {
    throw new Error('Recharge amount must be greater than zero.');
  }

  const timestamp = Date.now();

  if (Platform.OS === 'web' && liteDb) {
    const walletRef = liteDoc(liteDb, 'wallets', uid);
    const snap = await getLiteDoc(walletRef);
    const current = snap.exists() ? (snap.data().balance as number) ?? 0 : 0;
    const newBalance = current + amount;

    const walletTxRef = liteDoc(liteCollection(liteDb, 'walletTransactions'));
    const batch = liteWriteBatch(liteDb);
    batch.set(walletRef, { uid, balance: newBalance, updatedAt: timestamp }, { merge: true });
    batch.set(walletTxRef, {
      uid, type: 'credit', amount, title: 'Wallet Recharge',
      status: 'success', createdAt: timestamp
    });
    await batch.commit();
    return newBalance;
  }

  const walletRef = doc(db, 'wallets', uid);
  const snap = await getDoc(walletRef);
  const current = snap.exists() ? (snap.data().balance as number) ?? 0 : 0;
  const newBalance = current + amount;

  const walletTxRef = doc(collection(db, 'walletTransactions'));
  const batch = writeBatch(db);
  batch.set(walletRef, { uid, balance: newBalance, updatedAt: timestamp }, { merge: true });
  batch.set(walletTxRef, {
    uid, type: 'credit', amount, title: 'Wallet Recharge',
    status: 'success', createdAt: timestamp
  });
  await batch.commit();
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
  const snap = await getDocs(query(collection(db, 'walletTransactions'), where('uid', '==', uid)));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as WalletTransaction) }))
    .sort((a, b) => b.createdAt - a.createdAt);
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
