import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  IndianRupee,
  MapPin,
  Clock,
  Briefcase,
  ChevronRight,
  Filter,
} from 'lucide-react';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { BottomNav } from '@/components/BottomNav';
import type { Job } from '@/types';

type HistoryTab = 'all' | 'requested' | 'aidmate' | 'cancelled';

export const JobHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<HistoryTab>('all');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;

    const fetchHistory = async () => {
      setLoading(true);
      try {
        // Fetch jobs where user is requester
        const qReq = query(collection(db, 'jobs'), where('requesterId', '==', user.uid));
        const snapReq = await getDocs(qReq);

        // Fetch jobs where user is aidmate
        const qAid = query(collection(db, 'jobs'), where('aidmateId', '==', user.uid));
        const snapAid = await getDocs(qAid);

        const map = new Map<string, Job>();
        snapReq.docs.forEach((d) => map.set(d.id, { jobId: d.id, ...d.data() } as Job));
        snapAid.docs.forEach((d) => map.set(d.id, { jobId: d.id, ...d.data() } as Job));

        const list = Array.from(map.values());
        list.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });

        setJobs(list);
      } catch (err) {
        console.error('[JobHistoryPage] Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [user?.uid]);

  // Tab filtering
  const filteredJobs = jobs.filter((job) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'requested') return job.requesterId === user?.uid;
    if (activeTab === 'aidmate') return job.aidmateId === user?.uid && job.status === 'completed';
    if (activeTab === 'cancelled') return job.status === 'cancelled';
    return true;
  });

  const getStatusBadge = (status: Job['status']) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success" size="sm">Completed</Badge>;
      case 'cancelled':
        return <Badge variant="neutral" size="sm">Cancelled</Badge>;
      case 'in_progress':
      case 'assigned':
        return <Badge variant="primary" size="sm" dot>In Progress</Badge>;
      case 'searching':
        return <Badge variant="warning" size="sm" dot>Searching</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{status}</Badge>;
    }
  };

  const handleCardClick = (job: Job) => {
    if (job.status === 'searching') {
      navigate(`/matching/${job.jobId}`);
    } else if (job.status === 'assigned' || job.status === 'in_progress') {
      navigate(`/tracking/${job.jobId}`);
    } else if (job.status === 'completed' || job.status === 'payment_pending') {
      navigate(`/payment/${job.jobId}`);
    } else {
      navigate(`/task/${job.jobId}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF8F5]/60 pb-24 sm:pb-12 text-[#1A1D3E]">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3.5">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#FF6B4A]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Profile</span>
          </button>
          <h1 className="text-base font-bold text-[#1A1D3E]">Job History</h1>
          <div className="w-12" />
        </div>

        {/* Tabs */}
        <div className="max-w-2xl mx-auto flex gap-1.5 pt-3 overflow-x-auto custom-scrollbar">
          {[
            { id: 'all', label: 'All Jobs' },
            { id: 'requested', label: 'Requested by Me' },
            { id: 'aidmate', label: 'Completed as Aidmate' },
            { id: 'cancelled', label: 'Cancelled' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as HistoryTab)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-[#FF6B4A] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main List */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-5">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-white rounded-3xl border border-slate-200 p-4 animate-pulse" />
            ))}
          </div>
        ) : filteredJobs.length === 0 ? (
          <EmptyState
            title="No jobs found in this section"
            description="Your past and current help requests will appear here once created."
            className="my-10 bg-white rounded-3xl p-8 border border-slate-100 shadow-sm"
          />
        ) : (
          <div className="flex flex-col gap-3">
            {filteredJobs.map((job) => {
              const isRequester = job.requesterId === user?.uid;
              const dateStr = job.createdAt
                ? new Date(job.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'Recent';

              return (
                <div
                  key={job.jobId}
                  onClick={() => handleCardClick(job)}
                  className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-sm hover:shadow-md hover:border-[#FF6B4A]/50 transition-all cursor-pointer flex flex-col justify-between gap-3 group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {getStatusBadge(job.status)}
                        <span className="text-[11px] font-semibold text-slate-400">
                          {isRequester ? 'You Requested' : 'Assigned as Aidmate'}
                        </span>
                      </div>
                      <h3 className="font-bold text-base text-[#1A1D3E] group-hover:text-[#FF6B4A] transition-colors line-clamp-1">
                        {job.title}
                      </h3>
                      <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                        {job.taskAddress || 'Hyperlocal location'}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-0.5 font-black text-base text-[#1A1D3E]">
                        <IndianRupee className="w-4 h-4 text-[#FF6B4A]" />
                        <span>{job.offeredAmount}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">{dateStr}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                    <span className="bg-slate-100 px-2 py-0.5 rounded-md text-[10px] font-semibold text-slate-600">
                      {job.category}
                    </span>
                    <span className="flex items-center gap-1 text-[#FF6B4A] font-bold">
                      <span>View</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <BottomNav activeTab="profile" />
    </div>
  );
};

export default JobHistoryPage;
