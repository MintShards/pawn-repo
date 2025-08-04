# Pawn Repo

## 🌟 Goal

Deliver a fully functional **pawnshop operations system** for internal staff use, focusing on **customer management, pawn transactions, loan tracking, partial payments, and audit logs** — accessible via a secure web dashboard.

---

## 🏗️Core Features

### 1. User Roles & Authentication

- **User Login**: 2-digit User ID + 4-digit PIN
- **Roles**: Admin & Staff
  - Admin: Full access (incl. user management, settings)
  - Staff: Limited to daily operations
- **Role-Based Access Control** (RBAC)
- **Audit Logs**: Track all user actions with timestamps

### 2. Customer Management Module

- Create & edit customer profiles:
  - First name, last name, unique phone number
  - Optional email
  - Status: Active / Suspended / Banned
  - Internal staff notes (staff-only)
- View complete transaction history per customer
- Quick search by phone number

### 3. Pawn Transaction Management

- Create new pawn transaction with multiple items:
  - Required: Item description
  - Optional: Serial number
  - Shared details: Storage location, transaction notes
- Item & transaction statuses:
  - Active, Overdue, Extended, Redeemed, Forfeited, Sold, Hold, Damaged
- Status updates based on loan lifecycle rules (97-day forfeiture logic)
- Repeat transaction handling (same or different items)

### 4. Loan & Payment Tracking

- Staff enters:
  - Loan Amount (manual input)
  - Fixed Monthly Interest (manual input per transaction)
- Partial Payments:
  - Accept anytime
  - Update remaining balance
  - Continue accruing interest on unpaid balance
  - Cash-only (payment entry log)
- Extensions:
  - Manual entry of fee
  - Add 30/60/90 days from original maturity date
  - Calculate new due date
- Full Payment/Redemption logic

### 5. Receipt Generation (Print View)

- Print receipts:
  - Customer copy
  - Storage copy
- Breakdown includes:
  - Loan amount, interest accrued, payments made, current balance
  - Item details & statuses
  - Exclude internal staff notes on customer copy
  - Reference numbers & transaction dates

### 6. Dashboard & Reports

- Dashboard:
  - Real-time stats (active, overdue, forfeited items)
  - Maturity countdown alerts
  - Quick search & status filters
  - Activity overview (recent transactions)
- Reports:
  - Daily report (End-of-day cash flow)
  - Export to PDF
  - Metrics: Loans disbursed, payments collected, till cash, outstanding loans

### 7. Audit Trail & Compliance

- Immutable logs for:
  - Customer creations/updates
  - Transactions & item status changes
  - Payments & extensions
  - Forfeitures (auto/manual)
- User and timestamp logging for every action

### 8. Security & Data Integrity

- Data encryption (at rest & in transit)
- Role-based access controls
- Automated data backups
- PIN-based secure login

---

## 🕁️ MVP Tech Stack (As Per README)

- **Frontend**: React (JavaScript)
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Authentication**: Simple PIN-based role access
- **Receipts & Reports**: PDF export and print views
- **Deployment**: Internal network or private cloud

---

## 🏁 MVP Success Criteria

- Staff can perform daily pawnshop operations end-to-end through the system.
- Admins can manage users and system configurations.
- Transactions, payments, and item statuses are accurately tracked and reflected in reports.
- Receipts can be printed after every transaction.
- Audit logs are reliable and accessible.
- System is stable for 5–10 concurrent staff users.

---
