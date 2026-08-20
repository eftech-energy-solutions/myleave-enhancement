# MyLeave Enhancement — Full Project Analysis

## 1. Overview

**MyLeave Enhancement** is a full-stack HR leave management system built for **Eftech Energy Solutions**. It automates leave applications, approvals, balance tracking, carry-forward logic, and email notifications.

| Aspect | Detail |
|--------|--------|
| **Frontend** | SvelteKit 2 (Svelte 5) + Tailwind CSS 4 + Vite 7 |
| **Backend** | Express.js 5 (ESM modules) |
| **Database** | PostgreSQL on Neon (cloud-hosted) |
| **ORM** | Raw `pg` driver (no ORM) |
| **Email** | Nodemailer via `mail.eftech.com.my` (SMTP) |
| **Styling** | Tailwind CSS 4 + scoped Svelte `<style>` blocks |
| **Deployment** | `adapter-static` (SPA mode with `index.html` fallback) |
| **Dev Runner** | `concurrently` runs frontend + backend together |

---

## 2. Directory Structure

```
myleave-enhancement/
├── backend/
│   ├── server.js                    # Express app entry point
│   ├── src/
│   │   ├── db.js                    # PostgreSQL pool (Neon connection)
│   │   ├── hooks.server.js          # (SvelteKit leftover, unused)
│   │   ├── middleware/
│   │   │   └── adminLogger.js       # Admin action logger + auto-log middleware
│   │   ├── routes/
│   │   │   ├── authRoutes.js        # Login, change-password, forgot/verify-otp/reset
│   │   │   ├── profile.js           # Employee CRUD, leave calc, department summary
│   │   │   ├── leaveRequests.js     # Leave create/edit/approve/reject/cancel/history
│   │   │   ├── dashboardRoutes.js   # Employee overview (count by dept)
│   │   │   ├── holidayRoutes.js     # Holiday CRUD + hide/unhide official + impact
│   │   │   ├── roleSettingRoute.js  # Role override management
│   │   │   ├── uploadRoute.js       # Photo upload (admin + self)
│   │   │   ├── chat.js              # User search for chat (stub)
│   │   │   └── adminLogs.js         # Activity logs query/export
│   │   └── utils/
│   │       ├── calculateWorkingDays.js   # Working-day calc (weekends + holidays)
│   │       ├── emailService.js           # Email templates for all leave events
│   │       ├── fetchMalaysiaHolidays.js  # Google Calendar ICS parser
│   │       ├── holidayImpactHandler.js   # Auto-recalc leaves when holidays change
│   │       └── safeEmail.js             # Safe wrapper to prevent email crashes
│   └── uploads/                     # Uploaded files (photos, attachments)
│
├── frontend/
│   ├── src/
│   │   ├── app.html                 # HTML shell
│   │   ├── app.css                  # Global CSS (layout, donut, calendar, modals)
│   │   ├── hooks.server.js          # SvelteKit server hook — loads user from cookie
│   │   ├── lib/
│   │   │   ├── api.js               # apiFetch() helper
│   │   │   ├── config.js            # API base URL constant
│   │   │   ├── assets/              # Static assets (favicon)
│   │   │   └── components/
│   │   │       ├── +layout.svelte   # Shared dashboard layout (legacy)
│   │   │       ├── Sidebar.svelte   # Admin sidebar + profile modal + role settings
│   │   │       ├── StaffSidebar.svelte
│   │   │       ├── ManagerSidebar.svelte
│   │   │       ├── DirectorSidebar.svelte
│   │   │       └── LoginForm.svelte
│   │   └── routes/
│   │       ├── +layout.svelte       # Root layout (just imports CSS)
│   │       ├── +page.server.js      # Root page — redirect /dashboard to role-specific page
│   │       ├── login/
│   │       │   └── +page.svelte     # Login + Forgot Password + OTP + Reset
│   │       ├── logout/
│   │       │   └── +server.js       # Clear cookies, redirect to /login
│   │       └── dashboard/
│   │           ├── +page.server.js  # Role-based redirect handler
│   │           ├── admin/
│   │           │   ├── +layout.svelte     # AdminSidebar wrapper
│   │           │   ├── +page.svelte       # Admin dashboard (calendar, chart, overview)
│   │           │   ├── employees/         # Employee management
│   │           │   ├── history/           # Leave history
│   │           │   ├── logs/              # Activity logs
│   │           │   ├── main/              # Main leave view
│   │           │   └── chat/              # Chat feature
│   │           ├── manager/
│   │           │   ├── +layout.svelte / +layout.server.js
│   │           │   ├── +page.svelte       # Manager dashboard
│   │           │   ├── employees/
│   │           │   ├── history/
│   │           │   ├── myhistory/
│   │           │   └── reports/
│   │           ├── director/
│   │           │   ├── +layout.svelte / +layout.server.js
│   │           │   ├── +page.svelte       # Director dashboard
│   │           │   ├── employees/
│   │           │   ├── history/
│   │           │   ├── myhistory/
│   │           │   └── reports/
│   │           └── staff/
│   │               ├── +layout.svelte     # StaffSidebar wrapper
│   │               ├── +page.svelte       # Staff dashboard (donuts, calendar, apply)
│   │               ├── staffhistory/
│   │               └── chat/
│   ├── svelte.config.js            # adapter-static + fallback SPA
│   ├── vite.config.js              # Tailwind + API proxy
│   └── static/                     # Public assets (images, etc.)
│
├── .env.example                    # Environment variable template
├── package.json                    # Root — concurrently for dev
└── README.md
```

