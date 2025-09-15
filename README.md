# Astradio - Astrological Music Platform

Astradio is a platform that generates unique musical compositions based on astrological charts. The system combines Swiss Ephemeris calculations with an advanced audio engine to create personalized music that reflects the cosmic influences at the time of birth.

## Features

### Core Audio Engine
- **Three Composition Modes**: Planetary Clusters, Elemental Blocks, and Lunar Clock
- **Multiple Genres**: Ambient, Classical, Electronic, Jazz, and more
- **Real-time Generation**: Instant audio creation from chart data
- **Swiss Ephemeris Integration**: Accurate planetary positions and house calculations
- **Advanced Sound Design**: High-quality instrumentation for each genre with realistic samples and sophisticated synthesis

### Sound Design & Instrumentation
- **Classical & Jazz**: Realistic sampled instruments using Tone.js Sampler with authentic acoustic sounds
- **Electronic Genres**: High-quality synthesized instruments with advanced filters, effects, and layering
- **Genre-Specific Effects**: Tailored reverb, compression, and modulation for each musical style
- **Dynamic Processing**: Sidechain compression, tape saturation, and shimmer effects
- **Multi-layered Instruments**: Complex sound design with noise layers, harmonic content, and spatial effects

### User Platform (New)
- **User Accounts**: Registration, login, and profile management
- **Track Library**: Save and organize generated tracks
- **Social Features**: Follow users, like tracks, and share compositions
- **Chart Comparisons**: Overlay your chart with others to create relationship music
- **Playlists**: Create and manage custom playlists
- **Privacy Controls**: Public, friends-only, or private profiles
- **Notifications**: Real-time updates for social interactions

## Architecture

### Backend Stack
- **Node.js** with Express
- **PostgreSQL** for relational data
- **Redis** for sessions and job queues
- **S3-compatible storage** for audio files
- **JWT authentication** with refresh tokens
- **Swiss Ephemeris** for astrological calculations

### Frontend
- **Vanilla JavaScript** with modern ES6+
- **Tone.js** for audio synthesis
- **Responsive design** for mobile and desktop

## Quick Start

### Prerequisites
- Node.js 20.12.2 or higher
- PostgreSQL 12 or higher
- Redis 6 or higher
- S3-compatible storage (AWS S3, MinIO, etc.)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Astradio_MVP
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

4. **Set up the database**
   ```bash
   npm run db:migrate
   ```

5. **Start the server**
   ```bash
   npm run dev
   ```

6. **Start the render worker** (in a separate terminal)
   ```bash
   node workers/render-worker.js
   ```

### Environment Configuration

Create a `.env` file with the following variables:

```env
# Database
POSTGRES_URL=postgresql://username:password@localhost:5432/astradio
REDIS_URL=redis://localhost:6379

# File Storage
S3_ENDPOINT=https://s3.amazonaws.com
S3_BUCKET=astradio-tracks
S3_ACCESS_KEY_ID=your_access_key
S3_SECRET_ACCESS_KEY=your_secret_key
S3_REGION=us-east-1

# Authentication
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# App Configuration
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:3000
API_BASE_URL=http://localhost:3000/v1
```

## 📚 Frontend Integration

### TypeScript Client

The platform includes a complete TypeScript client for easy frontend integration:

```typescript
import { AstradioClient } from "@/lib/astradioClient";

const api = new AstradioClient("/v1");

// Login
await api.login(email, password);

// Generate track
const track = await api.renderTrack(chartData, "clusters", "electronic");

// Social features
await api.follow(username);
await api.likeTrack(trackId);
```

See [Frontend Wiring Guide](./FRONTEND_WIRING.md) for complete integration steps.

### Key Files

- **API Client**: `src/lib/astradioClient.ts` - Complete TypeScript client
- **Engine Adapter**: `engine/adapter.js` - Bridge to existing audio engine
- **API Spec**: `openapi.yaml` - OpenAPI 3.1 specification
- **Examples**: `src/examples/client-usage.ts` - Usage examples

