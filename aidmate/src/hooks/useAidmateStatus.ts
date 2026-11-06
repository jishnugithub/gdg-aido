import { useState, useEffect, useCallback } from 'react';
import {
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { AidmateProfile } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/contexts/LocationContext';

export interface UseAidmateStatusReturn {
  isAvailable: boolean;
  isBusy: boolean;
  aidmateProfile: AidmateProfile | null;
  loading: boolean;
  toggleAvailability: () => Promise<void>;
  updateServiceCategories: (categories: string[]) => Promise<void>;
}

export const useAidmateStatus = (): UseAidmateStatusReturn => {
  const { user } = useAuth();
  const { currentLocation, startTracking, stopTracking } = useLocation();

  const [aidmateProfile, setAidmateProfile] = useState<AidmateProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Subscribe to real-time aidmate profile doc in Firestore
  useEffect(() => {
    if (!user?.uid) {
      setAidmateProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const profileDocRef = doc(db, 'aidmateProfiles', user.uid);

    const unsubscribe = onSnapshot(
      profileDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();

          const parseDate = (val: unknown): Date => {
            if (!val) return new Date();
            if (val instanceof Timestamp) return val.toDate();
            if (typeof (val as { toDate?: () => Date }).toDate === 'function') {
              return (val as { toDate: () => Date }).toDate();
            }
            if (val instanceof Date) return val;
            return new Date(String(val));
          };

          const profile: AidmateProfile = {
            uid: user.uid,
            isAvailable: Boolean(data.isAvailable),
            isBusy: Boolean(data.isBusy),
            serviceCategories: Array.isArray(data.serviceCategories) ? data.serviceCategories : [],
            averageRating: typeof data.averageRating === 'number' ? data.averageRating : 5.0,
            completedJobs: typeof data.completedJobs === 'number' ? data.completedJobs : 0,
            availabilityUpdatedAt: parseDate(data.availabilityUpdatedAt),
            currentLocation: data.currentLocation || undefined,
          };

          setAidmateProfile(profile);
        } else {
          setAidmateProfile(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error('[useAidmateStatus] Error subscribing to aidmate profile:', error);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user?.uid]);

  // Toggle availability status with automatic location tracking integration
  const toggleAvailability = useCallback(async (): Promise<void> => {
    if (!user?.uid) {
      throw new Error('User must be authenticated to toggle Aidmate status');
    }

    const nextAvailableState = !(aidmateProfile?.isAvailable ?? false);
    const profileDocRef = doc(db, 'aidmateProfiles', user.uid);

    try {
      if (nextAvailableState) {
        // Start continuous GPS tracking when turning online
        startTracking();

        await setDoc(
          profileDocRef,
          {
            uid: user.uid,
            isAvailable: true,
            isBusy: aidmateProfile?.isBusy ?? false,
            availabilityUpdatedAt: serverTimestamp(),
            ...(currentLocation ? { currentLocation } : {}),
          },
          { merge: true }
        );
      } else {
        // Stop continuous GPS tracking when turning offline
        stopTracking();

        await setDoc(
          profileDocRef,
          {
            uid: user.uid,
            isAvailable: false,
            availabilityUpdatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
    } catch (error) {
      console.error('[useAidmateStatus] Failed to toggle availability:', error);
      throw error;
    }
  }, [user?.uid, aidmateProfile, currentLocation, startTracking, stopTracking]);

  // Update categories of service provided
  const updateServiceCategories = useCallback(
    async (categories: string[]): Promise<void> => {
      if (!user?.uid) {
        throw new Error('User must be authenticated');
      }
      const profileDocRef = doc(db, 'aidmateProfiles', user.uid);
      await setDoc(
        profileDocRef,
        {
          uid: user.uid,
          serviceCategories: categories,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    },
    [user?.uid]
  );

  return {
    isAvailable: Boolean(aidmateProfile?.isAvailable),
    isBusy: Boolean(aidmateProfile?.isBusy),
    aidmateProfile,
    loading,
    toggleAvailability,
    updateServiceCategories,
  };
};