---

## 3. Database Schema (Inferred from Queries)

### `profiles` (main employee table)
| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `staff_id` | text UNIQUE | Employee code (e.g., "E8505") |
| `full_name` | text | |
| `email` | text | |
| `password` | text | bcrypt or plaintext (legacy) |
| `role` | text | "Admin", "Manager", "Staff" |
| `position` | text | |
| `department` | text | Can be comma-separated for managers |
| `employment_date` | date | Used for leave entitlement calc |
| `confirmation_date` | date | |
| `termination_date` | date | NULL = active |
| `gender` | text | |
| `notes` | text | |
| `photourl` | text | Path to uploaded photo |
| `leave_entitlement_annual` | numeric | Current AL balance (deducted) |
| `leave_entitlement_annual_original` | numeric | Base AL (never changes mid-year) |
| `leave_entitlement_medical` | numeric | Current MC balance |
| `leave_entitlement_medical_original` | numeric | Base MC |
| `carry_forward_original` | numeric | CF at start of year |
| `carry_forward_balance` | numeric | Current CF remaining |
| `carry_forward_expiry` | date | April 30 of current year |
| `remaining_leave` | numeric | AL + CF |
| `last_password_change` | timestamp | |

### `leave_requests`
| Column | Type | Notes |
|--------|------|-------|
| `leave_id` | serial PK | |
| `staff_id` | text | FK → profiles |
| `staff_name` | text | Denormalized |
| `department` | text | Denormalized |
| `requester_role` | text | "Staff", "Manager", etc. |
| `requester_position` | text | |
| `leave_type` | text | AL, EL, MC, HOSP, MAT, PAT, COMP_A, COMP_B, MAR, UNPAID |
| `request_type` | text | "new" or "cancellation_request" |
| `duration` | text | "Full" or "Half" |
| `date_from` | date | |
| `date_until` | date | |
| `total_days` | numeric | Server-calculated |
| `reason` | text | |
| `attachment_path` | text | |
| `status` | text | pending, approved, rejected, cancelled, cancellation_pending, invalid |
| `cancellation_reason` | text | |
| `deduct_cf` | numeric | CF days deducted on approval |
| `deduct_al` | numeric | AL days deducted on approval |
| `created_at` | timestamp | |

### `leave_entitlements` (special leave balances)
| Column | Type | Notes |
|--------|------|-------|
| `staff_id` | text | FK → profiles |
| `leave_type` | text | HOSP, MAT, PAT, COMP_A, COMP_B, MAR |
| `entitlement` | numeric | |
| `balance` | numeric | Remaining |
| `year` | integer | |

### `public_holidays` (custom holidays)
| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `date` | date | |
| `title` | text | |
| `description` | text | |

### `holiday_overrides` (hide/unhide official holidays)
| Column | Type | Notes |
|--------|------|-------|
| `uid` | text | Google Calendar event UID |
| `date` | date | |
| `action` | text | "hide" |
| `reason` | text | |

### `role_setting` (role overrides)
| Column | Type | Notes |
|--------|------|-------|
| `email` | text PK | |
| `role` | text | "admin" or "manager" |
| `updated_at` | timestamp | |

