-- ============================================
-- SCHOOL MANAGEMENT PORTAL - INITIAL SCHEMA
-- ============================================
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUMS
-- ============================================

-- User roles
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'teacher', 'parent');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Academic terms
DO $$ BEGIN
    CREATE TYPE term_name AS ENUM ('first', 'second', 'third');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Assessment stages
DO $$ BEGIN
    CREATE TYPE assessment_stage AS ENUM ('classes', 'first_test', 'second_test', 'third_test', 'examination');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Student status
DO $$ BEGIN
    CREATE TYPE student_status AS ENUM ('active', 'archived', 'graduated', 'transferred');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- User account status
DO $$ BEGIN
    CREATE TYPE account_status AS ENUM ('active', 'inactive', 'suspended');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Broadsheet submission status
DO $$ BEGIN
    CREATE TYPE broadsheet_status AS ENUM ('draft', 'submitted', 'returned', 'approved');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Result status
DO $$ BEGIN
    CREATE TYPE result_status AS ENUM ('pending', 'generated', 'reviewed', 'published', 'archived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Gender
DO $$ BEGIN
    CREATE TYPE gender AS ENUM ('male', 'female', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Attendance status
DO $$ BEGIN
    CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'excused');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Payment status
DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded', 'voided');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Cashbook transaction type
DO $$ BEGIN
    CREATE TYPE cashbook_txn_type AS ENUM ('credit', 'debit');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Receipt status
DO $$ BEGIN
    CREATE TYPE receipt_status AS ENUM ('pending', 'generated', 'printed', 'voided');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Notification type
DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM ('info', 'success', 'warning', 'error', 'announcement');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- TABLES
-- ============================================

-- ============================================
-- USERS & PROFILES
-- ============================================

-- Users table (links to Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    role user_role NOT NULL,
    status account_status NOT NULL DEFAULT 'active',
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    deleted_at TIMESTAMPTZ
);

-- Profiles (common profile fields for all users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    avatar_url TEXT,
    date_of_birth DATE,
    gender gender,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- ACADEMIC STRUCTURE
-- ============================================

-- Academic sessions (e.g., 2026/2027)
CREATE TABLE IF NOT EXISTS academic_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT valid_session_dates CHECK (end_date > start_date)
);

-- Terms (first, second, third)
CREATE TABLE IF NOT EXISTS terms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    name term_name NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    assessment_stage assessment_stage NOT NULL DEFAULT 'classes',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT valid_term_dates CHECK (end_date > start_date),
    CONSTRAINT unique_term_session UNIQUE (session_id, name)
);

-- ============================================
-- CLASSES
-- ============================================

CREATE TABLE IF NOT EXISTS classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- SUBJECTS
-- ============================================

CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    code TEXT UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- STUDENTS
-- ============================================

CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admission_number TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    middle_name TEXT,
    date_of_birth DATE NOT NULL,
    gender gender NOT NULL,
    address TEXT,
    phone TEXT,
    email TEXT,
    photo_url TEXT,
    status student_status NOT NULL DEFAULT 'active',
    admission_date DATE NOT NULL DEFAULT CURRENT_DATE,
    current_class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- TEACHERS
-- ============================================

CREATE TABLE IF NOT EXISTS teachers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    staff_number TEXT UNIQUE NOT NULL,
    qualification TEXT,
    specialization TEXT,
    date_hired DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- PARENTS
-- ============================================

CREATE TABLE IF NOT EXISTS parents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    occupation TEXT,
    relationship_to_student TEXT,
    alternate_phone TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- ASSIGNMENTS
-- ============================================

-- Student enrollments (student in a class for a session)
CREATE TABLE IF NOT EXISTS enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unenrolled_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT unique_student_class_session UNIQUE (student_id, class_id, session_id)
);

-- Parent-child assignments
CREATE TABLE IF NOT EXISTS parent_child_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unassigned_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT unique_parent_child UNIQUE (parent_id, student_id)
);

