import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

export interface OTPInputProps {
  length?: number;
  value?: string;
  onChange?: (code: string) => void;
  onComplete?: (code: string) => void;
  error?: string;
  expirySeconds?: number;
  onResend?: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}

export const OTPInput: React.FC<OTPInputProps> = ({
  length = 6,
  value: controlledValue,
  onChange,
  onComplete,
  error,
  expirySeconds,
  onResend,
  disabled = false,
  autoFocus = true,
  className = '',
}) => {
  const [internalDigits, setInternalDigits] = useState<string[]>(
    () => Array(length).fill('')
  );
  const [timeLeft, setTimeLeft] = useState<number | undefined>(expirySeconds);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Format code from digits array
  const digits = controlledValue !== undefined
    ? Array.from({ length }, (_, i) => controlledValue[i] || '')
    : internalDigits;

  // Auto focus first input on mount
  useEffect(() => {
    if (autoFocus && inputRefs.current[0] && !disabled) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus, disabled]);

  // Countdown timer logic
  useEffect(() => {
    if (expirySeconds === undefined) return;
    setTimeLeft(expirySeconds);

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === undefined || prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [expirySeconds]);

  const updateDigits = useCallback(
    (newDigits: string[]) => {
      if (controlledValue === undefined) {
        setInternalDigits(newDigits);
      }
      const code = newDigits.join('');
      onChange?.(code);

      if (code.length === length && !newDigits.some((d) => !d)) {
        onComplete?.(code);
      }
    },
    [controlledValue, length, onChange, onComplete]
  );

  const handleInputChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const digit = rawVal.replace(/\D/g, '').slice(-1); // Only take last single digit

    const newDigits = [...digits];
    newDigits[index] = digit;
    updateDigits(newDigits);

    if (digit && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        // Move back and clear previous
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        updateDigits(newDigits);
        inputRefs.current[index - 1]?.focus();
      } else {
        const newDigits = [...digits];
        newDigits[index] = '';
        updateDigits(newDigits);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text/plain').replace(/\D/g, '').slice(0, length);
    if (!pastedData) return;

    const newDigits = [...digits];
    for (let i = 0; i < length; i++) {
      newDigits[i] = pastedData[i] || '';
    }
    updateDigits(newDigits);

    // Focus last filled or next empty box
    const nextIndex = Math.min(pastedData.length, length - 1);
    inputRefs.current[nextIndex]?.focus();
  };

  const formatTimer = (seconds?: number) => {
    if (seconds === undefined) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleResendClick = () => {
    if (disabled || (timeLeft !== undefined && timeLeft > 0)) return;
    if (expirySeconds !== undefined) {
      setTimeLeft(expirySeconds);
    }
    onResend?.();
  };

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      {/* 6 Inputs Grid */}
      <div className="flex items-center gap-2 sm:gap-3">
        {Array.from({ length }).map((_, index) => {
          const hasVal = Boolean(digits[index]);
          const isErr = Boolean(error);

          return (
            <input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              value={digits[index]}
              onChange={(e) => handleInputChange(index, e)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              disabled={disabled}
              autoComplete="one-time-code"
              aria-label={`Digit ${index + 1} of ${length}`}
              className={`
                w-11 h-13 sm:w-13 sm:h-16 text-center text-xl sm:text-2xl font-bold rounded-2xl
                border-2 outline-none transition-all duration-200 select-none
                ${
                  isErr
                    ? 'border-[#EF4444] bg-red-50/40 text-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20'
                    : hasVal
                    ? 'border-[#FF6B4A] bg-[#FFF8F5] text-[#1A1D3E] shadow-sm'
                    : 'border-slate-200 bg-white text-[#1A1D3E] hover:border-slate-300'
                }
                focus:border-[#FF6B4A] focus:ring-4 focus:ring-[#FF6B4A]/20
                ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}
              `}
            />
          );
        })}
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-1.5 text-xs text-[#EF4444] font-medium animate-slide-down">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Resend & Timer */}
      {(expirySeconds !== undefined || onResend) && (
        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
          {timeLeft !== undefined && timeLeft > 0 ? (
            <span>
              Resend code in{' '}
              <span className="font-semibold text-[#FF6B4A]">{formatTimer(timeLeft)}</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={handleResendClick}
              disabled={disabled}
              className="inline-flex items-center gap-1 font-semibold text-[#FF6B4A] hover:text-[#E85A3A] hover:underline focus:outline-none transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Resend code</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default OTPInput;