## API Documentation

### Authentication

#### Register User
```http
POST /v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword",
  "display_name": "John Doe",
  "username": "johndoe"
}
```

#### Login
```http
POST /v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}
```

### Tracks

#### Request Track Render
```http
POST /v1/tracks/render
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "chartData": {
    "date": "1990-01-01",
    "time": "12:00",
    "lat": 40.7128,
    "lon": -74.0060
  },
  "mode": "clusters",
  "genre": "ambient",
  "source": "natal",
  "duration_sec": 60
}
```

#### Get Track
```http
GET /v1/tracks/:id
Authorization: Bearer <access_token>
```

### Users

#### Get Profile
```http
GET /v1/users/me
Authorization: Bearer <access_token>
```

#### Update Profile
```http
PATCH /v1/users/me
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "display_name": "New Name",
  "bio": "My astrological journey"
}
```

### Social Features

#### Follow User
```http
POST /v1/follows/:username
Authorization: Bearer <access_token>
```

#### Request Comparison
```http
POST /v1/compare/:username
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "chartData": {
    "date": "1990-01-01",
    "time": "12:00",
    "lat": 40.7128,
    "lon": -74.0060
  },
  "mode": "clusters",
  "genre": "ambient"
}
```

### Library

#### Get Saved Tracks
```http
GET /v1/library/saved
Authorization: Bearer <access_token>
```

#### Create Playlist
```http
POST /v1/library/playlists
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "title": "My Astrological Journey",
  "description": "Tracks that represent my cosmic path",
  "is_public": true
}
```

## Database Schema

### Core Tables
- `users` - User accounts and profiles
- `profiles` - Birth data and privacy settings
- `tracks` - Generated audio tracks
- `libraries` - User's saved tracks
- `likes` - Track likes
- `playlists` - User playlists
- `follows` - User relationships
- `comparisons` - Chart comparison requests
- `notifications` - User notifications

## Development

### Project Structure
```
Astradio_MVP/
├── lib/                 # Core utilities
│   ├── database.js     # Database connection
│   ├── redis.js        # Redis connection
│   ├── auth.js         # Authentication utilities
│   └── storage.js      # File storage utilities
├── routes/             # API routes
│   ├── auth.js         # Authentication routes
│   ├── users.js        # User management
│   ├── tracks.js       # Track operations
│   ├── social.js       # Social features
│   └── library.js      # Library management
├── workers/            # Background workers
│   └── render-worker.js # Audio rendering worker
├── scripts/            # Database scripts
│   └── migrate.js      # Database migration
├── public/             # Frontend assets
│   ├── Engine.ts       # Unified audio engine
│   └── index.html      # Main interface
└── server/             # Server entry point
    └── index.js        # Main server file
```

### Running Tests
```bash
# Run database migrations
npm run db:migrate

# Seed test data (if available)
npm run db:seed
```

### Development Workflow
1. Start PostgreSQL and Redis
2. Run database migrations
3. Start the main server: `npm run dev`
4. Start the render worker: `node workers/render-worker.js`
5. Access the application at `http://localhost:3000`

## Deployment

### Production Setup
1. Set `NODE_ENV=production`
2. Configure production database and Redis
3. Set up S3-compatible storage
4. Configure SSL/TLS certificates
5. Set up monitoring and logging
6. Use PM2 or similar for process management

### Docker Deployment
```bash
# Build the image
docker build -t astradio .

# Run with environment variables
docker run -p 3000:3000 --env-file .env astradio
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue on GitHub
- Contact: support@astradio.io

## Roadmap

### Phase 1 (Current)
- ✅ User authentication and profiles
- ✅ Track rendering and storage
- ✅ Basic social features
- ✅ Library management

### Phase 2 (Planned)
- Advanced audio engine features
- Mobile app development
- Real-time collaboration
- Advanced chart analysis

### Phase 3 (Future)
- AI-powered composition suggestions
- Integration with music streaming platforms
- Advanced social features
- Enterprise features
