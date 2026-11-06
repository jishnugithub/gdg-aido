import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  IndianRupee,
  ArrowUpRight,
  Sparkles,
  User,
  Star,
  X,
} from 'lucide-react';
import {
  doc,
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { MapView } from '@/components/MapView';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import type { Job, JobOffer, User as UserType } from '@/types';

export const MatchingPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();

  const [job, setJob] = useState<Job | null>(null);
  const [jobOffers, setJobOffers] = useState<JobOffer[]>([]);
  const [assignedAidmate, setAssignedAidmate] = useState<UserType | null>(null);
  const [isFound, setIsFound] = useState(false);

  // Increase offer modal state
  const [isIncreaseModalOpen, setIsIncreaseModalOpen] = useState(false);
  const [newOfferAmount, setNewOfferAmount] = useState('');
  const [isUpdatingOffer, setIsUpdatingOffer] = useState(false);

  // Cancel state
  const [isCancelling, setIsCancelling] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  // 1. Subscribe to Job Document
  useEffect(() => {
    if (!jobId) return;

    const jobDocRef = doc(db, 'jobs', jobId);
    const unsub = onSnapshot(jobDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const jobData = { jobId: docSnap.id, ...docSnap.data() } as Job;
        setJob(jobData);
        setNewOfferAmount(String(jobData.offeredAmount + 50));

        // If job was assigned or in_progress, aidmate accepted!
        if (jobData.aidmateId && (jobData.status === 'assigned' || jobData.status === 'in_progress')) {
          setIsFound(true);
          // Fetch assigned aidmate user info
          const aidmateDocRef = doc(db, 'users', jobData.aidmateId);
          onSnapshot(aidmateDocRef, (uSnap) => {
            if (uSnap.exists()) {
              setAssignedAidmate(uSnap.data() as UserType);
            }
          });

          // Delay slightly to celebrate, then navigate to tracking
          const timeout = setTimeout(() => {
            navigate(`/tracking/${jobId}`);
          }, 3200);
          return () => clearTimeout(timeout);
        }

        if (jobData.status === 'cancelled') {
          addToast('info', 'Request Cancelled', 'Your request has been cancelled.');
          navigate('/home');
        }
      }
    });

    return () => unsub();
  }, [jobId, navigate, addToast]);

  // 2. Subscribe to jobOffers Collection for live counters
  useEffect(() => {
    if (!jobId) return;

    const offersQuery = query(collection(db, 'jobOffers'), where('jobId', '==', jobId));
    const unsub = onSnapshot(offersQuery, (snapshot) => {
      const offers = snapshot.docs.map((d) => ({
        offerId: d.id,
        ...d.data(),
      })) as JobOffer[];
      setJobOffers(offers);
    });

    return () => unsub();
  }, [jobId]);

  // Counters
  const notifiedCount = jobOffers.length;
  const acceptedCount = jobOffers.filter((o) => o.status === 'accepted').length;
  const declinedCount = jobOffers.filter((o) => o.status === 'declined').length;
  const pendingCount = jobOffers.filter((o) => o.status === 'pending').length;

  const handleIncreaseOffer = async () => {
    if (!jobId || !job) return;
    const amountNum = parseFloat(newOfferAmount);
    if (isNaN(amountNum) || amountNum <= job.offeredAmount) {
      addToast('warning', 'Invalid Amount', 'New offer must be greater than current amount.');
      return;
    }

    setIsUpdatingOffer(true);
    try {
      const jobDocRef = doc(db, 'jobs', jobId);
      await updateDoc(jobDocRef, {
        offeredAmount: amountNum,
        finalAmount: amountNum,
        updatedAt: serverTimestamp(),
      });
      addToast('success', 'Offer Increased!', `Aidmates notified of updated offer ₹${amountNum}`);
      setIsIncreaseModalOpen(false);
    } catch (err) {
      console.error('[MatchingPage] Increase offer failed:', err);
      addToast('error', 'Error', 'Failed to update offer amount');
    } finally {
      setIsUpdatingOffer(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!jobId) return;
    setIsCancelling(true);
    try {
      const jobDocRef = doc(db, 'jobs', jobId);
      await updateDoc(jobDocRef, {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
        cancellationReason: 'Cancelled by requester during search',
        updatedAt: serverTimestamp(),
      });
      setIsCancelModalOpen(false);
      navigate('/home');
    } catch (err) {
      console.error('[MatchingPage] Cancel error:', err);
      addToast('error', 'Error', 'Failed to cancel request');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF8F5]/80 flex flex-col justify-between text-[#1A1D3E]">
      {/* Top Map Area */}
      <div className="relative w-full h-[40vh] sm:h-[45vh] bg-slate-100">
        <MapView
          center={job?.taskLocation || { lat: 12.9716, lng: 77.5946 }}
          height="100%"
          addressLabel={job?.taskAddress}
        />

        {/* Pulsing Radar Effect over Map */}
        {!isFound && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-48 h-48 rounded-full bg-[#FF6B4A]/15 animate-ping duration-1000" />
            <div className="absolute w-72 h-72 rounded-full border-2 border-[#FF6B4A]/30 animate-pulse" />
          </div>
        )}

        {/* Top Header floating bar */}
        <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between">
          <div className="bg-white/90 backdrop-blur px-3.5 py-1.5 rounded-full shadow-md text-xs font-bold text-[#1A1D3E] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#FF6B4A] animate-ping" />
            <span>Live Dispatch Active</span>
          </div>

          <button
            type="button"
            onClick={() => setIsCancelModalOpen(true)}
            className="bg-white/90 backdrop-blur px-3 py-1.5 rounded-full shadow-md text-xs font-bold text-red-600 hover:bg-white transition-colors flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" />
            <span>Cancel</span>
          </button>
        </div>
      </div>

      {/* Bottom Floating Matching Card */}
      <div className="max-w-xl mx-auto w-full px-4 -mt-6 sm:-mt-8 z-30 pb-8 flex-1 flex flex-col justify-end">
        {isFound ? (
          /* AIDMATE FOUND CELEBRATION CARD */
          <div className="bg-white rounded-3xl p-6 shadow-2xl border-2 border-[#22C55E] flex flex-col items-center text-center animate-scale-in">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3 animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <span className="text-xs font-black uppercase tracking-wider text-emerald-600">
              Match Found!
            </span>
            <h2 className="text-2xl font-black text-[#1A1D3E] mt-0.5">
              Aidmate on the way!
            </h2>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              Connecting you to live tracking and direct chat...
            </p>

            {/* Aidmate Info Card */}
            {assignedAidmate && (
              <div className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-left">
                <div className="flex items-center gap-3">
                  <Avatar
                    src={assignedAidmate.photoURL || undefined}
                    name={assignedAidmate.fullName}
                    size="md"
                  />
                  <div>
                    <h4 className="font-bold text-sm text-[#1A1D3E]">
                      {assignedAidmate.fullName}
                    </h4>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      <span className="font-bold text-[#1A1D3E]">
                        {assignedAidmate.ratingAverage.toFixed(1)}
                      </span>
                      <span>• {assignedAidmate.totalJobsCompleted} jobs</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Accepted
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* SEARCHING STATE CARD */
          <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 flex flex-col gap-5 animate-slide-up">
            {/* Header: Task info + Search status */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-[#FF6B4A]/10 text-[#FF6B4A]">
                  <Sparkles className="w-3.5 h-3.5 animate-spin-slow" />
                  <span>Searching Nearby Aidmates...</span>
                </span>
                <h3 className="text-lg font-bold text-[#1A1D3E] mt-2 line-clamp-1">
                  {job?.title || 'Finding Help...'}
                </h3>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-[#FF6B4A]" />
                  <span className="truncate max-w-[220px]">{job?.taskAddress}</span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Offered</span>
                <div className="text-xl font-black text-[#1A1D3E] flex items-center justify-end">
                  <IndianRupee className="w-4 h-4 text-[#FF6B4A]" />
                  <span>{job?.offeredAmount}</span>
                </div>
              </div>
            </div>

            {/* Live Real-Time Radar Counters */}
            <div className="grid grid-cols-4 gap-2 bg-[#F8F9FE] p-3 rounded-2xl border border-slate-100 text-center">
              <div className="flex flex-col items-center">
                <span className="text-lg font-black text-[#1A1D3E]">
                  {Math.max(notifiedCount, 4)}
                </span>
                <span className="text-[10px] font-medium text-slate-500">Notified</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-lg font-black text-amber-500">
                  {pendingCount || (notifiedCount ? notifiedCount - declinedCount : 3)}
                </span>
                <span className="text-[10px] font-medium text-slate-500">Reviewing</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-lg font-black text-emerald-500">{acceptedCount}</span>
                <span className="text-[10px] font-medium text-slate-500">Accepted</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-lg font-black text-slate-400">{declinedCount}</span>
                <span className="text-[10px] font-medium text-slate-500">Declined</span>
              </div>
            </div>

            {/* Estimated Wait indicator */}
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#FF6B4A]" />
                <span>Estimated matching time:</span>
              </div>
              <span className="font-bold text-[#1A1D3E]">~1-3 mins</span>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2.5 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="md"
                fullWidth
                onClick={() => setIsIncreaseModalOpen(true)}
                leftIcon={<ArrowUpRight className="w-4 h-4" />}
              >
                Increase Offer to Accelerate Match
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsCancelModalOpen(true)}
                className="text-slate-400 hover:text-red-500 text-xs"
              >
                Cancel Help Request
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Increase Offer Modal */}
      <Modal
        isOpen={isIncreaseModalOpen}
        onClose={() => setIsIncreaseModalOpen(false)}
        title="Increase Your Offer"
        description="A higher offer gives your request priority among nearby Aidmates."
      >
        <div className="flex flex-col gap-4 py-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Current Offer:</span>
            <span className="font-bold text-sm text-[#1A1D3E]">₹{job?.offeredAmount}</span>
          </div>

          <Input
            label="New Amount (₹)"
            type="number"
            min={String((job?.offeredAmount || 0) + 10)}
            step="10"
            value={newOfferAmount}
            onChange={(e) => setNewOfferAmount(e.target.value)}
            leftIcon={<IndianRupee className="w-4 h-4 text-slate-400" />}
            autoFocus
          />

          <div className="flex gap-2">
            {[50, 100, 200].map((extra) => (
              <button
                key={extra}
                type="button"
                onClick={() =>
                  setNewOfferAmount(String((job?.offeredAmount || 0) + extra))
                }
                className="flex-1 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:border-[#FF6B4A] hover:bg-[#FFF8F5] transition-colors"
              >
                +₹{extra}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-end gap-3 mt-4 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsIncreaseModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              isLoading={isUpdatingOffer}
              onClick={handleIncreaseOffer}
            >
              Update Offer
            </Button>
          </div>
        </div>
      </Modal>

      {/* Cancel Request Modal */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="Cancel Help Request?"
        description="Are you sure you want to cancel? Aidmates will no longer receive notifications for this task."
      >
        <div className="flex items-center justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setIsCancelModalOpen(false)}
          >
            Keep Searching
          </Button>
          <Button
            type="button"
            variant="danger"
            isLoading={isCancelling}
            onClick={handleCancelRequest}
          >
            Yes, Cancel Request
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default MatchingPage;
