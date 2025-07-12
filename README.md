# 🏦 Pawn Repo

**Pawn Repo** streamlines pawnshop operations with automated loan tracking, flexible payment processing, and comprehensive reporting — designed specifically for small to medium pawnshops.

Pawn Repo is a secure, web-based internal application designed for pawnshop staff. It handles daily operations including customer management, transaction tracking, partial payments, and item lifecycle management — all through a modern and efficient dashboard.

🧑‍💼 **Internal Use Only** — Built for a single store with 5–10 staff users.  
🛑 **Not accessible by customers** and not intended for selling forfeited items.

## 🔐 User Roles

### 🛡️ Admin

- Full access to all features
- Can manage users, override settings, and access full logs
- Can modify system-wide configurations

### 👥 Staff

- Can manage customers, items, and transactions
- Can record payments, print receipts, and generate reports
- Cannot manage users or change system-wide configurations

_Only two roles exist: admin and staff. Admins can do everything staff can, and more._

## 🔧 Key Features

### 📋 Customer Management

- **Personal Information**: First name, last name, unique phone number (used for quick lookup)
- **Contact Details**: Optional email address
- **Status Tracking**: Active, Suspended, Banned
- **Internal Notes**: Staff-only notes (not visible to customers or printed on receipts)
- **Transaction History**: Complete customer transaction history
- **Repeat Customer Support**: Profile updates and repeat customer handling

### 💰 Pawn Transactions

- **Multi-Item Support**: Customers can pawn one or more items per transaction
- **Item Indexing**: Items are numbered (1, 2, 3, etc.) within each transaction
- **Individual Item Details**:
  - Description (required for each item)
  - Serial number (optional for each item)
  - Photo (optional for each item)
- **Shared Transaction Details**:
  - Single storage location for entire transaction
  - Internal staff notes apply to the whole transaction, not individual items
- **Status Management**:
  - **Active**: Items are currently pawned and within loan period
  - **Overdue**: Past maturity date but still within grace period
  - **Extended**: Loan has been extended with additional time
  - **Redeemed**: Customer paid in full and retrieved all items
  - **Forfeited**: Items became shop property after 97 days
  - **Sold**: Forfeited items have been sold by the shop
  - **Hold**: Items flagged for review or investigation
  - **Damaged**: Item condition noted as compromised
- **Transaction Example**:
  - 1. Gold ring (SN: none, Photo: none)
  - 2. Dewalt saw (SN: 56288752, Photo: none)
  - 3. Sunglasses (SN: none, Photo: none)
  - Storage: Shelf A-5 (applies to all items)
  - Internal Notes: "Customer needs quick cash for rent" (applies to transaction)
- **Repeat Transactions**: Same items can be pawned again after redemption
- **Independent Processing**: Each transaction is treated independently

### 🔁 Repeat Customer Flexibility

Customers can:

- Pawn same or different items multiple times
- Pawn more or fewer items each visit
- Make multiple transactions over time
- Update their profile information as needed

### 🔢 Loan & Payment Terms

**Staff Input Requirements**:

- Loan amount (manually entered)
- Fixed monthly interest amount (not percentage-based)
- Loan + interest = total due

**Interest Calculation**:

- Fixed monthly fee (not percentage) applies to remaining balance
- Interest accrues monthly regardless of partial payments
- Example: $15/month on $100 balance, then $15/month on remaining balance after payments
- Interest continues on unpaid balance until loan is settled
- Staff can adjust interest amounts to provide customer discounts when requested

**Extension Fees**:

- Staff can enter manual extension fees per 30-day extension
- Fees are customizable per transaction

### 💵 Partial Payment Logic

- **Accepted Anytime**: Payments can be made at any time during loan period
- **Balance Reduction**: Payment amount is subtracted from current total due
- **Continued Interest**: Monthly interest continues to apply on remaining balance
- **Full Logging**: System logs date, amount, and updated balance for each payment
- **Cash Only**: All payments must be made in cash (including extensions)

### 🔁 Extension Logic

- **Flexible Duration**: Customers can extend for 1, 2, or 3 months at a time
- **Monthly Basis**: Each month of extension adds 30 days from the original due date
- **Fees**: Customizable fee can be entered per month of extension
- **Interest**: Monthly interest applies as normal during extension period
- **Timing**: Extensions must be completed before the forfeiture date
- **Multiple Extensions**: Customers can extend multiple times as needed
- **Payment Options**: Extension fees calculated and paid upfront for selected duration
- **Date Calculation**: New maturity date calculated from original due date, not extension date

### 🧾 Receipt Breakdown Examples

