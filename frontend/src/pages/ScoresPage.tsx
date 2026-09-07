import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import { Score } from '../types';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Card from '../components/ui/Card';

export default function ScoresPage() {
  const { call } = useApi();
  const { showToast } = useToast();
  const { user } = useAuth();

  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedScore, setSelectedScore] = useState<Score | null>(null);
  const [scoreForm, setScoreForm] = useState({
    test1: '',
    test2: '',
    test3: '',
    examination: '',
  });
  const [saving, setSaving] = useState(false);

  const fetchTeacherData = useCallback(async () => {
    const classesResult = await call('/teachers/my/classes');
    if (classesResult.success && classesResult.data) {
      setClasses(classesResult.data);
    }

    const subjectsResult = await call('/teachers/my/assignments');
    if (subjectsResult.success && subjectsResult.data) {
      setSubjects(subjectsResult.data.subjectAssignments || []);
    }
  }, [call]);

  useEffect(() => {
    fetchTeacherData();
  }, [fetchTeacherData]);

  const fetchScores = useCallback(async () => {
    if (!selectedClass || !selectedSubject) return;

    const termResult = await call('/sessions/current-term');
    if (!termResult.success || !termResult.data) {
      showToast('error', 'Could not find current term');
      return;
    }

    setLoading(true);
    const result = await call(`/scores/class/${selectedClass}/${selectedSubject}/${termResult.data.id}`);
    if (result.success && result.data) {
      setScores(result.data);
    }
    setLoading(false);
  }, [call, selectedClass, selectedSubject, showToast]);

  useEffect(() => {
    if (selectedClass && selectedSubject) {
      fetchScores();
    }
  }, [selectedClass, selectedSubject, fetchScores]);

  const openEditModal = (score: Score) => {
    setSelectedScore(score);
    setScoreForm({
      test1: String(score.test1 || ''),
      test2: String(score.test2 || ''),
      test3: String(score.test3 || ''),
      examination: String(score.examination || ''),
    });
    setEditModalOpen(true);
  };

  const handleSaveScore = async () => {
    if (!selectedScore) return;

    setSaving(true);
    const result = await call(`/scores/${selectedScore.id}`, {
      method: 'PUT',
      body: {
        test1: scoreForm.test1 ? Number(scoreForm.test1) : undefined,
        test2: scoreForm.test2 ? Number(scoreForm.test2) : undefined,
        test3: scoreForm.test3 ? Number(scoreForm.test3) : undefined,
        examination: scoreForm.examination ? Number(scoreForm.examination) : undefined,
      },
    });

    if (result.success) {
      showToast('success', 'Score updated successfully');
      setEditModalOpen(false);
      fetchScores();
    } else {
      showToast('error', result.error || 'Failed to update score');
    }
    setSaving(false);
  };

  const columns = [
    {
      key: 'student',
      header: 'Student',
      render: (score: Score) => (
        <div>
          <div className="font-semibold">
            {score.student?.first_name} {score.student?.last_name}
          </div>
          <div className="text-xs text-gray-500">{score.student?.admission_number}</div>
        </div>
      ),
    },
    {
      key: 'test1',
      header: 'Test 1 (20)',
      render: (score: Score) => <span className="font-medium">{score.test1 || '—'}</span>,
    },
    {
      key: 'test2',
      header: 'Test 2 (20)',
      render: (score: Score) => <span className="font-medium">{score.test2 || '—'}</span>,
    },
    {
      key: 'test3',
      header: 'Test 3 (20)',
      render: (score: Score) => <span className="font-medium">{score.test3 || '—'}</span>,
    },
    {
      key: 'examination',
      header: 'Exam (40)',
      render: (score: Score) => <span className="font-medium">{score.examination || '—'}</span>,
    },
    {
      key: 'total',
      header: 'Total (100)',
      render: (score: Score) => (
        <span className="font-bold text-primary-600">{score.total}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (score: Score) => (
        <Button variant="outline" size="sm" onClick={() => openEditModal(score)}>
          Edit Score
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Score Entry</h1>
          <p className="page-description">Enter and edit student scores</p>
        </div>
      </div>

      <div className="grid gap-4">
        <Card>
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Class</label>
              <select
                className="form-select"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
              >
                <option value="">Select class...</option>
                {classes.map((item: any) => (
                  <option key={item.class.id} value={item.class.id}>
                    {item.class.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Subject</label>
              <select
                className="form-select"
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
              >
                <option value="">Select subject...</option>
                {subjects.map((item: any) => (
                  <option key={item.subject.id} value={item.subject.id}>
                    {item.subject.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {selectedClass && selectedSubject && (
          <Card title="Student Scores">
            <Table
              columns={columns}
              data={scores}
              loading={loading}
              emptyMessage="No scores found. Scores will appear as students are enrolled."
            />
          </Card>
        )}
      </div>

      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Score"
        size="sm"
      >
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Test 1 (0-20)</label>
              <input
                type="number"
                min="0"
                max="20"
                className="form-input"
                value={scoreForm.test1}
                onChange={(e) => setScoreForm({ ...scoreForm, test1: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Test 2 (0-20)</label>
              <input
                type="number"
                min="0"
                max="20"
                className="form-input"
                value={scoreForm.test2}
                onChange={(e) => setScoreForm({ ...scoreForm, test2: e.target.value })}
                placeholder="0"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Test 3 (0-20)</label>
              <input
                type="number"
                min="0"
                max="20"
                className="form-input"
                value={scoreForm.test3}
                onChange={(e) => setScoreForm({ ...scoreForm, test3: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Examination (0-40)</label>
              <input
                type="number"
                min="0"
                max="40"
                className="form-input"
                value={scoreForm.examination}
                onChange={(e) => setScoreForm({ ...scoreForm, examination: e.target.value })}
                placeholder="0"
              />
            </div>
          </div>
          <Button variant="primary" onClick={handleSaveScore} loading={saving}>
            Save Score
          </Button>
        </div>
      </Modal>
    </div>
  );
}