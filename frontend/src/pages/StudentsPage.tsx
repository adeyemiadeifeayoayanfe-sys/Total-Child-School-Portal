import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/ui/Toast';
import { Student } from '../types';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Card from '../components/ui/Card';
import { StatusBadge } from '../components/ui/Badge';
import ConfirmDialog from '../components/ui/ConfirmDialog';

export default function StudentsPage() {
  const { call } = useApi();
  const { showToast } = useToast();

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [formData, setFormData] = useState({
    admission_number: '',
    first_name: '',
    last_name: '',
    middle_name: '',
    date_of_birth: '',
    gender: 'male',
    address: '',
    phone: '',
    email: '',
    admission_date: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    const query = new URLSearchParams({
      page: String(page),
      limit: '50',
      ...(search ? { search } : {}),
    });

    const result = await call(`/students?${query.toString()}`);
    if (result.success) {
  const response = result as any;

  setStudents(response.data || []);
  setTotalPages(response.total_pages || 1);
}
    setLoading(false);
  }, [page, search, call]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const handleCreate = async () => {
    if (!formData.admission_number || !formData.first_name || !formData.last_name || !formData.date_of_birth) {
      showToast('error', 'Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    const result = await call('/students', {
      method: 'POST',
      body: formData,
    });

    if (result.success) {
      showToast('success', 'Student created successfully');
      setShowCreateModal(false);
      resetForm();
      fetchStudents();
    } else {
      showToast('error', result.error || 'Failed to create student');
    }
    setSubmitting(false);
  };

  const handleEdit = async () => {
    if (!selectedStudent) return;

    setSubmitting(true);
    const result = await call(`/students/${selectedStudent.id}`, {
      method: 'PUT',
      body: formData,
    });

    if (result.success) {
      showToast('success', 'Student updated successfully');
      setShowEditModal(false);
      fetchStudents();
    } else {
      showToast('error', result.error || 'Failed to update student');
    }
    setSubmitting(false);
  };

  const handleArchive = async () => {
    if (!selectedStudent) return;

    const result = await call(`/students/${selectedStudent.id}/archive`, {
      method: 'POST',
    });

    if (result.success) {
      showToast('success', 'Student archived successfully');
      setShowArchiveDialog(false);
      fetchStudents();
    } else {
      showToast('error', result.error || 'Failed to archive student');
    }
  };

  const resetForm = () => {
    setFormData({
      admission_number: '',
      first_name: '',
      last_name: '',
      middle_name: '',
      date_of_birth: '',
      gender: 'male',
      address: '',
      phone: '',
      email: '',
      admission_date: '',
    });
  };

  const openEditModal = (student: Student) => {
    setSelectedStudent(student);
    setFormData({
      admission_number: student.admission_number,
      first_name: student.first_name,
      last_name: student.last_name,
      middle_name: student.middle_name || '',
      date_of_birth: student.date_of_birth,
      gender: student.gender,
      address: student.address || '',
      phone: student.phone || '',
      email: student.email || '',
      admission_date: student.admission_date || '',
    });
    setShowEditModal(true);
  };

  const columns = [
    {
      key: 'admission_number',
      header: 'Admission No.',
      render: (student: Student) => (
        <span className="font-semibold">{student.admission_number}</span>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (student: Student) => `${student.first_name} ${student.last_name}`,
    },
    {
      key: 'gender',
      header: 'Gender',
      render: (student: Student) => (
        <span className="capitalize">{student.gender}</span>
      ),
    },
    {
      key: 'class',
      header: 'Class',
      render: (student: Student) => student.current_class?.name || 'Not assigned',
    },
    {
      key: 'status',
      header: 'Status',
      render: (student: Student) => <StatusBadge status={student.status} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (student: Student) => (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => openEditModal(student)}>
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedStudent(student);
              setShowArchiveDialog(true);
            }}
            disabled={student.status === 'archived'}
          >
            Archive
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Students</h1>
          <p className="page-description">Manage all student records</p>
        </div>
        <div className="page-actions">
          <Button variant="primary" onClick={() => { resetForm(); setShowCreateModal(true); }}>
            Add Student
          </Button>
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            className="form-input"
            placeholder="Search by name or admission number..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ maxWidth: '400px' }}
          />
          {search && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { setSearch(''); setPage(1); }}
            >
              Clear
            </Button>
          )}
        </div>

        <Table
          columns={columns}
          data={students}
          loading={loading}
          emptyMessage="No students found"
        />

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </Card>

      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Add New Student"
      >
        <div className="grid gap-4">
          <div className="form-group">
            <label className="form-label">Admission Number</label>
            <input
              className="form-input"
              value={formData.admission_number}
              onChange={(e) => setFormData({ ...formData, admission_number: e.target.value })}
              placeholder="e.g., 2024-001"
              autoFocus
            />
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
            <label className="form-label">Middle Name</label>
            <input
              className="form-input"
              value={formData.middle_name}
              onChange={(e) => setFormData({ ...formData, middle_name: e.target.value })}
              placeholder="Optional"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Date of Birth</label>
              <input
                type="date"
                className="form-input"
                value={formData.date_of_birth}
                onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Gender</label>
              <select
                className="form-select"
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
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
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="student@example.com"
              />
            </div>
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
          <Button variant="primary" onClick={handleCreate} loading={submitting}>
            Create Student
          </Button>
        </div>
      </Modal>

      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Student"
      >
        <div className="grid gap-4">
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
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
                className="form-input"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Address</label>
            <textarea
              className="form-textarea"
              rows={2}
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>
          <Button variant="primary" onClick={handleEdit} loading={submitting}>
            Update Student
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={showArchiveDialog}
        onClose={() => setShowArchiveDialog(false)}
        onConfirm={handleArchive}
        title="Archive Student"
        message={`Are you sure you want to archive ${selectedStudent?.first_name} ${selectedStudent?.last_name}? This will remove them from active rosters.`}
        confirmText="Archive"
        danger
      />
    </div>
  );
}