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
export type ReceiptStatus = 'pending' | 'generated' | 'printed' | 'voided';

// ============================================
// API RESPONSE
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
// USER
// ============================================

export interface User {
  id: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  profile?: Profile;
  teacher?: Teacher;
  parent?: Parent;
}

export interface Profile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  address: string | null;
  avatar_url: string | null;
}

// ============================================
// ACADEMIC
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
// PEOPLE
// ============================================

export interface Student {
  id: string;
  admission_number: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  date_of_birth: string;
  admission_date: string | null;
  gender: Gender;
  address: string | null;
  phone: string | null;
  email: string | null;
  status: StudentStatus;
  current_class_id: string | null;
  current_class?: Class;
}

export interface Teacher {
  id: string;
  user_id: string;
  staff_number: string;
  qualification: string | null;
  specialization: string | null;
  is_active: boolean;
  profile?: Profile;
  user?: User;
}

export interface Parent {
  id: string;
  user_id: string;
  occupation: string | null;
  relationship_to_student: string | null;
  is_active: boolean;
  profile?: Profile;
  user?: User;
}

// ============================================
// SCORES & BROADSHEETS
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
  student?: Student;
  subject?: Subject;
}

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
  class?: Class;
  subject?: Subject;
  teacher?: Teacher;
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
  student?: Student;
  class?: Class;
  session?: AcademicSession;
  term?: Term;
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
  subject?: Subject;
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
  student?: Student;
}

// ============================================
// FINANCE
// ============================================

export interface Payment {
  id: string;
  payment_reference: string;
  student_id: string;
  amount: number;
  purpose: string;
  payment_date: string;
  payment_method: string;
  status: PaymentStatus;
  student?: Student;
  receipt?: Receipt;
}

export interface CashbookTransaction {
  id: string;
  transaction_date: string;
  particulars: string;
  txn_type: 'credit' | 'debit';
  amount: number;
  description: string | null;
  running_balance: number;
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
  student?: Student;
}

// ============================================
// DASHBOARD
// ============================================

export interface AdminDashboardData {
  students: number;
  teachers: number;
  parents: number;
  classes: number;
  today_attendance: {
    total: number;
    present: number;
    absent: number;
  };
  pending_broadsheets: number;
  generated_results: number;
  published_results: number;
  today_payments: {
    count: number;
    total: number;
  };
  cashbook_balance: number;
  receipt_queue: number;
}

export interface TeacherDashboardData {
  classes: any[];
  subjects: any[];
  today_attendance_taken: boolean;
  pending_broadsheets: any[];
  total_classes: number;
  total_subjects: number;
  pending_broadsheet_count: number;
}

export interface ParentDashboardData {
  children: Array<{
    student: Student;
    latest_result: Result | null;
    recent_payments: Payment[];
    recent_attendance: Attendance[];
  }>;
  total_children: number;
}

// ============================================
// ADMIN / AUDIT
// ============================================

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  user?: User | null;
}
