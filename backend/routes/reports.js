const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { auth, ownerOnly } = require('../middleware/auth');

// All reports are owner only
router.use(auth, ownerOnly);

// GET /api/reports/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const todayResult = await pool.query(
      `SELECT COUNT(*) as bills_today, COALESCE(SUM(net_total), 0) as revenue_today
       FROM bills WHERE created_at::date = CURRENT_DATE`
    );
    const monthResult = await pool.query(
      `SELECT COALESCE(SUM(net_total), 0) as revenue_month
       FROM bills WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)`
    );
    const lowStockResult = await pool.query(
      `SELECT COUNT(*) as low_stock_count FROM products WHERE quantity <= low_stock_limit`
    );
    const invValueResult = await pool.query(
      `SELECT COALESCE(SUM(quantity * cost_price), 0) as inventory_value FROM products`
    );

    res.json({
      bills_today: parseInt(todayResult.rows[0].bills_today),
      revenue_today: todayResult.rows[0].revenue_today,
      revenue_month: monthResult.rows[0].revenue_month,
      low_stock_count: parseInt(lowStockResult.rows[0].low_stock_count),
      inventory_value: invValueResult.rows[0].inventory_value,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// GET /api/reports/top-products?limit=10
router.get('/top-products', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const { rows } = await pool.query(
      `SELECT
         p.id, p.name, p.category, p.sell_price, p.cost_price,
         COALESCE(SUM(bi.quantity), 0) as units_sold,
         COALESCE(SUM(bi.subtotal), 0) as revenue,
         COALESCE(SUM(bi.subtotal) - SUM(bi.quantity * p.cost_price), 0) as profit
       FROM products p
       LEFT JOIN bill_items bi ON p.id = bi.product_id
       GROUP BY p.id
       ORDER BY units_sold DESC
       LIMIT $1`,
      [limit]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// GET /api/reports/by-category
router.get('/by-category', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         p.category,
         COALESCE(SUM(bi.quantity), 0) as units_sold,
         COALESCE(SUM(bi.subtotal), 0) as revenue,
         COALESCE(SUM(bi.subtotal) - SUM(bi.quantity * p.cost_price), 0) as profit
       FROM products p
       LEFT JOIN bill_items bi ON p.id = bi.product_id
       GROUP BY p.category
       ORDER BY revenue DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// GET /api/reports/revenue?period=week|month|year
router.get('/revenue', async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    let sql;

    if (period === 'week') {
      sql = `SELECT created_at::date as label,
                    COALESCE(SUM(net_total), 0) as revenue,
                    COUNT(*) as bills
             FROM bills
             WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
             GROUP BY created_at::date
             ORDER BY label ASC`;
    } else if (period === 'month') {
      sql = `SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as label,
                    COALESCE(SUM(net_total), 0) as revenue,
                    COUNT(*) as bills
             FROM bills
             WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
             GROUP BY created_at::date
             ORDER BY label ASC`;
    } else {
      sql = `SELECT TO_CHAR(created_at, 'YYYY-MM') as label,
                    COALESCE(SUM(net_total), 0) as revenue,
                    COUNT(*) as bills
             FROM bills
             WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
             GROUP BY TO_CHAR(created_at, 'YYYY-MM')
             ORDER BY label ASC`;
    }

    const { rows } = await pool.query(sql);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// GET /api/reports/inventory-value
router.get('/inventory-value', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         category,
         COUNT(*) as product_count,
         SUM(quantity) as total_units,
         COALESCE(SUM(quantity * cost_price), 0) as cost_value,
         COALESCE(SUM(quantity * sell_price), 0) as sell_value
       FROM products
       GROUP BY category
       ORDER BY cost_value DESC`
    );
    const totalResult = await pool.query(
      `SELECT
         COALESCE(SUM(quantity * cost_price), 0) as total_cost,
         COALESCE(SUM(quantity * sell_price), 0) as total_sell,
         COUNT(*) as total_products,
         SUM(quantity) as total_units
       FROM products`
    );
    res.json({ byCategory: rows, totals: totalResult.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