-- Teacher-class assignments
CREATE TABLE IF NOT EXISTS teacher_class_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    is_class_teacher BOOLEAN NOT NULL DEFAULT FALSE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unassigned_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT unique_teacher_class_session UNIQUE (teacher_id, class_id, session_id)
);

-- Teacher-subject assignments
CREATE TABLE IF NOT EXISTS teacher_subject_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unassigned_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT unique_teacher_subject_class_session UNIQUE (teacher_id, subject_id, class_id, session_id)
);

-- Class-subject assignments (subjects offered in a class)
CREATE TABLE IF NOT EXISTS class_subject_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT unique_class_subject_session UNIQUE (class_id, subject_id, session_id)
);

-- ============================================
-- ATTENDANCE
-- ============================================

CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    term_id UUID NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    status attendance_status NOT NULL DEFAULT 'present',
    remarks TEXT,
    marked_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_student_attendance_date_session UNIQUE (student_id, attendance_date, session_id)
);

-- ============================================
-- SCORES
-- ============================================

CREATE TABLE IF NOT EXISTS scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    term_id UUID NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
    test1 NUMERIC(5,2) DEFAULT 0 CHECK (test1 >= 0 AND test1 <= 20),
    test2 NUMERIC(5,2) DEFAULT 0 CHECK (test2 >= 0 AND test2 <= 20),
    test3 NUMERIC(5,2) DEFAULT 0 CHECK (test3 >= 0 AND test3 <= 20),
    examination NUMERIC(5,2) DEFAULT 0 CHECK (examination >= 0 AND examination <= 40),
    total NUMERIC(5,2) GENERATED ALWAYS AS (test1 + test2 + test3 + examination) STORED,
    percentage NUMERIC(5,2) GENERATED ALWAYS AS (test1 + test2 + test3 + examination) STORED,
    entered_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_student_subject_term UNIQUE (student_id, subject_id, term_id)
);

-- ============================================
-- BROADSHEET SUBMISSIONS
-- ============================================

CREATE TABLE IF NOT EXISTS broadsheet_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    term_id UUID NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT,
    status broadsheet_status NOT NULL DEFAULT 'draft',
    submitted_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    returned_at TIMESTAMPTZ,
    return_reason TEXT,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_broadsheet_class_subject_term UNIQUE (class_id, subject_id, term_id)
);

-- ============================================
-- PERSONAL ASSESSMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS personal_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    term_id UUID NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
    punctuality SMALLINT CHECK (punctuality >= 1 AND punctuality <= 5),
    neatness SMALLINT CHECK (neatness >= 1 AND neatness <= 5),
    participation SMALLINT CHECK (participation >= 1 AND participation <= 5),
    discipline SMALLINT CHECK (discipline >= 1 AND discipline <= 5),
    cooperation SMALLINT CHECK (cooperation >= 1 AND cooperation <= 5),
    leadership SMALLINT CHECK (leadership >= 1 AND leadership <= 5),
    additional_assessments JSONB DEFAULT '{}',
    teacher_comment TEXT,
    head_teacher_comment TEXT,
    assessed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_student_assessment_term UNIQUE (student_id, term_id)
);

-- ============================================
-- RESULTS
-- ============================================

CREATE TABLE IF NOT EXISTS results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    term_id UUID NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
    term_average NUMERIC(6,2),
    term_position INTEGER,
    cumulative_average NUMERIC(6,2),
    status result_status NOT NULL DEFAULT 'pending',
    attendance_days INTEGER DEFAULT 0,
    attendance_present INTEGER DEFAULT 0,
    generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    published_by UUID REFERENCES users(id) ON DELETE SET NULL,
    generated_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_student_result_term UNIQUE (student_id, term_id)
);

