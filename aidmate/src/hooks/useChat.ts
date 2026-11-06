import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Message } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

export interface UseChatReturn {
  messages: Message[];
  loading: boolean;
  sending: boolean;
  error: string | null;
  sendMessage: (text: string, mediaURL?: string) => Promise<void>;
  markMessagesAsRead: () => Promise<void>;
}

export const useChat = (conversationId: string | undefined): UseChatReturn => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [sending, setSending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const messagesRef = useRef<Message[]>([]);
  messagesRef.current = messages;

  // Mark all unread incoming messages as read
  const markMessagesAsRead = useCallback(async () => {
    if (!conversationId || !user?.uid) return;

    try {
      const unreadIncoming = messagesRef.current.filter(
        (m) => m.senderId !== user.uid && m.readAt === null
      );

      if (unreadIncoming.length === 0) return;

      const batch = writeBatch(db);
      unreadIncoming.forEach((msg) => {
        const msgDocRef = doc(db, 'conversations', conversationId, 'messages', msg.messageId);
        batch.update(msgDocRef, { readAt: serverTimestamp() });
      });

      await batch.commit();
    } catch (err) {
      console.error('[useChat] Error marking messages as read:', err);
    }
  }, [conversationId, user?.uid]);

  // Subscribe to real-time conversation messages
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const msgsCollectionRef = collection(db, 'conversations', conversationId, 'messages');
    const q = query(msgsCollectionRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const parseDate = (val: unknown): Date => {
          if (!val) return new Date();
          if (val instanceof Timestamp) return val.toDate();
          if (typeof (val as { toDate?: () => Date }).toDate === 'function') {
            return (val as { toDate: () => Date }).toDate();
          }
          if (val instanceof Date) return val;
          return new Date(String(val));
        };

        const loadedMessages: Message[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            messageId: docSnap.id,
            conversationId,
            senderId: (data.senderId as string) || '',
            message: (data.message as string) || '',
            mediaURL: (data.mediaURL as string) || null,
            createdAt: parseDate(data.createdAt),
            readAt: data.readAt ? parseDate(data.readAt) : null,
          };
        });

        setMessages(loadedMessages);
        setLoading(false);

        // Auto-mark incoming unread messages as read
        if (user?.uid) {
          const unreadFromOthers = snapshot.docs.filter((d) => {
            const data = d.data();
            return data.senderId !== user.uid && !data.readAt;
          });

          if (unreadFromOthers.length > 0) {
            const batch = writeBatch(db);
            unreadFromOthers.forEach((d) => {
              batch.update(d.ref, { readAt: serverTimestamp() });
            });
            batch.commit().catch((e) => {
              console.warn('[useChat] Auto-read receipt failed:', e);
            });
          }
        }
      },
      (err) => {
        console.error('[useChat] Error fetching messages:', err);
        setError('Failed to load messages');
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [conversationId, user?.uid]);

  // Send a message
  const sendMessage = useCallback(
    async (text: string, mediaURL?: string): Promise<void> => {
      if (!conversationId) {
        throw new Error('Cannot send message without a valid conversationId');
      }
      if (!user?.uid) {
        throw new Error('User must be logged in to send a message');
      }

      const trimmedText = text.trim();
      if (!trimmedText && !mediaURL) {
        return;
      }

      setSending(true);
      setError(null);

      try {
        const msgsCollectionRef = collection(db, 'conversations', conversationId, 'messages');
        const newMsgDocRef = doc(msgsCollectionRef);

        const newMsgData = {
          messageId: newMsgDocRef.id,
          conversationId,
          senderId: user.uid,
          message: trimmedText,
          mediaURL: mediaURL ?? null,
          createdAt: serverTimestamp(),
          readAt: null,
        };

        // Create message in subcollection
        await setDoc(newMsgDocRef, newMsgData);

        // Update lastMessage on the conversation parent document
        const convDocRef = doc(db, 'conversations', conversationId);
        const lastPreview = trimmedText || (mediaURL ? '📷 Shared an image' : '');

        await updateDoc(convDocRef, {
          lastMessage: lastPreview,
          lastMessageAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).catch(async (convErr) => {
          // If conversation document doesn't exist yet, create with merge
          console.warn('[useChat] Parent conversation update fallback:', convErr);
          await setDoc(
            convDocRef,
            {
              conversationId,
              lastMessage: lastPreview,
              lastMessageAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        });
      } catch (err) {
        console.error('[useChat] Failed to send message:', err);
        setError('Failed to send message');
        throw err;
      } finally {
        setSending(false);
      }
    },
    [conversationId, user?.uid]
  );

  return {
    messages,
    loading,
    sending,
    error,
    sendMessage,
    markMessagesAsRead,
  };
};
