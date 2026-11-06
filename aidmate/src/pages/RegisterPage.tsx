import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, User as UserIcon } from 'lucide-react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { uploadProfileImage } from '@/lib/storage';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ImageUpload } from '@/components/ui/ImageUpload';
import type { AidmateProfile } from '@/types';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateProfile, refreshUserProfile } = useAuth();
  const { addToast } = useToast();

  const [fullName, setFullName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageChange = (files: File[], previews: string[]) => {
    if (files.length > 0) {
      setSelectedFile(files[0]);
      setPreviewUrls(previews);
    } else {
      setSelectedFile(null);
      setPreviewUrls([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = fullName.trim();
    if (!trimmedName) {
      setError('Please provide your full name.');
      return;
    }

    if (!user) {
      setError('User session not found. Please log in first.');
      navigate('/login');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let photoURL: string | null = null;
      if (selectedFile) {
        photoURL = await uploadProfileImage(user.uid, selectedFile);
      }

      // 1. Update user profile in Firestore
      await updateProfile({
        fullName: trimmedName,
        photoURL,
        phoneNumber: user.phoneNumber || '',
      });

      // 2. Initialize default AidmateProfile in Firestore
      const aidmateDocRef = doc(db, 'aidmateProfiles', user.uid);
      const initialAidmateProfile: Partial<AidmateProfile> = {
        uid: user.uid,
        isAvailable: false,
        isBusy: false,
        serviceCategories: ['Moving & Lifting', 'Delivery & Pickup', 'Shopping & Errands'],
        averageRating: 5.0,
        completedJobs: 0,
      };

      await setDoc(aidmateDocRef, {
        ...initialAidmateProfile,
        availabilityUpdatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      await refreshUserProfile();
      addToast('success', 'Profile Created!', `Welcome to Aidmate, ${trimmedName}!`);
      navigate('/home');
    } catch (err: unknown) {
      console.error('[RegisterPage] Registration failed:', err);
      const msg = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setError(msg);
      addToast('error', 'Registration Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FFF8F5] via-[#FFFDFC] to-white flex flex-col justify-between px-4 sm:px-6 py-8">
      {/* Header */}
      <header className="w-full max-w-md mx-auto text-center pt-4 sm:pt-6">
        <div className="inline-flex items-center gap-2 bg-[#FF6B4A]/10 text-[#FF6B4A] px-3.5 py-1.5 rounded-full text-xs font-bold mb-3 shadow-xs">
          <Sparkles className="w-4 h-4" />
          <span>Almost There!</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1A1D3E]">
          Complete Your Profile
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xs mx-auto">
          Help neighbors and fellow Aidmates recognize and trust you.
        </p>
      </header>

      {/* Form Card */}
      <main className="w-full max-w-md mx-auto my-auto py-6">
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-[0_8px_30px_rgb(26,29,62,0.06)] border border-slate-100">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {/* Profile Avatar Upload */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#1A1D3E]/80">
                Profile Photo (Optional)
              </span>
              <ImageUpload
                images={previewUrls}
                multiple={false}
                maxFiles={1}
                maxSizeMB={5}
                onChange={handleImageChange}
                disabled={isSubmitting}
                className="max-w-[220px]"
              />
            </div>

            {/* Full Name Input */}
            <Input
              label="Full Name"
              placeholder="e.g. Rahul Sharma"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (error) setError(null);
              }}
              leftIcon={<UserIcon className="w-4 h-4 text-slate-400" />}
              error={error || undefined}
              required
              disabled={isSubmitting}
              autoFocus
            />

            {/* Information note */}
            <div className="p-3.5 rounded-2xl bg-[#F8F9FE] border border-slate-100 text-xs text-slate-500 flex items-start gap-2.5">
              <div className="w-2 h-2 rounded-full bg-[#FF6B4A] shrink-0 mt-1" />
              <p>
                Your phone number <strong className="text-[#1A1D3E]">{user?.phoneNumber}</strong> is verified and will remain protected.
              </p>
            </div>

            {/* Get Started Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              isLoading={isSubmitting}
              loadingText="Setting up your account..."
              disabled={!fullName.trim() || isSubmitting}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Get Started
            </Button>
          </form>
        </div>
      </main>

      <footer className="w-full max-w-md mx-auto text-center text-xs text-slate-400 py-2">
        You can update your profile details and service preferences anytime.
      </footer>
    </div>
  );
};

export default RegisterPage;
