import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { connectFirestoreEmulator, initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDThq7iVWxtz1qjLWeZTZhtXOAQX0_Ofy4',
  authDomain: 'watercan-6e6d4.firebaseapp.com',
  projectId: 'watercan-6e6d4',
  storageBucket: 'watercan-6e6d4.firebasestorage.app',
  messagingSenderId: '128994132896',
  appId: '1:128994132896:web:57d0af63d291208349dac5'
};

export { firebaseConfig };
export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = initializeFirestore(firebaseApp, {
  experimentalForceLongPolling: true
});

const useEmulators = process.env.EXPO_PUBLIC_USE_EMULATORS === 'true';
const emulatorHost = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST || '127.0.0.1';

if (useEmulators) {
  connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, emulatorHost, 8080);
}

export default firebaseApp;
