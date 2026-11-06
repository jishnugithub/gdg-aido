import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  CheckCheck,
  Zap,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationContext';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { BottomNav } from '@/components/BottomNav';
import type { AppNotification } from '@/types';

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications();

  // Group notifications into Today, Yesterday, Earlier
  const groupedNotifications = useMemo(() => {
    const today: AppNotification[] = [];
    const yesterday: AppNotification[] = [];
    const earlier: AppNotification[] = [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

    notifications.forEach((n) => {
      const time = new Date(n.createdAt).getTime();
      if (time >= todayStart) {
        today.push(n);
      } else if (time >= yesterdayStart) {
        yesterday.push(n);
      } else {
        earlier.push(n);
      }
    });

    return { today, yesterday, earlier };
  }, [notifications]);

  const handleNotificationClick = async (notif: AppNotification) => {
    if (!notif.isRead) {
      await markAsRead(notif.notificationId);
    }

    if (notif.relatedJobId) {
      navigate(`/tracking/${notif.relatedJobId}`);
    }
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'job_accepted':
      case 'application_accepted':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'job_available':
        return <Zap className="w-4 h-4 text-[#FF6B4A]" />;
      case 'new_message':
        return <MessageSquare className="w-4 h-4 text-blue-500" />;
      default:
        return <Bell className="w-4 h-4 text-[#FF6B4A]" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF8F5]/60 pb-24 sm:pb-12 text-[#1A1D3E]">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3.5">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#FF6B4A]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <h1 className="text-base font-bold text-[#1A1D3E]">Notifications</h1>

          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={() => markAllAsRead()}
              className="text-xs font-bold text-[#FF6B4A] hover:underline flex items-center gap-1"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all read</span>
            </button>
          ) : (
            <div className="w-16" />
          )}
        </div>
      </header>

      {/* Main List */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-5 flex flex-col gap-5">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-white rounded-2xl border border-slate-200 p-4 animate-pulse" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            title="All caught up!"
            description="You don't have any notifications right now. Check back as new job requests or updates arrive."
            className="my-12 bg-white rounded-3xl p-8 border border-slate-100 shadow-sm"
          />
        ) : (
          <div className="flex flex-col gap-6">
            {/* TODAY */}
            {groupedNotifications.today.length > 0 && (
              <section className="flex flex-col gap-2.5">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 px-1">
                  Today
                </h3>
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm divide-y divide-slate-100 overflow-hidden">
                  {groupedNotifications.today.map((n) => (
                    <NotificationItem
                      key={n.notificationId}
                      notification={n}
                      icon={getIconForType(n.type)}
                      onClick={() => handleNotificationClick(n)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* YESTERDAY */}
            {groupedNotifications.yesterday.length > 0 && (
              <section className="flex flex-col gap-2.5">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 px-1">
                  Yesterday
                </h3>
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm divide-y divide-slate-100 overflow-hidden">
                  {groupedNotifications.yesterday.map((n) => (
                    <NotificationItem
                      key={n.notificationId}
                      notification={n}
                      icon={getIconForType(n.type)}
                      onClick={() => handleNotificationClick(n)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* EARLIER */}
            {groupedNotifications.earlier.length > 0 && (
              <section className="flex flex-col gap-2.5">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 px-1">
                  Earlier
                </h3>
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm divide-y divide-slate-100 overflow-hidden">
                  {groupedNotifications.earlier.map((n) => (
                    <NotificationItem
                      key={n.notificationId}
                      notification={n}
                      icon={getIconForType(n.type)}
                      onClick={() => handleNotificationClick(n)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      <BottomNav activeTab="home" />
    </div>
  );
};

interface ItemProps {
  notification: AppNotification;
  icon: React.ReactNode;
  onClick: () => void;
}

const NotificationItem: React.FC<ItemProps> = ({ notification, icon, onClick }) => {
  const isUnread = !notification.isRead;
  const timeStr = new Date(notification.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      className={`p-4 flex items-start justify-between gap-3 cursor-pointer transition-colors ${
        isUnread ? 'bg-[#FFF8F5]/80 hover:bg-[#FFF0EB]' : 'hover:bg-slate-50'
      }`}
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
          {icon}
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-xs sm:text-sm font-bold text-[#1A1D3E] truncate">
              {notification.title}
            </h4>
            {isUnread && (
              <span className="w-2 h-2 rounded-full bg-[#FF6B4A] shrink-0" />
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
            {notification.message}
          </p>
          <span className="text-[10px] text-slate-400 mt-1">{timeStr}</span>
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-2" />
    </div>
  );
};

export default NotificationsPage;
