# Astradio UI Style Guide

## Aurora Dark Theme

### Design Tokens
- **Background**: Deep space blue (#07090B)
- **Surfaces**: Layered grays (surface-0 to surface-3)
- **Text**: High contrast whites and grays
- **Accents**: Emerald, teal, indigo, violet, purple, blue
- **Borders**: Subtle dark borders (#1E2A36)

### Component Recipes

#### Cards
```html
<section class="bg-surface-1/95 border border-border rounded-xl shadow-md p-6">
  <!-- content -->
</section>
```

#### Primary Buttons
```html
<button class="inline-flex items-center gap-2 rounded-pill px-4 py-2 bg-emerald text-bg shadow-glow hover:opacity-95 active:opacity-90 transition duration-fast ease-aurora focus:outline-none focus:ring-2 focus:ring-ring">
  Generate
</button>
```

#### Inputs
```html
<input class="w-full rounded-md bg-surface-0 border border-border px-3 py-2 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-ring/60 transition duration-fast ease-aurora" placeholder="Location">
```

#### Tabs
```html
<div class="flex gap-1 bg-surface-0 p-1 rounded-pill border border-border">
  <button class="px-3 py-1.5 rounded-pill bg-surface-2 text-text-primary">Natal</button>
  <button class="px-3 py-1.5 rounded-pill text-text-secondary hover:text-text-primary">Overlay</button>
</div>
```

### Motion Rules
- **Fast**: 120ms for micro-interactions
- **Base**: 160ms for standard transitions
- **Slow**: 200ms for complex animations
- **Easing**: cubic-bezier(0.2, 0.8, 0.2, 1)

### Accessibility
- **Contrast**: AA+ (4.5:1 minimum)
- **Focus**: 2px ring with ring color
- **Motion**: Respects prefers-reduced-motion
- **Keyboard**: Full navigation support

### Do's and Don'ts

#### ✅ Do
- Use semantic color tokens (text-primary, surface-1, etc.)
- Apply consistent spacing and border radius
- Use glow effects sparingly on primary CTAs
- Maintain consistent motion timing
- Test with reduced motion enabled

#### ❌ Don't
- Use inline styles or hardcoded colors
- Mix different border radius values
- Overuse glow effects
- Ignore accessibility requirements
- Use spring physics for UI animations

### Examples

#### App Shell
```html
<div class="min-h-screen bg-bg text-text-primary">
  <header class="sticky top-0 z-40 backdrop-blur bg-surface-0/80 border-b border-border">
    <div class="mx-auto max-w-content px-6 py-3 flex items-center justify-between">
      <span class="text-lg tracking-wide">Astradio</span>
    </div>
  </header>
  <main class="mx-auto max-w-content px-6 py-8 grid gap-6 md:grid-cols-12">
    <!-- content -->
  </main>
</div>
```

#### Player Bar
```html
<div class="bg-surface-0/90 backdrop-blur border border-border rounded-xl p-3 flex items-center gap-3 shadow-md">
  <button class="h-10 w-10 rounded-full bg-emerald text-bg shadow-glow">▸</button>
  <div class="flex-1">
    <div class="h-2 bg-surface-2 rounded-pill overflow-hidden">
      <div class="h-full bg-indigo" style="width:32%"></div>
    </div>
    <div class="mt-1 text-xs text-text-muted">01:12 / 01:60</div>
  </div>
</div>
```