-- Result subject breakdowns
CREATE TABLE IF NOT EXISTS result_subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    result_id UUID NOT NULL REFERENCES results(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    test1 NUMERIC(5,2) DEFAULT 0,
    test2 NUMERIC(5,2) DEFAULT 0,
    test3 NUMERIC(5,2) DEFAULT 0,
    examination NUMERIC(5,2) DEFAULT 0,
    total NUMERIC(5,2) DEFAULT 0,
    percentage NUMERIC(5,2) DEFAULT 0,
    grade TEXT,
    position INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_result_subject UNIQUE (result_id, subject_id)
);

-- Result version history
CREATE TABLE IF NOT EXISTS result_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    result_id UUID NOT NULL REFERENCES results(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason TEXT,
    data_snapshot JSONB NOT NULL,
    CONSTRAINT unique_result_version UNIQUE (result_id, version_number)
);

-- ============================================
-- PAYMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_reference TEXT UNIQUE NOT NULL,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
    session_id UUID REFERENCES academic_sessions(id) ON DELETE SET NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    purpose TEXT NOT NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method TEXT DEFAULT 'cash',
    status payment_status NOT NULL DEFAULT 'completed',
    recorded_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    idempotency_key TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- CASHBOOK
-- ============================================

CREATE TABLE IF NOT EXISTS cashbook_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    particulars TEXT NOT NULL,
    txn_type cashbook_txn_type NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    description TEXT,
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    running_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
    recorded_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_payment_cashbook UNIQUE (payment_id)
);

-- ============================================
-- RECEIPTS
-- ============================================

CREATE TABLE IF NOT EXISTS receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_number TEXT UNIQUE NOT NULL,
    payment_id UUID NOT NULL UNIQUE REFERENCES payments(id) ON DELETE RESTRICT,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    purpose TEXT NOT NULL,
    receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status receipt_status NOT NULL DEFAULT 'pending',
    generated_at TIMESTAMPTZ,
    printed_at TIMESTAMPTZ,
    voided_at TIMESTAMPTZ,
    void_reason TEXT,
    edited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    last_edited_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- NOTIFICATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    notification_type notification_type NOT NULL DEFAULT 'info',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    link TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- AUDIT LOGS
-- ============================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    old_value JSONB,
    new_value JSONB,
    metadata JSONB DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- SCHOOL SETTINGS
-- ============================================

CREATE TABLE IF NOT EXISTS school_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key TEXT UNIQUE NOT NULL,
    setting_value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- GRADING SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS grading_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grade TEXT NOT NULL,
    min_score NUMERIC(5,2) NOT NULL,
    max_score NUMERIC(5,2) NOT NULL,
    remarks TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_grade_range CHECK (max_score > min_score),
    CONSTRAINT unique_grade UNIQUE (grade)
);

-- ============================================
-- INDEXES
-- ============================================

-- Users
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Students
CREATE INDEX IF NOT EXISTS idx_students_admission_number ON students(admission_number);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(current_class_id);
CREATE INDEX IF NOT EXISTS idx_students_name ON students(last_name, first_name);

-- Teachers
CREATE INDEX IF NOT EXISTS idx_teachers_user ON teachers(user_id);
CREATE INDEX IF NOT EXISTS idx_teachers_staff_number ON teachers(staff_number);
CREATE INDEX IF NOT EXISTS idx_teachers_active ON teachers(is_active);

-- Parents
CREATE INDEX IF NOT EXISTS idx_parents_user ON parents(user_id);
CREATE INDEX IF NOT EXISTS idx_parents_active ON parents(is_active);

