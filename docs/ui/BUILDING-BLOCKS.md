# Building Blocks Guide

## How to Add New Screens

### 1. Create Route File
```typescript
// app/new-page/page.tsx
'use client';

import { AppShell } from '../../src/components/AppShell';

export default function NewPage() {
  return (
    <AppShell>
      <div className="grid gap-6 md:grid-cols-12">
        <div className="md:col-span-7">
          {/* Left column content */}
        </div>
        <div className="md:col-span-5">
          {/* Right column content */}
        </div>
      </div>
    </AppShell>
  );
}
```

### 2. Use Design Tokens
```typescript
// ✅ Good - uses tokens
<div className="bg-surface-1 border border-border rounded-xl p-6">
  <h2 className="text-text-primary font-semibold">Title</h2>
  <p className="text-text-secondary">Description</p>
</div>

// ❌ Bad - hardcoded values
<div className="bg-gray-800 border border-gray-600 rounded-lg p-6">
  <h2 className="text-white font-semibold">Title</h2>
  <p className="text-gray-400">Description</p>
</div>
```

### 3. Component Structure
```typescript
// Standard component structure
export function MyComponent({ className = '' }: MyComponentProps) {
  return (
    <section className={`bg-surface-1 border border-border rounded-xl p-6 ${className}`}>
      {/* Component content */}
    </section>
  );
}
```

### 4. State Management
```typescript
// Use existing stores
import { useUIStore, usePlayerStore } from '../store';

export function MyComponent() {
  const { addToast } = useUIStore();
  const { currentTrack } = usePlayerStore();
  
  // Component logic
}
```

### 5. Error Handling
```typescript
// Always handle errors gracefully
try {
  await someAsyncOperation();
  addToast({
    type: 'success',
    title: 'Success',
    message: 'Operation completed'
  });
} catch (error) {
  addToast({
    type: 'error',
    title: 'Error',
    message: error instanceof Error ? error.message : 'Unknown error'
  });
}
```

### 6. Accessibility
```typescript
// Include proper ARIA labels and keyboard support
<button
  onClick={handleClick}
  className="px-4 py-2 bg-emerald text-bg rounded-pill focus:outline-none focus:ring-2 focus:ring-ring"
  aria-label="Generate composition"
>
  Generate
</button>
```

### 7. Responsive Design
```typescript
// Use responsive grid system
<div className="grid gap-6 md:grid-cols-12">
  <div className="md:col-span-7">
    {/* Main content */}
  </div>
  <div className="md:col-span-5">
    {/* Sidebar content */}
  </div>
</div>
```

### 8. Loading States
```typescript
// Always show loading states
{isLoading ? (
  <div className="flex items-center justify-center p-8">
    <div className="w-6 h-6 border-2 border-emerald border-t-transparent rounded-full animate-spin" />
  </div>
) : (
  <div>
    {/* Content */}
  </div>
)}
```

### 9. Empty States
```typescript
// Provide helpful empty states
{items.length === 0 ? (
  <div className="text-center p-8">
    <p className="text-text-secondary mb-4">No items found</p>
    <button className="px-4 py-2 bg-emerald text-bg rounded-pill">
      Add Item
    </button>
  </div>
) : (
  <div>
    {/* Items list */}
  </div>
)}
```

### 10. Testing
```typescript
// Test with deterministic data
const mockData = {
  id: 'test-123',
  title: 'Test Composition',
  // ... other properties
};
```

## Common Patterns

### Modal/Dialog
```typescript
<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
  <div className="bg-surface-2 border border-border rounded-xl p-6 max-w-md w-full mx-4">
    {/* Modal content */}
  </div>
</div>
```

### Form Input
```typescript
<input
  type="text"
  className="w-full rounded-md bg-surface-0 border border-border px-3 py-2 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-ring/60 transition duration-fast ease-aurora"
  placeholder="Enter value"
/>
```

### Progress Bar
```typescript
<div className="w-full bg-surface-2 rounded-pill h-2">
  <div
    className="bg-indigo h-2 rounded-pill transition-all duration-300"
    style={{ width: `${progress}%` }}
  />
</div>
```

### Toast Notification
```typescript
// Use the existing toast system
addToast({
  type: 'success', // 'success' | 'error' | 'warning' | 'info'
  title: 'Success',
  message: 'Operation completed successfully'
});
```
