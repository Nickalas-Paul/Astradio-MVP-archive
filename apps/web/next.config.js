/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  productionBrowserSourceMaps: true,
  experimental: {
    // Allow importing shared server-only code (e.g. vnext/*) from outside apps/web.
    externalDir: true,
    // Bundle compiled vnext + lib for in-process API routes on Vercel.
    outputFileTracingIncludes: {
      '/api/compat/matches': [
        '../../dist/vnext/vnext/**/*',
        '../../lib/**/*',
      ],
      '/api/version': ['../../dist/vnext/vnext/deploy-meta.js'],
    },
  },
  // Proxy API requests to backend (Render or local). Build-time env sets destination.
  // API/chart are handled by Next route handlers (app/api/*/route.ts) which proxy to API_BASE_URL.
  // No rewrites needed; same-origin client calls avoid CORS.
  async rewrites() {
    return [];
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
  // Vercel uses its own output; standalone is for self-hosted only.
  // Optimize bundle splitting and externalize server-only deps.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    } else {
      const externals = config.externals ?? [];
      config.externals = Array.isArray(externals) ? externals : [externals];

      config.externals.push(({ request }, callback) => {
        if (request === 'pg') {
          return callback(null, 'commonjs pg');
        }
        // tzlookup reads binary data via __dirname; bundling breaks path to node_modules/tzlookup/data.
        if (request === 'tzlookup') {
          return callback(null, 'commonjs tzlookup');
        }
        // vnext/compat imports these from outside apps/web; externalize so resolution uses apps/web/node_modules.
        if (request === 'moment-timezone') {
          return callback(null, 'commonjs moment-timezone');
        }
        if (request === 'moment') {
          return callback(null, 'commonjs moment');
        }
        callback();
      });
    }
    return config;
  },
};

module.exports = nextConfig;
