# ETDOX Procurement Platform

An enterprise procurement and spend-management platform designed to manage the complete procurement lifecycle from **Purchase Request → Approval → Supplier → Purchase Order → Receipt → Invoice → 3-Way Matching → Payment Ready**.

The platform is built with a simple full-stack architecture using **React.js**, **Node.js**, **Express.js**, and **PostgreSQL**.

---

## 📌 Project Overview

ETDOX provides a centralized platform for managing procurement operations, suppliers, purchase orders, receipts, invoices, budgets, approvals, analytics, notifications, users, and audit records.

The system is designed around a modular structure so that each procurement function can be developed and maintained independently while remaining part of a single application.

### Core Objectives

* Manage purchase requests
* Handle approval workflows
* Manage suppliers
* Create and manage purchase orders
* Record goods and service receipts
* Manage invoices
* Support 3-way matching
* Track budgets
* Provide procurement analytics
* Manage users and permissions
* Maintain notifications
* Maintain audit logs

---

# 🏗️ System Architecture

The ETDOX platform follows a simple full-stack architecture:

```text
                    ETDOX PROCUREMENT PLATFORM
                              │
                              ▼
                     ┌─────────────────┐
                     │ React Frontend  │
                     │                 │
                     │ Pages           │
                     │ Components      │
                     │ Context         │
                     │ API Service     │
                     └────────┬────────┘
                              │
                         REST API
                              │
                              ▼
                     ┌─────────────────┐
                     │ Node.js +       │
                     │ Express.js      │
                     │                 │
                     │ Routes          │
                     │ Controllers     │
                     │ Services       │
                     │ Middleware      │
                     └────────┬────────┘
                              │
                         SQL Queries
                              │
                              ▼
                     ┌─────────────────┐
                     │   PostgreSQL    │
                     │                 │
                     │ Users           │
                     │ Procurement     │
                     │ Suppliers       │
                     │ Orders          │
                     │ Receipts       │
                     │ Invoices        │
                     │ Budgets         │
                     │ Audit Logs      │
                     └─────────────────┘
```

---

# 💻 Technology Stack

## Frontend

* React.js
* React Router
* Axios
* JavaScript
* HTML5
* CSS3

## Backend

* Node.js
* Express.js
* REST API
* JWT Authentication
* bcrypt
* dotenv
* express-validator
* CORS

## Database

* PostgreSQL
* SQL
* Database migrations/schema
* Relational data model

---

# 📂 Project Structure

