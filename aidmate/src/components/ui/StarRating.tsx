import React, { useState } from 'react';

export type StarRatingSize = 'sm' | 'md' | 'lg';

export interface StarRatingProps {
  rating?: number;
  maxRating?: number;
  onChange?: (newRating: number) => void;
  readonly?: boolean;
  interactive?: boolean;
  allowHalf?: boolean;
  size?: StarRatingSize;
  starColor?: string;
  emptyColor?: string;
  showValue?: boolean;
  totalReviews?: number;
  className?: string;
}

const sizeStyles: Record<StarRatingSize, { star: string; text: string; gap: string }> = {
  sm: { star: 'w-4 h-4', text: 'text-xs', gap: 'gap-1' },
  md: { star: 'w-5 h-5', text: 'text-sm', gap: 'gap-1.5' },
  lg: { star: 'w-7 h-7', text: 'text-base font-semibold', gap: 'gap-2' },
};

export const StarRating: React.FC<StarRatingProps> = ({
  rating = 0,
  maxRating = 5,
  onChange,
  readonly = true,
  interactive,
  allowHalf = true,
  size = 'md',
  starColor = '#F59E0B',
  emptyColor = '#E2E8F0',
  showValue = false,
  totalReviews,
  className = '',
}) => {
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const activeRating = hoverRating !== null ? hoverRating : rating;
  const isInteractive = interactive !== undefined ? interactive : (!readonly && Boolean(onChange));
  const sizeConfig = sizeStyles[size];

  const handleStarClick = (starIndex: number, isHalf: boolean) => {
    if (!isInteractive || !onChange) return;
    const value = allowHalf && isHalf ? starIndex + 0.5 : starIndex + 1;
    onChange(value);
  };

  const handleMouseMove = (
    e: React.MouseEvent<HTMLSpanElement>,
    starIndex: number
  ) => {
    if (!isInteractive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isHalf = allowHalf && x < rect.width / 2;
    setHoverRating(isHalf ? starIndex + 0.5 : starIndex + 1);
  };

  const handleMouseLeave = () => {
    if (!isInteractive) return;
    setHoverRating(null);
  };

  return (
    <div
      className={`inline-flex items-center ${sizeConfig.gap} ${className}`}
      onMouseLeave={handleMouseLeave}
      role={isInteractive ? 'radiogroup' : 'img'}
      aria-label={`Rating: ${rating} out of ${maxRating} stars`}
    >
      <div className="flex items-center">
        {Array.from({ length: maxRating }).map((_, index) => {
          const fillPercentage = Math.max(
            0,
            Math.min(100, (activeRating - index) * 100)
          );

          const starId = `star-grad-${index}-${Math.floor(activeRating * 10)}`;

          return (
            <span
              key={index}
              onClick={(e) => {
                if (!isInteractive) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const isHalf = allowHalf && e.clientX - rect.left < rect.width / 2;
                handleStarClick(index, isHalf);
              }}
              onMouseMove={(e) => handleMouseMove(e, index)}
              className={`
                relative inline-flex items-center justify-center p-0.5 select-none
                ${isInteractive ? 'cursor-pointer hover:scale-110 active:scale-95 transition-transform' : ''}
              `}
              role={isInteractive ? 'radio' : undefined}
              aria-checked={isInteractive ? rating === index + 1 : undefined}
              tabIndex={isInteractive ? 0 : undefined}
              onKeyDown={(e) => {
                if (!isInteractive) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleStarClick(index, false);
                }
              }}
            >
              <svg
                className={`${sizeConfig.star}`}
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient id={starId} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset={`${fillPercentage}%`} stopColor={starColor} />
                    <stop offset={`${fillPercentage}%`} stopColor={emptyColor} />
                  </linearGradient>
                </defs>
                <polygon
                  fill={`url(#${starId})`}
                  stroke={fillPercentage > 0 ? starColor : emptyColor}
                  strokeLinejoin="round"
                  points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                />
              </svg>
            </span>
          );
        })}
      </div>

      {showValue && (
        <div className={`flex items-center gap-1 font-semibold text-[#1A1D3E] ${sizeConfig.text}`}>
          <span>{rating.toFixed(1)}</span>
          {totalReviews !== undefined && (
            <span className="text-slate-400 font-normal">
              ({totalReviews.toLocaleString()})
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default StarRating;
