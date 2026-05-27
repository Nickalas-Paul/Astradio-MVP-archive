'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { AppShell } from '../../src/components/AppShell';
import { BirthChartSection } from '../../src/components/profile/BirthChartSection';
import { useProfile, useProfileChart } from '../../src/core/social/hooks';
import { useSettingsStore, useUIStore } from '../../src/store';
import { Button } from '@/components/shared/Button';

export default function SettingsPage() {
  const { user, primaryChart, refresh } = useProfile();
  const chartId = primaryChart?.id ?? null;
  const { refresh: refreshChart } = useProfileChart(chartId);
  const { settings, updateSettings, resetSettings } = useSettingsStore();
  const { theme, setTheme } = useUIStore();
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    setIsResetting(true);
    // Simulate reset delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    resetSettings();
    setIsResetting(false);
  };

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <h1 className="text-h1 font-bold text-text">
            Settings
          </h1>
          <p className="text-lg text-subtext max-w-2xl mx-auto">
            Customize your Astradio experience with personalized preferences and audio settings.
          </p>
        </motion.div>

        <div id="birth-chart" className="card scroll-mt-8">
          <h2 className="text-h4 font-semibold text-text mb-4">Birth chart</h2>
          {!user ? (
            <p className="text-sm text-subtext">Sign in to manage your birth chart.</p>
          ) : (
            <BirthChartSection
              variant="manage"
              refresh={refresh}
              refreshChart={refreshChart}
              primaryChart={primaryChart}
            />
          )}
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            {/* Theme Settings */}
            <div className="card">
              <h2 className="text-h4 font-semibold text-text mb-4">
                Appearance
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-text mb-2 block">
                    Theme
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setTheme('dark')}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        theme === 'dark'
                          ? 'border-accent bg-accent/10 text-accent-light'
                          : 'border-border bg-bg hover:bg-bgElev'
                      }`}
                    >
                      <div className="text-lg mb-1">🌙</div>
                      <div className="text-sm">Dark</div>
                    </button>
                    <button
                      onClick={() => setTheme('light')}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        theme === 'light'
                          ? 'border-accent bg-accent/10 text-accent-light'
                          : 'border-border bg-bg hover:bg-bgElev'
                      }`}
                      disabled
                    >
                      <div className="text-lg mb-1">☀️</div>
                      <div className="text-sm">Light</div>
                      <div className="text-xs text-subtext mt-1">Coming soon</div>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Audio Settings */}
            <div className="card">
              <h2 className="text-h4 font-semibold text-text mb-4">
                Audio Quality
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-text mb-2 block">
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
                  <p className="text-xs text-subtext mt-1">
                    Higher quality takes longer to generate but produces better audio
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-text mb-2 block">
                    Auto-play
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="autoplay"
                      checked={settings.autoPlay}
                      onChange={(e) => updateSettings({ autoPlay: e.target.checked })}
                      className="w-4 h-4 text-accent-light bg-bg border-border rounded focus:ring-accent focus:ring-2"
                    />
                    <label htmlFor="autoplay" className="text-sm text-text">
                      Automatically play compositions when ready
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right Column */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-6"
          >
            {/* Language Settings */}
            <div className="card">
              <h2 className="text-h4 font-semibold text-text mb-4">
                Language & Region
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-text mb-2 block">
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
            </div>

            {/* Account Settings */}
            <div className="card">
              <h2 className="text-h4 font-semibold text-text mb-4">
                Account
              </h2>
              
              <div className="space-y-4">
                <div className="p-4 bg-bgElev rounded-xl border border-border">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-accent-light to-violet rounded-full flex items-center justify-center">
                      <span className="text-bg font-bold">A</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text">Guest User</p>
                      <p className="text-xs text-subtext">No account required</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Button type="button" variant="secondary" size="sm" className="w-full">
                    Export Data
                  </Button>
                  <Button type="button" variant="secondary" size="sm" className="w-full">
                    Import Data
                  </Button>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="card border-danger/20">
              <h2 className="text-lg font-semibold text-danger mb-4">
                Danger Zone
              </h2>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-text mb-2">
                    Reset All Settings
                  </h3>
                  <p className="text-xs text-subtext mb-3">
                    This will reset all your preferences to their default values. 
                    This action cannot be undone.
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-danger border border-danger hover:bg-danger/10 w-full"
                    onClick={handleReset}
                    disabled={isResetting}
                    loading={isResetting}
                  >
                    Reset Settings
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* About Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="card"
        >
          <h2 className="text-h4 font-semibold text-text mb-4">
            About Astradio
          </h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-text mb-2">Version</h3>
              <p className="text-sm text-subtext">v0.2.0 (Beta)</p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-text mb-2">Last Updated</h3>
              <p className="text-sm text-subtext">January 2025</p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-text mb-2">Engine</h3>
              <p className="text-sm text-subtext">Swiss Ephemeris + ML v2.5</p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-text mb-2">Support</h3>
              <button className="text-sm text-accent-light hover:text-accent-light">
                Contact Support
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AppShell>
  );
}