```text
ETDOX/
│
├── frontend/
│   │
│   ├── public/
│   │   └── logo.png
│   │
│   ├── src/
│   │   │
│   │   ├── assets/
│   │   │   └── images/
│   │   │
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── Button.jsx
│   │   │   ├── Card.jsx
│   │   │   ├── Table.jsx
│   │   │   └── Modal.jsx
│   │   │
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── PurchaseRequests.jsx
│   │   │   ├── Approvals.jsx
│   │   │   ├── Suppliers.jsx
│   │   │   ├── PurchaseOrders.jsx
│   │   │   ├── Receipts.jsx
│   │   │   ├── Invoices.jsx
│   │   │   ├── Budgets.jsx
│   │   │   ├── Analytics.jsx
│   │   │   ├── Notifications.jsx
│   │   │   ├── Users.jsx
│   │   │   ├── Settings.jsx
│   │   │   └── AuditLogs.jsx
│   │   │
│   │   ├── services/
│   │   │   └── api.js
│   │   │
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   │
│   │   ├── styles/
│   │   │   ├── App.css
│   │   │   ├── Navbar.css
│   │   │   ├── Sidebar.css
│   │   │   ├── Dashboard.css
│   │   │   └── Pages.css
│   │   │
│   │   ├── App.jsx
│   │   └── main.jsx
│   │
│   ├── package.json
│   ├── vite.config.js
│   └── .env
│
├── backend/
│   │
│   ├── src/
│   │   │
│   │   ├── config/
│   │   │   └── db.js
│   │   │
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── dashboardController.js
│   │   │   ├── purchaseRequestController.js
│   │   │   ├── approvalController.js
│   │   │   ├── supplierController.js
│   │   │   ├── purchaseOrderController.js
│   │   │   ├── receiptController.js
│   │   │   ├── invoiceController.js
│   │   │   ├── budgetController.js
│   │   │   ├── analyticsController.js
│   │   │   ├── notificationController.js
│   │   │   ├── userController.js
│   │   │   ├── settingsController.js
│   │   │   └── auditController.js
│   │   │
│   │   ├── routes/
│   │   │   ├── authRoutes.js
│   │   │   ├── dashboardRoutes.js
│   │   │   ├── purchaseRequestRoutes.js
│   │   │   ├── approvalRoutes.js
│   │   │   ├── supplierRoutes.js
│   │   │   ├── purchaseOrderRoutes.js
│   │   │   ├── receiptRoutes.js
│   │   │   ├── invoiceRoutes.js
│   │   │   ├── budgetRoutes.js
│   │   │   ├── analyticsRoutes.js
│   │   │   ├── notificationRoutes.js
│   │   │   ├── userRoutes.js
│   │   │   ├── settingsRoutes.js
│   │   │   └── auditRoutes.js
│   │   │
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── Organization.js
│   │   │   ├── PurchaseRequest.js
│   │   │   ├── Approval.js
│   │   │   ├── Supplier.js
│   │   │   ├── PurchaseOrder.js
│   │   │   ├── Receipt.js
│   │   │   ├── Invoice.js
│   │   │   ├── Budget.js
│   │   │   ├── Notification.js
│   │   │   └── AuditLog.js
│   │   │
│   │   ├── middleware/
│   │   │   ├── authMiddleware.js
│   │   │   ├── roleMiddleware.js
│   │   │   └── errorMiddleware.js
│   │   │
│   │   ├── services/
│   │   │   ├── authService.js
│   │   │   ├── procurementService.js
│   │   │   ├── approvalService.js
│   │   │   ├── invoiceService.js
│   │   │   └── notificationService.js
│   │   │
│   │   ├── utils/
│   │   │   ├── generateToken.js
│   │   │   └── response.js
│   │   │
│   │   ├── app.js
│   │   └── server.js
│   │
│   ├── database/
│   │   ├── schema.sql
│   │   └── seed.sql
│   │
│   ├── .env
│   └── package.json
│
└── README.md
```

---

# 🎨 Frontend Architecture

The frontend is developed using React.js.

The frontend is divided into:

```text
React Application
│
├── Pages
├── Components
├── Services
├── Context
├── Assets
└── Styles
```

## Pages

The main application pages include:

| Page              | Purpose                        |
| ----------------- | ------------------------------ |
| Login             | User authentication            |
| Dashboard         | Procurement overview           |
| Purchase Requests | Create and manage requests     |
| Approvals         | Review and approve requests    |
| Suppliers         | Manage supplier information    |
| Purchase Orders   | Create and manage POs          |
| Receipts          | Record received goods/services |
| Invoices          | Manage invoices                |
| Budgets           | Monitor budgets                |
| Analytics         | Procurement and spend insights |
| Notifications     | User notifications             |
| Users             | User management                |
| Settings          | Application configuration      |
| Audit Logs        | Activity and audit history     |

---

# 🧩 React Components

The application uses reusable React components.

### Navbar

Provides:

* Application navigation
* User profile
* Notifications
* Account actions

### Sidebar

Provides navigation to:

* Dashboard
* Procurement
* Suppliers
* Purchase Orders
* Receipts
* Invoices
* Budgets
* Analytics
* Administration

### Button

Reusable action buttons for:

* Create
* Save
* Submit
* Approve
* Reject
* Cancel
* Edit
* Delete

### Card

Used for:

* Dashboard statistics
* Procurement summaries
* Budget information
* Spend information

### Table

Used for displaying:

* Purchase requests
* Suppliers
* Purchase orders
* Receipts
* Invoices
* Users
* Audit logs

### Modal

Used for:

* Create forms
* Edit forms
* Confirmation dialogs
* Approval actions
* Delete confirmation

---

# 🔄 Main React Flow

