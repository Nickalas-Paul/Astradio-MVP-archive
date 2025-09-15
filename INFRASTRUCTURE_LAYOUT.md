# Astradio Infrastructure Layout

## Overview
This document outlines the infrastructure setup for implementing the complete Astradio user flow, from landing page through community features.

## Component Architecture

### 1. Core Components

```
src/
├── components/
│   ├── core/
│   │   ├── AstrologicalWheel.jsx      # Reusable wheel component
│   │   ├── AudioPlayer.jsx            # Audio controls and visualization
│   │   ├── ChartControls.jsx          # Genre/Mode toggles
│   │   ├── BirthDataForm.jsx          # Date/Time/Location inputs
│   │   └── EducationPanel.jsx         # Collapsible education content
│   ├── layout/
│   │   ├── Navigation.jsx             # Top navigation bar
│   │   ├── Overlay.jsx                # Modal/drawer wrapper
│   │   ├── Sidebar.jsx                # Collapsible sidebar
│   │   └── Layout.jsx                 # Main layout wrapper
│   └── pages/
│       ├── LandingPage.jsx            # Today's chart + CTA
│       ├── PersonalChart.jsx          # User's personal chart
│       ├── ChartComparison.jsx        # Compare two charts
│       ├── Sandbox.jsx                # Experimental chart builder
│       ├── Library.jsx                # Saved/liked tracks
│       └── UserProfile.jsx            # User profiles
```

### 2. State Management

```javascript
// Centralized store structure
const store = {
  // Chart data
  charts: {
    today: null,           // Today's chart data
    personal: null,        // User's birth chart
    comparison: null,      // Comparison chart data
    sandbox: null          // Sandbox chart data
  },
  
  // Audio state
  audio: {
    isPlaying: false,
    currentTrack: null,
    volume: 0.9,
    genre: 'ambient',
    mode: 'houseorder'
  },
  
  // User state
  user: {
    isAuthenticated: false,
    profile: null,
    preferences: {},
    savedTracks: [],
    likedTracks: []
  },
  
  // UI state
  ui: {
    currentPage: 'landing',
    overlayOpen: false,
    educationPanelOpen: false,
    loading: false
  }
}
```

## Routing Strategy

### 1. Route Structure

```javascript
const routes = [
  // Landing page (default)
  {
    path: '/',
    component: LandingPage,
    exact: true
  },
  
  // Personal chart flow
  {
    path: '/personal',
    component: PersonalChart,
    children: [
      { path: '/personal/overlay', component: BirthDataOverlay },
      { path: '/personal/chart', component: PersonalChartDisplay }
    ]
  },
  
  // Exploration options
  {
    path: '/explore',
    component: ExploreOptions,
    children: [
      { path: '/explore/natal', component: NatalChart },
      { path: '/explore/compare', component: ChartComparison },
      { path: '/explore/sandbox', component: Sandbox }
    ]
  },
  
  // Community features
  {
    path: '/library',
    component: Library
  },
  {
    path: '/profile/:username',
    component: UserProfile
  },
  
  // API routes (handled by backend)
  {
    path: '/api/*',
    component: ApiProxy
  }
]
```

### 2. Navigation Flow

```
Landing Page (/)
├── Auto-play today's chart
├── Show genre/mode toggles
└── CTA: "Hear Your Soundtrack"
    ↓
Personal Overlay (/personal/overlay)
├── Birth data input form
├── Validate and generate chart
└── Show personal daily soundtrack
    ↓
Exploration Options (/explore)
├── Your Chart Alone (/explore/natal)
├── Compare Charts (/explore/compare)
└── Sandbox (/explore/sandbox)
    ↓
Education Layer (sidebar)
├── "What You're Hearing" panel
├── Progressive disclosure
└── Premium content gates
    ↓
Community Layer (future)
├── Save/Share tracks
├── Community feed
└── User profiles
```

## Implementation Strategy

### 1. Landing Page Implementation

