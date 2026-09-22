import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/ui/Toast';
import { Parent } from '../types';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Card from '../components/ui/Card';
import { StatusBadge } from '../components/ui/Badge';
type ParentForm = {
  first_name: string;
  last_name: string;
  phone: string;
  address: string;
  occupation: string;
  relationship_to_student: string;
  alternate_phone: string;
};
const emptyForm: ParentForm = {
  first_name: '',
  last_name: '',
  phone: '',
  address: '',
  occupation: '',
  relationship_to_student: '',
  alternate_phone: '',
};
export default function ParentsPage() {
  const { call } = useApi();
  const { showToast } = useToast();
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedParent, setSelectedParent] = useState<Parent | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: '',
    password: '',
    ...emptyForm,
  });
  const [editForm, setEditForm] = useState<ParentForm>(emptyForm);
  const [admissionNumbers, setAdmissionNumbers] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const fetchParents = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) {
      params.set('search', search.trim());
    }
    if (statusFilter !== 'all') {
      params.set('is_active', statusFilter);
    }
    const query = params.toString();
    const result = await call(`/parents${query ? `?${query}` : ''}`);
    if (result.success && result.data) {
      setParents(result.data);
    } else {
      showToast('error', result.error || 'Failed to load parents');
    }
    setLoading(false);
  }, [call, search, statusFilter, showToast]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchParents();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [fetchParents]);
  const resetCreateForm = () => {
    setCreateForm({
      email: '',
      password: '',
      ...emptyForm,
    });
    setAdmissionNumbers('');
    setIsPrimary(false);
  };
  const openEdit = (parent: Parent) => {
    setSelectedParent(parent);
    setEditForm({
      first_name: parent.profile?.first_name || '',
      last_name: parent.profile?.last_name || '',
      phone: parent.profile?.phone || '',
      address: parent.profile?.address || '',
      occupation: parent.occupation || '',
      relationship_to_student:
        parent.relationship_to_student || '',
      alternate_phone: '',
    });
    setShowEditModal(true);
  };
  const handleCreate = async () => {
    if (
      !createForm.email ||
      !createForm.password ||
      !createForm.first_name ||
      !createForm.last_name
    ) {
      showToast('error', 'Please fill in all required fields');
      return;
    }
    const numbers = admissionNumbers
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const invalid = numbers.filter(
      (value) => !/^\d{4}$/.test(value)
    );
    if (invalid.length) {
      showToast(
        'error',
        `Invalid admission number(s): ${invalid.join(', ')}`
      );
      return;
    }
    setSubmitting(true);
    const result = await call('/parents', {
      method: 'POST',
      body: {
        ...createForm,
        admission_numbers: [...new Set(numbers)],
        is_primary: isPrimary,
      },
    });
    if (result.success) {
      showToast('success', 'Parent account created successfully');
      setShowCreateModal(false);
      resetCreateForm();
      fetchParents();
    } else {
      showToast(
        'error',
        result.error || 'Failed to create parent'
      );
    }
    setSubmitting(false);
  };
  const handleEdit = async () => {
    if (!selectedParent) return;
    if (!editForm.first_name || !editForm.last_name) {
      showToast('error', 'First and last name are required');
      return;
    }
    setSubmitting(true);
    const result = await call(`/parents/${selectedParent.id}`, {
      method: 'PUT',
      body: editForm,
    });
    if (result.success) {
      showToast('success', 'Parent updated successfully');
      setShowEditModal(false);
      setSelectedParent(null);
      fetchParents();
    } else {
      showToast(
        'error',
        result.error || 'Failed to update parent'
      );
    }
    setSubmitting(false);
  };
  const openAssign = (parent: Parent) => {
    setSelectedParent(parent);
    setAdmissionNumbers('');
    setIsPrimary(false);
    setShowAssignModal(true);
  };
  const handleAssign = async () => {
    if (!selectedParent) return;
    const numbers = admissionNumbers
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const invalid = numbers.filter(
      (value) => !/^\d{4}$/.test(value)
    );
    if (!numbers.length) {
      showToast('error', 'Enter at least one admission number');
      return;
    }
    if (invalid.length) {
      showToast(
        'error',
        `Invalid admission number(s): ${invalid.join(', ')}`
      );
      return;
    }
    setAssigning(true);
    const result = await call(
      '/students/assign-parent-by-admission',
      {
        method: 'POST',
        body: {
          parent_id: selectedParent.id,
          admission_numbers: [...new Set(numbers)],
          is_primary: isPrimary,
        },
      }
    );
    if (result.success) {
      showToast('success', 'Children assigned successfully');
      setShowAssignModal(false);
      setSelectedParent(null);
      setAdmissionNumbers('');
      setIsPrimary(false);
    } else {
      showToast(
        'error',
        result.error || 'Failed to assign children'
      );
    }
    setAssigning(false);
  };
  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (parent: Parent) => (
        <div>
          <div className="font-semibold">
            {parent.profile?.first_name || ''}{' '}
            {parent.profile?.last_name || ''}
          </div>
          <div className="text-xs text-gray-500">
            {parent.relationship_to_student || 'Parent'}
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (parent: Parent) =>
        parent.user?.email || '-',
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (parent: Parent) =>
        parent.profile?.phone || '-',
    },
    {
      key: 'occupation',
      header: 'Occupation',
      render: (parent: Parent) =>
        parent.occupation || '-',
    },
    {
      key: 'status',
      header: 'Status',
      render: (parent: Parent) => (
        <StatusBadge
          status={parent.is_active ? 'active' : 'inactive'}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (parent: Parent) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openEdit(parent)}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openAssign(parent)}
          >
            Assign Children
          </Button>
        </div>
      ),
    },
  ];
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Parents</h1>
          <p className="page-description">
            Manage parent accounts and child assignments
          </p>
        </div>
        <div className="page-actions">
          <Button
            variant="primary"
            onClick={() => {
              resetCreateForm();
              setShowCreateModal(true);
            }}
          >
            Add Parent
          </Button>
        </div>
      </div>
      <Card className="mb-4">
        <div className="grid gap-4 md:grid-cols-[1fr_180px]">
          <input
            className="form-input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search parents..."
          />
          <select
            className="form-input"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All parents</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </Card>
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
        onClose={() => {
          if (!submitting) setShowCreateModal(false);
        }}
        title="Create Parent Account"
      >
        <div className="grid gap-4">
          <input
            className="form-input"
            type="email"
            placeholder="Email address"
            value={createForm.email}
            onChange={(event) =>
              setCreateForm({
                ...createForm,
                email: event.target.value,
              })
            }
            disabled={submitting}
          />
          <input
            className="form-input"
            type="password"
            placeholder="Temporary password"
            value={createForm.password}
            onChange={(event) =>
              setCreateForm({
                ...createForm,
                password: event.target.value,
              })
            }
            disabled={submitting}
          />
          <div className="grid grid-cols-2 gap-4">
            <input
              className="form-input"
              placeholder="First name"
              value={createForm.first_name}
              onChange={(event) =>
                setCreateForm({
                  ...createForm,
                  first_name: event.target.value,
                })
              }
              disabled={submitting}
            />
            <input
              className="form-input"
              placeholder="Last name"
              value={createForm.last_name}
              onChange={(event) =>
                setCreateForm({
                  ...createForm,
                  last_name: event.target.value,
                })
              }
              disabled={submitting}
            />
          </div>
          <input
            className="form-input"
            placeholder="Phone"
            value={createForm.phone}
            onChange={(event) =>
              setCreateForm({
                ...createForm,
                phone: event.target.value,
              })
            }
            disabled={submitting}
          />
          <textarea
            className="form-textarea"
            rows={2}
            placeholder="Address"
            value={createForm.address}
            onChange={(event) =>
              setCreateForm({
                ...createForm,
                address: event.target.value,
              })
            }
            disabled={submitting}
          />
          <div className="grid grid-cols-2 gap-4">
            <input
              className="form-input"
              placeholder="Occupation"
              value={createForm.occupation}
              onChange={(event) =>
                setCreateForm({
                  ...createForm,
                  occupation: event.target.value,
                })
              }
              disabled={submitting}
            />
            <input
              className="form-input"
              placeholder="Relationship to student"
              value={createForm.relationship_to_student}
              onChange={(event) =>
                setCreateForm({
                  ...createForm,
                  relationship_to_student: event.target.value,
                })
              }
              disabled={submitting}
            />
          </div>
          <textarea
            className="form-textarea"
            rows={3}
            placeholder="Admission numbers: 0070, 0123"
            value={admissionNumbers}
            onChange={(event) =>
              setAdmissionNumbers(event.target.value)
            }
            disabled={submitting}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(event) =>
                setIsPrimary(event.target.checked)
              }
              disabled={submitting}
            />
            Mark assigned children as primary parent
          </label>
          <Button
            variant="primary"
            onClick={handleCreate}
            loading={submitting}
          >
            Create Parent
          </Button>
        </div>
      </Modal>
      <Modal
        open={showEditModal}
        onClose={() => {
          if (!submitting) setShowEditModal(false);
        }}
        title="Edit Parent"
      >
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <input
              className="form-input"
              placeholder="First name"
              value={editForm.first_name}
              onChange={(event) =>
                setEditForm({
                  ...editForm,
                  first_name: event.target.value,
                })
              }
              disabled={submitting}
            />
            <input
              className="form-input"
              placeholder="Last name"
              value={editForm.last_name}
              onChange={(event) =>
                setEditForm({
                  ...editForm,
                  last_name: event.target.value,
                })
              }
              disabled={submitting}
            />
          </div>
          <input
            className="form-input"
            placeholder="Phone"
            value={editForm.phone}
            onChange={(event) =>
              setEditForm({
                ...editForm,
                phone: event.target.value,
              })
            }
            disabled={submitting}
          />
          <textarea
            className="form-textarea"
            rows={2}
            placeholder="Address"
            value={editForm.address}
            onChange={(event) =>
              setEditForm({
                ...editForm,
                address: event.target.value,
              })
            }
            disabled={submitting}
          />
          <input
            className="form-input"
            placeholder="Occupation"
            value={editForm.occupation}
            onChange={(event) =>
              setEditForm({
                ...editForm,
                occupation: event.target.value,
              })
            }
            disabled={submitting}
          />
          <input
            className="form-input"
            placeholder="Relationship to student"
            value={editForm.relationship_to_student}
            onChange={(event) =>
              setEditForm({
                ...editForm,
                relationship_to_student: event.target.value,
              })
            }
            disabled={submitting}
          />
          <Button
            variant="primary"
            onClick={handleEdit}
            loading={submitting}
          >
            Save Changes
          </Button>
        </div>
      </Modal>
      <Modal
        open={showAssignModal}
        onClose={() => {
          if (!assigning) setShowAssignModal(false);
        }}
        title="Assign Children"
      >
        <div className="grid gap-4">
          <div>
            <p className="text-sm text-gray-500">Parent</p>
            <p className="font-semibold">
              {selectedParent?.profile?.first_name || ''}{' '}
              {selectedParent?.profile?.last_name || ''}
            </p>
          </div>
          <textarea
            className="form-textarea"
            rows={4}
            placeholder="Admission numbers: 0070, 0123"
            value={admissionNumbers}
            onChange={(event) =>
              setAdmissionNumbers(event.target.value)
            }
            disabled={assigning}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(event) =>
                setIsPrimary(event.target.checked)
              }
              disabled={assigning}
            />
            Mark as primary parent
          </label>
          <div className="flex justify-end gap-3">
            <Button
              variant="ghost"
              onClick={() => setShowAssignModal(false)}
              disabled={assigning}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleAssign}
              loading={assigning}
            >
              Assign Children
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
