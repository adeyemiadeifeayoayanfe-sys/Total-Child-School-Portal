import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AcademicSession, Class, Subject, Teacher, Term } from '../types';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/ui/Toast';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Table from '../components/ui/Table';
import { StatusBadge } from '../components/ui/Badge';
import { LoadingContainer } from '../components/ui/Spinner';

interface SessionWithTerms extends AcademicSession { terms?: Term[]; }
interface ReviewRow {
  id: string; class_id: string; subject_id: string;
  class: { name: string }; subject: { name: string; code?: string | null };
  teacher?: { profile?: { first_name?: string; last_name?: string } } | null;
  enrolled_students: number; saved_scores: number; missing_scores: number;
  entry_status: string; broadsheet_status: string;
}
interface ScoreRecord { id: string; test1: number; test2: number; test3: number; examination: number; total: number; updated_at: string; }
interface BroadsheetData {
  class: { name: string }; subject: { name: string; code?: string | null };
  term: Term; teacher?: { profile?: { first_name?: string; last_name?: string } } | null;
  broadsheet?: { status: string } | null;
  students: Array<{ student: { id: string; admission_number: string; first_name: string; last_name: string }; score: ScoreRecord | null; score_status: string }>;
}
interface AuditLog { id: string; created_at: string; metadata?: { reason?: string }; old_value?: { value?: number }; new_value?: { value?: number }; user?: { email?: string } | null; }

const stageLabels: Record<string, string> = { classes: 'Classes', first_test: '1st Test', second_test: '2nd Test', third_test: '3rd Test', examination: 'Examination' };