### `password_resets` (OTP storage)
| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `user_email` | text | |
| `otp_hash` | text | bcrypt hash of OTP |
| `expires_at` | timestamp | 10 minutes |
| `used` | boolean | |
| `created_at` | timestamp | |

### `admin_logs`
| Column | Type | Notes |
|--------|------|-------|
| `admin_id` | text | |
| `admin_name` | text | |
| `action` | text | |
| `details` | text | |
| `ip_address` | text | |
| `location` | text | From ip-api.com |
| `device_info` | text | User-agent |
| `status` | text | success/failed |
| `user_agent` | text | |
| `request_method` | text | GET, POST, etc. |
| `endpoint` | text | |
| `timestamp` | timestamp | |

---

## 4. Authentication & Authorization Flow

### Login Flow
```
1. POST /api/auth/login { email, password }
2. Query profiles by email
3. Check password (bcrypt or legacy plaintext)
4. Check role_setting table for role override
5. Set auth_token cookie (JSON: { staffId, email, name, role, department, photoUrl })
6. Return redirectTo based on role:
   - admin   → /dashboard/admin
   - manager → /dashboard/manager/main
   - staff   → /dashboard/staff
```

### Session Management
- **Cookie-based**: `auth_token` cookie (non-httpOnly, sameSite=lax)
- **Server hook** (`hooks.server.js`): Parses `auth_token` into `event.locals.user`
- **Backend middleware**: Attaches full profile from DB to `req.user`
- **No JWT** — just a JSON cookie

### Role-Based Access Control (RBAC)
```
4 roles: Admin, Manager, Director, Staff

Admin:     Sees everything. All employees, all leaves, all history.
Manager:   Sees own department's employees + own requests.
Director:  Sees Director department employees + all Manager requests.
Staff:     Sees only own data.
```

### Role Override System
- `role_setting` table can override a user's profile role at login time
- Admin can assign "admin" or "manager" roles to emails via the sidebar settings modal

---

## 5. Leave Types & Entitlement Logic

### Leave Types
| Code | Full Name | Entitlement Source | Duration |
|------|-----------|-------------------|----------|
| AL | Annual Leave | `profiles.leave_entitlement_annual` | Working days |
| EL | Emergency Leave | Shares AL balance | Working days |
| MC | Medical Leave | `profiles.leave_entitlement_medical` | Working days |
| HOSP | Hospitalization | `leave_entitlements` (60 days) | Calendar days |
| MAT | Maternity | `leave_entitlements` (98 days) | Calendar days |
| PAT | Paternity | `leave_entitlements` (7 days) | Calendar days |
| COMP_A | Compassionate A | `leave_entitlements` (3 days) | Calendar days |
| COMP_B | Compassionate B | `leave_entitlements` (1 day) | Calendar days |
| MAR | Marriage | `leave_entitlements` (3 days) | Working days |
| UNPAID | Unpaid Leave | No limit (blocked if AL available) | Working days |

### Annual Leave Entitlement Rules
```
Years of Service < 2  → 14 AL, 14 MC
Years of Service 2-4  → 14 AL, 18 MC
Years of Service ≥ 5  → 16 AL, 22 MC
```

### Carry Forward Logic
- Max 7 days carry forward from previous year
- CF expires on April 30
- On approval: CF days are used first, then AL days

### Yearly Reset (Jan 1)
- Recalculates entitlements based on years of service
- Carries forward up to 7 unused AL days
- Resets MC to base entitlement

---

## 6. Leave Request Lifecycle

```
                         ┌──────────────┐
                         │  SUBMITTED   │
                         │  (pending)   │
                         └──────┬───────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                  ▼
      ┌───────────┐    ┌────────────┐    ┌──────────────┐
      │  APPROVED  │    │  REJECTED  │    │  CANCELLATION│
      │            │    │            │    │   PENDING    │
      └─────┬─────┘    └────────────┘    └──────┬───────┘
            │                                    │
            │              ┌─────────────┐       │
            │              │ CANCELLED   │◄──────┘
            │              │ (balance    │   (approved)
            │              │  restored)  │
            │              └─────────────┘
            │                    ▲
            │              ┌─────┴────────┐
            └─────────────►│  CANCELLATION│
                           │   REJECTED   │
                           │  (stays      │
                           │   approved)  │
                           └──────────────┘
```