```text
User
  │
  ▼
App.jsx
  │
  ▼
React Router
  │
  ▼
Required Page
  │
  ├── Dashboard
  ├── Purchase Requests
  ├── Approvals
  ├── Suppliers
  ├── Purchase Orders
  ├── Receipts
  └── Invoices
  │
  ▼
Reusable Components
  │
  ├── Table
  ├── Form
  ├── Button
  ├── Card
  └── Modal
  │
  ▼
services/api.js
  │
  ▼
REST API
```

### Example

When a user creates a purchase request:

```text
User fills Purchase Request form
              ↓
React Page
              ↓
Form Component
              ↓
api.js
              ↓
POST /api/v1/purchase-requests
              ↓
Express Backend
              ↓
Controller
              ↓
Procurement Service
              ↓
PostgreSQL
              ↓
Response
              ↓
React UI
              ↓
Request Created Successfully
```

---

# ⚙️ Backend Architecture

The backend uses Node.js and Express.js.

```text
Backend
│
├── Routes
│
├── Controllers
│
├── Services
│
├── Models / Database Access
│
├── Middleware
│
└── Utilities
```

## Routes

Routes define the API endpoints.

Example:

```text
POST /api/v1/auth/login

GET /api/v1/purchase-requests

POST /api/v1/purchase-requests

GET /api/v1/purchase-requests/:id

PUT /api/v1/purchase-requests/:id
```

## Controllers

Controllers handle incoming requests and send responses.

Example:

```text
Request
   ↓
Controller
   ↓
Validate input
   ↓
Call Service
   ↓
Return Response
```

## Services

Services contain the main business logic.

Examples:

* Authentication service
* Procurement service
* Approval service
* Invoice service
* Notification service

## Middleware

Middleware handles common backend requirements such as:

* Authentication
* Role checking
* Permission checking
* Error handling
* Request validation

---

# 🔌 Main API Structure

All APIs use the `/api/v1` prefix.

## Authentication

```text
POST /api/v1/auth/login
POST /api/v1/auth/register
```

## Dashboard

```text
GET /api/v1/dashboard
```

## Purchase Requests

```text
GET    /api/v1/purchase-requests
POST   /api/v1/purchase-requests
GET    /api/v1/purchase-requests/:id
PUT    /api/v1/purchase-requests/:id
DELETE /api/v1/purchase-requests/:id
```

## Approvals

```text
GET /api/v1/approvals
PUT /api/v1/approvals/:id
```

## Suppliers

```text
GET  /api/v1/suppliers
POST /api/v1/suppliers
```

## Purchase Orders

```text
GET  /api/v1/purchase-orders
POST /api/v1/purchase-orders
```

## Receipts

```text
GET  /api/v1/receipts
POST /api/v1/receipts
```

## Invoices

```text
GET  /api/v1/invoices
POST /api/v1/invoices
```

## Budgets

```text
GET /api/v1/budgets
```

## Analytics

```text
GET /api/v1/analytics
```

## Notifications

```text
GET /api/v1/notifications
```

## Users

```text
GET  /api/v1/users
POST /api/v1/users
```

## Audit Logs

```text
GET /api/v1/audit-logs
```

---

# 🗄️ PostgreSQL Database

PostgreSQL is used as the main transactional database.

## Main Tables

```text
users
organizations
memberships
roles
permissions

departments
cost_centers

suppliers
supplier_contacts

purchase_requests
purchase_request_items

approvals

purchase_orders
purchase_order_items

receipts
receipt_items

invoices
invoice_items

budgets

notifications

audit_logs
```

---

# 🏦 Database Relationship Concept

```text
Organization
     │
     ├── Users
     │
     ├── Departments
     │
     ├── Cost Centers
     │
     ├── Suppliers
     │
     └── Procurement
             │
             ├── Purchase Request
             │       │
             │       └── Approval
             │
             ├── Purchase Order
             │       │
             │       └── Receipt
             │
             └── Invoice
                     │
                     └── 3-Way Match
```

---

# 🔄 Main Procurement Flow

ETDOX follows the main procurement lifecycle:

```text
Purchase Request
       │
       ▼
Approval
       │
       ▼
Supplier
       │
       ▼
Purchase Order
       │
       ▼
Receipt
       │
       ▼
Invoice
       │
       ▼
3-Way Matching
       │
       ▼
Payment Ready
```

