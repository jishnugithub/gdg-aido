import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  type ReactNode,
} from 'react';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User as FirebaseUser,
  type ConfirmationResult,
  type UserCredential,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { User } from '@/types';

export interface AuthContextType {
  user: FirebaseUser | null;
  userProfile: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  isNewUser: boolean;
  signInWithPhone: (phoneNumber: string) => Promise<void>;
  verifyOTP: (code: string) => Promise<UserCredential | void>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  refreshUserProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isNewUser, setIsNewUser] = useState<boolean>(false);

  const confirmationResultRef = useRef<ConfirmationResult | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  // Helper to map Firestore user document data to typed User interface
  const mapDocToUserProfile = (uid: string, data: Record<string, unknown>): User => {
    const parseDate = (val: unknown): Date => {
      if (!val) return new Date();
      if (val instanceof Timestamp) return val.toDate();
      if (typeof (val as { toDate?: () => Date }).toDate === 'function') {
        return (val as { toDate: () => Date }).toDate();
      }
      if (val instanceof Date) return val;
      return new Date(String(val));
    };

    return {
      uid,
      fullName: (data.fullName as string) || '',
      phoneNumber: (data.phoneNumber as string) || '',
      photoURL: (data.photoURL as string) || null,
      ratingAverage: typeof data.ratingAverage === 'number' ? data.ratingAverage : 5.0,
      reviewCount: typeof data.reviewCount === 'number' ? data.reviewCount : 0,
      totalJobsCompleted: typeof data.totalJobsCompleted === 'number' ? data.totalJobsCompleted : 0,
      totalJobsRequested: typeof data.totalJobsRequested === 'number' ? data.totalJobsRequested : 0,
      createdAt: parseDate(data.createdAt),
      updatedAt: parseDate(data.updatedAt),
    };
  };

  // Fetch or re-fetch current user profile from Firestore
  const fetchUserProfile = useCallback(async (firebaseUser: FirebaseUser) => {
    try {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const profile = mapDocToUserProfile(firebaseUser.uid, userDocSnap.data() as Record<string, unknown>);
        setUserProfile(profile);
        setIsNewUser(false);
      } else {
        // User exists in Firebase Auth but has no Firestore profile doc yet
        setUserProfile(null);
        setIsNewUser(true);
      }
    } catch (error) {
      console.error('[AuthContext] Error fetching user profile:', error);
      setUserProfile(null);
    }
  }, []);

  // Public profile refresh helper
  const refreshUserProfile = useCallback(async () => {
    if (user) {
      await fetchUserProfile(user);
    }
  }, [user, fetchUserProfile]);

  // Clean up reCAPTCHA verifier instance
  const cleanupRecaptcha = useCallback(() => {
    if (recaptchaVerifierRef.current) {
      try {
        recaptchaVerifierRef.current.clear();
      } catch (err) {
        console.warn('[AuthContext] Error clearing recaptcha verifier:', err);
      }
      recaptchaVerifierRef.current = null;
    }
  }, []);

  // Setup reCAPTCHA verifier instance safely
  const setupRecaptcha = useCallback((): RecaptchaVerifier => {
    cleanupRecaptcha();

    let container = document.getElementById('recaptcha-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'recaptcha-container';
      container.style.display = 'none';
      document.body.appendChild(container);
    }

    const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
      callback: () => {
        // reCAPTCHA solved
      },
      'expired-callback': () => {
        console.warn('[AuthContext] reCAPTCHA expired, renewing...');
      },
    });

    recaptchaVerifierRef.current = verifier;
    return verifier;
  }, [cleanupRecaptcha]);

  // Send verification code to the given phone number
  const signInWithPhone = useCallback(
    async (phoneNumber: string): Promise<void> => {
      try {
        const verifier = setupRecaptcha();
        const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, verifier);
        confirmationResultRef.current = confirmationResult;
      } catch (error) {
        cleanupRecaptcha();
        console.error('[AuthContext] Error signing in with phone:', error);
        throw error;
      }
    },
    [setupRecaptcha, cleanupRecaptcha]
  );

  // Verify the submitted OTP code
  const verifyOTP = useCallback(
    async (code: string): Promise<UserCredential | void> => {
      if (!confirmationResultRef.current) {
        throw new Error('No pending OTP verification request found. Please request an OTP first.');
      }
      try {
        const result = await confirmationResultRef.current.confirm(code);
        confirmationResultRef.current = null;
        cleanupRecaptcha();
        return result;
      } catch (error) {
        console.error('[AuthContext] Error verifying OTP:', error);
        throw error;
      }
    },
    [cleanupRecaptcha]
  );

  // Sign out user
  const signOut = useCallback(async (): Promise<void> => {
    try {
      cleanupRecaptcha();
      confirmationResultRef.current = null;
      await firebaseSignOut(auth);
      setUser(null);
      setUserProfile(null);
      setIsNewUser(false);
    } catch (error) {
      console.error('[AuthContext] Error signing out:', error);
      throw error;
    }
  }, [cleanupRecaptcha]);

  // Update or create user profile in Firestore
  const updateProfile = useCallback(
    async (data: Partial<User>): Promise<void> => {
      if (!user) {
        throw new Error('Cannot update profile: user is not authenticated.');
      }

      const userDocRef = doc(db, 'users', user.uid);

      if (isNewUser || !userProfile) {
        // Create brand new profile
        const newProfile: User = {
          uid: user.uid,
          fullName: data.fullName?.trim() || '',
          phoneNumber: user.phoneNumber || data.phoneNumber || '',
          photoURL: data.photoURL ?? null,
          ratingAverage: 5.0,
          reviewCount: 0,
          totalJobsCompleted: 0,
          totalJobsRequested: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };

        await setDoc(userDocRef, {
          ...newProfile,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        setUserProfile(newProfile);
        setIsNewUser(false);
      } else {
        // Update existing profile
        const updatePayload: Record<string, unknown> = {
          ...data,
          updatedAt: serverTimestamp(),
        };

        await updateDoc(userDocRef, updatePayload);

        setUserProfile((prev) =>
          prev
            ? {
                ...prev,
                ...data,
                updatedAt: new Date(),
              }
            : null
        );
      }
    },
    [user, isNewUser, userProfile]
  );

  // Subscribe to Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await fetchUserProfile(firebaseUser);
      } else {
        setUserProfile(null);
        setIsNewUser(false);
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      cleanupRecaptcha();
    };
  }, [fetchUserProfile, cleanupRecaptcha]);

  const value: AuthContextType = {
    user,
    userProfile,
    loading,
    isAuthenticated: !!user,
    isNewUser,
    signInWithPhone,
    verifyOTP,
    signOut,
    updateProfile,
    refreshUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
