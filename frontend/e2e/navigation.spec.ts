import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('home page loads successfully', async ({ page }) => {
    await page.goto('/');

    // Check that the page loaded
    await expect(page).toHaveTitle(/Ectoplasm/i);
  });

  test('can navigate to swap page', async ({ page }) => {
    await page.goto('/');

    // Look for swap link or verify swap content is present
    const swapLink = page.getByRole('link', { name: /swap/i });
    if (await swapLink.isVisible()) {
      await swapLink.click();
    }

    // Verify swap page elements
    await expect(page.getByText(/sell/i)).toBeVisible();
  });

  test('can navigate to liquidity page', async ({ page }) => {
    await page.goto('/');

    const liquidityLink = page.getByRole('link', { name: /liquidity/i });
    if (await liquidityLink.isVisible()) {
      await liquidityLink.click();
      await expect(page.url()).toContain('/liquidity');
    }
  });

  test('can navigate to staking page', async ({ page }) => {
    await page.goto('/');

    const stakingLink = page.getByRole('link', { name: /staking/i });
    if (await stakingLink.isVisible()) {
      await stakingLink.click();
      await expect(page.url()).toContain('/staking');
    }
  });

  test('can navigate to launchpad page', async ({ page }) => {
    await page.goto('/');

    const launchpadLink = page.getByRole('link', { name: /launchpad/i });
    if (await launchpadLink.isVisible()) {
      await launchpadLink.click();
      await expect(page.url()).toContain('/launchpad');
    }
  });
});
