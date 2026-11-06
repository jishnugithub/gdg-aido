import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Clock,
  CheckCircle2,
  XCircle,
  IndianRupee,
  Navigation,
  Timer,
} from 'lucide-react';
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/contexts/LocationContext';
import { useToast } from '@/contexts/ToastContext';
import { MapView } from '@/components/MapView';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { Job, JobOffer } from '@/types';
import { calculateDistanceKm } from '@/hooks/useJobSearch';

export const AidmateJobOfferPage: React.FC = () => {
  const { offerId } = useParams<{ offerId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentLocation } = useLocation();
  const { addToast } = useToast();

  const [jobOffer, setJobOffer] = useState<JobOffer | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(60); // 60 seconds countdown

  // 1. Fetch Job Offer and Job details
  useEffect(() => {
    if (!offerId) return;

    let isMounted = true;
    const fetchOffer = async () => {
      try {
        const offerSnap = await getDoc(doc(db, 'jobOffers', offerId));
        if (!offerSnap.exists()) {
          addToast('error', 'Offer Expired', 'This job offer is no longer valid.');
          navigate('/home');
          return;
        }

        const offerData = { offerId: offerSnap.id, ...offerSnap.data() } as JobOffer;
        if (offerData.status !== 'pending') {
          addToast('info', 'Offer Inactive', `Offer has already been ${offerData.status}.`);
          navigate('/home');
          return;
        }

        if (isMounted) setJobOffer(offerData);

        // Fetch the corresponding Job
        const jobSnap = await getDoc(doc(db, 'jobs', offerData.jobId));
        if (jobSnap.exists() && isMounted) {
          setJob({ jobId: jobSnap.id, ...jobSnap.data() } as Job);
        }
      } catch (err) {
        console.error('[AidmateJobOfferPage] Error fetching offer:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchOffer();

    return () => {
      isMounted = false;
    };
  }, [offerId, navigate, addToast]);

  // 2. Countdown Timer for Offer Expiry
  useEffect(() => {
    if (loading || !jobOffer) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleDecline('Offer expired due to timeout');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, jobOffer]);

  // Distance & Travel estimation
  const distanceKm =
    currentLocation && job?.taskLocation
      ? calculateDistanceKm(
          currentLocation.lat,
          currentLocation.lng,
          job.taskLocation.lat,
          job.taskLocation.lng
        )
      : jobOffer?.distance || 1.8;

  const estimatedMinutes = Math.max(3, Math.round(distanceKm * 3.5));

  // Accept with Firestore Transaction to prevent double-accept race conditions
  const handleAccept = async () => {
    if (!offerId || !jobOffer || !job || !user?.uid) return;

    setIsAccepting(true);
    const jobRef = doc(db, 'jobs', jobOffer.jobId);
    const offerRef = doc(db, 'jobOffers', offerId);

    try {
      await runTransaction(db, async (transaction) => {
        const jobDoc = await transaction.get(jobRef);
        if (!jobDoc.exists()) {
          throw new Error('Task no longer exists.');
        }

        const currentJob = jobDoc.data() as Job;
        if (currentJob.status !== 'searching') {
          throw new Error('This task has already been taken by another Aidmate.');
        }

        // 1. Assign job to this Aidmate
        transaction.update(jobRef, {
          aidmateId: user.uid,
          status: 'assigned',
          updatedAt: serverTimestamp(),
        });

        // 2. Update offer status to accepted
        transaction.update(offerRef, {
          status: 'accepted',
          respondedAt: serverTimestamp(),
        });
      });

      addToast('success', 'Offer Accepted!', 'Navigate to the requester location.');
      navigate(`/tracking/${jobOffer.jobId}`);
    } catch (err: unknown) {
      console.error('[AidmateJobOfferPage] Transaction failed:', err);
      const msg = err instanceof Error ? err.message : 'Could not accept task.';
      addToast('error', 'Acceptance Failed', msg);
      navigate('/home');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDecline = async (reason?: string) => {
    if (!offerId) return;
    setIsDeclining(true);

    try {
      const offerRef = doc(db, 'jobOffers', offerId);
      await updateDoc(offerRef, {
        status: 'declined',
        respondedAt: serverTimestamp(),
      });
      addToast('info', 'Offer Declined', reason || 'You declined this task.');
      navigate('/home');
    } catch (err) {
      console.error('[AidmateJobOfferPage] Decline failed:', err);
    } finally {
      setIsDeclining(false);
    }
  };

  if (loading || !job) {
    return (
      <div className="min-h-screen bg-[#FFF8F5] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-full border-4 border-[#FF6B4A] border-t-transparent animate-spin mb-3" />
        <p className="text-sm font-semibold text-[#1A1D3E]">Loading offer details...</p>
      </div>
    );
  }

  const markers = [
    {
      id: 'task',
      location: job.taskLocation,
      title: 'Task Location',
      type: 'task' as const,
    },
    ...(currentLocation
      ? [
          {
            id: 'aidmate',
            location: currentLocation,
            title: 'Your Location',
            type: 'aidmate' as const,
          },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-[#FFF8F5] flex flex-col justify-between text-[#1A1D3E]">
      {/* Top Map View */}
      <div className="relative w-full h-[40vh] sm:h-[42vh]">
        <MapView
          center={job.taskLocation}
          height="100%"
          markers={markers}
          addressLabel={job.taskAddress}
        />

        {/* Expiry Timer Pill Overlay */}
        <div className="absolute top-4 right-4 z-20 bg-white/95 backdrop-blur px-3 py-1.5 rounded-full shadow-lg border border-slate-200 flex items-center gap-1.5 text-xs font-bold">
          <Timer className={`w-4 h-4 ${timeLeft < 15 ? 'text-red-500 animate-pulse' : 'text-[#FF6B4A]'}`} />
          <span className={timeLeft < 15 ? 'text-red-500' : 'text-[#1A1D3E]'}>
            Expires in {timeLeft}s
          </span>
        </div>
      </div>

      {/* Main Details Body */}
      <main className="max-w-xl mx-auto w-full px-4 -mt-6 sm:-mt-8 z-30 pb-6 flex-1 flex flex-col justify-end">
        <div className="bg-white rounded-3xl p-5 sm:p-7 shadow-xl border border-slate-100 flex flex-col gap-5">
          {/* Amount Highlight & Category */}
          <div className="flex items-center justify-between">
            <Badge variant="primary" size="md">
              {job.category}
            </Badge>

            <div className="flex items-center gap-1 bg-[#FFF8F5] px-4 py-1.5 rounded-2xl border border-[#FF6B4A]/25">
              <IndianRupee className="w-5 h-5 text-[#FF6B4A]" />
              <span className="text-2xl font-black text-[#1A1D3E]">
                {job.offeredAmount}
              </span>
            </div>
          </div>

          {/* Title & Description */}
          <div>
            <h2 className="text-xl font-black text-[#1A1D3E]">{job.title}</h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
              {job.description}
            </p>
          </div>

          {/* Distance and Estimated Travel */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <Navigation className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Distance</span>
                <span className="text-xs font-bold text-[#1A1D3E]">{distanceKm.toFixed(1)} km away</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Est. Travel</span>
                <span className="text-xs font-bold text-[#1A1D3E]">~{estimatedMinutes} mins</span>
              </div>
            </div>
          </div>

          {/* Photos if provided */}
          {job.images && job.images.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase">Attached Photos</span>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {job.images.map((imgUrl, i) => (
                  <img
                    key={i}
                    src={imgUrl}
                    alt="Task preview"
                    className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Two Big Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button
              type="button"
              variant="danger"
              size="lg"
              fullWidth
              isLoading={isDeclining}
              loadingText="Declining..."
              onClick={() => handleDecline()}
              leftIcon={<XCircle className="w-5 h-5" />}
              disabled={isAccepting}
            >
              Decline
            </Button>

            <Button
              type="button"
              variant="success"
              size="lg"
              fullWidth
              isLoading={isAccepting}
              loadingText="Accepting..."
              onClick={handleAccept}
              leftIcon={<CheckCircle2 className="w-5 h-5" />}
              disabled={isDeclining}
            >
              Accept Task
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AidmateJobOfferPage;
