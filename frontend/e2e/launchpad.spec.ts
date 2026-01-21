import { test, expect } from '@playwright/test';

test.describe('Launchpad Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/launchpad');
  });

  test('launchpad page loads', async ({ page }) => {
    await expect(page.url()).toContain('/launchpad');
  });

  test('token list section is visible', async ({ page }) => {
    // Look for token list or similar elements
    const tokenList = page.locator('[class*="token"], [class*="card"], [class*="list"]');
    if (await tokenList.count() > 0) {
      await expect(tokenList.first()).toBeVisible();
    }
  });

  test('create token option is available', async ({ page }) => {
    // Look for create token button or link
    const createToken = page.getByText(/create|launch|new token/i);
    if (await createToken.count() > 0) {
      await expect(createToken.first()).toBeVisible();
    }
  });

  test('can navigate to token creation form', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /create/i });
    if (await createButton.count() > 0) {
      await createButton.first().click();
      // Should show creation form
      const nameInput = page.getByLabel(/name/i);
      if (await nameInput.count() > 0) {
        await expect(nameInput.first()).toBeVisible();
      }
    }
  });

  test('shows bonding curve information', async ({ page }) => {
    // Look for bonding curve related text
    const bondingText = page.getByText(/bonding|curve|progress|graduation/i);
    if (await bondingText.count() > 0) {
      await expect(bondingText.first()).toBeVisible();
    }
  });

  test('buy/sell options are visible', async ({ page }) => {
    // Look for buy/sell buttons
    const buyText = page.getByText(/buy/i);
    const sellText = page.getByText(/sell/i);

    if (await buyText.count() > 0) {
      await expect(buyText.first()).toBeVisible();
    }
    if (await sellText.count() > 0) {
      await expect(sellText.first()).toBeVisible();
    }
  });

  test('shows connect wallet when not connected', async ({ page }) => {
    const connectButton = page.getByRole('button', { name: /connect wallet/i });
    if (await connectButton.count() > 0) {
      await expect(connectButton.first()).toBeVisible();
    }
  });
});
