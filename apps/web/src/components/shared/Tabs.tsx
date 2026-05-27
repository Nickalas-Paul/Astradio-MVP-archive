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

function pillTabClass(active: boolean, compact: boolean): string {
  if (compact) {
    return active
      ? 'px-3 py-1.5 rounded-full text-sm font-medium transition-colors bg-accent text-white'
      : 'px-3 py-1.5 rounded-full text-sm font-medium transition-colors text-subtext hover:text-text';
  }
  return active
    ? 'px-4 py-3 rounded-full text-sm font-medium transition-colors whitespace-nowrap bg-accent text-white shadow-md'
    : 'px-4 py-3 rounded-full text-sm font-medium transition-colors whitespace-nowrap text-subtext hover:text-text hover:bg-bgElev';
}

function pillContainerClass(pillTrack: TabsProps['pillTrack']): string {
  return pillTrack === 'compact'
    ? 'flex rounded-full bg-bgElev border border-border p-0.5 flex-wrap'
    : 'flex items-center justify-center gap-2 bg-panel rounded-full p-2 shadow-soft border border-border overflow-x-auto';
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
      ? 'flex gap-2 border-b border-border pb-2'
      : variant === 'pill'
        ? pillContainerClass(pillTrack)
        : 'flex gap-2 rounded-lg bg-bgElev p-1 border border-border';

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
                  ? 'px-4 py-2 rounded-t-lg text-sm font-medium bg-bgElev text-text border border-b-0 border-border'
                  : 'px-4 py-2 rounded-t-lg text-sm font-medium text-subtext'
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
                ? 'flex-1 rounded-md px-3 py-2 text-left transition-colors bg-bg border border-border text-accent-light'
                : 'flex-1 rounded-md px-3 py-2 text-left transition-colors text-subtext hover:bg-bg'
            }
          >
            <div className="text-sm font-medium">{tab.label}</div>
            {tab.description ? <div className="text-xs text-subtext">{tab.description}</div> : null}
          </button>
        );
      })}
    </div>
  );
}
