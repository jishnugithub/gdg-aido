import React, { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, AlertCircle, Check } from 'lucide-react';

export interface CountryInfo {
  code: string;
  dialCode: string;
  name: string;
  flag: string;
  digitsLength: number;
}

export const COUNTRIES: CountryInfo[] = [
  { code: 'IN', dialCode: '+91', name: 'India', flag: '🇮🇳', digitsLength: 10 },
  { code: 'US', dialCode: '+1', name: 'United States', flag: '🇺🇸', digitsLength: 10 },
  { code: 'GB', dialCode: '+44', name: 'United Kingdom', flag: '🇬🇧', digitsLength: 10 },
  { code: 'CA', dialCode: '+1', name: 'Canada', flag: '🇨🇦', digitsLength: 10 },
  { code: 'AU', dialCode: '+61', name: 'Australia', flag: '🇦🇺', digitsLength: 9 },
  { code: 'SG', dialCode: '+65', name: 'Singapore', flag: '🇸🇬', digitsLength: 8 },
  { code: 'AE', dialCode: '+971', name: 'United Arab Emirates', flag: '🇦🇪', digitsLength: 9 },
  { code: 'DE', dialCode: '+49', name: 'Germany', flag: '🇩🇪', digitsLength: 10 },
];

export interface PhoneInputProps {
  label?: string;
  value?: string;
  defaultCountry?: string; // code, e.g. 'IN'
  onChange?: (number: string, fullNumber: string, isValid: boolean) => void;
  error?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
  label = 'Phone Number',
  value: controlledValue,
  defaultCountry = 'IN',
  onChange,
  error,
  helperText,
  required = false,
  disabled = false,
  className = '',
  id,
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;

  const [selectedCountry, setSelectedCountry] = useState<CountryInfo>(() => {
    return COUNTRIES.find((c) => c.code === defaultCountry) || COUNTRIES[0];
  });

  const [isOpen, setIsOpen] = useState(false);
  const [internalValue, setInternalValue] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const rawNumber = controlledValue !== undefined ? controlledValue : internalValue;

  // Format phone number for display
  const formatPhoneNumber = (digits: string, country: CountryInfo): string => {
    const cleaned = digits.replace(/\D/g, '').slice(0, country.digitsLength);
    if (country.code === 'IN') {
      if (cleaned.length <= 5) return cleaned;
      return `${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
    }
    if (country.code === 'US' || country.code === 'CA') {
      if (cleaned.length <= 3) return cleaned;
      if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return cleaned;
  };

  const validate = (digits: string, country: CountryInfo): boolean => {
    const cleaned = digits.replace(/\D/g, '');
    if (country.code === 'IN') {
      return cleaned.length === 10 && /^[6-9]\d{9}$/.test(cleaned);
    }
    return cleaned.length === country.digitsLength;
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, selectedCountry.digitsLength);
    if (controlledValue === undefined) {
      setInternalValue(raw);
    }
    const fullNumber = `${selectedCountry.dialCode}${raw}`;
    const isValid = validate(raw, selectedCountry);
    onChange?.(raw, fullNumber, isValid);
  };

  const handleSelectCountry = (country: CountryInfo) => {
    setSelectedCountry(country);
    setIsOpen(false);
    const cleaned = rawNumber.replace(/\D/g, '').slice(0, country.digitsLength);
    const fullNumber = `${country.dialCode}${cleaned}`;
    const isValid = validate(cleaned, country);
    onChange?.(cleaned, fullNumber, isValid);
  };

  const displayFormatted = formatPhoneNumber(rawNumber, selectedCountry);
  const hasError = Boolean(error);

  return (
    <div className={`w-full flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-semibold uppercase tracking-wider text-[#1A1D3E]/80 flex items-center justify-between"
        >
          <span>
            {label}
            {required && <span className="text-[#EF4444] ml-0.5">*</span>}
          </span>
        </label>
      )}

      <div
        className={`
          relative flex items-center w-full rounded-2xl border bg-white transition-all duration-200
          ${
            hasError
              ? 'border-[#EF4444] ring-4 ring-[#EF4444]/15'
              : 'border-slate-200 focus-within:border-[#FF6B4A] focus-within:ring-4 focus-within:ring-[#FF6B4A]/20 hover:border-slate-300'
          }
          ${disabled ? 'opacity-60 bg-slate-50 cursor-not-allowed' : ''}
        `}
      >
        {/* Country Code Picker Button */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            disabled={disabled}
            className="flex items-center gap-1.5 px-3.5 py-3 text-sm font-semibold text-[#1A1D3E] hover:bg-slate-50 rounded-l-2xl border-r border-slate-200 transition-colors focus:outline-none"
          >
            <span className="text-base select-none">{selectedCountry.flag}</span>
            <span>{selectedCountry.dialCode}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Country Selection Dropdown */}
          {isOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-60 max-h-64 overflow-y-auto custom-scrollbar bg-white rounded-2xl shadow-xl border border-slate-100 z-50 py-1.5 animate-slide-up">
              {COUNTRIES.map((country) => {
                const isSelected = country.code === selectedCountry.code;
                return (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => handleSelectCountry(country)}
                    className={`
                      w-full flex items-center justify-between px-3.5 py-2 text-xs font-medium
                      transition-colors text-left
                      ${
                        isSelected
                          ? 'bg-[#FF6B4A]/10 text-[#FF6B4A] font-bold'
                          : 'text-[#1A1D3E] hover:bg-slate-50'
                      }
                    `}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-base">{country.flag}</span>
                      <span>{country.name}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="text-slate-400 font-mono">{country.dialCode}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#FF6B4A]" />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Phone number input */}
        <input
          id={inputId}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          value={displayFormatted}
          onChange={handleInputChange}
          disabled={disabled}
          placeholder={selectedCountry.code === 'IN' ? '98765 43210' : 'Phone number'}
          className="w-full px-3.5 py-3 text-sm bg-transparent border-none outline-none text-[#1A1D3E] placeholder:text-slate-400 font-sans tracking-wide"
        />
      </div>

      {/* Error / Helper text */}
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

export default PhoneInput;