### Key Business Rules
1. **Overlap check**: Cannot apply leave on dates already pending/approved
2. **6-month limit**: Staff can only apply up to 6 months in advance
3. **MC backdate**: Max 7 days backdate for Medical Leave
4. **Cancellation window**: Only within 7 days after leave start date
5. **Unpaid restriction**: Cannot apply UNPAID if AL balance is sufficient
6. **Half-day**: Always 0.5 days, same date for from/until
7. **Holiday recalculation**: When holidays are added/removed, affected leaves are auto-recalculated

---

## 7. API Endpoints

### Authentication (`/api/auth`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login, set cookie |
| POST | `/api/auth/change-password` | Change password (email-based) |
| POST | `/api/auth/forgot` | Send OTP via email |
| POST | `/api/auth/verify-otp` | Verify OTP code |
| POST | `/api/auth/reset` | Reset password with OTP |

### Employee (`/api/employee`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/employee` | Add new employee |
| GET | `/api/employee` | Get all employees (role-filtered) |
| GET | `/api/employee/me` | Get current user profile |
| GET | `/api/employee/employees` | Get all (admin/director) |
| GET | `/api/employee/department-summary` | Dept counts for chart |
| PUT | `/api/employee/:staff_id` | Update employee |
| PUT | `/api/employee/:staffId/password` | Change password (by staff ID) |
| PUT | `/api/employee/:staffId/photo` | Update profile photo |
| DELETE | `/api/employee/:staff_id` | Delete employee |

### Leave Requests (`/api/leave-requests`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/leave-requests` | Create leave request |
| GET | `/api/leave-requests` | Get all (role-filtered) |
| GET | `/api/leave-requests/me` | Get my leaves |
| GET | `/api/leave-requests/history/all` | Get history (role-filtered) |
| PATCH | `/api/leave-requests/:id` | Approve/reject/cancel |
| PATCH | `/api/leave-requests/:id/edit` | Edit leave details |
| DELETE | `/api/leave-requests/:id` | Delete leave |
| DELETE | `/api/leave-requests/by-staff/:staffId` | Delete all staff leaves |
| POST | `/api/leave-requests/reset-year` | Trigger yearly reset |
| POST | `/api/leave-requests/recalc-invalid` | Mark zero-day leaves invalid |

### Holidays (`/api/holidays`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/holidays` | Get all (official + custom - hidden) |
| POST | `/api/holidays` | Add custom holiday |
| PUT | `/api/holidays/:id` | Update custom holiday |
| DELETE | `/api/holidays/:id` | Delete custom holiday |
| POST | `/api/holidays/official/hide` | Hide official holiday |
| POST | `/api/holidays/official/unhide` | Unhide official holiday |
| GET | `/api/holidays/impact/:date` | Check holiday impact |

### Other
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/me` | Current user (full profile + HOSP) |
| GET | `/api/me/photo` | Current user (photo URL) |
| POST | `/api/upload` | Admin upload photo |
| POST | `/api/upload/profile` | Self upload profile photo |
| POST | `/api/role-setting` | Set role override |
| GET | `/api/role-setting` | Get all role overrides |
| GET | `/api/admin-logs` | Get activity logs |
| GET | `/api/admin-logs/actions` | Get unique actions |
| GET | `/api/admin-logs/admins` | Get unique admins |
| GET | `/api/admin-logs/export` | Export logs as JSON |
| GET | `/api/chat/users` | Search users for chat |

---

## 8. Frontend Routing

```
/login                              → Login page (login, forgot password, OTP, reset)
/logout                             → Clear cookies, redirect to /login
/dashboard                          → Role-based redirect

/dashboard/admin                    → Admin overview (calendar + chart + dept counts)
/dashboard/admin/main               → Main leave management view
/dashboard/admin/employees          → Employee CRUD
/dashboard/admin/history            → Approved leave history
/dashboard/admin/logs               → Activity logs
/dashboard/admin/chat               → Chat (stub)

/dashboard/manager/main             → Manager dashboard
/dashboard/manager/employees        → Department employees
/dashboard/manager/history          → Leave history
/dashboard/manager/myhistory        → Personal history
/dashboard/manager/reports          → Reports

/dashboard/director/main            → Director dashboard
/dashboard/director/employees       → All employees
/dashboard/director/history         → Leave history
/dashboard/director/myhistory       → Personal history
/dashboard/director/reports         → Reports

