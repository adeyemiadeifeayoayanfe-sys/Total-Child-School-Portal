import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import { Result, Class, Student } from '../types';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Card from '../components/ui/Card';
import { StatusBadge } from '../components/ui/Badge';
export default function ResultsPage() {
  const { call } = useApi();
  const { showToast } = useToast();
  const { user, activeRole } = useAuth();
  const [results, setResults] = useState<Result[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showBulkGenerateModal, setShowBulkGenerateModal] = useState(false);
  const [selectedResult, setSelectedResult] = useState<Result | null>(null);
  const [showResultDetail, setShowResultDetail] = useState(false);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [regenerateReason, setRegenerateReason] = useState('');
  const [sessions, setSessions] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    student_id: '',
    class_id: '',
    session_id: '',
    term_id: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const role = activeRole || user?.role;
  const isAdmin = role === 'admin' || role === 'super_admin';
  const isParent = role === 'parent';
  const fetchClasses = async () => {
    const result = await call('/classes');
    if (result.success && result.data) {
      setClasses(result.data);
    }
  };
  const fetchSessions = async () => {
    const result = await call('/sessions');
    if (result.success && result.data) {
      setSessions(result.data);
    }
  };
  const fetchResults = useCallback(async () => {
    setLoading(true);
    if (isParent) {
      const childrenResult = await call('/parents/my/children');
      if (childrenResult.success && childrenResult.data) {
        const allResults: Result[] = [];
        for (const child of childrenResult.data) {
          const childResults = await call(
            `/parents/my/children/${child.student.id}/results`
          );
          if (childResults.success && childResults.data) {
            allResults.push(...childResults.data);
          }
        }
        setResults(allResults);
      }
    } else {
      const result = await call('/results');
      if (result.success && result.data) {
        setResults(result.data);
      }
    }
    setLoading(false);
  }, [call, isParent]);
  useEffect(() => {
    fetchResults();
    if (isAdmin) {
      fetchClasses();
      fetchSessions();
    }
  }, [fetchResults, isAdmin]);
  const fetchStudentsForClass = async (classId: string) => {
    const sessionResult = await call('/sessions/current');
    if (!sessionResult.success || !sessionResult.data) {
      return;
    }
    const rosterResult = await call(
      `/classes/${classId}/roster?session_id=${sessionResult.data.id}`
    );
    if (rosterResult.success && rosterResult.data) {
      setStudents(
        rosterResult.data.map((enrollment: any) => enrollment.student)
      );
    }
  };
  const handleGenerateIndividual = async () => {
    if (
      !formData.student_id ||
      !formData.class_id ||
      !formData.session_id ||
      !formData.term_id
    ) {
      showToast('error', 'Please select all required fields');
      return;
    }
    setSubmitting(true);
    const result = await call('/results/generate', {
      method: 'POST',
      body: formData,
    });
    if (result.success) {
      showToast('success', 'Result generated successfully');
      setShowGenerateModal(false);
      await fetchResults();
    } else {
      showToast('error', result.error || 'Failed to generate result');
    }
    setSubmitting(false);
  };
  const handleBulkGenerate = async () => {
    if (!formData.class_id || !formData.session_id || !formData.term_id) {
      showToast('error', 'Please select class, session, and term');
      return;
    }
    setSubmitting(true);
    const result = await call('/results/bulk-generate', {
      method: 'POST',
      body: {
        class_id: formData.class_id,
        session_id: formData.session_id,
        term_id: formData.term_id,
      },
    });
    if (result.success) {
      showToast(
        'success',
        `Results generated: ${result.data.successfully_generated} successful, ${result.data.failed} failed`
      );
      setShowBulkGenerateModal(false);
      await fetchResults();
    } else {
      showToast('error', result.error || 'Failed to generate results');
    }
    setSubmitting(false);
  };
  const handleReview = async (result: Result) => {
    const res = await call(`/results/${result.id}/review`, {
      method: 'POST',
    });
    if (res.success) {
      showToast('success', 'Result reviewed successfully');
      await fetchResults();
      setSelectedResult((current) =>
        current?.id === result.id
          ? { ...current, status: 'reviewed' }
          : current
      );
    } else {
      showToast('error', res.error || 'Failed to review result');
    }
  };
  const handlePublish = async (result: Result) => {
    const res = await call(`/results/${result.id}/publish`, {
      method: 'POST',
    });
    if (res.success) {
      showToast('success', 'Result published successfully');
      await fetchResults();
      setSelectedResult((current) =>
        current?.id === result.id
          ? { ...current, status: 'published' }
          : current
      );
    } else {
      showToast('error', res.error || 'Failed to publish result');
    }
  };
  const openRegenerateModal = (result: Result) => {
    setSelectedResult(result);
    setRegenerateReason('');
    setShowRegenerateModal(true);
  };
  const handleRegenerate = async () => {
    if (!selectedResult) {
      return;
    }
    if (!regenerateReason.trim()) {
      showToast('error', 'Please provide a reason for regeneration');
      return;
    }
    setSubmitting(true);
    const res = await call(`/results/${selectedResult.id}/regenerate`, {
      method: 'POST',
      body: {
        reason: regenerateReason.trim(),
      },
    });
    if (res.success) {
      showToast('success', 'Result regenerated successfully');
      setShowRegenerateModal(false);
      setRegenerateReason('');
      await fetchResults();
      if (res.data) {
        setSelectedResult(res.data);
      }
    } else {
      showToast('error', res.error || 'Failed to regenerate result');
    }
    setSubmitting(false);
  };
  const openResultDetail = async (result: Result) => {
    const detail = await call(`/results/${result.id}`);
    if (detail.success && detail.data) {
      setSelectedResult(detail.data);
    } else {
      setSelectedResult(result);
    }
    setShowResultDetail(true);
  };
  const printReportCard = (result: Result) => {
    const student = result.student;
    const scores = result.scores || [];
    const termName = result.term?.name
      ? `${result.term.name.charAt(0).toUpperCase()}${result.term.name.slice(1)} Term`
      : 'Term';
    const esc = (value: unknown) =>
      String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    const scoreRows = scores
      .map(
        (score: any) => `
          <tr>
            <td class="subject">${esc(score.subject?.name || '-')}</td>
            <td>${esc(score.test1 ?? '-')}</td>
            <td>${esc(score.test2 ?? '-')}</td>
            <td>${esc(score.test3 ?? '-')}</td>
            <td>${esc(score.examination ?? '-')}</td>
            <td class="strong">${esc(score.total ?? '-')}</td>
            <td class="strong">${esc(score.grade ?? '-')}</td>
          </tr>
        `
      )
      .join('');
    const printWindow = window.open(
      '',
      '_blank',
      'width=900,height=1200'
    );
    if (!printWindow) {
      showToast(
        'error',
        'Please allow pop-ups to print the report card'
      );
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>
          ${esc(student?.first_name)} ${esc(student?.last_name)} - Report Card
        </title>
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            margin: 0;
            font-family: Arial, Helvetica, sans-serif;
            color: #111827;
            background: white;
            font-size: 11px;
          }
          .report-card {
            width: 100%;
          }
          .school-header {
            text-align: center;
            border-bottom: 2px solid #1d4ed8;
            padding-bottom: 10px;
            margin-bottom: 12px;
          }
          .school-name {
            font-size: 22px;
            font-weight: 800;
            color: #1d4ed8;
          }
          .school-subtitle {
            font-size: 11px;
            color: #4b5563;
          }
          .report-title {
            margin-top: 9px;
            font-size: 15px;
            font-weight: 800;
            letter-spacing: .5px;
          }
          .student-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            border: 1px solid #9ca3af;
            margin-bottom: 12px;
          }
          .info-item {
            padding: 7px 9px;
            border-bottom: 1px solid #d1d5db;
          }
          .info-item:nth-child(odd) {
            border-right: 1px solid #d1d5db;
          }
          .info-label {
            display: block;
            font-size: 8px;
            text-transform: uppercase;
            color: #6b7280;
            font-weight: 700;
            margin-bottom: 2px;
          }
          .info-value {
            font-weight: 700;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
          }
          th,
          td {
            border: 1px solid #9ca3af;
            padding: 6px 5px;
            text-align: center;
          }
          th {
            background: #eff6ff;
            font-size: 9px;
            font-weight: 800;
          }
          td.subject {
            text-align: left;
            font-weight: 600;
          }
          td.strong {
            font-weight: 800;
          }
          .summary {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            border: 1px solid #9ca3af;
            margin-bottom: 18px;
          }
          .summary-item {
            padding: 9px 5px;
            text-align: center;
            border-right: 1px solid #d1d5db;
          }
          .summary-item:last-child {
            border-right: none;
          }
          .summary-label {
            display: block;
            font-size: 8px;
            text-transform: uppercase;
            color: #6b7280;
            font-weight: 700;
            margin-bottom: 4px;
          }
          .summary-value {
            font-size: 15px;
            font-weight: 800;
          }
          .signatures {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 25px;
            margin-top: 42px;
          }
          .signature {
            text-align: center;
            border-top: 1px solid #374151;
            padding-top: 6px;
            font-size: 9px;
            font-weight: 700;
          }
          .footer {
            text-align: center;
            margin-top: 18px;
            padding-top: 8px;
            border-top: 1px solid #d1d5db;
            color: #6b7280;
            font-size: 8px;
          }
          @media print {
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <div class="report-card">
          <div class="school-header">
            <div class="school-name">CEM Total Child School</div>
            <div class="school-subtitle">School Management Portal</div>
            <div class="report-title">STUDENT REPORT CARD</div>
          </div>
          <div class="student-info">
            <div class="info-item">
              <span class="info-label">Student Name</span>
              <span class="info-value">
                ${esc(`${student?.first_name || ''} ${student?.last_name || ''}`.trim())}
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">Admission Number</span>
              <span class="info-value">
                ${esc(student?.admission_number || '-')}
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">Class</span>
              <span class="info-value">
                ${esc(result.class?.name || '-')}
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">Academic Session</span>
              <span class="info-value">
                ${esc(result.session?.name || '-')}
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">Term</span>
              <span class="info-value">
                ${esc(termName)}
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">Status</span>
              <span class="info-value">
                ${esc(result.status)}
              </span>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>1st Test<br>/20</th>
                <th>2nd Test<br>/20</th>
                <th>3rd Test<br>/20</th>
                <th>Exam<br>/40</th>
                <th>Total<br>/100</th>
                <th>Grade</th>
              </tr>
            </thead>
            <tbody>
              ${scoreRows}
            </tbody>
          </table>
          <div class="summary">
            <div class="summary-item">
              <span class="summary-label">Term Average</span>
              <span class="summary-value">
                ${esc(result.term_average ?? '-')}%
              </span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Position</span>
              <span class="summary-value">
                ${esc(result.term_position ?? '-')}
              </span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Attendance</span>
              <span class="summary-value">
                ${esc(result.attendance_present)}/${esc(result.attendance_days)}
              </span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Cumulative Average</span>
              <span class="summary-value">
                ${esc(result.cumulative_average ?? '-')}%
              </span>
            </div>
          </div>
          <div class="signatures">
            <div class="signature">Class Teacher</div>
            <div class="signature">Head Teacher / Principal</div>
            <div class="signature">Parent / Guardian</div>
          </div>
          <div class="footer">
            CEM Total Child School &bull; Student Academic Report
          </div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  };
  const columns = [
    {
      key: 'student',
      header: 'Student',
      render: (result: Result) =>
        `${result.student?.first_name || ''} ${result.student?.last_name || ''}`,
    },
    {
      key: 'class',
      header: 'Class',
      render: (result: Result) => result.class?.name || '-',
    },
    {
      key: 'term',
      header: 'Term',
      render: (result: Result) => {
        const termNames: Record<string, string> = {
          first: 'First',
          second: 'Second',
          third: 'Third',
        };
        return (
          termNames[result.term?.name || '-'] ||
          result.term?.name ||
          '-'
        );
      },
    },
    {
      key: 'average',
      header: 'Average',
      render: (result: Result) =>
        result.term_average ? `${result.term_average}%` : '-',
    },
    {
      key: 'position',
      header: 'Position',
      render: (result: Result) => result.term_position ?? '-',
    },
    {
      key: 'status',
      header: 'Status',
      render: (result: Result) => (
        <StatusBadge status={result.status} />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (result: Result) => (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openResultDetail(result)}
          >
            View
          </Button>
          {isAdmin && result.status === 'generated' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleReview(result)}
            >
              Review
            </Button>
          )}
          {isAdmin && result.status === 'reviewed' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => handlePublish(result)}
            >
              Publish
            </Button>
          )}
          {isAdmin &&
            result.status !== 'published' &&
            result.status !== 'archived' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => openRegenerateModal(result)}
              >
                Regenerate
              </Button>
            )}
        </div>
      ),
    },
  ];
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Results</h1>
          <p className="page-description">
            {isParent
              ? "View your children's results"
              : 'Generate, review, and publish results'}
          </p>
        </div>
        {isAdmin && (
          <div className="page-actions">
            <Button
              variant="outline"
              onClick={() => setShowBulkGenerateModal(true)}
            >
              Bulk Generate
            </Button>
            <Button
              variant="primary"
              onClick={() => setShowGenerateModal(true)}
            >
              Generate Result
            </Button>
          </div>
        )}
      </div>
      <Card>
        <Table
          columns={columns}
          data={results}
          loading={loading}
          emptyMessage={
            isParent ? 'No published results yet' : 'No results found'
          }
        />
      </Card>
      <Modal
        open={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        title="Generate Individual Result"
      >
        <div className="grid gap-4">
          <div className="form-group">
            <label className="form-label">Class</label>
            <select
              className="form-select"
              value={formData.class_id}
              onChange={(e) => {
                setFormData({
                  ...formData,
                  class_id: e.target.value,
                });
                fetchStudentsForClass(e.target.value);
              }}
            >
              <option value="">Select class...</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Student</label>
            <select
              className="form-select"
              value={formData.student_id}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  student_id: e.target.value,
                })
              }
            >
              <option value="">Select student...</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.first_name} {student.last_name} (
                  {student.admission_number})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Session</label>
            <select
              className="form-select"
              value={formData.session_id}
              onChange={(e) => {
                const sessionId = e.target.value;
                setFormData({
                  ...formData,
                  session_id: sessionId,
                });
                const session = sessions.find(
                  (s) => s.id === sessionId
                );
                setTerms(session?.terms || []);
              }}
            >
              <option value="">Select session...</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Term</label>
            <select
              className="form-select"
              value={formData.term_id}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  term_id: e.target.value,
                })
              }
            >
              <option value="">Select term...</option>
              {terms.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.name.charAt(0).toUpperCase() +
                    term.name.slice(1)}{' '}
                  Term
                </option>
              ))}
            </select>
          </div>
          <Button
            variant="primary"
            onClick={handleGenerateIndividual}
            loading={submitting}
          >
            Generate Result
          </Button>
        </div>
      </Modal>
      <Modal
        open={showBulkGenerateModal}
        onClose={() => setShowBulkGenerateModal(false)}
        title="Bulk Generate Class Results"
      >
        <div className="grid gap-4">
          <div className="form-group">
            <label className="form-label">Class</label>
            <select
              className="form-select"
              value={formData.class_id}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  class_id: e.target.value,
                })
              }
            >
              <option value="">Select class...</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Session</label>
            <select
              className="form-select"
              value={formData.session_id}
              onChange={(e) => {
                const sessionId = e.target.value;
                setFormData({
                  ...formData,
                  session_id: sessionId,
                });
                const session = sessions.find(
                  (s) => s.id === sessionId
                );
                setTerms(session?.terms || []);
              }}
            >
              <option value="">Select session...</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Term</label>
            <select
              className="form-select"
              value={formData.term_id}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  term_id: e.target.value,
                })
              }
            >
              <option value="">Select term...</option>
              {terms.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.name.charAt(0).toUpperCase() +
                    term.name.slice(1)}{' '}
                  Term
                </option>
              ))}
            </select>
          </div>
          <Button
            variant="primary"
            onClick={handleBulkGenerate}
            loading={submitting}
          >
            Generate Class Results
          </Button>
        </div>
      </Modal>
      <Modal
        open={showRegenerateModal}
        onClose={() => {
          if (!submitting) {
            setShowRegenerateModal(false);
            setRegenerateReason('');
          }
        }}
        title="Regenerate Result"
      >
        <div className="grid gap-4">
          <p className="text-sm text-gray-600">
            Regenerating this result recalculates it from the current
            scores, attendance, grading rules, and academic data.
          </p>
          <div className="form-group">
            <label className="form-label">Reason</label>
            <textarea
              className="form-input min-h-[120px]"
              value={regenerateReason}
              onChange={(e) => setRegenerateReason(e.target.value)}
              placeholder="Enter the reason for regenerating this result..."
            />
          </div>
          <Button
            variant="primary"
            onClick={handleRegenerate}
            loading={submitting}
          >
            Regenerate Result
          </Button>
        </div>
      </Modal>
      <Modal
        open={showResultDetail}
        onClose={() => setShowResultDetail(false)}
        title="Result Details"
        size="lg"
      >
        {selectedResult && (
          <>
            <div className="flex justify-end gap-2 mb-4">
              <Button
                variant="outline"
                onClick={() => printReportCard(selectedResult)}
              >
                Print Report Card
              </Button>
            </div>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Student</p>
                  <p className="font-semibold">
                    {selectedResult.student?.first_name}{' '}
                    {selectedResult.student?.last_name}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Class</p>
                  <p className="font-semibold">
                    {selectedResult.class?.name}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Term</p>
                  <p className="font-semibold">
                    {selectedResult.term?.name
                      ? `${selectedResult.term.name.charAt(0).toUpperCase()}${selectedResult.term.name.slice(1)} Term`
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Term Average</p>
                  <p className="font-semibold text-2xl text-primary-600">
                    {selectedResult.term_average}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Position</p>
                  <p className="font-semibold text-2xl text-primary-600">
                    {selectedResult.term_position || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <StatusBadge status={selectedResult.status} />
                </div>
                {isAdmin && selectedResult.status === 'generated' && (
                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      onClick={() => handleReview(selectedResult)}
                    >
                      Review Result
                    </Button>
                  </div>
                )}
                {isAdmin && selectedResult.status === 'reviewed' && (
                  <div className="flex items-end">
                    <Button
                      variant="primary"
                      onClick={() => handlePublish(selectedResult)}
                    >
                      Publish Result
                    </Button>
                  </div>
                )}
                {selectedResult.cumulative_average !== null &&
                  selectedResult.cumulative_average !== undefined && (
                    <div>
                      <p className="text-sm text-gray-500">
                        Cumulative Average
                      </p>
                      <p className="font-semibold">
                        {selectedResult.cumulative_average}%
                      </p>
                    </div>
                  )}
                <div>
                  <p className="text-sm text-gray-500">Attendance</p>
                  <p className="font-semibold">
                    {selectedResult.attendance_present}/
                    {selectedResult.attendance_days} days
                  </p>
                </div>
              </div>
              {selectedResult.scores &&
                selectedResult.scores.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-semibold mb-2">
                      Subject Scores
                    </h4>
                    <div className="table-container">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Subject</th>
                            <th>Test 1</th>
                            <th>Test 2</th>
                            <th>Test 3</th>
                            <th>Exam</th>
                            <th>Total</th>
                            <th>Grade</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedResult.scores.map(
                            (score: any, i: number) => (
                              <tr key={i}>
                                <td className="font-medium">
                                  {score.subject?.name}
                                </td>
                                <td>{score.test1 ?? '-'}</td>
                                <td>{score.test2 ?? '-'}</td>
                                <td>{score.test3 ?? '-'}</td>
                                <td>{score.examination ?? '-'}</td>
                                <td className="font-semibold">
                                  {score.total}
                                </td>
                                <td>
                                  <span className="badge badge-info">
                                    {score.grade}
                                  </span>
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
