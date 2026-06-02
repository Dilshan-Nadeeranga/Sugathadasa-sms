# Sugathadasa and Sons — Shop Management System (SMS)

A full-stack web application for managing inventory, billing, and sales for **Sugathadasa and Sons**, a toy and general store in Mirigama, Sri Lanka.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite + Tailwind CSS + React Router v6 |
| Backend | Node.js + Express.js (REST API) |
| Database | MySQL (mysql2) |
| Auth | JWT + bcryptjs |
| Charts | Recharts |
| PDF | jsPDF + jspdf-autotable |
| Notifications | react-hot-toast |

---

## Prerequisites

- **Node.js** v18 or higher
- **MySQL** 8.0 or higher (running locally)
- npm v9+

---

## Setup Instructions

### 1. Create the MySQL Database

Open MySQL Workbench or the MySQL CLI and run:

```bash
mysql -u root -p < backend/config/init.sql
```

### 2. Configure Environment Variables

Edit `backend/.env` with your MySQL credentials:

```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=sugathadasa_sms
JWT_SECRET=sugathadasa_sms_jwt_secret_key_2024_secure
JWT_EXPIRES_IN=7d
```

### 3. Install Backend Dependencies & Seed Data

```bash
cd backend
npm install
npm run seed
```

This creates the default owner account and inserts 24 sample products.

### 4. Install Frontend Dependencies

```bash
cd ../frontend
npm install
```

### 5. Start the Application

Open **two terminals**:

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
# Server: http://localhost:5000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
# App: http://localhost:3000
```

Open your browser at **http://localhost:3000**

---

## Default Login Credentials

| Role | Username | Password |
|------|----------|----------|
| Owner | `owner` | `owner123` |
| Staff | `kasun` | `staff123` |

> The **owner** has access to all pages including Reports and can delete products.  
> **Staff** cannot access Reports or delete products.

---

## Features

| Page | Description |
|------|-------------|
| **Dashboard** | Stats cards, 7-day revenue bar chart, category pie chart, top products |
| **Inventory** | Product CRUD, search/filter by category, low-stock highlighting, add/edit modal |
| **Billing/POS** | Live product search, cart, discount input, bill generation, PDF download & print |
| **Sales** | Date-range filter, quick presets, bill table with void option, CSV export |
| **Reports** | Revenue chart (week/month/year), category breakdown, top 10 products, inventory value |

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login — returns JWT |
| GET | `/api/auth/me` | Current user info |

### Products (protected)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | List all (`?search=&category=`) |
| GET | `/api/products/low-stock` | Below low-stock limit |
| POST | `/api/products` | Add product |
| PUT | `/api/products/:id` | Update product |
| DELETE | `/api/products/:id` | Delete (owner only) |

### Bills (protected)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bills` | List bills (`?page=&limit=`) |
| GET | `/api/bills/:id` | Single bill with items |
| POST | `/api/bills` | Create bill (deducts stock) |
| DELETE | `/api/bills/:id` | Void bill (restores stock) |

### Sales (protected)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sales/today` | Today's quick stats |
| GET | `/api/sales/summary` | Summary (`?from=YYYY-MM-DD&to=YYYY-MM-DD`) |

### Reports (owner only)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports/dashboard` | KPI summary |
| GET | `/api/reports/top-products` | Top sellers (`?limit=10`) |
| GET | `/api/reports/by-category` | Sales by category |
| GET | `/api/reports/revenue` | Revenue over time (`?period=week\|month\|year`) |
| GET | `/api/reports/inventory-value` | Stock value by category |

---

## Notes

- All prices in **LKR (Sri Lankan Rupees)**
- Bill format: `BILL-YYYYMMDD-XXX` (auto-incremented daily)
- Dates displayed as `DD/MM/YYYY`
- For **LAN access**: replace `localhost` with the host machine's IP in the browser URL
