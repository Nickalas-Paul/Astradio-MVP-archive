import type { ReactNode } from 'react';

export type TabVariant = 'underline' | 'pill' | 'segmented';

export interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  description?: string;
}

export interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  variant?: TabVariant;
  /** Compact pill track (Compatibility modes); default is Community nav track */
  pillTrack?: 'community' | 'compact';
  ariaLabel?: string;
  className?: string;
}

const tabTransitionFast = 'transition-all duration-fast ease-aurora';
const tabTransitionBase = 'transition-all duration-base ease-aurora';

function pillTabClass(active: boolean, compact: boolean): string {
  if (compact) {
    return active
      ? `shrink-0 min-h-[44px] px-3 py-2 rounded-full text-sm font-medium ${tabTransitionBase} bg-accent text-white`
      : `shrink-0 min-h-[44px] px-3 py-2 rounded-full text-sm font-medium ${tabTransitionBase} text-text-secondary hover:text-text-primary`;
  }
  return active
    ? `shrink-0 min-h-[44px] px-4 py-3 rounded-full text-sm font-medium whitespace-nowrap ${tabTransitionBase} bg-accent text-white shadow-md`
    : `shrink-0 min-h-[44px] px-4 py-3 rounded-full text-sm font-medium whitespace-nowrap ${tabTransitionBase} text-text-secondary hover:text-text-primary hover:bg-bgElev`;
}

function pillContainerClass(pillTrack: TabsProps['pillTrack']): string {
  return pillTrack === 'compact'
    ? 'flex rounded-full bg-bgElev border border-border p-0.5 flex-wrap gap-1'
    : 'flex items-center gap-2 bg-surface-0 rounded-full p-2 shadow-soft border border-border overflow-x-auto scrollbar-hide w-full max-w-full';
}

export function Tabs({
  tabs,
  activeTab,
  onTabChange,
  variant = 'underline',
  pillTrack = 'community',
  ariaLabel,
  className = '',
}: TabsProps) {
  const containerClass =
    variant === 'underline'
      ? 'flex gap-2 border-b border-border overflow-x-auto scrollbar-hide w-full max-w-full'
      : variant === 'pill'
        ? pillContainerClass(pillTrack)
        : 'flex gap-2 rounded-lg bg-bgElev p-1 border border-border w-full';

  return (
    <div role="tablist" aria-label={ariaLabel} className={`${containerClass} ${className}`.trim()}>
      {tabs.map((tab) => {
        const active = activeTab === tab.id;

        if (variant === 'underline') {
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onTabChange(tab.id)}
              className={
                active
                  ? `shrink-0 min-h-[44px] px-4 py-2 text-sm font-medium text-text-primary border-b-2 border-accent -mb-px ${tabTransitionFast}`
                  : `shrink-0 min-h-[44px] px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary border-b-2 border-transparent -mb-px ${tabTransitionFast}`
              }
            >
              {tab.label}
            </button>
          );
        }

        if (variant === 'pill') {
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onTabChange(tab.id)}
              className={pillTabClass(active, pillTrack === 'compact')}
            >
              {tab.icon ? (
                <span className="flex items-center gap-2">
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </span>
              ) : (
                tab.label
              )}
            </button>
          );
        }

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onTabChange(tab.id)}
            className={
              active
                ? `flex-1 min-h-[44px] rounded-md px-3 py-2 text-left ${tabTransitionFast} bg-surface-2 text-text-primary`
                : `flex-1 min-h-[44px] rounded-md px-3 py-2 text-left ${tabTransitionFast} text-text-secondary hover:text-text-primary hover:bg-bg/50`
            }
          >
            <div className="text-sm font-medium">{tab.label}</div>
            {tab.description ? (
              <div className="text-xs text-text-secondary">{tab.description}</div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
