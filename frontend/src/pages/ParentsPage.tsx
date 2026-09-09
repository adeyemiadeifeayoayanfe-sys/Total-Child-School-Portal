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

  const [showAssignChildrenModal, setShowAssignChildrenModal] =
    useState(false);
  const [selectedParent, setSelectedParent] = useState<Parent | null>(null);
  const [admissionNumbers, setAdmissionNumbers] = useState('');
  const [assigningChildren, setAssigningChildren] = useState(false);
  const [isPrimary, setIsPrimary] = useState(false);

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

    setAdmissionNumbers('');
    setIsPrimary(false);
  };

  const handleCreate = async () => {
    if (
      !formData.email ||
      !formData.password ||
      !formData.first_name ||
      !formData.last_name
    ) {
      showToast('error', 'Please fill in all required fields');
      return;
    }

    /*
     * Convert comma-separated admission numbers into
     * an array while keeping them as strings.
     *
     * Example:
     * "0070, 0123, 0145"
     *
     * becomes:
     * ["0070", "0123", "0145"]
     */
    const numbers = admissionNumbers
      .split(',')
      .map((number) => number.trim())
      .filter(Boolean);

    /*
     * Admission numbers must be exactly four digits.
     * This also preserves leading zeros.
     */
    const invalid = numbers.filter(
      (number) => !/^\d{4}$/.test(number)
    );

    if (invalid.length > 0) {
      showToast(
        'error',
        `Invalid admission number(s): ${invalid.join(', ')}`
      );
      return;
    }

    /*
     * Remove duplicates.
     */
    const uniqueNumbers = [...new Set(numbers)];

    setSubmitting(true);

    const result = await call('/parents', {
      method: 'POST',
      body: {
        ...formData,
        admission_numbers: uniqueNumbers,
        is_primary: isPrimary,
      },
    });

    if (result.success) {
      const childrenCount =
        result.data?.children_count ??
        uniqueNumbers.length;

      let message = 'Parent account created successfully';

      if (childrenCount > 0) {
        message += ` with ${childrenCount} child${
          childrenCount === 1 ? '' : 'ren'
        } assigned`;
      }

      showToast('success', message);

      setShowCreateModal(false);
      resetForm();
      fetchParents();
    } else {
      showToast(
        'error',
        result.error || 'Failed to create parent'
      );
    }

    setSubmitting(false);
  };

  const openAssignChildrenModal = (parent: Parent) => {
    setSelectedParent(parent);
    setAdmissionNumbers('');
    setIsPrimary(false);
    setShowAssignChildrenModal(true);
  };

  const closeAssignChildrenModal = () => {
    if (assigningChildren) return;

    setShowAssignChildrenModal(false);
    setSelectedParent(null);
    setAdmissionNumbers('');
    setIsPrimary(false);
  };

  const handleAssignChildren = async () => {
    if (!selectedParent) return;

    const numbers = admissionNumbers
      .split(',')
      .map((number) => number.trim())
      .filter(Boolean);

    if (!numbers.length) {
      showToast(
        'error',
        'Enter at least one admission number'
      );
      return;
    }

    const invalid = numbers.filter(
      (number) => !/^\d{4}$/.test(number)
    );

    if (invalid.length) {
      showToast(
        'error',
        `Invalid admission number(s): ${invalid.join(', ')}`
      );
      return;
    }

    const uniqueNumbers = [...new Set(numbers)];

    setAssigningChildren(true);

    const result = await call(
      '/students/assign-parent-by-admission',
      {
        method: 'POST',
        body: {
          parent_id: selectedParent.id,
          admission_numbers: uniqueNumbers,
          is_primary: isPrimary,
        },
      }
    );

    if (result.success) {
      const assignedCount =
        result.data?.count ??
        result.data?.assigned?.length ??
        uniqueNumbers.length;

      const alreadyCount =
        result.data?.already_assigned?.length ?? 0;

      let message = `${assignedCount} child${
        assignedCount === 1 ? '' : 'ren'
      } assigned successfully`;

      if (alreadyCount > 0) {
        message += `. ${alreadyCount} already assigned.`;
      }

      showToast('success', message);

      setShowAssignChildrenModal(false);
      setSelectedParent(null);
      setAdmissionNumbers('');
      setIsPrimary(false);
    } else {
      showToast(
        'error',
        result.error || 'Failed to assign children'
      );
    }

    setAssigningChildren(false);
  };

  const enteredNumbers = admissionNumbers
    .split(',')
    .map((number) => number.trim())
    .filter(Boolean);

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (parent: Parent) => (
        <span className="font-semibold">
          {parent.profile?.first_name}{' '}
          {parent.profile?.last_name}
        </span>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (parent: Parent) =>
        parent.user?.email || parent.user_id,
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (parent: Parent) =>
        parent.profile?.phone || '—',
    },
    {
      key: 'occupation',
      header: 'Occupation',
      render: (parent: Parent) =>
        parent.occupation || '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (parent: Parent) => (
        <StatusBadge
          status={
            parent.is_active
              ? 'active'
              : 'inactive'
          }
        />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (parent: Parent) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            openAssignChildrenModal(parent)
          }
        >
          Assign Children
        </Button>
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
              resetForm();
              setShowCreateModal(true);
            }}
          >
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

      {/* Create Parent Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => {
          if (!submitting) {
            setShowCreateModal(false);
          }
        }}
        title="Create Parent Account"
      >
        <div className="grid gap-4">
          <div className="form-group">
            <label className="form-label">
              Email Address
            </label>

            <input
              type="email"
              className="form-input"
              value={formData.email}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  email: e.target.value,
                })
              }
              placeholder="parent@example.com"
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Temporary Password
            </label>

            <input
              type="password"
              className="form-input"
              value={formData.password}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  password: e.target.value,
                })
              }
              placeholder="Min 8 characters"
              disabled={submitting}
            />

            <p className="form-hint">
              Parent will be prompted to change on first login.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">
                First Name
              </label>

              <input
                className="form-input"
                value={formData.first_name}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    first_name: e.target.value,
                  })
                }
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Last Name
              </label>

              <input
                className="form-input"
                value={formData.last_name}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    last_name: e.target.value,
                  })
                }
                disabled={submitting}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              Phone
            </label>

            <input
              className="form-input"
              value={formData.phone}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  phone: e.target.value,
                })
              }
              placeholder="Phone number"
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Address
            </label>

            <textarea
              className="form-textarea"
              rows={2}
              value={formData.address}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  address: e.target.value,
                })
              }
              placeholder="Home address"
              disabled={submitting}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">
                Occupation
              </label>

              <input
                className="form-input"
                value={formData.occupation}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    occupation: e.target.value,
                  })
                }
                placeholder="e.g., Engineer"
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Relationship to Student
              </label>

              <input
                className="form-input"
                value={
                  formData.relationship_to_student
                }
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    relationship_to_student:
                      e.target.value,
                  })
                }
                placeholder="e.g., Father, Mother, Guardian"
                disabled={submitting}
              />
            </div>
          </div>

          {/* Children during parent creation */}
          <div className="border-t pt-4">
            <div className="mb-3">
              <h3 className="font-semibold">
                Assign Children
              </h3>

              <p className="form-hint">
                You can assign existing students to this
                parent now. This is optional.
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">
                Student Admission Number(s)
              </label>

              <textarea
                className="form-textarea"
                rows={3}
                value={admissionNumbers}
                onChange={(e) =>
                  setAdmissionNumbers(
                    e.target.value
                  )
                }
                placeholder="0070, 0123, 0145"
                disabled={submitting}
              />

              <p className="form-hint">
                Enter one or more admission numbers separated
                by commas. Leading zeros are preserved.
                Leave empty if the parent has no children to
                assign yet.
              </p>

              {enteredNumbers.length > 0 && (
                <p className="mt-1 text-sm text-gray-500">
                  {enteredNumbers.length}{' '}
                  {enteredNumbers.length === 1
                    ? 'admission number'
                    : 'admission numbers'}{' '}
                  entered
                </p>
              )}
            </div>

            <label className="flex items-center gap-2 cursor-pointer mt-3">
              <input
                type="checkbox"
                checked={isPrimary}
                onChange={(e) =>
                  setIsPrimary(
                    e.target.checked
                  )
                }
                disabled={submitting}
              />

              <span className="text-sm">
                Mark as primary parent for these children
              </span>
            </label>
          </div>

          <Button
            variant="primary"
            onClick={handleCreate}
            loading={submitting}
          >
            Create Parent
          </Button>
        </div>
      </Modal>

      {/* Assign Children to Existing Parent Modal */}
      <Modal
        open={showAssignChildrenModal}
        onClose={closeAssignChildrenModal}
        title="Assign Children"
      >
        <div className="grid gap-4">
          <div>
            <p className="text-sm text-gray-500">
              Parent
            </p>

            <p className="font-semibold">
              {selectedParent?.profile?.first_name}{' '}
              {selectedParent?.profile?.last_name}
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">
              Student Admission Number(s)
            </label>

            <textarea
              className="form-textarea"
              rows={4}
              value={admissionNumbers}
              onChange={(e) =>
                setAdmissionNumbers(
                  e.target.value
                )
              }
              placeholder="0070, 0123, 0145"
              disabled={assigningChildren}
            />

            <p className="form-hint">
              Enter one or more admission numbers separated
              by commas. Leading zeros are preserved.
            </p>

            {enteredNumbers.length > 0 && (
              <p className="mt-1 text-sm text-gray-500">
                {enteredNumbers.length}{' '}
                {enteredNumbers.length === 1
                  ? 'admission number'
                  : 'admission numbers'}{' '}
                entered
              </p>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) =>
                setIsPrimary(
                  e.target.checked
                )
              }
              disabled={assigningChildren}
            />

            <span className="text-sm">
              Mark as primary parent for these children
            </span>
          </label>

          <div className="flex justify-end gap-3">
            <Button
              variant="ghost"
              onClick={closeAssignChildrenModal}
              disabled={assigningChildren}
            >
              Cancel
            </Button>

            <Button
              variant="primary"
              onClick={handleAssignChildren}
              loading={assigningChildren}
            >
              Assign Children
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

