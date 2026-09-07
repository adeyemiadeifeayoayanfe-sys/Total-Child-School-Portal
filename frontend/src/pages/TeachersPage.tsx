import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/ui/Toast';
import { Teacher } from '../types';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Card from '../components/ui/Card';
import { StatusBadge } from '../components/ui/Badge';
import ConfirmDialog from '../components/ui/ConfirmDialog';

export default function TeachersPage() {
  const { call } = useApi();
  const { showToast } = useToast();

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: '',
    qualification: '',
    specialization: '',
  });

  const fetchTeachers = useCallback(async () => {
    setLoading(true);
    const result = await call('/teachers');
    if (result.success && result.data) {
      setTeachers(result.data);
    }
    setLoading(false);
  }, [call]);

  useEffect(() => {
    fetchTeachers();
  }, [fetchTeachers]);

  const handleCreate = async () => {
    if (!formData.email || !formData.password || !formData.first_name || !formData.last_name) {
      showToast('error', 'Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    const result = await call('/teachers', {
      method: 'POST',
      body: formData,
    });

    if (result.success) {
      showToast('success', 'Teacher account created successfully');
      setShowCreateModal(false);
      resetForm();
      fetchTeachers();
    } else {
      showToast('error', result.error || 'Failed to create teacher');
    }
    setSubmitting(false);
  };

  const handleDeactivate = async () => {
    if (!selectedTeacher) return;

    const result = await call(`/teachers/${selectedTeacher.id}/deactivate`, {
      method: 'POST',
    });

    if (result.success) {
      showToast('success', 'Teacher deactivated successfully');
      setShowDeactivateDialog(false);
      fetchTeachers();
    } else {
      showToast('error', result.error || 'Failed to deactivate teacher');
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      phone: '',
      qualification: '',
      specialization: '',
    });
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (teacher: Teacher) => (
        <span className="font-semibold">
          {teacher.profile?.first_name} {teacher.profile?.last_name}
        </span>
      ),
    },
    {
      key: 'staff_number',
      header: 'Staff No.',
      render: (teacher: Teacher) => teacher.staff_number,
    },
    {
      key: 'email',
      header: 'Email',
      render: (teacher: Teacher) => teacher.user?.email || teacher.user_id,
    },
    {
      key: 'qualification',
      header: 'Qualification',
      render: (teacher: Teacher) => teacher.qualification || '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (teacher: Teacher) => (
        <StatusBadge status={teacher.is_active ? 'active' : 'inactive'} />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (teacher: Teacher) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSelectedTeacher(teacher);
            setShowDeactivateDialog(true);
          }}
          disabled={!teacher.is_active}
        >
          Deactivate
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Teachers</h1>
          <p className="page-description">Manage teacher accounts and assignments</p>
        </div>
        <div className="page-actions">
          <Button variant="primary" onClick={() => { resetForm(); setShowCreateModal(true); }}>
            Add Teacher
          </Button>
        </div>
      </div>

      <Card>
        <Table
          columns={columns}
          data={teachers}
          loading={loading}
          emptyMessage="No teachers found"
        />
      </Card>

      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Teacher Account"
      >
        <div className="grid gap-4">
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="teacher@example.com"
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
            <p className="form-hint">Teacher will be prompted to change on first login.</p>
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
            <label className="form-label">Qualification</label>
            <input
              className="form-input"
              value={formData.qualification}
              onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
              placeholder="e.g., B.Ed, M.Sc"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Specialization</label>
            <input
              className="form-input"
              value={formData.specialization}
              onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
              placeholder="e.g., Mathematics, English"
            />
          </div>
          <Button variant="primary" onClick={handleCreate} loading={submitting}>
            Create Teacher
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={showDeactivateDialog}
        onClose={() => setShowDeactivateDialog(false)}
        onConfirm={handleDeactivate}
        title="Deactivate Teacher"
        message={`Are you sure you want to deactivate ${selectedTeacher?.profile?.first_name} ${selectedTeacher?.profile?.last_name}?`}
        confirmText="Deactivate"
        danger
      />
    </div>
  );
}