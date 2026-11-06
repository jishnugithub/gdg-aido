import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  IndianRupee,
  Zap,
  Plus,
  X,
  CheckCircle2,
  Navigation,
  Sparkles,
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

export const ActiveRequestPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentLocation, requestPermission, getCurrentLocation } = useLocation();
  const { addToast } = useToast();
  const { reverseGeocode, geocode } = useGeocoding();

  // Wizard Steps: 1, 2, 3
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Step 1: What
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>(JOB_CATEGORIES[0]);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(['Urgent', 'HelpNeeded']);

  // Step 2: Where
  const [taskLocation, setTaskLocation] = useState<GeoPoint>({
    lat: 12.9716,
    lng: 77.5946,
  });
  const [taskAddress, setTaskAddress] = useState('');
  const [addressSearchInput, setAddressSearchInput] = useState('');
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [useRequesterLocation, setUseRequesterLocation] = useState(true);

  // Step 3: Details
  const [offeredAmount, setOfferedAmount] = useState<string>('250');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [aiSuggestionActive, setAiSuggestionActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Initialize taskLocation from user's current GPS location
  useEffect(() => {
    if (currentLocation) {
      setTaskLocation(currentLocation);
      reverseGeocode(currentLocation.lat, currentLocation.lng).then((addr) => {
        setTaskAddress(addr);
      });
    } else {
      // Default initial reverse geocode
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
      setUseRequesterLocation(true);
      addToast('info', 'Location Updated', 'Using your accurate GPS coordinates.');
    } catch {
      await requestPermission();
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
      setUseRequesterLocation(false);
      addToast('success', 'Location Found', addressSearchInput);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Location not found';
      addToast('error', 'Search Error', msg);
    } finally {
      setIsSearchingAddress(false);
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
        console.warn('[ActiveRequestPage] Gemini AI analysis error:', err);
      } finally {
        setIsAnalyzingImage(false);
      }
    } else {
      setAiSuggestionActive(false);
    }
  };

  const validateStep = (step: number): boolean => {
    setFormError(null);
    if (step === 1) {
      if (!title.trim()) {
        setFormError('Please enter a clear task title.');
        return false;
      }
      if (!description.trim()) {
        setFormError('Please provide a brief description of what help you need.');
        return false;
      }
      return true;
    }
    if (step === 2) {
      if (!taskAddress) {
        setFormError('Please specify the task location or allow GPS access.');
        return false;
      }
      return true;
    }
    if (step === 3) {
      const amount = parseFloat(offeredAmount);
      if (isNaN(amount) || amount <= 0) {
        setFormError('Please enter a valid compensation amount in ₹.');
        return false;
      }
      return true;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 3));
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(3)) return;
    if (!user?.uid) {
      addToast('error', 'Authentication required', 'Please sign in to post a request.');
      navigate('/login');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

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

      const parsedAmount = parseFloat(offeredAmount);

      const jobData: Partial<Job> = {
        jobId,
        requesterId: user.uid,
        aidmateId: null,
        mode: 'active',
        title: title.trim(),
        description: description.trim(),
        category,
        tags,
        images: imageUrls,
        offeredAmount: parsedAmount,
        finalAmount: parsedAmount,
        taskLocation,
        taskAddress: taskAddress || 'Nearby area',
        requesterLocation: currentLocation || taskLocation,
        deadline: null,
        status: 'searching',
        paymentStatus: 'not_started',
        paymentMethod: null,
        searchRadius: 5, // Default 5 km radius
        otpAttempts: 0,
        otpExpiresAt: null,
        searchTokens: tokens,
      };

      await setDoc(newJobRef, {
        ...jobData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      addToast('success', 'Searching for Aidmates!', 'Connecting you with nearby helpers right now.');
      navigate(`/matching/${jobId}`);
    } catch (err: unknown) {
      console.error('[ActiveRequestPage] Creation failed:', err);
      const msg = err instanceof Error ? err.message : 'Failed to post request.';
      setFormError(msg);
      addToast('error', 'Error posting request', msg);
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
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3.5">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              if (currentStep > 1) setCurrentStep((prev) => prev - 1);
              else navigate('/home');
            }}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#FF6B4A] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{currentStep === 1 ? 'Cancel' : 'Back'}</span>
          </button>

          <div className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-[#FF6B4A] fill-[#FF6B4A]" />
            <h1 className="text-base font-bold text-[#1A1D3E]">Instant Help Request</h1>
          </div>

          <div className="text-xs font-bold text-slate-400">
            Step <span className="text-[#FF6B4A]">{currentStep}</span>/3
          </div>
        </div>
      </header>

      {/* Step Indicators */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-4">
        <div className="grid grid-cols-3 gap-2">
          {['1. Help Details', '2. Location', '3. Offer & Media'].map((name, idx) => {
            const stepNum = idx + 1;
            const isCurrent = currentStep === stepNum;
            const isDone = currentStep > stepNum;

            return (
              <div key={name} className="flex flex-col gap-1">
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    isDone
                      ? 'bg-[#22C55E]'
                      : isCurrent
                      ? 'bg-[#FF6B4A]'
                      : 'bg-slate-200'
                  }`}
                />
                <span
                  className={`text-[10px] sm:text-xs font-semibold truncate ${
                    isCurrent ? 'text-[#FF6B4A]' : 'text-slate-400'
                  }`}
                >
                  {name}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-5">
        <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-100 shadow-sm">
          {/* STEP 1: WHAT */}
          {currentStep === 1 && (
            <div className="flex flex-col gap-5 animate-fade-in">
              <div>
                <h2 className="text-xl font-black text-[#1A1D3E]">What help do you need?</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Give clear instructions so nearby Aidmates can respond quickly.
                </p>
              </div>

              <Input
                label="Task Title"
                placeholder="e.g., Need help moving a heavy couch up 2 floors"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#1A1D3E]/80">
                  Detailed Description *
                </label>
                <textarea
                  rows={4}
                  placeholder="Describe exactly what needs to be done, specific requirements, tools needed, or safety guidelines..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-[#FF6B4A] focus:ring-4 focus:ring-[#FF6B4A]/20 outline-none text-[#1A1D3E] placeholder:text-slate-400 transition-all resize-none"
                  required
                />
              </div>

              <Select
                label="Category"
                options={categoryOptions}
                value={category}
                onChange={(val) => setCategory(val as string)}
              />

              {/* Tags Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#1A1D3E]/80">
                  Tags & Keywords
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Add a tag (e.g. Heavy, Fast, TwoPeople)"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddTag}
                    leftIcon={<Plus className="w-4 h-4" />}
                  >
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
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-red-600 focus:outline-none"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: WHERE */}
          {currentStep === 2 && (
            <div className="flex flex-col gap-5 animate-fade-in">
              <div>
                <h2 className="text-xl font-black text-[#1A1D3E]">Where is help needed?</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Confirm the pin location so Aidmates know their exact travel route.
                </p>
              </div>

              {/* Location options & Search */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  variant={useRequesterLocation ? 'primary' : 'outline'}
                  size="sm"
                  onClick={handleUseCurrentLocation}
                  leftIcon={<Navigation className="w-4 h-4" />}
                  className="w-full sm:w-auto"
                >
                  Use my current location
                </Button>

                <form onSubmit={handleAddressSearch} className="flex-1 flex gap-2">
                  <Input
                    placeholder="Search address or landmark..."
                    value={addressSearchInput}
                    onChange={(e) => setAddressSearchInput(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="submit"
                    variant="secondary"
                    size="sm"
                    isLoading={isSearchingAddress}
                  >
                    Search
                  </Button>
                </form>
              </div>

              {/* Map View */}
              <MapView
                center={taskLocation}
                height="320px"
                addressLabel={taskAddress}
                draggableMarker
              />

              {/* Selected Address Display */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-2.5 text-xs text-[#1A1D3E]">
                <MapPin className="w-4 h-4 text-[#FF6B4A] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Selected Task Location:</span>
                  <span className="text-slate-600">{taskAddress || 'Coordinates selected'}</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: DETAILS & REVIEW */}
          {currentStep === 3 && (
            <div className="flex flex-col gap-5 animate-fade-in">
              <div>
                <h2 className="text-xl font-black text-[#1A1D3E]">Set Your Offer</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  How much are you offering for this task?
                </p>
              </div>

              {/* Amount Input */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#1A1D3E]/80">
                  Offered Compensation (₹) *
                </label>
                <div className="relative flex items-center max-w-xs">
                  <div className="absolute left-4 pointer-events-none text-[#FF6B4A] font-bold text-lg">
                    ₹
                  </div>
                  <input
                    type="number"
                    min="50"
                    step="10"
                    value={offeredAmount}
                    onChange={(e) => setOfferedAmount(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 text-2xl font-black text-[#1A1D3E] rounded-2xl border border-slate-200 focus:border-[#FF6B4A] focus:ring-4 focus:ring-[#FF6B4A]/20 outline-none"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  Fair offers get accepted significantly faster by top-rated Aidmates.
                </p>
              </div>

              {/* Quick suggestions */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Quick amounts:</span>
                {['150', '250', '500', '1000'].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setOfferedAmount(amt)}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-[#FF6B4A]/10 hover:text-[#FF6B4A] text-slate-600 transition-colors"
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>

              {/* Photo Upload (Optional) */}
              <div className="pt-2 border-t border-slate-100">
                <ImageUpload
                  label="Photos (Optional)"
                  images={imagePreviews}
                  multiple
                  maxFiles={3}
                  onChange={handleImageChange}
                  disabled={isSubmitting}
                />

                {isAnalyzingImage && (
                  <div className="flex items-center gap-2.5 px-3.5 py-2.5 mt-2 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200/80 rounded-xl text-xs text-[#E85A3A] animate-pulse">
                    <Sparkles className="w-4 h-4 text-[#FF6B4A] animate-spin" />
                    <span className="font-medium">Gemini AI is analyzing your photo to suggest title, description & pricing...</span>
                  </div>
                )}

                {aiSuggestionActive && !isAnalyzingImage && (
                  <div className="flex items-center justify-between px-3.5 py-2.5 mt-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <span className="font-medium">✨ AI suggestions applied! Title, description, and pricing updated.</span>
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

              {/* Quick Summary Box */}
              <div className="p-4 bg-[#FFF8F5] rounded-2xl border border-[#FF6B4A]/20 flex flex-col gap-1.5 text-xs text-[#1A1D3E]">
                <div className="font-bold flex items-center justify-between text-sm">
                  <span>{title || 'Untitled Request'}</span>
                  <span className="text-[#FF6B4A] text-base">₹{offeredAmount}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-500">
                  <MapPin className="w-3.5 h-3.5 text-[#FF6B4A]" />
                  <span className="truncate">{taskAddress || 'Nearby area'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Form Error Message */}
          {formError && (
            <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-600">
              {formError}
            </div>
          )}

          {/* Action Navigation Buttons */}
          <div className="mt-7 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
            {currentStep > 1 ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCurrentStep((prev) => prev - 1)}
                disabled={isSubmitting}
              >
                Back
              </Button>
            ) : (
              <div />
            )}

            {currentStep < 3 ? (
              <Button
                type="button"
                variant="primary"
                onClick={handleNext}
                size="md"
              >
                Continue
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                size="lg"
                isLoading={isSubmitting}
                loadingText="Broadcasting to Aidmates..."
                onClick={handleSubmit}
                rightIcon={<CheckCircle2 className="w-4 h-4" />}
              >
                Review & Post Request
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ActiveRequestPage;
