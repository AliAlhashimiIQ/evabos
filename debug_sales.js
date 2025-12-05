const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = 'C:\\Users\\PC\\AppData\\Roaming\\eva-pos-desktop\\eva-pos.db';
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error(err.message);
        process.exit(1);
    }
    console.log('Connected to the database.');
});

const query = `
  SELECT id, saleDate, totalIQD, profitIQD 
  FROM sales 
  WHERE date(saleDate) BETWEEN '2025-11-15' AND '2025-11-30'
  ORDER BY saleDate ASC
`;

db.all(query, [], (err, rows) => {
    if (err) {
        throw err;
    }
    console.log('Sales between 2025-11-15 and 2025-11-30:');
    rows.forEach((row) => {
        console.log(`${row.id} | ${row.saleDate} | Total: ${row.totalIQD} | Profit: ${row.profitIQD}`);
    });

    // Also check for returns
    const returnQuery = `
    SELECT id, createdAt, refundAmountIQD 
    FROM returns 
    WHERE date(createdAt) BETWEEN '2025-11-15' AND '2025-11-30'
    ORDER BY createdAt ASC
  `;

    db.all(returnQuery, [], (err, returns) => {
        if (err) throw err;
        console.log('\nReturns between 2025-11-15 and 2025-11-30:');
        returns.forEach((row) => {
            console.log(`${row.id} | ${row.createdAt} | Refund: ${row.refundAmountIQD}`);
        });
        db.close();
    });
});
