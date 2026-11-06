import {
  ref,
  set,
  remove,
  onValue,
  onDisconnect,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/database';
import { rtdb } from './firebase';
import type { LocationUpdate, UserPresence } from '@/types';

/**
 * Updates the real-time GPS location of a user (Aidmate or Requester) for an active job.
 * Path: /locations/{jobId}/{userId}
 *
 * @param jobId The associated Job ID
 * @param userId The ID of the user whose location is being broadcasted
 * @param location The LocationUpdate payload
 */
export async function updateLocation(
  jobId: string,
  userId: string,
  location: LocationUpdate
): Promise<void> {
  const locationRef = ref(rtdb, `locations/${jobId}/${userId}`);
  await set(locationRef, {
    lat: location.lat,
    lng: location.lng,
    heading: location.heading ?? null,
    speed: location.speed ?? null,
    accuracy: location.accuracy,
    timestamp: location.timestamp || Date.now(),
  });
}

/**
 * Subscribes to real-time location updates for a specific user on a job.
 * Returns an Unsubscribe function to stop listening.
 *
 * @param jobId The associated Job ID
 * @param userId The ID of the user whose location to listen to
 * @param callback Handler receiving the updated location or null if cleared
 * @returns Unsubscribe function
 */
export function subscribeToLocation(
  jobId: string,
  userId: string,
  callback: (location: LocationUpdate | null) => void
): Unsubscribe {
  const locationRef = ref(rtdb, `locations/${jobId}/${userId}`);

  return onValue(
    locationRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val() as LocationUpdate;
        callback(val);
      } else {
        callback(null);
      }
    },
    (error) => {
      console.error(`[RTDB] Error subscribing to location for ${userId} in job ${jobId}:`, error);
      callback(null);
    }
  );
}

/**
 * Sets user online presence in Realtime Database.
 * When isOnline is true, automatically configures onDisconnect to mark offline.
 * Path: /presence/{uid}
 *
 * @param uid User ID
 * @param isOnline Whether the user is currently active/online
 */
export async function setUserPresence(uid: string, isOnline: boolean): Promise<void> {
  if (!uid) return;

  const presenceRef = ref(rtdb, `presence/${uid}`);

  if (isOnline) {
    // Set online status
    await set(presenceRef, {
      isOnline: true,
      lastChanged: serverTimestamp(),
    });

    // Automatically transition to offline on disconnect
    onDisconnect(presenceRef).set({
      isOnline: false,
      lastChanged: serverTimestamp(),
    });
  } else {
    await set(presenceRef, {
      isOnline: false,
      lastChanged: serverTimestamp(),
    });
  }
}

/**
 * Subscribes to a user's presence state in Realtime Database.
 *
 * @param uid User ID
 * @param callback Handler receiving presence update or null
 * @returns Unsubscribe function
 */
export function subscribeToUserPresence(
  uid: string,
  callback: (presence: UserPresence | null) => void
): Unsubscribe {
  const presenceRef = ref(rtdb, `presence/${uid}`);

  return onValue(
    presenceRef,
    (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val() as UserPresence);
      } else {
        callback(null);
      }
    },
    (error) => {
      console.error(`[RTDB] Error subscribing to presence for ${uid}:`, error);
      callback(null);
    }
  );
}

/**
 * Cleans up and deletes all real-time tracking data for a completed/cancelled job.
 * Path: /locations/{jobId}
 *
 * @param jobId The Job ID
 */
export async function removeLocationData(jobId: string): Promise<void> {
  if (!jobId) return;
  const jobLocationsRef = ref(rtdb, `locations/${jobId}`);
  await remove(jobLocationsRef);
}
