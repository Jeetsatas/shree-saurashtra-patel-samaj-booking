# Shree Saurashtra Leuva Patel Samaj, Nikol–Naroda
## Private Admin-Only Booking Management System

A private, secure, internal booking management system designed exclusively for the trust administration of **Shree Saurashtra Leuva Patel Samaj, Nikol–Naroda, Ahmedabad**.

---

## 🏛️ Architecture & Security

- **Private Admin System**: Strictly not a public booking website. Root visits automatically redirect to `/admin/login` or to the respective admin dashboard according to role.
- **Three Designated Administrator Accounts**:
  1. **Super Admin**: The sole administrator authorized to create, edit, confirm, cancel bookings, adjust tariffs, configure discounts, and manage administrative accounts.
  2. **Admin 2 (View Only)**: Dedicated interactive calendar and bookings inspection view. Ultra-simplified interface. Direct backend mutation enforcement (HTTP 403 Forbidden on write attempts).
  3. **Admin 3 (View Only)**: Identical view-only access as Admin 2.
- **Argon2id Cryptographic Security**: State-of-the-art password hashing with HMAC-SHA256 JWT sessions and safe per-tab administration testing.
- **Vercel & PostgreSQL Ready**: Seamless dual-engine database layer — zero-config SQLite for local development and high-performance serverless PostgreSQL (Neon / Supabase / Vercel Postgres) for cloud production.

---

## 🔐 Administrator Credentials

| Account | Role | Email | Password | Access Rights |
|---|---|---|---|---|
| **J N Patel** (Super Admin) | `SUPER_ADMIN` | `jnpatel@patelsamaj.com` | `JNPatel@Patel2026` | Full system control: bookings, facility tariffs, discounts, settings, accounts |
| **Hareshbhai Ramani** (Admin 2) | `VIEW_ONLY_ADMIN` | `hareshbhai@patelsamaj.com` | `Hareshbhai@Patel2026` | View-only: Interactive Calendar & Booking Slips |
| **Shaileshbhai Kathriya** (Admin 3) | `VIEW_ONLY_ADMIN` | `shaileshbhai@patelsamaj.com` | `Shaileshbhai@Patel2026` | View-only: Interactive Calendar & Booking Slips |

---

## 🏟️ Facility Inventory

1. **Outside Party Plot (Capacity 1500)**: Shared availability calendar with dual purposes:
   - Wedding Functions
   - Family Functions
2. **Multipurpose Hall (Capacity 600)**: Slot options with 1-hour sanitation gap:
   - Whole Day (6:00 AM – 12:00 Midnight)
   - Morning Slot (6:00 AM – 2:00 PM)
   - Afternoon Slot (3:00 PM – 12:00 Midnight)
3. **Ground Floor Hall (Capacity 500)**
4. **Dormitory — 28 Beds**
5. **Dormitory — 42 Beds**
6. **AC Room — 8 Beds (Unit 1)**
7. **AC Room — 6 Beds**
8. **AC Room — 8 Beds (Unit 2)** *(Independent physical room from Unit 1)*

### Optional Add-on Services:
- **Cleaning Service**
- **Waste Food Collection Service**

---

## 🚀 Deployment to Vercel via GitHub

Every push to the `main` branch automatically triggers an optimized Vercel production build via the configured `npm run vercel-build` pipeline.

```bash
git add .
git commit -m "feat: updates"
git push origin main
```
