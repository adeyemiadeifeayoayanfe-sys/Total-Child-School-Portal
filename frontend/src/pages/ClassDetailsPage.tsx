import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/ui/Toast';
import { AcademicSession, Student } from '../types';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Table from '../components/ui/Table';
import Modal from '../components/ui/Modal';
import { StatusBadge } from '../components/ui/Badge';
import { LoadingContainer } from '../components/ui/Spinner';

interface ClassDetails {
  id: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  student_count?: number;
  subject_count?: number;
  enrollments?: Array<{ id: string; unenrolled_at?: string | null; student?: { id: string; first_name?: string; last_name?: string; admission_number?: string } }>;
  teacher_class_assignments?: Array<{ id: string; is_class_teacher?: boolean; teacher?: { profile?: { first_name?: string; last_name?: string } } }>;
  class_subject_assignments?: Array<{ id: string; subject?: { name?: string }; session?: { name?: string } }>;
}

export default function ClassDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { call } = useApi();
  const { showToast } = useToast();
  const [details, setDetails] = useState<ClassDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [assigningStudent, setAssigningStudent] = useState(false);

  const loadDetails = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const result = await call(`/classes/${id}`);
    if (result.success && result.data) {
      setDetails(result.data as ClassDetails);
      setError('');
    } else setError(result.error || 'Failed to load class details');
    setLoading(false);
  }, [call, id]);

  useEffect(() => { loadDetails(); }, [loadDetails]);

  const openAddStudent = async () => {
    setShowAddStudent(true);
    setLoadingStudents(true);
    const [studentsResult, sessionsResult] = await Promise.all([
      call('/students?status=active&limit=100'),
      call('/sessions'),
    ]);
    if (studentsResult.success && Array.isArray(studentsResult.data)) {
      setStudents(studentsResult.data as Student[]);
    } else {
      showToast('error', studentsResult.error || 'Failed to load students');
    }
    if (sessionsResult.success && Array.isArray(sessionsResult.data)) {
      const sessions = sessionsResult.data as AcademicSession[];
      setSessions(sessions);
      setSessionId(sessions.find((session) => session.is_current)?.id || sessions[0]?.id || '');
    } else {
      showToast('error', sessionsResult.error || 'Failed to load academic sessions');
    }
    setLoadingStudents(false);
  };

  const assignStudent = async () => {
    if (!id || !selectedStudentId || !sessionId) {
      showToast('error', 'Select a student and academic session');
      return;
    }
    setAssigningStudent(true);
    const result = await call('/students/assign-class', {
      method: 'POST',
      body: { student_id: selectedStudentId, class_id: id, session_id: sessionId },
    });
    if (result.success) {
      showToast('success', 'Student assigned to this class');
      setShowAddStudent(false);
      setSelectedStudentId('');
      await loadDetails();
    } else {
      showToast('error', result.error || 'Failed to assign student');
    }
    setAssigningStudent(false);
  };
  if (loading) return <LoadingContainer text="Loading class details..." />;
  if (!details) return <div><Button variant="secondary" onClick={() => navigate('/classes')}>Back to Classes</Button><Card className="mt-4" hover={false}><p className="text-red-600">{error || 'Class not found.'}</p></Card></div>;
  const activeEnrollments = details.enrollments?.filter((enrollment) => !enrollment.unenrolled_at) || [];
  return <div>
    <div className="page-header"><div><h1 className="page-title">{details.name}</h1><p className="page-description">Class roster, teachers, and assigned subjects.</p></div><div className="flex gap-2"><Button onClick={openAddStudent}>Add Student</Button><Button variant="secondary" onClick={() => navigate('/classes')}>Back to Classes</Button></div></div>
    <div className="grid gap-4 md:grid-cols-3"><Card padding="sm"><div className="text-sm text-gray-500">Status</div><div className="mt-2"><StatusBadge status={details.is_active ? 'active' : 'inactive'} /></div></Card><Card padding="sm"><div className="text-sm text-gray-500">Students</div><div className="mt-1 text-2xl font-semibold">{details.student_count ?? activeEnrollments.length}</div></Card><Card padding="sm"><div className="text-sm text-gray-500">Subjects</div><div className="mt-1 text-2xl font-semibold">{details.subject_count ?? details.class_subject_assignments?.length ?? 0}</div></Card></div>
    {details.description && <Card title="Description" className="mt-6" hover={false}><p>{details.description}</p></Card>}
    <Card title="Student Roster" className="mt-6" hover={false}><Table data={activeEnrollments} emptyMessage="No students are currently enrolled in this class." columns={[{ key: 'student', header: 'Student', render: (row: any) => `${row.student?.last_name || ''} ${row.student?.first_name || ''}`.trim() || 'Unknown student' }, { key: 'admission', header: 'Admission Number', render: (row: any) => row.student?.admission_number || '-' }]} /></Card>
    <div className="grid gap-6 lg:grid-cols-2 mt-6"><Card title="Assigned Teachers" hover={false}>{details.teacher_class_assignments?.length ? <div className="grid gap-2">{details.teacher_class_assignments.map((assignment) => <div className="rounded border p-3" key={assignment.id}>{`${assignment.teacher?.profile?.first_name || ''} ${assignment.teacher?.profile?.last_name || ''}`.trim() || 'Assigned teacher'}{assignment.is_class_teacher && <div className="text-sm text-gray-500">Class Teacher</div>}</div>)}</div> : <p className="text-sm text-gray-500">No teachers assigned.</p>}</Card><Card title="Assigned Subjects" hover={false}>{details.class_subject_assignments?.length ? <div className="grid gap-2">{details.class_subject_assignments.map((assignment) => <div className="rounded border p-3" key={assignment.id}>{assignment.subject?.name || 'Unnamed subject'}{assignment.session?.name && <div className="text-sm text-gray-500">{assignment.session.name}</div>}</div>)}</div> : <p className="text-sm text-gray-500">No subjects assigned.</p>}</Card></div>
    <Modal open={showAddStudent} onClose={() => !assigningStudent && setShowAddStudent(false)} title={`Add Student to ${details.name}`} footer={<><Button variant="secondary" onClick={() => setShowAddStudent(false)} disabled={assigningStudent}>Cancel</Button><Button onClick={assignStudent} loading={assigningStudent} disabled={loadingStudents || !selectedStudentId || !sessionId}>Add to This Class</Button></>}>
      {loadingStudents ? <div className="py-8 text-center">Loading students...</div> : <div className="grid gap-4"><p className="text-sm text-gray-600">The selected student will be assigned directly to <strong>{details.name}</strong>.</p><label><span className="form-label">Academic Session</span><select className="form-input" value={sessionId} onChange={(event) => setSessionId(event.target.value)}><option value="">Select session</option>{sessions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}</select></label><label><span className="form-label">Student</span><select className="form-input" value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)}><option value="">Select existing student</option>{students.filter((student) => !activeEnrollments.some((enrollment) => enrollment.student?.id === student.id)).map((student) => <option key={student.id} value={student.id}>{student.last_name} {student.first_name} ({student.admission_number})</option>)}</select></label></div>}
    </Modal>
  </div>;
}
