const express = require('express');
const { executeSql } = require('../config/db');

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const sql = `
            SELECT p.*, l.name as LOCATION_NAME, w.name as WAREHOUSE_NAME 
            FROM products p
            LEFT JOIN locations l ON p.location_id = l.id
            LEFT JOIN warehouses w ON l.warehouse_id = w.id
            ORDER BY p.id DESC
        `;
        const result = await executeSql(sql);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', async (req, res) => {
    const { name, sku, category, uom, on_hand, reorder_point, reorder_qty, location_id, avg_daily_usage, lead_time_days } = req.body;
    try {
        const sql = `
            INSERT INTO products (name, sku, category, uom, on_hand, reorder_point, reorder_qty, location_id, avg_daily_usage, lead_time_days)
            VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10)
        `;
        await executeSql(sql, [name, sku, category, uom, on_hand || 0, reorder_point || 0, reorder_qty || 0, location_id || null, avg_daily_usage || 0, lead_time_days || 7]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
