import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  AlertTriangle,
  ShieldAlert,
  Send,
  CheckCircle2,
  Clock,
  HelpCircle,
  FileText,
  IndianRupee,
} from 'lucide-react';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { uploadImage } from '@/lib/storage';
import { Button } from '@/components/ui/Button';
import { Select, type SelectOption } from '@/components/ui/Select';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { Badge } from '@/components/ui/Badge';
import type { Job, Dispute } from '@/types';

const DISPUTE_REASONS = [
  'Aidmate did not arrive or abandoned task',
  'Task was incomplete or poorly executed',
  'Payment dispute or incorrect amount demanded',
  'Safety, harassment, or inappropriate conduct',
  'Wrong OTP or inability to verify completion',
  'Other reason',
];

export const DisputePage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();

  const [job, setJob] = useState<Job | null>(null);
  const [existingDispute, setExistingDispute] = useState<Dispute | null>(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [reason, setReason] = useState<string>(DISPUTE_REASONS[0]);
  const [description, setDescription] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const fetchJobAndDispute = async () => {
      try {
        const jobSnap = await getDoc(doc(db, 'jobs', jobId));
        if (jobSnap.exists()) {
          setJob({ jobId: jobSnap.id, ...jobSnap.data() } as Job);
        }

        // Check if dispute exists
        const dispQuery = query(collection(db, 'disputes'), where('jobId', '==', jobId));
        const dispSnaps = await getDocs(dispQuery);
        if (!dispSnaps.empty) {
          const dDoc = dispSnaps.docs[0];
          setExistingDispute({ disputeId: dDoc.id, ...dDoc.data() } as Dispute);
        }
      } catch (err) {
        console.error('[DisputePage] Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchJobAndDispute();
  }, [jobId]);

  const handleImageChange = (files: File[], previews: string[]) => {
    setSelectedFiles(files);
    setImagePreviews(previews);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobId || !user?.uid) return;

    if (!description.trim()) {
      setError('Please provide a detailed explanation of the issue.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const disputeRef = doc(collection(db, 'disputes'));
      const disputeId = disputeRef.id;

      // Upload evidence images
      const evidenceURLs: string[] = [];
      for (const file of selectedFiles) {
        const url = await uploadImage(file, `disputes/${disputeId}/${Date.now()}_${file.name}`);
        evidenceURLs.push(url);
      }

      const disputeData: Dispute = {
        disputeId,
        jobId,
        raisedBy: user.uid,
        reason,
        description: description.trim(),
        evidenceURLs,
        adminStatus: 'open',
        resolution: null,
        adminNotes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await setDoc(disputeRef, {
        ...disputeData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Update job status to disputed
      await setDoc(
        doc(db, 'jobs', jobId),
        { status: 'disputed', updatedAt: serverTimestamp() },
        { merge: true }
      );

      setExistingDispute(disputeData);
      addToast('success', 'Dispute Filed', 'Our Trust & Safety team has received your ticket.');
    } catch (err: unknown) {
      console.error('[DisputePage] Submit error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to file dispute';
      setError(msg);
      addToast('error', 'Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const reasonOptions: SelectOption[] = DISPUTE_REASONS.map((r) => ({
    value: r,
    label: r,
  }));

  if (loading || !job) {
    return (
      <div className="min-h-screen bg-[#FFF8F5] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-full border-4 border-[#FF6B4A] border-t-transparent animate-spin mb-3" />
        <p className="text-sm font-semibold text-[#1A1D3E]">Loading dispute details...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF8F5]/60 pb-16 text-[#1A1D3E]">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3.5">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#FF6B4A]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <h1 className="text-base font-bold text-[#1A1D3E]">Trust & Support</h1>
          <div className="w-12" />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-5 flex flex-col gap-5">
        {/* Job Summary Banner */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex items-center justify-between gap-4">
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              Task Under Dispute
            </span>
            <h2 className="text-lg font-black text-[#1A1D3E] truncate">
              {job.title}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">{job.taskAddress}</p>
          </div>

          <div className="flex items-center gap-1 bg-[#FFF8F5] px-3.5 py-1.5 rounded-2xl border border-[#FF6B4A]/25 shrink-0">
            <IndianRupee className="w-4 h-4 text-[#FF6B4A]" />
            <span className="font-extrabold text-base text-[#1A1D3E]">
              {job.offeredAmount}
            </span>
          </div>
        </div>

        {/* If Dispute Already Raised */}
        {existingDispute ? (
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-xl flex flex-col gap-5 animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#1A1D3E]">
                    Dispute Ticket #{existingDispute.disputeId.slice(0, 8)}
                  </h3>
                  <span className="text-xs text-slate-400">
                    Filed on {new Date(existingDispute.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <Badge
                variant={
                  existingDispute.adminStatus === 'resolved'
                    ? 'success'
                    : existingDispute.adminStatus === 'under_review'
                    ? 'warning'
                    : 'primary'
                }
                size="md"
              >
                {existingDispute.adminStatus.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col gap-2 text-xs">
              <div>
                <span className="font-bold text-slate-500 uppercase block text-[10px]">Reason:</span>
                <span className="font-semibold text-[#1A1D3E]">{existingDispute.reason}</span>
              </div>
              <div className="mt-1">
                <span className="font-bold text-slate-500 uppercase block text-[10px]">Description:</span>
                <p className="text-slate-600 leading-relaxed">{existingDispute.description}</p>
              </div>
            </div>

            {/* Resolution or Admin Notes */}
            {existingDispute.resolution ? (
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-800">
                <span className="font-bold block mb-1">Official Resolution:</span>
                <p>{existingDispute.resolution}</p>
              </div>
            ) : (
              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-200 text-xs text-blue-800 flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Investigation In Progress</span>
                  <p className="mt-0.5">
                    Our safety administrators are reviewing task records, location breadcrumbs, and uploaded evidence. You will receive an update within 24 hours.
                  </p>
                </div>
              </div>
            )}

            <div className="text-center text-xs text-slate-400 pt-2 border-t border-slate-100">
              Need immediate urgent assistance?{' '}
              <a href="mailto:support@aidmate.local" className="text-[#FF6B4A] font-bold underline">
                support@aidmate.local
              </a>
            </div>
          </div>
        ) : (
          /* File New Dispute Form */
          <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-xl flex flex-col gap-5">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 mb-2">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Dispute Resolution</span>
              </div>
              <h2 className="text-xl font-black text-[#1A1D3E]">File a Task Dispute</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Funds remain safely held in escrow until our team reviews your complaint.
              </p>
            </div>

            {/* Reason Selector */}
            <Select
              label="Primary Reason"
              options={reasonOptions}
              value={reason}
              onChange={(val) => setReason(val as string)}
            />

            {/* Detailed Description */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#1A1D3E]/80">
                Explanation & Timeline *
              </label>
              <textarea
                rows={4}
                placeholder="Explain what happened clearly, including timestamps and any agreed upon terms..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-[#FF6B4A] focus:ring-4 focus:ring-[#FF6B4A]/20 outline-none text-[#1A1D3E] placeholder:text-slate-400 transition-all resize-none"
                required
              />
            </div>

            {/* Evidence Upload */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#1A1D3E]/80">
                Evidence Photos (Screenshots, Work Photos)
              </span>
              <ImageUpload
                images={imagePreviews}
                multiple
                maxFiles={4}
                onChange={handleImageChange}
                disabled={isSubmitting}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-xs font-bold text-red-600 rounded-xl">
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="danger"
              size="lg"
              fullWidth
              isLoading={isSubmitting}
              loadingText="Submitting Dispute..."
              rightIcon={<Send className="w-4 h-4" />}
            >
              Submit Dispute Ticket
            </Button>
          </form>
        )}
      </main>
    </div>
  );
};

export default DisputePage;
