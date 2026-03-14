// ===================================================
// INVENTORY PRO – Data Layer & State Management
// ===================================================

const AppState = {
  // Current user session
  currentUser: null,
  darkMode: false,

  // Users array
  users: [
    { id: 1, name: 'Admin User', email: 'admin@inventorypro.com', password: 'admin123', role: 'Administrator', avatar: 'AU', otp: null }
  ],

  // Warehouses
  warehouses: [
    { id: 1, name: 'Warehouse A', code: 'WH-A', location: 'Main Facility', status: 'active', capacity: 1000 },
    { id: 2, name: 'Warehouse B', code: 'WH-B', location: 'East Wing', status: 'active', capacity: 750 }
  ],

  // Locations (racks within warehouses)
  locations: [
    { id: 1, warehouseId: 1, name: 'WH-A/Stock/A1', label: 'A1', type: 'Electronics', fill: 85, status: 'healthy', zone: 'A' },
    { id: 2, warehouseId: 1, name: 'WH-A/Stock/A2', label: 'A2', type: 'Cables',      fill: 12, status: 'low',     zone: 'A' },
    { id: 3, warehouseId: 1, name: 'WH-A/Stock/A3', label: 'A3', type: 'Sensors',     fill:  2, status: 'critical',zone: 'A' },
    { id: 4, warehouseId: 1, name: 'WH-A/Stock/B1', label: 'B1', type: 'Machinery',   fill: 70, status: 'healthy', zone: 'B' },
    { id: 5, warehouseId: 1, name: 'WH-A/Stock/B2', label: 'B2', type: 'Tools',       fill: 45, status: 'healthy', zone: 'B' },
    { id: 6, warehouseId: 2, name: 'WH-B/Stock/C1', label: 'C1', type: 'Raw Materials',fill: 60, status: 'healthy', zone: 'C' },
    { id: 7, warehouseId: 2, name: 'WH-B/Stock/C2', label: 'C2', type: 'Packaging',   fill:  5, status: 'critical',zone: 'C' },
    { id: 8, warehouseId: 2, name: 'WH-B/Stock/D1', label: 'D1', type: 'Chemicals',   fill: 40, status: 'healthy', zone: 'D' }
  ],

  // Product Categories
  categories: [
    { id: 1, name: 'Electronics',   icon: '💡', color: '#3B82F6' },
    { id: 2, name: 'Construction',  icon: '🔧', color: '#F59E0B' },
    { id: 3, name: 'Raw Materials', icon: '⚙️', color: '#6B7280' },
    { id: 4, name: 'Packaging',     icon: '📦', color: '#8B5CF6' },
    { id: 5, name: 'Chemicals',     icon: '🧪', color: '#EF4444' },
    { id: 6, name: 'Tools',         icon: '🛠️', color: '#10B981' }
  ],

  // Products
  products: [
    { id: 1, name: 'Steel Rod 12mm',  sku: 'SR-12-001', categoryId: 2, uom: 'Unit',  onHand: 1240, locationId: 1, reorderQty: 200, reorderPoint: 100, price: 25.00 },
    { id: 2, name: 'Copper Wire (1m)',sku: 'CW-01-992', categoryId: 1, uom: 'Meter', onHand: 42,   locationId: 2, reorderQty: 500, reorderPoint: 100, price: 4.50  },
    { id: 3, name: 'Motion Sensor',   sku: 'MS-99-007', categoryId: 1, uom: 'Unit',  onHand: 3,    locationId: 3, reorderQty: 50,  reorderPoint: 20,  price: 89.99 },
    { id: 4, name: 'Iron Beam 6m',    sku: 'IB-06-334', categoryId: 2, uom: 'Piece', onHand: 310,  locationId: 4, reorderQty: 50,  reorderPoint: 30,  price: 145.00},
    { id: 5, name: 'Circuit Board A', sku: 'CB-AA-221', categoryId: 1, uom: 'Unit',  onHand: 0,    locationId: 3, reorderQty: 100, reorderPoint: 25,  price: 230.00},
    { id: 6, name: 'PVC Pipe 4"',     sku: 'PP-04-119', categoryId: 3, uom: 'Meter', onHand: 680,  locationId: 6, reorderQty: 200, reorderPoint: 100, price: 8.75  },
    { id: 7, name: 'Safety Gloves',   sku: 'SG-XL-003', categoryId: 6, uom: 'Pair',  onHand: 155,  locationId: 5, reorderQty: 100, reorderPoint: 30,  price: 12.50 },
    { id: 8, name: 'Bubble Wrap Roll',sku: 'BW-RO-441', categoryId: 4, uom: 'Roll',  onHand: 8,    locationId: 7, reorderQty: 50,  reorderPoint: 20,  price: 22.00 }
  ],

  // Receipts (Incoming)
  receipts: [
    { id: 'REC-001', supplierId: 1, status: 'done',    date: '2026-03-10', warehouseId: 1, expectedDate: '2026-03-10', lines: [{productId:1,qty:500,received:500},{productId:2,qty:200,received:200}] },
    { id: 'REC-002', supplierId: 2, status: 'ready',   date: '2026-03-13', warehouseId: 1, expectedDate: '2026-03-14', lines: [{productId:3,qty:50, received:0 }] },
    { id: 'REC-003', supplierId: 1, status: 'draft',   date: '2026-03-14', warehouseId: 2, expectedDate: '2026-03-15', lines: [{productId:6,qty:300,received:0 }] }
  ],

  // Suppliers / Vendors
  suppliers: [
    { id: 1, name: 'Alpha Supplies Ltd',   contact: 'alpha@supplies.com' },
    { id: 2, name: 'BetaTech Components',  contact: 'orders@betatech.com' },
    { id: 3, name: 'Gamma Materials Co',   contact: 'sales@gammamaterials.com' }
  ],

  // Delivery Orders (Outgoing)
  deliveries: [
    { id: 'DEL-001', customerId: 'Client Corp A', status: 'done',    date: '2026-03-09', warehouseId: 1, lines: [{productId:1,qty:100,shipped:100},{productId:4,qty:20,shipped:20}] },
    { id: 'DEL-002', customerId: 'Beta Industries', status: 'ready',  date: '2026-03-13', warehouseId: 1, lines: [{productId:2,qty:30,shipped:0}] },
    { id: 'DEL-003', customerId: 'Omega Factory',  status: 'draft',   date: '2026-03-14', warehouseId: 2, lines: [{productId:6,qty:150,shipped:0}] }
  ],

  // Internal Transfers
  transfers: [
    { id: 'TRF-001', fromLocationId: 4, toLocationId: 6, productId: 4, qty: 50, status: 'done',  date: '2026-03-11', note: 'Rebalance stock' },
    { id: 'TRF-002', fromLocationId: 1, toLocationId: 3, productId: 1, qty: 20, status: 'ready', date: '2026-03-13', note: 'Urgent request' }
  ],

  // Inventory Adjustments
  adjustments: [
    { id: 'ADJ-001', productId: 2, locationId: 2, counted: 42, system: 50, diff: -8, reason: 'Physical count', date: '2026-03-08', status: 'done' },
    { id: 'ADJ-002', productId: 5, locationId: 3, counted: 0,  system: 5,  diff: -5, reason: 'Damaged goods',  date: '2026-03-12', status: 'done' }
  ],

  // Stock Ledger (Move History)
  ledger: [
    { id: 1, date: '2026-03-10 09:15', type: 'receipt',   ref: 'REC-001', productId: 1, qty: +500, fromLoc: 'Supplier',         toLoc: 'WH-A/Stock/A1', note: 'Receipt validated' },
    { id: 2, date: '2026-03-10 09:15', type: 'receipt',   ref: 'REC-001', productId: 2, qty: +200, fromLoc: 'Supplier',         toLoc: 'WH-A/Stock/A2', note: 'Receipt validated' },
    { id: 3, date: '2026-03-09 14:30', type: 'delivery',  ref: 'DEL-001', productId: 1, qty: -100, fromLoc: 'WH-A/Stock/A1',   toLoc: 'Customer',      note: 'Delivery validated' },
    { id: 4, date: '2026-03-09 14:30', type: 'delivery',  ref: 'DEL-001', productId: 4, qty: -20,  fromLoc: 'WH-A/Stock/B1',   toLoc: 'Customer',      note: 'Delivery validated' },
    { id: 5, date: '2026-03-11 11:00', type: 'transfer',  ref: 'TRF-001', productId: 4, qty:  50,  fromLoc: 'WH-A/Stock/B1',   toLoc: 'WH-B/Stock/C1', note: 'Internal transfer' },
    { id: 6, date: '2026-03-08 16:00', type: 'adjustment',ref: 'ADJ-001', productId: 2, qty:  -8,  fromLoc: 'WH-A/Stock/A2',   toLoc: 'WH-A/Stock/A2', note: 'Physical count adj.' },
    { id: 7, date: '2026-03-12 10:45', type: 'adjustment',ref: 'ADJ-002', productId: 5, qty:  -5,  fromLoc: 'WH-A/Stock/A3',   toLoc: 'Scrap',         note: 'Damaged goods' }
  ],

  // Sequence counters
  _seqs: { REC: 4, DEL: 4, TRF: 3, ADJ: 3, WHouse: 3, Loc: 9, Cat: 7, Prod: 9, User: 2 },

  nextId(prefix) {
    const n = this._seqs[prefix]++;
    return `${prefix}-${String(n).padStart(3,'0')}`;
  },

  // ---- Computed / Helper ----

  getProductById(id) { return this.products.find(p => p.id === Number(id)); },
  getCategoryById(id) { return this.categories.find(c => c.id === Number(id)); },
  getLocationById(id) { return this.locations.find(l => l.id === Number(id)); },
  getWarehouseById(id) { return this.warehouses.find(w => w.id === Number(id)); },
  getSupplierById(id) { return this.suppliers.find(s => s.id === Number(id)); },

  get lowStockProducts() {
    return this.products.filter(p => p.onHand > 0 && p.onHand <= p.reorderPoint);
  },
  get outOfStockProducts() {
    return this.products.filter(p => p.onHand === 0);
  },
  get pendingReceipts() {
    return this.receipts.filter(r => ['draft','waiting','ready'].includes(r.status));
  },
  get pendingDeliveries() {
    return this.deliveries.filter(d => ['draft','waiting','ready'].includes(d.status));
  },
  get scheduledTransfers() {
    return this.transfers.filter(t => t.status !== 'done');
  },

  // Apply receipt validation: increase stock
  validateReceipt(receiptId) {
    const rec = this.receipts.find(r => r.id === receiptId);
    if (!rec || rec.status === 'done') return false;
    rec.lines.forEach(ln => {
      const prod = this.getProductById(ln.productId);
      if (prod) {
        const received = ln.qty;
        prod.onHand += received;
        ln.received = received;
        // Add to ledger
        this.ledger.unshift({
          id: this.ledger.length + 1,
          date: new Date().toISOString().slice(0,16).replace('T',' '),
          type: 'receipt', ref: rec.id, productId: prod.id,
          qty: received, fromLoc: 'Supplier',
          toLoc: this.getLocationById(prod.locationId)?.name || 'Stock',
          note: 'Receipt validated'
        });
      }
    });
    rec.status = 'done';
    return true;
  },

  // Apply delivery validation: decrease stock
  validateDelivery(deliveryId) {
    const del = this.deliveries.find(d => d.id === deliveryId);
    if (!del || del.status === 'done') return false;
    let ok = true;
    del.lines.forEach(ln => {
      const prod = this.getProductById(ln.productId);
      if (prod && prod.onHand >= ln.qty) {
        prod.onHand -= ln.qty;
        ln.shipped = ln.qty;
        this.ledger.unshift({
          id: this.ledger.length + 1,
          date: new Date().toISOString().slice(0,16).replace('T',' '),
          type: 'delivery', ref: del.id, productId: prod.id,
          qty: -ln.qty, fromLoc: this.getLocationById(prod.locationId)?.name || 'Stock',
          toLoc: 'Customer',
          note: 'Delivery validated'
        });
      } else ok = false;
    });
    if (ok) del.status = 'done';
    return ok;
  },

  // Internal Transfer validation
  validateTransfer(tfId) {
    const tf = this.transfers.find(t => t.id === tfId);
    if (!tf || tf.status === 'done') return false;
    const prod = this.getProductById(tf.productId);
    const from = this.getLocationById(tf.fromLocationId);
    const to   = this.getLocationById(tf.toLocationId);
    this.ledger.unshift({
      id: this.ledger.length + 1,
      date: new Date().toISOString().slice(0,16).replace('T',' '),
      type: 'transfer', ref: tf.id, productId: prod.id,
      qty: tf.qty, fromLoc: from?.name || '?', toLoc: to?.name || '?',
      note: tf.note
    });
    tf.status = 'done';
    return true;
  },

  // Inventory adjustment
  applyAdjustment(adjId) {
    // ... Keeping local mock method for partial backwards compatibility ...
    // In production, we replaced calls in operations.js to use fetch
    return true;
  },

  // -------------------------------------------------------------
  // Load real data from Node.js / Oracle backend
  // -------------------------------------------------------------
  async fetchServerData() {
    try {
      const hdrs = { 'Authorization': `Bearer ${this.token}`, 'Content-Type': 'application/json' };
      
      // Fetch Products
      const pRes = await fetch('http://localhost:3001/api/products', { headers: hdrs });
      if (pRes.ok) {
        const pData = await pRes.json();
        // Map Oracle UPPERCASE keys to frontend camelCase
        this.products = pData.map(row => ({
          id: row.ID, name: row.NAME, sku: row.SKU, categoryId: row.CATEGORY || 1, 
          uom: row.UOM, onHand: row.ON_HAND, locationId: row.LOCATION_ID || 1, 
          reorderQty: row.REORDER_QTY || row.REORDER_POINT, reorderPoint: row.REORDER_POINT, 
          price: row.PRICE || 10.00,
          avgDailyUsage: row.AVG_DAILY_USAGE || 0,
          leadTimeDays: row.LEAD_TIME_DAYS || 7
        }));
      }

      // Fetch KPIs
      const kRes = await fetch('http://localhost:3001/api/dashboard/kpis', { headers: hdrs });
      if (kRes.ok) this.serverKpis = await kRes.json();

      // Fetch Real-Time Timeline
      const tRes = await fetch('http://localhost:3001/api/operations/timeline', { headers: hdrs });
      if (tRes.ok) {
        const rows = await tRes.json();
        this.ledger = rows.map((r, i) => ({
          id: i, date: r.TRANSACTION_DATE, type: r.TRANS_TYPE, ref: r.REFERENCE,
          productId: r.PRODUCT_ID, qty: r.QTY_CHANGE, fromLoc: r.FROM_LOC || 'Stock', 
          toLoc: r.TO_LOC || 'Stock', note: r.NOTE || ''
        }));
      }

      // Fetch Advanced Analytics: Fast Moving Heatmap & Predictive Reordering
      const fmRes = await fetch('http://localhost:3001/api/analytics/fast-moving', { headers: hdrs });
      if (fmRes.ok) {
        this.fastMoving = (await fmRes.json()).map(r => ({ ...r, id: r.ID, name: r.NAME, sku: r.SKU, velocity: r.VELOCITY }));
      }
      
      const prRes = await fetch('http://localhost:3001/api/analytics/predictive-reorder', { headers: hdrs });
      if (prRes.ok) {
        this.predictive = (await prRes.json()).map(r => ({ ...r, prediction_status: r.PREDICTION_STATUS }));
      }

    } catch(err) {
      console.error('Failed to load server data', err);
    }
  }
};

// Make globally available
window.AppState = AppState;
