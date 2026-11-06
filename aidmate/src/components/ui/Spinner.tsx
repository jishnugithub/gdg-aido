import React from 'react';

export type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl';
export type SpinnerColor = 'primary' | 'secondary' | 'white' | 'accent' | 'current';

export interface SpinnerProps {
  size?: SpinnerSize;
  color?: SpinnerColor;
  fullPage?: boolean;
  text?: string;
  className?: string;
}

const sizeStyles: Record<SpinnerSize, { spinner: string; stroke: number; text: string }> = {
  sm: { spinner: 'w-4 h-4', stroke: 3, text: 'text-xs' },
  md: { spinner: 'w-6 h-6', stroke: 3, text: 'text-sm' },
  lg: { spinner: 'w-10 h-10', stroke: 3.5, text: 'text-base' },
  xl: { spinner: 'w-14 h-14', stroke: 4, text: 'text-lg' },
};

const colorStyles: Record<SpinnerColor, { stroke: string; track: string; text: string }> = {
  primary: {
    stroke: 'stroke-[#FF6B4A]',
    track: 'stroke-[#FF6B4A]/20',
    text: 'text-[#FF6B4A]',
  },
  secondary: {
    stroke: 'stroke-[#1A1D3E]',
    track: 'stroke-[#1A1D3E]/15',
    text: 'text-[#1A1D3E]',
  },
  white: {
    stroke: 'stroke-white',
    track: 'stroke-white/20',
    text: 'text-white',
  },
  accent: {
    stroke: 'stroke-[#FFB088]',
    track: 'stroke-[#FFB088]/20',
    text: 'text-[#FFB088]',
  },
  current: {
    stroke: 'stroke-current',
    track: 'stroke-current opacity-20',
    text: 'text-current',
  },
};

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  color = 'primary',
  fullPage = false,
  text,
  className = '',
}) => {
  const sizeConfig = sizeStyles[size];
  const colorConfig = colorStyles[color];

  const spinnerSvg = (
    <svg
      className={`animate-spin ${sizeConfig.spinner} shrink-0`}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="status"
      aria-label={text || 'Loading'}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        className={colorConfig.track}
        strokeWidth={sizeConfig.stroke}
      />
      <path
        className={colorConfig.stroke}
        strokeWidth={sizeConfig.stroke}
        strokeLinecap="round"
        d="M12 2a10 10 0 0 1 10 10"
      />
    </svg>
  );

  if (fullPage) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#FFF8F5]/85 backdrop-blur-sm p-4 animate-fade-in"
        role="alert"
        aria-busy="true"
      >
        <div className="flex flex-col items-center gap-3 p-6 rounded-3xl bg-white/80 shadow-lg border border-slate-100">
          {spinnerSvg}
          {text && (
            <p className={`font-semibold tracking-wide text-[#1A1D3E] ${sizeConfig.text}`}>
              {text}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (text) {
    return (
      <div className={`inline-flex items-center gap-2.5 ${className}`}>
        {spinnerSvg}
        <span className={`font-medium ${colorConfig.text} ${sizeConfig.text}`}>
          {text}
        </span>
      </div>
    );
  }

  return <div className={`inline-flex items-center justify-center ${className}`}>{spinnerSvg}</div>;
};

export default Spinner;
