import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/ui/Toast';
import { Class } from '../types';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Card from '../components/ui/Card';
import { StatusBadge } from '../components/ui/Badge';

export default function ClassesPage() {
  const { call } = useApi();
  const { showToast } = useToast();

  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    const result = await call('/classes');
    if (result.success && result.data) {
      setClasses(result.data);
    }
    setLoading(false);
  }, [call]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      showToast('error', 'Class name is required');
      return;
    }

    setSubmitting(true);
    const result = await call('/classes', {
      method: 'POST',
      body: formData,
    });

    if (result.success) {
      showToast('success', 'Class created successfully');
      setShowCreateModal(false);
      resetForm();
      fetchClasses();
    } else {
      showToast('error', result.error || 'Failed to create class');
    }
    setSubmitting(false);
  };

  const resetForm = () => {
    setFormData({ name: '', description: '' });
  };

  const columns = [
    {
      key: 'name',
      header: 'Class Name',
      render: (cls: Class) => (
        <span className="font-semibold">{cls.name}</span>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (cls: Class) => cls.description || '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (cls: Class) => (
        <StatusBadge status={cls.is_active ? 'active' : 'inactive'} />
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Classes</h1>
          <p className="page-description">Manage classes and rosters</p>
        </div>
        <div className="page-actions">
          <Button variant="primary" onClick={() => { resetForm(); setShowCreateModal(true); }}>
            Add Class
          </Button>
        </div>
      </div>

      <Card>
        <Table
          columns={columns}
          data={classes}
          loading={loading}
          emptyMessage="No classes found"
        />
      </Card>

      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Class"
      >
        <div className="grid gap-4">
          <div className="form-group">
            <label className="form-label">Class Name</label>
            <input
              className="form-input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., JSS 1A"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-textarea"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional class description"
            />
          </div>
          <Button variant="primary" onClick={handleCreate} loading={submitting}>
            Create Class
          </Button>
        </div>
      </Modal>
    </div>
  );
}