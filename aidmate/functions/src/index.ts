import * as admin from 'firebase-admin';
import { onCall, onRequest, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import Stripe from 'stripe';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Request, Response } from 'express';

// Initialize Firebase Admin SDK singleton
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const rtdb = admin.database();

// Environment configurations
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia' as any,
});

/**
 * Valid Aidmate Job Categories
 */
const VALID_CATEGORIES = [
  'Moving & Lifting',
  'Delivery & Pickup',
  'Cleaning',
  'Repair & Maintenance',
  'Gardening & Outdoors',
  'Tech & Computer Help',
  'Shopping & Errands',
  'Pet Care',
  'Assembly & Installation',
  'Cooking & Food Prep',
  'Tutoring & Education',
  'Event Help',
  'Transportation',
  'Photography',
  'Other',
] as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate Haversine distance between two coordinates in kilometers.
 */
function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

interface NotificationInput {
  userId: string;
  type: string;
  title: string;
  message: string;
  relatedJobId?: string | null;
}

/**
 * Creates an in-app notification document and sends an FCM push if a token exists.
 */
export async function sendNotification(input: NotificationInput): Promise<string> {
  const notifRef = db.collection('notifications').doc();
  const notifData = {
    notificationId: notifRef.id,
    userId: input.userId,
    type: input.type,
    title: input.title,
    message: input.message,
    relatedJobId: input.relatedJobId || null,
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await notifRef.set(notifData);

  // Send Push Notification if FCM token is available
  try {
    const userDoc = await db.collection('users').doc(input.userId).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      const fcmToken = userData?.fcmToken || (Array.isArray(userData?.fcmTokens) ? userData.fcmTokens[0] : null);
      if (fcmToken && typeof fcmToken === 'string') {
        await admin.messaging().send({
          token: fcmToken,
          notification: {
            title: input.title,
            body: input.message,
          },
          data: {
            notificationId: notifRef.id,
            type: input.type,
            relatedJobId: input.relatedJobId || '',
          },
        });
      }
    }
  } catch (error) {
    console.warn(`[sendNotification] FCM push delivery warning for user ${input.userId}:`, error);
  }

  return notifRef.id;
}

/**
 * Writes an immutable administrative audit record.
 */
