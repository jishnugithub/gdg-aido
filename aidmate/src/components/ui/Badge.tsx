import React from 'react';
import { X } from 'lucide-react';

export type BadgeVariant =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'outline'
  | 'neutral';

export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  onRemove?: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, { badge: string; dot: string }> = {
  primary: {
    badge: 'bg-[#FF6B4A]/12 text-[#E85A3A] border-[#FF6B4A]/25',
    dot: 'bg-[#FF6B4A]',
  },
  secondary: {
    badge: 'bg-[#1A1D3E]/10 text-[#1A1D3E] border-[#1A1D3E]/20',
    dot: 'bg-[#1A1D3E]',
  },
  success: {
    badge: 'bg-[#22C55E]/15 text-[#15803D] border-[#22C55E]/30',
    dot: 'bg-[#22C55E]',
  },
  warning: {
    badge: 'bg-[#F59E0B]/15 text-[#B45309] border-[#F59E0B]/30',
    dot: 'bg-[#F59E0B]',
  },
  danger: {
    badge: 'bg-[#EF4444]/15 text-[#DC2626] border-[#EF4444]/30',
    dot: 'bg-[#EF4444]',
  },
  info: {
    badge: 'bg-sky-50 text-sky-600 border-sky-200',
    dot: 'bg-sky-500',
  },
  outline: {
    badge: 'bg-transparent text-[#1A1D3E] border-slate-300',
    dot: 'bg-[#1A1D3E]',
  },
  neutral: {
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-400',
  },
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[11px] gap-1',
  md: 'px-2.5 py-1 text-xs gap-1.5',
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'primary',
  size = 'md',
  dot = false,
  onRemove,
  icon,
  className = '',
  children,
  ...rest
}) => {
  const currentVariant = variantStyles[variant];

  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full border
        transition-all duration-150 select-none
        ${currentVariant.badge}
        ${sizeStyles[size]}
        ${className}
      `.trim()}
      {...rest}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${currentVariant.dot}`}
          aria-hidden="true"
        />
      )}

      {icon && <span className="inline-flex shrink-0">{icon}</span>}

      <span>{children}</span>

      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label="Remove badge"
          className="ml-0.5 -mr-1 p-0.5 rounded-full hover:bg-black/10 active:bg-black/20 text-current transition-colors focus:outline-none"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
};

export default Badge;
