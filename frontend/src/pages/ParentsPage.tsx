import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/ui/Toast';
import { Parent } from '../types';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Card from '../components/ui/Card';
import { StatusBadge } from '../components/ui/Badge';

export default function ParentsPage() {
  const { call } = useApi();
  const { showToast } = useToast();

  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: '',
    address: '',
    occupation: '',
    relationship_to_student: '',
  });

  const fetchParents = useCallback(async () => {
    setLoading(true);
    const result = await call('/parents');
    if (result.success && result.data) {
      setParents(result.data);
    }
    setLoading(false);
  }, [call]);

  useEffect(() => {
    fetchParents();
  }, [fetchParents]);

  const handleCreate = async () => {
    if (!formData.email || !formData.password || !formData.first_name || !formData.last_name) {
      showToast('error', 'Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    const result = await call('/parents', {
      method: 'POST',
      body: formData,
    });

    if (result.success) {
      showToast('success', 'Parent account created successfully');
      setShowCreateModal(false);
      resetForm();
      fetchParents();
    } else {
      showToast('error', result.error || 'Failed to create parent');
    }
    setSubmitting(false);
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      phone: '',
      address: '',
      occupation: '',
      relationship_to_student: '',
    });
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (parent: Parent) => (
        <span className="font-semibold">
          {parent.profile?.first_name} {parent.profile?.last_name}
        </span>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (parent: Parent) => parent.user?.email || parent.user_id,
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (parent: Parent) => parent.profile?.phone || '—',
    },
    {
      key: 'occupation',
      header: 'Occupation',
      render: (parent: Parent) => parent.occupation || '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (parent: Parent) => (
        <StatusBadge status={parent.is_active ? 'active' : 'inactive'} />
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Parents</h1>
          <p className="page-description">Manage parent accounts and child assignments</p>
        </div>
        <div className="page-actions">
          <Button variant="primary" onClick={() => { resetForm(); setShowCreateModal(true); }}>
            Add Parent
          </Button>
        </div>
      </div>

      <Card>
        <Table
          columns={columns}
          data={parents}
          loading={loading}
          emptyMessage="No parents found"
        />
      </Card>

      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Parent Account"
      >
        <div className="grid gap-4">
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="parent@example.com"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Temporary Password</label>
            <input
              type="password"
              className="form-input"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Min 8 characters"
            />
            <p className="form-hint">Parent will be prompted to change on first login.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">First Name</label>
              <input
                className="form-input"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name</label>
              <input
                className="form-input"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input
              className="form-input"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="Phone number"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Address</label>
            <textarea
              className="form-textarea"
              rows={2}
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Home address"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Occupation</label>
              <input
                className="form-input"
                value={formData.occupation}
                onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                placeholder="e.g., Engineer"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Relationship to Student</label>
              <input
                className="form-input"
                value={formData.relationship_to_student}
                onChange={(e) => setFormData({ ...formData, relationship_to_student: e.target.value })}
                placeholder="e.g., Father, Mother, Guardian"
              />
            </div>
          </div>
          <Button variant="primary" onClick={handleCreate} loading={submitting}>
            Create Parent
          </Button>
        </div>
      </Modal>
    </div>
  );
}