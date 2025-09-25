# Phase-4 TODOs (Post D-Series)

## Type Safety Improvements
- [ ] **Refactor `req.user` type**: Replace `any` with proper User interface in `routes/types.ts`
- [ ] **Lib module types**: Add proper TypeScript declarations for `lib/authentication`, `lib/database`, etc.
- [ ] **Request/Response types**: Enhance Express type extensions with specific payload types

## Code Quality
- [ ] **ES6 imports**: Migrate from `require()` to proper ES6 imports once lib modules are typed
- [ ] **Interface definitions**: Add comprehensive interfaces for all data models
- [ ] **Error handling**: Standardize error response types across all routes

## Performance & Monitoring
- [ ] **Type-safe logging**: Replace console.log with typed logger interface
- [ ] **Metrics collection**: Add typed metrics interfaces for D-series training monitoring
- [ ] **API documentation**: Generate OpenAPI specs from TypeScript interfaces

---
*Note: These improvements are deferred until after D-series engine uplift to maintain focus on ML pipeline optimization.*
