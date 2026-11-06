import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  MapPin,
  Phone,
  MessageSquare,
  Navigation,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
  Star,
  ShieldCheck,
  IndianRupee,
  X,
} from 'lucide-react';
import {
  doc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { subscribeToLocation, updateLocation } from '@/lib/realtime';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/contexts/LocationContext';
import { useToast } from '@/contexts/ToastContext';
import { MapView, type MarkerInfo } from '@/components/MapView';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import type { Job, User as UserType, LocationUpdate } from '@/types';
import { calculateDistanceKm } from '@/hooks/useJobSearch';

export const JobTrackingPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentLocation } = useLocation();
  const { addToast } = useToast();

  const [job, setJob] = useState<Job | null>(null);
  const [aidmateUser, setAidmateUser] = useState<UserType | null>(null);
  const [requesterUser, setRequesterUser] = useState<UserType | null>(null);
  const [aidmateLiveLocation, setAidmateLiveLocation] = useState<LocationUpdate | null>(null);

  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // 1. Subscribe to Job updates
  useEffect(() => {
    if (!jobId) return;

    const jobDocRef = doc(db, 'jobs', jobId);
    const unsub = onSnapshot(jobDocRef, async (docSnap) => {
      if (docSnap.exists()) {
        const jobData = { jobId: docSnap.id, ...docSnap.data() } as Job;
        setJob(jobData);

        // Fetch Aidmate details if assigned
        if (jobData.aidmateId) {
          const aSnap = await getDoc(doc(db, 'users', jobData.aidmateId));
          if (aSnap.exists()) {
            setAidmateUser(aSnap.data() as UserType);
          }
        }

        // Fetch Requester details
        if (jobData.requesterId) {
          const rSnap = await getDoc(doc(db, 'users', jobData.requesterId));
          if (rSnap.exists()) {
            setRequesterUser(rSnap.data() as UserType);
          }
        }

        // Redirect if job moves to completion stage
        if (jobData.status === 'completion_requested' || jobData.status === 'otp_verified') {
          navigate(`/completion/${jobId}`);
        } else if (jobData.status === 'payment_pending' || jobData.status === 'completed') {
          navigate(`/payment/${jobId}`);
        } else if (jobData.status === 'cancelled') {
          addToast('info', 'Task Cancelled', 'This task was cancelled.');
          navigate('/home');
        }
      }
    });

    return () => unsub();
  }, [jobId, navigate, addToast]);

  // 2. Broadcast current location if user is the assigned Aidmate
  useEffect(() => {
    if (!jobId || !user?.uid || !job?.aidmateId || user.uid !== job.aidmateId) return;
    if (!currentLocation) return;

    updateLocation(jobId, user.uid, {
      lat: currentLocation.lat,
      lng: currentLocation.lng,
      heading: null,
      speed: null,
      accuracy: 10,
      timestamp: Date.now(),
    }).catch((err) => console.warn('[JobTracking] Location broadcast failed:', err));
  }, [jobId, user?.uid, job?.aidmateId, currentLocation]);

  // 3. Subscribe to Aidmate's live location if user is Requester
  useEffect(() => {
    if (!jobId || !job?.aidmateId) return;

    const unsubLoc = subscribeToLocation(jobId, job.aidmateId, (loc) => {
      if (loc) {
        setAidmateLiveLocation(loc);
      }
    });

    return () => unsubLoc();
  }, [jobId, job?.aidmateId]);

  const isAidmate = user?.uid === job?.aidmateId;
  const isRequester = user?.uid === job?.requesterId;

  // Status transitions for Aidmate
  const handleUpdateJobStatus = async (nextStatus: Job['status']) => {
    if (!jobId) return;
    setIsUpdatingStatus(true);
    try {
      const jobDocRef = doc(db, 'jobs', jobId);
      await updateDoc(jobDocRef, {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      addToast('success', 'Status Updated', `Task marked as ${nextStatus.replace('_', ' ')}.`);

      if (nextStatus === 'completion_requested') {
        navigate(`/completion/${jobId}`);
      }
    } catch (err) {
      console.error('[JobTracking] Status update error:', err);
      addToast('error', 'Update Failed', 'Could not update task status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleCancel = async () => {
    if (!jobId) return;
    setIsCancelling(true);
    try {
      const jobDocRef = doc(db, 'jobs', jobId);
      await updateDoc(jobDocRef, {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
        cancellationReason: `Cancelled by ${isAidmate ? 'Aidmate' : 'Requester'} during active session`,
        updatedAt: serverTimestamp(),
      });
      setIsCancelModalOpen(false);
      navigate('/home');
    } catch (err) {
      console.error('[JobTracking] Cancel failed:', err);
      addToast('error', 'Error', 'Failed to cancel task.');
    } finally {
      setIsCancelling(false);
    }
  };

  // Status step indicator mapping
  const steps: { key: Job['status']; label: string }[] = [
    { key: 'assigned', label: 'Accepted' },
    { key: 'assigned', label: 'On the way' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'completed', label: 'Completed' },
  ];

  const getActiveStepIndex = () => {
    if (!job) return 0;
    if (job.status === 'assigned') return 1;
    if (job.status === 'in_progress') return 2;
    if (job.status === 'completion_requested' || job.status === 'completed') return 3;
    return 0;
  };

  const activeStepIdx = getActiveStepIndex();

  // Calculated distance between Aidmate and task
  const liveAidmateCoords = aidmateLiveLocation || (currentLocation && isAidmate ? currentLocation : null);
  const dist =
    liveAidmateCoords && job?.taskLocation
      ? calculateDistanceKm(
          liveAidmateCoords.lat,
          liveAidmateCoords.lng,
          job.taskLocation.lat,
          job.taskLocation.lng
        )
      : 1.2;

  const etaMinutes = Math.max(2, Math.round(dist * 3.5));

  // Map markers
  const markers: MarkerInfo[] = [];
  if (job?.taskLocation) {
    markers.push({
      id: 'task',
      location: job.taskLocation,
      title: 'Task Location',
      type: 'task',
    });
  }
  if (liveAidmateCoords) {
    markers.push({
      id: 'aidmate',
      location: { lat: liveAidmateCoords.lat, lng: liveAidmateCoords.lng },
      title: aidmateUser?.fullName || 'Aidmate',
      type: 'aidmate',
    });
  }
  if (job?.requesterLocation) {
    markers.push({
      id: 'requester',
      location: job.requesterLocation,
      title: requesterUser?.fullName || 'Requester',
      type: 'requester',
    });
  }

  const otherUser = isAidmate ? requesterUser : aidmateUser;

  return (
    <div className="min-h-screen bg-[#FFF8F5] flex flex-col justify-between text-[#1A1D3E]">
      {/* Top Status Step Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200/80 px-4 py-3 shadow-xs">
        <div className="max-w-xl mx-auto flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#1A1D3E] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-ping" />
              <span>Live Job Tracking</span>
            </span>

            <button
              type="button"
              onClick={() => setIsCancelModalOpen(true)}
              className="text-xs font-semibold text-red-500 hover:text-red-700 hover:underline"
            >
              Cancel Job
            </button>
          </div>

          {/* Stepper bar */}
          <div className="flex items-center justify-between gap-1 relative">
            {['Accepted', 'On The Way', 'In Progress', 'Done'].map((label, idx) => {
              const isPassed = activeStepIdx >= idx;
              const isCurrent = activeStepIdx === idx;

              return (
                <div key={label} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={`h-1.5 w-full rounded-full transition-all duration-300 ${
                      isPassed ? 'bg-[#FF6B4A]' : 'bg-slate-200'
                    }`}
                  />
                  <span
                    className={`text-[10px] font-bold truncate ${
                      isCurrent ? 'text-[#FF6B4A]' : isPassed ? 'text-[#1A1D3E]' : 'text-slate-400'
                    }`}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </header>

      {/* Center Interactive Map */}
      <div className="relative flex-1 w-full min-h-[45vh] bg-slate-100">
        <MapView
          center={job?.taskLocation || { lat: 12.9716, lng: 77.5946 }}
          height="100%"
          markers={markers}
          addressLabel={job?.taskAddress}
        />

        {/* Floating Live ETA Banner */}
        <div className="absolute top-4 left-4 right-4 z-20 max-w-sm mx-auto">
          <div className="bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-lg border border-slate-200/80 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#FF6B4A]/10 text-[#FF6B4A] flex items-center justify-center font-bold">
                <Navigation className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-[#1A1D3E] block">
                  {isAidmate ? 'En route to Task' : 'Aidmate on the way'}
                </span>
                <span className="text-slate-500 text-[11px]">
                  {dist.toFixed(1)} km away • ~{etaMinutes} mins
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 font-black text-sm text-[#FF6B4A]">
              <IndianRupee className="w-3.5 h-3.5" />
              <span>{job?.offeredAmount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Floating Control Panel */}
      <div className="max-w-xl mx-auto w-full px-4 -mt-4 z-30 pb-6">
        <div className="bg-white rounded-3xl p-5 shadow-xl border border-slate-100 flex flex-col gap-4">
          {/* User Partner Info (Aidmate or Requester) */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar
                src={otherUser?.photoURL || undefined}
                name={otherUser?.fullName || 'User'}
                size="md"
              />
              <div className="truncate">
                <span className="text-[10px] font-bold text-slate-400 uppercase">
                  {isAidmate ? 'Requester' : 'Assigned Aidmate'}
                </span>
                <h3 className="font-extrabold text-base text-[#1A1D3E] truncate">
                  {otherUser?.fullName || (isAidmate ? 'Requester' : 'Aidmate')}
                </h3>
                {otherUser && (
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                    <span className="font-bold text-[#1A1D3E]">
                      {otherUser.ratingAverage.toFixed(1)}
                    </span>
                    <span>• {otherUser.totalJobsCompleted} jobs</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Contact Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate(`/chat/${jobId}`)}
                aria-label="Open chat"
                className="w-11 h-11 rounded-2xl bg-[#FF6B4A]/10 text-[#FF6B4A] hover:bg-[#FF6B4A] hover:text-white transition-colors flex items-center justify-center shadow-xs"
              >
                <MessageSquare className="w-5 h-5" />
              </button>

              {otherUser?.phoneNumber && (
                <a
                  href={`tel:${otherUser.phoneNumber}`}
                  aria-label="Call user"
                  className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-colors flex items-center justify-center shadow-xs"
                >
                  <Phone className="w-5 h-5" />
                </a>
              )}
            </div>
          </div>

          {/* Collapsible Job Details toggle */}
          <div className="border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setIsDetailsOpen(!isDetailsOpen)}
              className="w-full flex items-center justify-between text-xs font-bold text-slate-500 hover:text-[#1A1D3E] transition-colors"
            >
              <span>{job?.title}</span>
              <span className="flex items-center gap-1 text-[#FF6B4A]">
                {isDetailsOpen ? 'Hide' : 'Details'}
                {isDetailsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </span>
            </button>

            {isDetailsOpen && (
              <div className="mt-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-100 animate-slide-down">
                <p className="leading-relaxed">{job?.description}</p>
                <div className="mt-2 flex items-center gap-1 text-slate-500 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-[#FF6B4A] shrink-0" />
                  <span className="truncate">{job?.taskAddress}</span>
                </div>
              </div>
            )}
          </div>

          {/* Dynamic Action Buttons depending on Role & Status */}
          <div className="pt-1">
            {isAidmate ? (
              job?.status === 'assigned' ? (
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  fullWidth
                  isLoading={isUpdatingStatus}
                  loadingText="Updating..."
                  onClick={() => handleUpdateJobStatus('in_progress')}
                  leftIcon={<CheckCircle2 className="w-5 h-5" />}
                >
                  I&apos;ve Arrived & Start Task
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="success"
                  size="lg"
                  fullWidth
                  isLoading={isUpdatingStatus}
                  loadingText="Finishing..."
                  onClick={() => handleUpdateJobStatus('completion_requested')}
                  leftIcon={<CheckCircle2 className="w-5 h-5" />}
                >
                  Complete Task & Request OTP
                </Button>
              )
            ) : (
              <div className="p-3 bg-[#F8F9FE] rounded-2xl border border-slate-100 text-center">
                <span className="text-xs font-bold text-[#1A1D3E] block">
                  Task in Progress
                </span>
                <span className="text-[11px] text-slate-500">
                  When your Aidmate finishes, you will be prompted to share the completion OTP.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="Cancel Active Task?"
        description="Cancelling an active task in progress may impact reliability ratings. Are you sure you wish to cancel?"
      >
        <div className="flex items-center justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setIsCancelModalOpen(false)}
          >
            Keep Working
          </Button>
          <Button
            type="button"
            variant="danger"
            isLoading={isCancelling}
            onClick={handleCancel}
          >
            Confirm Cancel
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default JobTrackingPage;
