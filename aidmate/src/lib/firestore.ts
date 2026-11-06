import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  QueryConstraint,
  CollectionReference,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
  DocumentData,
  WithFieldValue,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  User,
  AidmateProfile,
  Job,
  JobOffer,
  Application,
  Conversation,
  Message,
  Payment,
  Review,
  Dispute,
  AppNotification,
  AdminAuditLog,
} from '@/types';

/**
 * Recursively converts Firestore Timestamps to JavaScript Date objects.
 */
export function convertTimestamps<T>(data: unknown): T {
  if (data === null || data === undefined) {
    return data as T;
  }

  // Handle Firestore Timestamp
  if (typeof data === 'object' && data !== null && 'toDate' in data && typeof (data as { toDate: () => Date }).toDate === 'function') {
    return (data as { toDate: () => Date }).toDate() as unknown as T;
  }

  // Handle Array
  if (Array.isArray(data)) {
    return data.map((item) => convertTimestamps(item)) as unknown as T;
  }

  // Handle Object
  if (typeof data === 'object' && data.constructor === Object) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = convertTimestamps(value);
    }
    return result as T;
  }

  return data as T;
}

/**
 * Creates a strongly typed generic FirestoreDataConverter.
 * Handles automatic serialization and deserialization of Timestamps <-> Dates.
 */
export function createConverter<T extends DocumentData>(): FirestoreDataConverter<T> {
  return {
    toFirestore(modelObject: WithFieldValue<T>): DocumentData {
      return modelObject as DocumentData;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): T {
      const data = snapshot.data(options);
      return convertTimestamps<T>({
        ...data,
      });
    },
  };
}

// Collection References with strict typing
export const usersRef: CollectionReference<User> = collection(db, 'users').withConverter(
  createConverter<User>()
);

export const aidmateProfilesRef: CollectionReference<AidmateProfile> = collection(
  db,
  'aidmateProfiles'
).withConverter(createConverter<AidmateProfile>());

export const jobsRef: CollectionReference<Job> = collection(db, 'jobs').withConverter(
  createConverter<Job>()
);

export const jobOffersRef: CollectionReference<JobOffer> = collection(
  db,
  'jobOffers'
).withConverter(createConverter<JobOffer>());

export const applicationsRef: CollectionReference<Application> = collection(
  db,
  'applications'
).withConverter(createConverter<Application>());

export const conversationsRef: CollectionReference<Conversation> = collection(
  db,
  'conversations'
).withConverter(createConverter<Conversation>());

export const messagesRef: CollectionReference<Message> = collection(
  db,
  'messages'
).withConverter(createConverter<Message>());

export const getConversationMessagesRef = (
  conversationId: string
): CollectionReference<Message> => {
  return collection(db, 'conversations', conversationId, 'messages').withConverter(
    createConverter<Message>()
  );
};

export const paymentsRef: CollectionReference<Payment> = collection(
  db,
  'payments'
).withConverter(createConverter<Payment>());

export const reviewsRef: CollectionReference<Review> = collection(
  db,
  'reviews'
).withConverter(createConverter<Review>());

export const disputesRef: CollectionReference<Dispute> = collection(
  db,
  'disputes'
).withConverter(createConverter<Dispute>());

export const notificationsRef: CollectionReference<AppNotification> = collection(
  db,
  'notifications'
).withConverter(createConverter<AppNotification>());

export const adminAuditLogsRef: CollectionReference<AdminAuditLog> = collection(
  db,
  'adminAuditLogs'
).withConverter(createConverter<AdminAuditLog>());

/**
 * Generic Helper Functions
 */

/**
 * Create a new document in a collection with an optional custom ID.
 * Returns the document ID.
 */
export async function createDoc<T extends DocumentData>(
  collectionRef: CollectionReference<T>,
  data: WithFieldValue<T>,
  customId?: string
): Promise<string> {
  if (customId) {
    const docRef = doc(collectionRef, customId);
    await setDoc(docRef, data);
    return customId;
  } else {
    const docRef = doc(collectionRef);
    await setDoc(docRef, { ...data, [collectionRef.id === 'jobs' ? 'jobId' : 'id']: docRef.id });
    return docRef.id;
  }
}

/**
 * Update an existing document by its ID.
 */
export async function updateDocById<T extends DocumentData>(
  collectionRef: CollectionReference<T>,
  id: string,
  data: Partial<T>
): Promise<void> {
  const docRef = doc(collectionRef, id);
  await updateDoc(docRef, data as DocumentData);
}

/**
 * Fetch a single document by its ID. Returns null if not found.
 */
export async function getDocById<T extends DocumentData>(
  collectionRef: CollectionReference<T>,
  id: string
): Promise<T | null> {
  const docRef = doc(collectionRef, id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    return null;
  }
  return snap.data();
}

/**
 * Query documents in a collection with arbitrary Firestore query constraints.
 */
export async function queryDocs<T extends DocumentData>(
  collectionRef: CollectionReference<T>,
  ...queryConstraints: QueryConstraint[]
): Promise<T[]> {
  const q = query(collectionRef, ...queryConstraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data());
}

export { serverTimestamp, Timestamp };
