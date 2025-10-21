// E2E Smoke Tests - Verify non-breaking integration
// Ensures UI never blocks engine operations and maintains proper state

import { test, expect } from '@playwright/test';

test.describe('Astradio E2E Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Enable mock mode for consistent testing
    await page.goto('/?mock=1');
  });

  test('Generate flow never blocks previous playback', async ({ page }) => {
    // Navigate to landing page
    await page.goto('/?mock=1');
    
    // Wait for page to load
    await expect(page.getByText('Your Cosmic Soundtrack')).toBeVisible();
    
    // Start a composition generation
    await page.getByRole('button', { name: /generate today/i }).click();
    
    // Verify generation is in progress
    await expect(page.getByText(/preparing|generating|mixing/i)).toBeVisible();
    
    // Verify previous player remains usable (if any)
    const playButton = page.getByRole('button', { name: /play/i }).first();
    if (await playButton.isVisible()) {
      await playButton.click();
      await expect(page.getByRole('button', { name: /pause/i })).toBeVisible();
    }
  });

  test('Feature flags work correctly', async ({ page }) => {
    // Test trending feature flag
    await page.goto('/library?trending=1');
    await expect(page.getByText('Trending Now')).toBeVisible();
    
    // Test compatibility feature flag
    await page.goto('/overlay?compat=1');
    await expect(page.getByText('Compatibility Matches')).toBeVisible();
    
    // Test social feature flag
    await page.goto('/library?social=1');
    await expect(page.getByText('Activity Feed')).toBeVisible();
  });

  test('Mock adapter provides consistent responses', async ({ page }) => {
    await page.goto('/?mock=1');
    
    // Start generation
    await page.getByRole('button', { name: /generate today/i }).click();
    
    // Should see progression through stages
    await expect(page.getByText(/preparing/i)).toBeVisible();
    await expect(page.getByText(/generating/i)).toBeVisible();
    await expect(page.getByText(/mixing/i)).toBeVisible();
    
    // Should eventually complete
    await expect(page.getByText(/ready/i)).toBeVisible({ timeout: 10000 });
  });

  test('Timeline clamping works correctly', async ({ page }) => {
    await page.goto('/?mock=1');
    
    // Start generation and wait for completion
    await page.getByRole('button', { name: /generate today/i }).click();
    await expect(page.getByText(/ready/i)).toBeVisible({ timeout: 10000 });
    
    // Check that timeline shows 60 seconds max
    const timeDisplay = page.getByText(/00:60/);
    await expect(timeDisplay).toBeVisible();
  });

  test('Error handling is graceful', async ({ page }) => {
    // Test with invalid parameters to trigger error
    await page.goto('/?mock=1&forceError=1');
    
    // Should show error state without breaking UI
    await expect(page.getByText(/error/i)).toBeVisible();
    
    // UI should remain functional
    await expect(page.getByRole('button', { name: /generate/i })).toBeVisible();
  });

  test('Telemetry works without blocking UI', async ({ page }) => {
    await page.goto('/?mock=1');
    
    // Perform actions that should trigger telemetry
    await page.getByRole('button', { name: /generate today/i }).click();
    
    // UI should remain responsive
    await expect(page.getByText(/preparing|generating|mixing/i)).toBeVisible();
    
    // Check console for telemetry events (non-blocking)
    const logs = [];
    page.on('console', msg => {
      if (msg.text().includes('telemetry')) {
        logs.push(msg.text());
      }
    });
    
    // Wait a bit for telemetry to be sent
    await page.waitForTimeout(2000);
    
    // Telemetry should not block UI operations
    await expect(page.getByRole('button', { name: /generate/i })).toBeVisible();
  });

  test('Navigation preserves state correctly', async ({ page }) => {
    await page.goto('/?mock=1');
    
    // Start generation
    await page.getByRole('button', { name: /generate today/i }).click();
    await expect(page.getByText(/preparing/i)).toBeVisible();
    
    // Navigate to different page
    await page.goto('/library');
    
    // Should not break navigation
    await expect(page.getByText('Library')).toBeVisible();
    
    // Navigate back
    await page.goto('/?mock=1');
    
    // Should still be functional
    await expect(page.getByRole('button', { name: /generate/i })).toBeVisible();
  });

  test('Keyboard shortcuts work during generation', async ({ page }) => {
    await page.goto('/?mock=1');
    
    // Start generation
    await page.getByRole('button', { name: /generate today/i }).click();
    
    // Test keyboard shortcuts still work
    await page.keyboard.press('Space'); // Should not break
    await page.keyboard.press('ArrowLeft'); // Should not break
    await page.keyboard.press('ArrowRight'); // Should not break
    
    // UI should remain responsive
    await expect(page.getByText(/preparing|generating|mixing/i)).toBeVisible();
  });

  test('Multiple rapid generations handled gracefully', async ({ page }) => {
    await page.goto('/?mock=1');
    
    // Start multiple generations rapidly
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: /generate today/i }).click();
      await page.waitForTimeout(100); // Small delay
    }
    
    // Should handle gracefully without breaking
    await expect(page.getByText(/preparing|generating|mixing/i)).toBeVisible();
  });

  test('Feature flag toggles work without state loss', async ({ page }) => {
    // Start with features disabled
    await page.goto('/library');
    
    // Should show empty states
    await expect(page.getByText('Nothing saved yet')).toBeVisible();
    
    // Enable features via URL
    await page.goto('/library?trending=1&social=1');
    
    // Should show feature sections
    await expect(page.getByText('Trending Now')).toBeVisible();
    await expect(page.getByText('Activity Feed')).toBeVisible();
    
    // Disable features
    await page.goto('/library');
    
    // Should return to empty states gracefully
    await expect(page.getByText('Nothing saved yet')).toBeVisible();
  });
});
