import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SwapCard } from './SwapCard';

// Mock the hooks and contexts
const mockExecuteSwap = vi.fn();
const mockSetTokenIn = vi.fn();
const mockSetTokenOut = vi.fn();
const mockSetAmountIn = vi.fn();
const mockSetSlippage = vi.fn();
const mockSwitchTokens = vi.fn();

vi.mock('../../hooks/useSwap', () => ({
  useSwap: () => ({
    tokenIn: 'ECTO',
    tokenOut: 'USDC',
    amountIn: '',
    amountOut: '',
    slippage: '0.5',
    quote: null,
    loading: false,
    quoting: false,
    error: null,
    setTokenIn: mockSetTokenIn,
    setTokenOut: mockSetTokenOut,
    setAmountIn: mockSetAmountIn,
    setSlippage: mockSetSlippage,
    switchTokens: mockSwitchTokens,
    executeSwap: mockExecuteSwap,
    refreshQuote: vi.fn(),
  }),
}));

vi.mock('../../contexts/WalletContext', () => ({
  useWallet: () => ({
    connected: true,
    balances: {
      ECTO: { formatted: '1000', raw: BigInt('1000000000000') },
      USDC: { formatted: '500', raw: BigInt('500000000') },
    },
    refreshBalances: vi.fn(),
  }),
}));

vi.mock('@mysten/dapp-kit', () => ({
  useCurrentAccount: () => ({
    address: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  }),
  ConnectButton: ({ connectText }: { connectText: string }) => (
    <button>{connectText}</button>
  ),
}));

vi.mock('../../config/sui', () => ({
  SUI_CONFIG: {
    tokens: {
      ECTO: { symbol: 'ECTO', decimals: 9 },
      USDC: { symbol: 'USDC', decimals: 6 },
    },
  },
}));

describe('SwapCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders swap form correctly', () => {
    render(<SwapCard />);

    // Check for input fields
    expect(screen.getByLabelText('Sell amount')).toBeInTheDocument();
    expect(screen.getByLabelText('Buy amount')).toBeInTheDocument();

    // Check for form structure (use getAllByText since 'Sell' appears in tab and label)
    const sellLabels = screen.getAllByText('Sell');
    expect(sellLabels.length).toBeGreaterThan(0);
  });

  it('renders order type tabs', () => {
    render(<SwapCard />);

    expect(screen.getByRole('tab', { name: 'Swap' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Limit' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Buy' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Sell' })).toBeInTheDocument();
  });

  it('shows balance for sell token', () => {
    render(<SwapCard />);

    expect(screen.getByText(/Balance: 1000/)).toBeInTheDocument();
  });

  it('handles amount input change', async () => {
    const user = userEvent.setup();
    render(<SwapCard />);

    const input = screen.getByLabelText('Sell amount');
    await user.type(input, '100');

    expect(mockSetAmountIn).toHaveBeenCalled();
  });

  it('handles token selection change', async () => {
    const user = userEvent.setup();
    render(<SwapCard />);

    const sellSelect = screen.getByLabelText('Sell token');
    await user.selectOptions(sellSelect, 'USDC');

    expect(mockSetTokenIn).toHaveBeenCalledWith('USDC');
  });

  it('handles switch tokens button click', async () => {
    const user = userEvent.setup();
    render(<SwapCard />);

    const switchButton = screen.getByLabelText('Reverse tokens and amounts');
    await user.click(switchButton);

    expect(mockSwitchTokens).toHaveBeenCalled();
  });

  it('opens settings popout', async () => {
    const user = userEvent.setup();
    render(<SwapCard />);

    const settingsButton = screen.getByRole('button', { name: /open swap settings/i });
    await user.click(settingsButton);

    // The popout should now be visible (not hidden)
    const settingsPopout = document.getElementById('settingsPopout');
    expect(settingsPopout).not.toHaveAttribute('hidden');
    expect(screen.getByText('Slippage tolerance')).toBeInTheDocument();
  });

  it('handles slippage selection in settings', async () => {
    const user = userEvent.setup();
    render(<SwapCard />);

    // Open settings
    const settingsButton = screen.getByRole('button', { name: /open swap settings/i });
    await user.click(settingsButton);

    // Click 1% slippage button
    const slippageButton = screen.getByRole('button', { name: '1%' });
    await user.click(slippageButton);

    expect(mockSetSlippage).toHaveBeenCalledWith('1');
  });

  it('opens trade details popout', async () => {
    const user = userEvent.setup();
    render(<SwapCard />);

    const detailsButton = screen.getByRole('button', { name: /open trade details/i });
    await user.click(detailsButton);

    // The popout should now be visible
    const detailsPopout = document.getElementById('detailsPopout');
    expect(detailsPopout).not.toHaveAttribute('hidden');
  });

  it('opens network popout', async () => {
    const user = userEvent.setup();
    render(<SwapCard />);

    const networkButton = screen.getByRole('button', { name: /open network/i });
    await user.click(networkButton);

    // The popout should now be visible
    const networkPopout = document.getElementById('networkPopout');
    expect(networkPopout).not.toHaveAttribute('hidden');
    // SUI Testnet appears in multiple places, so just check the popout is visible
    expect(screen.getAllByText('SUI Testnet').length).toBeGreaterThan(0);
  });

  it('shows swap button when connected', () => {
    render(<SwapCard />);

    // Get the submit button (not the tab)
    const submitButton = screen.getByRole('button', { name: 'Swap' });
    expect(submitButton).toBeInTheDocument();
    expect(submitButton).toHaveAttribute('type', 'submit');
  });

  it('shows rate as -- when no quote', () => {
    render(<SwapCard />);

    // There should be a '--' in the rate display
    const rateDisplay = document.getElementById('rateDisplay');
    expect(rateDisplay?.textContent).toBe('--');
  });

  it('shows wallet connected status in network popout', async () => {
    const user = userEvent.setup();
    render(<SwapCard />);

    const networkButton = screen.getByRole('button', { name: /open network/i });
    await user.click(networkButton);

    expect(screen.getByText('Wallet connected')).toBeInTheDocument();
  });

  it('closes popout when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<SwapCard />);

    // Open settings
    const settingsButton = screen.getByRole('button', { name: /open swap settings/i });
    await user.click(settingsButton);

    // Verify it's open
    const settingsPopout = document.getElementById('settingsPopout');
    expect(settingsPopout).not.toHaveAttribute('hidden');

    // Close settings
    const closeButton = screen.getByRole('button', { name: /close settings/i });
    await user.click(closeButton);

    // Verify it's closed
    expect(settingsPopout).toHaveAttribute('hidden');
  });

  it('only shows one popout at a time', async () => {
    const user = userEvent.setup();
    render(<SwapCard />);

    // Open settings
    const settingsButton = screen.getByRole('button', { name: /open swap settings/i });
    await user.click(settingsButton);

    // Open network (should close settings)
    const networkButton = screen.getByRole('button', { name: /open network/i });
    await user.click(networkButton);

    // Settings should be closed, network should be open
    const settingsPopout = document.getElementById('settingsPopout');
    const networkPopout = document.getElementById('networkPopout');

    expect(settingsPopout).toHaveAttribute('hidden');
    expect(networkPopout).not.toHaveAttribute('hidden');
  });
});