## 1. Purchase Request

A requester creates a purchase request containing information such as:

* Items
* Quantity
* Price
* Department
* Cost center
* Justification

---

## 2. Approval

The request is submitted for approval.

The approval process can involve:

```text
Requester
    ↓
Manager
    ↓
Procurement / Finance
    ↓
Approved
```

Depending on configured rules, the request can also be rejected or returned for changes.

---

## 3. Supplier

The procurement team selects or manages the supplier associated with the purchase.

Supplier information can include:

* Supplier name
* Supplier code
* Contact information
* Status
* Tax information

---

## 4. Purchase Order

After approval, a Purchase Order can be created.

```text
Approved Request
       ↓
Purchase Order
       ↓
PO Issued
```

The PO contains the items, quantities, prices and supplier information.

---

## 5. Receipt

When goods or services are received, the receiving information is recorded.

```text
Purchase Order
      ↓
Goods / Services Received
      ↓
Receipt Created
```

---

## 6. Invoice

The supplier invoice is captured and validated.

```text
Supplier Invoice
       ↓
Invoice Validation
       ↓
Invoice Record
```

---

# 🔍 3-Way Matching

The platform compares three important records:

```text
              ┌────────────────┐
              │ Purchase Order │
              └───────┬────────┘
                      │
              ┌───────▼────────┐
              │    Receipt     │
              └───────┬────────┘
                      │
              ┌───────▼────────┐
              │    Invoice     │
              └───────┬────────┘
                      │
                      ▼
                3-Way Match
                      │
              ┌───────┴────────┐
              │                │
            Match           Exception
              │                │
              ▼                ▼
        Payment Ready     Review / Resolve
```

The purpose of 3-way matching is to compare the **Purchase Order, Receipt and Invoice** before the transaction proceeds to the payment-ready stage.

---

# 🔐 Security and Access

The platform includes server-side access control concepts.

### Authentication

JWT-based authentication can be used to identify logged-in users.

### Authorization

Different users can have different permissions.

Example roles include:

```text
Requester
Manager
Procurement Specialist
Procurement Manager
Finance Manager
Organization Admin
Auditor
Supplier User
```

### Audit

Important business actions can be recorded in the audit log.

Examples:

```text
Purchase Request Created
Purchase Request Approved
Purchase Request Rejected
Purchase Order Issued
Invoice Validated
Budget Updated
User Permission Changed
```

---

# 🔗 Complete Application Flow

```text
                         USER
                           │
                           ▼
                  ┌─────────────────┐
                  │ React Frontend  │
                  │                 │
                  │ Pages           │
                  │ Components      │
                  │ Forms           │
                  │ Tables          │
                  └────────┬────────┘
                           │
                           ▼
                    Axios / REST API
                           │
                           ▼
                  ┌─────────────────┐
                  │ Express Server  │
                  │                 │
                  │ Routes          │
                  │ Middleware      │
                  │ Controllers     │
                  │ Services        │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │   PostgreSQL    │
                  │                 │
                  │ Procurement     │
                  │ Suppliers       │
                  │ Orders          │
                  │ Receipts        │
                  │ Invoices        │
                  │ Budgets         │
                  │ Audit Logs      │
                  └─────────────────┘
```

---

# 🚀 Getting Started

## 1. Clone the Repository

```bash
git clone <repository-url>
cd ETDOX
```

---

# Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The React development server will start using the Vite development environment.

---

# Backend Setup

Open another terminal:

```bash
cd backend
npm install
npm run dev
```

---

# PostgreSQL Setup

Create a PostgreSQL database:

```sql
CREATE DATABASE etdox;
```

Configure the backend `.env` file:

```env
PORT=5000

DATABASE_URL=postgresql://postgres:password@localhost:5432/etdox

JWT_SECRET=your_secret_key
```

Run the database schema:

```bash
psql -U postgres -d etdox -f database/schema.sql
```

If seed data is available:

```bash
psql -U postgres -d etdox -f database/seed.sql
```

---

# 🔑 Environment Variables

## Backend

