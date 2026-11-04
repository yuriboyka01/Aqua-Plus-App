import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  getRedirectResult,
  signOut,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  isOwner: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<boolean>;
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
    // Check if coming back from a mobile redirect sign-in
    getRedirectResult(auth).catch((err: any) => {
      console.error('Redirect sign-in error:', err);
      if (err?.code === 'auth/unauthorized-domain') {
        const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
        setAuthError(
          `Domain "${hostname}" is not authorized. Add it in Firebase Console -> Authentication -> Settings -> Authorized domains.`
        );
      } else {
        setAuthError(err?.message || 'Failed to complete sign in');
      }
    });

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
      const isMobile = typeof navigator !== 'undefined' &&
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      if (isMobile) {
        // Mobile browsers handle full-page redirects much more reliably than popup tabs
        await signInWithRedirect(auth, googleProvider);
      } else {
        await signInWithPopup(auth, googleProvider);
      }
    } catch (err: any) {
      console.error('Google sign in error:', err);
      if (err?.code === 'auth/unauthorized-domain') {
        const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
        setAuthError(
          `Domain "${hostname}" is not authorized. Add it in Firebase Console -> Authentication -> Settings -> Authorized domains.`
        );
      } else if (err?.code === 'auth/popup-blocked') {
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch (redirectErr: any) {
          setAuthError(redirectErr?.message || 'Failed to sign in with Google');
        }
      } else {
        setAuthError(err?.message || 'Failed to sign in with Google');
      }
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      setAuthError(null);
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err: any) {
      console.error('Email sign in error:', err);
      if (
        err?.code === 'auth/invalid-credential' ||
        err?.code === 'auth/wrong-password' ||
        err?.code === 'auth/user-not-found'
      ) {
        setAuthError('Incorrect email or password. Please verify your credentials.');
      } else if (err?.code === 'auth/operation-not-allowed') {
        setAuthError('Email/Password provider is not enabled in Firebase Console -> Authentication -> Sign-in method.');
      } else {
        setAuthError(err?.message || 'Failed to sign in with email/password');
      }
      throw err;
    }
  };

  const sendPasswordReset = async (email: string): Promise<boolean> => {
    try {
      setAuthError(null);
      await sendPasswordResetEmail(auth, email.trim());
      return true;
    } catch (err: any) {
      console.error('Password reset error:', err);
      setAuthError(err?.message || 'Failed to send password reset email');
      return false;
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

  // Allowlist check for Aqua Plus authorized owner accounts.
  const isOwner = !!currentUser && currentUser.emailVerified &&
    AUTHORIZED_OWNER_EMAILS.includes(currentUser.email?.toLowerCase() || '');
  return (
    <AuthContext.Provider
      value={{
        currentUser,
        loading,
        isOwner,
        signInWithGoogle,
        signInWithEmail,
        sendPasswordReset,
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
