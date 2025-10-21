# Browser/Device Matrix Test Plan

## Desktop Browsers

### Chrome (Latest)
- **Test**: Compose → Playback → Wheel Render
- **Accept**: Audio plays, wheel renders, no console errors
- **Evidence**: Screenshot with visible hashes

### Firefox (Latest)  
- **Test**: Compose → Playback → Wheel Render
- **Accept**: Audio plays, wheel renders, no console errors
- **Evidence**: Screenshot with visible hashes

### Safari (Latest)
- **Test**: Compose → Playback → Wheel Render  
- **Accept**: Audio plays, wheel renders, no console errors
- **Evidence**: Screenshot with visible hashes

## Mobile Browsers

### iOS Safari
- **Test**: Tap to enable audio → Compose → Playback
- **Accept**: Audio plays, wheel renders, touch interactions work
- **Evidence**: Screenshot with visible hashes

### Android Chrome
- **Test**: Tap to enable audio → Compose → Playback
- **Accept**: Audio plays, wheel renders, touch interactions work
- **Evidence**: Screenshot with visible hashes

## Test Cases

### Primary Test
1. Load staging URL
2. Enable audio (tap if mobile)
3. Set date: 1990-01-01, time: 12:00, location: New York
4. Click Compose
5. Verify: Audio URL present, text visible, wheel renders
6. Click Play
7. Verify: Audio plays for 10+ seconds
8. Click Stop
9. Verify: Audio stops

### Error Test
1. Set invalid date: "invalid-date"
2. Click Compose
3. Verify: Error message visible, no audio/text/wheel

### Determinism Test
1. Run same inputs twice
2. Verify: Identical hashes and audio URLs

## Evidence Collection

### Required Screenshots
- **Desktop**: Full browser window with visible controlHash/rendererHash
- **Mobile**: Full screen with visible controlHash/rendererHash
- **Error State**: Error message visible, no fallback rendering

### Required HAR Files
- **Chrome**: 3 golden charts (compose + audio requests)
- **Firefox**: 1 golden chart (compose + audio requests)
- **Safari**: 1 golden chart (compose + audio requests)

## Acceptance Criteria

### ✅ Pass
- All browsers render audio/text/wheel
- Audio plays and stops correctly
- Error states show proper messages
- Determinism verified
- No console errors
- CORS headers present

### ❌ Fail
- Any browser fails to render
- Audio doesn't play
- Silent fallbacks
- Console errors
- Missing CORS headers
