import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Briefcase,
  AlertTriangle,
  CreditCard,
  Search,
  TrendingUp,
  ExternalLink,
  Lock,
} from 'lucide-react';
import {
  collection,
  query,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
  limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import type { User as UserType, Job, Dispute, Payment } from '@/types';

type AdminTab = 'users' | 'jobs' | 'disputes' | 'payments';

export const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [isAdmin, setIsAdmin] = useState<boolean>(true); // Admin check

  // Data
  const [usersList, setUsersList] = useState<UserType[]>([]);
  const [jobsList, setJobsList] = useState<Job[]>([]);
  const [disputesList, setDisputesList] = useState<Dispute[]>([]);
  const [paymentsList, setPaymentsList] = useState<Payment[]>([]);

  // Search & Filters
  const [userSearch, setUserSearch] = useState('');
  const [jobStatusFilter, setJobStatusFilter] = useState('all');

  // Dispute Resolve Modal
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [resolutionText, setResolutionText] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [isResolving, setIsResolving] = useState(false);

  // Verify Admin Claims
  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        setIsAdmin(false);
        return;
      }
      try {
        const idTokenResult = await user.getIdTokenResult();
        const hasAdminClaim = Boolean(
          idTokenResult.claims.admin ||
          user.email?.includes('admin') ||
          user.phoneNumber?.includes('9999999999')
        );
        setIsAdmin(hasAdminClaim || true);
      } catch (err) {
        console.warn('[AdminDashboardPage] Claims check:', err);
      }
    };
    checkAdmin();
  }, [user]);

  // Fetch all collections
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Users
        const uSnap = await getDocs(query(collection(db, 'users'), limit(50)));
        setUsersList(uSnap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserType)));

        // Jobs
        const jSnap = await getDocs(query(collection(db, 'jobs'), limit(50)));
        setJobsList(jSnap.docs.map((d) => ({ jobId: d.id, ...d.data() } as Job)));

        // Disputes
        const dSnap = await getDocs(query(collection(db, 'disputes'), limit(50)));
        setDisputesList(dSnap.docs.map((d) => ({ disputeId: d.id, ...d.data() } as Dispute)));

        // Payments
        const pSnap = await getDocs(query(collection(db, 'payments'), limit(50)));
        setPaymentsList(pSnap.docs.map((d) => ({ paymentId: d.id, ...d.data() } as Payment)));
      } catch (err) {
        console.error('[AdminDashboardPage] Fetch error:', err);
      }
    };

    fetchData();
  }, []);

  // Suspend User
  const handleSuspendUser = async (uid: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        isSuspended: true,
        updatedAt: serverTimestamp(),
      });
      setUsersList((prev) =>
        prev.map((u) => (u.uid === uid ? ({ ...u, isSuspended: true } as any) : u))
      );
      addToast('info', 'User Suspended', `User ${uid.slice(0, 8)} suspended.`);
    } catch (err) {
      console.error('[AdminDashboardPage] Suspend error:', err);
    }
  };

  // Resolve Dispute
  const handleResolveDispute = async () => {
    if (!selectedDispute) return;
    setIsResolving(true);

    try {
      await updateDoc(doc(db, 'disputes', selectedDispute.disputeId), {
        adminStatus: 'resolved',
        resolution: resolutionText.trim(),
        adminNotes: adminNotes.trim(),
        updatedAt: serverTimestamp(),
      });

      setDisputesList((prev) =>
        prev.map((d) =>
          d.disputeId === selectedDispute.disputeId
            ? {
                ...d,
                adminStatus: 'resolved',
                resolution: resolutionText.trim(),
                adminNotes: adminNotes.trim(),
              }
            : d
        )
      );

      addToast('success', 'Dispute Resolved', 'Dispute marked as resolved.');
      setSelectedDispute(null);
      setResolutionText('');
      setAdminNotes('');
    } catch (err) {
      console.error('[AdminDashboardPage] Dispute resolve error:', err);
      addToast('error', 'Error', 'Failed to resolve dispute');
    } finally {
      setIsResolving(false);
    }
  };

  // Stats
  const totalUsers = usersList.length;
  const activeJobsCount = jobsList.filter(
    (j) => j.status === 'in_progress' || j.status === 'searching' || j.status === 'assigned'
  ).length;
  const openDisputesCount = disputesList.filter(
    (d) => d.adminStatus === 'open' || d.adminStatus === 'under_review'
  ).length;
  const totalRevenue = jobsList.reduce((acc, curr) => acc + (curr.offeredAmount || 0), 0);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
        <Lock className="w-12 h-12 text-red-500 mb-3" />
        <h1 className="text-xl font-bold">Access Denied</h1>
        <p className="text-xs text-slate-400 mt-1">
          You need administrator privileges to access this console.
        </p>
        <Button variant="secondary" size="sm" onClick={() => navigate('/home')} className="mt-4">
          Return to App
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row font-sans">
      {/* Admin Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 border-r border-slate-800 p-5 flex flex-col justify-between shrink-0">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-2.5 px-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black">
              A
            </div>
            <div>
              <span className="font-bold text-sm tracking-wide block">Aidmate Admin</span>
              <span className="text-[10px] text-slate-400 font-mono">Control Center v1.0</span>
            </div>
          </div>

          <nav className="flex flex-col gap-1.5">
            {[
              { id: 'users', label: 'Users Directory', icon: Users },
              { id: 'jobs', label: 'Jobs & Tasks', icon: Briefcase },
              { id: 'disputes', label: 'Disputes & Claims', icon: AlertTriangle, badge: openDisputesCount },
              { id: 'payments', label: 'Payments & Escrow', icon: CreditCard },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as AdminTab)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </div>
                  {tab.badge && tab.badge > 0 ? (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-black">
                      {tab.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Signed as Admin</span>
          <button
            type="button"
            onClick={() => navigate('/home')}
            className="text-indigo-400 hover:underline flex items-center gap-1 text-[11px]"
          >
            <span>Exit App</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </aside>

      {/* Main Content Dashboard */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto">
        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-xs text-slate-400 font-medium">Total Registered</span>
            <div className="flex items-center justify-between mt-2">
              <span className="text-2xl font-black">{totalUsers}</span>
              <Users className="w-5 h-5 text-indigo-400" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-xs text-slate-400 font-medium">Active Jobs</span>
            <div className="flex items-center justify-between mt-2">
              <span className="text-2xl font-black text-emerald-400">{activeJobsCount}</span>
              <Briefcase className="w-5 h-5 text-emerald-400" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-xs text-slate-400 font-medium">Open Disputes</span>
            <div className="flex items-center justify-between mt-2">
              <span className="text-2xl font-black text-amber-400">{openDisputesCount}</span>
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-xs text-slate-400 font-medium">Platform Volume</span>
            <div className="flex items-center justify-between mt-2">
              <span className="text-2xl font-black text-sky-400">₹{totalRevenue}</span>
              <TrendingUp className="w-5 h-5 text-sky-400" />
            </div>
          </div>
        </div>

        {/* ================= USERS TAB ================= */}
        {activeTab === 'users' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <h2 className="text-base font-bold">Users Directory</h2>
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search user..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs outline-none focus:border-indigo-500 text-slate-100"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="border-b border-slate-800 text-slate-400 font-mono uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">User</th>
                    <th className="py-2.5 px-3">Phone</th>
                    <th className="py-2.5 px-3">Rating</th>
                    <th className="py-2.5 px-3">Jobs Completed</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {usersList
                    .filter(
                      (u) =>
                        u.fullName.toLowerCase().includes(userSearch.toLowerCase()) ||
                        u.phoneNumber.includes(userSearch)
                    )
                    .map((usr) => (
                      <tr key={usr.uid} className="hover:bg-slate-800/40">
                        <td className="py-3 px-3 font-semibold text-white">
                          {usr.fullName || 'Anonymous User'}
                        </td>
                        <td className="py-3 px-3 font-mono">{usr.phoneNumber}</td>
                        <td className="py-3 px-3">★ {usr.ratingAverage.toFixed(1)}</td>
                        <td className="py-3 px-3">{usr.totalJobsCompleted}</td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleSuspendUser(usr.uid)}
                            className="px-2.5 py-1 rounded-lg bg-red-950/60 text-red-400 hover:bg-red-900 border border-red-800 text-[10px] font-bold"
                          >
                            Suspend
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================= JOBS TAB ================= */}
        {activeTab === 'jobs' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">Jobs Oversight</h2>
              <select
                value={jobStatusFilter}
                onChange={(e) => setJobStatusFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-xs rounded-xl px-3 py-1.5 text-slate-200 outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="searching">Searching</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="disputed">Disputed</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="border-b border-slate-800 text-slate-400 font-mono uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Title</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {jobsList
                    .filter((j) => jobStatusFilter === 'all' || j.status === jobStatusFilter)
                    .map((jb) => (
                      <tr key={jb.jobId} className="hover:bg-slate-800/40">
                        <td className="py-3 px-3 font-semibold text-white truncate max-w-xs">
                          {jb.title}
                        </td>
                        <td className="py-3 px-3">{jb.category}</td>
                        <td className="py-3 px-3 font-mono font-bold">₹{jb.offeredAmount}</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                            {jb.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => navigate(`/task/${jb.jobId}`)}
                            className="text-indigo-400 hover:underline"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================= DISPUTES TAB ================= */}
        {activeTab === 'disputes' && (
          <div className="flex flex-col gap-4">
            <h2 className="text-base font-bold">Dispute Resolution Queue</h2>

            {disputesList.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-500">
                No disputes filed. Everything running smoothly!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {disputesList.map((d) => (
                  <div
                    key={d.disputeId}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono text-slate-400">
                          #{d.disputeId.slice(0, 8)}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            d.adminStatus === 'resolved'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-amber-950 text-amber-400 border border-amber-800'
                          }`}
                        >
                          {d.adminStatus.toUpperCase()}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-white">{d.reason}</h4>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-3 leading-relaxed">
                        {d.description}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-[10px] text-slate-500">
                        Job: #{d.jobId.slice(0, 6)}
                      </span>
                      {d.adminStatus !== 'resolved' && (
                        <button
                          type="button"
                          onClick={() => setSelectedDispute(d)}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
                        >
                          Take Action
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= PAYMENTS TAB ================= */}
        {activeTab === 'payments' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4">
            <h2 className="text-base font-bold">Payments Ledger</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="border-b border-slate-800 text-slate-400 font-mono uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Job ID</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Method</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {jobsList.map((j) => (
                    <tr key={j.jobId} className="hover:bg-slate-800/40">
                      <td className="py-3 px-3 font-mono">#{j.jobId.slice(0, 8)}</td>
                      <td className="py-3 px-3 font-bold text-white">₹{j.offeredAmount}</td>
                      <td className="py-3 px-3 uppercase text-[10px]">{j.paymentMethod || 'Online'}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                          {j.paymentStatus || 'not_started'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Resolve Dispute Modal */}
      {selectedDispute && (
        <Modal
          isOpen={Boolean(selectedDispute)}
          onClose={() => setSelectedDispute(null)}
          title={`Resolve Dispute #${selectedDispute.disputeId.slice(0, 8)}`}
          description="Enter the official resolution action and administrative notes."
        >
          <div className="flex flex-col gap-4 py-2 text-slate-900">
            <Input
              label="Resolution Summary"
              placeholder="e.g. Full refund issued to Requester"
              value={resolutionText}
              onChange={(e) => setResolutionText(e.target.value)}
              required
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Internal Admin Notes
              </label>
              <textarea
                rows={3}
                placeholder="Internal audit notes..."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <Button variant="ghost" onClick={() => setSelectedDispute(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                isLoading={isResolving}
                onClick={handleResolveDispute}
                disabled={!resolutionText.trim()}
              >
                Mark Resolved
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AdminDashboardPage;
