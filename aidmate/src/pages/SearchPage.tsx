import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  ArrowLeft,
  X,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  MapPin,
  IndianRupee,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useLocation } from '@/contexts/LocationContext';
import { useJobSearch, type SearchFilters } from '@/hooks/useJobSearch';
import { TaskCard } from '@/components/TaskCard';
import { BottomNav } from '@/components/BottomNav';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { JOB_CATEGORIES } from '@/types';

export const SearchPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentLocation } = useLocation();
  const { results, loading, error, search, clearSearch } = useJobSearch();

  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  // Filters state
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [maxDistance, setMaxDistance] = useState<number>(15); // km
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [sortBy, setSortBy] = useState<'newest' | 'distance' | 'amount_high' | 'amount_low'>('newest');

  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus search input on mount
  useEffect(() => {
    inputRef.current?.focus();
    // Initial fetch of all available tasks
    search('', {
      category: 'All',
      userLocation: currentLocation || undefined,
    });
  }, [search, currentLocation]);

  // Execute search when query or filters change
  const triggerSearch = (queryStr = searchQuery, cat = selectedCategory) => {
    const filters: SearchFilters = {
      category: cat,
      maxDistance,
      minAmount: minAmount ? parseFloat(minAmount) : undefined,
      maxAmount: maxAmount ? parseFloat(maxAmount) : undefined,
      sortBy,
      userLocation: currentLocation || undefined,
    };
    search(queryStr, filters);
  };

  const handleCategoryClick = (cat: string) => {
    const nextCat = selectedCategory === cat ? 'All' : cat;
    setSelectedCategory(nextCat);
    triggerSearch(searchQuery, nextCat);
  };

  const handleApplyFilters = () => {
    triggerSearch();
    setIsFilterPanelOpen(false);
  };

  const handleResetFilters = () => {
    setSelectedCategory('All');
    setMaxDistance(15);
    setMinAmount('');
    setMaxAmount('');
    setSortBy('newest');
    search(searchQuery, { category: 'All', userLocation: currentLocation || undefined });
    setIsFilterPanelOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#FFF8F5]/60 pb-24 sm:pb-12 text-[#1A1D3E]">
      {/* Sticky Search Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3.5 shadow-xs">
        <div className="max-w-4xl mx-auto flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/home')}
              className="p-2 rounded-xl text-slate-500 hover:text-[#1A1D3E] hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            {/* Big Search Input */}
            <div className="relative flex-1 flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  triggerSearch(e.target.value);
                }}
                placeholder="Search tasks, skills, or help requests..."
                className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-slate-100/80 hover:bg-slate-100 focus:bg-white border border-transparent focus:border-[#FF6B4A] focus:ring-4 focus:ring-[#FF6B4A]/20 text-sm font-medium text-[#1A1D3E] outline-none transition-all placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    triggerSearch('');
                  }}
                  className="absolute right-3 text-slate-400 hover:text-[#1A1D3E]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter Panel Toggle Button */}
            <button
              type="button"
              onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
              className={`p-2.5 rounded-2xl border transition-all flex items-center justify-center shrink-0 ${
                isFilterPanelOpen || selectedCategory !== 'All' || minAmount || maxAmount
                  ? 'bg-[#FF6B4A] text-white border-[#FF6B4A] shadow-md shadow-[#FF6B4A]/25'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>

          {/* Category Quick Chips (Horizontal Scroll) */}
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
            <button
              type="button"
              onClick={() => handleCategoryClick('All')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors shrink-0 ${
                selectedCategory === 'All'
                  ? 'bg-[#1A1D3E] text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
              }`}
            >
              All Categories
            </button>
            {JOB_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => handleCategoryClick(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-[#FF6B4A] text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Expandable Filter Panel */}
        {isFilterPanelOpen && (
          <div className="max-w-4xl mx-auto pt-4 border-t border-slate-100 mt-3 animate-slide-down">
            <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#1A1D3E]">
                  Filters & Sorting
                </span>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-xs font-semibold text-[#FF6B4A] hover:underline"
                >
                  Reset all
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Max Distance Slider */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs font-medium text-slate-600">
                    <span>Max Distance</span>
                    <span className="font-bold text-[#FF6B4A]">{maxDistance} km</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    value={maxDistance}
                    onChange={(e) => setMaxDistance(Number(e.target.value))}
                    className="accent-[#FF6B4A] cursor-pointer"
                  />
                </div>

                {/* Amount Range */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-slate-600">Compensation (₹)</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="Min ₹"
                      value={minAmount}
                      onChange={(e) => setMinAmount(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl outline-none"
                    />
                    <span className="text-slate-400 text-xs">-</span>
                    <input
                      type="number"
                      placeholder="Max ₹"
                      value={maxAmount}
                      onChange={(e) => setMaxAmount(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl outline-none"
                    />
                  </div>
                </div>

                {/* Sort Option */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-slate-600">Sort by</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl outline-none text-[#1A1D3E]"
                  >
                    <option value="newest">Newest First</option>
                    <option value="distance">Nearest to Me</option>
                    <option value="amount_high">Highest Compensation</option>
                    <option value="amount_low">Lowest Compensation</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button size="sm" variant="primary" onClick={handleApplyFilters}>
                  Apply Filters
                </Button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Results Grid */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold text-slate-500">
            {loading ? 'Searching...' : `${results.length} task${results.length === 1 ? '' : 's'} available`}
          </span>
        </div>

        {/* Loading Skeletons */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-44 bg-white rounded-2xl border border-slate-200 p-4 animate-pulse flex flex-col justify-between">
                <div className="flex justify-between items-center">
                  <div className="w-16 h-5 bg-slate-200 rounded-full" />
                  <div className="w-12 h-5 bg-slate-200 rounded-full" />
                </div>
                <div className="space-y-2">
                  <div className="w-3/4 h-4 bg-slate-200 rounded" />
                  <div className="w-full h-3 bg-slate-200 rounded" />
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                  <div className="w-20 h-3 bg-slate-200 rounded" />
                  <div className="w-10 h-5 bg-slate-200 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : results.length === 0 ? (
          /* Empty State */
          <EmptyState
            title="No matching tasks found"
            description="Try adjusting your search keywords, increasing your distance radius, or clearing filters."
            actionLabel="Reset Search"
            onAction={handleResetFilters}
            className="my-12 bg-white rounded-3xl p-8 border border-slate-100 shadow-sm"
          />
        ) : (
          /* Results 1-col mobile, 2-col tablet, 3-col desktop */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
            {results.map((job) => (
              <TaskCard key={job.jobId} job={job} />
            ))}
          </div>
        )}
      </main>

      {/* Bottom Navigation on mobile */}
      <BottomNav activeTab="search" />
    </div>
  );
};

export default SearchPage;
