import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Star,
  Briefcase,
  History,
  LogOut,
  Edit3,
  Check,
  Plus,
  Shield,
  Calendar,
  Sparkles,
  Phone,
  Settings,
} from 'lucide-react';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAidmateStatus } from '@/hooks/useAidmateStatus';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { StarRating } from '@/components/ui/StarRating';
import { BottomNav } from '@/components/BottomNav';
import { JOB_CATEGORIES, type Review } from '@/types';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, userProfile, updateProfile, signOut } = useAuth();
  const { isAvailable, toggleAvailability, aidmateProfile, updateServiceCategories } = useAidmateStatus();
  const { addToast } = useToast();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);

  // Edit profile modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState(userProfile?.fullName || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Category preferences state
  const [selectedCats, setSelectedCats] = useState<string[]>(
    aidmateProfile?.serviceCategories || ['Moving & Lifting', 'Delivery & Pickup']
  );
  const [isSavingCats, setIsSavingCats] = useState(false);

  useEffect(() => {
    if (userProfile?.fullName) {
      setEditName(userProfile.fullName);
    }
  }, [userProfile?.fullName]);

  useEffect(() => {
    if (aidmateProfile?.serviceCategories) {
      setSelectedCats(aidmateProfile.serviceCategories);
    }
  }, [aidmateProfile?.serviceCategories]);

  // Fetch Reviews received by current user
  useEffect(() => {
    if (!user?.uid) return;

    const fetchReviews = async () => {
      try {
        const revQuery = query(collection(db, 'reviews'), where('reviewedUserId', '==', user.uid));
        const revSnaps = await getDocs(revQuery);
        const list = revSnaps.docs.map((d) => ({
          reviewId: d.id,
          ...d.data(),
        })) as Review[];
        setReviews(list);
      } catch (err) {
        console.error('[ProfilePage] Reviews fetch error:', err);
      } finally {
        setLoadingReviews(false);
      }
    };

    fetchReviews();
  }, [user?.uid]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;

    setIsSavingProfile(true);
    try {
      await updateProfile({ fullName: editName.trim() });
      addToast('success', 'Profile Updated', 'Your display name has been saved.');
      setIsEditModalOpen(false);
    } catch (err) {
      console.error('[ProfilePage] Profile save failed:', err);
      addToast('error', 'Error', 'Failed to update profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleToggleCategory = async (cat: string) => {
    const next = selectedCats.includes(cat)
      ? selectedCats.filter((c) => c !== cat)
      : [...selectedCats, cat];

    setSelectedCats(next);
    setIsSavingCats(true);
    try {
      await updateServiceCategories(next);
    } catch (err) {
      console.error('[ProfilePage] Category update error:', err);
    } finally {
      setIsSavingCats(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (err) {
      console.error('[ProfilePage] Signout error:', err);
    }
  };

  const memberSinceYear = userProfile?.createdAt
    ? new Date(userProfile.createdAt).getFullYear()
    : 2026;

  return (
    <div className="min-h-screen bg-[#FFF8F5]/60 pb-24 sm:pb-12 text-[#1A1D3E]">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3.5 flex items-center justify-between">
        <h1 className="text-lg font-black text-[#1A1D3E]">My Profile</h1>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center gap-1.5 text-xs font-bold text-red-500 hover:text-red-700 hover:underline"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </header>

      {/* Main Container */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-5 flex flex-col gap-5">
        {/* Profile Card Header */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center sm:items-start justify-between gap-5 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Avatar
              src={userProfile?.photoURL || user?.photoURL || undefined}
              name={userProfile?.fullName || 'User'}
              size="lg"
            />
            <div>
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <h2 className="text-xl font-black text-[#1A1D3E]">
                  {userProfile?.fullName || 'Neighbor'}
                </h2>
                <Badge variant="primary" size="sm">
                  Verified
                </Badge>
              </div>

              <p className="text-xs text-slate-500 mt-1 flex items-center justify-center sm:justify-start gap-1">
                <Phone className="w-3 h-3 text-slate-400" />
                <span>{user?.phoneNumber || 'No phone'}</span>
                <span className="mx-1">•</span>
                <Calendar className="w-3 h-3 text-slate-400" />
                <span>Member since {memberSinceYear}</span>
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsEditModalOpen(true)}
            leftIcon={<Edit3 className="w-3.5 h-3.5" />}
          >
            Edit Profile
          </Button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm text-center flex flex-col items-center">
            <span className="text-2xl font-black text-[#FF6B4A]">
              {userProfile?.totalJobsCompleted || 0}
            </span>
            <span className="text-[11px] font-semibold text-slate-500 mt-0.5">
              Jobs Completed
            </span>
          </div>

          <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm text-center flex flex-col items-center">
            <span className="text-2xl font-black text-[#1A1D3E]">
              {userProfile?.totalJobsRequested || 0}
            </span>
            <span className="text-[11px] font-semibold text-slate-500 mt-0.5">
              Tasks Requested
            </span>
          </div>

          <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm text-center flex flex-col items-center">
            <div className="flex items-center gap-1 text-2xl font-black text-amber-500">
              <Star className="w-5 h-5 fill-amber-500" />
              <span>{(userProfile?.ratingAverage || 5.0).toFixed(1)}</span>
            </div>
            <span className="text-[11px] font-semibold text-slate-500 mt-0.5">
              Avg Rating ({reviews.length})
            </span>
          </div>
        </div>

        {/* Quick Links Card */}
        <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm flex flex-col divide-y divide-slate-100">
          <div
            onClick={() => navigate('/history')}
            role="button"
            tabIndex={0}
            className="py-3 px-2 flex items-center justify-between hover:bg-slate-50 rounded-2xl transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#FF6B4A]/10 text-[#FF6B4A] flex items-center justify-center">
                <History className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#1A1D3E]">Job History</h4>
                <p className="text-[11px] text-slate-400">View past requests & completions</p>
              </div>
            </div>
            <span className="text-xs font-bold text-[#FF6B4A]">View &rarr;</span>
          </div>
        </div>

        {/* Aidmate Availability & Skills section */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#1A1D3E]">
                Aidmate Service Categories
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Select the tasks you are comfortable helping neighbors with.
              </p>
            </div>

            {isSavingCats && (
              <span className="text-[11px] text-[#FF6B4A] font-semibold animate-pulse">
                Saving...
              </span>
            )}
          </div>

          {/* Chips grid */}
          <div className="flex flex-wrap gap-2 pt-1">
            {JOB_CATEGORIES.map((cat) => {
              const isSelected = selectedCats.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleToggleCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-[#FF6B4A] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5" />}
                  <span>{cat}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Reviews Section */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-sm flex flex-col gap-4">
          <h3 className="text-base font-bold text-[#1A1D3E]">
            Community Reviews ({reviews.length})
          </h3>

          {loadingReviews ? (
            <div className="py-6 text-center text-xs text-slate-400">Loading reviews...</div>
          ) : reviews.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No reviews yet. Complete your first task to start collecting feedback!
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-slate-100">
              {reviews.map((rev) => (
                <div key={rev.reviewId} className="py-3.5 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <StarRating rating={rev.rating} size="sm" />
                    <span className="text-[11px] text-slate-400">
                      {new Date(rev.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {rev.comment && (
                    <p className="text-xs text-slate-600 italic leading-relaxed">
                      &ldquo;{rev.comment}&rdquo;
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Profile"
      >
        <form onSubmit={handleSaveProfile} className="flex flex-col gap-4 py-2">
          <Input
            label="Full Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
            autoFocus
          />

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSavingProfile}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Bottom Nav */}
      <BottomNav activeTab="profile" />
    </div>
  );
};

export default ProfilePage;
