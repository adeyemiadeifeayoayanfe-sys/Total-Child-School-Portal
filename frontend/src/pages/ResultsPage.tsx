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
  const { user } = useAuth();

  const [results, setResults] = useState<Result[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showBulkGenerateModal, setShowBulkGenerateModal] = useState(false);
  const [selectedResult, setSelectedResult] = useState<Result | null>(null);
  const [showResultDetail, setShowResultDetail] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    student_id: '',
    class_id: '',
    session_id: '',
    term_id: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isParent = user?.role === 'parent';

  const fetchResults = useCallback(async () => {
    setLoading(true);
    let endpoint = '/results';

    if (isParent) {
      const childrenResult = await call('/parents/my/children');
      if (childrenResult.success && childrenResult.data) {
        const allResults: Result[] = [];
        for (const child of childrenResult.data) {
          const childResults = await call(`/parents/my/children/${child.student.id}/results`);
          if (childResults.success && childResults.data) {
            allResults.push(...childResults.data);
          }
        }
        setResults(allResults);
      }
    } else {
      const result = await call(endpoint);
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

  const fetchStudentsForClass = async (classId: string) => {
    const sessionResult = await call('/sessions/current');
    if (!sessionResult.success || !sessionResult.data) return;

    const rosterResult = await call(`/classes/${classId}/roster?session_id=${sessionResult.data.id}`);
    if (rosterResult.success && rosterResult.data) {
      setStudents(rosterResult.data.map((enrollment: any) => enrollment.student));
    }
  };

  const handleGenerateIndividual = async () => {
    if (!formData.student_id || !formData.class_id || !formData.session_id || !formData.term_id) {
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
      fetchResults();
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
      fetchResults();
    } else {
      showToast('error', result.error || 'Failed to generate results');
    }
    setSubmitting(false);
  };

  const handlePublish = async (result: Result) => {
    const res = await call(`/results/${result.id}/publish`, { method: 'POST' });
    if (res.success) {
      showToast('success', 'Result published successfully');
      fetchResults();
    } else {
      showToast('error', res.error || 'Failed to publish result');
    }
  };

  const openResultDetail = async (result: Result) => {
    setSelectedResult(result);
    setShowResultDetail(true);
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
      render: (result: Result) => result.class?.name || '—',
    },
    {
      key: 'term',
      header: 'Term',
      render: (result: Result) => {
        const termNames: Record<string, string> = { first: 'First', second: 'Second', third: 'Third' };
        return termNames[result.term?.name || ''] || result.term?.name || '—';
      },
    },
    {
      key: 'average',
      header: 'Average',
      render: (result: Result) => (result.term_average ? `${result.term_average}%` : '—'),
    },
    {
      key: 'position',
      header: 'Position',
      render: (result: Result) => result.term_position || '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (result: Result) => <StatusBadge status={result.status} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (result: Result) => (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => openResultDetail(result)}>
            View
          </Button>
          {isAdmin && (result.status === 'generated' || result.status === 'reviewed') && (
            <Button variant="primary" size="sm" onClick={() => handlePublish(result)}>
              Publish
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
            {isParent ? "View your children's results" : 'Generate, review, and publish results'}
          </p>
        </div>
        {isAdmin && (
          <div className="page-actions">
            <Button variant="outline" onClick={() => setShowBulkGenerateModal(true)}>
              Bulk Generate
            </Button>
            <Button variant="primary" onClick={() => setShowGenerateModal(true)}>
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
          emptyMessage={isParent ? 'No published results yet' : 'No results found'}
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
                setFormData({ ...formData, class_id: e.target.value });
                fetchStudentsForClass(e.target.value);
              }}
            >
              <option value="">Select class...</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Student</label>
            <select
              className="form-select"
              value={formData.student_id}
              onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
            >
              <option value="">Select student...</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.first_name} {student.last_name} ({student.admission_number})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Session</label>
            <select
              className="form-select"
              value={formData.session_id}
              onChange={async (e) => {
                const sessionId = e.target.value;
                setFormData({ ...formData, session_id: sessionId });
                const session = sessions.find((s) => s.id === sessionId);
                if (session) {
                  setTerms(session.terms || []);
                }
              }}
            >
              <option value="">Select session...</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>{session.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Term</label>
            <select
              className="form-select"
              value={formData.term_id}
              onChange={(e) => setFormData({ ...formData, term_id: e.target.value })}
            >
              <option value="">Select term...</option>
              {terms.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.name.charAt(0).toUpperCase() + term.name.slice(1)} Term
                </option>
              ))}
            </select>
          </div>
          <Button variant="primary" onClick={handleGenerateIndividual} loading={submitting}>
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
              onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
            >
              <option value="">Select class...</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
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
                setFormData({ ...formData, session_id: sessionId });
                const session = sessions.find((s) => s.id === sessionId);
                if (session) {
                  setTerms(session.terms || []);
                }
              }}
            >
              <option value="">Select session...</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>{session.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Term</label>
            <select
              className="form-select"
              value={formData.term_id}
              onChange={(e) => setFormData({ ...formData, term_id: e.target.value })}
            >
              <option value="">Select term...</option>
              {terms.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.name.charAt(0).toUpperCase() + term.name.slice(1)} Term
                </option>
              ))}
            </select>
          </div>
          <Button variant="primary" onClick={handleBulkGenerate} loading={submitting}>
            Generate Class Results
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
          <div className="grid gap-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">Student</p>
                <p className="font-semibold">
                  {selectedResult.student?.first_name} {selectedResult.student?.last_name}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Class</p>
                <p className="font-semibold">{selectedResult.class?.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Term</p>
                <p className="font-semibold">
                  {selectedResult.term?.name.charAt(0).toUpperCase() + selectedResult.term?.name.slice(1)} Term
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
                  {selectedResult.term_position || '—'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <StatusBadge status={selectedResult.status} />
              </div>
              {selectedResult.cumulative_average && (
                <div>
                  <p className="text-sm text-gray-500">Cumulative Average</p>
                  <p className="font-semibold">{selectedResult.cumulative_average}%</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500">Attendance</p>
                <p className="font-semibold">
                  {selectedResult.attendance_present}/{selectedResult.attendance_days} days
                </p>
              </div>
            </div>
            {selectedResult.scores && selectedResult.scores.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold mb-2">Subject Scores</h4>
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
                      {selectedResult.scores.map((score: any, i: number) => (
                        <tr key={i}>
                          <td className="font-medium">{score.subject?.name}</td>
                          <td>{score.test1 || '—'}</td>
                          <td>{score.test2 || '—'}</td>
                          <td>{score.test3 || '—'}</td>
                          <td>{score.examination || '—'}</td>
                          <td className="font-semibold">{score.total}</td>
                          <td>
                            <span className="badge badge-info">{score.grade}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}