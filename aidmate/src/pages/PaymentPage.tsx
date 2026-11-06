import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CreditCard,
  Banknote,
  CheckCircle2,
  ShieldCheck,
  IndianRupee,
  Clock,
  Sparkles,
  ArrowRight,
  Lock,
} from 'lucide-react';
import {
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { Job, PaymentMethod } from '@/types';

export const PaymentPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();

  const [job, setJob] = useState<Job | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('online');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  // Mock Stripe card fields
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvc, setCardCvc] = useState('999');

  useEffect(() => {
    if (!jobId) return;

    const jobDocRef = doc(db, 'jobs', jobId);
    const unsub = onSnapshot(jobDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = { jobId: docSnap.id, ...docSnap.data() } as Job;
        setJob(data);

        if (data.paymentStatus === 'paid' || data.paymentStatus === 'cash_confirmed') {
          setIsSuccess(true);
        }
      }
      setLoading(false);
    });

    return () => unsub();
  }, [jobId]);

  const isRequester = user?.uid === job?.requesterId;
  const isAidmate = user?.uid === job?.aidmateId;

  // Requester pays
  const handleRequesterPayment = async () => {
    if (!jobId || !job) return;
    setIsProcessing(true);

    try {
      const jobDocRef = doc(db, 'jobs', jobId);
      if (selectedMethod === 'online') {
        // Simulate successful Stripe charge
        await updateDoc(jobDocRef, {
          paymentStatus: 'paid',
          paymentMethod: 'online',
          status: 'completed',
          updatedAt: serverTimestamp(),
        });
        setIsSuccess(true);
        addToast('success', 'Payment Successful!', `Paid ₹${job.offeredAmount} via Online Gateway`);
      } else {
        // Cash payment choice: set to cash_confirmation_pending
        await updateDoc(jobDocRef, {
          paymentStatus: 'cash_confirmation_pending',
          paymentMethod: 'cash',
          updatedAt: serverTimestamp(),
        });
        addToast('info', 'Cash Selected', 'Please hand over cash to your Aidmate in person.');
      }
    } catch (err) {
      console.error('[PaymentPage] Error processing payment:', err);
      addToast('error', 'Payment Error', 'Failed to process payment');
    } finally {
      setIsProcessing(false);
    }
  };

  // Aidmate confirms cash received
  const handleConfirmCashReceived = async () => {
    if (!jobId || !job) return;
    setIsProcessing(true);

    try {
      const jobDocRef = doc(db, 'jobs', jobId);
      await updateDoc(jobDocRef, {
        paymentStatus: 'cash_confirmed',
        status: 'completed',
        updatedAt: serverTimestamp(),
      });
      setIsSuccess(true);
      addToast('success', 'Cash Confirmed!', 'Task marked fully complete.');
    } catch (err) {
      console.error('[PaymentPage] Cash confirm failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading || !job) {
    return (
      <div className="min-h-screen bg-[#FFF8F5] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-full border-4 border-[#FF6B4A] border-t-transparent animate-spin mb-3" />
        <p className="text-sm font-semibold text-[#1A1D3E]">Loading payment details...</p>
      </div>
    );
  }

  // ===================== SUCCESS SCREEN =====================
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#FFF8F5] flex flex-col items-center justify-center px-4 sm:px-6 py-8 text-[#1A1D3E] animate-scale-in">
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-xl max-w-md w-full text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <span className="text-xs font-black uppercase tracking-wider text-emerald-600">
            Payment Completed
          </span>
          <h2 className="text-2xl font-black text-[#1A1D3E] mt-1">
            All Settled!
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mb-6">
            Thank you for using Aidmate. Please take a moment to rate and review your experience.
          </p>

          <div className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 mb-6 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Total Amount Settled:</span>
            <span className="text-xl font-black text-[#1A1D3E]">₹{job.offeredAmount}</span>
          </div>

          <Button
            type="button"
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => navigate(`/review/${jobId}`)}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Leave a Review
          </Button>
        </div>
      </div>
    );
  }

  // ===================== PAYMENT FORM =====================
  return (
    <div className="min-h-screen bg-[#FFF8F5]/60 flex flex-col justify-between px-4 sm:px-6 py-8 text-[#1A1D3E]">
      <main className="max-w-md mx-auto w-full my-auto flex flex-col gap-5">
        {/* Header Title */}
        <div className="text-center">
          <span className="text-xs font-black uppercase tracking-wider text-[#FF6B4A]">
            Final Settlement
          </span>
          <h1 className="text-2xl font-black text-[#1A1D3E] mt-0.5">Task Payment</h1>
          <p className="text-xs text-slate-500 mt-1">
            {job.title}
          </p>
        </div>

        {/* Big Amount Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col items-center text-center">
          <span className="text-xs font-bold text-slate-400 uppercase">Amount Due</span>
          <div className="text-4xl font-black text-[#1A1D3E] flex items-center justify-center mt-1">
            <IndianRupee className="w-8 h-8 text-[#FF6B4A]" />
            <span>{job.offeredAmount}</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1">
            Protected with Aidmate Escrow & Verification
          </span>
        </div>

        {/* ================= REQUESTER VIEW ================= */}
        {isRequester && (
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xl flex flex-col gap-4">
            <span className="text-xs font-bold uppercase tracking-wider text-[#1A1D3E]">
              Select Payment Method
            </span>

            {/* Methods Selection */}
            <div className="grid grid-cols-2 gap-3">
              {/* Online card */}
              <div
                onClick={() => setSelectedMethod('online')}
                role="button"
                tabIndex={0}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col items-center text-center gap-2 ${
                  selectedMethod === 'online'
                    ? 'border-[#FF6B4A] bg-[#FFF8F5] text-[#FF6B4A]'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <CreditCard className="w-6 h-6" />
                <span className="text-xs font-bold text-[#1A1D3E]">Pay Online</span>
                <span className="text-[10px] text-slate-400">Cards / UPI / NetBanking</span>
              </div>

              {/* Cash card */}
              <div
                onClick={() => setSelectedMethod('cash')}
                role="button"
                tabIndex={0}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col items-center text-center gap-2 ${
                  selectedMethod === 'cash'
                    ? 'border-[#FF6B4A] bg-[#FFF8F5] text-[#FF6B4A]'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <Banknote className="w-6 h-6" />
                <span className="text-xs font-bold text-[#1A1D3E]">Pay by Cash</span>
                <span className="text-[10px] text-slate-400">Hand to Aidmate directly</span>
              </div>
            </div>

            {/* If Online: Stripe Form Placeholder */}
            {selectedMethod === 'online' && (
              <div className="p-4 rounded-2xl bg-[#F8F9FE] border border-slate-200 flex flex-col gap-3 animate-fade-in">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1 font-semibold text-[#1A1D3E]">
                    <Lock className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Stripe Secured Payment</span>
                  </span>
                  <span className="text-[10px]">Instant 256-bit SSL</span>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs font-mono text-[#1A1D3E] flex items-center justify-between">
                    <span>{cardNumber}</span>
                    <span className="text-slate-400">VISA</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs font-mono text-[#1A1D3E]">
                      {cardExpiry}
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs font-mono text-[#1A1D3E]">
                      CVC: •••
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* If Cash chosen */}
            {selectedMethod === 'cash' && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2.5 animate-fade-in">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Please ensure you hand exactly ₹{job.offeredAmount} in cash to your Aidmate. The Aidmate will confirm receipt on their device.
                </span>
              </div>
            )}

            <Button
              type="button"
              variant="primary"
              size="lg"
              fullWidth
              isLoading={isProcessing}
              loadingText="Processing..."
              onClick={handleRequesterPayment}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              {selectedMethod === 'online'
                ? `Pay ₹${job.offeredAmount} Now`
                : "I'll Pay Cash in Person"}
            </Button>
          </div>
        )}

        {/* ================= AIDMATE VIEW ================= */}
        {isAidmate && (
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xl flex flex-col items-center text-center gap-4">
            {job.paymentStatus === 'cash_confirmation_pending' ? (
              <>
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <Banknote className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-[#1A1D3E]">
                    Confirm Cash Receipt
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    The requester has selected cash payment. Click below once you have collected the cash.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="success"
                  size="lg"
                  fullWidth
                  isLoading={isProcessing}
                  onClick={handleConfirmCashReceived}
                  leftIcon={<CheckCircle2 className="w-5 h-5" />}
                >
                  I Received the Cash (₹{job.offeredAmount})
                </Button>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-[#FF6B4A]/10 text-[#FF6B4A] flex items-center justify-center">
                  <Clock className="w-8 h-8 animate-spin-slow" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-[#1A1D3E]">
                    Waiting for Payment...
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    The requester is completing payment of ₹{job.offeredAmount}. Your screen will update automatically.
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default PaymentPage;
