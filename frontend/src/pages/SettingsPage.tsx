import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/ui/Toast';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { LoadingContainer } from '../components/ui/Spinner';

export default function SettingsPage() {
  const { call } = useApi();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schoolSettings, setSchoolSettings] = useState({
    school_name: 'CEM Total Child School',
    school_logo: '',
    school_address: '',
    school_phone: '',
    school_email: '',
  });
  const [sessions, setSessions] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [gradingRules, setGradingRules] = useState<any[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState('');
  const [currentTermId, setCurrentTermId] = useState('');
  const [assessmentStage, setAssessmentStage] = useState('');
  const [gradingModalOpen, setGradingModalOpen] = useState(false);
  const [editingGrade, setEditingGrade] = useState<any>(null);
  const [gradingForm, setGradingForm] = useState({ grade: '', min_score: '', max_score: '', remarks: '' });

  const fetchSettings = useCallback(async () => {
    setLoading(true);

    const settingsResult = await call('/settings');
    if (settingsResult.success && settingsResult.data) {
      setSchoolSettings({
        school_name: settingsResult.data.school_name || 'CEM Total Child School',
        school_logo: settingsResult.data.school_logo || '',
        school_address: settingsResult.data.school_address || '',
        school_phone: settingsResult.data.school_phone || '',
        school_email: settingsResult.data.school_email || '',
      });
    }

    const sessionsResult = await call('/sessions');
    if (sessionsResult.success) {
      const sessionList = Array.isArray(sessionsResult.data)
        ? sessionsResult.data
        : Array.isArray((sessionsResult.data as any)?.data)
          ? (sessionsResult.data as any).data
          : [];
      setSessions(sessionList);
      const current = sessionList.find((s: any) => s.is_current);
      if (current) {
        setCurrentSessionId(current.id);
        setTerms(current.terms || []);
        const currentTerm = (current.terms || []).find((t: any) => t.is_current);
        if (currentTerm) {
          setCurrentTermId(currentTerm.id);
          setAssessmentStage(currentTerm.assessment_stage || 'classes');
        }
      }
    }

    const gradingResult = await call('/settings/grading-rules');
    if (gradingResult.success && gradingResult.data) {
      setGradingRules(gradingResult.data);
    }

    setLoading(false);
  }, [call]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSaveSchoolSettings = async () => {
    setSaving(true);
    const result = await call('/settings', {
      method: 'PUT',
      body: schoolSettings,
    });

    if (result.success) {
      showToast('success', 'School settings saved successfully');
    } else {
      showToast('error', result.error || 'Failed to save settings');
    }
    setSaving(false);
  };

  const handleSetCurrentSession = async () => {
    if (!currentSessionId) {
      showToast('error', 'Please select a session');
      return;
    }

    const result = await call('/settings/set-current-session', {
      method: 'POST',
      body: { session_id: currentSessionId },
    });

    if (result.success) {
      showToast('success', 'Current session updated');
      fetchSettings();
    } else {
      showToast('error', result.error || 'Failed to update session');
    }
  };

  const handleSetCurrentTerm = async () => {
    if (!currentTermId) {
      showToast('error', 'Please select a term');
      return;
    }
    const result = await call('/settings/set-current-term', {
      method: 'POST',
      body: { term_id: currentTermId },
    });
    if (result.success) {
      showToast('success', 'Current term updated');
      await fetchSettings();
    } else {
      showToast('error', result.error || 'Failed to update term');
    }
  };
  const handleSetAssessmentStage = async () => {
    if (!currentTermId || !assessmentStage) {
      showToast('error', 'Please select a term and stage');
      return;
    }

    const result = await call('/settings/set-assessment-stage', {
      method: 'POST',
      body: { term_id: currentTermId, stage: assessmentStage },
    });

    if (result.success) {
      showToast('success', 'Assessment stage updated');
      fetchSettings();
    } else {
      showToast('error', result.error || 'Failed to update stage');
    }
  };

  const openGradingModal = (rule: any = null) => {
    setEditingGrade(rule);
    setGradingForm({
      grade: rule?.grade || '',
      min_score: rule ? String(rule.min_score) : '',
      max_score: rule ? String(rule.max_score) : '',
      remarks: rule?.remarks || '',
    });
    setGradingModalOpen(true);
  };

  const saveGradingRule = async () => {
    const min = Number(gradingForm.min_score);
    const max = Number(gradingForm.max_score);
    if (!gradingForm.grade || Number.isNaN(min) || Number.isNaN(max) || min < 0 || max > 100 || min > max) {
      showToast('error', 'Enter a valid grade and score range from 0 to 100');
      return;
    }
    const result = await call(editingGrade ? '/settings/grading-rules/' + editingGrade.id : '/settings/grading-rules', {
      method: editingGrade ? 'PUT' : 'POST',
      body: { ...gradingForm, min_score: min, max_score: max },
    });
    if (result.success) {
      showToast('success', editingGrade ? 'Grading rule updated' : 'Grading rule created');
      setGradingModalOpen(false);
      const refreshed = await call('/settings/grading-rules');
      if (refreshed.success && Array.isArray(refreshed.data)) setGradingRules(refreshed.data);
    } else {
      showToast('error', result.error || 'Failed to save grading rule');
    }
  };

  const deleteGradingRule = async (id: string) => {
    const result = await call('/settings/grading-rules/' + id, { method: 'DELETE' });
    if (result.success) {
      showToast('success', 'Grading rule deleted');
      setGradingRules((rules) => rules.filter((rule) => rule.id !== id));
    } else {
      showToast('error', result.error || 'Failed to delete grading rule');
    }
  };

  const stageLabels: Record<string, string> = {
    classes: 'Classes',
    first_test: 'First Test',
    second_test: 'Second Test',
    third_test: 'Third Test',
    examination: 'Examination',
  };

  if (loading) {
    return <LoadingContainer text="Loading settings..." />;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-description">Configure school information and academic structure</p>
        </div>
      </div>

      <div className="grid gap-4 max-w-3xl">
        <Card title="School Information">
          <div className="grid gap-4">
            <div className="form-group">
              <label className="form-label">School Name</label>
              <input
                className="form-input"
                value={schoolSettings.school_name}
                onChange={(e) => setSchoolSettings({ ...schoolSettings, school_name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">School Logo URL</label>
              <input
                className="form-input"
                value={schoolSettings.school_logo}
                onChange={(e) => setSchoolSettings({ ...schoolSettings, school_logo: e.target.value })}
                placeholder="https://example.com/logo.png"
              />
              <p className="form-hint">URL of the school logo image.</p>
            </div>
            <div className="form-group">
              <label className="form-label">Address</label>
              <textarea
                className="form-textarea"
                rows={2}
                value={schoolSettings.school_address}
                onChange={(e) => setSchoolSettings({ ...schoolSettings, school_address: e.target.value })}
                placeholder="School address"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input
                  className="form-input"
                  value={schoolSettings.school_phone}
                  onChange={(e) => setSchoolSettings({ ...schoolSettings, school_phone: e.target.value })}
                  placeholder="Phone number"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={schoolSettings.school_email}
                  onChange={(e) => setSchoolSettings({ ...schoolSettings, school_email: e.target.value })}
                  placeholder="school@example.com"
                />
              </div>
            </div>
            <Button variant="primary" onClick={handleSaveSchoolSettings} loading={saving}>
              Save School Information
            </Button>
          </div>
        </Card>

        <Card title="Academic Structure">
          <div className="grid gap-4">
            <div className="form-group">
              <label className="form-label">Current Session</label>
              <div className="flex gap-2">
                <select
                  className="form-select"
                  value={currentSessionId}
                  onChange={(e) => {
                    const selectedSessionId = e.target.value;
                    setCurrentSessionId(selectedSessionId);
                    const selectedSession = sessions.find(
                      (session) => session.id === selectedSessionId
                    );
                    const selectedTerms = selectedSession?.terms || [];
                    setTerms(selectedTerms);
                    const selectedCurrentTerm =
                      selectedTerms.find((term: any) => term.is_current) ||
                      selectedTerms[0];
                    if (selectedCurrentTerm) {
                      setCurrentTermId(selectedCurrentTerm.id);
                      setAssessmentStage(
                        selectedCurrentTerm.assessment_stage || 'classes'
                      );
                    } else {
                      setCurrentTermId('');
                      setAssessmentStage('classes');
                    }
                  }}
                >
                  <option value="">Select session...</option>
                  {sessions.map((session) => (
                    <option key={session.id} value={session.id}>{session.name}</option>
                  ))}
                </select>
                <Button variant="outline" onClick={handleSetCurrentSession}>
                  Set Current
                </Button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Current Term</label>
              <div className="flex gap-2">
                <select
                  className="form-select"
                  value={currentTermId}
                  onChange={(e) => {
                    const selectedTermId = e.target.value;
                    setCurrentTermId(selectedTermId);
                    const selectedTerm = terms.find(
                      (term) => term.id === selectedTermId
                    );
                    if (selectedTerm) {
                      setAssessmentStage(
                        selectedTerm.assessment_stage || 'classes'
                      );
                    }
                  }}
                >
                  <option value="">Select term...</option>
                  {terms.map((term) => (
                    <option key={term.id} value={term.id}>
                      {term.name.charAt(0).toUpperCase() + term.name.slice(1)} Term
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  onClick={handleSetCurrentTerm}
                >
                  Set Current
                </Button>
              </div>
              <p className="form-hint">
                Select the active term for the current academic session.
              </p>
            </div>
            <div className="form-group">
              <label className="form-label">Assessment Stage</label>
              <div className="flex gap-2">
                <select
                  className="form-select"
                  value={assessmentStage}
                  onChange={(e) => setAssessmentStage(e.target.value)}
                >
                  {Object.entries(stageLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <Button variant="outline" onClick={handleSetAssessmentStage}>
                  Update Stage
                </Button>
              </div>
              <p className="form-hint">Controls what teachers can see and edit.</p>
            </div>
          </div>
        </Card>

        <Card title="Grading Rules">
  <div className="flex justify-end mb-4">
    <Button variant="primary" onClick={() => openGradingModal()}>
      Add Grade
    </Button>
  </div>

  <div className="table-container">
    <table className="table">
      <thead>
        <tr>
          <th>Grade</th>
          <th>Min Score</th>
          <th>Max Score</th>
          <th>Remarks</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {gradingRules.length === 0 ? (
          <tr>
            <td colSpan={5} className="text-center text-gray-500 py-4">
              No grading rules configured
            </td>
          </tr>
        ) : (
          gradingRules.map((rule) => (
            <tr key={rule.id}>
              <td className="font-bold">{rule.grade}</td>
              <td>{rule.min_score}%</td>
              <td>{rule.max_score}%</td>
              <td>{rule.remarks || '—'}</td>
              <td>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => openGradingModal(rule)}>
                    Edit
                  </Button>
                  <Button variant="danger" onClick={() => deleteGradingRule(rule.id)}>
                    Delete
                  </Button>
                </div>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
</Card>

{gradingModalOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
      <h2 className="text-lg font-semibold mb-4">
        {editingGrade ? 'Edit Grading Rule' : 'Add Grading Rule'}
      </h2>

      <div className="grid gap-4">
        <div className="form-group">
          <label className="form-label">Grade</label>
          <input
            className="form-input"
            value={gradingForm.grade}
            onChange={(e) => setGradingForm({ ...gradingForm, grade: e.target.value.toUpperCase() })}
            placeholder="A"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="form-group">
            <label className="form-label">Minimum Score</label>
            <input
              type="number"
              min="0"
              max="100"
              className="form-input"
              value={gradingForm.min_score}
              onChange={(e) => setGradingForm({ ...gradingForm, min_score: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Maximum Score</label>
            <input
              type="number"
              min="0"
              max="100"
              className="form-input"
              value={gradingForm.max_score}
              onChange={(e) => setGradingForm({ ...gradingForm, max_score: e.target.value })}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Remarks</label>
          <input
            className="form-input"
            value={gradingForm.remarks}
            onChange={(e) => setGradingForm({ ...gradingForm, remarks: e.target.value })}
            placeholder="Excellent"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setGradingModalOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={saveGradingRule}>
            Save Grade
          </Button>
        </div>
      </div>
    </div>
  </div>
)}
      </div>
    </div>
  );
}











