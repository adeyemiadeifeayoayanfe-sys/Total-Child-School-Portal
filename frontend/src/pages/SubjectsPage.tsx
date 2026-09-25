import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/ui/Toast';
import { Subject } from '../types';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Card from '../components/ui/Card';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { StatusBadge } from '../components/ui/Badge';

interface SubjectDetails extends Subject {
  class_count?: number;
  class_subject_assignments?: Array<{
    id: string;
    class?: {
      id: string;
      name: string;
    };
    session?: {
      id: string;
      name?: string;
    };
    is_active?: boolean;
  }>;
  teacher_subject_assignments?: Array<{
    id: string;
    teacher?: {
      profile?: {
        first_name?: string;
        last_name?: string;
      };
    };
    class?: {
      id: string;
      name: string;
    };
    session?: {
      id: string;
      name?: string;
    };
  }>;
}

export default function SubjectsPage() {
  const { call } = useApi();
  const { showToast } = useToast();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [showFormModal, setShowFormModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);

  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [details, setDetails] = useState<SubjectDetails | null>(null);

  const [loadingDetails, setLoadingDetails] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
  });

  const isEditing = Boolean(selectedSubject);

  const fetchSubjects = useCallback(async () => {
    setLoading(true);

    const params = new URLSearchParams();

    if (search.trim()) {
      params.set('search', search.trim());
    }

    if (statusFilter !== 'all') {
      params.set('is_active', statusFilter === 'active' ? 'true' : 'false');
    }

    const query = params.toString();
    const result = await call(`/subjects${query ? `?${query}` : ''}`);

    if (result.success && result.data) {
      setSubjects(result.data);
    } else {
      showToast('error', result.error || 'Failed to load subjects');
    }

    setLoading(false);
  }, [call, search, statusFilter, showToast]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchSubjects();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [fetchSubjects]);

  const filteredSubjects = useMemo(() => {
    return subjects;
  }, [subjects]);

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      description: '',
    });
    setSelectedSubject(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowFormModal(true);
  };

  const openEditModal = (subject: Subject) => {
    setSelectedSubject(subject);
    setFormData({
      name: subject.name,
      code: subject.code || '',
      description: subject.description || '',
    });
    setShowFormModal(true);
  };

  const openDetailsModal = async (subject: Subject) => {
    setShowDetailsModal(true);
    setLoadingDetails(true);
    setDetails(null);

    const result = await call(`/subjects/${subject.id}`);

    if (result.success && result.data) {
      setDetails(result.data);
    } else {
      showToast('error', result.error || 'Failed to load subject details');
      setShowDetailsModal(false);
    }

    setLoadingDetails(false);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      showToast('error', 'Subject name is required');
      return;
    }

    setSubmitting(true);

    const payload = {
      name: formData.name.trim(),
      code: formData.code.trim() || null,
      description: formData.description.trim() || null,
    };

    const result = isEditing
      ? await call(`/subjects/${selectedSubject!.id}`, {
          method: 'PUT',
          body: payload,
        })
      : await call('/subjects', {
          method: 'POST',
          body: payload,
        });

    if (result.success) {
      showToast(
        'success',
        isEditing
          ? 'Subject updated successfully'
          : 'Subject created successfully'
      );

      setShowFormModal(false);
      resetForm();
      await fetchSubjects();
    } else {
      showToast('error', result.error || 'Failed to save subject');
    }

    setSubmitting(false);
  };

  const handleToggleStatus = async () => {
    if (!selectedSubject) return;

    setSubmitting(true);

    const result = await call(`/subjects/${selectedSubject.id}`, {
      method: 'PUT',
      body: {
        is_active: !selectedSubject.is_active,
      },
    });

    if (result.success) {
      showToast(
        'success',
        selectedSubject.is_active
          ? 'Subject deactivated successfully'
          : 'Subject activated successfully'
      );

      setShowDeactivateDialog(false);
      setSelectedSubject(null);
      await fetchSubjects();
    } else {
      showToast('error', result.error || 'Failed to update subject status');
    }

    setSubmitting(false);
  };

  const columns = [
    {
      key: 'name',
      header: 'Subject',
      render: (subject: Subject) => (
        <div>
          <div className="font-semibold">{subject.name}</div>
          {subject.description && (
            <div className="text-sm text-gray-500 truncate max-w-xs">
              {subject.description}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'code',
      header: 'Code',
      render: (subject: Subject) => subject.code || '—',
    },
    {
      key: 'class_count',
      header: 'Classes',
      render: (subject: Subject & { class_count?: number }) => subject.class_count ?? 0,
    },
    {
      key: 'status',
      header: 'Status',
      render: (subject: Subject) => (
        <StatusBadge status={subject.is_active ? 'active' : 'inactive'} />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right' as const,
      render: (subject: Subject) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              openDetailsModal(subject);
            }}
          >
            Details
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              openEditModal(subject);
            }}
          >
            Edit
          </Button>

          <Button
            variant={subject.is_active ? 'danger' : 'primary'}
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              setSelectedSubject(subject);
              setShowDeactivateDialog(true);
            }}
          >
            {subject.is_active ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Subjects</h1>
          <p className="page-description">
            Manage subjects offered by the school
          </p>
        </div>

        <div className="page-actions">
          <Button variant="primary" onClick={openCreateModal}>
            Add Subject
          </Button>
        </div>
      </div>

      <Card>
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <input
            className="form-input md:max-w-md"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by subject name or code..."
          />

          <select
            className="form-select md:w-48"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as 'all' | 'active' | 'inactive'
              )
            }
          >
            <option value="all">All Subjects</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>

        <Table
          columns={columns}
          data={filteredSubjects}
          loading={loading}
          emptyMessage="No subjects match your filters"
          onRowClick={openDetailsModal}
          striped
        />
      </Card>

      <Modal
        open={showFormModal}
        onClose={() => {
          if (!submitting) {
            setShowFormModal(false);
            resetForm();
          }
        }}
        title={isEditing ? 'Edit Subject' : 'Create New Subject'}
      >
        <div className="grid gap-4">
          <div className="form-group">
            <label className="form-label">Subject Name</label>
            <input
              className="form-input"
              value={formData.name}
              onChange={(event) =>
                setFormData({
                  ...formData,
                  name: event.target.value,
                })
              }
              placeholder="e.g. Mathematics"
              autoFocus
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Subject Code</label>
            <input
              className="form-input"
              value={formData.code}
              onChange={(event) =>
                setFormData({
                  ...formData,
                  code: event.target.value,
                })
              }
              placeholder="e.g. MTH"
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-textarea"
              rows={4}
              value={formData.description}
              onChange={(event) =>
                setFormData({
                  ...formData,
                  description: event.target.value,
                })
              }
              placeholder="Optional subject description"
              disabled={submitting}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowFormModal(false);
                resetForm();
              }}
              disabled={submitting}
            >
              Cancel
            </Button>

            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={submitting}
            >
              {isEditing ? 'Save Changes' : 'Create Subject'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        title={details?.name || 'Subject Details'}
      >
        {loadingDetails ? (
          <div className="loading-container">
            <div className="spinner" aria-hidden="true" />
            <span className="loading-text">Loading subject details...</span>
          </div>
        ) : details ? (
          <div className="grid gap-5">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="text-sm text-gray-500">Subject Name</div>
                <div className="font-semibold">{details.name}</div>
              </div>

              <div>
                <div className="text-sm text-gray-500">Code</div>
                <div className="font-semibold">{details.code || '—'}</div>
              </div>

              <div>
                <div className="text-sm text-gray-500">Status</div>
                <StatusBadge
                  status={details.is_active ? 'active' : 'inactive'}
                />
              </div>

              <div>
                <div className="text-sm text-gray-500">Class Assignments</div>
                <div className="font-semibold">
                  {details.class_count ?? details.class_subject_assignments?.length ?? 0}
                </div>
              </div>
            </div>

            {details.description && (
              <div>
                <div className="text-sm text-gray-500">Description</div>
                <p className="mt-1 text-gray-700">{details.description}</p>
              </div>
            )}

            <div>
              <h3 className="mb-2 font-semibold">Class Assignments</h3>

              {details.class_subject_assignments &&
              details.class_subject_assignments.length > 0 ? (
                <div className="grid gap-2">
                  {details.class_subject_assignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="rounded border border-gray-200 p-3"
                    >
                      <div className="font-medium">
                        {assignment.class?.name || 'Unknown class'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {assignment.session?.name || 'Unknown session'}
                      </div>
                      <StatusBadge
                        status={
                          assignment.is_active === false
                            ? 'inactive'
                            : 'active'
                        }
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  This subject has not been assigned to any class.
                </p>
              )}
            </div>

            <div>
              <h3 className="mb-2 font-semibold">Teacher Assignments</h3>

              {details.teacher_subject_assignments &&
              details.teacher_subject_assignments.length > 0 ? (
                <div className="grid gap-2">
                  {details.teacher_subject_assignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="rounded border border-gray-200 p-3"
                    >
                      <div className="font-medium">
                        {assignment.teacher?.profile
                          ? `${assignment.teacher.profile.first_name || ''} ${assignment.teacher.profile.last_name || ''}`.trim()
                          : 'Unknown teacher'}
                      </div>

                      <div className="text-sm text-gray-500">
                        {assignment.class?.name || 'Unknown class'} ·{' '}
                        {assignment.session?.name || 'Unknown session'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  No teacher assignments found.
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            Unable to load subject details.
          </p>
        )}
      </Modal>

      <ConfirmDialog
        open={showDeactivateDialog}
        onClose={() => {
          if (!submitting) {
            setShowDeactivateDialog(false);
            setSelectedSubject(null);
          }
        }}
        onConfirm={handleToggleStatus}
        title={selectedSubject?.is_active ? 'Deactivate Subject' : 'Activate Subject'}
        message={
          selectedSubject?.is_active
            ? `Are you sure you want to deactivate "${selectedSubject?.name}"?`
            : `Are you sure you want to activate "${selectedSubject?.name}"?`
        }
        confirmText={selectedSubject?.is_active ? 'Deactivate' : 'Activate'}
        danger={Boolean(selectedSubject?.is_active)}
        loading={submitting}
      />
    </div>
  );
}

