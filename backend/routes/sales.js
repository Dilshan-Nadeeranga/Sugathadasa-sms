const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { auth } = require('../middleware/auth');

// GET /api/sales/today
router.get('/today', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*) as total_bills,
         COALESCE(SUM(net_total), 0) as total_revenue,
         COALESCE(SUM(net_total - (
           SELECT COALESCE(SUM(bi.quantity * p.cost_price), 0)
           FROM bill_items bi JOIN products p ON bi.product_id = p.id
           WHERE bi.bill_id = b.id
         )), 0) as total_profit
       FROM bills b
       WHERE b.created_at::date = CURRENT_DATE`
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// GET /api/sales/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/summary', auth, async (req, res) => {
  try {
    const { from, to } = req.query;
    const fromDate = from || new Date().toISOString().split('T')[0];
    const toDate = to || new Date().toISOString().split('T')[0];

    const dailyResult = await pool.query(
      `SELECT
         b.created_at::date as sale_date,
         COUNT(*) as total_bills,
         COALESCE(SUM(b.net_total), 0) as total_revenue,
         COALESCE(SUM(b.net_total) - SUM((
           SELECT COALESCE(SUM(bi2.quantity * p2.cost_price), 0)
           FROM bill_items bi2 JOIN products p2 ON bi2.product_id = p2.id
           WHERE bi2.bill_id = b.id
         )), 0) as total_profit
       FROM bills b
       WHERE b.created_at::date BETWEEN $1 AND $2
       GROUP BY b.created_at::date
       ORDER BY sale_date DESC`,
      [fromDate, toDate]
    );

    const totalsResult = await pool.query(
      `SELECT
         COUNT(*) as total_bills,
         COALESCE(SUM(net_total), 0) as total_revenue
       FROM bills
       WHERE created_at::date BETWEEN $1 AND $2`,
      [fromDate, toDate]
    );

    const billsResult = await pool.query(
      `SELECT b.id, b.bill_number, b.total_amount, b.discount, b.net_total, b.created_at,
              u.name as staff_name,
              COUNT(bi.id) as item_count
       FROM bills b
       LEFT JOIN users u ON b.staff_id = u.id
       LEFT JOIN bill_items bi ON b.id = bi.bill_id
       WHERE b.created_at::date BETWEEN $1 AND $2
       GROUP BY b.id, u.name
       ORDER BY b.created_at DESC`,
      [fromDate, toDate]
    );

    res.json({ daily: dailyResult.rows, totals: totalsResult.rows[0], bills: billsResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