```env
PORT=5000
DATABASE_URL=your_postgresql_connection_string
JWT_SECRET=your_jwt_secret
```

## Frontend

Example:

```env
VITE_API_URL=http://localhost:5000/api/v1
```

Do not commit real passwords, database credentials, JWT secrets, API keys, or other sensitive values to GitHub.

---

# 📡 Frontend to Backend Connection

The React application communicates with the backend using Axios.

Example:

```javascript
import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL
});

export default API;
```

A page can then request data from the backend:

```javascript
const response = await API.get("/purchase-requests");
```

The request travels through:

```text
React
  ↓
Axios
  ↓
Express Route
  ↓
Controller
  ↓
Service
  ↓
PostgreSQL
  ↓
Service
  ↓
Controller
  ↓
JSON Response
  ↓
React
```

---

# 📊 Main Modules

| Module          | Responsibility                 |
| --------------- | ------------------------------ |
| Authentication  | Login and user identity        |
| Users           | User management                |
| Procurement     | Purchase requests              |
| Approvals       | Request approval workflow      |
| Suppliers       | Supplier management            |
| Purchase Orders | PO lifecycle                   |
| Receipts        | Goods/service receiving        |
| Invoices        | Invoice processing             |
| Budgets         | Budget tracking                |
| Analytics       | Procurement and spend insights |
| Notifications   | User notifications             |
| Audit           | Activity and audit history     |

---

# 🎯 Project Goals

The ETDOX platform aims to provide:

* Centralized procurement management
* Structured approval workflows
* Supplier management
* Purchase order management
* Invoice processing
* Budget visibility
* Procurement analytics
* Role-based access
* Auditable business operations
* A simple and maintainable full-stack architecture

---

# 📈 Future Enhancements

Potential future improvements include:

* Advanced workflow configuration
* Supplier onboarding portal
* Email notifications
* External ERP integrations
* Webhooks
* Advanced analytics
* Document management
* Automated invoice processing
* Advanced budget controls
* SSO integration
* Multi-tenant enhancements
* Background job processing

---

# 📁 Architecture Summary

```text
ETDOX
│
├── React.js
│   ├── Pages
│   ├── Components
│   ├── Context
│   ├── API Services
│   └── CSS
│
├── Node.js + Express
│   ├── Routes
│   ├── Controllers
│   ├── Services
│   ├── Middleware
│   └── Utilities
│
└── PostgreSQL
    ├── Users
    ├── Organizations
    ├── Suppliers
    ├── Purchase Requests
    ├── Approvals
    ├── Purchase Orders
    ├── Receipts
    ├── Invoices
    ├── Budgets
    ├── Notifications
    └── Audit Logs
```

---

# 👨‍💻 Development Approach

The project uses a **modular full-stack architecture** where frontend pages, backend modules and database entities are separated by responsibility.

The main principle is:

```text
Reusable Frontend
        +
Modular Backend
        +
PostgreSQL
        =
Maintainable Procurement Platform
```

---

# 📜 License

This project is developed as part of the ETDOX procurement platform project.

---

## Project Status

🚧 **Under Development**

Core architecture and procurement modules are being developed incrementally.

## Implemented TypeScript API

The production-oriented TypeScript API and PostgreSQL schema are in
[`backend/`](./backend/). Its detailed route list and setup instructions are in
[`backend/README.md`](./backend/README.md).

Use Node.js 20+ and PostgreSQL 15+. From the repository root:

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

Set `DATABASE_URL`, a unique `JWT_SECRET` of at least 32 characters, and
`WEBHOOK_ENCRYPTION_KEY` as 32 random bytes encoded as 64 hex characters. For
example, generate the values with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Use the first value for `JWT_SECRET` and the second for
`WEBHOOK_ENCRYPTION_KEY`. Keep the webhook key safe and stable; encrypted
webhook secrets cannot be decrypted after key rotation without re-encryption.

Create the PostgreSQL database, then run `npm run migrate` from `backend/`, or
apply the standalone SQL from `backend/` with:

```powershell
psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f .\database\schema.sql
```

Start the API with `npm run dev`; run `npm test` and `npm run build` to verify
it.
