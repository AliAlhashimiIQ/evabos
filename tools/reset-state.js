const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const os = require('os');
const { app } = require('electron');

// Determine database path (mimicking logic from database.ts)
// In dev, it's widely just 'db.sqlite' in the project root or appData
const possiblePaths = [
    path.join(__dirname, '..', 'eva-pos.db'), // portable/dev root
    path.join(process.env.APPDATA || os.homedir(), 'EVA POS', 'eva-pos.db'), // installed/dev (Product Name)
    path.join(process.env.APPDATA || os.homedir(), 'eva-pos-desktop', 'eva-pos.db') // installed/dev (Package Name)
];

let dbPath = possiblePaths.find(p => fs.existsSync(p));

if (!dbPath) {
    console.error('❌ Could not find database file.');
    console.log('Checked locations:', possiblePaths);
    process.exit(1);
}

console.log(`QT Connected to database at: ${dbPath}`);

const db = new sqlite3.Database(dbPath);

const keysToDelete = [
    'license_key',
    'license_activated_at',
    'legal_accepted_v1'
];

db.serialize(() => {
    const placeholders = keysToDelete.map(() => '?').join(',');
    const sql = `DELETE FROM settings WHERE key IN (${placeholders})`;

    db.run(sql, keysToDelete, function (err) {
        if (err) {
            return console.error('❌ Error resetting state:', err.message);
        }
        console.log(`✅ Reset complete! Deleted ${this.changes} settings.`);
        console.log('   - License Key');
        console.log('   - Activation Time');
        console.log('   - Legal Acceptance');
        console.log('');
        console.log('👉 You can now restart the app to see the Activation/Legal screens again.');
    });
});

db.close();
