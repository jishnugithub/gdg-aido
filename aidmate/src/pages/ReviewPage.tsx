import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Star,
  CheckCircle2,
  Heart,
  Send,
  Sparkles,
  ArrowRight,
  Home,
} from 'lucide-react';
import {
  doc,
  getDoc,
  collection,
  setDoc,
  updateDoc,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Button } from '@/components/ui/Button';
import { StarRating } from '@/components/ui/StarRating';
import { Avatar } from '@/components/ui/Avatar';
import type { Job, User as UserType, Review } from '@/types';

export const ReviewPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();

  const [job, setJob] = useState<Job | null>(null);
  const [reviewedUser, setReviewedUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);

  // Ratings state
  const [overallRating, setOverallRating] = useState<number>(5);
  const [cat1Rating, setCat1Rating] = useState<number>(5);
  const [cat2Rating, setCat2Rating] = useState<number>(5);
  const [cat3Rating, setCat3Rating] = useState<number>(5);
  const [feedback, setFeedback] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    if (!jobId) return;

    const fetchDetails = async () => {
      try {
        const jobSnap = await getDoc(doc(db, 'jobs', jobId));
        if (!jobSnap.exists()) {
          navigate('/home');
          return;
        }

        const jobData = { jobId: jobSnap.id, ...jobSnap.data() } as Job;
        setJob(jobData);

        const targetUid =
          jobData.requesterId === user?.uid ? jobData.aidmateId : jobData.requesterId;

        if (targetUid) {
          const uSnap = await getDoc(doc(db, 'users', targetUid));
          if (uSnap.exists()) {
            setReviewedUser(uSnap.data() as UserType);
          }
        }
      } catch (err) {
        console.error('[ReviewPage] Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [jobId, user?.uid, navigate]);

  const isReviewingAidmate = user?.uid === job?.requesterId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobId || !job || !user?.uid || !reviewedUser) return;

    setIsSubmitting(true);
    try {
      const reviewDocRef = doc(collection(db, 'reviews'));
      const reviewData: Review = {
        reviewId: reviewDocRef.id,
        jobId,
        reviewerId: user.uid,
        reviewedUserId: reviewedUser.uid,
        rating: overallRating,
        categoryRatings: isReviewingAidmate
          ? {
              communication: cat1Rating,
              punctuality: cat2Rating,
              qualityOfWork: cat3Rating,
            }
          : {
              communication: cat1Rating,
              clearInstructions: cat2Rating,
              cooperation: cat3Rating,
            },
        comment: feedback.trim(),
        createdAt: new Date(),
      };

      await setDoc(reviewDocRef, {
        ...reviewData,
        createdAt: serverTimestamp(),
      });

      // Update reviewed user stats
      const targetUserRef = doc(db, 'users', reviewedUser.uid);
      const newReviewCount = (reviewedUser.reviewCount || 0) + 1;
      const currentAvg = reviewedUser.ratingAverage || 5.0;
      const updatedAvg = Number(
        (((currentAvg * (newReviewCount - 1)) + overallRating) / newReviewCount).toFixed(1)
      );

      await updateDoc(targetUserRef, {
        reviewCount: increment(1),
        ratingAverage: updatedAvg,
        updatedAt: serverTimestamp(),
      });

      setIsSubmitted(true);
      addToast('success', 'Review Submitted', 'Thank you for building trusted community standards!');
    } catch (err) {
      console.error('[ReviewPage] Submit error:', err);
      addToast('error', 'Error', 'Failed to submit review');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || !job) {
    return (
      <div className="min-h-screen bg-[#FFF8F5] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-full border-4 border-[#FF6B4A] border-t-transparent animate-spin mb-3" />
        <p className="text-sm font-semibold text-[#1A1D3E]">Loading review...</p>
      </div>
    );
  }

  // Submitted Thank You screen
  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-[#FFF8F5] flex flex-col items-center justify-center px-4 py-8 text-[#1A1D3E] animate-scale-in">
        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-xl max-w-md w-full text-center flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#FF6B4A]/10 text-[#FF6B4A] flex items-center justify-center">
            <Heart className="w-8 h-8 fill-[#FF6B4A]" />
          </div>

          <h2 className="text-2xl font-black text-[#1A1D3E]">
            Thank You for Helping Our Community!
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed max-w-xs">
            Your review helps {reviewedUser?.fullName} build credibility and maintains a safe, reliable platform for everyone.
          </p>

          <Button
            type="button"
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => navigate('/home')}
            leftIcon={<Home className="w-4 h-4" />}
            className="mt-4"
          >
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF8F5]/60 pb-16 text-[#1A1D3E]">
      <main className="max-w-md mx-auto px-4 pt-8 flex flex-col gap-5">
        {/* Header */}
        <div className="text-center">
          <span className="text-xs font-black uppercase tracking-wider text-[#FF6B4A]">
            Experience Review
          </span>
          <h1 className="text-2xl font-black text-[#1A1D3E] mt-0.5">
            Rate your experience
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            How was your collaboration on &ldquo;{job.title}&rdquo;?
          </p>
        </div>

        {/* User Card */}
        {reviewedUser && (
          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex items-center gap-3.5">
            <Avatar
              src={reviewedUser.photoURL || undefined}
              name={reviewedUser.fullName}
              size="lg"
            />
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">
                {isReviewingAidmate ? 'Aidmate' : 'Requester'}
              </span>
              <h3 className="font-extrabold text-base text-[#1A1D3E]">
                {reviewedUser.fullName}
              </h3>
              <p className="text-xs text-slate-500">
                Member of Aidmate Community
              </p>
            </div>
          </div>
        )}

        {/* Rating Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xl flex flex-col gap-6">
          {/* Overall Rating */}
          <div className="flex flex-col items-center gap-2 pt-1">
            <span className="text-xs font-bold uppercase tracking-wider text-[#1A1D3E]/80">
              Overall Rating
            </span>
            <StarRating
              rating={overallRating}
              onChange={setOverallRating}
              size="lg"
              interactive
            />
          </div>

          {/* Subcategory Ratings */}
          <div className="flex flex-col gap-3 pt-3 border-t border-slate-100">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Detailed Breakdown
            </span>

            {/* Category 1 */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#1A1D3E]">Communication</span>
              <StarRating
                rating={cat1Rating}
                onChange={setCat1Rating}
                size="sm"
                interactive
              />
            </div>

            {/* Category 2 */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#1A1D3E]">
                {isReviewingAidmate ? 'Punctuality' : 'Clear Instructions'}
              </span>
              <StarRating
                rating={cat2Rating}
                onChange={setCat2Rating}
                size="sm"
                interactive
              />
            </div>

            {/* Category 3 */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#1A1D3E]">
                {isReviewingAidmate ? 'Quality of Work' : 'Cooperation'}
              </span>
              <StarRating
                rating={cat3Rating}
                onChange={setCat3Rating}
                size="sm"
                interactive
              />
            </div>
          </div>

          {/* Written Feedback */}
          <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-100">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#1A1D3E]/80">
              Written Feedback
            </label>
            <textarea
              rows={4}
              placeholder="What went well? Any tips for future tasks with this neighbor?"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 focus:border-[#FF6B4A] focus:ring-4 focus:ring-[#FF6B4A]/20 outline-none text-[#1A1D3E] placeholder:text-slate-400 transition-all resize-none"
            />
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isSubmitting}
            loadingText="Submitting Review..."
            rightIcon={<Send className="w-4 h-4" />}
          >
            Submit Review
          </Button>
        </form>
      </main>
    </div>
  );
};

export default ReviewPage;
