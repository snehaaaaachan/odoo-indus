const express = require('express');
const { executeSql } = require('../config/db');

const router = express.Router();

router.get('/kpis', async (req, res) => {
    try {
        const totalProductsSql = `SELECT COUNT(*) as count FROM products`;
        const outOfStockSql = `SELECT COUNT(*) as count FROM products WHERE on_hand <= 0`;
        const lowStockSql = `SELECT COUNT(*) as count FROM products WHERE on_hand > 0 AND on_hand <= reorder_point`;
        
        const total = await executeSql(totalProductsSql);
        const outOfStock = await executeSql(outOfStockSql);
        const lowStock = await executeSql(lowStockSql);

        // Mock pending data for simplicity since we don't have pending tables
        res.json({
            totalProducts: total.rows[0].COUNT,
            outOfStock: outOfStock.rows[0].COUNT,
            lowStock: lowStock.rows[0].COUNT,
            pendingReceipts: 2, // Mock 
            pendingDeliveries: 1, // Mock
            internalTransfers: 0 // Mock
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
