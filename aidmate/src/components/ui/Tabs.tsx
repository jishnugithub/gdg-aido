import React, { useState, useRef, useEffect, useCallback } from 'react';

export interface TabItem {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  badge?: number | string;
  badgeVariant?: 'primary' | 'secondary' | 'error' | 'warning';
  content?: React.ReactNode;
  disabled?: boolean;
}

export type TabsVariant = 'underline' | 'pills' | 'segmented';

export interface TabsProps {
  tabs: TabItem[];
  activeTab?: string;
  defaultTab?: string;
  onChange?: (tabId: string) => void;
  variant?: TabsVariant;
  fullWidth?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const badgeVariantStyles = {
  primary: 'bg-[#FF6B4A] text-white',
  secondary: 'bg-[#1A1D3E] text-white',
  error: 'bg-[#EF4444] text-white',
  warning: 'bg-[#F59E0B] text-white',
};

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab: controlledTab,
  defaultTab,
  onChange,
  variant = 'underline',
  fullWidth = false,
  className = '',
  children,
}) => {
  const [internalTab, setInternalTab] = useState<string>(() => {
    return defaultTab || (tabs.length > 0 ? tabs[0].id : '');
  });

  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  });

  const isControlled = controlledTab !== undefined;
  const currentTab = isControlled ? controlledTab : internalTab;

  const updateIndicator = useCallback(() => {
    const activeEl = tabRefs.current.get(currentTab);
    if (activeEl) {
      setIndicatorStyle({
        left: activeEl.offsetLeft,
        width: activeEl.clientWidth,
      });
    }
  }, [currentTab]);

  useEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  // Recalculate on window resize
  useEffect(() => {
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [updateIndicator]);

  const handleTabClick = (tab: TabItem) => {
    if (tab.disabled) return;
    if (!isControlled) {
      setInternalTab(tab.id);
    }
    onChange?.(tab.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight') {
      const nextTab = tabs[(index + 1) % tabs.length];
      if (!nextTab.disabled) handleTabClick(nextTab);
    } else if (e.key === 'ArrowLeft') {
      const prevTab = tabs[(index - 1 + tabs.length) % tabs.length];
      if (!prevTab.disabled) handleTabClick(prevTab);
    }
  };

  const activeContent = tabs.find((t) => t.id === currentTab)?.content;

  return (
    <div className={`w-full flex flex-col ${className}`}>
      {/* Horizontal Tabs Header */}
      <div
        className={`
          relative flex items-center overflow-x-auto no-scrollbar
          ${
            variant === 'underline'
              ? 'border-b border-slate-200'
              : variant === 'segmented'
              ? 'p-1 bg-slate-100/80 rounded-2xl'
              : 'gap-2'
          }
        `}
        role="tablist"
      >
        {tabs.map((tab, idx) => {
          const isActive = currentTab === tab.id;

          return (
            <button
              key={tab.id}
              ref={(el) => {
                if (el) tabRefs.current.set(tab.id, el);
                else tabRefs.current.delete(tab.id);
              }}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              id={`tab-${tab.id}`}
              disabled={tab.disabled}
              onClick={() => handleTabClick(tab)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              className={`
                relative inline-flex items-center justify-center gap-2 py-3 px-4 font-semibold text-sm
                transition-all duration-200 whitespace-nowrap outline-none select-none
                ${fullWidth ? 'flex-1' : ''}
                ${
                  tab.disabled
                    ? 'opacity-40 cursor-not-allowed text-slate-400'
                    : isActive
                    ? variant === 'pills'
                      ? 'bg-[#FF6B4A] text-white rounded-xl shadow-sm'
                      : variant === 'segmented'
                      ? 'bg-white text-[#1A1D3E] rounded-xl shadow-sm'
                      : 'text-[#FF6B4A]'
                    : variant === 'pills'
                    ? 'text-slate-600 hover:text-[#1A1D3E] hover:bg-slate-100 rounded-xl'
                    : variant === 'segmented'
                    ? 'text-slate-500 hover:text-[#1A1D3E]'
                    : 'text-slate-500 hover:text-[#1A1D3E]'
                }
              `}
            >
              {tab.icon && <span className="w-4 h-4 shrink-0">{tab.icon}</span>}
              <span>{tab.label}</span>

              {tab.badge !== undefined && (
                <span
                  className={`
                    px-1.5 py-0.2 rounded-full text-[10px] font-bold
                    ${
                      variant === 'pills' && isActive
                        ? 'bg-white/25 text-white'
                        : badgeVariantStyles[tab.badgeVariant || 'primary']
                    }
                  `}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Animated Underline Indicator (for underline variant) */}
        {variant === 'underline' && (
          <span
            className="absolute bottom-0 h-0.5 bg-[#FF6B4A] transition-all duration-300 ease-out"
            style={{
              left: `${indicatorStyle.left}px`,
              width: `${indicatorStyle.width}px`,
            }}
          />
        )}
      </div>

      {/* Tab Panels */}
      <div className="pt-4">
        {activeContent && (
          <div
            role="tabpanel"
            id={`panel-${currentTab}`}
            aria-labelledby={`tab-${currentTab}`}
            className="animate-fade-in"
          >
            {activeContent}
          </div>
        )}
        {children}
      </div>
    </div>
  );
};

export default Tabs;
