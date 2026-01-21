import { describe, it, expect } from 'vitest';
import {
  SUI_CONFIG,
  getTokenBySymbol,
  getTokenByCoinType,
  getPoolByPair,
  getExplorerUrl,
  formatAmount,
  parseAmount,
} from './sui';

describe('SUI_CONFIG', () => {
  it('has valid network configurations', () => {
    expect(SUI_CONFIG.networks.testnet).toBeDefined();
    expect(SUI_CONFIG.networks.mainnet).toBeDefined();
    expect(SUI_CONFIG.networks.testnet.url).toContain('testnet');
    expect(SUI_CONFIG.networks.mainnet.url).toContain('mainnet');
  });

  it('has valid token configurations', () => {
    expect(SUI_CONFIG.tokens.SUI).toBeDefined();
    expect(SUI_CONFIG.tokens.ECTO).toBeDefined();
    expect(SUI_CONFIG.tokens.USDC).toBeDefined();

    expect(SUI_CONFIG.tokens.SUI.decimals).toBe(9);
    expect(SUI_CONFIG.tokens.ECTO.decimals).toBe(9);
    expect(SUI_CONFIG.tokens.USDC.decimals).toBe(6);
  });

  it('has valid pool configurations', () => {
    const ectoUsdcPool = SUI_CONFIG.pools['ECTO-USDC'];
    expect(ectoUsdcPool).toBeDefined();
    expect(ectoUsdcPool.poolId).toBeTruthy();
    expect(ectoUsdcPool.coinTypeA).toContain('ECTO');
    expect(ectoUsdcPool.coinTypeB).toContain('USDC');
  });
});

describe('getTokenBySymbol', () => {
  it('returns token config for valid symbol', () => {
    const ecto = getTokenBySymbol('ECTO');
    expect(ecto).toBeDefined();
    expect(ecto?.symbol).toBe('ECTO');
    expect(ecto?.decimals).toBe(9);
  });

  it('returns undefined for invalid symbol', () => {
    const invalid = getTokenBySymbol('INVALID');
    expect(invalid).toBeUndefined();
  });
});

describe('getTokenByCoinType', () => {
  it('returns token config for valid coin type', () => {
    const sui = getTokenByCoinType('0x2::sui::SUI');
    expect(sui).toBeDefined();
    expect(sui?.symbol).toBe('SUI');
  });

  it('returns undefined for invalid coin type', () => {
    const invalid = getTokenByCoinType('0x0::invalid::INVALID');
    expect(invalid).toBeUndefined();
  });
});

describe('getPoolByPair', () => {
  it('returns pool config for valid pair', () => {
    const pool = getPoolByPair('ECTO-USDC');
    expect(pool).toBeDefined();
    expect(pool?.poolId).toBeTruthy();
  });

  it('returns undefined for invalid pair', () => {
    const invalid = getPoolByPair('INVALID-PAIR');
    expect(invalid).toBeUndefined();
  });
});

describe('getExplorerUrl', () => {
  it('generates transaction URL for testnet', () => {
    const url = getExplorerUrl('tx', '0xabc123');
    expect(url).toBe('https://suiscan.xyz/testnet/tx/0xabc123');
  });

  it('generates object URL for testnet', () => {
    const url = getExplorerUrl('object', '0xdef456');
    expect(url).toBe('https://suiscan.xyz/testnet/object/0xdef456');
  });

  it('generates address URL for testnet', () => {
    const url = getExplorerUrl('address', '0xghi789');
    expect(url).toBe('https://suiscan.xyz/testnet/account/0xghi789');
  });

  it('generates URL for mainnet', () => {
    const url = getExplorerUrl('tx', '0xabc123', 'mainnet');
    expect(url).toBe('https://suiscan.xyz/mainnet/tx/0xabc123');
  });
});

describe('formatAmount', () => {
  it('formats bigint with 9 decimals', () => {
    expect(formatAmount(BigInt('1000000000'), 9)).toBe('1');
  });

  it('formats bigint with fractional part', () => {
    expect(formatAmount(BigInt('1500000000'), 9)).toBe('1.5');
  });

  it('formats string input', () => {
    expect(formatAmount('1000000000', 9)).toBe('1');
  });

  it('formats number input', () => {
    expect(formatAmount(1000000000, 9)).toBe('1');
  });

  it('handles 6 decimals (USDC)', () => {
    expect(formatAmount(BigInt('1000000'), 6)).toBe('1');
    expect(formatAmount(BigInt('1500000'), 6)).toBe('1.5');
  });

  it('removes trailing zeros from fractional part', () => {
    expect(formatAmount(BigInt('1100000000'), 9)).toBe('1.1');
    expect(formatAmount(BigInt('1010000000'), 9)).toBe('1.01');
  });

  it('handles zero', () => {
    expect(formatAmount(BigInt('0'), 9)).toBe('0');
  });

  it('handles very small amounts', () => {
    expect(formatAmount(BigInt('1'), 9)).toBe('0.000000001');
  });
});

describe('parseAmount', () => {
  it('parses whole number', () => {
    expect(parseAmount('1', 9)).toBe(BigInt('1000000000'));
  });

  it('parses decimal number', () => {
    expect(parseAmount('1.5', 9)).toBe(BigInt('1500000000'));
  });

  it('parses with full decimal places', () => {
    expect(parseAmount('1.123456789', 9)).toBe(BigInt('1123456789'));
  });

  it('handles 6 decimals (USDC)', () => {
    expect(parseAmount('1', 6)).toBe(BigInt('1000000'));
    expect(parseAmount('1.5', 6)).toBe(BigInt('1500000'));
  });

  it('truncates excess decimals', () => {
    expect(parseAmount('1.1234567891111', 9)).toBe(BigInt('1123456789'));
  });

  it('handles zero', () => {
    expect(parseAmount('0', 9)).toBe(BigInt('0'));
  });

  it('handles small decimals', () => {
    expect(parseAmount('0.000000001', 9)).toBe(BigInt('1'));
  });
});
