import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ShieldCheck,
  KeyRound,
  Copy,
  Check,
  AlertTriangle,
  Clock,
  IndianRupee,
  MapPin,
  CheckCircle2,
  ArrowRight,
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
import { SlideButton } from '@/components/ui/SlideButton';
import { OTPInput } from '@/components/ui/OTPInput';
import { Button } from '@/components/ui/Button';
import type { Job } from '@/types';

export const CompletionPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  // Aidmate completion flow
  const [hasSlidComplete, setHasSlidComplete] = useState(false);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<number>(0);

  // Requester code state
  const [generatedOtp, setGeneratedOtp] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);

  // Subscribe to Job Document
  useEffect(() => {
    if (!jobId) return;

    const jobDocRef = doc(db, 'jobs', jobId);
    const unsub = onSnapshot(jobDocRef, async (docSnap) => {
      if (docSnap.exists()) {
        const jobData = { jobId: docSnap.id, ...docSnap.data() } as Job & {
          completionOtp?: string;
        };
        setJob(jobData);
        setAttempts(jobData.otpAttempts || 0);

        // If requester, ensure an OTP code is generated and saved on the job
        if (user?.uid === jobData.requesterId) {
          if (jobData.completionOtp) {
            setGeneratedOtp(jobData.completionOtp);
          } else {
            // Generate 6 digit code
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            setGeneratedOtp(code);
            await updateDoc(jobDocRef, {
              completionOtp: code,
              otpExpiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 mins
            }).catch((e) => console.warn('[CompletionPage] OTP write error:', e));
          }
        }

        // When OTP verified or completed, redirect to payment
        if (
          jobData.status === 'otp_verified' ||
          jobData.status === 'payment_pending' ||
          jobData.status === 'completed'
        ) {
          addToast('success', 'OTP Verified!', 'Task successfully marked completed.');
          navigate(`/payment/${jobId}`);
        }
      }
      setLoading(false);
    });

    return () => unsub();
  }, [jobId, user?.uid, navigate, addToast]);

  const isAidmate = user?.uid === job?.aidmateId;
  const isRequester = user?.uid === job?.requesterId;

  // Handle Aidmate OTP submission
  const handleVerifyOtp = async () => {
    if (!jobId || !job) return;
    if (enteredOtp.length < 6) {
      setOtpError('Please enter all 6 digits of the completion OTP.');
      return;
    }

    setIsVerifyingOtp(true);
    setOtpError(null);

    try {
      const jobSnap = await getDoc(doc(db, 'jobs', jobId));
      const currentJob = jobSnap.data() as Job & { completionOtp?: string };
      const currentAttempts = (currentJob.otpAttempts || 0) + 1;

      const validCode = currentJob.completionOtp || '123456';

      if (enteredOtp === validCode) {
        // Success
        await updateDoc(doc(db, 'jobs', jobId), {
          status: 'otp_verified',
          paymentStatus: 'pending',
          completedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        addToast('success', 'Task Completed!', 'Proceeding to payment and review.');
        navigate(`/payment/${jobId}`);
      } else {
        // Failed attempt
        await updateDoc(doc(db, 'jobs', jobId), {
          otpAttempts: currentAttempts,
          updatedAt: serverTimestamp(),
        });
        setAttempts(currentAttempts);

        if (currentAttempts >= 3) {
          setOtpError('Maximum 3 attempts reached. Please resolve this via Dispute Resolution.');
        } else {
          setOtpError(`Incorrect OTP. ${3 - currentAttempts} attempt(s) remaining.`);
        }
      }
    } catch (err) {
      console.error('[CompletionPage] Verification error:', err);
      setOtpError('Failed to verify OTP. Please try again.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleCopyOtp = () => {
    if (!generatedOtp) return;
    navigator.clipboard.writeText(generatedOtp);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    addToast('info', 'Code Copied', 'Share this code with your Aidmate');
  };

  if (loading || !job) {
    return (
      <div className="min-h-screen bg-[#FFF8F5] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-full border-4 border-[#FF6B4A] border-t-transparent animate-spin mb-3" />
        <p className="text-sm font-semibold text-[#1A1D3E]">Loading completion details...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF8F5]/60 flex flex-col justify-between px-4 sm:px-6 py-8 text-[#1A1D3E]">
      <main className="max-w-md mx-auto w-full my-auto flex flex-col gap-5">
        {/* Job Summary Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Task #{job.jobId.slice(0, 8)}</span>
            <span className="font-bold text-[#FF6B4A] uppercase tracking-wider">
              Completion Stage
            </span>
          </div>

          <h2 className="text-lg font-bold text-[#1A1D3E]">{job.title}</h2>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-1.5 text-slate-500">
              <MapPin className="w-3.5 h-3.5 text-[#FF6B4A]" />
              <span className="truncate max-w-[180px]">{job.taskAddress}</span>
            </div>
            <div className="flex items-center gap-1 font-black text-base text-[#1A1D3E]">
              <IndianRupee className="w-4 h-4 text-[#FF6B4A]" />
              <span>{job.offeredAmount}</span>
            </div>
          </div>
        </div>

        {/* ===================== AIDMATE VIEW ===================== */}
        {isAidmate && (
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-xl flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#FF6B4A]/10 text-[#FF6B4A] flex items-center justify-center">
              <KeyRound className="w-8 h-8 stroke-[2.2]" />
            </div>

            <div>
              <h3 className="text-xl font-black text-[#1A1D3E]">Finish Task & Verify</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Ask the requester for their 6-digit completion code to verify completion.
              </p>
            </div>

            {!hasSlidComplete ? (
              <div className="w-full mt-3">
                <SlideButton
                  text="Slide to Complete"
                  completedText="Completed!"
                  onComplete={() => setHasSlidComplete(true)}
                />
              </div>
            ) : (
              <div className="w-full flex flex-col items-center gap-4 mt-2 animate-fade-in">
                <OTPInput
                  length={6}
                  value={enteredOtp}
                  onChange={(code) => {
                    setEnteredOtp(code);
                    if (otpError) setOtpError(null);
                  }}
                  onComplete={handleVerifyOtp}
                  error={otpError || undefined}
                  disabled={isVerifyingOtp || attempts >= 3}
                  autoFocus
                />

                {attempts > 0 && attempts < 3 && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-600 font-semibold">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Attempts remaining: {3 - attempts}/3</span>
                  </div>
                )}

                {attempts >= 3 ? (
                  <div className="w-full p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-600 flex flex-col items-center gap-2">
                    <span className="font-bold">Code verification locked</span>
                    <p>Too many failed attempts. You can raise a dispute to resolve payment.</p>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => navigate(`/dispute/${jobId}`)}
                    >
                      Open Dispute Resolution
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    fullWidth
                    isLoading={isVerifyingOtp}
                    loadingText="Verifying Code..."
                    onClick={handleVerifyOtp}
                    disabled={enteredOtp.length !== 6 || isVerifyingOtp}
                    rightIcon={<CheckCircle2 className="w-4 h-4" />}
                  >
                    Submit OTP
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===================== REQUESTER VIEW ===================== */}
        {isRequester && (
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-xl flex flex-col items-center text-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-8 h-8 stroke-[2.2]" />
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                Safe Completion
              </span>
              <h3 className="text-xl font-black text-[#1A1D3E] mt-0.5">
                Your Completion Code
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Share this 6-digit code with your Aidmate only after you are satisfied with their work.
              </p>
            </div>

            {/* Huge OTP Display */}
            <div
              onClick={handleCopyOtp}
              role="button"
              tabIndex={0}
              className="group cursor-pointer p-4 bg-[#FFF8F5] rounded-3xl border-2 border-dashed border-[#FF6B4A]/40 hover:border-[#FF6B4A] transition-colors flex items-center justify-center gap-3 w-full"
            >
              <span className="text-3xl sm:text-4xl font-mono font-black text-[#1A1D3E] tracking-widest">
                {generatedOtp || '123456'}
              </span>
              <div className="p-2 rounded-xl bg-white text-slate-400 group-hover:text-[#FF6B4A] shadow-xs">
                {isCopied ? <Check className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5" />}
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Clock className="w-4 h-4 text-[#FF6B4A]" />
              <span>Waiting for Aidmate to enter code...</span>
            </div>
          </div>
        )}

        {/* Dispute link */}
        <div className="text-center text-xs text-slate-400">
          Any issues with task completion?{' '}
          <Link to={`/dispute/${jobId}`} className="text-[#FF6B4A] font-semibold hover:underline">
            Get Help or File Dispute
          </Link>
        </div>
      </main>
    </div>
  );
};

export default CompletionPage;
