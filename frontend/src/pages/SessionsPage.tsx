import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/ui/Toast';
import { AcademicSession, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Card from '../components/ui/Card';
import { StatusBadge } from '../components/ui/Badge';

interface SessionWithTerms extends AcademicSession {
  terms?: Array<{
    id: string;
    name: string;
    start_date: string;
    end_date: string;
    is_current: boolean;
  }>;
}

export default function SessionsPage() {
  const { call } = useApi();
  const { showToast } = useToast();
  const { user } = useAuth();

  const [sessions, setSessions] = useState<SessionWithTerms[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [settingCurrentId, setSettingCurrentId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    start_date: '',
    end_date: '',
  });

  const isSuperAdmin =
    user?.roles?.includes('super_admin') || user?.role === 'super_admin';

  const fetchSessions = useCallback(async () => {
    setLoading(true);

    const result = await call('/sessions');

    if (result.success && result.data) {
      setSessions(result.data);
    } else {
      showToast('error', result.error || 'Failed to fetch sessions');
    }

    setLoading(false);
  }, [call, showToast]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const resetForm = () => {
    setFormData({
      name: '',
      start_date: '',
      end_date: '',
    });
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      showToast('error', 'Session name is required');
      return;
    }

    if (!formData.start_date) {
      showToast('error', 'Start date is required');
      return;
    }

    if (!formData.end_date) {
      showToast('error', 'End date is required');
      return;
    }

    if (formData.end_date <= formData.start_date) {
      showToast('error', 'End date must be after the start date');
      return;
    }

    setSubmitting(true);

    const result = await call('/sessions', {
      method: 'POST',
      body: formData,
    });

    if (result.success) {
      showToast(
        'success',
        'Session created successfully. First, Second and Third Terms were created automatically.'
      );

      setShowCreateModal(false);
      resetForm();
      await fetchSessions();
    } else {
      showToast('error', result.error || 'Failed to create session');
    }

    setSubmitting(false);
  };

  const handleSetCurrent = async (session: SessionWithTerms) => {
    if (session.is_current) {
      return;
    }

    const confirmed = window.confirm(
      `Set "${session.name}" as the current academic session?`
    );

    if (!confirmed) {
      return;
    }

    setSettingCurrentId(session.id);

    const result = await call(`/sessions/${session.id}/set-current`, {
      method: 'POST',
    });

    if (result.success) {
      showToast('success', `${session.name} is now the current session`);
      await fetchSessions();
    } else {
      showToast(
        'error',
        result.error || 'Failed to set current session'
      );
    }

    setSettingCurrentId(null);
  };

  const formatDate = (date: string) => {
    if (!date) return '—';

    return new Date(`${date}T00:00:00`).toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getTermCount = (session: SessionWithTerms) => {
    return session.terms?.length || 0;
  };

  const columns = [
    {
      key: 'name',
      header: 'Academic Session',
      render: (session: SessionWithTerms) => (
        <div>
          <span className="font-semibold">{session.name}</span>

          {session.is_current && (
            <div className="mt-1">
              <StatusBadge status="active" />
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'start_date',
      header: 'Start Date',
      render: (session: SessionWithTerms) =>
        formatDate(session.start_date),
    },
    {
      key: 'end_date',
      header: 'End Date',
      render: (session: SessionWithTerms) =>
        formatDate(session.end_date),
    },
    {
      key: 'terms',
      header: 'Terms',
      render: (session: SessionWithTerms) => (
        <span>
          {getTermCount(session) === 3
            ? '3 Terms'
            : `${getTermCount(session)} Terms`}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (session: SessionWithTerms) => (
        <StatusBadge
          status={session.is_current ? 'active' : 'inactive'}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (session: SessionWithTerms) => (
        <div className="flex items-center gap-2">
          {isSuperAdmin && !session.is_current && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleSetCurrent(session)}
              loading={settingCurrentId === session.id}
            >
              Set Current
            </Button>
          )}

          {session.is_current && (
            <span className="text-sm font-medium text-green-600">
              Current
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Academic Sessions</h1>
          <p className="page-description">
            Manage academic sessions and their terms
          </p>
        </div>

        {isSuperAdmin && (
          <div className="page-actions">
            <Button
              variant="primary"
              onClick={() => {
                resetForm();
                setShowCreateModal(true);
              }}
            >
              Add Session
            </Button>
          </div>
        )}
      </div>

      <Card>
        <Table
          columns={columns}
          data={sessions}
          loading={loading}
          emptyMessage="No academic sessions found"
        />
      </Card>

      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Academic Session"
      >
        <div className="grid gap-4">
          <div className="form-group">
            <label className="form-label">
              Session Name
            </label>

            <input
              className="form-input"
              value={formData.name}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  name: e.target.value,
                })
              }
              placeholder="e.g., 2026/2027"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Start Date
            </label>

            <input
              type="date"
              className="form-input"
              value={formData.start_date}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  start_date: e.target.value,
                })
              }
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              End Date
            </label>

            <input
              type="date"
              className="form-input"
              value={formData.end_date}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  end_date: e.target.value,
                })
              }
            />
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-800">
              Automatic Terms
            </p>

            <p className="mt-1 text-sm text-blue-700">
              Creating this session will automatically create:
            </p>

            <ul className="mt-2 list-disc pl-5 text-sm text-blue-700">
              <li>First Term</li>
              <li>Second Term</li>
              <li>Third Term</li>
            </ul>
          </div>

          <Button
            variant="primary"
            onClick={handleCreate}
            loading={submitting}
          >
            Create Session
          </Button>
        </div>
      </Modal>
    </div>
  );
}