'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { AppShell } from '../../src/components/AppShell';
import { BirthChartSection } from '../../src/components/profile/BirthChartSection';
import { ProfilePanelFooter } from '../../src/components/profile/ProfilePanelFooter';
import { useProfile, useProfileChart } from '../../src/core/social/hooks';
import { useSettingsStore, useUIStore } from '../../src/store';
import { useWheelDisplayMode } from '../../src/hooks/useWheelDisplayMode';
import { Button } from '@/components/shared/Button';
import { Card } from '@/components/shared/Card';

export default function SettingsPage() {
  const { user, primaryChart, loading: profileLoading, refresh } = useProfile();
  const chartId = primaryChart?.id ?? null;
  const { refresh: refreshChart } = useProfileChart(chartId);
  const { settings, updateSettings } = useSettingsStore();
  const { theme, setTheme } = useUIStore();
  const { mode: wheelDisplayMode, setMode: setWheelDisplayMode } = useWheelDisplayMode();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    await refresh();
  };

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-8 min-w-0 w-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <h1 className="text-h1 font-bold text-text-primary">
            Settings
          </h1>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            Customize your Astradio experience with personalized preferences and audio settings.
          </p>
        </motion.div>

        <Card id="birth-chart" className="scroll-mt-8">
          <h2 className="text-h4 font-semibold text-text-primary mb-4">Birth chart</h2>
          {!user ? (
            <p className="text-sm text-text-secondary">Sign in to manage your birth chart.</p>
          ) : (
            <BirthChartSection
              variant="manage"
              refresh={refresh}
              refreshChart={refreshChart}
              primaryChart={primaryChart}
            />
          )}
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            {/* Theme Settings */}
            <Card>
              <h2 className="text-h4 font-semibold text-text-primary mb-4">
                Appearance
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-text-primary mb-2 block">
                    Theme
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setTheme('dark')}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        theme === 'dark'
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border bg-bg hover:bg-bgElev'
                      }`}
                    >
                      <div className="text-lg mb-1">🌙</div>
                      <div className="text-sm">Dark</div>
                    </button>
                    <button
                      type="button"
                      disabled
                      aria-disabled="true"
                      title="Light theme is not available in beta"
                      className="p-3 rounded-xl border text-center border-border/60 bg-bgElev/40 opacity-50 cursor-not-allowed pointer-events-none"
                    >
                      <div className="text-lg mb-1 grayscale">☀️</div>
                      <div className="text-sm text-text-muted">Light</div>
                      <div className="text-xs text-text-muted mt-1">(coming soon)</div>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-text-primary mb-2 block">
                    Chart display
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setWheelDisplayMode('technical')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        wheelDisplayMode === 'technical'
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border bg-bg hover:bg-bgElev'
                      }`}
                    >
                      <div className="text-sm font-medium mb-1">Technical</div>
                      <div className="text-xs text-text-secondary">
                        Full detail with zodiac ring, degree marks, and cusp labels
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setWheelDisplayMode('simple')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        wheelDisplayMode === 'simple'
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border bg-bg hover:bg-bgElev'
                      }`}
                    >
                      <div className="text-sm font-medium mb-1">Simple</div>
                      <div className="text-xs text-text-secondary">
                        Clean wheel with houses and planets only
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Audio Settings */}
            <Card>
              <h2 className="text-h4 font-semibold text-text-primary mb-4">
                Audio Quality
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-text-primary mb-2 block">
                    Audio Quality
                  </label>
                  <select
                    value={settings.audioQuality}
                    onChange={(e) => updateSettings({ audioQuality: e.target.value as any })}
                    className="input w-full"
                  >
                    <option value="low">Low (faster generation)</option>
                    <option value="standard">Standard (balanced)</option>
                    <option value="high">High (best quality)</option>
                  </select>
                  <p className="text-xs text-text-secondary mt-1">
                    Higher quality takes longer to generate but produces better audio
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-text-primary mb-2 block">
                    Auto-play
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="autoplay"
                      checked={settings.autoPlay}
                      onChange={(e) => updateSettings({ autoPlay: e.target.checked })}
                      className="w-4 h-4 text-accent bg-bg border-border rounded focus:ring-accent focus:ring-2"
                    />
                    <label htmlFor="autoplay" className="text-sm text-text-primary">
                      Automatically play compositions when ready
                    </label>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Right Column */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-6"
          >
            {/* Language Settings */}
            <Card>
              <h2 className="text-h4 font-semibold text-text-primary mb-4">
                Language & Region
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-text-primary mb-2 block">
                    Language
                  </label>
                  <select
                    value={settings.language}
                    onChange={(e) => updateSettings({ language: e.target.value as any })}
                    className="input w-full"
                  >
                    <option value="en">English</option>
                    <option value="es">Español</option>
                  </select>
                </div>
              </div>
            </Card>

            {/* Account Settings */}
            <Card>
              <h2 className="text-h4 font-semibold text-text-primary mb-4">
                Account
              </h2>
              
              <div className="space-y-4">
                {profileLoading ? (
                  <p className="text-sm text-text-secondary">Loading account…</p>
                ) : user ? (
                  <>
                    <div className="p-4 bg-bgElev rounded-xl border border-border">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-accent to-violet rounded-full flex items-center justify-center shrink-0">
                          <span className="text-bg font-bold">
                            {(user.displayName || '?').charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">{user.displayName}</p>
                          {user.handle ? (
                            <p className="text-xs text-text-secondary truncate">@{user.handle}</p>
                          ) : null}
                          {user.emailVerified ? (
                            <p className="text-xs text-text-muted mt-0.5">Email verified</p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={() => void handleLogout()}
                    >
                      Log out
                    </Button>
                    <div className="border-t border-border pt-4">
                      <ProfilePanelFooter user={user} onPrivacyUpdate={() => refresh()} />
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-text-secondary">
                    <Link href="/profile" className="text-accent hover:underline">
                      Sign in to manage your account
                    </Link>
                  </p>
                )}
              </div>
            </Card>
          </motion.div>
        </div>

        {/* About Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card>
          <h2 className="text-h4 font-semibold text-text-primary mb-4">
            About Astradio
          </h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-text-primary mb-2">Version</h3>
              <p className="text-sm text-text-secondary">v0.2.0 (Beta)</p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-text-primary mb-2">Last Updated</h3>
              <p className="text-sm text-text-secondary">January 2025</p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-text-primary mb-2">Engine</h3>
              <p className="text-sm text-text-secondary">Swiss Ephemeris + ML v2.5</p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-text-primary mb-2">Support</h3>
              <button className="text-sm text-accent hover:text-accent">
                Contact Support
              </button>
            </div>
          </div>
          </Card>
        </motion.div>

        <p className="text-body-sm text-text-muted text-center pt-4">
          <Link href="/today" className="text-accent hover:underline">
            Back to Today
          </Link>{' '}
          ·{' '}
          <Link href="/profile" className="text-accent hover:underline">
            My Sky
          </Link>
        </p>
      </div>
    </AppShell>
  );
}
