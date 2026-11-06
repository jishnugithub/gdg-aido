import React, { useState } from 'react';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarStatus = 'online' | 'offline' | 'busy' | 'away';
export type AvatarShape = 'circle' | 'rounded' | 'square';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  name?: string;
  size?: AvatarSize;
  status?: AvatarStatus;
  shape?: AvatarShape;
}

const sizeStyles: Record<AvatarSize, { container: string; text: string; status: string }> = {
  xs: { container: 'w-6 h-6', text: 'text-[10px] font-bold', status: 'w-2 h-2 ring-1' },
  sm: { container: 'w-8 h-8', text: 'text-xs font-bold', status: 'w-2.5 h-2.5 ring-1.5' },
  md: { container: 'w-10 h-10', text: 'text-sm font-bold', status: 'w-3 h-3 ring-2' },
  lg: { container: 'w-14 h-14', text: 'text-lg font-bold', status: 'w-3.5 h-3.5 ring-2' },
  xl: { container: 'w-20 h-20', text: 'text-2xl font-bold', status: 'w-4 h-4 ring-2' },
};

const shapeStyles: Record<AvatarShape, string> = {
  circle: 'rounded-full',
  rounded: 'rounded-2xl',
  square: 'rounded-lg',
};

const statusColors: Record<AvatarStatus, string> = {
  online: 'bg-[#22C55E]',
  offline: 'bg-slate-400',
  busy: 'bg-[#EF4444]',
  away: 'bg-[#F59E0B]',
};

// Generates stable warm pastel colors from user's name
const getInitialsBg = (name: string): { bg: string; text: string } => {
  const palettes = [
    { bg: 'bg-[#FF6B4A]/15', text: 'text-[#E85A3A]' },
    { bg: 'bg-[#1A1D3E]/15', text: 'text-[#1A1D3E]' },
    { bg: 'bg-[#22C55E]/15', text: 'text-[#15803D]' },
    { bg: 'bg-[#F59E0B]/15', text: 'text-[#B45309]' },
    { bg: 'bg-[#FFB088]/30', text: 'text-[#E85A3A]' },
    { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  ];

  if (!name) return palettes[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % palettes.length;
  return palettes[index];
};

const getInitials = (name?: string): string => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = 'Avatar',
  name = '',
  size = 'md',
  status,
  shape = 'circle',
  className = '',
  ...rest
}) => {
  const [imageError, setImageError] = useState(false);
  const sizeConfig = sizeStyles[size];
  const { bg, text } = getInitialsBg(name);
  const initials = getInitials(name || alt);

  const showImage = Boolean(src) && !imageError;

  return (
    <div className={`relative inline-block shrink-0 ${className}`} {...rest}>
      <div
        className={`
          flex items-center justify-center overflow-hidden border border-black/5 select-none
          ${sizeConfig.container}
          ${shapeStyles[shape]}
          ${showImage ? 'bg-slate-100' : `${bg} ${text}`}
        `}
      >
        {showImage ? (
          <img
            src={src!}
            alt={alt || name}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className={sizeConfig.text}>{initials}</span>
        )}
      </div>

      {status && (
        <span
          aria-label={`Status: ${status}`}
          className={`
            absolute bottom-0 right-0 rounded-full ring-white
            ${sizeConfig.status}
            ${statusColors[status]}
          `}
        />
      )}
    </div>
  );
};

export default Avatar;