```javascript
// LandingPage.jsx
const LandingPage = () => {
  const { charts, audio, ui } = useStore();
  
  useEffect(() => {
    // Auto-load today's chart on mount
    loadTodayChart();
    
    // Auto-start audio after 3 seconds
    const timer = setTimeout(() => {
      startTodayAudio();
    }, 3000);
    
    return () => clearTimeout(timer);
  }, []);
  
  const handleCTAClick = () => {
    navigate('/personal/overlay');
  };
  
  return (
    <Layout>
      <div className="landing-grid">
        <Navigation />
        <AstrologicalWheel chart={charts.today} />
        <AudioStatus audio={audio} />
        <ChartControls />
        <CTASection onClick={handleCTAClick} />
      </div>
    </Layout>
  );
};
```

### 2. Personal Overlay Implementation

```javascript
// BirthDataOverlay.jsx
const BirthDataOverlay = () => {
  const [birthData, setBirthData] = useState({
    date: '',
    time: '',
    location: ''
  });
  
  const handleSubmit = async (data) => {
    setLoading(true);
    try {
      const chart = await generatePersonalChart(data);
      const soundtrack = await generatePersonalSoundtrack(chart);
      
      // Update store
      store.charts.personal = chart;
      store.audio.currentTrack = soundtrack;
      
      // Navigate to personal chart display
      navigate('/personal/chart');
    } catch (error) {
      showError('Failed to generate chart');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Overlay>
      <div className="overlay-content">
        <BirthDataForm 
          data={birthData}
          onChange={setBirthData}
          onSubmit={handleSubmit}
          loading={loading}
        />
        <div className="preview-wheel">
          <AstrologicalWheel chart={charts.today} />
        </div>
      </div>
    </Overlay>
  );
};
```

### 3. Education Layer Implementation

```javascript
// EducationPanel.jsx
const EducationPanel = () => {
  const { audio, charts } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [currentExplanation, setCurrentExplanation] = useState(null);
  
  useEffect(() => {
    if (audio.currentTrack) {
      // Update explanation based on current audio position
      const explanation = getCurrentExplanation(audio.currentTrack);
      setCurrentExplanation(explanation);
    }
  }, [audio.currentTrack]);
  
  return (
    <Sidebar isOpen={isOpen} onToggle={() => setIsOpen(!isOpen)}>
      <div className="education-content">
        <h3>What You're Hearing</h3>
        {currentExplanation && (
          <>
            <div className="explanation-section">
              <h4>Tones</h4>
              <p>{currentExplanation.tones}</p>
            </div>
            <div className="explanation-section">
              <h4>House Emphasis</h4>
              <p>{currentExplanation.house}</p>
            </div>
            <div className="explanation-section">
              <h4>Aspects</h4>
              <p>{currentExplanation.aspects}</p>
            </div>
            <div className="explanation-section">
              <h4>Element</h4>
              <p>{currentExplanation.element}</p>
            </div>
          </>
        )}
        <button className="premium-link">Learn More (Premium)</button>
      </div>
    </Sidebar>
  );
};
```

## Data Flow Architecture

### 1. Chart Generation Flow

```
User Input → Validation → API Call → Chart Data → Audio Generation → UI Update
     ↓           ↓           ↓           ↓            ↓              ↓
Birth Data → Zod Schema → Swiss Ephemeris → Chart Object → Tone.js → React State
```

### 2. Audio Integration

```javascript
// Audio integration with existing engine
const audioEngine = {
  // Initialize with existing tone.js setup
  init() {
    // Use existing audio-engine.js
    return import('./audio-engine.js');
  },
  
  // Generate track for chart
  async generateTrack(chartData, mode, genre) {
    // Use existing engine.js with new chart data
    const engine = await this.init();
    return engine.generate(chartData, { mode, genre });
  },
  
  // Play/pause controls
  play() {
    // Integrate with existing audio controls
  },
  
  pause() {
    // Integrate with existing audio controls
  }
};
```

## Responsive Design Strategy

### 1. Breakpoint System

