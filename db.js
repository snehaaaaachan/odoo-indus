const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

// SQLite database file
const dbPath = path.join(__dirname, '..', 'inventory.db');
const db = new sqlite3.Database(dbPath);

console.log('[DB] Using SQLite database at:', dbPath);

/**
 * Executes a SQL query. 
 * Includes a translation layer from Oracle syntax (used in the routes) to SQLite.
 */
async function executeSql(sql, binds = [], options = {}) {
  return new Promise((resolve, reject) => {
    // 1. Translate Oracle :1, :2 binds to SQLite ?
    let sqliteSql = sql.replace(/:\d+/g, '?');
    
    // 2. Translate Oracle CURRENT_TIMESTAMP logic
    sqliteSql = sqliteSql.replace(/CURRENT_TIMESTAMP \+ INTERVAL '10' MINUTE/g, "datetime('now', '+10 minutes')");
    sqliteSql = sqliteSql.replace(/CURRENT_TIMESTAMP/g, "datetime('now')");
    
    // 3. Translate Oracle "FETCH FIRST X ROWS ONLY" used in analytics/history to SQLite LIMIT
    const fetchMatch = sqliteSql.match(/FETCH FIRST (\d+) ROWS ONLY/i);
    if (fetchMatch) {
      sqliteSql = sqliteSql.replace(/FETCH FIRST \d+ ROWS ONLY/i, `LIMIT ${fetchMatch[1]}`);
    }

    // 4. Handle SELECT vs DML
    const isSelect = sqliteSql.trim().toUpperCase().startsWith('SELECT');

    if (isSelect) {
      db.all(sqliteSql, binds, (err, rows) => {
        if (err) {
          console.error('[SQL Error]', err.message, '| SQL:', sqliteSql);
          return reject(err);
        }
        
        // Oracle column names are usually returned in UPPERCASE by oracledb in OBJECT mode.
        // We map SQLite's lowercase returns to UPPERCASE to maintain compatibility with the routes.
        const mappedRows = rows.map(row => {
          const upperRow = {};
          for (let key in row) {
            upperRow[key.toUpperCase()] = row[key];
          }
          return upperRow;
        });
        
        resolve({ rows: mappedRows });
      });
    } else {
      db.run(sqliteSql, binds, function(err) {
        if (err) {
          console.error('[SQL Error]', err.message, '| SQL:', sqliteSql);
          return reject(err);
        }
        resolve({ rowsAffected: this.changes, lastID: this.lastID });
      });
    }
  });
}

module.exports = {
  executeSql,
  db
};
