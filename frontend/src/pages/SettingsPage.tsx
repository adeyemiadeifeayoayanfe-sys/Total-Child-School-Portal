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
    if (sessionsResult.success && sessionsResult.data) {
      setSessions(sessionsResult.data);
      const current = sessionsResult.data.find((s: any) => s.is_current);
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
                  onChange={(e) => setCurrentSessionId(e.target.value)}
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
              <select className="form-select" value={currentTermId} disabled>
                <option value="">Select term...</option>
                {terms.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.name.charAt(0).toUpperCase() + term.name.slice(1)} Term
                  </option>
                ))}
              </select>
              <p className="form-hint">Term is determined by the current session.</p>
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
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Grade</th>
                  <th>Min Score</th>
                  <th>Max Score</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {gradingRules.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center text-gray-500 py-4">
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}