/dashboard/staff                    → Staff dashboard (donuts + calendar + apply)
/dashboard/staff/staffhistory       → Personal leave history
/dashboard/staff/chat               → Chat (stub)
```

---

## 9. Email System

### SMTP Config
- Host: `mail.eftech.com.my` (port 465, SSL)
- From: `"Eftech HR" <EMAIL_USER>`

### Email Events
| Event | Recipient | Trigger |
|-------|-----------|---------|
| Leave Submitted | Staff | New leave created |
| Pending Approval | Manager/Director | New leave needs approval |
| Leave Approved | Staff | Leave approved by approver |
| Leave Rejected | Staff | Leave rejected by approver |
| Cancellation Pending | Admin | Staff requests cancellation |
| Cancellation Approved | Staff | Cancellation approved |
| New Employee | Employee + Admin | Employee added |
| Email Corrected | Employee | Email changed by admin |

### Email Footer
All emails include Eftech + MyLeave logos with auto-generated notice.

---

## 10. Holiday System

### Data Sources
1. **Official Malaysia Holidays**: Fetched from Google Calendar ICS feed
2. **Custom Holidays**: Added by admin via `public_holidays` table
3. **Hidden Holidays**: Official holidays hidden via `holiday_overrides` table

### Holiday Impact
When holidays are added/deleted/hidden/unhidden:
1. System finds all affected leaves (date range includes the changed date)
2. Recalculates working days for each affected leave
3. Updates `total_days` in `leave_requests`
4. Adjusts employee balances accordingly
5. Special handling for AL (re-splits CF/AL deduction)

---

## 11. Working Days Calculation

```javascript
calculateWorkingDays(startDate, endDate)
```
- Excludes Saturdays and Sundays
- Excludes official Malaysia holidays (not hidden)
- Excludes custom public holidays
- Used for: AL, EL, MC, MAR, UNPAID
- Special leaves (MAT, PAT, HOSP, COMP_A, COMP_B) use calendar days instead

---

## 12. Admin Logging System

### Auto-logging Middleware
- Intercepts all responses for admin/manager users
- Logs: login, logout, and any request from admin/manager

### Manual Logging
- Called explicitly for: leave approve/reject, employee add/update/delete, holiday changes, cancellation actions
- Records: admin ID, name, action, details, IP, geolocation, device info, timestamp

### Log Viewer
- Accessible from Admin sidebar → Activity Logs
- Filterable by: search text, action type, admin ID, date range
- Exportable as JSON

---

## 13. Key Design Patterns

### Frontend
- **SPA mode**: SvelteKit with `adapter-static` + `index.html` fallback
- **Role-based layouts**: Each role has its own sidebar component and layout
- **Client-side data fetching**: Most data loaded via `onMount` + fetch
- **Cookie-based auth**: `auth_token` parsed in both SvelteKit server hook and Express middleware
- **Toast notifications**: Custom toast system for all user feedback
- **Calendar component**: Custom-built for both admin (holiday management) and staff (leave application)

### Backend
- **ES Modules**: All files use `import/export`
- **Raw SQL**: No ORM — direct `pg` pool queries
- **Middleware chain**: autoLogMiddleware → user attachment → route handlers
- **Safe email**: `safeSendEmail` wrapper prevents email failures from crashing the app
- **Cron job**: Runs every minute to mark approved leaves with zero total_days as invalid

---

## 14. Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string (Neon) |
| `DB_SSL` | Enable SSL ("true"/"false") |
| `PUBLIC_VITE_API_BASE` | Frontend API base URL |
| `EMAIL_USER` | SMTP username |
| `EMAIL_PASS` | SMTP password |
| `PORT` | Backend port (default: 5000) |

---

## 15. Known Issues & Notes

1. **Password storage**: Supports both bcrypt and legacy plaintext passwords
2. **No CSRF protection**: Cookie-based auth without CSRF tokens
3. **auth_token is non-httpOnly**: Accessible via JavaScript (XSS risk)
4. **No test suite**: No testing framework configured
5. **Hardcoded values**: Some emails, URLs, and department names are hardcoded
6. **Commented code**: Large blocks of commented code in `server.js` and `leaveRequests.js`
7. **Duplicate functions**: `calculateYearsOfService` and similar helpers are duplicated across files
8. **Chat feature**: Backend endpoint exists but is a stub — no real messaging
9. **Backend hooks.server.js**: SvelteKit file in backend (should be removed)
10. **Build artifacts**: Zip files in frontend directory (`build (2).zip`, `build (3).zip`)
