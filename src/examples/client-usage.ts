// Example usage of the Astradio TypeScript client
import { AstradioClient, Mode } from "../lib/astradioClient";

// Initialize the client
const api = new AstradioClient("/v1");

// Example: Authentication flow
async function loginExample() {
  try {
    // Register a new user
    await api.register("user@example.com", "securepassword123");
    console.log("User registered successfully");
    
    // Login
    const loginResult = await api.login("user@example.com", "securepassword123");
    console.log("Login successful", loginResult);
    
    // Get current user profile
    const me = await api.me();
    console.log("Current user:", me);
    
  } catch (error) {
    console.error("Auth error:", error);
  }
}

// Example: Track generation
async function generateTrackExample() {
  try {
    // Chart data from Swiss Ephemeris
    const chartData = {
      birth_datetime: "1990-01-01T12:00:00Z",
      birth_lat: 40.7128,
      birth_lon: -74.0060,
      planets: {
        sun: { sign: "Capricorn", degree: 10.5 },
        moon: { sign: "Libra", degree: 15.2 },
        // ... other planets
      }
    };
    
    // Request track generation
    const track = await api.renderTrack(chartData, "clusters", "electronic");
    console.log("Track generation started:", track);
    
    // Track will be processed by the worker and available later
    // You can poll for completion or use WebSocket for real-time updates
    
  } catch (error) {
    console.error("Track generation error:", error);
  }
}

// Example: Social features
async function socialFeaturesExample() {
  try {
    // Get a user's profile
    const user = await api.getUser("astrologer123");
    console.log("User profile:", user);
    
    // Follow a user
    await api.follow("astrologer123");
    console.log("Now following astrologer123");
    
    // Compare charts (overlay mode)
    const myChartData = {
      birth_datetime: "1990-01-01T12:00:00Z",
      birth_lat: 40.7128,
      birth_lon: -74.0060
    };
    
    const comparison = await api.compare("astrologer123", myChartData);
    console.log("Comparison started:", comparison);
    
  } catch (error) {
    console.error("Social features error:", error);
  }
}

// Example: Track interactions
async function trackInteractionsExample() {
  try {
    const trackId = "01HXYZ1234567890ABCDEF";
    
    // Get track details
    const track = await api.getTrack(trackId);
    console.log("Track details:", track);
    
    // Like the track
    await api.likeTrack(trackId);
    console.log("Track liked");
    
    // Save to library
    await api.saveTrack(trackId);
    console.log("Track saved to library");
    
    // Get share card for social media
    const shareCard = await api.shareCard(trackId);
    console.log("Share card:", shareCard);
    
  } catch (error) {
    console.error("Track interactions error:", error);
  }
}

// Example: Profile management
async function profileManagementExample() {
  try {
    // Update account information
    await api.updateMe({
      display_name: "Astro Musician",
      username: "astromusician",
      bio: "Creating music from the stars"
    });
    
    // Update birth data and privacy settings
    await api.updateProfile({
      birth_datetime: "1990-01-01T12:00:00Z",
      birth_lat: 40.7128,
      birth_lon: -74.0060,
      privacy_level: "public",
      compare_opt_in: true
    });
    
    console.log("Profile updated successfully");
    
  } catch (error) {
    console.error("Profile management error:", error);
  }
}

// Example: Track generation with proper typing
async function renderTrackExample(chartData: any, mode: Mode, genre: string) {
  try {
    const result = await api.renderTrack(chartData, mode, genre);
    return result;
  } catch (error) {
    console.error("Track generation failed:", error);
    throw error;
  }
}

// Export examples for testing
export {
  loginExample,
  generateTrackExample,
  socialFeaturesExample,
  trackInteractionsExample,
  profileManagementExample,
  renderTrackExample
};