export default function ScoreReviewPage() {
  const { call } = useApi();
  const { showToast } = useToast();
  const [sessions, setSessions] = useState<SessionWithTerms[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [termId, setTermId] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [status, setStatus] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [broadsheet, setBroadsheet] = useState<BroadsheetData | null>(null);
  const [selectedRow, setSelectedRow] = useState<ReviewRow | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [studentReview, setStudentReview] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [correction, setCorrection] = useState<{ score: ScoreRecord; studentName: string } | null>(null);
  const [field, setField] = useState('test1');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedSession = sessions.find((session) => session.id === sessionId);
  const terms = selectedSession?.terms || [];
  const selectedTerm = terms.find((term) => term.id === termId);

  useEffect(() => {
    async function loadSupportData() {
      const [sessionResult, classResult, subjectResult, teacherResult] = await Promise.all([call('/sessions'), call('/classes'), call('/subjects'), call('/teachers')]);
      const loadedSessions = sessionResult.success && Array.isArray(sessionResult.data) ? sessionResult.data as SessionWithTerms[] : [];
      setSessions(loadedSessions);
      setClasses(classResult.success && Array.isArray(classResult.data) ? classResult.data as Class[] : []);
      setSubjects(subjectResult.success && Array.isArray(subjectResult.data) ? subjectResult.data as Subject[] : []);
      setTeachers(teacherResult.success && Array.isArray(teacherResult.data) ? teacherResult.data as Teacher[] : []);
      const currentSession = loadedSessions.find((session) => session.is_current) || loadedSessions[0];
      if (currentSession) {
        setSessionId(currentSession.id);
        setTermId(currentSession.terms?.find((term) => term.is_current)?.id || currentSession.terms?.[0]?.id || '');
      }
      setLoading(false);
    }
    loadSupportData();
  }, [call]);

  const fetchOverview = useCallback(async () => {
    if (!sessionId || !termId) return;
    setLoading(true);
    const params = new URLSearchParams({ session_id: sessionId, term_id: termId });
    if (classId) params.set('class_id', classId);
    if (subjectId) params.set('subject_id', subjectId);
    if (status) params.set('status', status);
    if (teacherId) params.set('teacher_id', teacherId);
    const result = await call(`/score-review/overview?${params.toString()}`);
    if (result.success && result.data) {
      const data = result.data as { rows: ReviewRow[]; summary: any };
      setRows(data.rows); setSummary(data.summary);
    } else { setRows([]); setSummary(null); showToast('error', result.error || 'Failed to load score review'); }
    setLoading(false);
  }, [call, classId, sessionId, showToast, status, subjectId, teacherId, termId]);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  const loadBroadsheet = async (row: ReviewRow) => {
    setSelectedRow(row); setSelectedStudentId(''); setStudentReview(null); setDetailsLoading(true);
    const params = new URLSearchParams({ class_id: row.class_id, subject_id: row.subject_id, session_id: sessionId, term_id: termId });
    const [sheetResult, auditResult] = await Promise.all([call(`/score-review/broadsheet?${params.toString()}`), call('/audit-logs?action=super_admin_score_corrected&entity_type=score&limit=25')]);
    if (sheetResult.success && sheetResult.data) setBroadsheet(sheetResult.data as BroadsheetData);
    else { setBroadsheet(null); showToast('error', sheetResult.error || 'Failed to load broadsheet'); }
    if (auditResult.success && auditResult.data) setAuditLogs((auditResult.data as { logs: AuditLog[] }).logs || []);
    setDetailsLoading(false);
  };

  const loadStudentReview = async (studentId: string) => {
    if (!selectedRow) return;
    setSelectedStudentId(studentId);
    const params = new URLSearchParams({ class_id: selectedRow.class_id, subject_id: selectedRow.subject_id, session_id: sessionId, term_id: termId });
    const result = await call(`/score-review/student/${studentId}?${params.toString()}`);
    if (result.success && result.data) setStudentReview(result.data);
    else showToast('error', result.error || 'Failed to load student score review');
  };

  const activeFields = useMemo(() => {
    const stage = selectedTerm?.assessment_stage;
    if (stage === 'examination') return ['test1', 'test2', 'test3', 'examination'];
    if (stage === 'third_test') return ['test1', 'test2', 'test3'];
    if (stage === 'second_test') return ['test1', 'test2'];
    return ['test1'];
  }, [selectedTerm]);

  const openCorrection = (studentName: string, score: ScoreRecord) => {
    const initialField = activeFields[0];
    setCorrection({ studentName, score }); setField(initialField); setValue(String((score as any)[initialField] ?? '')); setReason('');
  };

  const submitCorrection = async () => {
    if (!correction || !reason.trim()) { showToast('error', 'Enter a meaningful correction reason'); return; }
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) { showToast('error', 'Enter a valid score'); return; }
    setSaving(true);
    const result = await call(`/score-review/scores/${correction.score.id}/correct`, { method: 'POST', body: { field, value: numericValue, reason: reason.trim(), expected_updated_at: correction.score.updated_at } });
    if (result.success) {
      showToast('success', 'Score corrected. A permanent audit entry was created.');
      setCorrection(null);
      if (selectedRow) await loadBroadsheet(selectedRow);
      await fetchOverview();
    } else showToast('error', result.error || 'Unable to correct score');
    setSaving(false);
  };

  if (loading && sessions.length === 0) return <LoadingContainer text="Loading score review..." />;
  const metrics = summary || { class_subjects: 0, with_saved_scores: 0, incomplete_entries: 0, missing_scores: 0, submitted: 0, unsubmitted: 0 };
  return <div>
    <div className="page-header"><div><h1 className="page-title">Score Review</h1><p className="page-description">Review saved teacher scores before broadsheet submission and record controlled corrections.</p></div><Button variant="secondary" onClick={fetchOverview} disabled={loading}>Refresh</Button></div>
    <Card hover={false}><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      <label><span className="form-label">Session</span><select className="form-input" value={sessionId} onChange={(event) => { const next = sessions.find((session) => session.id === event.target.value); setSessionId(event.target.value); setTermId(next?.terms?.find((term) => term.is_current)?.id || next?.terms?.[0]?.id || ''); }}><option value="">Select session</option>{sessions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}</select></label>
      <label><span className="form-label">Term</span><select className="form-input" value={termId} onChange={(event) => setTermId(event.target.value)}>{terms.map((term) => <option key={term.id} value={term.id}>{term.name} - {stageLabels[term.assessment_stage]}</option>)}</select></label>
      <label><span className="form-label">Class</span><select className="form-input" value={classId} onChange={(event) => setClassId(event.target.value)}><option value="">All classes</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label><span className="form-label">Subject</span><select className="form-input" value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="">All subjects</option>{subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label><span className="form-label">Teacher</span><select className="form-input" value={teacherId} onChange={(event) => setTeacherId(event.target.value)}><option value="">All teachers</option>{teachers.map((item) => <option key={item.id} value={item.id}>{item.profile?.first_name || ''} {item.profile?.last_name || item.staff_number}</option>)}</select></label>
      <label><span className="form-label">Broadsheet status</span><select className="form-input" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="unsubmitted">Unsubmitted</option><option value="submitted">Submitted</option><option value="returned">Returned</option><option value="approved">Approved</option></select></label>
    </div></Card>
    <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6 mt-6">{[['Class subjects', metrics.class_subjects], ['With saved scores', metrics.with_saved_scores], ['Incomplete entry', metrics.incomplete_entries], ['Missing scores', metrics.missing_scores], ['Submitted / approved', metrics.submitted], ['Unsubmitted', metrics.unsubmitted]].map(([label, metric]) => <Card key={String(label)} padding="sm"><div className="text-sm text-gray-500">{label}</div><div className="mt-1 text-2xl font-semibold">{metric}</div></Card>)}</div>
    <Card title="Class subject progress" subtitle="Saved records are visible before a teacher submits a broadsheet." className="mt-6" hover={false}>
      <Table loading={loading} data={rows} emptyMessage="No active class subjects match these filters." columns={[
        { key: 'class', header: 'Class', render: (row) => row.class.name }, { key: 'subject', header: 'Subject', render: (row) => row.subject.name },
        { key: 'teacher', header: 'Teacher', render: (row) => row.teacher ? `${row.teacher.profile?.first_name || ''} ${row.teacher.profile?.last_name || ''}`.trim() || 'Assigned' : 'Unassigned' },
        { key: 'progress', header: 'Scores', render: (row) => `${row.saved_scores}/${row.enrolled_students}` }, { key: 'missing', header: 'Missing', render: (row) => row.missing_scores },
        { key: 'status', header: 'Status', render: (row) => <div className="flex gap-2"><StatusBadge status={row.entry_status === 'complete' ? 'completed' : row.entry_status === 'not_started' ? 'pending' : 'returned'} /><StatusBadge status={row.broadsheet_status} /></div> },
        { key: 'actions', header: '', render: (row) => <Button size="sm" variant="secondary" onClick={() => loadBroadsheet(row)}>Open review</Button> },
      ]} />
    </Card>
    <Modal open={!!selectedRow} onClose={() => { if (!detailsLoading) { setSelectedRow(null); setBroadsheet(null); } }} title={broadsheet ? `${broadsheet.class.name} - ${broadsheet.subject.name}` : 'Broadsheet review'} size="lg">
      {detailsLoading ? <div className="py-8 text-center">Loading saved scores...</div> : broadsheet && <div className="grid gap-5"><div className="flex flex-wrap gap-3 text-sm"><StatusBadge status={broadsheet.broadsheet?.status || 'unsubmitted'} /><span>Stage: <strong>{stageLabels[broadsheet.term.assessment_stage]}</strong></span><span>Teacher: <strong>{broadsheet.teacher ? `${broadsheet.teacher.profile?.first_name || ''} ${broadsheet.teacher.profile?.last_name || ''}`.trim() : 'Unassigned'}</strong></span></div>
        <Table data={broadsheet.students.map((item) => ({ id: item.student.id, ...item }))} emptyMessage="No enrolled students found." columns={[
          { key: 'student', header: 'Student', render: (item: any) => <button className="text-left font-medium text-blue-700 hover:underline" onClick={() => loadStudentReview(item.student.id)}>{item.student.last_name} {item.student.first_name}<div className="text-xs text-gray-500">{item.student.admission_number}</div></button> },
          ...activeFields.map((activeField) => ({ key: activeField, header: activeField === 'test1' ? 'Test 1' : activeField === 'test2' ? 'Test 2' : activeField === 'test3' ? 'Test 3' : 'Exam', render: (item: any) => item.score ? String(item.score[activeField]) : 'Not entered' })),
          { key: 'total', header: 'Total', render: (item: any) => item.score ? item.score.total : '-' }, { key: 'state', header: 'State', render: (item: any) => <StatusBadge status={item.score_status === 'saved' ? 'completed' : item.score_status === 'missing' ? 'pending' : 'returned'} /> },
          { key: 'correct', header: '', render: (item: any) => item.score ? <Button size="sm" variant="outline" onClick={() => openCorrection(`${item.student.first_name} ${item.student.last_name}`, item.score)}>Correct</Button> : '-' },
        ]} />
        {selectedStudentId && <div className="rounded border p-3 text-sm">Individual review: <strong>{studentReview?.student?.first_name || broadsheet.students.find((item) => item.student.id === selectedStudentId)?.student.first_name} {studentReview?.student?.last_name || broadsheet.students.find((item) => item.student.id === selectedStudentId)?.student.last_name}</strong>. {studentReview?.score ? `Saved total: ${studentReview.score.total}.` : 'No saved score exists for this subject.'}</div>}
        <div><h3 className="mb-2 font-semibold">Recent correction history</h3>{auditLogs.length ? <div className="grid gap-2">{auditLogs.map((log) => <div key={log.id} className="rounded border p-3 text-sm"><strong>{log.user?.email || 'Super Admin'}</strong> changed {log.old_value?.value} to {log.new_value?.value}. {log.metadata?.reason && <span>Reason: {log.metadata.reason}</span>}<div className="text-xs text-gray-500">{new Date(log.created_at).toLocaleString()}</div></div>)}</div> : <p className="text-sm text-gray-500">No score corrections recorded yet.</p>}</div>
      </div>}
    </Modal>
    <Modal open={!!correction} onClose={() => !saving && setCorrection(null)} title="Correct saved score" footer={<><Button variant="secondary" onClick={() => setCorrection(null)} disabled={saving}>Cancel</Button><Button onClick={submitCorrection} loading={saving}>Save correction</Button></>}>
      {correction && <div className="grid gap-4"><p className="text-sm text-gray-600">Correcting <strong>{correction.studentName}</strong>. This action records the reason, returns affected submitted broadsheets for review, and archives generated results for regeneration.</p><label><span className="form-label">Assessment field</span><select className="form-input" value={field} onChange={(event) => { setField(event.target.value); setValue(String((correction.score as any)[event.target.value] ?? '')); }}>{activeFields.map((item) => <option key={item} value={item}>{item === 'test1' ? 'Test 1' : item === 'test2' ? 'Test 2' : item === 'test3' ? 'Test 3' : 'Examination'}</option>)}</select></label><label><span className="form-label">New score</span><input className="form-input" type="number" min="0" max={field === 'examination' ? 40 : 20} step="0.01" value={value} onChange={(event) => setValue(event.target.value)} /></label><label><span className="form-label">Correction reason</span><textarea className="form-input" rows={4} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain why this saved score is being corrected." /></label></div>}
    </Modal>
  </div>;
}
