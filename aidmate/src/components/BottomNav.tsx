import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Search, PlusCircle, MessageSquare, User } from 'lucide-react';

export interface BottomNavProps {
  activeTab?: 'home' | 'search' | 'post' | 'chat' | 'profile';
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const getActive = (): string => {
    if (activeTab) return activeTab;
    const path = location.pathname;
    if (path === '/home' || path === '/') return 'home';
    if (path.startsWith('/search')) return 'search';
    if (path.startsWith('/post-task') || path.startsWith('/passive-request') || path.startsWith('/active-request')) return 'post';
    if (path.startsWith('/chat')) return 'chat';
    if (path.startsWith('/profile')) return 'profile';
    return '';
  };

  const current = getActive();

  const navItems = [
    { id: 'home', label: 'Home', icon: Home, path: '/home' },
    { id: 'search', label: 'Search', icon: Search, path: '/search' },
    { id: 'post', label: 'Post Task', icon: PlusCircle, path: '/active-request', highlight: true },
    { id: 'chat', label: 'Chat', icon: MessageSquare, path: '/chat' },
    { id: 'profile', label: 'Profile', icon: User, path: '/profile' },
  ];

  return (
    <nav aria-label="Mobile Navigation" className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-2 py-2 sm:hidden transition-all duration-200">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = current === item.id;
          const Icon = item.icon;

          if (item.highlight) {
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.path)}
                className="flex flex-col items-center justify-center -mt-5 focus:outline-none group"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#FF6B4A] to-[#FF8E75] text-white flex items-center justify-center shadow-lg shadow-[#FF6B4A]/30 group-hover:scale-105 active:scale-95 transition-transform duration-200">
                  <Icon className="w-6 h-6 stroke-[2.5]" />
                </div>
                <span className="text-[10px] font-bold text-[#FF6B4A] mt-1">{item.label}</span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-colors focus:outline-none ${
                isActive ? 'text-[#FF6B4A]' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
              <span className={`text-[11px] mt-1 ${isActive ? 'font-bold text-[#FF6B4A]' : 'font-medium'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
