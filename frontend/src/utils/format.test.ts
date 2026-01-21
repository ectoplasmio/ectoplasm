import { describe, it, expect } from 'vitest';
import {
  formatNumber,
  formatCompact,
  truncateAddress,
  motesToCspr,
  csprToMotes,
  formatTokenAmount,
  parseTokenAmount,
  hexToBytes,
  bytesToHex,
} from './format';

describe('formatNumber', () => {
  it('formats numbers with default 2 decimal places', () => {
    expect(formatNumber(1234.567)).toBe('1,234.57');
  });

  it('formats string inputs', () => {
    expect(formatNumber('1234.567')).toBe('1,234.57');
  });

  it('handles custom decimal places', () => {
    expect(formatNumber(1234.5678, 4)).toBe('1,234.5678');
  });

  it('handles zero', () => {
    expect(formatNumber(0)).toBe('0.00');
  });

  it('handles NaN input', () => {
    expect(formatNumber(NaN)).toBe('0');
    expect(formatNumber('invalid')).toBe('0');
  });

  it('handles large numbers', () => {
    expect(formatNumber(1234567890.12)).toBe('1,234,567,890.12');
  });
});

describe('formatCompact', () => {
  it('formats billions', () => {
    expect(formatCompact(1500000000)).toBe('1.50B');
  });

  it('formats millions', () => {
    expect(formatCompact(1500000)).toBe('1.50M');
  });

  it('formats thousands', () => {
    expect(formatCompact(1500)).toBe('1.50K');
  });

  it('formats small numbers without suffix', () => {
    expect(formatCompact(150)).toBe('150.00');
  });

  it('handles boundary values', () => {
    expect(formatCompact(1000)).toBe('1.00K');
    expect(formatCompact(1000000)).toBe('1.00M');
    expect(formatCompact(1000000000)).toBe('1.00B');
  });
});

describe('truncateAddress', () => {
  const fullAddress = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

  it('truncates address with default lengths', () => {
    expect(truncateAddress(fullAddress)).toBe('0x123456...abcdef');
  });

  it('handles custom start and end lengths', () => {
    expect(truncateAddress(fullAddress, 10, 10)).toBe('0x12345678...7890abcdef');
  });

  it('handles empty address', () => {
    expect(truncateAddress('')).toBe('');
  });

  it('returns short address as-is', () => {
    expect(truncateAddress('0x1234', 8, 6)).toBe('0x1234');
  });
});

describe('motesToCspr', () => {
  it('converts motes to CSPR', () => {
    expect(motesToCspr('1000000000')).toBe('1.0000');
  });

  it('handles bigint input', () => {
    expect(motesToCspr(BigInt('5500000000'))).toBe('5.5000');
  });

  it('handles small amounts', () => {
    expect(motesToCspr('100000000')).toBe('0.1000');
  });

  it('handles zero', () => {
    expect(motesToCspr('0')).toBe('0.0000');
  });
});

describe('csprToMotes', () => {
  it('converts CSPR to motes', () => {
    expect(csprToMotes(1)).toBe('1000000000');
  });

  it('handles string input', () => {
    expect(csprToMotes('5.5')).toBe('5500000000');
  });

  it('handles fractional amounts', () => {
    expect(csprToMotes(0.1)).toBe('100000000');
  });

  it('handles zero', () => {
    expect(csprToMotes(0)).toBe('0');
  });
});

describe('formatTokenAmount', () => {
  it('formats raw amount with decimals', () => {
    expect(formatTokenAmount('1000000000', 9)).toBe('1.0000');
  });

  it('handles bigint input', () => {
    expect(formatTokenAmount(BigInt('5500000000'), 9)).toBe('5.5000');
  });

  it('handles 6 decimals (USDC-like)', () => {
    expect(formatTokenAmount('1000000', 6)).toBe('1.0000');
  });

  it('handles large amounts', () => {
    expect(formatTokenAmount('1000000000000000', 9)).toBe('1000000.0000');
  });

  it('handles very large amounts beyond MAX_SAFE_INTEGER', () => {
    const hugeAmount = BigInt('100000000000000000000');
    const result = formatTokenAmount(hugeAmount, 9);
    expect(result).toContain('100000000000');
  });
});

describe('parseTokenAmount', () => {
  it('parses amount with decimals', () => {
    expect(parseTokenAmount('1.5', 9)).toBe('1500000000');
  });

  it('parses whole numbers', () => {
    expect(parseTokenAmount('100', 9)).toBe('100000000000');
  });

  it('handles excess decimals', () => {
    expect(parseTokenAmount('1.123456789123', 9)).toBe('1123456789');
  });

  it('handles zero', () => {
    expect(parseTokenAmount('0', 9)).toBe('0');
  });

  it('parses 6 decimal tokens', () => {
    expect(parseTokenAmount('1.5', 6)).toBe('1500000');
  });
});

describe('hexToBytes', () => {
  it('converts hex string to bytes', () => {
    const bytes = hexToBytes('deadbeef');
    expect(bytes).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
  });

  it('handles hash- prefix', () => {
    const bytes = hexToBytes('hash-deadbeef');
    expect(bytes).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
  });

  it('converts empty string', () => {
    const bytes = hexToBytes('');
    expect(bytes).toEqual(new Uint8Array([]));
  });
});

describe('bytesToHex', () => {
  it('converts bytes to hex string', () => {
    const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    expect(bytesToHex(bytes)).toBe('deadbeef');
  });

  it('pads single-digit hex values', () => {
    const bytes = new Uint8Array([0x01, 0x02, 0x0a]);
    expect(bytesToHex(bytes)).toBe('01020a');
  });

  it('handles empty array', () => {
    const bytes = new Uint8Array([]);
    expect(bytesToHex(bytes)).toBe('');
  });
});
