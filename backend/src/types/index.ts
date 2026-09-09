// ============================================
// COMMON TYPES
// ============================================

export type UserRole = 'super_admin' | 'admin' | 'teacher' | 'parent';
export type AccountStatus = 'active' | 'inactive' | 'suspended';
export type TermName = 'first' | 'second' | 'third';
export type AssessmentStage = 'classes' | 'first_test' | 'second_test' | 'third_test' | 'examination';
export type StudentStatus = 'active' | 'archived' | 'graduated' | 'transferred';
export type BroadsheetStatus = 'draft' | 'submitted' | 'returned' | 'approved';
export type ResultStatus = 'pending' | 'generated' | 'reviewed' | 'published' | 'archived';
export type Gender = 'male' | 'female' | 'other';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded' | 'voided';
export type CashbookTxnType = 'credit' | 'debit';
export type ReceiptStatus = 'pending' | 'generated' | 'printed' | 'voided';
export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'announcement';

// ============================================
// USER & AUTH
// ============================================

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  roles: UserRole[];
  status: AccountStatus;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  address: string | null;
  avatar_url: string | null;
  date_of_birth: string | null;
  gender: Gender | null;
}

export interface UserWithProfile extends AuthUser {
  profile?: Profile;
  teacher?: Teacher;
  parent?: Parent;
}

// ============================================
// ACADEMIC STRUCTURE
// ============================================

export interface AcademicSession {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
}

export interface Term {
  id: string;
  session_id: string;
  name: TermName;
  start_date: string;
  end_date: string;
  is_current: boolean;
  assessment_stage: AssessmentStage;
}

// ============================================
// CLASSES & SUBJECTS
// ============================================

export interface Class {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export interface Subject {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  is_active: boolean;
}

// ============================================
// STUDENTS
// ============================================

export interface Student {
  id: string;
  admission_number: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  date_of_birth: string;
  gender: Gender;
  address: string | null;
  phone: string | null;
  email: string | null;
  photo_url: string | null;
  status: StudentStatus;
  admission_date: string;
  current_class_id: string | null;
}

// ============================================
// TEACHERS & PARENTS
// ============================================

export interface Teacher {
  id: string;
  user_id: string;
  staff_number: string;
  qualification: string | null;
  specialization: string | null;
  date_hired: string | null;
  is_active: boolean;
}

export interface Parent {
  id: string;
  user_id: string;
  occupation: string | null;
  relationship_to_student: string | null;
  alternate_phone: string | null;
  is_active: boolean;
}

// ============================================
// SCORES
// ============================================

export interface Score {
  id: string;
  student_id: string;
  class_id: string;
  subject_id: string;
  session_id: string;
  term_id: string;
  test1: number;
  test2: number;
  test3: number;
  examination: number;
  total: number;
  percentage: number;
  entered_by: string;
}

// ============================================
// BROADSHEETS
// ============================================

export interface BroadsheetSubmission {
  id: string;
  class_id: string;
  subject_id: string;
  session_id: string;
  term_id: string;
  teacher_id: string;
  status: BroadsheetStatus;
  submitted_at: string | null;
  approved_at: string | null;
  returned_at: string | null;
  return_reason: string | null;
  approved_by: string | null;
}

// ============================================
// RESULTS
// ============================================

export interface Result {
  id: string;
  student_id: string;
  class_id: string;
  session_id: string;
  term_id: string;
  term_average: number | null;
  term_position: number | null;
  cumulative_average: number | null;
  status: ResultStatus;
  attendance_days: number;
  attendance_present: number;
  generated_by: string | null;
  reviewed_by: string | null;
  published_by: string | null;
  generated_at: string | null;
  reviewed_at: string | null;
  published_at: string | null;
}

export interface ResultSubject {
  id: string;
  result_id: string;
  subject_id: string;
  test1: number;
  test2: number;
  test3: number;
  examination: number;
  total: number;
  percentage: number;
  grade: string | null;
  position: number | null;
}

export interface ResultVersion {
  id: string;
  result_id: string;
  version_number: number;
  generated_by: string | null;
  generated_at: string;
  reason: string | null;
  data_snapshot: Record<string, any>;
}

// ============================================
// ATTENDANCE
// ============================================

export interface Attendance {
  id: string;
  student_id: string;
  class_id: string;
  session_id: string;
  term_id: string;
  attendance_date: string;
  status: AttendanceStatus;
  remarks: string | null;
  marked_by: string;
}

// ============================================
// PAYMENTS & FINANCE
// ============================================

export interface Payment {
  id: string;
  payment_reference: string;
  student_id: string;
  session_id: string | null;
  amount: number;
  purpose: string;
  payment_date: string;
  payment_method: string;
  status: PaymentStatus;
  recorded_by: string;
  idempotency_key: string | null;
}

export interface CashbookTransaction {
  id: string;
  transaction_date: string;
  particulars: string;
  txn_type: CashbookTxnType;
  amount: number;
  description: string | null;
  payment_id: string | null;
  running_balance: number;
  recorded_by: string;
}

export interface Receipt {
  id: string;
  receipt_number: string;
  payment_id: string;
  student_id: string;
  amount: number;
  purpose: string;
  receipt_date: string;
  status: ReceiptStatus;
  generated_at: string | null;
  printed_at: string | null;
  voided_at: string | null;
  void_reason: string | null;
  edited_by: string | null;
  last_edited_at: string | null;
}

// ============================================
// NOTIFICATIONS & AUDIT
// ============================================

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  notification_type: NotificationType;
  is_read: boolean;
  read_at: string | null;
  link: string | null;
  metadata: Record<string, any>;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_value: Record<string, any> | null;
  new_value: Record<string, any> | null;
  metadata: Record<string, any>;
  ip_address: string | null;
  user_agent: string | null;
}

// ============================================
// SETTINGS
// ============================================

export interface GradingRule {
  id: string;
  grade: string;
  min_score: number;
  max_score: number;
  remarks: string | null;
  is_active: boolean;
  sort_order: number;
}

// ============================================
// API RESPONSES
// ============================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// ============================================
// EXPRESS REQUEST EXTENSION
// ============================================

declare global {
  namespace Express {
    interface Request {
      user?: UserWithProfile;
      authUserId?: string;
      idempotencyKey?: string;
    }
  }
}