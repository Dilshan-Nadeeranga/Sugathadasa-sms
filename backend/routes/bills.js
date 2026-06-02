const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/db');
const { auth } = require('../middleware/auth');

// Generate bill number: BILL-YYYYMMDD-XXX
async function generateBillNumber(conn) {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const dateStr = `${y}${m}${d}`;
  const prefix = `BILL-${dateStr}-`;

  const [rows] = await conn.execute(
    "SELECT bill_number FROM bills WHERE bill_number LIKE ? ORDER BY bill_number DESC LIMIT 1",
    [`${prefix}%`]
  );

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

    const [rows] = await pool.execute(
      `SELECT b.*, u.name as staff_name
       FROM bills b
       LEFT JOIN users u ON b.staff_id = u.id
       ORDER BY b.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [countRows] = await pool.execute('SELECT COUNT(*) as total FROM bills');
    const total = countRows[0].total;

    res.json({ bills: rows, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// GET /api/bills/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const [bills] = await pool.execute(
      `SELECT b.*, u.name as staff_name
       FROM bills b
       LEFT JOIN users u ON b.staff_id = u.id
       WHERE b.id = ?`,
      [req.params.id]
    );
    if (bills.length === 0) return res.status(404).json({ message: 'Bill not found.' });

    const [items] = await pool.execute(
      `SELECT bi.*, p.name as product_name, p.category
       FROM bill_items bi
       JOIN products p ON bi.product_id = p.id
       WHERE bi.bill_id = ?`,
      [req.params.id]
    );

    res.json({ ...bills[0], items });
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
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      // Validate stock and calculate totals
      let totalAmount = 0;
      const enrichedItems = [];

      for (const item of items) {
        const [products] = await conn.execute(
          'SELECT * FROM products WHERE id = ? FOR UPDATE',
          [item.product_id]
        );
        if (products.length === 0) {
          await conn.rollback();
          return res.status(400).json({ message: `Product ID ${item.product_id} not found.` });
        }

        const product = products[0];
        if (product.quantity < item.quantity) {
          await conn.rollback();
          return res.status(400).json({
            message: `Insufficient stock for "${product.name}". Available: ${product.quantity}`,
          });
        }

        const subtotal = parseFloat(product.sell_price) * item.quantity;
        totalAmount += subtotal;
        enrichedItems.push({ ...item, unit_price: product.sell_price, subtotal, product });
      }

      const netTotal = Math.max(0, totalAmount - parseFloat(discount));
      const billNumber = await generateBillNumber(conn);

      // Insert bill
      const [billResult] = await conn.execute(
        'INSERT INTO bills (bill_number, total_amount, discount, net_total, staff_id) VALUES (?, ?, ?, ?, ?)',
        [billNumber, totalAmount, discount, netTotal, req.user.id]
      );
      const billId = billResult.insertId;

      // Insert items and deduct stock
      for (const item of enrichedItems) {
        await conn.execute(
          'INSERT INTO bill_items (bill_id, product_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?)',
          [billId, item.product_id, item.quantity, item.unit_price, item.subtotal]
        );
        await conn.execute(
          'UPDATE products SET quantity = quantity - ? WHERE id = ?',
          [item.quantity, item.product_id]
        );
      }

      await conn.commit();

      // Return full bill
      const [bills] = await conn.execute(
        `SELECT b.*, u.name as staff_name
         FROM bills b LEFT JOIN users u ON b.staff_id = u.id
         WHERE b.id = ?`,
        [billId]
      );
      const [billItems] = await conn.execute(
        `SELECT bi.*, p.name as product_name, p.category
         FROM bill_items bi JOIN products p ON bi.product_id = p.id
         WHERE bi.bill_id = ?`,
        [billId]
      );

      res.status(201).json({ ...bills[0], items: billItems });
    } catch (err) {
      await conn.rollback();
      console.error(err);
      res.status(500).json({ message: 'Server error.' });
    } finally {
      conn.release();
    }
  }
);

// DELETE /api/bills/:id (void bill, restore stock)
router.delete('/:id', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [bills] = await conn.execute('SELECT * FROM bills WHERE id = ?', [req.params.id]);
    if (bills.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Bill not found.' });
    }

    const [items] = await conn.execute('SELECT * FROM bill_items WHERE bill_id = ?', [req.params.id]);

    for (const item of items) {
      await conn.execute(
        'UPDATE products SET quantity = quantity + ? WHERE id = ?',
        [item.quantity, item.product_id]
      );
    }

    await conn.execute('DELETE FROM bills WHERE id = ?', [req.params.id]);
    await conn.commit();

    res.json({ message: 'Bill voided and stock restored.' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  } finally {
    conn.release();
  }
});

module.exports = router;
