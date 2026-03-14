const express = require('express');
const { executeSql } = require('../config/db');

const router = express.Router();

// 1. Fast-Moving Products Heatmap (Velocity)
router.get('/fast-moving', async (req, res) => {
    try {
        // Calculate velocity: sum of absolute qty_change for deliveries over the last 30 days
        const sql = `
            SELECT p.id, p.name, p.sku, NVL(SUM(ABS(t.qty_change)), 0) as velocity
            FROM products p
            LEFT JOIN inventory_transactions t ON p.id = t.product_id 
                AND t.trans_type = 'delivery'
                AND t.transaction_date >= CURRENT_DATE - 30
            GROUP BY p.id, p.name, p.sku
            ORDER BY velocity DESC
        `;
        const result = await executeSql(sql);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Predictive Reordering System
router.get('/predictive-reorder', async (req, res) => {
    try {
        // Formula: (Avg Daily Usage * Lead Time)
        // If On Hand < (Predicted Usage + Reorder Point), it flags an alert
        const sql = `
            SELECT 
                id, name, sku, on_hand, reorder_point, avg_daily_usage, lead_time_days,
                (avg_daily_usage * lead_time_days) as predicted_usage_during_lead,
                CASE 
                    WHEN on_hand <= ((avg_daily_usage * lead_time_days) + (reorder_point * 0.5)) THEN 'Critical'
                    WHEN on_hand <= ((avg_daily_usage * lead_time_days) + reorder_point) THEN 'Warning'
                    ELSE 'Healthy'
                END as prediction_status
            FROM products
            ORDER BY 
                CASE 
                    WHEN on_hand <= ((avg_daily_usage * lead_time_days) + (reorder_point * 0.5)) THEN 1
                    WHEN on_hand <= ((avg_daily_usage * lead_time_days) + reorder_point) THEN 2
                    ELSE 3
                END ASC, on_hand ASC
        `;
        const result = await executeSql(sql);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
