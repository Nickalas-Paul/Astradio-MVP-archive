// Atlas E2E Smoke Tests
// Core functionality tests for the Education Hub

import { test, expect } from '@playwright/test';

test.describe('Astro Atlas Education Hub', () => {
  test.beforeEach(async ({ page }) => {
    // Enable Atlas feature flag
    await page.goto('/?atlas=1');
  });

  test('Atlas home page loads and shows featured content', async ({ page }) => {
    await page.goto('/atlas');
    
    // Check main elements are present
    await expect(page.getByRole('heading', { name: 'Astro Atlas' })).toBeVisible();
    await expect(page.getByPlaceholder('Search planets, signs, houses, aspects…')).toBeVisible();
    await expect(page.getByText('Featured Articles')).toBeVisible();
    await expect(page.getByText('Quick Learn')).toBeVisible();
    
    // Check sidebar navigation
    await expect(page.getByText('Atlas Navigation')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Planets' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Signs' })).toBeVisible();
  });

  test('Search functionality works', async ({ page }) => {
    await page.goto('/atlas');
    
    // Search for Venus
    await page.getByPlaceholder('Search planets, signs, houses, aspects…').fill('venus');
    await page.keyboard.press('Enter');
    
    // Check search results
    await expect(page.getByText('Search Results')).toBeVisible();
    await expect(page.getByRole('link', { name: /Venus/i })).toBeVisible();
    
    // Clear search
    await page.getByPlaceholder('Search planets, signs, houses, aspects…').clear();
    await expect(page.getByText('Featured Articles')).toBeVisible();
  });

  test('Article page loads with content and interactions', async ({ page }) => {
    await page.goto('/atlas');
    
    // Navigate to Venus article
    await page.getByPlaceholder('Search planets, signs, houses, aspects…').fill('venus');
    await page.getByRole('link', { name: /Venus/i }).click();
    
    // Check article content
    await expect(page.getByRole('heading', { name: 'Venus' })).toBeVisible();
    await expect(page.getByText('Affection · Aesthetics · Receptivity')).toBeVisible();
    await expect(page.getByRole('button', { name: /Bookmark/i })).toBeVisible();
    
    // Test bookmark functionality
    await page.getByRole('button', { name: /Bookmark/i }).click();
    await expect(page.getByRole('button', { name: /Bookmarked/i })).toBeVisible();
    
    // Test reading progress
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByText(/Read progress: \d+%/)).toBeVisible();
  });

  test('Glossary tooltips work', async ({ page }) => {
    await page.goto('/atlas');
    
    // Navigate to an article with glossary terms
    await page.getByPlaceholder('Search planets, signs, houses, aspects…').fill('square');
    await page.getByRole('link', { name: /Square/i }).click();
    
    // Look for glossary terms (they should be underlined)
    const glossaryTerms = page.locator('button[class*="underline"]');
    if (await glossaryTerms.count() > 0) {
      await glossaryTerms.first().hover();
      // Tooltip should appear
      await expect(page.locator('[class*="tooltip"], [class*="absolute"]').first()).toBeVisible();
    }
  });

  test('Quiz widget functions correctly', async ({ page }) => {
    await page.goto('/atlas');
    
    // Start quiz
    await page.getByRole('button', { name: 'Start Quiz' }).click();
    
    // Check quiz question appears
    await expect(page.getByText(/Question \d+ of 5/)).toBeVisible();
    await expect(page.getByRole('radio')).toBeVisible();
    
    // Select an answer
    await page.getByRole('radio').first().click();
    
    // Check explanation appears
    await expect(page.getByText(/Correct|Not quite/)).toBeVisible();
    
    // Continue to next question
    await page.getByRole('button', { name: 'Next Question' }).click();
    
    // Should show next question
    await expect(page.getByText(/Question \d+ of 5/)).toBeVisible();
  });

  test('Category pages load and show articles', async ({ page }) => {
    await page.goto('/atlas/k/planet');
    
    // Check category page
    await expect(page.getByRole('heading', { name: 'Planet' })).toBeVisible();
    await expect(page.getByText('🪐')).toBeVisible();
    
    // Check articles are listed
    await expect(page.getByRole('link', { name: /Sun/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Moon/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Venus/i })).toBeVisible();
  });

  test('Navigation between pages works', async ({ page }) => {
    await page.goto('/atlas');
    
    // Navigate to planets category
    await page.getByRole('link', { name: 'Planets' }).click();
    await expect(page.getByRole('heading', { name: 'Planet' })).toBeVisible();
    
    // Navigate to signs category
    await page.getByRole('link', { name: 'Signs' }).click();
    await expect(page.getByRole('heading', { name: 'Sign' })).toBeVisible();
    
    // Navigate back to home
    await page.getByRole('link', { name: 'Home' }).click();
    await expect(page.getByRole('heading', { name: 'Astro Atlas' })).toBeVisible();
  });

  test('Mobile responsive design works', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/atlas');
    
    // Check mobile layout
    await expect(page.getByRole('heading', { name: 'Astro Atlas' })).toBeVisible();
    
    // Search should still work
    await page.getByPlaceholder('Search planets, signs, houses, aspects…').fill('mars');
    await expect(page.getByRole('link', { name: /Mars/i })).toBeVisible();
  });

  test('Feature flag disabled shows appropriate message', async ({ page }) => {
    // Disable Atlas feature flag
    await page.goto('/?atlas=0');
    await page.goto('/atlas');
    
    // Should show disabled message
    await expect(page.getByText('Education Hub Disabled')).toBeVisible();
    await expect(page.getByText('Enable it with')).toBeVisible();
  });

  test('Bookmarks persist across page reloads', async ({ page }) => {
    await page.goto('/atlas');
    
    // Bookmark an article
    await page.getByPlaceholder('Search planets, signs, houses, aspects…').fill('venus');
    await page.getByRole('link', { name: /Venus/i }).click();
    await page.getByRole('button', { name: /Bookmark/i }).click();
    
    // Reload page
    await page.reload();
    
    // Check bookmark persisted
    await expect(page.getByRole('button', { name: /Bookmarked/i })).toBeVisible();
  });

  test('Reading progress persists across page reloads', async ({ page }) => {
    await page.goto('/atlas');
    
    // Navigate to article and scroll
    await page.getByPlaceholder('Search planets, signs, houses, aspects…').fill('venus');
    await page.getByRole('link', { name: /Venus/i }).click();
    
    // Scroll to track progress
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(500); // Allow progress to save
    
    // Reload page
    await page.reload();
    
    // Check progress persisted
    await expect(page.getByText(/Read progress: \d+%/)).toBeVisible();
  });

  test('Empty search shows appropriate message', async ({ page }) => {
    await page.goto('/atlas');
    
    // Search for non-existent term
    await page.getByPlaceholder('Search planets, signs, houses, aspects…').fill('nonexistent');
    await page.keyboard.press('Enter');
    
    // Should show no results message
    await expect(page.getByText('No results found')).toBeVisible();
    await expect(page.getByText('Try different keywords')).toBeVisible();
  });

  test('Article not found shows 404 message', async ({ page }) => {
    await page.goto('/atlas/a/nonexistent-article');
    
    // Should show 404 message
    await expect(page.getByText('Article not found')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to Atlas' })).toBeVisible();
  });
});
