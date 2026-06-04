const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/db');
const { auth } = require('../middleware/auth');

// Generate bill number: BILL-YYYYMMDD-XXX
async function generateBillNumber(client) {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const dateStr = `${y}${m}${d}`;
  const prefix = `BILL-${dateStr}-`;

  const result = await client.query(
    "SELECT bill_number FROM bills WHERE bill_number LIKE $1 ORDER BY bill_number DESC LIMIT 1",
    [`${prefix}%`]
  );
  const rows = result.rows;

  let seq = 1;
  if (rows.length > 0) {
    const last = rows[0].bill_number;
    seq = parseInt(last.split('-')[2], 10) + 1;
  }

  return `${prefix}${String(seq).padStart(3, '0')}`;
}

// GET /api/bills
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const { rows } = await pool.query(
      `SELECT b.*, u.name as staff_name
       FROM bills b
       LEFT JOIN users u ON b.staff_id = u.id
       ORDER BY b.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await pool.query('SELECT COUNT(*) as total FROM bills');
    const total = parseInt(countResult.rows[0].total);

    res.json({ bills: rows, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// GET /api/bills/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const billsResult = await pool.query(
      `SELECT b.*, u.name as staff_name
       FROM bills b
       LEFT JOIN users u ON b.staff_id = u.id
       WHERE b.id = $1`,
      [req.params.id]
    );
    if (billsResult.rows.length === 0) return res.status(404).json({ message: 'Bill not found.' });

    const itemsResult = await pool.query(
      `SELECT bi.*, p.name as product_name, p.category
       FROM bill_items bi
       JOIN products p ON bi.product_id = p.id
       WHERE bi.bill_id = $1`,
      [req.params.id]
    );

    res.json({ ...billsResult.rows[0], items: itemsResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// POST /api/bills
router.post(
  '/',
  auth,
  [
    body('items').isArray({ min: 1 }).withMessage('At least one item required'),
    body('items.*.product_id').isInt({ min: 1 }),
    body('items.*.quantity').isInt({ min: 1 }),
    body('discount').optional().isFloat({ min: 0 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { items, discount = 0 } = req.body;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      let totalAmount = 0;
      const enrichedItems = [];

      for (const item of items) {
        const productsResult = await client.query(
          'SELECT * FROM products WHERE id = $1 FOR UPDATE',
          [item.product_id]
        );
        if (productsResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ message: `Product ID ${item.product_id} not found.` });
        }

        const product = productsResult.rows[0];
        if (product.quantity < item.quantity) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            message: `Insufficient stock for "${product.name}". Available: ${product.quantity}`,
          });
        }

        const subtotal = parseFloat(product.sell_price) * item.quantity;
        totalAmount += subtotal;
        enrichedItems.push({ ...item, unit_price: product.sell_price, subtotal, product });
      }

      const netTotal = Math.max(0, totalAmount - parseFloat(discount));
      const billNumber = await generateBillNumber(client);

      const billResult = await client.query(
        'INSERT INTO bills (bill_number, total_amount, discount, net_total, staff_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [billNumber, totalAmount, discount, netTotal, req.user.id]
      );
      const billId = billResult.rows[0].id;

      for (const item of enrichedItems) {
        await client.query(
          'INSERT INTO bill_items (bill_id, product_id, quantity, unit_price, subtotal) VALUES ($1, $2, $3, $4, $5)',
          [billId, item.product_id, item.quantity, item.unit_price, item.subtotal]
        );
        await client.query(
          'UPDATE products SET quantity = quantity - $1 WHERE id = $2',
          [item.quantity, item.product_id]
        );
      }

      await client.query('COMMIT');

      const billsResult = await client.query(
        `SELECT b.*, u.name as staff_name
         FROM bills b LEFT JOIN users u ON b.staff_id = u.id
         WHERE b.id = $1`,
        [billId]
      );
      const billItemsResult = await client.query(
        `SELECT bi.*, p.name as product_name, p.category
         FROM bill_items bi JOIN products p ON bi.product_id = p.id
         WHERE bi.bill_id = $1`,
        [billId]
      );

      res.status(201).json({ ...billsResult.rows[0], items: billItemsResult.rows });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      res.status(500).json({ message: 'Server error.' });
    } finally {
      client.release();
    }
  }
);

// DELETE /api/bills/:id (void bill, restore stock)
router.delete('/:id', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const billsResult = await client.query('SELECT * FROM bills WHERE id = $1', [req.params.id]);
    if (billsResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Bill not found.' });
    }

    const itemsResult = await client.query('SELECT * FROM bill_items WHERE bill_id = $1', [req.params.id]);

    for (const item of itemsResult.rows) {
      await client.query(
        'UPDATE products SET quantity = quantity + $1 WHERE id = $2',
        [item.quantity, item.product_id]
      );
    }

    await client.query('DELETE FROM bills WHERE id = $1', [req.params.id]);
    await client.query('COMMIT');

    res.json({ message: 'Bill voided and stock restored.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  } finally {
    client.release();
  }
});

module.exports = router;
