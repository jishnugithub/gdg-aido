import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { ChevronRight, Check } from 'lucide-react';

export interface SlideButtonRef {
  reset: () => void;
}

export interface SlideButtonProps {
  onComplete: () => void;
  text?: string;
  completedText?: string;
  disabled?: boolean;
  isCompleted?: boolean;
  autoResetTimeout?: number;
  className?: string;
}

export const SlideButton = forwardRef<SlideButtonRef, SlideButtonProps>(
  (
    {
      onComplete,
      text = 'Slide to complete',
      completedText = 'Completed!',
      disabled = false,
      isCompleted: controlledCompleted,
      autoResetTimeout,
      className = '',
    },
    ref
  ) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const thumbRef = useRef<HTMLDivElement>(null);

    const [isDragging, setIsDragging] = useState(false);
    const [dragX, setDragX] = useState(0);
    const [internalCompleted, setInternalCompleted] = useState(false);

    const isCompleted = controlledCompleted !== undefined ? controlledCompleted : internalCompleted;

    const resetState = useCallback(() => {
      setInternalCompleted(false);
      setDragX(0);
      setIsDragging(false);
    }, []);

    useImperativeHandle(ref, () => ({
      reset: resetState,
    }));

    useEffect(() => {
      if (controlledCompleted !== undefined) {
        setInternalCompleted(controlledCompleted);
        if (!controlledCompleted) {
          setDragX(0);
        }
      }
    }, [controlledCompleted]);

    const getMaxDistance = useCallback(() => {
      if (!trackRef.current || !thumbRef.current) return 0;
      return trackRef.current.clientWidth - thumbRef.current.clientWidth - 8; // 4px padding on each side
    }, []);

    const triggerComplete = useCallback(() => {
      setInternalCompleted(true);
      const maxDist = getMaxDistance();
      setDragX(maxDist);
      setIsDragging(false);

      // Trigger lightweight haptic feedback on mobile devices if supported
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(35);
        } catch {
          // ignore
        }
      }

      onComplete();

      if (autoResetTimeout && autoResetTimeout > 0) {
        setTimeout(() => {
          resetState();
        }, autoResetTimeout);
      }
    }, [getMaxDistance, onComplete, autoResetTimeout, resetState]);

    // Handle touch move / mouse drag
    const handleMove = useCallback(
      (clientX: number) => {
        if (!isDragging || isCompleted || disabled) return;
        if (!trackRef.current) return;

        const trackRect = trackRef.current.getBoundingClientRect();
        const startX = trackRect.left + 4;
        const currentOffset = clientX - startX;
        const maxDist = getMaxDistance();

        const clamped = Math.max(0, Math.min(maxDist, currentOffset));
        setDragX(clamped);

        // Completion threshold at 88%
        if (clamped >= maxDist * 0.88) {
          triggerComplete();
        }
      },
      [isDragging, isCompleted, disabled, getMaxDistance, triggerComplete]
    );

    const handleEnd = useCallback(() => {
      if (!isDragging || isCompleted) return;
      setIsDragging(false);

      const maxDist = getMaxDistance();
      if (dragX < maxDist * 0.88) {
        // Snap back
        setDragX(0);
      }
    }, [isDragging, isCompleted, getMaxDistance, dragX]);

    // Mouse event listeners on window
    useEffect(() => {
      const onMouseMove = (e: MouseEvent) => handleMove(e.clientX);
      const onMouseUp = () => handleEnd();

      if (isDragging) {
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      }

      return () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
    }, [isDragging, handleMove, handleEnd]);

    // Touch event listeners
    const handleTouchStart = () => {
      if (disabled || isCompleted) return;
      setIsDragging(true);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX);
      }
    };

    const handleTouchEnd = () => {
      handleEnd();
    };

    const maxDist = getMaxDistance();
    const progress = maxDist > 0 ? Math.min(1, dragX / maxDist) : 0;

    return (
      <div
        ref={trackRef}
        role="button"
        aria-label={isCompleted ? completedText : text}
        aria-disabled={disabled}
        className={`
          relative w-full h-14 rounded-2xl select-none overflow-hidden p-1
          flex items-center transition-colors duration-300
          ${
            isCompleted
              ? 'bg-[#22C55E] text-white shadow-md'
              : 'bg-[#1A1D3E]/5 border border-slate-200'
          }
          ${disabled ? 'opacity-50 pointer-events-none' : ''}
          ${className}
        `.trim()}
      >
        {/* Progress fill background */}
        {!isCompleted && (
          <div
            className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-[#FF6B4A]/25 to-[#FF6B4A]/40 transition-all duration-75 rounded-2xl pointer-events-none"
            style={{ width: `${Math.max(12, progress * 100)}%` }}
          />
        )}

        {/* Shimmer label text */}
        <div
          className={`
            absolute inset-0 flex items-center justify-center pointer-events-none
            text-sm font-bold tracking-wide transition-opacity duration-200
            ${isCompleted ? 'text-white' : 'text-[#1A1D3E]'}
          `}
          style={{ opacity: isCompleted ? 1 : Math.max(0, 1 - progress * 1.5) }}
        >
          {isCompleted ? completedText : text}
        </div>

        {/* Draggable Thumb */}
        <div
          ref={thumbRef}
          onMouseDown={() => {
            if (!disabled && !isCompleted) setIsDragging(true);
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            transform: `translateX(${isCompleted ? maxDist : dragX}px)`,
            transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          className={`
            relative z-10 w-12 h-12 rounded-xl flex items-center justify-center
            cursor-grab active:cursor-grabbing shadow-md
            ${
              isCompleted
                ? 'bg-white text-[#22C55E] animate-bounce-in'
                : 'bg-[#FF6B4A] text-white hover:bg-[#E85A3A]'
            }
          `}
        >
          {isCompleted ? (
            <Check className="w-6 h-6 stroke-[3]" />
          ) : (
            <div className="flex items-center -space-x-1">
              <ChevronRight className="w-5 h-5 animate-pulse" />
              <ChevronRight className="w-5 h-5 -ml-3 opacity-60" />
            </div>
          )}
        </div>
      </div>
    );
  }
);

SlideButton.displayName = 'SlideButton';

export default SlideButton;