```css
/* Mobile-first approach */
:root {
  --breakpoint-sm: 576px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 992px;
  --breakpoint-xl: 1200px;
}

/* Layout adjustments */
.landing-grid {
  display: grid;
  gap: 1rem;
  padding: 1rem;
}

@media (min-width: 768px) {
  .landing-grid {
    grid-template-columns: 1fr 600px 1fr;
    gap: 2rem;
    padding: 2rem;
  }
}

@media (min-width: 1200px) {
  .landing-grid {
    grid-template-columns: 300px 1fr 300px;
  }
}
```

### 2. Mobile Optimizations

```javascript
// Mobile-specific behaviors
const useMobileOptimizations = () => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  useEffect(() => {
    if (isMobile) {
      // Auto-hide education panel on mobile
      store.ui.educationPanelOpen = false;
      
      // Use full-screen overlay for birth data
      store.ui.overlayFullscreen = true;
    }
  }, [isMobile]);
  
  return { isMobile };
};
```

## Performance Considerations

### 1. Lazy Loading

```javascript
// Lazy load heavy components
const ChartComparison = lazy(() => import('./ChartComparison'));
const Sandbox = lazy(() => import('./Sandbox'));
const Library = lazy(() => import('./Library'));

// Preload critical components
const preloadCritical = () => {
  // Preload personal chart components
  import('./PersonalChart');
  import('./BirthDataForm');
};
```

### 2. Audio Optimization

```javascript
// Audio streaming and caching
const audioCache = new Map();

const getAudioTrack = async (chartId, mode, genre) => {
  const key = `${chartId}-${mode}-${genre}`;
  
  if (audioCache.has(key)) {
    return audioCache.get(key);
  }
  
  const track = await generateTrack(chartId, mode, genre);
  audioCache.set(key, track);
  
  return track;
};
```

## Accessibility Implementation

### 1. ARIA Labels and Roles

```javascript
// Wheel component accessibility
const AstrologicalWheel = ({ chart, ariaLabel }) => {
  return (
    <svg
      role="img"
      aria-label={ariaLabel || "Astrological chart wheel"}
      aria-describedby="wheel-description"
    >
      {/* Chart content */}
    </svg>
  );
};
```

### 2. Keyboard Navigation

```javascript
// Keyboard shortcuts
useEffect(() => {
  const handleKeyPress = (e) => {
    switch (e.key) {
      case ' ': // Spacebar - play/pause
        e.preventDefault();
        toggleAudio();
        break;
      case 'e': // 'e' key - toggle education panel
        toggleEducationPanel();
        break;
      case 'Escape': // Escape - close overlays
        closeAllOverlays();
        break;
    }
  };
  
  document.addEventListener('keydown', handleKeyPress);
  return () => document.removeEventListener('keydown', handleKeyPress);
}, []);
```

## Integration with Existing Codebase

### 1. Leveraging Existing Components

```javascript
// Reuse existing wheel.js
import { initWheel, updateWheel } from './wheel.js';

// Reuse existing audio-engine.js
import { AudioEngine } from './audio-engine.js';

// Reuse existing overlay.html structure
const OverlayComponent = () => {
  // Use existing overlay.html as template
  return <div dangerouslySetInnerHTML={{ __html: overlayTemplate }} />;
};
```

### 2. Migration Strategy

```javascript
// Gradual migration approach
const MigrationWrapper = ({ children }) => {
  const [useNewUI, setUseNewUI] = useState(false);
  
  // Feature flag for gradual rollout
  useEffect(() => {
    const shouldUseNewUI = localStorage.getItem('useNewUI') === 'true';
    setUseNewUI(shouldUseNewUI);
  }, []);
  
  return useNewUI ? children : <LegacyUI />;
};
```

## Next Steps

1. **Phase 1**: Implement landing page with existing wheel and audio
2. **Phase 2**: Add personal overlay with birth data form
3. **Phase 3**: Create exploration options (natal, compare, sandbox)
4. **Phase 4**: Add education layer with collapsible panel
5. **Phase 5**: Implement community features (save, share, profiles)

This infrastructure provides a solid foundation for building the complete Astradio user experience while leveraging your existing working components.
