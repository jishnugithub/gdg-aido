import React, { useEffect } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastProps {
  toast: ToastItem;
  onClose: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, toast.duration ?? 4000);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onClose]);

  const typeConfig = {
    success: {
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
      border: 'border-l-4 border-l-emerald-500',
      bg: 'bg-white shadow-lg border border-slate-100',
      titleColor: 'text-slate-900',
    },
    error: {
      icon: <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />,
      border: 'border-l-4 border-l-rose-500',
      bg: 'bg-white shadow-lg border border-slate-100',
      titleColor: 'text-slate-900',
    },
    warning: {
      icon: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
      border: 'border-l-4 border-l-amber-500',
      bg: 'bg-white shadow-lg border border-slate-100',
      titleColor: 'text-slate-900',
    },
    info: {
      icon: <Info className="w-5 h-5 text-primary shrink-0" />,
      border: 'border-l-4 border-l-primary',
      bg: 'bg-white shadow-lg border border-slate-100',
      titleColor: 'text-slate-900',
    },
  }[toast.type];

  return (
    <div
      role="alert"
      className={`pointer-events-auto flex items-start w-full max-w-sm gap-3 p-4 rounded-xl ${typeConfig.bg} ${typeConfig.border} transition-all duration-300 ease-out transform translate-y-0`}
    >
      <div className="mt-0.5">{typeConfig.icon}</div>
      <div className="flex-1 min-w-0">
        <h4 className={`text-sm font-semibold leading-tight ${typeConfig.titleColor}`}>
          {toast.title}
        </h4>
        {toast.message && (
          <p className="mt-1 text-xs text-slate-600 leading-relaxed break-words">
            {toast.message}
          </p>
        )}
      </div>
      <button
        onClick={() => onClose(toast.id)}
        className="p-1 -mr-1 -mt-1 text-slate-400 hover:text-slate-700 transition-colors rounded-md"
        aria-label="Dismiss toast"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
