import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/ui/Toast';
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
  const [assigningStudent, setAssigningStudent] = useState(false);
  const [studentForm, setStudentForm] = useState({ admission_number: '', first_name: '', last_name: '', middle_name: '', date_of_birth: '', gender: 'male', phone: '', address: '', email: '' });

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

  const openAddStudent = () => {
    setShowAddStudent(true);
    setStudentForm({ admission_number: '', first_name: '', last_name: '', middle_name: '', date_of_birth: '', gender: 'male', phone: '', address: '', email: '' });
  };

  const createStudent = async () => {
    if (!id || !studentForm.admission_number.trim() || !studentForm.first_name.trim() || !studentForm.last_name.trim()) {
      showToast('error', 'Admission number, first name, and last name are required');
      return;
    }
    setAssigningStudent(true);
    const result = await call('/students', {
      method: 'POST',
      body: { ...studentForm, admission_number: studentForm.admission_number.trim(), first_name: studentForm.first_name.trim(), last_name: studentForm.last_name.trim(), middle_name: studentForm.middle_name.trim() || null, date_of_birth: studentForm.date_of_birth || null, phone: studentForm.phone.trim() || null, address: studentForm.address.trim() || null, email: studentForm.email.trim() || null, class_id: id },
    });
    if (result.success) {
      showToast('success', 'Student created and added to this class');
      setShowAddStudent(false);
      await loadDetails();
    } else {
      showToast('error', result.error || 'Failed to create student');
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
    <Card title="Student Roster" action={<Button size="sm" onClick={openAddStudent}>Add Student to {details.name}</Button>} className="mt-6" hover={false}><Table data={activeEnrollments} emptyMessage="No students are currently enrolled in this class." columns={[{ key: 'student', header: 'Student', render: (row: any) => `${row.student?.last_name || ''} ${row.student?.first_name || ''}`.trim() || 'Unknown student' }, { key: 'admission', header: 'Admission Number', render: (row: any) => row.student?.admission_number || '-' }]} /></Card>
    <div className="grid gap-6 lg:grid-cols-2 mt-6"><Card title="Assigned Teachers" hover={false}>{details.teacher_class_assignments?.length ? <div className="grid gap-2">{details.teacher_class_assignments.map((assignment) => <div className="rounded border p-3" key={assignment.id}>{`${assignment.teacher?.profile?.first_name || ''} ${assignment.teacher?.profile?.last_name || ''}`.trim() || 'Assigned teacher'}{assignment.is_class_teacher && <div className="text-sm text-gray-500">Class Teacher</div>}</div>)}</div> : <p className="text-sm text-gray-500">No teachers assigned.</p>}</Card><Card title="Assigned Subjects" hover={false}>{details.class_subject_assignments?.length ? <div className="grid gap-2">{details.class_subject_assignments.map((assignment) => <div className="rounded border p-3" key={assignment.id}>{assignment.subject?.name || 'Unnamed subject'}{assignment.session?.name && <div className="text-sm text-gray-500">{assignment.session.name}</div>}</div>)}</div> : <p className="text-sm text-gray-500">No subjects assigned.</p>}</Card></div>
    <Modal open={showAddStudent} onClose={() => !assigningStudent && setShowAddStudent(false)} title={`Add New Student to ${details.name}`} footer={<><Button variant="secondary" onClick={() => setShowAddStudent(false)} disabled={assigningStudent}>Cancel</Button><Button onClick={createStudent} loading={assigningStudent}>Create and Add</Button></>}>
      <div className="grid gap-4"><p className="text-sm text-gray-600">This student will be registered directly in <strong>{details.name}</strong>; the class cannot be changed here.</p><label><span className="form-label">Admission Number</span><input className="form-input" value={studentForm.admission_number} onChange={(event) => setStudentForm({ ...studentForm, admission_number: event.target.value })} /></label><div className="grid grid-cols-2 gap-4"><label><span className="form-label">First Name</span><input className="form-input" value={studentForm.first_name} onChange={(event) => setStudentForm({ ...studentForm, first_name: event.target.value })} /></label><label><span className="form-label">Last Name</span><input className="form-input" value={studentForm.last_name} onChange={(event) => setStudentForm({ ...studentForm, last_name: event.target.value })} /></label></div><div className="grid grid-cols-2 gap-4"><label><span className="form-label">Middle Name</span><input className="form-input" value={studentForm.middle_name} onChange={(event) => setStudentForm({ ...studentForm, middle_name: event.target.value })} /></label><label><span className="form-label">Date of Birth (Optional)</span><input type="date" className="form-input" value={studentForm.date_of_birth} onChange={(event) => setStudentForm({ ...studentForm, date_of_birth: event.target.value })} /></label></div><label><span className="form-label">Gender</span><select className="form-select" value={studentForm.gender} onChange={(event) => setStudentForm({ ...studentForm, gender: event.target.value })}><option value="male">Male</option><option value="female">Female</option></select></label></div>
    </Modal>
  </div>;
}
