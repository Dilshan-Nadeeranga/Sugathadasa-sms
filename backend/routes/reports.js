const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { auth, ownerOnly } = require('../middleware/auth');

// All reports are owner only
router.use(auth, ownerOnly);

// GET /api/reports/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const [today] = await pool.execute(
      `SELECT COUNT(*) as bills_today, COALESCE(SUM(net_total), 0) as revenue_today
       FROM bills WHERE DATE(created_at) = CURDATE()`
    );
    const [month] = await pool.execute(
      `SELECT COALESCE(SUM(net_total), 0) as revenue_month
       FROM bills WHERE YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())`
    );
    const [lowStock] = await pool.execute(
      `SELECT COUNT(*) as low_stock_count FROM products WHERE quantity <= low_stock_limit`
    );
    const [invValue] = await pool.execute(
      `SELECT COALESCE(SUM(quantity * cost_price), 0) as inventory_value FROM products`
    );

    res.json({
      bills_today: today[0].bills_today,
      revenue_today: today[0].revenue_today,
      revenue_month: month[0].revenue_month,
      low_stock_count: lowStock[0].low_stock_count,
      inventory_value: invValue[0].inventory_value,
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
    const [rows] = await pool.execute(
      `SELECT
         p.id, p.name, p.category, p.sell_price, p.cost_price,
         COALESCE(SUM(bi.quantity), 0) as units_sold,
         COALESCE(SUM(bi.subtotal), 0) as revenue,
         COALESCE(SUM(bi.subtotal) - SUM(bi.quantity * p.cost_price), 0) as profit
       FROM products p
       LEFT JOIN bill_items bi ON p.id = bi.product_id
       GROUP BY p.id
       ORDER BY units_sold DESC
       LIMIT ?`,
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
    const [rows] = await pool.execute(
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
      sql = `SELECT DATE(created_at) as label,
                    COALESCE(SUM(net_total), 0) as revenue,
                    COUNT(*) as bills
             FROM bills
             WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
             GROUP BY DATE(created_at)
             ORDER BY label ASC`;
    } else if (period === 'month') {
      sql = `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') as label,
                    COALESCE(SUM(net_total), 0) as revenue,
                    COUNT(*) as bills
             FROM bills
             WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
             GROUP BY DATE(created_at)
             ORDER BY label ASC`;
    } else {
      sql = `SELECT DATE_FORMAT(created_at, '%Y-%m') as label,
                    COALESCE(SUM(net_total), 0) as revenue,
                    COUNT(*) as bills
             FROM bills
             WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
             GROUP BY DATE_FORMAT(created_at, '%Y-%m')
             ORDER BY label ASC`;
    }

    const [rows] = await pool.execute(sql);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// GET /api/reports/inventory-value
router.get('/inventory-value', async (req, res) => {
  try {
    const [rows] = await pool.execute(
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
    const [total] = await pool.execute(
      `SELECT
         COALESCE(SUM(quantity * cost_price), 0) as total_cost,
         COALESCE(SUM(quantity * sell_price), 0) as total_sell,
         COUNT(*) as total_products,
         SUM(quantity) as total_units
       FROM products`
    );
    res.json({ byCategory: rows, totals: total[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
