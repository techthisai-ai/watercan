import './src/polyfills/url';
import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import LoadingScreen from './src/screens/LoadingScreen';
import {
  ensureInitialFirestoreData,
  onAuthStateChangedListener,
  getFriendlyFirebaseAuthMessage,
  getUserProfile,
  signOutUser
} from './src/services/firebaseService';
import type { User as FirebaseUser } from 'firebase/auth';
import { LanguageProvider } from './src/i18n/LanguageContext';
if (typeof console !== 'undefined') {
  const _warn = console.warn.bind(console);
  const _error = console.error.bind(console);
  const _log = console.log.bind(console);
  const suppress = (args: any[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : JSON.stringify(args[0] ?? '');
    return msg.includes('Cannot record touch end') ||
      msg.includes('Unexpected text node') ||
      msg.includes('resource-exhausted') ||
      msg.includes('RestConnection RPC') ||
      msg.includes('@firebase/firestore') ||
      msg.includes('429') ||
      msg.includes('Too Many Requests');
  };
  console.warn = (...args: any[]) => { if (!suppress(args)) _warn(...args); };
  console.error = (...args: any[]) => { if (!suppress(args)) _error(...args); };
  console.log = (...args: any[]) => { if (!suppress(args)) _log(...args); };
}

export type UserProfile = {
  uid: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  role: 'customer' | 'owner';
  approved: boolean;
};

export type AuthContextType = {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  authError: string;
  initializing: boolean;
  refreshProfile: () => Promise<void>;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  authError: '',
  initializing: true,
  refreshProfile: async () => {},
  setProfile: () => {},
  signOut: async () => {}
});

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authError, setAuthError] = useState('');
  const [initializing, setInitializing] = useState(true);

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }
    try {
      const profileData = await getUserProfile(user.uid);
      setProfile(profileData);
      setAuthError('');
    } catch (error) {
      console.error('Failed to refresh profile', error);
      setProfile(null);
    }
  }, [user]);

  const signOut = useCallback(async () => {
    setAuthError('');
    await signOutUser();
  }, []);

  const getStartupAuthError = (error: unknown) => {
    return getFriendlyFirebaseAuthMessage(error, 'profile');
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChangedListener(async (authUser) => {
      setInitializing(true);
      setUser(authUser);
      if (!authUser) {
        setProfile(null);
        setInitializing(false);
        return;
      }

      try {
        await ensureInitialFirestoreData().catch(() => {});
        const profileData = await getUserProfile(authUser.uid);
        setProfile(profileData);
        setAuthError('');
      } catch (error) {
        console.warn('Failed to load user profile during app startup', error);
        setAuthError(getStartupAuthError(error));
        await signOutUser();
        setUser(null);
        setProfile(null);
      } finally {
        setInitializing(false);
      }
    });
    return unsubscribe;
  }, []);

  const authContextValue = useMemo(
    () => ({ user, profile, authError, initializing, refreshProfile, setProfile, signOut }),
    [user, profile, authError, initializing, refreshProfile, signOut]
  );

  if (initializing) {
    return <LoadingScreen />;
  }

  return (
    <LanguageProvider>
      <AuthContext.Provider value={authContextValue}>
        <View style={styles.container}>
          <AppNavigator />
        </View>
      </AuthContext.Provider>
    </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  }
});
