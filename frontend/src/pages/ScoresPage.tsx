import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/ui/Toast';
import { Score } from '../types';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Card from '../components/ui/Card';
type AssessmentStage =
  | 'classes'
  | 'first_test'
  | 'second_test'
  | 'third_test'
  | 'examination';
const stageLabels: Record<AssessmentStage, string> = {
  classes: 'Classes',
  first_test: '1st Test',
  second_test: '2nd Test',
  third_test: '3rd Test',
  examination: 'Examination',
};
export default function ScoresPage() {
  const { call } = useApi();
  const { showToast } = useToast();
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(false);
  const [assessmentStage, setAssessmentStage] =
    useState<AssessmentStage>('classes');
  const [termId, setTermId] = useState('');
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
    setTermId(termResult.data.id);
    setAssessmentStage(
      termResult.data.assessment_stage || 'classes',
    );
    setLoading(true);
    const result = await call(
      `/scores/class/${selectedClass}/${selectedSubject}/${termResult.data.id}`,
    );
    if (result.success && result.data) {
      setScores(result.data);
    } else {
      setScores([]);
    }
    setLoading(false);
  }, [
    call,
    selectedClass,
    selectedSubject,
    showToast,
  ]);
  useEffect(() => {
    if (selectedClass && selectedSubject) {
      fetchScores();
    }
  }, [selectedClass, selectedSubject, fetchScores]);
  const openEditModal = (score: Score) => {
    if (assessmentStage === 'classes') {
      showToast(
        'error',
        'Score entry is locked during the Classes stage',
      );
      return;
    }
    setSelectedScore(score);
    setScoreForm({
      test1: String(score.test1 ?? ''),
      test2: String(score.test2 ?? ''),
      test3: String(score.test3 ?? ''),
      examination: String(score.examination ?? ''),
    });
    setEditModalOpen(true);
  };
  const handleSaveScore = async () => {
    if (!selectedScore || !termId) return;
    setSaving(true);
    const body: Record<string, number> = {};
    if (
      assessmentStage === 'first_test' ||
      assessmentStage === 'second_test' ||
      assessmentStage === 'third_test' ||
      assessmentStage === 'examination'
    ) {
      if (scoreForm.test1 !== '') {
        body.test1 = Number(scoreForm.test1);
      }
    }
    if (
      assessmentStage === 'second_test' ||
      assessmentStage === 'third_test' ||
      assessmentStage === 'examination'
    ) {
      if (scoreForm.test2 !== '') {
        body.test2 = Number(scoreForm.test2);
      }
    }
    if (
      assessmentStage === 'third_test' ||
      assessmentStage === 'examination'
    ) {
      if (scoreForm.test3 !== '') {
        body.test3 = Number(scoreForm.test3);
      }
    }
    if (assessmentStage === 'examination') {
      if (scoreForm.examination !== '') {
        body.examination = Number(scoreForm.examination);
      }
    }
    const result = await call(`/scores/${selectedScore.id}`, {
      method: 'PUT',
      body,
    });
    if (result.success) {
      showToast('success', 'Score updated successfully');
      setEditModalOpen(false);
      await fetchScores();
    } else {
      showToast(
        'error',
        result.error || 'Failed to update score',
      );
    }
    setSaving(false);
  };
  const canEdit = assessmentStage !== 'classes';
  const columns = [
    {
      key: 'student',
      header: 'Student',
      render: (score: Score) => (
        <div>
          <div className="font-semibold">
            {score.student?.first_name} {score.student?.last_name}
          </div>
          <div className="text-xs text-gray-500">
            {score.student?.admission_number}
          </div>
        </div>
      ),
    },
    {
      key: 'test1',
      header: 'Test 1 (20)',
      render: (score: Score) => (
        <span className="font-medium">
          {score.test1 ?? '-'}
        </span>
      ),
    },
    {
      key: 'test2',
      header: 'Test 2 (20)',
      render: (score: Score) => (
        <span className="font-medium">
          {score.test2 ?? '-'}
        </span>
      ),
    },
    {
      key: 'test3',
      header: 'Test 3 (20)',
      render: (score: Score) => (
        <span className="font-medium">
          {score.test3 ?? '-'}
        </span>
      ),
    },
    {
      key: 'examination',
      header: 'Exam (40)',
      render: (score: Score) => (
        <span className="font-medium">
          {score.examination ?? '-'}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Total (100)',
      render: (score: Score) => (
        <span className="font-bold text-primary-600">
          {score.total}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (score: Score) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => openEditModal(score)}
          disabled={!canEdit}
        >
          {canEdit ? 'Edit Score' : 'Locked'}
        </Button>
      ),
    },
  ];
  const fieldEnabled = {
    test1:
      assessmentStage === 'first_test' ||
      assessmentStage === 'second_test' ||
      assessmentStage === 'third_test' ||
      assessmentStage === 'examination',
    test2:
      assessmentStage === 'second_test' ||
      assessmentStage === 'third_test' ||
      assessmentStage === 'examination',
    test3:
      assessmentStage === 'third_test' ||
      assessmentStage === 'examination',
    examination:
      assessmentStage === 'examination',
  };
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Score Entry</h1>
          <p className="page-description">
            Enter and edit student scores
          </p>
        </div>
      </div>
      <div className="grid gap-4">
        <Card>
          <div className="mb-4 rounded-lg border border-primary-200 bg-primary-50 p-3">
            <div className="text-sm text-gray-600">
              Current Assessment Stage
            </div>
            <div className="font-semibold text-primary-700">
              {stageLabels[assessmentStage]}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Class</label>
              <select
                className="form-select"
                value={selectedClass}
                onChange={(e) =>
                  setSelectedClass(e.target.value)
                }
              >
                <option value="">Select class...</option>
                {classes.map((item: any) => (
                  <option
                    key={item.class.id}
                    value={item.class.id}
                  >
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
                onChange={(e) =>
                  setSelectedSubject(e.target.value)
                }
              >
                <option value="">Select subject...</option>
                {subjects.map((item: any) => (
                  <option
                    key={item.subject.id}
                    value={item.subject.id}
                  >
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
        title={`Edit Score · ${stageLabels[assessmentStage]}`}
        size="sm"
      >
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">
                Test 1 (0-20)
              </label>
              <input
                type="number"
                min="0"
                max="20"
                disabled={!fieldEnabled.test1}
                className="form-input"
                value={scoreForm.test1}
                onChange={(e) =>
                  setScoreForm({
                    ...scoreForm,
                    test1: e.target.value,
                  })
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                Test 2 (0-20)
              </label>
              <input
                type="number"
                min="0"
                max="20"
                disabled={!fieldEnabled.test2}
                className="form-input"
                value={scoreForm.test2}
                onChange={(e) =>
                  setScoreForm({
                    ...scoreForm,
                    test2: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">
                Test 3 (0-20)
              </label>
              <input
                type="number"
                min="0"
                max="20"
                disabled={!fieldEnabled.test3}
                className="form-input"
                value={scoreForm.test3}
                onChange={(e) =>
                  setScoreForm({
                    ...scoreForm,
                    test3: e.target.value,
                  })
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                Examination (0-40)
              </label>
              <input
                type="number"
                min="0"
                max="40"
                disabled={!fieldEnabled.examination}
                className="form-input"
                value={scoreForm.examination}
                onChange={(e) =>
                  setScoreForm({
                    ...scoreForm,
                    examination: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <Button
            variant="primary"
            onClick={handleSaveScore}
            loading={saving}
          >
            Save Score
          </Button>
        </div>
      </Modal>
    </div>
  );
}
