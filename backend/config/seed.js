const bcrypt = require('bcryptjs');
const { pool } = require('./db');
require('dotenv').config({ path: '../.env' });

async function seed() {
  try {
    const ownerHash = await bcrypt.hash('owner123', 10);
    const staffHash = await bcrypt.hash('staff123', 10);

    await pool.query(
      'INSERT INTO users (name, role, username, password_hash) VALUES ($1, $2, $3, $4) ON CONFLICT (username) DO NOTHING',
      ['Shop Owner', 'owner', 'owner', ownerHash]
    );
    await pool.query(
      'INSERT INTO users (name, role, username, password_hash) VALUES ($1, $2, $3, $4) ON CONFLICT (username) DO NOTHING',
      ['Kasun Perera', 'staff', 'kasun', staffHash]
    );

    const products = [
      // Toys
      ['LEGO Classic Set (100 pcs)', 'Toys', 850.00, 1200.00, 30, 5],
      ['Remote Control Car', 'Toys', 1500.00, 2200.00, 15, 3],
      ['Barbie Doll', 'Toys', 600.00, 950.00, 25, 5],
      ['Puzzle 500 pcs', 'Toys', 450.00, 700.00, 20, 5],
      ['Cricket Bat (Junior)', 'Toys', 800.00, 1300.00, 10, 3],
      ['Toy Kitchen Set', 'Toys', 1200.00, 1900.00, 8, 3],
      ['Building Blocks Set', 'Toys', 550.00, 850.00, 22, 5],

      // Stationery
      ['A4 Exercise Book (100 pages)', 'Stationery', 45.00, 75.00, 150, 20],
      ['Blue Ink Pen (10 pack)', 'Stationery', 80.00, 130.00, 80, 15],
      ['Pencil Box Set', 'Stationery', 180.00, 290.00, 40, 10],
      ['Geometry Box', 'Stationery', 220.00, 350.00, 35, 10],
      ['Color Pencils (24 shades)', 'Stationery', 250.00, 400.00, 30, 8],
      ['Stapler with Pins', 'Stationery', 320.00, 500.00, 20, 5],
      ['A4 Paper Ream (500 sheets)', 'Stationery', 700.00, 1050.00, 40, 10],

      // General
      ['Scotch Tape Roll', 'General', 60.00, 95.00, 60, 10],
      ['AA Batteries (4 pack)', 'General', 180.00, 280.00, 45, 10],
      ['Extension Cord (5m)', 'General', 550.00, 850.00, 15, 5],
      ['LED Torch Light', 'General', 300.00, 480.00, 20, 5],
      ['Umbrella (Standard)', 'General', 400.00, 650.00, 18, 5],

      // Household
      ['Floor Mop Set', 'Household', 480.00, 750.00, 12, 3],
      ['Plastic Storage Box (Large)', 'Household', 350.00, 550.00, 20, 5],
      ['Dish Wash Liquid 500ml', 'Household', 120.00, 190.00, 50, 10],
      ['Garbage Bags (30 pcs)', 'Household', 95.00, 150.00, 60, 10],
      ['Hand Sanitizer 500ml', 'Household', 280.00, 430.00, 35, 8],
    ];

    for (const p of products) {
      await pool.query(
        'INSERT INTO products (name, category, cost_price, sell_price, quantity, low_stock_limit) VALUES ($1, $2, $3, $4, $5, $6)',
        p
      );
    }

    console.log('✅ Seed completed successfully');
    console.log('   Owner login: username=owner, password=owner123');
    console.log('   Staff login: username=kasun,  password=staff123');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
}

seed();
