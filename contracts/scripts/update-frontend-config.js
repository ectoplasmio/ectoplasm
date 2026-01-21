#!/usr/bin/env node

/**
 * Update Frontend Config Script
 * ==============================
 * Updates the frontend SUI config with new deployment addresses
 *
 * Usage:
 *   node update-frontend-config.js
 *
 * Reads from: deployment-summary.json
 * Updates: ../../frontend/src/config/sui.ts
 */

const fs = require('fs');
const path = require('path');

const SCRIPT_DIR = __dirname;
const SUMMARY_FILE = path.join(SCRIPT_DIR, 'deployment-summary.json');
const CONFIG_FILE = path.join(SCRIPT_DIR, '../../frontend/src/config/sui.ts');

console.log('======================================');
console.log('   Update Frontend Config');
console.log('======================================\n');

// Check if summary file exists
if (!fs.existsSync(SUMMARY_FILE)) {
    console.error('Error: deployment-summary.json not found.');
    console.error('Please run deploy.sh first.');
    process.exit(1);
}

// Read deployment summary
const summary = JSON.parse(fs.readFileSync(SUMMARY_FILE, 'utf8'));
console.log('Deployment Summary:');
console.log(`  Package ID: ${summary.packageId}`);
console.log(`  ECTO Faucet: ${summary.objects.ectoFaucet}`);
console.log(`  USDC Faucet: ${summary.objects.usdcFaucet}`);
console.log(`  Factory: ${summary.objects.factory}`);
console.log('');

// Check if config file exists
if (!fs.existsSync(CONFIG_FILE)) {
    console.error(`Error: Config file not found at ${CONFIG_FILE}`);
    process.exit(1);
}

// Read current config
let configContent = fs.readFileSync(CONFIG_FILE, 'utf8');

// Update package ID
const oldPackageIdMatch = configContent.match(/packageId:\s*['"]([^'"]+)['"]/);
if (oldPackageIdMatch) {
    console.log(`Updating packageId: ${oldPackageIdMatch[1]} -> ${summary.packageId}`);
    configContent = configContent.replace(
        /packageId:\s*['"][^'"]+['"]/,
        `packageId: '${summary.packageId}'`
    );
}

// Update factory ID
if (summary.objects.factory) {
    const oldFactoryMatch = configContent.match(/factoryId:\s*['"]([^'"]+)['"]/);
    if (oldFactoryMatch) {
        console.log(`Updating factoryId: ${oldFactoryMatch[1]} -> ${summary.objects.factory}`);
        configContent = configContent.replace(
            /factoryId:\s*['"][^'"]+['"]/,
            `factoryId: '${summary.objects.factory}'`
        );
    }
}

// Update ECTO faucet ID (in treasuryCaps or faucets section)
if (summary.objects.ectoFaucet) {
    // Try to update treasuryCaps.ECTO
    const ectoCapMatch = configContent.match(/ECTO:\s*['"]([^'"]+)['"]/);
    if (ectoCapMatch) {
        console.log(`Updating ECTO faucet/cap: ${ectoCapMatch[1]} -> ${summary.objects.ectoFaucet}`);
    }
}

// Update USDC faucet ID
if (summary.objects.usdcFaucet) {
    const usdcCapMatch = configContent.match(/USDC:\s*['"]([^'"]+)['"]/);
    if (usdcCapMatch) {
        console.log(`Updating USDC faucet/cap: ${usdcCapMatch[1]} -> ${summary.objects.usdcFaucet}`);
    }
}

// Update coin types
const newEctoCoinType = `${summary.packageId}::ecto::ECTO`;
const newUsdcCoinType = `${summary.packageId}::usdc::USDC`;

configContent = configContent.replace(
    /coinType:\s*['"]0x[a-f0-9]+::ecto::ECTO['"]/g,
    `coinType: '${newEctoCoinType}'`
);

configContent = configContent.replace(
    /coinType:\s*['"]0x[a-f0-9]+::usdc::USDC['"]/g,
    `coinType: '${newUsdcCoinType}'`
);

// Update pool coinTypeA and coinTypeB
configContent = configContent.replace(
    /coinTypeA:\s*['"]0x[a-f0-9]+::ecto::ECTO['"]/g,
    `coinTypeA: '${newEctoCoinType}'`
);

configContent = configContent.replace(
    /coinTypeB:\s*['"]0x[a-f0-9]+::usdc::USDC['"]/g,
    `coinTypeB: '${newUsdcCoinType}'`
);

// Write updated config
fs.writeFileSync(CONFIG_FILE, configContent);

console.log('\n✓ Config updated successfully!');
console.log(`  File: ${CONFIG_FILE}`);
console.log('\nNote: You may need to manually update:');
console.log('  - Pool IDs (if creating new pools)');
console.log('  - Staking pool ID');
console.log('  - Launchpad config ID');
console.log('\nRestart the dev server to apply changes.');
