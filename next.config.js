/** @type {import('next').NextConfig} */
const nextConfig = {
  // Proxy API requests to backend (Render or local). Build-time env sets destination.
  async rewrites() {
    const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || '')
      .replace(/\/$/, '');
    const apiDest = apiBase || 'http://localhost:3000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiDest}/api/:path*`,
      },
      {
        source: '/chart',
        destination: `${apiDest}/chart`,
      },
    ];
  },
  // Serve static files from public directory
  async headers() {
    return [
      {
        source: '/public/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.FRONTEND_URL || 'http://localhost:3001',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
          {
            key: 'Access-Control-Max-Age',
            value: '86400',
          },
        ],
      },
    ];
  },
  // Enable static exports for deployment
  output: 'standalone',
  // Optimize bundle splitting
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