#### No Payments Example

| Month | Balance | Interest          | Total Due |
| ----- | ------- | ----------------- | --------- |
| 1     | $100    | +$15 (adjustable) | $115      |
| 2     | $115    | +$15 (adjustable) | $130      |
| 3     | $130    | +$15 (adjustable) | $145      |

_Note: Interest amounts can be modified by staff to provide customer discounts when requested._

#### With Partial Payments Example

| Action           | Balance | Notes                                   |
| ---------------- | ------- | --------------------------------------- |
| Loan Day         | $100    | Start                                   |
| Month 1 Interest | $115    | $15 added (adjustable)                  |
| Payment $50      | $65     | Remaining                               |
| Month 2 Interest | $80     | $15 added to remaining $65 (adjustable) |
| Payment $40      | $40     | Remaining                               |
| Month 3 Interest | $55     | $15 added (adjustable)                  |

_Note: Interest amounts can be modified by staff to provide customer discounts when requested._

### 🔄 Pawn Lifecycle

- **Maturity Period**: 90 days from pawn date
- **Grace Period**: 7 additional days after maturity
- **Forfeiture**: After 97 days with no action → item is forfeited
- **Interest Continuation**: Monthly interest continues based on due date
- **Extension Benefits**: Extension adds 30 days and new fee/interest

#### Lifecycle Summary

✅ **Pick up at any time** within 97 days  
✅ **Make partial payments** anytime  
✅ **Extend loan** if needed  
❌ **No action = forfeiture**

### 🖨️ Receipt Generation

- **Customer Copy**: One printed copy for customer
- **Storage Copy**: One printed copy attached to item for storage
- **Receipt Contents**:
  - Original loan amount
  - Monthly interest applied to date
  - All payments made
  - Current balance due
  - Item status and notes (internal staff notes excluded from customer receipts)
  - Transaction dates and reference numbers

### 📊 Dashboard & Reporting

#### Dashboard Features

- **Live Statistics**: Real-time stats of customer, item, and transaction statuses
- **Quick Search**: Search customers by phone number
- **Status Filters**: Filter by status (active, overdue, forfeited, etc.)
- **Maturity Alerts**: Item maturity countdowns and alerts
- **Activity Overview**: Recent transactions and upcoming due dates

#### Reports

- **Time Periods**: Daily, Monthly, Yearly reports
- **Content**: Staff activity summaries and item movement tracking
- **Export Options**: PDF format for printing and review
- **Business Intelligence**: Performance metrics and trends
- **End of Day Report**:
  - Total cash disbursed in loans
  - Cash collected from payments and redemptions
  - Money transferred to safe (outgoing from till)
  - Money received from safe (incoming to till)
  - Current cash in till/register
  - Net cash flow for the day (handles positive/negative amounts)
  - Outstanding loan amounts
  - Cash needed for next day operations
  - Daily reconciliation summary with variance tracking

### 🗂️ Audit Trail

Complete logging of every action including:

- **Customer Management**: Creation, edits, and status changes
- **Transactions**: New pawns, item changes, and updates
- **Payments**: Partial payments, full payments, and extensions
- **Forfeitures**: Automatic and manual forfeitures
- **User Tracking**: User who performed each action
- **Timestamps**: Precise date and time for all activities
- **Data Integrity**: Immutable audit logs for compliance

## 🔒 Security

- **Login System**: Simple 2-digit user ID and 4-digit PIN authentication
- **Data Encryption**: All data encrypted in transit and at rest
- **Role-Based Access**: Strict access controls based on user roles
- **Audit Logging**: Complete activity tracking for compliance
- **Secure Authentication**: Protected login system with PIN-based access
- **Regular Updates**: Ongoing security patches and updates
- **Data Backup**: Automated backup and recovery procedures

## 🧰 Tech Stack

- **Backend**: FastAPI (Python)
- **Frontend**: React (JavaScript)
- **Database**: MongoDB
- **Authentication**: Role-based access control with PIN system
- **Security**: Encrypted data transmission and storage

## 🚀 Key Benefits

- **Efficiency**: Streamlined workflows for daily pawn shop operations
- **Accuracy**: Automated calculations reduce human error
- **Compliance**: Built-in audit trails and record-keeping
- **Flexibility**: Supports various payment and extension scenarios
- **User-Friendly**: Intuitive interface designed for pawn shop staff
- **Scalable**: Can handle growing transaction volumes

## 📝 Notes

- This application is designed for internal staff use only
- All financial transactions are tracked and logged
- Receipt printing capabilities integrated
- Data backup and security measures implemented
- Regular updates and maintenance included
