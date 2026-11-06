import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  children?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-[#FF6B4A] text-white hover:bg-[#E85A3A] active:bg-[#D94E2F] shadow-sm hover:shadow-md border border-transparent focus-visible:ring-[#FF6B4A]/40',
  secondary:
    'bg-[#1A1D3E] text-white hover:bg-[#282C5C] active:bg-[#141630] shadow-sm hover:shadow-md border border-transparent focus-visible:ring-[#1A1D3E]/40',
  outline:
    'bg-transparent text-[#FF6B4A] border-2 border-[#FF6B4A] hover:bg-[#FF6B4A]/10 active:bg-[#FF6B4A]/15 focus-visible:ring-[#FF6B4A]/40',
  ghost:
    'bg-transparent text-[#1A1D3E] hover:bg-[#1A1D3E]/8 active:bg-[#1A1D3E]/12 border border-transparent focus-visible:ring-[#1A1D3E]/20',
  danger:
    'bg-[#EF4444] text-white hover:bg-[#DC2626] active:bg-[#B91C1C] shadow-sm hover:shadow-md border border-transparent focus-visible:ring-[#EF4444]/40',
  success:
    'bg-[#22C55E] text-white hover:bg-[#16A34A] active:bg-[#15803D] shadow-sm hover:shadow-md border border-transparent focus-visible:ring-[#22C55E]/40',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs font-medium rounded-lg gap-1.5',
  md: 'px-4 py-2.5 text-sm font-semibold rounded-xl gap-2',
  lg: 'px-6 py-3.5 text-base font-semibold rounded-2xl gap-2.5',
};

const iconSizes: Record<ButtonSize, string> = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      loadingText,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled = false,
      className = '',
      children,
      type = 'button',
      ...rest
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={isLoading}
        aria-disabled={isDisabled}
        className={`
          relative inline-flex items-center justify-center font-sans tracking-wide
          transition-all duration-200 select-none
          focus:outline-none focus-visible:ring-4
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${fullWidth ? 'w-full' : ''}
          ${isDisabled ? 'opacity-60 cursor-not-allowed pointer-events-none' : 'active:scale-[0.98] cursor-pointer'}
          ${className}
        `.trim()}
        {...rest}
      >
        {isLoading ? (
          <>
            <Loader2 className={`animate-spin ${iconSizes[size]} shrink-0`} />
            <span>{loadingText || children}</span>
          </>
        ) : (
          <>
            {leftIcon && <span className="inline-flex shrink-0 items-center justify-center">{leftIcon}</span>}
            {children && <span>{children}</span>}
            {rightIcon && <span className="inline-flex shrink-0 items-center justify-center">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
