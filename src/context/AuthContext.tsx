import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  isOwner: boolean;
  signInWithGoogle: () => Promise<void>;
  logOut: () => Promise<void>;
  authError: string | null;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Authorized owner emails for Aqua Plus RO Tech.
const AUTHORIZED_OWNER_EMAILS = [
  'nisanth.t9c@gmail.com',
  'aquaplusrosales@gmail.com',
  'vishaalchinnan@gmail.com',
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
      setAuthError(null);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      setAuthError(null);
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error('Google sign in error:', err);
      setAuthError(err?.message || 'Failed to sign in with Google');
    }
  };

  const logOut = async () => {
    try {
      await signOut(auth);
    } catch (err: any) {
      console.error('Sign out error:', err);
    }
  };

  const clearAuthError = () => setAuthError(null);

  // Require the verified owner email allowlist used by the Firestore rules.
  const isOwner = !!currentUser &&
    currentUser.emailVerified &&
    AUTHORIZED_OWNER_EMAILS.includes(currentUser.email?.toLowerCase() || '');
  return (
    <AuthContext.Provider
      value={{
        currentUser,
        loading,
        isOwner,
        signInWithGoogle,
        logOut,
        authError,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
