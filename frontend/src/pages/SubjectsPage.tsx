import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/ui/Toast';
import { Subject } from '../types';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Card from '../components/ui/Card';
import { StatusBadge } from '../components/ui/Badge';

export default function SubjectsPage() {
  const { call } = useApi();
  const { showToast } = useToast();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
  });

  const fetchSubjects = useCallback(async () => {
    setLoading(true);
    const result = await call('/subjects');
    if (result.success && result.data) {
      setSubjects(result.data);
    }
    setLoading(false);
  }, [call]);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      showToast('error', 'Subject name is required');
      return;
    }

    setSubmitting(true);
    const result = await call('/subjects', {
      method: 'POST',
      body: formData,
    });

    if (result.success) {
      showToast('success', 'Subject created successfully');
      setShowCreateModal(false);
      resetForm();
      fetchSubjects();
    } else {
      showToast('error', result.error || 'Failed to create subject');
    }
    setSubmitting(false);
  };

  const resetForm = () => {
    setFormData({ name: '', code: '', description: '' });
  };

  const columns = [
    {
      key: 'name',
      header: 'Subject Name',
      render: (subject: Subject) => (
        <span className="font-semibold">{subject.name}</span>
      ),
    },
    {
      key: 'code',
      header: 'Code',
      render: (subject: Subject) => subject.code || '—',
    },
    {
      key: 'description',
      header: 'Description',
      render: (subject: Subject) => subject.description || '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (subject: Subject) => (
        <StatusBadge status={subject.is_active ? 'active' : 'inactive'} />
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Subjects</h1>
          <p className="page-description">Manage subjects offered by the school</p>
        </div>
        <div className="page-actions">
          <Button variant="primary" onClick={() => { resetForm(); setShowCreateModal(true); }}>
            Add Subject
          </Button>
        </div>
      </div>

      <Card>
        <Table
          columns={columns}
          data={subjects}
          loading={loading}
          emptyMessage="No subjects found"
        />
      </Card>

      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Subject"
      >
        <div className="grid gap-4">
          <div className="form-group">
            <label className="form-label">Subject Name</label>
            <input
              className="form-input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Mathematics"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">Subject Code</label>
            <input
              className="form-input"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              placeholder="e.g., MTH"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-textarea"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional subject description"
            />
          </div>
          <Button variant="primary" onClick={handleCreate} loading={submitting}>
            Create Subject
          </Button>
        </div>
      </Modal>
    </div>
  );
}