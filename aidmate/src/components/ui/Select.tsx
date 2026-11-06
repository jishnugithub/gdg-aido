import React, { useState, useRef, useEffect, useId, useMemo } from 'react';
import { ChevronDown, Check, X, Search, AlertCircle } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  description?: string;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string | string[];
  defaultValue?: string | string[];
  onChange?: (value: string | string[]) => void;
  multiple?: boolean;
  searchable?: boolean;
  placeholder?: string;
  label?: string;
  error?: string;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
  renderOption?: (option: SelectOption, isSelected: boolean) => React.ReactNode;
  className?: string;
  id?: string;
}

export const Select: React.FC<SelectProps> = ({
  options = [],
  value: controlledValue,
  defaultValue,
  onChange,
  multiple = false,
  searchable = false,
  placeholder = 'Select an option',
  label,
  error,
  helperText,
  disabled = false,
  required = false,
  renderOption,
  className = '',
  id,
}) => {
  const generatedId = useId();
  const selectId = id || generatedId;

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [internalValue, setInternalValue] = useState<string | string[]>(() => {
    if (defaultValue !== undefined) return defaultValue;
    return multiple ? [] : '';
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const currentValue = controlledValue !== undefined ? controlledValue : internalValue;

  // Selected values as array
  const selectedValues: string[] = useMemo(() => {
    if (Array.isArray(currentValue)) return currentValue;
    if (typeof currentValue === 'string' && currentValue) return [currentValue];
    return [];
  }, [currentValue]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen && searchable) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen, searchable]);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ||
        opt.value.toLowerCase().includes(query) ||
        (opt.description && opt.description.toLowerCase().includes(query))
    );
  }, [options, searchQuery]);

  const handleSelectOption = (option: SelectOption) => {
    if (option.disabled || disabled) return;

    if (multiple) {
      const alreadySelected = selectedValues.includes(option.value);
      const nextValues = alreadySelected
        ? selectedValues.filter((v) => v !== option.value)
        : [...selectedValues, option.value];

      if (controlledValue === undefined) {
        setInternalValue(nextValues);
      }
      onChange?.(nextValues);
    } else {
      if (controlledValue === undefined) {
        setInternalValue(option.value);
      }
      onChange?.(option.value);
      setIsOpen(false);
    }
  };

  const handleRemoveChip = (e: React.MouseEvent, valToRemove: string) => {
    e.stopPropagation();
    if (disabled) return;
    const nextValues = selectedValues.filter((v) => v !== valToRemove);
    if (controlledValue === undefined) {
      setInternalValue(nextValues);
    }
    onChange?.(nextValues);
  };

  const selectedOptions = options.filter((opt) => selectedValues.includes(opt.value));
  const hasError = Boolean(error);

  return (
    <div className={`w-full flex flex-col gap-1.5 ${className}`} ref={containerRef}>
      {label && (
        <label
          htmlFor={selectId}
          className="text-xs font-semibold uppercase tracking-wider text-[#1A1D3E]/80 flex items-center justify-between"
        >
          <span>
            {label}
            {required && <span className="text-[#EF4444] ml-0.5">*</span>}
          </span>
        </label>
      )}

      {/* Main Select Button */}
      <div
        id={selectId}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
            e.preventDefault();
            setIsOpen(true);
          } else if (e.key === 'Escape') {
            setIsOpen(false);
          }
        }}
        className={`
          relative min-h-[46px] w-full px-3.5 py-2.5 rounded-2xl border bg-white
          flex items-center justify-between gap-2 cursor-pointer transition-all duration-200 select-none
          ${
            hasError
              ? 'border-[#EF4444] ring-4 ring-[#EF4444]/15'
              : isOpen
              ? 'border-[#FF6B4A] ring-4 ring-[#FF6B4A]/20'
              : 'border-slate-200 hover:border-slate-300'
          }
          ${disabled ? 'opacity-60 bg-slate-50 cursor-not-allowed' : ''}
        `}
      >
        {/* Selected content display */}
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          {selectedValues.length === 0 ? (
            <span className="text-sm text-slate-400 font-normal">{placeholder}</span>
          ) : multiple ? (
            selectedOptions.map((opt) => (
              <span
                key={opt.value}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-[#FF6B4A]/10 text-[#FF6B4A] border border-[#FF6B4A]/20"
              >
                {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                <span>{opt.label}</span>
                <span
                  role="button"
                  aria-label={`Remove ${opt.label}`}
                  onClick={(e) => handleRemoveChip(e, opt.value)}
                  className="hover:bg-[#FF6B4A]/20 rounded p-0.5 text-current cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </span>
              </span>
            ))
          ) : (
            <div className="flex items-center gap-2 text-sm font-medium text-[#1A1D3E] truncate">
              {selectedOptions[0]?.icon}
              <span className="truncate">{selectedOptions[0]?.label}</span>
            </div>
          )}
        </div>

        {/* Chevron Icon */}
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-[#FF6B4A]' : ''
          }`}
        />
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="relative z-50">
          <div
            role="listbox"
            className="absolute top-1 left-0 right-0 max-h-64 overflow-y-auto custom-scrollbar bg-white rounded-2xl shadow-xl border border-slate-100 p-1.5 animate-slide-up"
          >
            {/* Search Input */}
            {searchable && (
              <div className="p-1 pb-2 border-b border-slate-100 mb-1 sticky top-0 bg-white z-10">
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search options..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#FF6B4A] focus:bg-white text-[#1A1D3E]"
                  />
                </div>
              </div>
            )}

            {/* Options list */}
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">No options found</div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = selectedValues.includes(option.value);

                return (
                  <div
                    key={option.value}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelectOption(option)}
                    className={`
                      w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm font-medium cursor-pointer transition-colors
                      ${
                        option.disabled
                          ? 'opacity-40 cursor-not-allowed text-slate-400'
                          : isSelected
                          ? 'bg-[#FF6B4A]/10 text-[#FF6B4A] font-semibold'
                          : 'text-[#1A1D3E] hover:bg-slate-50'
                      }
                    `}
                  >
                    {renderOption ? (
                      renderOption(option, isSelected)
                    ) : (
                      <div className="flex items-center gap-2 truncate">
                        {option.icon && <span className="shrink-0">{option.icon}</span>}
                        <div className="flex flex-col truncate">
                          <span className="truncate">{option.label}</span>
                          {option.description && (
                            <span className="text-[11px] text-slate-400 truncate">
                              {option.description}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {isSelected && <Check className="w-4 h-4 text-[#FF6B4A] shrink-0 ml-2" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-1.5 text-xs text-[#EF4444] font-medium mt-0.5 animate-slide-down">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!error && helperText && (
        <p className="text-xs text-slate-500 font-normal mt-0.5">{helperText}</p>
      )}
    </div>
  );
};

export default Select;
