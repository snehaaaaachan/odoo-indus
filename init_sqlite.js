const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', 'inventory.db');
const db = new sqlite3.Database(dbPath);

console.log('Initializing SQLite Database...');

const schema = [
  `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'Staff',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS otps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      otp_code TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS warehouses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      location_desc TEXT,
      capacity INTEGER DEFAULT 500,
      status TEXT DEFAULT 'active'
  )`,
  `CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      label TEXT NOT NULL,
      type TEXT,
      zone TEXT,
      fill_percentage INTEGER DEFAULT 0,
      status TEXT DEFAULT 'healthy'
  )`,
  `CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sku TEXT UNIQUE NOT NULL,
      category TEXT,
      uom TEXT,
      on_hand INTEGER DEFAULT 0,
      reorder_point INTEGER DEFAULT 0,
      reorder_qty INTEGER DEFAULT 0,
      location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
      avg_daily_usage REAL DEFAULT 0,
      lead_time_days INTEGER DEFAULT 7,
      status TEXT DEFAULT 'In Stock'
  )`,
  `CREATE TABLE IF NOT EXISTS inventory_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      trans_type TEXT NOT NULL,
      reference TEXT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      qty_change INTEGER NOT NULL,
      from_loc TEXT,
      to_loc TEXT,
      note TEXT
  )`
];

const seedData = [
  // User: sneha (Manager/Administrator)
  `INSERT OR IGNORE INTO users (name, email, password_hash, role) 
   VALUES ('sneha', 'pepperchilli4321@gmail.com', '1234', 'Administrator')`,
  
  // Warehouse
  `INSERT OR IGNORE INTO warehouses (name, code, location_desc) 
   VALUES ('Warehouse A', 'WH-A', 'Main Hub')`,
  
  // Location
  `INSERT OR IGNORE INTO locations (warehouse_id, name, label, type, zone) 
   VALUES (1, 'WH-A/Stock/A1', 'A1', 'General', 'A')`,
  
  // Products
  `INSERT OR IGNORE INTO products (name, sku, category, uom, on_hand, reorder_point, avg_daily_usage, lead_time_days, location_id)
   VALUES ('Steel Rod 12mm', 'SR-12-001', 'Construction', 'Unit', 1240, 100, 15, 7, 1)`,
  
  `INSERT OR IGNORE INTO products (name, sku, category, uom, on_hand, reorder_point, avg_daily_usage, lead_time_days, location_id)
   VALUES ('Copper Wire (1m)', 'CW-01-992', 'Electronics', 'Meter', 42, 100, 12, 5, 1)`,
  
  `INSERT OR IGNORE INTO products (name, sku, category, uom, on_hand, reorder_point, avg_daily_usage, lead_time_days, location_id)
   VALUES ('Motion Sensor', 'MS-99-007', 'Electronics', 'Unit', 3, 20, 2, 14, 1)`,
  
  // Transactions
  `INSERT INTO inventory_transactions (trans_type, reference, product_id, qty_change, to_loc, note)
   VALUES ('receipt', 'REC-001', 1, 1500, 'WH-A/Stock/A1', 'Initial Stock')`,
  
  `INSERT INTO inventory_transactions (trans_type, reference, product_id, qty_change, from_loc, to_loc, note)
   VALUES ('delivery', 'DEL-001', 1, -260, 'WH-A/Stock/A1', 'Customer X', 'Bulk sale')`
];

db.serialize(() => {
  schema.forEach(sql => db.run(sql));
  seedData.forEach(sql => db.run(sql));
});

db.close((err) => {
  if (err) {
    console.error('Error closing database:', err.message);
  } else {
    console.log('Database initialized successfully with SQLite!');
  }
});
