# Frontend Wiring Checklist

This document outlines the steps needed to integrate the new Astradio platform with your existing frontend.

## ✅ Completed Components

### 1. TypeScript Client (`src/lib/astradioClient.ts`)
- ✅ Complete API client with authentication, users, tracks, and social features
- ✅ Automatic token refresh handling
- ✅ Type-safe method signatures
- ✅ Error handling and retry logic

### 2. Engine Adapter (`engine/adapter.js`)
- ✅ Bridge between existing audio engine and new platform
- ✅ Track generation with timeline, audio, preview, and OG image
- ✅ Comparison track generation for overlay mode
- ✅ Placeholder implementation ready for actual engine integration

### 3. OpenAPI Specification (`openapi.yaml`)
- ✅ Complete API documentation
- ✅ Schema definitions for all data types
- ✅ Authentication and security schemes
- ✅ All endpoint specifications

## 🔧 Frontend Integration Steps

### 1. Authentication Flow

**Current State**: Your existing frontend likely has basic auth
**Required Changes**:

```typescript
// Replace existing auth with new client
import { AstradioClient } from "@/lib/astradioClient";

const api = new AstradioClient("/v1");

// Login flow
const handleLogin = async (email: string, password: string) => {
  try {
    const result = await api.login(email, password);
    // Store access token in memory (not localStorage for security)
    // Refresh token is handled automatically via httpOnly cookies
    return result;
  } catch (error) {
    console.error("Login failed:", error);
    throw error;
  }
};
```

**Tasks**:
- [ ] Replace existing auth calls with new client
- [ ] Update login/register forms to use new API
- [ ] Handle token storage (memory only for access token)
- [ ] Add logout functionality
- [ ] Test token refresh flow

### 2. Track Generation Integration

**Current State**: Your existing engine generates tracks directly
**Required Changes**:

```typescript
// Replace direct engine calls with API calls
const generateTrack = async (chartData: any, mode: Mode, genre: string) => {
  try {
    const result = await api.renderTrack(chartData, mode, genre);
    
    if (result.track) {
      // Track already exists (deduplication)
      return result.track;
    } else {
      // Track is queued for generation
      // Poll for completion or implement WebSocket updates
      return result;
    }
  } catch (error) {
    console.error("Track generation failed:", error);
    throw error;
  }
};
```

**Tasks**:
- [ ] Replace direct engine calls with API calls
- [ ] Handle queued vs. immediate track responses
- [ ] Implement polling or WebSocket for track completion
- [ ] Update UI to show generation status
- [ ] Test deduplication logic

### 3. Library View Implementation

**New Feature**: Personal track library
**Implementation**:

```typescript
// Library component
const LibraryView = () => {
  const [savedTracks, setSavedTracks] = useState([]);
  const [likedTracks, setLikedTracks] = useState([]);
  
  useEffect(() => {
    // Load user's saved tracks
    api.getSavedTracks().then(setSavedTracks);
    // Load user's liked tracks  
    api.getLikedTracks().then(setLikedTracks);
  }, []);
  
  return (
    <div>
      <h2>My Library</h2>
      <div>
        <h3>Saved Tracks</h3>
        {savedTracks.map(track => (
          <TrackCard key={track.id} track={track} />
        ))}
      </div>
      <div>
        <h3>Liked Tracks</h3>
        {likedTracks.map(track => (
          <TrackCard key={track.id} track={track} />
        ))}
      </div>
    </div>
  );
};
```

**Tasks**:
- [ ] Create Library tab/page
- [ ] Implement saved tracks view
- [ ] Implement liked tracks view
- [ ] Add track cards with save/like buttons
- [ ] Test library functionality

### 4. Track Page Enhancements

**Current State**: Basic track display
**Required Changes**:

```typescript
// Enhanced track page
const TrackPage = ({ trackId }: { trackId: string }) => {
  const [track, setTrack] = useState(null);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  
  useEffect(() => {
    api.getTrack(trackId).then(trackData => {
      setTrack(trackData.track);
      setIsLiked(trackData.is_liked);
      setIsSaved(trackData.is_saved);
    });
  }, [trackId]);
  
  const handleLike = async () => {
    if (isLiked) {
      await api.unlikeTrack(trackId);
      setIsLiked(false);
    } else {
      await api.likeTrack(trackId);
      setIsLiked(true);
    }
  };
  
  const handleSave = async () => {
    if (isSaved) {
      await api.unsaveTrack(trackId);
      setIsSaved(false);
    } else {
      await api.saveTrack(trackId);
      setIsSaved(true);
    }
  };
  
  const handleShare = async () => {
    const shareCard = await api.shareCard(trackId);
    // Open share dialog with shareCard data
  };
  
  return (
    <div>
      {/* Track player */}
      <audio src={track?.waveform_url} controls />
      
      {/* Track info */}
      <h1>{track?.mode} {track?.genre}</h1>
      <p>By {track?.display_name}</p>
      
      {/* Action buttons */}
      <button onClick={handleLike}>
        {isLiked ? '❤️' : '🤍'} Like
      </button>
      <button onClick={handleSave}>
        {isSaved ? '📁' : '📂'} Save
      </button>
      <button onClick={handleShare}>📤 Share</button>
    </div>
  );
};
```

