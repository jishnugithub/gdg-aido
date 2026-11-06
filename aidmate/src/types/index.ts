// User
export interface User {
  uid: string;
  fullName: string;
  phoneNumber: string;
  photoURL: string | null;
  ratingAverage: number;
  reviewCount: number;
  totalJobsCompleted: number;
  totalJobsRequested: number;
  createdAt: Date;
  updatedAt: Date;
}

// AidmateProfile
export interface AidmateProfile {
  uid: string;
  isAvailable: boolean;
  isBusy: boolean;
  serviceCategories: string[];
  averageRating: number;
  completedJobs: number;
  availabilityUpdatedAt: Date;
  currentLocation?: GeoPoint;
}

// GeoPoint
export interface GeoPoint {
  lat: number;
  lng: number;
}

// Job - with all fields from the spec
export type JobMode = 'active' | 'passive';

export type JobStatus =
  | 'draft'
  | 'searching'
  | 'posted'
  | 'applications_received'
  | 'assigned'
  | 'in_progress'
  | 'completion_requested'
  | 'otp_verified'
  | 'payment_pending'
  | 'completed'
  | 'cancelled'
  | 'expired'
  | 'disputed'
  | 'payment_failed';

export type PaymentStatus =
  | 'not_started'
  | 'pending'
  | 'processing'
  | 'paid'
  | 'cash_confirmation_pending'
  | 'cash_confirmed'
  | 'failed'
  | 'refunded'
  | 'disputed';

export type PaymentMethod = 'online' | 'cash';

export interface Job {
  jobId: string;
  requesterId: string;
  aidmateId: string | null;
  mode: JobMode;
  title: string;
  description: string;
  category: string;
  tags: string[];
  images: string[];
  offeredAmount: number;
  finalAmount: number;
  taskLocation: GeoPoint;
  taskAddress: string;
  requesterLocation: GeoPoint | null;
  deadline: Date | null;
  status: JobStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod | null;
  searchRadius: number;
  otpAttempts: number;
  otpExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  searchTokens: string[]; // for Firestore search
}

// JobOffer (for active mode dispatch)
export type OfferStatus = 'pending' | 'accepted' | 'declined' | 'expired';

export interface JobOffer {
  offerId: string;
  jobId: string;
  aidmateId: string;
  status: OfferStatus;
  notifiedAt: Date;
  respondedAt: Date | null;
  distance: number;
}

// Application (for passive mode)
export type ApplicationStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn';

export interface Application {
  applicationId: string;
  jobId: string;
  aidmateId: string;
  message: string;
  status: ApplicationStatus;
  createdAt: Date;
}

// Conversation
export interface Conversation {
  conversationId: string;
  jobId: string;
  participantIds: string[];
  lastMessage: string;
  lastMessageAt: Date;
  updatedAt: Date;
}

// Message
export interface Message {
  messageId: string;
  conversationId: string;
  senderId: string;
  message: string;
  mediaURL: string | null;
  createdAt: Date;
  readAt: Date | null;
}

// Payment
export interface Payment {
  paymentId: string;
  jobId: string;
  requesterId: string;
  aidmateId: string;
  amount: number;
  method: PaymentMethod;
  provider: string;
  providerTransactionId: string | null;
  status: PaymentStatus;
  stripePaymentIntentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Review
export interface Review {
  reviewId: string;
  jobId: string;
  reviewerId: string;
  reviewedUserId: string;
  rating: number;
  categoryRatings: {
    communication: number;
    punctuality?: number;
    qualityOfWork?: number;
    clearInstructions?: number;
    cooperation?: number;
  };
  comment: string;
  createdAt: Date;
}

// Dispute
export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'closed';

export interface Dispute {
  disputeId: string;
  jobId: string;
  raisedBy: string;
  reason: string;
  description: string;
  evidenceURLs: string[];
  adminStatus: DisputeStatus;
  resolution: string | null;
  adminNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Notification
export type NotificationType =
  | 'job_available'
  | 'job_accepted'
  | 'job_declined'
  | 'new_message'
  | 'new_application'
  | 'application_accepted'
  | 'offer_increased'
  | 'aidmate_approaching'
  | 'completion_requested'
  | 'otp_verified'
  | 'payment_pending'
  | 'payment_success'
  | 'cash_received'
  | 'job_completed'
  | 'new_review'
  | 'dispute_update'
  | 'job_cancelled';

export interface AppNotification {
  notificationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedJobId: string | null;
  isRead: boolean;
  createdAt: Date;
}

// AdminAuditLog
export interface AdminAuditLog {
  logId: string;
  adminId: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
  timestamp: Date;
}

// LocationUpdate (for Realtime DB)
export interface LocationUpdate {
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  accuracy: number;
  timestamp: number;
}

// User Presence (for Realtime DB)
export interface UserPresence {
  isOnline: boolean;
  lastChanged: number;
}

// Job categories
export const JOB_CATEGORIES = [
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

export type JobCategory = typeof JOB_CATEGORIES[number];

// Helper Input types
export type CreateJobInput = Omit<
  Job,
  | 'jobId'
  | 'aidmateId'
  | 'status'
  | 'paymentStatus'
  | 'paymentMethod'
  | 'finalAmount'
  | 'otpAttempts'
  | 'otpExpiresAt'
  | 'createdAt'
  | 'updatedAt'
  | 'completedAt'
  | 'cancelledAt'
  | 'cancellationReason'
>;

export type UpdateJobInput = Partial<
  Omit<Job, 'jobId' | 'requesterId' | 'createdAt'>
>;
