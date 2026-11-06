import React, { useState, useId } from 'react';

export type ToggleSize = 'sm' | 'md' | 'lg';

export interface ToggleProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  size?: ToggleSize;
  label?: React.ReactNode;
  leftLabel?: React.ReactNode;
  rightLabel?: React.ReactNode;
  onColor?: string;
  offColor?: string;
  name?: string;
  id?: string;
  className?: string;
}

const trackSizeStyles: Record<ToggleSize, { track: string; thumb: string; translate: string }> = {
  sm: {
    track: 'w-8 h-4 p-0.5',
    thumb: 'w-3 h-3',
    translate: 'translate-x-4',
  },
  md: {
    track: 'w-11 h-6 p-0.5',
    thumb: 'w-5 h-5',
    translate: 'translate-x-5',
  },
  lg: {
    track: 'w-14 h-8 p-1',
    thumb: 'w-6 h-6',
    translate: 'translate-x-6',
  },
};

const textSizeStyles: Record<ToggleSize, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base font-medium',
};

export const Toggle: React.FC<ToggleProps> = ({
  checked: controlledChecked,
  defaultChecked = false,
  onChange,
  disabled = false,
  size = 'md',
  label,
  leftLabel,
  rightLabel,
  onColor = 'bg-[#FF6B4A]',
  offColor = 'bg-slate-200',
  name,
  id,
  className = '',
}) => {
  const generatedId = useId();
  const toggleId = id || generatedId;

  const [internalChecked, setInternalChecked] = useState(defaultChecked);
  const isControlled = controlledChecked !== undefined;
  const isChecked = isControlled ? controlledChecked : internalChecked;

  const handleToggle = () => {
    if (disabled) return;
    const nextState = !isChecked;
    if (!isControlled) {
      setInternalChecked(nextState);
    }
    onChange?.(nextState);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      handleToggle();
    }
  };

  const { track, thumb, translate } = trackSizeStyles[size];
  const finalRightLabel = rightLabel || (!leftLabel ? label : null);

  return (
    <div
      className={`inline-flex items-center gap-2.5 select-none ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${className}`}
      onClick={handleToggle}
    >
      {leftLabel && (
        <span className={`text-[#1A1D3E] font-medium ${textSizeStyles[size]}`}>
          {leftLabel}
        </span>
      )}

      <button
        type="button"
        role="switch"
        id={toggleId}
        name={name}
        aria-checked={isChecked}
        disabled={disabled}
        onKeyDown={handleKeyDown}
        className={`
          relative inline-flex items-center rounded-full transition-colors duration-200 ease-in-out
          focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF6B4A]/30
          ${track}
          ${isChecked ? onColor : offColor}
        `}
      >
        <span
          className={`
            pointer-events-none inline-block rounded-full bg-white shadow-md
            transform transition-transform duration-200 ease-in-out
            ${thumb}
            ${isChecked ? translate : 'translate-x-0'}
          `}
        />
      </button>

      {finalRightLabel && (
        <span className={`text-[#1A1D3E] font-medium ${textSizeStyles[size]}`}>
          {finalRightLabel}
        </span>
      )}
    </div>
  );
};

export default Toggle;
