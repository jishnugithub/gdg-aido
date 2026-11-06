import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Clock,
  IndianRupee,
  MapPin,
  Sparkles,
  Plus,
  X,
  CheckCircle2,
  Image as ImageIcon,
  Navigation,
} from 'lucide-react';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/contexts/LocationContext';
import { useToast } from '@/contexts/ToastContext';
import { useGeocoding } from '@/hooks/useGeocoding';
import { uploadJobImage } from '@/lib/storage';
import { analyzeTaskImageWithAI } from '@/lib/gemini';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select, type SelectOption } from '@/components/ui/Select';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { MapView } from '@/components/MapView';
import { JOB_CATEGORIES, type GeoPoint, type Job } from '@/types';

type QuickDeadline = 'asap' | 'today_noon' | 'today_evening' | 'tomorrow' | 'weekend' | 'custom';

export const PassiveRequestPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentLocation, getCurrentLocation } = useLocation();
  const { addToast } = useToast();
  const { reverseGeocode, geocode } = useGeocoding();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>(JOB_CATEGORIES[0]);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(['Flexible', 'Task']);

  // Deadline selection
  const [selectedQuickDeadline, setSelectedQuickDeadline] = useState<QuickDeadline>('tomorrow');
  const [customDeadline, setCustomDeadline] = useState<string>('');

  // Compensation
  const [offeredAmount, setOfferedAmount] = useState<string>('350');

  // Location
  const [taskLocation, setTaskLocation] = useState<GeoPoint>({
    lat: 12.9716,
    lng: 77.5946,
  });
  const [taskAddress, setTaskAddress] = useState('');
  const [addressSearchInput, setAddressSearchInput] = useState('');
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);

  // Photos
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [aiSuggestionActive, setAiSuggestionActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initial location setup
  useEffect(() => {
    if (currentLocation) {
      setTaskLocation(currentLocation);
      reverseGeocode(currentLocation.lat, currentLocation.lng).then((addr) => {
        setTaskAddress(addr);
      });
    } else {
      reverseGeocode(12.9716, 77.5946).then((addr) => {
        setTaskAddress(addr);
      });
    }
  }, [currentLocation, reverseGeocode]);

  const handleUseCurrentLocation = async () => {
    try {
      const loc = await getCurrentLocation();
      setTaskLocation(loc);
      const addr = await reverseGeocode(loc.lat, loc.lng);
      setTaskAddress(addr);
      addToast('info', 'Location Updated', 'Using your GPS location');
    } catch {
      addToast('error', 'Location Error', 'Could not detect location');
    }
  };

  const handleAddressSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addressSearchInput.trim()) return;

    setIsSearchingAddress(true);
    try {
      const geo = await geocode(addressSearchInput);
      setTaskLocation(geo);
      setTaskAddress(addressSearchInput);
      addToast('success', 'Location Found', addressSearchInput);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Address not found';
      addToast('error', 'Search Error', msg);
    } finally {
      setIsSearchingAddress(false);
    }
  };

  const calculateTargetDate = (quick: QuickDeadline): Date => {
    const now = new Date();
    switch (quick) {
      case 'asap':
        return new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours
      case 'today_noon': {
        const noon = new Date();
        noon.setHours(12, 0, 0, 0);
        if (noon <= now) noon.setDate(noon.getDate() + 1);
        return noon;
      }
      case 'today_evening': {
        const eve = new Date();
        eve.setHours(18, 0, 0, 0);
        if (eve <= now) eve.setDate(eve.getDate() + 1);
        return eve;
      }
      case 'tomorrow': {
        const tom = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        tom.setHours(17, 0, 0, 0);
        return tom;
      }
      case 'weekend': {
        const sat = new Date();
        const day = sat.getDay();
        const diff = (6 - day + 7) % 7 || 7;
        sat.setDate(sat.getDate() + diff);
        sat.setHours(12, 0, 0, 0);
        return sat;
      }
      case 'custom':
        return customDeadline ? new Date(customDeadline) : new Date(now.getTime() + 48 * 60 * 60 * 1000);
    }
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim().replace(/^#/, '');
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleImageChange = async (files: File[], previews: string[]) => {
    setSelectedFiles(files);
    setImagePreviews(previews);

    if (files.length > 0) {
      setIsAnalyzingImage(true);
      try {
        const suggestion = await analyzeTaskImageWithAI(files[0]);
        if (suggestion) {
          setTitle(suggestion.title);
          setDescription(suggestion.description);
          setCategory(suggestion.suggestedCategory);
          setTags(suggestion.tags);
          if (suggestion.suggestedAmount) {
            setOfferedAmount(String(suggestion.suggestedAmount));
          }
          setAiSuggestionActive(true);
          addToast('success', '✨ AI Analysis Complete', `Auto-suggested: "${suggestion.title}"`);
        }
      } catch (err) {
        console.warn('[PassiveRequestPage] Gemini AI analysis error:', err);
      } finally {
        setIsAnalyzingImage(false);
      }
    } else {
      setAiSuggestionActive(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a title for this task.');
      return;
    }
    if (!description.trim()) {
      setError('Please provide a description.');
      return;
    }

    const amountNum = parseFloat(offeredAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount.');
      return;
    }

    if (!user?.uid) {
      navigate('/login');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const newJobRef = doc(collection(db, 'jobs'));
      const jobId = newJobRef.id;

      // Upload images if any
      const imageUrls: string[] = [];
      for (const file of selectedFiles) {
        const url = await uploadJobImage(jobId, file);
        imageUrls.push(url);
      }

      // Generate searchTokens
      const rawText = `${title} ${description} ${category} ${tags.join(' ')}`;
      const tokens = Array.from(
        new Set(
          rawText
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter((w) => w.length >= 2)
        )
      );

      const deadlineDate = calculateTargetDate(selectedQuickDeadline);

      const jobData: Partial<Job> = {
        jobId,
        requesterId: user.uid,
        aidmateId: null,
        mode: 'passive',
        title: title.trim(),
        description: description.trim(),
        category,
        tags,
        images: imageUrls,
        offeredAmount: amountNum,
        finalAmount: amountNum,
        taskLocation,
        taskAddress: taskAddress || 'Community Area',
        requesterLocation: currentLocation || taskLocation,
        deadline: deadlineDate,
        status: 'posted',
        paymentStatus: 'not_started',
        paymentMethod: null,
        searchRadius: 10,
        otpAttempts: 0,
        otpExpiresAt: null,
        searchTokens: tokens,
      };

      await setDoc(newJobRef, {
        ...jobData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      addToast('success', 'Task Posted!', 'Aidmates can now view and apply for your task.');
      navigate(`/task/${jobId}`);
    } catch (err: unknown) {
      console.error('[PassiveRequestPage] Post failed:', err);
      const msg = err instanceof Error ? err.message : 'Failed to post task.';
      setError(msg);
      addToast('error', 'Error posting task', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const categoryOptions: SelectOption[] = JOB_CATEGORIES.map((cat) => ({
    value: cat,
    label: cat,
  }));

  return (
    <div className="min-h-screen bg-[#FFF8F5]/60 pb-16 text-[#1A1D3E]">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3.5">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/home')}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#FF6B4A] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Cancel</span>
          </button>
          <h1 className="text-base font-bold text-[#1A1D3E]">Schedule a Task</h1>
          <div className="w-12" />
        </div>
      </header>

      {/* Main Form */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-5">
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-100 shadow-sm flex flex-col gap-6">
          {/* Header Description */}
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-600 mb-2">
              <Calendar className="w-3.5 h-3.5" />
              <span>Passive Task Posting</span>
            </div>
            <h2 className="text-xl font-black text-[#1A1D3E]">Post a Task for Later</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Receive applications and choose the best suited Aidmate for the job.
            </p>
          </div>

          {/* Photo Upload with AI analysis hint */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#1A1D3E]/80">
                Task Photos (AI Assisted)
              </span>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-[#FF6B4A]">
                <Sparkles className="w-3 h-3" />
                <span>AI Auto-fills info</span>
              </span>
            </div>
            <ImageUpload
              images={imagePreviews}
              multiple
              maxFiles={4}
              onChange={handleImageChange}
              disabled={isSubmitting}
            />

            {isAnalyzingImage && (
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200/80 rounded-xl text-xs text-[#E85A3A] animate-pulse">
                <Sparkles className="w-4 h-4 text-[#FF6B4A] animate-spin" />
                <span className="font-medium">Gemini AI is analyzing your photo to auto-suggest title, description & category...</span>
              </div>
            )}

            {aiSuggestionActive && !isAnalyzingImage && (
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span className="font-medium">✨ AI suggestions applied! Review and customize any details below.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAiSuggestionActive(false)}
                  className="text-emerald-700 hover:underline font-semibold text-[11px] ml-2"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>

          {/* Task Title */}
          <Input
            label="Task Title"
            placeholder="e.g. Assemble IKEA 4-drawer dresser"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            disabled={isSubmitting}
          />

          {/* Task Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#1A1D3E]/80">
              Description *
            </label>
            <textarea
              rows={4}
              placeholder="Describe the task in detail, instructions, tools required..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-[#FF6B4A] focus:ring-4 focus:ring-[#FF6B4A]/20 outline-none text-[#1A1D3E] placeholder:text-slate-400 transition-all resize-none"
              required
              disabled={isSubmitting}
            />
          </div>

          {/* Category */}
          <Select
            label="Category"
            options={categoryOptions}
            value={category}
            onChange={(val) => setCategory(val as string)}
          />

          {/* Tags */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#1A1D3E]/80">
              Tags
            </label>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Add tag (e.g. ToolsNeeded, Weekend)"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={handleAddTag}>
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 text-xs font-semibold bg-[#FF6B4A]/10 text-[#FF6B4A] px-2.5 py-1 rounded-lg border border-[#FF6B4A]/20"
                >
                  <span>#{tag}</span>
                  <button type="button" onClick={() => handleRemoveTag(tag)}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Deadline Picker */}
          <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#1A1D3E]/80 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#FF6B4A]" />
              <span>When does this need to be done?</span>
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'asap', label: 'ASAP (~2h)' },
                { id: 'today_noon', label: 'Today Noon' },
                { id: 'today_evening', label: 'Today Evening' },
                { id: 'tomorrow', label: 'Tomorrow' },
                { id: 'weekend', label: 'This Weekend' },
                { id: 'custom', label: 'Custom Date' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedQuickDeadline(opt.id as QuickDeadline)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors ${
                    selectedQuickDeadline === opt.id
                      ? 'bg-[#FF6B4A] text-white border-[#FF6B4A] shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {selectedQuickDeadline === 'custom' && (
              <div className="mt-2">
                <Input
                  type="datetime-local"
                  label="Select Date & Time"
                  value={customDeadline}
                  onChange={(e) => setCustomDeadline(e.target.value)}
                  required
                />
              </div>
            )}
          </div>

          {/* Amount Input */}
          <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#1A1D3E]/80">
              Compensation Budget (₹) *
            </label>
            <div className="relative flex items-center max-w-xs">
              <div className="absolute left-4 pointer-events-none text-[#FF6B4A] font-bold text-lg">
                ₹
              </div>
              <input
                type="number"
                min="50"
                step="25"
                value={offeredAmount}
                onChange={(e) => setOfferedAmount(e.target.value)}
                className="w-full pl-10 pr-4 py-3 text-2xl font-black text-[#1A1D3E] rounded-2xl border border-slate-200 focus:border-[#FF6B4A] focus:ring-4 focus:ring-[#FF6B4A]/20 outline-none"
                required
              />
            </div>
          </div>

          {/* Location Section */}
          <div className="flex flex-col gap-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#1A1D3E]/80">
                Task Location
              </label>
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                className="text-xs font-bold text-[#FF6B4A] hover:underline flex items-center gap-1"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Use Current Location</span>
              </button>
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="Search location or area..."
                value={addressSearchInput}
                onChange={(e) => setAddressSearchInput(e.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAddressSearch}
                isLoading={isSearchingAddress}
              >
                Search
              </Button>
            </div>

            <MapView
              center={taskLocation}
              height="240px"
              addressLabel={taskAddress}
              draggableMarker
            />
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-xs font-bold text-red-600 rounded-xl">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isSubmitting}
            loadingText="Posting task..."
            rightIcon={<CheckCircle2 className="w-4 h-4" />}
          >
            Post Task for Applicants
          </Button>
        </form>
      </main>
    </div>
  );
};

export default PassiveRequestPage;
