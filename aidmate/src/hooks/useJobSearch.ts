import { useState, useCallback } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  type DocumentData,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Job, GeoPoint, JobStatus, PaymentStatus, PaymentMethod, JobMode } from '@/types';

export interface SearchFilters {
  category?: string;
  maxDistance?: number; // In kilometers
  minAmount?: number;
  maxAmount?: number;
  deadline?: Date;
  sortBy?: 'distance' | 'amount_high' | 'amount_low' | 'newest';
  userLocation?: GeoPoint;
}

export interface UseJobSearchReturn {
  results: Job[];
  loading: boolean;
  error: string | null;
  search: (searchQuery: string, filters?: SearchFilters) => Promise<void>;
  clearSearch: () => void;
}

/**
 * Calculates great-circle distance between two geographic coordinates in kilometers (Haversine formula).
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Tokenizes a string into unique lowercase alphanumeric tokens for searching.
 */
export function tokenizeSearchQuery(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .map((w) => w.trim())
        .filter((w) => w.length >= 2)
    )
  );
}

export const useJobSearch = (): UseJobSearchReturn => {
  const [results, setResults] = useState<Job[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Helper to map Firestore document data to Job model
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

  const search = useCallback(
    async (searchQuery: string, filters?: SearchFilters): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const jobsCollectionRef = collection(db, 'jobs');
        const tokens = tokenizeSearchQuery(searchQuery);

        const constraints: QueryConstraint[] = [where('status', '==', 'posted')];

        if (filters?.category && filters.category !== 'All') {
          constraints.push(where('category', '==', filters.category));
        }

        if (tokens.length > 0) {
          // Firestore array-contains-any supports up to 10 items
          constraints.push(where('searchTokens', 'array-contains-any', tokens.slice(0, 10)));
        }

        let fetchedDocs: DocumentData[] = [];

        try {
          const q = query(jobsCollectionRef, ...constraints);
          const snapshot = await getDocs(q);
          fetchedDocs = snapshot.docs.map((d) => ({ id: d.id, data: d.data() }));
        } catch (queryErr) {
          // Fallback if composite index is pending or not created yet
          console.warn('[useJobSearch] Index query fallback triggered:', queryErr);
          const fallbackQ = query(jobsCollectionRef, where('status', '==', 'posted'));
          const snapshot = await getDocs(fallbackQ);
          fetchedDocs = snapshot.docs.map((d) => ({ id: d.id, data: d.data() }));
        }

        let jobs: Job[] = fetchedDocs.map(({ id, data }) => mapDocToJob(id, data));

        // In-memory token filter if fallback was used or extra tokens exist
        if (tokens.length > 0) {
          jobs = jobs.filter((job) => {
            const jobTokens = job.searchTokens || [];
            const textContent = `${job.title} ${job.description} ${job.category}`.toLowerCase();
            return tokens.some(
              (token) => jobTokens.includes(token) || textContent.includes(token)
            );
          });
        }

        // Apply category filter in-memory if not already applied
        if (filters?.category && filters.category !== 'All') {
          jobs = jobs.filter((job) => job.category === filters.category);
        }

        // Min amount filter
        if (filters?.minAmount !== undefined) {
          jobs = jobs.filter((job) => job.offeredAmount >= filters.minAmount!);
        }

        // Max amount filter
        if (filters?.maxAmount !== undefined) {
          jobs = jobs.filter((job) => job.offeredAmount <= filters.maxAmount!);
        }

        // Deadline filter
        if (filters?.deadline) {
          const maxDeadline = filters.deadline.getTime();
          jobs = jobs.filter((job) => job.deadline && job.deadline.getTime() <= maxDeadline);
        }

        // Distance filter
        if (filters?.maxDistance !== undefined && filters?.userLocation) {
          const userLat = filters.userLocation.lat;
          const userLng = filters.userLocation.lng;
          jobs = jobs.filter((job) => {
            if (!job.taskLocation) return false;
            const dist = calculateDistanceKm(
              userLat,
              userLng,
              job.taskLocation.lat,
              job.taskLocation.lng
            );
            return dist <= filters.maxDistance!;
          });
        }

        // Sorting
        const sortBy = filters?.sortBy || 'newest';
        jobs.sort((a, b) => {
          if (sortBy === 'amount_high') {
            return b.offeredAmount - a.offeredAmount;
          }
          if (sortBy === 'amount_low') {
            return a.offeredAmount - b.offeredAmount;
          }
          if (sortBy === 'distance' && filters?.userLocation) {
            const distA = calculateDistanceKm(
              filters.userLocation.lat,
              filters.userLocation.lng,
              a.taskLocation.lat,
              a.taskLocation.lng
            );
            const distB = calculateDistanceKm(
              filters.userLocation.lat,
              filters.userLocation.lng,
              b.taskLocation.lat,
              b.taskLocation.lng
            );
            return distA - distB;
          }
          // Default: newest first
          return b.createdAt.getTime() - a.createdAt.getTime();
        });

        setResults(jobs);
      } catch (err) {
        console.error('[useJobSearch] Search error:', err);
        setError('Failed to search jobs. Please try again.');
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const clearSearch = useCallback(() => {
    setResults([]);
    setError(null);
    setLoading(false);
  }, []);

  return {
    results,
    loading,
    error,
    search,
    clearSearch,
  };
};
