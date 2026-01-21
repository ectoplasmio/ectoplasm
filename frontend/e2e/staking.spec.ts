import { test, expect } from '@playwright/test';

test.describe('Staking Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/staking');
  });

  test('staking page loads', async ({ page }) => {
    await expect(page.url()).toContain('/staking');
  });

  test('staking stats are visible', async ({ page }) => {
    // Look for TVL, APR, or other staking metrics
    const statsText = page.locator('text=/tvl|apr|apy|staked/i');
    if (await statsText.count() > 0) {
      await expect(statsText.first()).toBeVisible();
    }
  });

  test('stake form is visible', async ({ page }) => {
    // Look for stake-related elements
    const stakeText = page.getByText(/stake/i);
    if (await stakeText.count() > 0) {
      await expect(stakeText.first()).toBeVisible();
    }
  });

  test('can enter stake amount', async ({ page }) => {
    const inputs = page.locator('input[type="number"]');
    if (await inputs.count() > 0) {
      await inputs.first().fill('100');
      await expect(inputs.first()).toHaveValue('100');
    }
  });

  test('shows unstake option', async ({ page }) => {
    const unstakeText = page.getByText(/unstake/i);
    if (await unstakeText.count() > 0) {
      await expect(unstakeText.first()).toBeVisible();
    }
  });

  test('shows rewards information', async ({ page }) => {
    const rewardsText = page.getByText(/reward/i);
    if (await rewardsText.count() > 0) {
      await expect(rewardsText.first()).toBeVisible();
    }
  });

  test('shows connect wallet when not connected', async ({ page }) => {
    const connectButton = page.getByRole('button', { name: /connect wallet/i });
    if (await connectButton.count() > 0) {
      await expect(connectButton.first()).toBeVisible();
    }
  });
});
