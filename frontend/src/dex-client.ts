/**
 * DEX Client - SUI Implementation
 *
 * This file is a compatibility stub. The actual DEX functionality
 * is now handled by the SuiService in services/sui.ts
 */

export { SuiService as DexClient } from './services/sui';
export { SUI_CONFIG as DexConfig } from './config/sui';

// Re-export types
export type DexConfig = typeof import('./config/sui').SUI_CONFIG;
