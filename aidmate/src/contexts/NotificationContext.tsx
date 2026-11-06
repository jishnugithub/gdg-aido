import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { AppNotification } from '@/types';
import { useAuth } from './AuthContext';

export interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

export const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Subscribe to real-time notifications for the authenticated user
  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedNotifications: AppNotification[] = snapshot.docs.map((docSnap) => {
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

          return {
            notificationId: docSnap.id,
            userId: data.userId || user.uid,
            type: data.type,
            title: data.title || '',
            message: data.message || '',
            relatedJobId: data.relatedJobId ?? null,
            isRead: Boolean(data.isRead),
            createdAt: parseDate(data.createdAt),
          };
        });

        setNotifications(fetchedNotifications);
        setLoading(false);
      },
      (error) => {
        console.error('[NotificationContext] Error fetching notifications:', error);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user?.uid]);

  // Mark a single notification as read
  const markAsRead = useCallback(async (notificationId: string): Promise<void> => {
    try {
      const notifRef = doc(db, 'notifications', notificationId);
      await updateDoc(notifRef, { isRead: true });

      setNotifications((prev) =>
        prev.map((n) => (n.notificationId === notificationId ? { ...n, isRead: true } : n))
      );
    } catch (error) {
      console.error('[NotificationContext] Error marking notification as read:', error);
      throw error;
    }
  }, []);

  // Mark all unread notifications as read via batch
  const markAllAsRead = useCallback(async (): Promise<void> => {
    const unread = notifications.filter((n) => !n.isRead);
    if (unread.length === 0) return;

    try {
      const batch = writeBatch(db);
      unread.forEach((n) => {
        const notifRef = doc(db, 'notifications', n.notificationId);
        batch.update(notifRef, { isRead: true });
      });

      await batch.commit();

      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (error) {
      console.error('[NotificationContext] Error marking all notifications as read:', error);
      throw error;
    }
  }, [notifications]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.isRead).length;
  }, [notifications]);

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
