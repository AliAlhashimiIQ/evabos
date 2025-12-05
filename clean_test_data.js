const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = 'C:\\Users\\PC\\AppData\\Roaming\\eva-pos-desktop\\eva-pos.db';
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.error(err.message);
        process.exit(1);
    }
    console.log('Connected to the database for cleanup.');
});

const cutoffDate = '2025-11-29';

db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    // 1. Delete Sales and Sale Items
    db.run(`DELETE FROM sale_items WHERE saleId IN (SELECT id FROM sales WHERE date(saleDate) < ?)`, [cutoffDate], function (err) {
        if (err) console.error('Error deleting sale_items:', err);
        else console.log(`Deleted ${this.changes} sale_items.`);
    });

    db.run(`DELETE FROM sales WHERE date(saleDate) < ?`, [cutoffDate], function (err) {
        if (err) console.error('Error deleting sales:', err);
        else console.log(`Deleted ${this.changes} sales.`);
    });

    // 2. Delete Returns and Return Items
    // Note: returns use 'createdAt' which might be 'YYYY-MM-DD HH:MM:SS' or ISO. 
    // date() function handles both.
    db.run(`DELETE FROM return_items WHERE returnId IN (SELECT id FROM returns WHERE date(createdAt) < ?)`, [cutoffDate], function (err) {
        if (err) console.error('Error deleting return_items:', err);
        else console.log(`Deleted ${this.changes} return_items.`);
    });

    db.run(`DELETE FROM returns WHERE date(createdAt) < ?`, [cutoffDate], function (err) {
        if (err) console.error('Error deleting returns:', err);
        else console.log(`Deleted ${this.changes} returns.`);
    });

    // 3. Delete Expenses
    db.run(`DELETE FROM expenses WHERE date(expenseDate) < ?`, [cutoffDate], function (err) {
        if (err) console.error('Error deleting expenses:', err);
        else console.log(`Deleted ${this.changes} expenses.`);
    });

    db.run('COMMIT', (err) => {
        if (err) {
            console.error('Error committing transaction:', err);
            db.run('ROLLBACK');
        } else {
            console.log('Cleanup complete. Transaction committed.');
        }
        db.close();
    });
});
