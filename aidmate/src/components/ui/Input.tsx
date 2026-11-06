import React, { forwardRef, useId } from 'react';
import { AlertCircle } from 'lucide-react';

export type InputVariant = 'default' | 'filled';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  variant?: InputVariant;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      variant = 'default',
      fullWidth = true,
      disabled = false,
      required = false,
      className = '',
      id,
      ...rest
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;

    const variantClasses = {
      default:
        'bg-white border-slate-200 text-[#1A1D3E] placeholder:text-slate-400 focus:border-[#FF6B4A] focus:ring-[#FF6B4A]/25',
      filled:
        'bg-[#F8F9FE] border-transparent text-[#1A1D3E] placeholder:text-slate-400 focus:bg-white focus:border-[#FF6B4A] focus:ring-[#FF6B4A]/25',
    };

    const hasError = Boolean(error);

    return (
      <div className={`${fullWidth ? 'w-full' : 'inline-block'} flex flex-col gap-1.5`}>
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

        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3.5 flex items-center justify-center pointer-events-none text-slate-400">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            required={required}
            aria-invalid={hasError}
            aria-describedby={
              hasError ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
            }
            className={`
              w-full px-4 py-2.5 text-sm rounded-xl font-sans
              border outline-none transition-all duration-200
              focus:ring-4
              ${variantClasses[variant]}
              ${leftIcon ? 'pl-10' : ''}
              ${rightIcon ? 'pr-10' : ''}
              ${hasError ? 'border-[#EF4444] text-[#EF4444] focus:border-[#EF4444] focus:ring-[#EF4444]/20' : ''}
              ${disabled ? 'bg-slate-100/70 text-slate-400 cursor-not-allowed border-slate-200' : 'hover:border-slate-300'}
              ${className}
            `.trim()}
            {...rest}
          />

          {rightIcon && (
            <div className="absolute right-3.5 flex items-center justify-center text-slate-400">
              {rightIcon}
            </div>
          )}
        </div>

        {error && (
          <div
            id={`${inputId}-error`}
            className="flex items-center gap-1.5 text-xs text-[#EF4444] font-medium mt-0.5 animate-slide-down"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!error && helperText && (
          <p id={`${inputId}-helper`} className="text-xs text-slate-500 font-normal mt-0.5">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
