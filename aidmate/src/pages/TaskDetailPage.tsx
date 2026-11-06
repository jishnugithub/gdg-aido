import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Share2,
  MapPin,
  Clock,
  IndianRupee,
  Star,
  Users,
  ShieldCheck,
  Send,
  MessageSquare,
  Sparkles,
  Calendar,
  CheckCircle2,
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
import { MapView } from '@/components/MapView';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import type { Job, User as UserType, Application } from '@/types';

export const TaskDetailPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();

  const [job, setJob] = useState<Job | null>(null);
  const [requester, setRequester] = useState<UserType | null>(null);
  const [existingApplication, setExistingApplication] = useState<Application | null>(null);
  const [applicationCount, setApplicationCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Apply modal
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [applyMessage, setApplyMessage] = useState('');
  const [isSubmittingApp, setIsSubmittingApp] = useState(false);

  useEffect(() => {
    if (!jobId) return;

    const fetchTask = async () => {
      try {
        const jobSnap = await getDoc(doc(db, 'jobs', jobId));
        if (!jobSnap.exists()) {
          addToast('error', 'Task Not Found', 'This task does not exist or was removed.');
          navigate('/search');
          return;
        }

        const jobData = { jobId: jobSnap.id, ...jobSnap.data() } as Job;
        setJob(jobData);

        // Fetch Requester user profile
        if (jobData.requesterId) {
          const reqSnap = await getDoc(doc(db, 'users', jobData.requesterId));
          if (reqSnap.exists()) {
            setRequester(reqSnap.data() as UserType);
          }
        }

        // Fetch applications count
        const appQuery = query(collection(db, 'applications'), where('jobId', '==', jobId));
        const appSnaps = await getDocs(appQuery);
        setApplicationCount(appSnaps.size);

        // Check if current user already applied
        if (user?.uid) {
          const myApp = appSnaps.docs.find((d) => d.data().aidmateId === user.uid);
          if (myApp) {
            setExistingApplication({ applicationId: myApp.id, ...myApp.data() } as Application);
          }
        }
      } catch (err) {
        console.error('[TaskDetailPage] Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTask();
  }, [jobId, user?.uid, navigate, addToast]);

  const isOwner = user?.uid === job?.requesterId;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: job?.title || 'Aidmate Task',
          text: `Check out this task on Aidmate: ${job?.title}`,
          url: window.location.href,
        });
      } catch {
        // User aborted share
      }
    } else {
      await navigator.clipboard.writeText(window.location.href);
      addToast('info', 'Link Copied', 'Task link copied to your clipboard!');
    }
  };

  const handleApply = async () => {
    if (!jobId || !user?.uid) {
      navigate('/login');
      return;
    }

    if (!applyMessage.trim()) {
      addToast('warning', 'Message required', 'Please write a brief note to the requester.');
      return;
    }

    setIsSubmittingApp(true);
    try {
      const newAppRef = doc(collection(db, 'applications'));
      const appData: Application = {
        applicationId: newAppRef.id,
        jobId,
        aidmateId: user.uid,
        message: applyMessage.trim(),
        status: 'pending',
        createdAt: new Date(),
      };

      await setDoc(newAppRef, {
        ...appData,
        createdAt: serverTimestamp(),
      });

      setExistingApplication(appData);
      setApplicationCount((prev) => prev + 1);
      setIsApplyModalOpen(false);
      addToast('success', 'Application Sent!', 'The requester has been notified.');
    } catch (err) {
      console.error('[TaskDetailPage] Application error:', err);
      addToast('error', 'Submission Failed', 'Could not send application.');
    } finally {
      setIsSubmittingApp(false);
    }
  };

  const formatDeadline = (date: Date | null): string => {
    if (!date) return 'Flexible Deadline';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading || !job) {
    return (
      <div className="min-h-screen bg-[#FFF8F5] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-full border-4 border-[#FF6B4A] border-t-transparent animate-spin mb-3" />
        <p className="text-sm font-semibold text-[#1A1D3E]">Loading task details...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF8F5]/60 pb-20 text-[#1A1D3E]">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3.5">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#FF6B4A]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Task Overview
          </span>

          <button
            type="button"
            onClick={handleShare}
            aria-label="Share task"
            className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-4 flex flex-col gap-5">
        {/* Hero Image (if available) */}
        {job.images && job.images.length > 0 && (
          <div className="w-full h-56 sm:h-72 rounded-3xl overflow-hidden bg-slate-100 border border-slate-200 shadow-sm relative">
            <img
              src={job.images[0]}
              alt={job.title}
              className="w-full h-full object-cover"
            />
            {job.images.length > 1 && (
              <span className="absolute bottom-3 right-3 px-3 py-1 bg-black/60 backdrop-blur-sm text-white text-xs font-bold rounded-full">
                +{job.images.length - 1} photos
              </span>
            )}
          </div>
        )}

        {/* Task Header Box */}
        <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-100 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Badge variant="primary" size="md">
                {job.category}
              </Badge>
              <Badge variant="neutral" size="sm">
                {job.status.toUpperCase()}
              </Badge>
            </div>

            <div className="flex items-center gap-1 bg-[#FFF8F5] px-4 py-1.5 rounded-2xl border border-[#FF6B4A]/25">
              <IndianRupee className="w-5 h-5 text-[#FF6B4A]" />
              <span className="text-2xl font-black text-[#1A1D3E]">
                {job.offeredAmount}
              </span>
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-black text-[#1A1D3E] tracking-tight">
              {job.title}
            </h1>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed whitespace-pre-line">
              {job.description}
            </p>
          </div>

          {/* Tags */}
          {job.tags && job.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {job.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Deadline card */}
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs">
            <div className="w-9 h-9 rounded-xl bg-[#FF6B4A]/10 text-[#FF6B4A] flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold block text-[#1A1D3E]">Required Deadline:</span>
              <span className="text-slate-500">{formatDeadline(job.deadline)}</span>
            </div>
          </div>
        </div>

        {/* Location Section */}
        <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-100 shadow-sm flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#1A1D3E] flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#FF6B4A]" />
              <span>Task Location</span>
            </h3>
            <span className="text-xs text-slate-400 truncate max-w-xs">{job.taskAddress}</span>
          </div>

          <MapView
            center={job.taskLocation}
            height="220px"
            addressLabel={job.taskAddress}
          />
        </div>

        {/* Requester Profile Card */}
        {requester && (
          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <Avatar
                src={requester.photoURL || undefined}
                name={requester.fullName}
                size="md"
              />
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">
                  Posted by
                </span>
                <h4 className="font-bold text-base text-[#1A1D3E]">
                  {requester.fullName}
                </h4>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  <span className="font-bold text-[#1A1D3E]">
                    {requester.ratingAverage.toFixed(1)}
                  </span>
                  <span>• {requester.totalJobsRequested} requested</span>
                </div>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate(`/chat/${jobId}`)}
              leftIcon={<MessageSquare className="w-4 h-4" />}
            >
              Message
            </Button>
          </div>
        )}

        {/* Bottom Call to Action */}
        <div className="pt-2">
          {isOwner ? (
            <div className="flex flex-col gap-3">
              <Button
                type="button"
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => navigate(`/task/${jobId}/applications`)}
                leftIcon={<Users className="w-5 h-5" />}
              >
                View Applications ({applicationCount})
              </Button>
            </div>
          ) : existingApplication ? (
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-center flex items-center justify-center gap-2 text-xs font-bold text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
              <span>You applied for this task. Waiting for requester approval.</span>
            </div>
          ) : (
            <Button
              type="button"
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => setIsApplyModalOpen(true)}
              leftIcon={<Sparkles className="w-5 h-5" />}
            >
              Apply for this Task
            </Button>
          )}
        </div>
      </main>

      {/* Apply Modal */}
      <Modal
        isOpen={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
        title="Apply for Task"
        description="Write a friendly note introducing yourself and your availability."
      >
        <div className="flex flex-col gap-4 py-2">
          <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 flex justify-between">
            <span>Compensation:</span>
            <span className="font-bold text-[#1A1D3E]">₹{job.offeredAmount}</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#1A1D3E]/80">
              Your Note to Requester *
            </label>
            <textarea
              rows={4}
              placeholder="Hi! I have the required tools and can come by tomorrow morning to help..."
              value={applyMessage}
              onChange={(e) => setApplyMessage(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 focus:border-[#FF6B4A] focus:ring-4 focus:ring-[#FF6B4A]/20 outline-none text-[#1A1D3E] placeholder:text-slate-400 transition-all resize-none"
              autoFocus
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsApplyModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              isLoading={isSubmittingApp}
              onClick={handleApply}
              leftIcon={<Send className="w-4 h-4" />}
            >
              Send Application
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default TaskDetailPage;
