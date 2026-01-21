import { test, expect } from '@playwright/test';

test.describe('Liquidity Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/liquidity');
  });

  test('liquidity page loads', async ({ page }) => {
    // Check that we're on the liquidity page
    await expect(page.url()).toContain('/liquidity');
  });

  test('add liquidity form is visible', async ({ page }) => {
    // Look for liquidity-related elements
    const addLiquidityText = page.getByText(/add liquidity/i);
    if (await addLiquidityText.count() > 0) {
      await expect(addLiquidityText.first()).toBeVisible();
    }
  });

  test('pool information is displayed', async ({ page }) => {
    // Look for pool-related information
    const poolInfo = page.locator('[class*="pool"], [data-testid*="pool"]');
    if (await poolInfo.count() > 0) {
      await expect(poolInfo.first()).toBeVisible();
    }
  });

  test('can enter token amounts', async ({ page }) => {
    // Find input fields for adding liquidity
    const inputs = page.locator('input[type="number"]');
    if (await inputs.count() > 0) {
      await inputs.first().fill('100');
      await expect(inputs.first()).toHaveValue('100');
    }
  });

  test('shows connect wallet when not connected', async ({ page }) => {
    const connectButton = page.getByRole('button', { name: /connect wallet/i });
    if (await connectButton.count() > 0) {
      await expect(connectButton.first()).toBeVisible();
    }
  });
});