**Tasks**:
- [ ] Add like/save buttons to track pages
- [ ] Implement share functionality
- [ ] Add track metadata display
- [ ] Test all track interactions
- [ ] Add loading states

### 5. Social Features

**New Features**: Following, comparisons, notifications
**Implementation**:

```typescript
// User profile page
const UserProfile = ({ username }: { username: string }) => {
  const [user, setUser] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  
  useEffect(() => {
    api.getUser(username).then(userData => {
      setUser(userData.user);
      setIsFollowing(userData.is_following);
    });
  }, [username]);
  
  const handleFollow = async () => {
    if (isFollowing) {
      await api.unfollow(username);
      setIsFollowing(false);
    } else {
      await api.follow(username);
      setIsFollowing(true);
    }
  };
  
  const handleCompare = async () => {
    const myChart = getCurrentUserChart(); // Get user's chart data
    await api.compare(username, myChart);
    // Navigate to comparison result
  };
  
  return (
    <div>
      <h1>{user?.display_name}</h1>
      <p>{user?.bio}</p>
      
      <button onClick={handleFollow}>
        {isFollowing ? 'Unfollow' : 'Follow'}
      </button>
      
      {user?.compare_opt_in && (
        <button onClick={handleCompare}>
          Compare Charts
        </button>
      )}
      
      {/* User's tracks */}
      <div>
        {user?.tracks?.map(track => (
          <TrackCard key={track.id} track={track} />
        ))}
      </div>
    </div>
  );
};
```

**Tasks**:
- [ ] Create user profile pages
- [ ] Implement follow/unfollow functionality
- [ ] Add chart comparison feature
- [ ] Create notifications system
- [ ] Test social interactions

### 6. Navigation Updates

**Required Changes**:
- [ ] Add Library tab to navigation
- [ ] Add user profile link
- [ ] Add notifications indicator
- [ ] Update routing for new pages

### 7. Error Handling

**Implementation**:
- [ ] Add global error handling for API calls
- [ ] Implement retry logic for failed requests
- [ ] Add user-friendly error messages
- [ ] Handle network connectivity issues

### 8. Performance Optimizations

**Implementation**:
- [ ] Add loading states for all async operations
- [ ] Implement pagination for track lists
- [ ] Add caching for user data
- [ ] Optimize image loading

## 🧪 Testing Checklist

### API Integration Tests
- [ ] Authentication flow (register, login, logout)
- [ ] Track generation and retrieval
- [ ] Social features (follow, like, save)
- [ ] Chart comparisons
- [ ] Error handling

### UI/UX Tests
- [ ] Responsive design on all screen sizes
- [ ] Loading states and transitions
- [ ] Error message display
- [ ] Accessibility compliance
- [ ] Cross-browser compatibility

### Performance Tests
- [ ] Page load times
- [ ] API response times
- [ ] Memory usage
- [ ] Network efficiency

## 🚀 Deployment Checklist

### Environment Setup
- [ ] Configure API base URL for production
- [ ] Set up environment variables
- [ ] Configure CORS settings
- [ ] Set up SSL certificates

### Monitoring
- [ ] Add error tracking (Sentry)
- [ ] Set up performance monitoring
- [ ] Configure logging
- [ ] Set up alerts

## 📝 Next Steps

1. **Start with Authentication**: Replace existing auth with new client
2. **Update Track Generation**: Integrate API calls for track creation
3. **Add Library View**: Implement saved/liked tracks
4. **Enhance Track Pages**: Add social interactions
5. **Implement Social Features**: Following and comparisons
6. **Polish and Test**: Error handling, performance, UX

## 🔗 Resources

- [OpenAPI Specification](./openapi.yaml)
- [TypeScript Client](./src/lib/astradioClient.ts)
- [Client Usage Examples](./src/examples/client-usage.ts)
- [Engine Adapter](./engine/adapter.js)
- [API Documentation](./README.md#api-documentation)
