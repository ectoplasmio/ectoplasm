import { test, expect } from '@playwright/test';

test.describe('Swap Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('swap form elements are visible', async ({ page }) => {
    // Check for sell/buy labels
    await expect(page.getByText('Sell')).toBeVisible();
    await expect(page.getByText('Buy')).toBeVisible();

    // Check for input fields
    await expect(page.getByLabel(/sell amount/i)).toBeVisible();
    await expect(page.getByLabel(/buy amount/i)).toBeVisible();
  });

  test('can enter swap amount', async ({ page }) => {
    const sellInput = page.getByLabel(/sell amount/i);
    await sellInput.fill('100');

    await expect(sellInput).toHaveValue('100');
  });

  test('can select different tokens', async ({ page }) => {
    // Find and interact with token selector
    const sellTokenSelect = page.getByLabel(/sell token/i);

    if (await sellTokenSelect.isVisible()) {
      await sellTokenSelect.selectOption('USDC');
      await expect(sellTokenSelect).toHaveValue('USDC');
    }
  });

  test('reverse tokens button works', async ({ page }) => {
    const reverseButton = page.getByLabel(/reverse/i);

    if (await reverseButton.isVisible()) {
      // Get initial token values
      const sellSelect = page.getByLabel(/sell token/i);
      const buySelect = page.getByLabel(/buy token/i);

      const initialSellToken = await sellSelect.inputValue();
      const initialBuyToken = await buySelect.inputValue();

      await reverseButton.click();

      // Verify tokens are swapped
      await expect(sellSelect).toHaveValue(initialBuyToken);
      await expect(buySelect).toHaveValue(initialSellToken);
    }
  });

  test('swap tabs are functional', async ({ page }) => {
    const swapTab = page.getByRole('tab', { name: 'Swap' });
    const limitTab = page.getByRole('tab', { name: 'Limit' });

    if (await swapTab.isVisible()) {
      await expect(swapTab).toHaveAttribute('aria-selected', 'true');

      await limitTab.click();
      await expect(limitTab).toHaveAttribute('aria-selected', 'true');
      await expect(swapTab).toHaveAttribute('aria-selected', 'false');
    }
  });

  test('settings popout opens and closes', async ({ page }) => {
    const settingsButton = page.getByLabel(/open swap settings/i);

    if (await settingsButton.isVisible()) {
      await settingsButton.click();

      // Check settings dialog is visible
      await expect(page.getByText('Slippage tolerance')).toBeVisible();

      // Close settings
      const closeButton = page.getByLabel(/close settings/i);
      await closeButton.click();

      // Settings should be hidden
      await expect(page.getByText('Slippage tolerance')).not.toBeVisible();
    }
  });

  test('slippage can be changed', async ({ page }) => {
    const settingsButton = page.getByLabel(/open swap settings/i);

    if (await settingsButton.isVisible()) {
      await settingsButton.click();

      // Click 1% slippage option
      const onePercentButton = page.getByRole('button', { name: '1%' });
      await onePercentButton.click();

      // Verify it's selected (has active class)
      await expect(onePercentButton).toHaveClass(/active/);
    }
  });

  test('trade details popout shows information', async ({ page }) => {
    const detailsButton = page.getByLabel(/open trade details/i);

    if (await detailsButton.isVisible()) {
      await detailsButton.click();

      await expect(page.getByText('Minimum received')).toBeVisible();
      await expect(page.getByText('Route')).toBeVisible();
      await expect(page.getByText('Price impact')).toBeVisible();
    }
  });

  test('network popout shows network info', async ({ page }) => {
    const networkButton = page.getByLabel(/open network/i);

    if (await networkButton.isVisible()) {
      await networkButton.click();

      await expect(page.getByText('SUI Testnet')).toBeVisible();
    }
  });

  test('shows connect wallet button when disconnected', async ({ page }) => {
    // By default, wallet is not connected
    const connectButton = page.getByRole('button', { name: /connect wallet/i });

    // Should show connect button
    await expect(connectButton).toBeVisible();
  });

  test('swap button is disabled without valid input', async ({ page }) => {
    // With empty input, swap button should be disabled
    const swapButton = page.getByRole('button', { name: 'Swap' });

    // Button might not exist if wallet not connected
    if (await swapButton.count() > 0) {
      await expect(swapButton).toBeDisabled();
    }
  });
});