async function logAdminAction(
  adminId: string,
  action: string,
  entityType: string,
  entityId: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  const auditRef = db.collection('adminAuditLogs').doc();
  await auditRef.set({
    logId: auditRef.id,
    adminId,
    action,
    entityType,
    entityId,
    details,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// ============================================================================
// JOB FUNCTIONS
// ============================================================================

/**
 * dispatchActiveJob (callable)
 * Finds nearby available Aidmates within search radius, creates jobOffers, sends notifications.
 */
export const dispatchActiveJob = onCall(
  { cors: true },
  async (request: CallableRequest<{ jobId: string; searchRadius?: number }>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated.');
    }

    const { jobId, searchRadius } = request.data || {};
    if (!jobId || typeof jobId !== 'string') {
      throw new HttpsError('invalid-argument', 'Valid jobId is required.');
    }

    const jobRef = db.collection('jobs').doc(jobId);
    const jobSnap = await jobRef.get();
    if (!jobSnap.exists) {
      throw new HttpsError('not-found', `Job with ID ${jobId} does not exist.`);
    }

    const job = jobSnap.data()!;

    // Auth check: caller must be requester or admin
    if (job.requesterId !== request.auth.uid && request.auth.token.admin !== true) {
      throw new HttpsError('permission-denied', 'Only the job requester can dispatch this job.');
    }

    if (job.mode !== 'active') {
      throw new HttpsError('invalid-argument', 'Only active-mode jobs can be dispatched.');
    }

    if (['assigned', 'in_progress', 'completed', 'cancelled'].includes(job.status)) {
      throw new HttpsError(
        'failed-precondition',
        `Cannot dispatch job with current status: ${job.status}`
      );
    }

    if (!job.taskLocation || typeof job.taskLocation.lat !== 'number' || typeof job.taskLocation.lng !== 'number') {
      throw new HttpsError('invalid-argument', 'Job must have valid taskLocation coordinates.');
    }

    const effectiveRadius = Number(searchRadius || job.searchRadius || 10);

    // Fetch existing offers for this job to avoid duplicates
    const existingOffersSnap = await db
      .collection('jobOffers')
      .where('jobId', '==', jobId)
      .get();

    const alreadyOfferedAidmateIds = new Set<string>();
    existingOffersSnap.forEach((docSnap) => {
      alreadyOfferedAidmateIds.add(docSnap.data().aidmateId);
    });

    // Fetch active and non-busy Aidmates
    const aidmatesSnap = await db
      .collection('aidmateProfiles')
      .where('isAvailable', '==', true)
      .where('isBusy', '==', false)
      .get();

    interface Candidate {
      uid: string;
      distance: number;
    }

    const eligibleCandidates: Candidate[] = [];

    aidmatesSnap.forEach((docSnap) => {
      const profile = docSnap.data();
      const aidmateUid = profile.uid || docSnap.id;

      // Exclude requester
      if (aidmateUid === request.auth?.uid) return;

      // Exclude already offered
      if (alreadyOfferedAidmateIds.has(aidmateUid)) return;

      // Check category compatibility if specified
      if (
        Array.isArray(profile.serviceCategories) &&
        profile.serviceCategories.length > 0 &&
        job.category &&
        !profile.serviceCategories.includes(job.category)
      ) {
        return;
      }

      // Check location distance
      if (profile.currentLocation && typeof profile.currentLocation.lat === 'number') {
        const dist = calculateHaversineDistanceKm(
          job.taskLocation.lat,
          job.taskLocation.lng,
          profile.currentLocation.lat,
          profile.currentLocation.lng
        );
        if (dist <= effectiveRadius) {
          eligibleCandidates.push({ uid: aidmateUid, distance: dist });
        }
      } else {
        // Fallback default distance within radius if no live location is reported yet
        eligibleCandidates.push({ uid: aidmateUid, distance: effectiveRadius / 2 });
      }
    });

    // Sort by distance ascending
    eligibleCandidates.sort((a, b) => a.distance - b.distance);

    // Limit batch to top 15 candidates
    const selectedCandidates = eligibleCandidates.slice(0, 15);

    const batch = db.batch();
    for (const candidate of selectedCandidates) {
      const offerRef = db.collection('jobOffers').doc();
      batch.set(offerRef, {
        offerId: offerRef.id,
        jobId,
        aidmateId: candidate.uid,
        status: 'pending',
        notifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        respondedAt: null,
        distance: Math.round(candidate.distance * 10) / 10,
      });
    }

    batch.update(jobRef, {
      status: 'searching',
      searchRadius: effectiveRadius,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    // Send notifications to selected Aidmates
    await Promise.all(
      selectedCandidates.map((candidate) =>
        sendNotification({
          userId: candidate.uid,
          type: 'job_available',
          title: 'New Help Request Nearby!',
          message: `Task: "${job.title}" (${Math.round(candidate.distance * 10) / 10} km away) - $${job.offeredAmount}`,
          relatedJobId: jobId,
        })
      )
    );

    return {
      success: true,
      jobId,
      searchRadius: effectiveRadius,
      offersDispatched: selectedCandidates.length,
    };
  }
);

/**
 * acceptJobOffer (callable)
 * Atomically assigns Aidmate to job using transaction, updates job status, notifies requester.
 */
export const acceptJobOffer = onCall(
  { cors: true },
  async (request: CallableRequest<{ offerId: string }>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated.');
    }

    const { offerId } = request.data || {};
    if (!offerId || typeof offerId !== 'string') {
      throw new HttpsError('invalid-argument', 'Valid offerId is required.');
    }

    const aidmateId = request.auth.uid;

    const result = await db.runTransaction(async (transaction) => {
      const offerRef = db.collection('jobOffers').doc(offerId);
      const offerSnap = await transaction.get(offerRef);

      if (!offerSnap.exists) {
        throw new HttpsError('not-found', 'Job offer not found.');
      }

      const offer = offerSnap.data()!;
      if (offer.aidmateId !== aidmateId) {
        throw new HttpsError('permission-denied', 'You are not authorized to accept this offer.');
      }

      if (offer.status !== 'pending') {
        throw new HttpsError('failed-precondition', `Offer is already ${offer.status}.`);
      }

      const jobRef = db.collection('jobs').doc(offer.jobId);
      const jobSnap = await transaction.get(jobRef);

      if (!jobSnap.exists) {
        throw new HttpsError('not-found', 'Job not found.');
      }

      const job = jobSnap.data()!;
      if (job.status !== 'searching' && job.status !== 'posted') {
        throw new HttpsError('failed-precondition', `Job is no longer open for offers (status: ${job.status}).`);
      }

      if (job.aidmateId) {
        throw new HttpsError('failed-precondition', 'Job is already assigned to another Aidmate.');
      }

      const profileRef = db.collection('aidmateProfiles').doc(aidmateId);
      const profileSnap = await transaction.get(profileRef);

      if (profileSnap.exists && profileSnap.data()?.isBusy === true) {
        throw new HttpsError('failed-precondition', 'You are currently busy with another active job.');
      }

      // Mark offer as accepted
      transaction.update(offerRef, {
        status: 'accepted',
        respondedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Assign Job
      transaction.update(jobRef, {
        status: 'assigned',
        aidmateId: aidmateId,
        finalAmount: job.finalAmount || job.offeredAmount || 0,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Mark Aidmate as busy
      transaction.set(
        profileRef,
        {
          isBusy: true,
          availabilityUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return {
        jobId: job.jobId,
        requesterId: job.requesterId,
        jobTitle: job.title,
      };
    });

    // Expire other pending offers for this job
    const otherOffersSnap = await db
      .collection('jobOffers')
      .where('jobId', '==', result.jobId)
      .where('status', '==', 'pending')
      .get();

    if (!otherOffersSnap.empty) {
      const batch = db.batch();
      otherOffersSnap.docs.forEach((docSnap) => {
        if (docSnap.id !== offerId) {
          batch.update(docSnap.ref, {
            status: 'expired',
            respondedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      });
      await batch.commit();
    }

    // Ensure conversation exists between requester and aidmate
    const convQuerySnap = await db
      .collection('conversations')
      .where('jobId', '==', result.jobId)
      .limit(1)
      .get();

    if (convQuerySnap.empty) {
      const convRef = db.collection('conversations').doc();
      await convRef.set({
        conversationId: convRef.id,
        jobId: result.jobId,
        participantIds: [result.requesterId, aidmateId],
        lastMessage: 'Job offer accepted by Aidmate.',
        lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Notify requester
    await sendNotification({
      userId: result.requesterId,
      type: 'job_accepted',
      title: 'Aidmate Assigned!',
      message: `An Aidmate has accepted your task "${result.jobTitle}".`,
      relatedJobId: result.jobId,
    });

    return {
      success: true,
      jobId: result.jobId,
      message: 'Job offer accepted and assigned successfully.',
    };
  }
);

/**
 * declineJobOffer (callable)
 * Marks offer declined, checks if all declined for radius expansion.
 */
export const declineJobOffer = onCall(
  { cors: true },
  async (request: CallableRequest<{ offerId: string }>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated.');
    }

    const { offerId } = request.data || {};
    if (!offerId || typeof offerId !== 'string') {
      throw new HttpsError('invalid-argument', 'Valid offerId is required.');
    }

    const offerRef = db.collection('jobOffers').doc(offerId);
    const offerSnap = await offerRef.get();

    if (!offerSnap.exists) {
      throw new HttpsError('not-found', 'Job offer not found.');
    }

    const offer = offerSnap.data()!;
    if (offer.aidmateId !== request.auth.uid) {
      throw new HttpsError('permission-denied', 'You are not authorized to decline this offer.');
    }

    if (offer.status !== 'pending') {
      return { success: true, message: `Offer was already ${offer.status}.` };
    }

    await offerRef.update({
      status: 'declined',
      respondedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Check if any other pending offers remain for this job
    const pendingOffersSnap = await db
      .collection('jobOffers')
      .where('jobId', '==', offer.jobId)
      .where('status', '==', 'pending')
      .get();

    if (pendingOffersSnap.empty) {
      const jobRef = db.collection('jobs').doc(offer.jobId);
      const jobSnap = await jobRef.get();

      if (jobSnap.exists) {
        const job = jobSnap.data()!;
        if (job.status === 'searching' && !job.aidmateId) {
          const currentRadius = Number(job.searchRadius || 10);
          if (currentRadius < 30) {
            const expandedRadius = Math.min(30, currentRadius + 5);
            await jobRef.update({
              searchRadius: expandedRadius,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            await sendNotification({
              userId: job.requesterId,
              type: 'job_available',
              title: 'Search Radius Expanded',
              message: `No Aidmates responded in ${currentRadius}km. We expanded the search radius to ${expandedRadius}km.`,
              relatedJobId: job.jobId,
            });
          }
        }
      }
    }

    return { success: true, message: 'Offer declined successfully.' };
  }
);

/**
 * cancelJob (callable)
 * Validates cancellation, updates status, releases Aidmate, stops tracking.
 */
export const cancelJob = onCall(
  { cors: true },
  async (request: CallableRequest<{ jobId: string; reason?: string }>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated.');
    }

    const { jobId, reason } = request.data || {};
    if (!jobId || typeof jobId !== 'string') {
      throw new HttpsError('invalid-argument', 'Valid jobId is required.');
    }

    const jobRef = db.collection('jobs').doc(jobId);
    const jobSnap = await jobRef.get();

    if (!jobSnap.exists) {
      throw new HttpsError('not-found', 'Job not found.');
    }

    const job = jobSnap.data()!;
    const isRequester = job.requesterId === request.auth.uid;
    const isAidmate = job.aidmateId === request.auth.uid;
    const isAdmin = request.auth.token.admin === true;

    if (!isRequester && !isAidmate && !isAdmin) {
      throw new HttpsError('permission-denied', 'You do not have permission to cancel this job.');
    }

    if (job.status === 'completed' || job.paymentStatus === 'paid') {
      throw new HttpsError(
        'failed-precondition',
        'Cannot cancel a job that is already completed or paid.'
      );
    }

    const batch = db.batch();

    // Free assigned Aidmate if any
    if (job.aidmateId) {
      const aidmateProfileRef = db.collection('aidmateProfiles').doc(job.aidmateId);
      batch.set(
        aidmateProfileRef,
        {
          isBusy: false,
          availabilityUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    // Expire pending offers
    const pendingOffers = await db
      .collection('jobOffers')
      .where('jobId', '==', jobId)
      .where('status', '==', 'pending')
      .get();

    pendingOffers.docs.forEach((docSnap) => {
      batch.update(docSnap.ref, {
        status: 'expired',
        respondedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    batch.update(jobRef, {
      status: 'cancelled',
      cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
      cancellationReason: reason || 'Cancelled by user',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    // Clean up Realtime Database tracking coordinates
    try {
      await rtdb.ref(`locations/${jobId}`).remove();
    } catch (rtdbErr) {
      console.warn('[cancelJob] RTDB cleanup error:', rtdbErr);
    }

    // Send notifications to the respective parties
    if (isRequester && job.aidmateId) {
      await sendNotification({
        userId: job.aidmateId,
        type: 'job_cancelled',
        title: 'Task Cancelled',
        message: `The requester cancelled the task: "${job.title}". Reason: ${reason || 'Not specified'}.`,
        relatedJobId: jobId,
      });
    } else if (isAidmate) {
      await sendNotification({
        userId: job.requesterId,
        type: 'job_cancelled',
        title: 'Aidmate Cancelled',
        message: `Your assigned Aidmate had to cancel "${job.title}". You can re-dispatch the job.`,
        relatedJobId: jobId,
      });
    }

    return { success: true, message: 'Job cancelled successfully.' };
  }
);

/**
 * increaseJobOffer (callable)
 * Updates job offered amount and notifies all pending Aidmates.
 */
export const increaseJobOffer = onCall(
  { cors: true },
  async (request: CallableRequest<{ jobId: string; newAmount: number }>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated.');
    }

    const { jobId, newAmount } = request.data || {};
    if (!jobId || typeof jobId !== 'string') {
      throw new HttpsError('invalid-argument', 'Valid jobId is required.');
    }

    const numAmount = Number(newAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new HttpsError('invalid-argument', 'newAmount must be a positive number.');
    }

    const jobRef = db.collection('jobs').doc(jobId);
    const jobSnap = await jobRef.get();

    if (!jobSnap.exists) {
      throw new HttpsError('not-found', 'Job not found.');
    }

    const job = jobSnap.data()!;
    if (job.requesterId !== request.auth.uid && request.auth.token.admin !== true) {
      throw new HttpsError('permission-denied', 'Only the requester can increase the offer amount.');
    }

    if (numAmount <= (job.offeredAmount || 0)) {
      throw new HttpsError(
        'invalid-argument',
        `New amount ($${numAmount}) must be greater than current offer ($${job.offeredAmount}).`
      );
    }

    await jobRef.update({
      offeredAmount: numAmount,
      finalAmount: numAmount,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Notify Aidmates with pending offers
    const pendingOffers = await db
      .collection('jobOffers')
      .where('jobId', '==', jobId)
      .where('status', '==', 'pending')
      .get();

    await Promise.all(
      pendingOffers.docs.map((docSnap) =>
        sendNotification({
          userId: docSnap.data().aidmateId,
          type: 'offer_increased',
          title: 'Offer Increased!',
          message: `The offer for task "${job.title}" has been increased to $${numAmount}.`,
          relatedJobId: jobId,
        })
      )
    );

    return { success: true, newAmount: numAmount };
  }
);

/**
 * acceptApplication (callable)
 * For passive jobs: atomically assigns Aidmate, declines other applicants, sends notifications.
 */
export const acceptApplication = onCall(
  { cors: true },
  async (request: CallableRequest<{ applicationId: string }>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated.');
    }

    const { applicationId } = request.data || {};
    if (!applicationId || typeof applicationId !== 'string') {
      throw new HttpsError('invalid-argument', 'Valid applicationId is required.');
    }

    const result = await db.runTransaction(async (transaction) => {
      const appRef = db.collection('applications').doc(applicationId);
      const appSnap = await transaction.get(appRef);

      if (!appSnap.exists) {
        throw new HttpsError('not-found', 'Application not found.');
      }

      const application = appSnap.data()!;
      if (application.status !== 'pending') {
        throw new HttpsError('failed-precondition', `Application is already ${application.status}.`);
      }

      const jobRef = db.collection('jobs').doc(application.jobId);
      const jobSnap = await transaction.get(jobRef);

      if (!jobSnap.exists) {
        throw new HttpsError('not-found', 'Associated job not found.');
      }

      const job = jobSnap.data()!;
      if (job.requesterId !== request.auth?.uid && request.auth?.token.admin !== true) {
        throw new HttpsError('permission-denied', 'Only the job requester can accept applications.');
      }

      if (job.mode !== 'passive') {
        throw new HttpsError('invalid-argument', 'acceptApplication is only for passive-mode jobs.');
      }

      if (job.aidmateId) {
        throw new HttpsError('failed-precondition', 'Job is already assigned to another Aidmate.');
      }

      const aidmateProfileRef = db.collection('aidmateProfiles').doc(application.aidmateId);

      // Update application
      transaction.update(appRef, {
        status: 'accepted',
      });

      // Update job
      transaction.update(jobRef, {
        status: 'assigned',
        aidmateId: application.aidmateId,
        finalAmount: job.finalAmount || job.offeredAmount || 0,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Mark Aidmate as busy
      transaction.set(
        aidmateProfileRef,
        {
          isBusy: true,
          availabilityUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return {
        jobId: job.jobId,
        requesterId: job.requesterId,
        aidmateId: application.aidmateId,
        jobTitle: job.title,
      };
    });

    // Decline other pending applications
    const otherAppsSnap = await db
      .collection('applications')
      .where('jobId', '==', result.jobId)
      .where('status', '==', 'pending')
      .get();

    if (!otherAppsSnap.empty) {
      const batch = db.batch();
      otherAppsSnap.docs.forEach((docSnap) => {
        if (docSnap.id !== applicationId) {
          batch.update(docSnap.ref, { status: 'declined' });
        }
      });
      await batch.commit();

      // Notify declined applicants
      await Promise.all(
        otherAppsSnap.docs.map((docSnap) => {
          if (docSnap.id !== applicationId) {
            return sendNotification({
              userId: docSnap.data().aidmateId,
              type: 'job_cancelled',
              title: 'Application Update',
              message: `Another applicant was selected for "${result.jobTitle}".`,
              relatedJobId: result.jobId,
            });
          }
          return Promise.resolve('');
        })
      );
    }

    // Ensure conversation exists
    const convSnap = await db
      .collection('conversations')
      .where('jobId', '==', result.jobId)
      .limit(1)
      .get();

    if (convSnap.empty) {
      const convRef = db.collection('conversations').doc();
      await convRef.set({
        conversationId: convRef.id,
        jobId: result.jobId,
        participantIds: [result.requesterId, result.aidmateId],
        lastMessage: 'Application accepted by requester.',
        lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Notify accepted applicant
    await sendNotification({
      userId: result.aidmateId,
      type: 'application_accepted',
      title: 'Application Accepted!',
      message: `Your application for "${result.jobTitle}" was accepted by the requester!`,
      relatedJobId: result.jobId,
    });

    return { success: true, jobId: result.jobId };
  }
);

// ============================================================================
// OTP COMPLETION FUNCTIONS
// ============================================================================

/**
 * requestJobCompletion (callable)
 * Generates secure 6-digit OTP using crypto.randomInt, stores SHA-256 hash in Firestore,
 * sends OTP to requester via notification, sets 10-minute expiry.
 */
export const requestJobCompletion = onCall(
  { cors: true },
  async (request: CallableRequest<{ jobId: string }>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated.');
    }

    const { jobId } = request.data || {};
    if (!jobId || typeof jobId !== 'string') {
      throw new HttpsError('invalid-argument', 'Valid jobId is required.');
    }

    const jobRef = db.collection('jobs').doc(jobId);
    const jobSnap = await jobRef.get();

    if (!jobSnap.exists) {
      throw new HttpsError('not-found', 'Job not found.');
    }

    const job = jobSnap.data()!;
    if (job.aidmateId !== request.auth.uid) {
      throw new HttpsError('permission-denied', 'Only the assigned Aidmate can request job completion.');
    }

    if (!['assigned', 'in_progress', 'completion_requested'].includes(job.status)) {
      throw new HttpsError(
        'failed-precondition',
        `Job cannot request completion with status: ${job.status}`
      );
    }

    // Generate secure 6-digit OTP
    const otpNumber = crypto.randomInt(100000, 1000000); // 100000 to 999999 inclusive
    const otpString = otpNumber.toString();
    const otpHash = crypto.createHash('sha256').update(otpString).digest('hex');

    // 10 minutes expiry window
    const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 10 * 60 * 1000);

    await jobRef.update({
      status: 'completion_requested',
      otpHash,
      otpExpiresAt: expiresAt,
      otpAttempts: 0,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Send 6-digit OTP code strictly to requester
    await sendNotification({
      userId: job.requesterId,
      type: 'completion_requested',
      title: 'Confirm Task Completion',
      message: `Your Aidmate has finished "${job.title}". Your 6-digit verification code is: ${otpString}. Provide this code ONLY if you are fully satisfied with the completed work.`,
      relatedJobId: jobId,
    });

    return {
      success: true,
      message: 'Completion verification code sent to requester.',
      expiresAt: expiresAt.toDate().toISOString(),
    };
  }
);

/**
 * verifyJobOTP (callable)
 * Verifies OTP hash, tracks attempts (max 3), on success moves to payment_pending,
 * on 3 failures moves to disputed and auto-creates dispute.
 */
export const verifyJobOTP = onCall(
  { cors: true },
  async (request: CallableRequest<{ jobId: string; otp: string }>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated.');
    }

    const { jobId, otp } = request.data || {};
    if (!jobId || typeof jobId !== 'string') {
      throw new HttpsError('invalid-argument', 'Valid jobId is required.');
    }

    if (!otp || typeof otp !== 'string' || !/^\d{6}$/.test(otp.trim())) {
      throw new HttpsError('invalid-argument', 'A 6-digit OTP verification code is required.');
    }

    const aidmateId = request.auth.uid;
    const cleanOtp = otp.trim();
    const inputHash = crypto.createHash('sha256').update(cleanOtp).digest('hex');

    const result = await db.runTransaction(async (transaction) => {
      const jobRef = db.collection('jobs').doc(jobId);
      const jobSnap = await transaction.get(jobRef);

      if (!jobSnap.exists) {
        throw new HttpsError('not-found', 'Job not found.');
      }

      const job = jobSnap.data()!;
      if (job.aidmateId !== aidmateId && request.auth?.token.admin !== true) {
        throw new HttpsError('permission-denied', 'Only the assigned Aidmate can verify the completion code.');
      }

      if (job.status !== 'completion_requested') {
        throw new HttpsError(
          'failed-precondition',
          `Cannot verify code. Current job status is: ${job.status}`
        );
      }

      // Expiry check
      const now = Date.now();
      const expiresAtMs = job.otpExpiresAt?.toMillis ? job.otpExpiresAt.toMillis() : 0;
      if (now > expiresAtMs) {
        throw new HttpsError(
          'deadline-exceeded',
          'The completion code has expired. Please request a new completion code.'
        );
      }

      const attempts = Number(job.otpAttempts || 0);
      if (attempts >= 3) {
        transaction.update(jobRef, {
          status: 'disputed',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { matched: false, exhausted: true, requesterId: job.requesterId, jobTitle: job.title };
      }

      if (inputHash === job.otpHash) {
        // Hash Match: successful verification
        transaction.update(jobRef, {
          status: 'payment_pending',
          paymentStatus: 'pending',
          otpHash: null,
          otpAttempts: 0,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { matched: true, exhausted: false, requesterId: job.requesterId, jobTitle: job.title };
      } else {
        // Hash Mismatch: increment attempts
        const nextAttempts = attempts + 1;
        if (nextAttempts >= 3) {
          transaction.update(jobRef, {
            status: 'disputed',
            otpHash: null,
            otpAttempts: nextAttempts,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          // Auto-create dispute doc
          const disputeRef = db.collection('disputes').doc();
          transaction.set(disputeRef, {
            disputeId: disputeRef.id,
            jobId,
            raisedBy: 'system',
            reason: 'Excessive Failed OTP Attempts',
            description: 'The completion code was entered incorrectly 3 times consecutively.',
            evidenceURLs: [],
            adminStatus: 'open',
            resolution: null,
            adminNotes: 'Auto-flagged by system security check.',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          return { matched: false, exhausted: true, requesterId: job.requesterId, jobTitle: job.title };
        } else {
          transaction.update(jobRef, {
            otpAttempts: nextAttempts,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          return {
            matched: false,
            exhausted: false,
            attemptsRemaining: 3 - nextAttempts,
            requesterId: job.requesterId,
            jobTitle: job.title,
          };
        }
      }
    });

    if (result.matched) {
      await sendNotification({
        userId: result.requesterId,
        type: 'otp_verified',
        title: 'Task Code Verified!',
        message: `Your code was accepted for "${result.jobTitle}". Please finalize payment to complete the job.`,
        relatedJobId: jobId,
      });

      return {
        success: true,
        verified: true,
        status: 'payment_pending',
        message: 'Completion code verified successfully. Ready for payment.',
      };
    } else if (result.exhausted) {
      await sendNotification({
        userId: result.requesterId,
        type: 'dispute_update',
        title: 'Job Flagged for Dispute',
        message: `Incorrect code entered 3 times for "${result.jobTitle}". The job has been moved to support review.`,
        relatedJobId: jobId,
      });

      throw new HttpsError(
        'resource-exhausted',
        'Maximum verification attempts reached (3/3). This job has been moved to dispute review.'
      );
    } else {
      throw new HttpsError(
        'invalid-argument',
        `Incorrect verification code. ${result.attemptsRemaining} attempt(s) remaining.`
      );
    }
  }
);

// ============================================================================
// PAYMENT FUNCTIONS
// ============================================================================

/**
 * createPaymentIntent (callable)
 * Creates a Stripe PaymentIntent and returns the client secret for Elements/PaymentSheet.
 */
export const createPaymentIntent = onCall(
  { cors: true },
  async (request: CallableRequest<{ jobId: string }>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated.');
    }

    const { jobId } = request.data || {};
    if (!jobId || typeof jobId !== 'string') {
      throw new HttpsError('invalid-argument', 'Valid jobId is required.');
    }

    const jobRef = db.collection('jobs').doc(jobId);
    const jobSnap = await jobRef.get();

    if (!jobSnap.exists) {
      throw new HttpsError('not-found', 'Job not found.');
    }

    const job = jobSnap.data()!;
    if (job.requesterId !== request.auth.uid && request.auth.token.admin !== true) {
      throw new HttpsError('permission-denied', 'Only the requester can pay for this job.');
    }

    const amount = Number(job.finalAmount || job.offeredAmount || 0);
    if (amount <= 0) {
      throw new HttpsError('invalid-argument', 'Job amount must be greater than zero.');
    }

    // Amount in cents for Stripe USD
    const amountInCents = Math.round(amount * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      metadata: {
        jobId: job.jobId,
        requesterId: job.requesterId,
        aidmateId: job.aidmateId || '',
        jobTitle: job.title.substring(0, 50),
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    const paymentRef = db.collection('payments').doc();
    await paymentRef.set({
      paymentId: paymentRef.id,
      jobId: job.jobId,
      requesterId: job.requesterId,
      aidmateId: job.aidmateId || '',
      amount,
      method: 'online',
      provider: 'stripe',
      providerTransactionId: null,
      status: 'pending',
      stripePaymentIntentId: paymentIntent.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await jobRef.update({
      paymentStatus: 'pending',
      paymentMethod: 'online',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      paymentId: paymentRef.id,
      amount,
    };
  }
);

/**
 * handleStripeWebhook (https)
 * Verifies Stripe webhook signature and atomically updates payment + job state on success.
 */
export const handleStripeWebhook = onRequest(
  { cors: true },
  async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'] as string;
    if (!signature) {
      res.status(400).send('Missing Stripe signature header.');
      return;
    }

    let event: Stripe.Event;
    try {
      const rawBody = (req as any).rawBody || req.body;
      event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
    } catch (err: any) {
      console.error('[handleStripeWebhook] Webhook signature verification error:', err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    try {
      switch (event.type) {
        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          const jobId = paymentIntent.metadata?.jobId;
          const requesterId = paymentIntent.metadata?.requesterId;
          const aidmateId = paymentIntent.metadata?.aidmateId;

          if (jobId) {
            const paymentsSnap = await db
              .collection('payments')
              .where('stripePaymentIntentId', '==', paymentIntent.id)
              .get();

            const batch = db.batch();

            paymentsSnap.docs.forEach((docSnap) => {
              batch.update(docSnap.ref, {
                status: 'paid',
                providerTransactionId: paymentIntent.id,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
            });

            const jobRef = db.collection('jobs').doc(jobId);
            batch.update(jobRef, {
              status: 'completed',
              paymentStatus: 'paid',
              completedAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            if (aidmateId) {
              const profileRef = db.collection('aidmateProfiles').doc(aidmateId);
              batch.set(
                profileRef,
                {
                  isBusy: false,
                  completedJobs: admin.firestore.FieldValue.increment(1),
                  availabilityUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
              );

              const aidmateUserRef = db.collection('users').doc(aidmateId);
              batch.update(aidmateUserRef, {
                totalJobsCompleted: admin.firestore.FieldValue.increment(1),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
            }

            if (requesterId) {
              const requesterUserRef = db.collection('users').doc(requesterId);
              batch.update(requesterUserRef, {
                totalJobsRequested: admin.firestore.FieldValue.increment(1),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
            }

            await batch.commit();

            // Clean up Realtime Database tracking coordinates
            try {
              await rtdb.ref(`locations/${jobId}`).remove();
            } catch (rtdbErr) {
              console.warn('[handleStripeWebhook] RTDB cleanup warning:', rtdbErr);
            }

            // Send completion notifications
            if (requesterId) {
              await sendNotification({
                userId: requesterId,
                type: 'job_completed',
                title: 'Payment Confirmed & Task Completed!',
                message: 'Your payment was successful. Please share your feedback and leave a review!',
                relatedJobId: jobId,
              });
            }

            if (aidmateId) {
              await sendNotification({
                userId: aidmateId,
                type: 'payment_success',
                title: 'Payment Received!',
                message: `Payment of $${(paymentIntent.amount / 100).toFixed(2)} confirmed. Job completed!`,
                relatedJobId: jobId,
              });
            }
          }
          break;
        }

        case 'payment_intent.payment_failed': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          const jobId = paymentIntent.metadata?.jobId;
          const requesterId = paymentIntent.metadata?.requesterId;

          if (jobId) {
            const paymentsSnap = await db
              .collection('payments')
              .where('stripePaymentIntentId', '==', paymentIntent.id)
              .get();

            const batch = db.batch();
            paymentsSnap.docs.forEach((docSnap) => {
              batch.update(docSnap.ref, {
                status: 'failed',
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
            });

            const jobRef = db.collection('jobs').doc(jobId);
            batch.update(jobRef, {
              paymentStatus: 'payment_failed',
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            await batch.commit();

            if (requesterId) {
              await sendNotification({
                userId: requesterId,
                type: 'payment_pending',
                title: 'Payment Failed',
                message: 'Payment could not be completed. Please check your card or select another payment method.',
                relatedJobId: jobId,
              });
            }
          }
          break;
        }

        default:
          console.info(`[handleStripeWebhook] Unhandled event type: ${event.type}`);
      }

      res.status(200).json({ received: true });
    } catch (err: any) {
      console.error('[handleStripeWebhook] Error processing webhook event:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

/**
 * confirmCashPayment (callable)
 * Aidmate confirms physical cash received, marks payment cash_confirmed, completes job.
 */
export const confirmCashPayment = onCall(
  { cors: true },
  async (request: CallableRequest<{ jobId: string }>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated.');
    }

    const { jobId } = request.data || {};
    if (!jobId || typeof jobId !== 'string') {
      throw new HttpsError('invalid-argument', 'Valid jobId is required.');
    }

    const aidmateId = request.auth.uid;
    const jobRef = db.collection('jobs').doc(jobId);
    const jobSnap = await jobRef.get();

    if (!jobSnap.exists) {
      throw new HttpsError('not-found', 'Job not found.');
    }

    const job = jobSnap.data()!;
    if (job.aidmateId !== aidmateId && request.auth.token.admin !== true) {
      throw new HttpsError('permission-denied', 'Only the assigned Aidmate can confirm cash payment.');
    }

    if (!['otp_verified', 'payment_pending', 'completion_requested', 'assigned', 'in_progress'].includes(job.status)) {
      throw new HttpsError(
        'failed-precondition',
        `Cannot confirm cash payment for job with status: ${job.status}`
      );
    }

    const amount = Number(job.finalAmount || job.offeredAmount || 0);
    const batch = db.batch();

    // Create payment record
    const paymentRef = db.collection('payments').doc();
    batch.set(paymentRef, {
      paymentId: paymentRef.id,
      jobId: job.jobId,
      requesterId: job.requesterId,
      aidmateId: job.aidmateId,
      amount,
      method: 'cash',
      provider: 'cash',
      providerTransactionId: null,
      status: 'cash_confirmed',
      stripePaymentIntentId: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Mark job completed
    batch.update(jobRef, {
      status: 'completed',
      paymentStatus: 'cash_confirmed',
      paymentMethod: 'cash',
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Free Aidmate profile
    const profileRef = db.collection('aidmateProfiles').doc(job.aidmateId);
    batch.set(
      profileRef,
      {
        isBusy: false,
        completedJobs: admin.firestore.FieldValue.increment(1),
        availabilityUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Update user stats
    const aidmateUserRef = db.collection('users').doc(job.aidmateId);
    batch.update(aidmateUserRef, {
      totalJobsCompleted: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const requesterUserRef = db.collection('users').doc(job.requesterId);
    batch.update(requesterUserRef, {
      totalJobsRequested: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    // Clean up RTDB coordinates
    try {
      await rtdb.ref(`locations/${jobId}`).remove();
    } catch (rtdbErr) {
      console.warn('[confirmCashPayment] RTDB cleanup warning:', rtdbErr);
    }

    // Notify requester
    await sendNotification({
      userId: job.requesterId,
      type: 'cash_received',
      title: 'Cash Payment Confirmed!',
      message: `Your Aidmate confirmed receipt of $${amount} in cash. Job is complete! Please leave a review.`,
      relatedJobId: jobId,
    });

    return {
      success: true,
      message: 'Cash payment confirmed and job completed successfully.',
    };
  }
);

/**
 * completeJob (callable)
 * Finalizes job after payment, unlocks navigation, and triggers review availability.
 */
export const completeJob = onCall(
  { cors: true },
  async (request: CallableRequest<{ jobId: string }>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated.');
    }

    const { jobId } = request.data || {};
    if (!jobId || typeof jobId !== 'string') {
      throw new HttpsError('invalid-argument', 'Valid jobId is required.');
    }

    const jobRef = db.collection('jobs').doc(jobId);
    const jobSnap = await jobRef.get();

    if (!jobSnap.exists) {
      throw new HttpsError('not-found', 'Job not found.');
    }

    const job = jobSnap.data()!;
    const isParticipant =
      job.requesterId === request.auth.uid || job.aidmateId === request.auth.uid;
    const isAdmin = request.auth.token.admin === true;

    if (!isParticipant && !isAdmin) {
      throw new HttpsError('permission-denied', 'You are not authorized to complete this job.');
    }

    const validPayments = ['paid', 'cash_confirmed'];
    if (!validPayments.includes(job.paymentStatus)) {
      throw new HttpsError(
        'failed-precondition',
        `Payment must be verified before completing job. Current payment status: ${job.paymentStatus}`
      );
    }

    const batch = db.batch();

    batch.update(jobRef, {
      status: 'completed',
      completedAt: job.completedAt || admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    if (job.aidmateId) {
      const profileRef = db.collection('aidmateProfiles').doc(job.aidmateId);
      batch.set(
        profileRef,
        {
          isBusy: false,
          availabilityUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    await batch.commit();

    try {
      await rtdb.ref(`locations/${jobId}`).remove();
    } catch (rtdbErr) {
      console.warn('[completeJob] RTDB cleanup error:', rtdbErr);
    }

    // Trigger review availability notifications
    if (job.aidmateId) {
      await sendNotification({
        userId: job.aidmateId,
        type: 'job_completed',
        title: 'Task Completed!',
        message: `Task "${job.title}" has been finalized. You can now leave a review for the requester.`,
        relatedJobId: jobId,
      });
    }

    await sendNotification({
      userId: job.requesterId,
      type: 'job_completed',
      title: 'Task Completed!',
      message: `Task "${job.title}" is complete. Leave a review for your Aidmate!`,
      relatedJobId: jobId,
    });

    return { success: true, message: 'Job completed and reviews unlocked.' };
  }
);

// ============================================================================
// NOTIFICATION & TRIGGER FUNCTIONS
// ============================================================================

/**
 * onNewMessage (Firestore Trigger)
 * On new message document written to messages collection, updates conversation
 * lastMessage and notifies recipient(s).
 */
export const onNewMessage = onDocumentCreated(
  'messages/{msgId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const messageData = snap.data();
    const conversationId = messageData?.conversationId;
    const senderId = messageData?.senderId;
    const text = messageData?.message || 'Sent an attachment';

    if (!conversationId || !senderId) return;

    const convRef = db.collection('conversations').doc(conversationId);
    const convSnap = await convRef.get();

    if (!convSnap.exists) return;

    const conv = convSnap.data()!;
    const participantIds: string[] = conv.participantIds || [];

    // Update conversation metadata
    await convRef.update({
      lastMessage: text,
      lastMessageAt: messageData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Notify all other participants
    const recipients = participantIds.filter((uid) => uid !== senderId);
    await Promise.all(
      recipients.map((recipientId) =>
        sendNotification({
          userId: recipientId,
          type: 'new_message',
          title: 'New Message',
          message: text.length > 90 ? text.substring(0, 87) + '...' : text,
          relatedJobId: conv.jobId || null,
        })
      )
    );
  }
);

// ============================================================================
// ADMIN FUNCTIONS
// ============================================================================

/**
 * setAdminClaim (callable)
 * Admin-only: grants or revokes administrative custom claims.
 */
export const setAdminClaim = onCall(
  { cors: true },
  async (request: CallableRequest<{ targetUid: string; isAdmin: boolean }>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated.');
    }

    // Must be existing admin (or initial bootstrap if permitted)
    if (request.auth.token.admin !== true) {
      throw new HttpsError('permission-denied', 'Only administrators can manage admin claims.');
    }

    const { targetUid, isAdmin } = request.data || {};
    if (!targetUid || typeof targetUid !== 'string') {
      throw new HttpsError('invalid-argument', 'Valid targetUid is required.');
    }

    await admin.auth().setCustomUserClaims(targetUid, {
      admin: Boolean(isAdmin),
    });

    await logAdminAction(request.auth.uid, 'set_admin_claim', 'user', targetUid, {
      assignedAdmin: Boolean(isAdmin),
    });

    return {
      success: true,
      targetUid,
      isAdmin: Boolean(isAdmin),
    };
  }
);

/**
 * suspendUser (callable)
 * Admin-only: disables user account in Firebase Auth and updates availability in Firestore.
 */
export const suspendUser = onCall(
  { cors: true },
  async (request: CallableRequest<{ targetUid: string; reason: string }>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated.');
    }

    if (request.auth.token.admin !== true) {
      throw new HttpsError('permission-denied', 'Only administrators can suspend accounts.');
    }

    const { targetUid, reason } = request.data || {};
    if (!targetUid || typeof targetUid !== 'string') {
      throw new HttpsError('invalid-argument', 'Valid targetUid is required.');
    }

    // Disable in Firebase Auth
    await admin.auth().updateUser(targetUid, { disabled: true });

    // Mark Aidmate profile offline if exists
    const profileRef = db.collection('aidmateProfiles').doc(targetUid);
    const profileSnap = await profileRef.get();
    if (profileSnap.exists) {
      await profileRef.update({
        isAvailable: false,
        isBusy: false,
        availabilityUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await logAdminAction(request.auth.uid, 'suspend_user', 'user', targetUid, {
      reason: reason || 'Not provided',
    });

    return { success: true, targetUid, suspended: true };
  }
);

/**
 * resolveDispute (callable)
 * Admin-only: updates dispute status, executes job status actions, and logs audit record.
 */
export const resolveDispute = onCall(
  { cors: true },
  async (
    request: CallableRequest<{
      disputeId: string;
      resolution: string;
      adminNotes?: string;
      jobStatusAction?: 'completed' | 'cancelled' | 'refunded';
    }>
  ) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated.');
    }

    if (request.auth.token.admin !== true) {
      throw new HttpsError('permission-denied', 'Only administrators can resolve disputes.');
    }

    const { disputeId, resolution, adminNotes, jobStatusAction } = request.data || {};
    if (!disputeId || typeof disputeId !== 'string') {
      throw new HttpsError('invalid-argument', 'Valid disputeId is required.');
    }

    if (!resolution || typeof resolution !== 'string') {
      throw new HttpsError('invalid-argument', 'Resolution summary is required.');
    }

    const disputeRef = db.collection('disputes').doc(disputeId);
    const disputeSnap = await disputeRef.get();

    if (!disputeSnap.exists) {
      throw new HttpsError('not-found', 'Dispute not found.');
    }

    const dispute = disputeSnap.data()!;
    const jobId = dispute.jobId;

    await disputeRef.update({
      adminStatus: 'resolved',
      resolution,
      adminNotes: adminNotes || '',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Execute optional job status changes
    if (jobStatusAction && jobId) {
      const jobRef = db.collection('jobs').doc(jobId);
      const jobSnap = await jobRef.get();

      if (jobSnap.exists) {
        const job = jobSnap.data()!;
        const batch = db.batch();

        if (jobStatusAction === 'completed') {
          batch.update(jobRef, {
            status: 'completed',
            paymentStatus: 'paid',
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } else if (jobStatusAction === 'cancelled' || jobStatusAction === 'refunded') {
          batch.update(jobRef, {
            status: 'cancelled',
            paymentStatus: jobStatusAction === 'refunded' ? 'refunded' : 'cancelled',
            cancellationReason: `Dispute resolved: ${resolution}`,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        if (job.aidmateId) {
          const profileRef = db.collection('aidmateProfiles').doc(job.aidmateId);
          batch.set(
            profileRef,
            {
              isBusy: false,
              availabilityUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }

        await batch.commit();

        // Notify both parties
        if (job.requesterId) {
          await sendNotification({
            userId: job.requesterId,
            type: 'dispute_update',
            title: 'Dispute Resolved',
            message: `Dispute for "${job.title}" resolved: ${resolution}`,
            relatedJobId: jobId,
          });
        }

        if (job.aidmateId) {
          await sendNotification({
            userId: job.aidmateId,
            type: 'dispute_update',
            title: 'Dispute Resolved',
            message: `Dispute for "${job.title}" resolved: ${resolution}`,
            relatedJobId: jobId,
          });
        }
      }
    }

    await logAdminAction(request.auth.uid, 'resolve_dispute', 'dispute', disputeId, {
      resolution,
      adminNotes,
      jobStatusAction,
      jobId,
    });

    return { success: true, disputeId, resolved: true };
  }
);

// ============================================================================
// AI FUNCTIONS
// ============================================================================

/**
 * analyzeTaskImage (callable)
 * Receives an image URL, uses Google Gemini Vision API to analyze task image,
 * and suggests structured title, description, category, tags, and price estimate.
 */
export const analyzeTaskImage = onCall(
  { cors: true },
  async (request: CallableRequest<{ imageUrl: string; mimeType?: string }>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated.');
    }

    const { imageUrl, mimeType } = request.data || {};
    if (!imageUrl || typeof imageUrl !== 'string' || !/^https?:\/\//i.test(imageUrl)) {
      throw new HttpsError('invalid-argument', 'A valid HTTP(S) imageUrl is required.');
    }

    if (!GEMINI_API_KEY) {
      // Fallback graceful response if Gemini API key is not yet configured
      return {
        success: true,
        analysis: {
          title: 'Household Task Assistance',
          description: 'Help needed with task shown in the attached photo.',
          suggestedCategory: 'Repair & Maintenance',
          tags: ['repair', 'home', 'maintenance'],
          estimatedPriceRange: {
            min: 25,
            max: 50,
            suggested: 35,
          },
        },
      };
    }

    try {
      // Fetch image from URL
      const imgResponse = await fetch(imageUrl);
      if (!imgResponse.ok) {
        throw new Error(`Failed to fetch image: ${imgResponse.statusText}`);
      }

      const arrayBuffer = await imgResponse.arrayBuffer();
      const base64Data = Buffer.from(arrayBuffer).toString('base64');
      const contentType =
        imgResponse.headers.get('content-type') || mimeType || 'image/jpeg';

      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const prompt = `You are Aidmate's AI task assistant for a hyperlocal help platform where neighbors help neighbors with tasks.
Analyze this image and return a JSON object ONLY, adhering strictly to this schema without markdown code blocks:
{
  "title": "A short, clear action-oriented task title (max 50 chars)",
  "description": "A detailed, friendly 2-3 sentence description of the task needed, required tools, and estimated effort",
  "suggestedCategory": "One of: Moving & Lifting, Delivery & Pickup, Cleaning, Repair & Maintenance, Gardening & Outdoors, Tech & Computer Help, Shopping & Errands, Pet Care, Assembly & Installation, Cooking & Food Prep, Tutoring & Education, Event Help, Transportation, Photography, Other",
  "tags": ["tag1", "tag2", "tag3", "tag4"],
  "estimatedPriceRange": {
    "min": 20,
    "max": 60,
    "suggested": 35
  }
}`;

      const aiResponse = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: base64Data,
            mimeType: contentType,
          },
        },
      ]);

      const rawText = aiResponse.response.text();
      const cleanJson = rawText
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();

      const parsed = JSON.parse(cleanJson);

      // Validate category falls into allowed categories
      if (
        parsed.suggestedCategory &&
        !VALID_CATEGORIES.includes(parsed.suggestedCategory as any)
      ) {
        parsed.suggestedCategory = 'Other';
      }

      return {
        success: true,
        analysis: parsed,
      };
    } catch (err: any) {
      console.error('[analyzeTaskImage] Gemini analysis failed:', err);
      // Return sensible fallback to ensure UX is never blocked
      return {
        success: true,
        analysis: {
          title: 'Help Needed with Task',
          description: 'Assistance requested for the task depicted in the uploaded photo.',
          suggestedCategory: 'Repair & Maintenance',
          tags: ['help', 'task', 'local'],
          estimatedPriceRange: {
            min: 25,
            max: 55,
            suggested: 35,
          },
        },
      };
    }
  }
);
