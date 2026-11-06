import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HeartHandshake,
  MapPin,
  Bell,
  Zap,
  ClipboardList,
  Search,
  ArrowRight,
  Sparkles,
  Clock,
  AlertCircle,
  Briefcase,
  ChevronRight,
} from 'lucide-react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/contexts/LocationContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { useAidmateStatus } from '@/hooks/useAidmateStatus';
import { useGeocoding } from '@/hooks/useGeocoding';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { BottomNav } from '@/components/BottomNav';
import { TaskCard } from '@/components/TaskCard';
import type { Job } from '@/types';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const { currentLocation, requestPermission } = useLocation();
  const { notifications, unreadCount } = useNotifications();
  const { isAvailable, toggleAvailability, loading: statusLoading } = useAidmateStatus();
  const { reverseGeocode } = useGeocoding();

  const [addressDisplay, setAddressDisplay] = useState<string>('Locating...');
  const [activeJobs, setActiveJobs] = useState<Job[]>([]);
  const [nearbyTasks, setNearbyTasks] = useState<Job[]>([]);
  const [loadingActive, setLoadingActive] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(true);

  // Reverse geocode user location
  useEffect(() => {
    let isMounted = true;
    if (currentLocation) {
      reverseGeocode(currentLocation.lat, currentLocation.lng).then((addr) => {
        if (isMounted) {
          // Truncate to neighborhood / city
          const parts = addr.split(',');
          const shortAddr = parts.length > 2 ? `${parts[0]}, ${parts[1]}` : addr;
          setAddressDisplay(shortAddr);
        }
      });
    } else {
      setAddressDisplay('Location required');
    }
    return () => {
      isMounted = false;
    };
  }, [currentLocation, reverseGeocode]);

  // Handle Aidmate availability toggle
  const handleToggle = async () => {
    try {
      if (!isAvailable && !currentLocation) {
        await requestPermission();
      }
      await toggleAvailability();
    } catch (err) {
      console.error('[HomePage] Toggle error:', err);
    }
  };

  // Fetch "Your Active Jobs" (user is requester OR assigned aidmate, with active status)
  useEffect(() => {
    if (!user?.uid) {
      setActiveJobs([]);
      setLoadingActive(false);
      return;
    }

    const lockedStatuses = [
      'searching',
      'assigned',
      'in_progress',
      'completion_requested',
      'otp_verified',
      'payment_pending',
    ];

    const qRequester = query(
      collection(db, 'jobs'),
      where('requesterId', '==', user.uid),
      where('status', 'in', lockedStatuses),
      limit(5)
    );

    const unsubRequester = onSnapshot(
      qRequester,
      (snapshot) => {
        const jobs = snapshot.docs.map((d) => ({
          jobId: d.id,
          ...d.data(),
        })) as Job[];
        setActiveJobs(jobs);
        setLoadingActive(false);
      },
      (err) => {
        console.error('[HomePage] Active jobs error:', err);
        setLoadingActive(false);
      }
    );

    return () => {
      unsubRequester();
    };
  }, [user?.uid]);

  // Fetch "Nearby Tasks" (passive jobs posted)
  useEffect(() => {
    const qTasks = query(
      collection(db, 'jobs'),
      where('status', '==', 'posted'),
      limit(6)
    );

    const unsubTasks = onSnapshot(
      qTasks,
      (snapshot) => {
        const tasks = snapshot.docs.map((d) => ({
          jobId: d.id,
          ...d.data(),
        })) as Job[];
        setNearbyTasks(tasks);
        setLoadingTasks(false);
      },
      (err) => {
        console.error('[HomePage] Nearby tasks error:', err);
        setLoadingTasks(false);
      }
    );

    return () => {
      unsubTasks();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#FFF8F5]/60 pb-24 sm:pb-12 text-[#1A1D3E]">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3.5 transition-all">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          {/* Logo & Location */}
          <div className="flex items-center gap-3 min-w-0">
            <div
              onClick={() => navigate('/home')}
              className="flex items-center gap-2 cursor-pointer shrink-0"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#FF6B4A] to-[#FF8E75] flex items-center justify-center text-white shadow-md shadow-[#FF6B4A]/25">
                <HeartHandshake className="w-5 h-5 stroke-[2.5]" />
              </div>
              <span className="hidden sm:inline text-xl font-black text-[#1A1D3E]">
                Aid<span className="text-[#FF6B4A]">mate</span>
              </span>
            </div>

            {/* Geolocation indicator */}
            <button
              type="button"
              onClick={() => requestPermission()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100/80 hover:bg-slate-200/60 text-xs font-semibold text-[#1A1D3E] truncate max-w-[200px] sm:max-w-xs transition-colors"
            >
              <MapPin className="w-3.5 h-3.5 text-[#FF6B4A] shrink-0" />
              <span className="truncate">{addressDisplay}</span>
            </button>
          </div>

          {/* Right: Notifications & Profile Avatar */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/notifications')}
              aria-label="View notifications"
              className="relative p-2 rounded-xl text-slate-600 hover:text-[#1A1D3E] hover:bg-slate-100 transition-colors focus:outline-none"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#EF4444] text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => navigate('/profile')}
              aria-label="View profile"
              className="rounded-full ring-2 ring-[#FF6B4A]/20 hover:ring-[#FF6B4A]/60 transition-all focus:outline-none"
            >
              <Avatar
                src={userProfile?.photoURL || user?.photoURL || undefined}
                name={userProfile?.fullName || 'User'}
                size="sm"
              />
            </button>
          </div>
        </div>
      </header>

      {/* Main Page Body */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-5 flex flex-col gap-6">
        {/* Active Aidmate Toggle Banner */}
        <div
          className={`w-full rounded-3xl p-4 sm:p-5 border transition-all duration-300 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 ${
            isAvailable
              ? 'bg-gradient-to-r from-emerald-50 via-green-50/70 to-white border-emerald-200/80'
              : 'bg-white border-slate-200/90'
          }`}
        >
          <div className="flex items-center gap-3.5 w-full sm:w-auto">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                isAvailable
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 ring-4 ring-emerald-100'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              <Sparkles
                className={`w-6 h-6 ${isAvailable ? 'animate-spin-slow text-white' : ''}`}
              />
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base text-[#1A1D3E]">
                  Active Aidmate Mode
                </span>
                {isAvailable && (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {isAvailable
                  ? "You're available to help! Nearby requests will appear here."
                  : 'Toggle on to receive instant help requests near you.'}
              </p>
            </div>
          </div>

          {/* Toggle Switch */}
          <div className="flex items-center justify-between w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
            <span className="sm:hidden text-xs font-semibold text-slate-500">
              {isAvailable ? 'Available' : 'Offline'}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={isAvailable}
              disabled={statusLoading}
              onClick={handleToggle}
              className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-4 focus:ring-emerald-500/20 ${
                isAvailable ? 'bg-emerald-500' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  isAvailable ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Main Action Cards (Two Big Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card 1: Need Help Now (Active Mode) */}
          <div
            onClick={() => navigate('/active-request')}
            role="button"
            tabIndex={0}
            className="group relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-[#FF6B4A] to-[#FF8E75] text-white shadow-lg shadow-[#FF6B4A]/25 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-200 select-none"
          >
            <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-white/10 blur-xl pointer-events-none" />
            <div className="relative z-10 flex flex-col justify-between h-full min-h-[140px]">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shadow-inner">
                  <Zap className="w-6 h-6 stroke-[2.5]" />
                </div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm">
                  Active • Instant
                </span>
              </div>

              <div className="mt-4">
                <h3 className="text-xl font-black tracking-tight leading-tight flex items-center justify-between">
                  <span>Need Help Now</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
                </h3>
                <p className="text-xs text-white/85 mt-1 leading-relaxed">
                  Get instant dispatch from nearby Aidmates ready to assist right away.
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: Post a Task (Passive Mode) */}
          <div
            onClick={() => navigate('/passive-request')}
            role="button"
            tabIndex={0}
            className="group relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-[#1A1D3E] to-[#2E336B] text-white shadow-lg shadow-[#1A1D3E]/20 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-200 select-none"
          >
            <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-blue-400/10 blur-xl pointer-events-none" />
            <div className="relative z-10 flex flex-col justify-between h-full min-h-[140px]">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-white shadow-inner">
                  <ClipboardList className="w-6 h-6 stroke-[2.2]" />
                </div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm">
                  Scheduled Task
                </span>
              </div>

              <div className="mt-4">
                <h3 className="text-xl font-black tracking-tight leading-tight flex items-center justify-between">
                  <span>Post a Task</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
                </h3>
                <p className="text-xs text-white/85 mt-1 leading-relaxed">
                  Schedule a task for someone to complete later today or this week.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Universal Search Bar */}
        <div
          onClick={() => navigate('/search')}
          role="button"
          tabIndex={0}
          className="w-full bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm hover:border-[#FF6B4A]/50 hover:shadow-md transition-all duration-200 flex items-center gap-3 cursor-pointer select-none group"
        >
          <div className="w-9 h-9 rounded-xl bg-[#FFF8F5] text-[#FF6B4A] flex items-center justify-center shrink-0 group-hover:bg-[#FF6B4A] group-hover:text-white transition-colors">
            <Search className="w-4 h-4 stroke-[2.5]" />
          </div>
          <span className="text-sm text-slate-400 group-hover:text-slate-600 truncate flex-1 font-medium">
            Search for help, tasks, or something you can do...
          </span>
          <span className="hidden sm:inline text-xs font-semibold text-[#FF6B4A] bg-[#FF6B4A]/10 px-2.5 py-1 rounded-lg">
            Explore All
          </span>
        </div>

        {/* Section 1: Your Active Jobs */}
        {activeJobs.length > 0 && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#1A1D3E] flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-[#FF6B4A]" />
                <span>Your Active Jobs</span>
              </h2>
              <button
                type="button"
                onClick={() => navigate('/history')}
                className="text-xs font-semibold text-[#FF6B4A] hover:underline flex items-center gap-1"
              >
                <span>View all</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Horizontal scrollable cards */}
            <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-2 pt-1 -mx-4 px-4 sm:mx-0 sm:px-0">
              {activeJobs.map((job) => (
                <div
                  key={job.jobId}
                  onClick={() => {
                    if (job.status === 'searching') {
                      navigate(`/matching/${job.jobId}`);
                    } else if (job.status === 'completed' || job.status === 'payment_pending') {
                      navigate(`/payment/${job.jobId}`);
                    } else {
                      navigate(`/tracking/${job.jobId}`);
                    }
                  }}
                  className="min-w-[280px] sm:min-w-[320px] bg-white rounded-2xl p-4 border border-slate-200 shadow-sm hover:shadow-md hover:border-[#FF6B4A]/50 transition-all cursor-pointer shrink-0 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="primary" size="sm" dot>
                        {job.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                      <span className="font-extrabold text-sm text-[#1A1D3E]">
                        ₹{job.offeredAmount}
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-[#1A1D3E] line-clamp-1">
                      {job.title}
                    </h4>
                    <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                      {job.taskAddress || 'Nearby Location'}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-[#FF6B4A] font-semibold">
                    <span>
                      {job.status === 'searching'
                        ? 'Finding Aidmate...'
                        : 'Track Live Status'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Section 2: Nearby Tasks */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#1A1D3E]">Nearby Tasks</h2>
              <p className="text-xs text-slate-500">
                Lend a hand to neighbors around your community
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/search')}
              className="text-xs font-semibold text-[#FF6B4A] hover:underline flex items-center gap-1"
            >
              <span>See more</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {loadingTasks ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-6">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-32 bg-slate-100 rounded-2xl animate-pulse"
                />
              ))}
            </div>
          ) : nearbyTasks.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 border border-slate-100 text-center flex flex-col items-center">
              <ClipboardList className="w-10 h-10 text-slate-300 mb-2" />
              <p className="text-sm font-bold text-[#1A1D3E]">No tasks nearby right now</p>
              <p className="text-xs text-slate-400 mt-1">
                Be the first to post a task or check back soon!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {nearbyTasks.map((task) => (
                <TaskCard key={task.jobId} job={task} />
              ))}
            </div>
          )}
        </section>

        {/* Section 3: Recent Activity */}
        {notifications.length > 0 && (
          <section className="flex flex-col gap-3 mb-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#1A1D3E]">Recent Activity</h2>
              <button
                type="button"
                onClick={() => navigate('/notifications')}
                className="text-xs font-semibold text-[#FF6B4A] hover:underline"
              >
                View all
              </button>
            </div>

            <div className="bg-white rounded-3xl p-2 border border-slate-100 shadow-sm flex flex-col divide-y divide-slate-100">
              {notifications.slice(0, 3).map((notif) => (
                <div
                  key={notif.notificationId}
                  onClick={() => {
                    if (notif.relatedJobId) {
                      navigate(`/tracking/${notif.relatedJobId}`);
                    } else {
                      navigate('/notifications');
                    }
                  }}
                  className="p-3 hover:bg-slate-50/80 rounded-2xl transition-colors cursor-pointer flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-[#FF6B4A]/10 text-[#FF6B4A] flex items-center justify-center shrink-0">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-[#1A1D3E] truncate">
                        {notif.title}
                      </span>
                      <span className="text-[11px] text-slate-500 truncate">
                        {notif.message}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav activeTab="home" />
    </div>
  );
};

export default HomePage;
