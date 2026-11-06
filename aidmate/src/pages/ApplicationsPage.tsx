import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  Star,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Clock,
  IndianRupee,
  ShieldCheck,
  Check,
} from 'lucide-react';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Job, Application, User as UserType } from '@/types';

interface ApplicantItem {
  application: Application;
  aidmate: UserType;
}

export const ApplicationsPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();

  const [job, setJob] = useState<Job | null>(null);
  const [applicants, setApplicants] = useState<ApplicantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const fetchApplications = async () => {
      try {
        const jobSnap = await getDoc(doc(db, 'jobs', jobId));
        if (!jobSnap.exists()) {
          navigate('/home');
          return;
        }

        const jobData = { jobId: jobSnap.id, ...jobSnap.data() } as Job;
        setJob(jobData);

        // Fetch applications for this job
        const appQuery = query(collection(db, 'applications'), where('jobId', '==', jobId));
        const appSnaps = await getDocs(appQuery);

        const items: ApplicantItem[] = [];
        for (const appDoc of appSnaps.docs) {
          const appData = { applicationId: appDoc.id, ...appDoc.data() } as Application;
          const userSnap = await getDoc(doc(db, 'users', appData.aidmateId));
          if (userSnap.exists()) {
            items.push({
              application: appData,
              aidmate: { uid: userSnap.id, ...userSnap.data() } as UserType,
            });
          }
        }

        setApplicants(items);
      } catch (err) {
        console.error('[ApplicationsPage] Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchApplications();
  }, [jobId, navigate]);

  // Handle Accepting an Aidmate's Application via Firestore Transaction
  const handleAcceptApplicant = async (item: ApplicantItem) => {
    if (!jobId || !job) return;
    setProcessingId(item.application.applicationId);

    const jobRef = doc(db, 'jobs', jobId);
    const chosenAppRef = doc(db, 'applications', item.application.applicationId);

    try {
      await runTransaction(db, async (transaction) => {
        const jSnap = await transaction.get(jobRef);
        if (!jSnap.exists()) throw new Error('Task does not exist.');

        // Update Job to assigned
        transaction.update(jobRef, {
          aidmateId: item.aidmate.uid,
          status: 'assigned',
          updatedAt: serverTimestamp(),
        });

        // Mark accepted application
        transaction.update(chosenAppRef, {
          status: 'accepted',
        });
      });

      // Update remaining applications to declined
      const otherApps = applicants.filter(
        (a) => a.application.applicationId !== item.application.applicationId
      );
      for (const other of otherApps) {
        await updateDoc(doc(db, 'applications', other.application.applicationId), {
          status: 'declined',
        }).catch(() => {});
      }

      addToast(
        'success',
        'Aidmate Selected!',
        `Assigned ${item.aidmate.fullName} to your task.`
      );
      navigate(`/tracking/${jobId}`);
    } catch (err: unknown) {
      console.error('[ApplicationsPage] Acceptance failed:', err);
      const msg = err instanceof Error ? err.message : 'Failed to assign applicant.';
      addToast('error', 'Error', msg);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeclineApplicant = async (appId: string) => {
    try {
      await updateDoc(doc(db, 'applications', appId), {
        status: 'declined',
      });
      setApplicants((prev) =>
        prev.map((a) =>
          a.application.applicationId === appId
            ? { ...a, application: { ...a.application, status: 'declined' } }
            : a
        )
      );
      addToast('info', 'Application Declined', 'Aidmate was notified.');
    } catch (err) {
      console.error('[ApplicationsPage] Decline error:', err);
    }
  };

  if (loading || !job) {
    return (
      <div className="min-h-screen bg-[#FFF8F5] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-full border-4 border-[#FF6B4A] border-t-transparent animate-spin mb-3" />
        <p className="text-sm font-semibold text-[#1A1D3E]">Loading applicants...</p>
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
            onClick={() => navigate(`/task/${jobId}`)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#FF6B4A]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Task Details</span>
          </button>
          <h1 className="text-base font-bold text-[#1A1D3E]">Applicants</h1>
          <div className="w-12" />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-5 flex flex-col gap-5">
        {/* Task Summary Banner */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex items-center justify-between gap-4">
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              Task Posting
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

        {/* Applicants List */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#1A1D3E] flex items-center gap-2">
            <Users className="w-4 h-4 text-[#FF6B4A]" />
            <span>Received Applications ({applicants.length})</span>
          </h3>
        </div>

        {applicants.length === 0 ? (
          <EmptyState
            title="No applications yet"
            description="Nearby Aidmates will be notified. Check back soon or share the task to get faster responses."
            className="my-8 bg-white rounded-3xl p-8 border border-slate-100 shadow-sm"
          />
        ) : (
          <div className="flex flex-col gap-3.5">
            {applicants.map(({ application, aidmate }) => {
              const isAssigned = job.aidmateId === aidmate.uid;
              const isDeclined = application.status === 'declined';
              const isProcessing = processingId === application.applicationId;

              return (
                <div
                  key={application.applicationId}
                  className={`bg-white rounded-3xl p-5 border transition-all shadow-sm flex flex-col gap-3 ${
                    isAssigned
                      ? 'border-emerald-300 bg-emerald-50/20 ring-2 ring-emerald-400/20'
                      : 'border-slate-100'
                  }`}
                >
                  {/* Top: Aidmate Profile Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={aidmate.photoURL || undefined}
                        name={aidmate.fullName}
                        size="md"
                      />
                      <div>
                        <h4 className="font-bold text-base text-[#1A1D3E]">
                          {aidmate.fullName}
                        </h4>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                          <span className="font-bold text-[#1A1D3E]">
                            {aidmate.ratingAverage.toFixed(1)}
                          </span>
                          <span>• {aidmate.totalJobsCompleted} jobs completed</span>
                        </div>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/chat/${jobId}`)}
                      leftIcon={<MessageSquare className="w-4 h-4" />}
                    >
                      Chat
                    </Button>
                  </div>

                  {/* Message Note */}
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-600 leading-relaxed italic">
                    &ldquo;{application.message}&rdquo;
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                    {isAssigned ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                        <Check className="w-3.5 h-3.5" />
                        <span>Accepted Aidmate</span>
                      </span>
                    ) : isDeclined ? (
                      <span className="text-xs text-slate-400 font-medium">Declined</span>
                    ) : (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeclineApplicant(application.applicationId)}
                          disabled={isProcessing || Boolean(job.aidmateId)}
                          className="text-slate-400 hover:text-red-500 text-xs"
                        >
                          Decline
                        </Button>

                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          isLoading={isProcessing}
                          loadingText="Assigning..."
                          onClick={() => handleAcceptApplicant({ application, aidmate })}
                          disabled={Boolean(job.aidmateId)}
                          leftIcon={<CheckCircle2 className="w-4 h-4" />}
                        >
                          Accept Aidmate
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default ApplicationsPage;
