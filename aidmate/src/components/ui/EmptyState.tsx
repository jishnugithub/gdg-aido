import React from 'react';
import { HelpCircle } from 'lucide-react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  secondaryAction?: React.ReactNode;
  compact?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  actionLabel,
  onAction,
  secondaryAction,
  compact = false,
  className = '',
  children,
}) => {
  return (
    <div
      className={`
        flex flex-col items-center justify-center text-center
        ${compact ? 'py-6 px-4' : 'py-12 sm:py-16 px-6'}
        rounded-3xl border border-dashed border-slate-200/80 bg-white/50 backdrop-blur-sm
        ${className}
      `.trim()}
    >
      {/* Icon with warm glowing circle backdrop */}
      <div className="relative mb-4">
        <div className="absolute inset-0 rounded-full bg-[#FFB088]/30 blur-xl scale-125 pointer-events-none" />
        <div className="relative flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr from-[#FFF8F5] to-white border border-[#FF6B4A]/20 shadow-sm text-[#FF6B4A]">
          {icon || <HelpCircle className="w-8 h-8 sm:w-10 sm:h-10 text-[#FF6B4A]" />}
        </div>
      </div>

      {/* Title */}
      <h3 className="text-lg sm:text-xl font-bold text-[#1A1D3E] tracking-tight max-w-md">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="mt-1.5 text-xs sm:text-sm text-slate-500 max-w-sm leading-relaxed">
          {description}
        </p>
      )}

      {/* Extra children */}
      {children && <div className="mt-4">{children}</div>}

      {/* Action Buttons */}
      {(action || actionLabel || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {action ? (
            action
          ) : actionLabel && onAction ? (
            <Button variant="primary" onClick={onAction}>
              {actionLabel}
            </Button>
          ) : null}

          {secondaryAction}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
