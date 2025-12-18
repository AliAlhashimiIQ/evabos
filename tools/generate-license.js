/**
 * License Key Generator for EVA POS
 * 
 * Run this script to generate license keys for customers:
 *   node generate-license.js <machineId> [expiryDate]
 * 
 * Examples:
 *   node generate-license.js abc123def456    # Lifetime license for specific machine
 *   node generate-license.js * 2025-12-31     # Expiring license for any machine
 *   node generate-license.js abc123 lifetime  # Lifetime license
 * 
 * To get a customer's machine ID:
 * 1. Have them run the app and go to Settings
 * 2. They'll see their Machine ID displayed
 * 3. Use that Machine ID to generate their license
 * 
 * IMPORTANT: Keep this script PRIVATE. Do not distribute it with the app!
 */

const crypto = require('crypto');

// MUST MATCH the secret in licensing.ts - DO NOT SHARE
const LICENSE_SECRET = 'qXp9zRv2Wk5mN8b7G4hJ1fL3sT6yU0xI'; // Generated secure key

function generateLicenseKey(machineId, expiryDate = 'lifetime', features = ['full']) {
    const payload = {
        machineId,
        expiryDate,
        features,
        activatedAt: new Date().toISOString(),
    };

    const key = crypto.scryptSync(LICENSE_SECRET, 'salt', 32);
    const iv = crypto.randomBytes(16); // Correct 16 bytes for AES-256-CBC

    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(JSON.stringify(payload), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Format: EVA-XXXX-XXXX...
    const fullKey = iv.toString('hex') + encrypted;
    const formattedChunks = fullKey.match(/.{1,4}/g) || [];
    const formatted = `EVA-${formattedChunks.join('-')}`.toUpperCase();

    return formatted;
}

// Parse command line args
const args = process.argv.slice(2);

if (args.length === 0) {
    console.log('EVA POS License Generator');
    console.log('=========================');
    console.log('');
    console.log('Usage: node generate-license.js <machineId> [expiryDate]');
    console.log('');
    console.log('Arguments:');
    console.log('  machineId   - Customer machine ID (16 char hex) or "*" for any machine');
    console.log('  expiryDate  - "lifetime" or YYYY-MM-DD format (default: lifetime)');
    console.log('');
    console.log('Examples:');
    console.log('  node generate-license.js abc123def4567890');
    console.log('  node generate-license.js * 2025-12-31');
    console.log('  node generate-license.js abc123def4567890 lifetime');
    process.exit(1);
}

const machineId = args[0];
const expiryDate = args[1] || 'lifetime';

// Validate expiry date if not lifetime
if (expiryDate !== 'lifetime') {
    const date = new Date(expiryDate);
    if (isNaN(date.getTime())) {
        console.error('Invalid expiry date format. Use YYYY-MM-DD or "lifetime"');
        process.exit(1);
    }
}

// Default features
const features = ['full'];

// Generate
const key = generateLicenseKey(machineId, expiryDate, features);

console.log('\n✅ License Key Generated Successfully!');
console.log('=====================================\n');
console.log(key);
console.log('\n=====================================');
console.log('Machine ID: ' + machineId);
console.log('Expiry:     ' + expiryDate);
console.log('Features:   ' + features.join(', '));
console.log('\n👉 Copy the key exactly as shown above (including EVA-).');
console.log('   Use Ctrl+A or Triple-Click to select the whole line if needed.');
