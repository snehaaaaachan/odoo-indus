const express = require('express');
const { executeSql, getConnection } = require('../config/db');

const router = express.Router();

// Get recent transactions (Timeline)
router.get('/timeline', async (req, res) => {
    try {
        const sql = `
            SELECT t.*, p.name as PRODUCT_NAME, p.sku as PRODUCT_SKU
            FROM inventory_transactions t
            JOIN products p ON t.product_id = p.id
            ORDER BY t.transaction_date DESC
            FETCH FIRST 20 ROWS ONLY
        `;
        const result = await executeSql(sql);
        res.json(result.rows);
    } catch (err) {
        // Fallback for Oracle 10g/11g which don't support FETCH FIRST
        if (err.message.includes('ORA-00933')) {
            const fallbackSql = `
                SELECT * FROM (
                    SELECT t.*, p.name as PRODUCT_NAME, p.sku as PRODUCT_SKU
                    FROM inventory_transactions t
                    JOIN products p ON t.product_id = p.id
                    ORDER BY t.transaction_date DESC
                ) WHERE ROWNUM <= 20
            `;
            try {
                const fallbackResult = await executeSql(fallbackSql);
                return res.json(fallbackResult.rows);
            } catch (fallbackErr) {
                return res.status(500).json({ error: fallbackErr.message });
            }
        }
        res.status(500).json({ error: err.message });
    }
});

router.post('/:type', async (req, res) => {
    const { type } = req.params; // receipt, delivery, transfer, adjustment
    const { productId, qty, reference, fromLoc, toLoc, note } = req.body;
    
    let connection;
    try {
        connection = await getConnection();
        // Start transaction manually by turning off autoCommit
        const options = { autoCommit: false };
        
        // 1. Log transaction
        const sqlInsert = `
            INSERT INTO inventory_transactions (trans_type, reference, product_id, qty_change, from_loc, to_loc, note)
            VALUES (:1, :2, :3, :4, :5, :6, :7)
        `;
        let qtyChange = qty;
        if (type === 'delivery') qtyChange = -Math.abs(qty);
        if (type === 'receipt') qtyChange = Math.abs(qty);
        if (type === 'adjustment') qtyChange = qty; // qty here is difference

        await connection.execute(sqlInsert, [type, reference || '', productId, qtyChange, fromLoc || '', toLoc || '', note || ''], options);

        // 2. Update stock
        if (type === 'receipt' || type === 'delivery' || type === 'adjustment') {
            const sqlUpdate = `UPDATE products SET on_hand = on_hand + :1 WHERE id = :2`;
            await connection.execute(sqlUpdate, [qtyChange, productId], options);
        }

        // Commit transaction
        await connection.commit();
        res.json({ success: true, message: `${type} processed successfully` });
    } catch (err) {
        if (connection) await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) await connection.close();
    }
});

module.exports = router;
