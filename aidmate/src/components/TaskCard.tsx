import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, MapPin, IndianRupee, Zap } from 'lucide-react';
import type { Job } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

export interface TaskCardProps {
  job: Job;
  distance?: number;
  onClick?: () => void;
  className?: string;
}

export const TaskCard: React.FC<TaskCardProps> = ({ job, distance, onClick, className = '' }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(`/task/${job.jobId}`);
    }
  };

  const formatDeadline = (date: Date | null): string => {
    if (!date) return 'Flexible';
    const now = new Date();
    const diffHours = Math.round((date.getTime() - now.getTime()) / (1000 * 60 * 60));
    if (diffHours < 0) return 'Expired';
    if (diffHours === 0) return 'Due now';
    if (diffHours < 24) return `In ${diffHours}h`;
    const days = Math.round(diffHours / 24);
    return `In ${days}d`;
  };

  const getStatusBadge = (status: Job['status']) => {
    switch (status) {
      case 'searching':
        return <Badge variant="warning" size="sm" dot>Searching</Badge>;
      case 'assigned':
      case 'in_progress':
        return <Badge variant="primary" size="sm" dot>Active</Badge>;
      case 'completed':
        return <Badge variant="success" size="sm">Completed</Badge>;
      case 'posted':
        return <Badge variant="outline" size="sm">Open</Badge>;
      default:
        return <Badge variant="secondary" size="sm">{status}</Badge>;
    }
  };

  return (
    <Card
      variant="interactive"
      padding="sm"
      onClick={handleClick}
      className={`group relative flex flex-col justify-between overflow-hidden bg-white hover:border-[#FF6B4A]/50 transition-all duration-200 ${className}`}
    >
      <div>
        {/* Header: Mode + Category + Status */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {job.mode === 'active' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FF6B4A]/10 text-[#FF6B4A] border border-[#FF6B4A]/20">
                <Zap className="w-3 h-3 fill-current" />
                <span>Instant</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200">
                <span>Task</span>
              </span>
            )}
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md truncate max-w-[120px]">
              {job.category}
            </span>
          </div>
          {getStatusBadge(job.status)}
        </div>

        {/* Content & optional thumbnail */}
        <div className="flex gap-3">
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-[#1A1D3E] group-hover:text-[#FF6B4A] transition-colors line-clamp-1">
              {job.title}
            </h4>
            <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
              {job.description}
            </p>
          </div>
          {job.images && job.images.length > 0 && (
            <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-slate-100 border border-slate-200">
              <img
                src={job.images[0]}
                alt={job.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              />
            </div>
          )}
        </div>

        {/* Tags */}
        {job.tags && job.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2.5">
            {job.tags.slice(0, 3).map((tag, idx) => (
              <span key={idx} className="text-[10px] text-slate-500 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded">
                #{tag}
              </span>
            ))}
            {job.tags.length > 3 && (
              <span className="text-[10px] text-slate-400 self-center">+{job.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>

      {/* Footer Info: Amount, Location, Deadline */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3 text-slate-500">
          <div className="flex items-center gap-1 font-medium text-slate-600 truncate max-w-[140px]">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{distance !== undefined ? `${distance.toFixed(1)} km away` : job.taskAddress || 'Nearby'}</span>
          </div>
          {job.deadline && (
            <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>{formatDeadline(job.deadline)}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 font-bold text-base text-[#1A1D3E]">
          <IndianRupee className="w-3.5 h-3.5 text-[#FF6B4A]" />
          <span>{job.offeredAmount}</span>
        </div>
      </div>
    </Card>
  );
};

export default TaskCard;
