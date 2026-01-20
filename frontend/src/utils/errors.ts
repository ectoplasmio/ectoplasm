// User-friendly error message parsing for SUI blockchain errors

export interface ParsedError {
  message: string;
  code?: string;
  suggestion?: string;
}

// Common SUI error patterns
const ERROR_PATTERNS: Array<{
  pattern: RegExp | string;
  message: string;
  suggestion?: string;
}> = [
  // Insufficient balance errors
  {
    pattern: /insufficient.*balance/i,
    message: 'Insufficient balance',
    suggestion: 'Make sure you have enough tokens. Use the Faucet to get test tokens.',
  },
  {
    pattern: /No .* coins found/i,
    message: 'No tokens found in wallet',
    suggestion: 'Use the Faucet page to mint test tokens first.',
  },
  {
    pattern: /Insufficient .* balance/i,
    message: 'Insufficient token balance',
    suggestion: 'You need more tokens to complete this transaction.',
  },

  // Gas errors
  {
    pattern: /insufficient.*gas/i,
    message: 'Insufficient SUI for gas',
    suggestion: 'You need SUI to pay for transaction fees. Request some from a SUI faucet.',
  },
  {
    pattern: /gas budget/i,
    message: 'Transaction gas limit exceeded',
    suggestion: 'The transaction is too complex. Try a smaller amount.',
  },

  // Pool/liquidity errors
  {
    pattern: /pool not found/i,
    message: 'Liquidity pool not found',
    suggestion: 'This trading pair may not be available yet.',
  },
  {
    pattern: /EInsufficientLiquidity|insufficient liquidity/i,
    message: 'Insufficient liquidity in pool',
    suggestion: 'The pool doesn\'t have enough liquidity. Try a smaller amount.',
  },
  {
    pattern: /ESlippageExceeded|slippage/i,
    message: 'Price moved too much (slippage exceeded)',
    suggestion: 'The price changed while you were trading. Try increasing slippage tolerance or reduce trade size.',
  },
  {
    pattern: /EZeroAmount|zero amount/i,
    message: 'Amount cannot be zero',
    suggestion: 'Please enter a valid amount greater than zero.',
  },
  {
    pattern: /No LP tokens found/i,
    message: 'No LP tokens found',
    suggestion: 'You don\'t have any liquidity positions to remove.',
  },

  // Transaction errors
  {
    pattern: /rejected|denied|cancelled/i,
    message: 'Transaction was rejected',
    suggestion: 'You cancelled the transaction in your wallet.',
  },
  {
    pattern: /timeout|timed out/i,
    message: 'Transaction timed out',
    suggestion: 'The network might be congested. Please try again.',
  },
  {
    pattern: /network|connection/i,
    message: 'Network error',
    suggestion: 'Check your internet connection and try again.',
  },

  // Object/state errors
  {
    pattern: /object.*not found|invalid.*object/i,
    message: 'Required object not found',
    suggestion: 'The requested resource may have been deleted or doesn\'t exist.',
  },
  {
    pattern: /version.*mismatch|stale/i,
    message: 'Transaction data is stale',
    suggestion: 'Please refresh and try again.',
  },

  // Move abort errors (e.g., "MoveAbort(_, 1)")
  {
    pattern: /MoveAbort.*,\s*0\)/,
    message: 'Smart contract assertion failed',
    suggestion: 'The transaction conditions were not met. Check your inputs.',
  },
  {
    pattern: /MoveAbort.*,\s*1\)/,
    message: 'Invalid input amount',
    suggestion: 'The amount you entered is not valid for this operation.',
  },
  {
    pattern: /MoveAbort.*,\s*2\)/,
    message: 'Insufficient liquidity for swap',
    suggestion: 'Try a smaller amount or wait for more liquidity.',
  },
  {
    pattern: /MoveAbort.*,\s*3\)/,
    message: 'Slippage tolerance exceeded',
    suggestion: 'Price moved too much. Increase slippage or reduce amount.',
  },
  {
    pattern: /MoveAbort/,
    message: 'Transaction failed',
    suggestion: 'The smart contract rejected this transaction.',
  },

  // Wallet errors
  {
    pattern: /connect.*wallet/i,
    message: 'Wallet not connected',
    suggestion: 'Please connect your wallet to continue.',
  },
  {
    pattern: /wallet.*locked/i,
    message: 'Wallet is locked',
    suggestion: 'Please unlock your wallet and try again.',
  },
];

/**
 * Parse a blockchain error and return a user-friendly message
 */
export function parseError(error: unknown): ParsedError {
  let errorMessage = '';

  // Extract message from different error formats
  if (typeof error === 'string') {
    errorMessage = error;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>;
    errorMessage = (obj.message as string) || (obj.error as string) || JSON.stringify(error);
  }

  // Check against known patterns
  for (const { pattern, message, suggestion } of ERROR_PATTERNS) {
    if (typeof pattern === 'string') {
      if (errorMessage.toLowerCase().includes(pattern.toLowerCase())) {
        return { message, suggestion, code: extractErrorCode(errorMessage) };
      }
    } else if (pattern.test(errorMessage)) {
      return { message, suggestion, code: extractErrorCode(errorMessage) };
    }
  }

  // Clean up the error message if no pattern matched
  const cleanedMessage = cleanErrorMessage(errorMessage);

  return {
    message: cleanedMessage || 'An unexpected error occurred',
    suggestion: 'Please try again. If the problem persists, refresh the page.',
  };
}

/**
 * Extract error code from error message if present
 */
function extractErrorCode(message: string): string | undefined {
  // Look for common error code patterns
  const patterns = [
    /E[A-Z][a-zA-Z]+/, // e.g., EInsufficientBalance
    /MoveAbort\([^)]+\)/, // e.g., MoveAbort(_, 1)
    /error code:?\s*(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      return match[0];
    }
  }

  return undefined;
}

/**
 * Clean up raw error messages by removing technical details
 */
function cleanErrorMessage(message: string): string {
  // Remove long hex strings
  let cleaned = message.replace(/0x[a-fA-F0-9]{32,}/g, '[address]');

  // Remove JSON-like structures
  cleaned = cleaned.replace(/\{[^}]{100,}\}/g, '');

  // Remove stack traces
  cleaned = cleaned.split('\n')[0];

  // Trim and limit length
  cleaned = cleaned.trim();
  if (cleaned.length > 150) {
    cleaned = cleaned.substring(0, 147) + '...';
  }

  return cleaned;
}

/**
 * Format error for display with optional suggestion
 */
export function formatErrorForDisplay(error: unknown): string {
  const parsed = parseError(error);
  return parsed.suggestion
    ? `${parsed.message}. ${parsed.suggestion}`
    : parsed.message;
}

/**
 * Get just the user-friendly message (shorter version)
 */
export function getErrorMessage(error: unknown): string {
  return parseError(error).message;
}
