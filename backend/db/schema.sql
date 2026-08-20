-- MyLeave Enhancement - Local PostgreSQL Schema
-- Matches the Neon production schema exactly

-- ============================================================
-- TABLE: profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
    id                              SERIAL PRIMARY KEY,
    staff_id                        TEXT NOT NULL UNIQUE,
    full_name                       TEXT NOT NULL,
    email                           TEXT NOT NULL UNIQUE,
    password                        TEXT NOT NULL,
    role                            TEXT NOT NULL,
    position                        TEXT,
    department                      TEXT,
    employment_date                 DATE,
    confirmation_date               DATE,
    termination_date                DATE,
    gender                          TEXT,
    notes                           TEXT,
    photourl                        TEXT,
    leave_entitlement_annual_original   NUMERIC NOT NULL DEFAULT 0,
    leave_entitlement_medical_original  NUMERIC NOT NULL DEFAULT 0,
    leave_entitlement_annual            NUMERIC NOT NULL DEFAULT 0,
    leave_entitlement_medical           NUMERIC NOT NULL DEFAULT 0,
    carry_forward_original              NUMERIC NOT NULL DEFAULT 0,
    carry_forward_balance               NUMERIC NOT NULL DEFAULT 0,
    carry_forward_expiry                DATE,
    remaining_leave                     NUMERIC NOT NULL DEFAULT 0,
    last_password_change               TIMESTAMP,
    updated_at                          TIMESTAMP
);

-- ============================================================
-- TABLE: leave_requests
-- ============================================================
CREATE TABLE IF NOT EXISTS leave_requests (
    leave_id            SERIAL PRIMARY KEY,
    staff_id            TEXT NOT NULL,
    staff_name          TEXT NOT NULL,
    department          TEXT,
    requester_role      TEXT,
    requester_position  TEXT,
    leave_type          TEXT NOT NULL,
    request_type        TEXT NOT NULL DEFAULT 'new',
    duration            TEXT NOT NULL,
    date_from           DATE NOT NULL,
    date_until          DATE NOT NULL,
    total_days          NUMERIC NOT NULL,
    reason              TEXT,
    attachment_path     TEXT,
    status              TEXT NOT NULL DEFAULT 'pending',
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    deduct_cf           NUMERIC DEFAULT 0,
    deduct_al           NUMERIC DEFAULT 0,
    cancellation_reason TEXT
);

-- ============================================================
-- TABLE: leave_entitlements
-- ============================================================
CREATE TABLE IF NOT EXISTS leave_entitlements (
    id          SERIAL PRIMARY KEY,
    staff_id    TEXT NOT NULL,
    leave_type  TEXT NOT NULL,
    entitlement NUMERIC NOT NULL,
    balance     NUMERIC NOT NULL,
    year        INTEGER NOT NULL
);

-- ============================================================
-- TABLE: admin_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_logs (
    id              SERIAL PRIMARY KEY,
    admin_id        TEXT NOT NULL,
    admin_name      TEXT NOT NULL,
    action          TEXT NOT NULL,
    details         TEXT,
    ip_address      TEXT,
    location        TEXT,
    device_info     TEXT,
    status          TEXT NOT NULL DEFAULT 'success',
    user_agent      TEXT,
    request_method  TEXT,
    endpoint        TEXT,
    timestamp       TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kuala_Lumpur')
);

-- ============================================================
-- TABLE: password_resets
-- ============================================================
CREATE TABLE IF NOT EXISTS password_resets (
    id          SERIAL PRIMARY KEY,
    user_email  TEXT NOT NULL,
    otp_hash    TEXT NOT NULL,
    expires_at  TIMESTAMP NOT NULL,
    used        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: role_setting
-- ============================================================
CREATE TABLE IF NOT EXISTS role_setting (
    email       TEXT PRIMARY KEY,
    role        TEXT NOT NULL,
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: public_holidays
-- ============================================================
CREATE TABLE IF NOT EXISTS public_holidays (
    id          SERIAL PRIMARY KEY,
    date        DATE NOT NULL,
    title       TEXT NOT NULL,
    description TEXT
);

-- ============================================================
-- TABLE: holiday_overrides
-- ============================================================
CREATE TABLE IF NOT EXISTS holiday_overrides (
    uid     TEXT NOT NULL,
    date    DATE NOT NULL,
    action  TEXT NOT NULL DEFAULT 'hide',
    reason  TEXT,
    PRIMARY KEY (uid, date)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower ON profiles (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_profiles_staff_id ON profiles (staff_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles (role);
CREATE INDEX IF NOT EXISTS idx_profiles_termination_date ON profiles (termination_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_staff_id ON leave_requests (staff_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests (status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_date_range ON leave_requests (date_from, date_until);
CREATE INDEX IF NOT EXISTS idx_leave_requests_staff_status ON leave_requests (staff_id, status);
CREATE INDEX IF NOT EXISTS idx_leave_entitlements_lookup ON leave_entitlements (staff_id, leave_type);
CREATE INDEX IF NOT EXISTS idx_admin_logs_timestamp ON admin_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs (admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON admin_logs (action);
CREATE INDEX IF NOT EXISTS idx_password_resets_email ON password_resets (user_email, used);
CREATE INDEX IF NOT EXISTS idx_public_holidays_date ON public_holidays (date);
CREATE INDEX IF NOT EXISTS idx_holiday_overrides_action ON holiday_overrides (action);
