import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Job, JobStatus, PaymentStatus, PaymentMethod, JobMode } from '@/types';
import { useAuth } from './AuthContext';

export const LOCKED_STATUSES: JobStatus[] = [
  'assigned',
  'in_progress',
  'completion_requested',
  'otp_verified',
  'payment_pending',
];

export interface ActiveJobContextType {
  activeJob: Job | null;
  isLocked: boolean;
  loading: boolean;
}

export const ActiveJobContext = createContext<ActiveJobContextType | undefined>(undefined);

interface ActiveJobProviderProps {
  children: ReactNode;
}

export const ActiveJobProvider: React.FC<ActiveJobProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Helper to map Firestore Job doc data into strongly typed Job object
  const mapDocToJob = (id: string, data: DocumentData): Job => {
    const parseDate = (val: unknown): Date | null => {
      if (!val) return null;
      if (val instanceof Timestamp) return val.toDate();
      if (typeof (val as { toDate?: () => Date }).toDate === 'function') {
        return (val as { toDate: () => Date }).toDate();
      }
      if (val instanceof Date) return val;
      return new Date(String(val));
    };

    return {
      jobId: id,
      requesterId: (data.requesterId as string) || '',
      aidmateId: (data.aidmateId as string) || null,
      mode: (data.mode as JobMode) || 'active',
      title: (data.title as string) || '',
      description: (data.description as string) || '',
      category: (data.category as string) || 'Other',
      tags: Array.isArray(data.tags) ? data.tags : [],
      images: Array.isArray(data.images) ? data.images : [],
      offeredAmount: Number(data.offeredAmount || 0),
      finalAmount: Number(data.finalAmount ?? data.offeredAmount ?? 0),
      taskLocation: data.taskLocation || { lat: 0, lng: 0 },
      taskAddress: (data.taskAddress as string) || '',
      requesterLocation: data.requesterLocation || null,
      deadline: parseDate(data.deadline),
      status: (data.status as JobStatus) || 'posted',
      paymentStatus: (data.paymentStatus as PaymentStatus) || 'not_started',
      paymentMethod: (data.paymentMethod as PaymentMethod) || null,
      searchRadius: Number(data.searchRadius || 5),
      otpAttempts: Number(data.otpAttempts || 0),
      otpExpiresAt: parseDate(data.otpExpiresAt),
      createdAt: parseDate(data.createdAt) || new Date(),
      updatedAt: parseDate(data.updatedAt) || new Date(),
      completedAt: parseDate(data.completedAt),
      cancelledAt: parseDate(data.cancelledAt),
      cancellationReason: (data.cancellationReason as string) || null,
      searchTokens: Array.isArray(data.searchTokens) ? data.searchTokens : [],
    };
  };

  useEffect(() => {
    if (!user?.uid) {
      setActiveJob(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Track active jobs by map for both requester and aidmate roles
    const requesterJobsMap = new Map<string, Job>();
    const aidmateJobsMap = new Map<string, Job>();

    const evaluateActiveJob = () => {
      const combined = [...requesterJobsMap.values(), ...aidmateJobsMap.values()];

      if (combined.length === 0) {
        setActiveJob(null);
      } else {
        // Pick the most recently updated active job
        combined.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        setActiveJob(combined[0]);
      }
      setLoading(false);
    };

    // 1. Query jobs where user is the Requester with locked status
    const requesterQuery = query(
      collection(db, 'jobs'),
      where('requesterId', '==', user.uid),
      where('status', 'in', LOCKED_STATUSES)
    );

    const unsubRequester = onSnapshot(
      requesterQuery,
      (snapshot) => {
        requesterJobsMap.clear();
        snapshot.docs.forEach((docSnap) => {
          requesterJobsMap.set(docSnap.id, mapDocToJob(docSnap.id, docSnap.data()));
        });
        evaluateActiveJob();
      },
      (error) => {
        console.error('[ActiveJobContext] Error listening to requester active jobs:', error);
        setLoading(false);
      }
    );

    // 2. Query jobs where user is the Aidmate with locked status
    const aidmateQuery = query(
      collection(db, 'jobs'),
      where('aidmateId', '==', user.uid),
      where('status', 'in', LOCKED_STATUSES)
    );

    const unsubAidmate = onSnapshot(
      aidmateQuery,
      (snapshot) => {
        aidmateJobsMap.clear();
        snapshot.docs.forEach((docSnap) => {
          aidmateJobsMap.set(docSnap.id, mapDocToJob(docSnap.id, docSnap.data()));
        });
        evaluateActiveJob();
      },
      (error) => {
        console.error('[ActiveJobContext] Error listening to aidmate active jobs:', error);
        setLoading(false);
      }
    );

    return () => {
      unsubRequester();
      unsubAidmate();
    };
  }, [user?.uid]);

  const isLocked = Boolean(activeJob && LOCKED_STATUSES.includes(activeJob.status));

  const value: ActiveJobContextType = {
    activeJob,
    isLocked,
    loading,
  };

  return <ActiveJobContext.Provider value={value}>{children}</ActiveJobContext.Provider>;
};

export const useActiveJob = (): ActiveJobContextType => {
  const context = useContext(ActiveJobContext);
  if (context === undefined) {
    throw new Error('useActiveJob must be used within an ActiveJobProvider');
  }
  return context;
};
