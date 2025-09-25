// routes/types.ts
// Shared type definitions for route modules

// Extend Request interface to include user property
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// Re-export for convenience
export {};
