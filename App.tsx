import React, { createContext, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import LoadingScreen from './src/screens/LoadingScreen';
import { onAuthStateChangedListener, getUserProfile, signOutUser } from './src/services/firebaseService';
import { User as FirebaseUser } from 'firebase/auth';
import { LanguageProvider } from './src/i18n/LanguageContext';

if (typeof console !== 'undefined') {
  const _warn = console.warn.bind(console);
  console.warn = (...args: any[]) => {
    if (typeof args[0] === 'string' && args[0].includes('Cannot record touch end without a touch start')) return;
    _warn(...args);
  };
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

  const refreshProfile = async () => {
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
  };

  const signOut = async () => {
    setAuthError('');
    await signOutUser();
  };

  const getStartupAuthError = (error: unknown) => {
    const firebaseError = error as { code?: string; message?: string } | null;
    const message = firebaseError?.message?.toLowerCase() ?? '';

    if (firebaseError?.code === 'profile/forbidden' || firebaseError?.code === 'permission-denied') {
      return 'Please sign in again.';
    }

    if (
      firebaseError?.code === 'unavailable' ||
      firebaseError?.code === 'failed-precondition' ||
      message.includes('client is offline') ||
      message.includes('offline')
    ) {
      return 'Connection blocked. Disable browser blocker or extension and try again.';
    }

    return 'Please sign in again.';
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
    [user, profile, authError, initializing]
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
