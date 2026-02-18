// Development Tools - Feature flag management and testing utilities
// Only available in development mode

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // Development tools for feature flag management
  (window as any).__DEV_TOOLS__ = {
    // Enable all features for testing
    enableAllFeatures: () => {
      const flags = [
        'ENABLE_TRENDING',
        'ENABLE_COMPAT', 
        'ENABLE_SOCIAL',
        'ENABLE_ANALYTICS',
        'ENABLE_SHARING',
        'ENABLE_PLAYLISTS',
        'ENABLE_NOTIFICATIONS'
      ];
      
      flags.forEach(flag => {
        (window as any).__FLAGS__ = (window as any).__FLAGS__ || {};
        (window as any).__FLAGS__[flag] = true;
      });
      
      console.log('✅ All features enabled for testing');
      window.location.reload();
    },

    // Disable all features
    disableAllFeatures: () => {
      const flags = [
        'ENABLE_TRENDING',
        'ENABLE_COMPAT',
        'ENABLE_SOCIAL', 
        'ENABLE_ANALYTICS',
        'ENABLE_SHARING',
        'ENABLE_PLAYLISTS',
        'ENABLE_NOTIFICATIONS'
      ];
      
      flags.forEach(flag => {
        (window as any).__FLAGS__ = (window as any).__FLAGS__ || {};
        (window as any).__FLAGS__[flag] = false;
      });
      
      console.log('❌ All features disabled');
      window.location.reload();
    },

    // Toggle mock mode
    toggleMockMode: () => {
      (window as any).__USE_MOCK__ = !(window as any).__USE_MOCK__;
      console.log(`🔄 Mock mode: ${(window as any).__USE_MOCK__ ? 'ON' : 'OFF'}`);
      window.location.reload();
    },

    // Show current flags
    showFlags: () => {
      console.log('📋 Current feature flags:');
      console.log('USE_MOCK:', !!(window as any).__USE_MOCK__);
      console.log('ENABLE_TRENDING:', !!(window as any).__FLAGS__?.ENABLE_TRENDING);
      console.log('ENABLE_COMPAT:', !!(window as any).__FLAGS__?.ENABLE_COMPAT);
      console.log('ENABLE_SOCIAL:', !!(window as any).__FLAGS__?.ENABLE_SOCIAL);
      console.log('ENABLE_ANALYTICS:', !!(window as any).__FLAGS__?.ENABLE_ANALYTICS);
      console.log('ENABLE_SHARING:', !!(window as any).__FLAGS__?.ENABLE_SHARING);
      console.log('ENABLE_PLAYLISTS:', !!(window as any).__FLAGS__?.ENABLE_PLAYLISTS);
      console.log('ENABLE_NOTIFICATIONS:', !!(window as any).__FLAGS__?.ENABLE_NOTIFICATIONS);
    },

    // Test telemetry
    testTelemetry: () => {
      if ((window as any).__telemetry) {
        console.log('📊 Telemetry queue size:', (window as any).__telemetry.getQueueSize());
        (window as any).__telemetry.track({ t: 'test', message: 'Development test event' });
        console.log('✅ Test telemetry event sent');
      } else {
        console.log('❌ Telemetry not available');
      }
    },

    // Clear telemetry queue
    clearTelemetry: () => {
      if ((window as any).__telemetry) {
        (window as any).__telemetry.clearQueue();
        console.log('🧹 Telemetry queue cleared');
      } else {
        console.log('❌ Telemetry not available');
      }
    },

    // Test adapter
    testAdapter: () => {
      console.log('🔧 Testing engine adapter...');
      
      // Test mock adapter
      (window as any).__USE_MOCK__ = true;
      const mockAdapter = (window as any).__USE_MOCK__ ? 'Mock' : 'Live';
      console.log(`📡 Using ${mockAdapter} adapter`);
      
      // Test composition creation
      import('./api/engine-adapter').then(({ createComposition }) => {
        createComposition({
          chartA: 'test-chart',
          genre: 'ambient',
          durationSec: 60,
        }).then(result => {
          console.log('✅ Composition created:', result);
        }).catch(error => {
          console.error('❌ Composition failed:', error);
        });
      });
    },

    // Help
    help: () => {
      console.log(`
🚀 Astradio Development Tools

Available commands:
  __DEV_TOOLS__.enableAllFeatures()  - Enable all feature flags
  __DEV_TOOLS__.disableAllFeatures() - Disable all feature flags  
  __DEV_TOOLS__.toggleMockMode()     - Toggle mock/live adapter
  __DEV_TOOLS__.showFlags()          - Show current feature flags
  __DEV_TOOLS__.testTelemetry()      - Send test telemetry event
  __DEV_TOOLS__.clearTelemetry()     - Clear telemetry queue
  __DEV_TOOLS__.testAdapter()        - Test engine adapter
  __DEV_TOOLS__.help()               - Show this help

URL Parameters for testing:
  ?trending=true     - Enable trending
  ?compat=true       - Enable compatibility
  ?social=true       - Enable social features
  ?analytics=true    - Enable analytics
  ?sharing=true      - Enable sharing
  ?playlists=true    - Enable playlists
  ?notifications=true - Enable notifications
      `);
    }
  };

  // Auto-show help on first load
  console.log('🛠️  Development tools loaded. Type __DEV_TOOLS__.help() for commands.');
}
