import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'fake-api-key',
  authDomain: 'demo-watercan.firebaseapp.com',
  projectId: 'demo-watercan',
  storageBucket: 'demo-watercan.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:demo'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
connectFirestoreEmulator(db, '127.0.0.1', 8080);

const users = [
  {
    name: 'Sample Customer',
    email: '919900001111@phone.local',
    phone: '+91 99000 01111',
    password: 'PhoneLogin#1',
    role: 'customer',
    approved: false
  },
  {
    name: 'Sample Owner',
    email: '919900002222@phone.local',
    phone: '+91 99000 02222',
    password: 'PhoneLogin#1',
    role: 'owner',
    approved: true
  }
];

const seedUser = async (user) => {
  console.log(`Seeding ${user.role}: ${user.phone}`);
  let credential;
  try {
    credential = await createUserWithEmailAndPassword(auth, user.email, user.password);
  } catch (error) {
    if (error?.code === 'auth/email-already-in-use') {
      console.log(`User already exists: ${user.phone}`);
      return;
    }
    throw error;
  }
  await setDoc(doc(db, 'users', credential.user.uid), {
    uid: credential.user.uid,
    name: user.name,
    email: user.email,
    phone: user.phone,
    address: '',
    role: user.role,
    approved: user.approved
  });
  console.log(`Seeded profile for ${user.phone}`);
};

const run = async () => {
  for (const user of users) {
    await seedUser(user);
  }
  console.log('Seeded users:', users.map((u) => `${u.role}: ${u.email}`).join(', '));
  // Close lingering handles in the Firebase SDK.
  setTimeout(() => process.exit(0), 200);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