-- Enrollments
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_class ON enrollments(class_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_session ON enrollments(session_id);

-- Parent-child
CREATE INDEX IF NOT EXISTS idx_parent_child_parent ON parent_child_assignments(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_child_student ON parent_child_assignments(student_id);

-- Teacher-class
CREATE INDEX IF NOT EXISTS idx_teacher_class_teacher ON teacher_class_assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_class_class ON teacher_class_assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_teacher_class_session ON teacher_class_assignments(session_id);

-- Teacher-subject
CREATE INDEX IF NOT EXISTS idx_teacher_subject_teacher ON teacher_subject_assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_subject_subject ON teacher_subject_assignments(subject_id);
CREATE INDEX IF NOT EXISTS idx_teacher_subject_class ON teacher_subject_assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_teacher_subject_session ON teacher_subject_assignments(session_id);

-- Class-subject
CREATE INDEX IF NOT EXISTS idx_class_subject_class ON class_subject_assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_class_subject_subject ON class_subject_assignments(subject_id);
CREATE INDEX IF NOT EXISTS idx_class_subject_session ON class_subject_assignments(session_id);

-- Attendance
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_class ON attendance(class_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_term ON attendance(term_id);

-- Scores
CREATE INDEX IF NOT EXISTS idx_scores_student ON scores(student_id);
CREATE INDEX IF NOT EXISTS idx_scores_class ON scores(class_id);
CREATE INDEX IF NOT EXISTS idx_scores_subject ON scores(subject_id);
CREATE INDEX IF NOT EXISTS idx_scores_session ON scores(session_id);
CREATE INDEX IF NOT EXISTS idx_scores_term ON scores(term_id);

-- Broadsheets
CREATE INDEX IF NOT EXISTS idx_broadsheets_class ON broadsheet_submissions(class_id);
CREATE INDEX IF NOT EXISTS idx_broadsheets_subject ON broadsheet_submissions(subject_id);
CREATE INDEX IF NOT EXISTS idx_broadsheets_session ON broadsheet_submissions(session_id);
CREATE INDEX IF NOT EXISTS idx_broadsheets_term ON broadsheet_submissions(term_id);
CREATE INDEX IF NOT EXISTS idx_broadsheets_teacher ON broadsheet_submissions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_broadsheets_status ON broadsheet_submissions(status);

-- Results
CREATE INDEX IF NOT EXISTS idx_results_student ON results(student_id);
CREATE INDEX IF NOT EXISTS idx_results_class ON results(class_id);
CREATE INDEX IF NOT EXISTS idx_results_session ON results(session_id);
CREATE INDEX IF NOT EXISTS idx_results_term ON results(term_id);
CREATE INDEX IF NOT EXISTS idx_results_status ON results(status);

-- Result subjects
CREATE INDEX IF NOT EXISTS idx_result_subjects_result ON result_subjects(result_id);
CREATE INDEX IF NOT EXISTS idx_result_subjects_subject ON result_subjects(subject_id);

-- Result versions
CREATE INDEX IF NOT EXISTS idx_result_versions_result ON result_versions(result_id);

-- Payments
CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_session ON payments(session_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(payment_reference);

-- Cashbook
CREATE INDEX IF NOT EXISTS idx_cashbook_date ON cashbook_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_cashbook_type ON cashbook_transactions(txn_type);
CREATE INDEX IF NOT EXISTS idx_cashbook_payment ON cashbook_transactions(payment_id);

-- Receipts
CREATE INDEX IF NOT EXISTS idx_receipts_payment ON receipts(payment_id);
CREATE INDEX IF NOT EXISTS idx_receipts_student ON receipts(student_id);
CREATE INDEX IF NOT EXISTS idx_receipts_number ON receipts(receipt_number);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(status);
CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts(receipt_date);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

-- Audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- Personal assessments
CREATE INDEX IF NOT EXISTS idx_assessments_student ON personal_assessments(student_id);
CREATE INDEX IF NOT EXISTS idx_assessments_term ON personal_assessments(term_id);
CREATE INDEX IF NOT EXISTS idx_assessments_session ON personal_assessments(session_id);

-- Grading rules
CREATE INDEX IF NOT EXISTS idx_grading_rules_active ON grading_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_grading_rules_sort ON grading_rules(sort_order);

-- ============================================
-- TRIGGER FOR UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.columns 
        WHERE column_name = 'updated_at' 
        AND table_schema = 'public'
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I;
            CREATE TRIGGER trg_%I_updated_at
            BEFORE UPDATE ON %I
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        ', t, t, t, t);
    END LOOP;
END $$;