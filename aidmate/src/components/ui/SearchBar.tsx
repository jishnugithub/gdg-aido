import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X } from 'lucide-react';

export interface SearchFilterChip {
  id: string;
  label: string;
  count?: number;
}

export interface SearchBarProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onSearch?: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  filters?: SearchFilterChip[];
  activeFilter?: string;
  onFilterChange?: (filterId: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value: controlledValue,
  defaultValue = '',
  onChange,
  onSearch,
  placeholder = 'Search for help, tasks, volunteers...',
  debounceMs = 300,
  filters = [],
  activeFilter,
  onFilterChange,
  disabled = false,
  autoFocus = false,
  className = '',
}) => {
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentValue = isControlled ? controlledValue : internalValue;

  // Sync internal state if controlled value changes
  useEffect(() => {
    if (isControlled) {
      setInternalValue(controlledValue);
    }
  }, [isControlled, controlledValue]);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const triggerDebouncedChange = useCallback(
    (newVal: string) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        onChange?.(newVal);
      }, debounceMs);
    },
    [debounceMs, onChange]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    if (!isControlled) {
      setInternalValue(newVal);
    }
    triggerDebouncedChange(newVal);
  };

  const handleClear = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (!isControlled) {
      setInternalValue('');
    }
    onChange?.('');
    onSearch?.('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      onSearch?.(currentValue);
    } else if (e.key === 'Escape') {
      handleClear();
    }
  };

  return (
    <div className={`w-full flex flex-col gap-2.5 ${className}`}>
      {/* Search Input Container */}
      <div
        className={`
          relative flex items-center w-full bg-white rounded-2xl
          border transition-all duration-200
          ${
            isFocused
              ? 'border-[#FF6B4A] ring-4 ring-[#FF6B4A]/15 shadow-sm'
              : 'border-slate-200/90 hover:border-slate-300 shadow-[0_2px_8px_-2px_rgba(26,29,62,0.05)]'
          }
          ${disabled ? 'opacity-60 pointer-events-none bg-slate-50' : ''}
        `}
      >
        <div className="pl-4 pr-2 text-slate-400 flex items-center justify-center">
          <Search
            className={`w-4 h-4 transition-colors duration-200 ${
              isFocused ? 'text-[#FF6B4A]' : 'text-slate-400'
            }`}
          />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={currentValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-label={placeholder}
          className="w-full py-3 pr-10 text-sm bg-transparent border-none outline-none text-[#1A1D3E] placeholder:text-slate-400 font-sans"
        />

        {currentValue && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search query"
            className="absolute right-3 p-1.5 rounded-full text-slate-400 hover:text-[#1A1D3E] hover:bg-slate-100 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Filter Chips Area */}
      {filters.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 px-0.5">
          {filters.map((filter) => {
            const isActive = activeFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => onFilterChange?.(filter.id)}
                className={`
                  inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold
                  transition-all duration-150 shrink-0 select-none
                  ${
                    isActive
                      ? 'bg-[#FF6B4A] text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }
                `}
              >
                <span>{filter.label}</span>
                {filter.count !== undefined && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {filter.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
