import './polyfills/url';
import { initializeApp } from 'firebase/app';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { connectAuthEmulator, getAuth, initializeAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, initializeFirestore, setLogLevel } from 'firebase/firestore';

setLogLevel('silent');

const firebaseConfig = {
  apiKey: "AIzaSyB6EgRpzOc__z-eRDSFulI2a_n_d6dBDYc",
  authDomain: "watercan-64609.firebaseapp.com",
  projectId: "watercan-64609",
  storageBucket: "watercan-64609.firebasestorage.app",
  messagingSenderId: "981323334814",
  appId: "1:981323334814:web:9575c05b86daf36942278f",
  measurementId: "G-4LDHXJ0F7Y"
};

export { firebaseConfig };
export const firebaseApp = initializeApp(firebaseConfig);

const reactNativePersistence = class {
  static type = 'LOCAL';
  readonly type = 'LOCAL';

  async _isAvailable() {
    try {
      await AsyncStorage.setItem('firebase-auth-storage-test', '1');
      await AsyncStorage.removeItem('firebase-auth-storage-test');
      return true;
    } catch {
      return false;
    }
  }

  _set(key: string, value: unknown) {
    return AsyncStorage.setItem(key, JSON.stringify(value));
  }

  async _get<T>(key: string): Promise<T | null> {
    const value = await AsyncStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  }

  _remove(key: string) {
    return AsyncStorage.removeItem(key);
  }

  _addListener() {}

  _removeListener() {}
};

const createAuth = () => {
  if (Platform.OS === 'web') {
    return getAuth(firebaseApp);
  }

  try {
    return initializeAuth(firebaseApp, {
      persistence: reactNativePersistence as any
    });
  } catch {
    return getAuth(firebaseApp);
  }
};

const createDb = () => {
  try {
    return initializeFirestore(firebaseApp, {
      experimentalAutoDetectLongPolling: true
    });
  } catch {
    return getFirestore(firebaseApp);
  }
};

export const auth = createAuth();
export const db = createDb();

const useEmulators = process.env.EXPO_PUBLIC_USE_EMULATORS === 'true';
const emulatorHost = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST || '127.0.0.1';

if (useEmulators) {
  connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, emulatorHost, 8080);
}

export default firebaseApp;
