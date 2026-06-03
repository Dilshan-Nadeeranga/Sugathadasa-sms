const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/db');
const { auth, ownerOnly } = require('../middleware/auth');

// GET /api/products
router.get('/', auth, async (req, res) => {
  try {
    const { search = '', category = '' } = req.query;
    let sql = 'SELECT * FROM products WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (search) {
      sql += ` AND name ILIKE $${paramCount}`;
      params.push(`%${search}%`);
      paramCount++;
    }
    if (category) {
      sql += ` AND category = $${paramCount}`;
      params.push(category);
    }
    sql += ' ORDER BY name ASC';

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// GET /api/products/low-stock
router.get('/low-stock', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM products WHERE quantity <= low_stock_limit ORDER BY quantity ASC'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// POST /api/products
router.post(
  '/',
  auth,
  [
    body('name').trim().notEmpty().withMessage('Product name is required'),
    body('category').trim().notEmpty().withMessage('Category is required'),
    body('cost_price').isFloat({ min: 0 }).withMessage('Valid cost price required'),
    body('sell_price').isFloat({ min: 0 }).withMessage('Valid sell price required'),
    body('quantity').isInt({ min: 0 }).withMessage('Valid quantity required'),
    body('low_stock_limit').optional().isInt({ min: 0 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, category, cost_price, sell_price, quantity, low_stock_limit = 5 } = req.body;

    try {
      const insertResult = await pool.query(
        'INSERT INTO products (name, category, cost_price, sell_price, quantity, low_stock_limit) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [name, category, cost_price, sell_price, quantity, low_stock_limit]
      );
      const newId = insertResult.rows[0].id;
      const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [newId]);
      res.status(201).json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error.' });
    }
  }
);

// PUT /api/products/:id
router.put(
  '/:id',
  auth,
  [
    body('name').trim().notEmpty().withMessage('Product name is required'),
    body('category').trim().notEmpty().withMessage('Category is required'),
    body('cost_price').isFloat({ min: 0 }).withMessage('Valid cost price required'),
    body('sell_price').isFloat({ min: 0 }).withMessage('Valid sell price required'),
    body('quantity').isInt({ min: 0 }).withMessage('Valid quantity required'),
    body('low_stock_limit').optional().isInt({ min: 0 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, category, cost_price, sell_price, quantity, low_stock_limit = 5 } = req.body;

    try {
      const check = await pool.query('SELECT id FROM products WHERE id = $1', [req.params.id]);
      if (check.rows.length === 0) return res.status(404).json({ message: 'Product not found.' });

      await pool.query(
        'UPDATE products SET name=$1, category=$2, cost_price=$3, sell_price=$4, quantity=$5, low_stock_limit=$6 WHERE id=$7',
        [name, category, cost_price, sell_price, quantity, low_stock_limit, req.params.id]
      );
      const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
      res.json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error.' });
    }
  }
);

// DELETE /api/products/:id (owner only)
router.delete('/:id', auth, ownerOnly, async (req, res) => {
  try {
    const check = await pool.query('SELECT id FROM products WHERE id = $1', [req.params.id]);
    if (check.rows.length === 0) return res.status(404).json({ message: 'Product not found.' });

    await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    res.json({ message: 'Product deleted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
