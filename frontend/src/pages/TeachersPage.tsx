import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/ui/Toast';
import { Teacher, Class, AcademicSession } from '../types';
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
  const [classes, setClasses] = useState<Class[]>([]);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingAssignmentData, setLoadingAssignmentData] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [assignmentLoading, setAssignmentLoading] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [showAssignClassModal, setShowAssignClassModal] = useState(false);

  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);

  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [isClassTeacher, setIsClassTeacher] = useState(false);

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
    } else {
      showToast(
        'error',
        result.error || 'Failed to fetch teachers'
      );
    }

    setLoading(false);
  }, [call, showToast]);

  useEffect(() => {
    fetchTeachers();
  }, [fetchTeachers]);

  const extractArray = <T,>(result: any): T[] => {
    if (Array.isArray(result?.data)) {
      return result.data;
    }

    if (Array.isArray(result?.data?.data)) {
      return result.data.data;
    }

    if (Array.isArray(result)) {
      return result;
    }

    return [];
  };

  const fetchAssignmentData = async () => {
    setLoadingAssignmentData(true);

    const [classesResult, sessionsResult] = await Promise.all([
      call('/classes'),
      call('/sessions'),
    ]);

    if (!classesResult.success) {
      showToast(
        'error',
        classesResult.error || 'Failed to fetch classes'
      );
    }

    if (!sessionsResult.success) {
      showToast(
        'error',
        sessionsResult.error || 'Failed to fetch sessions'
      );
    }

    const availableClasses = extractArray<Class>(classesResult).filter(
      (item) => item.is_active
    );

    const availableSessions =
      extractArray<AcademicSession>(sessionsResult);

    setClasses(availableClasses);
    setSessions(availableSessions);

    const currentSession = availableSessions.find(
      (session) => session.is_current
    );

    setSelectedSessionId(
      currentSession?.id || availableSessions[0]?.id || ''
    );

    setLoadingAssignmentData(false);
  };

  const openAssignClassModal = async (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setSelectedClassId('');
    setSelectedSessionId('');
    setIsClassTeacher(false);
    setShowAssignClassModal(true);

    await fetchAssignmentData();
  };

  const handleAssignClass = async () => {
    if (!selectedTeacher) {
      showToast('error', 'No teacher selected');
      return;
    }

    if (!selectedClassId) {
      showToast('error', 'Please select a class');
      return;
    }

    if (!selectedSessionId) {
      showToast('error', 'Please select an academic session');
      return;
    }

    setAssignmentLoading(true);

    const result = await call('/teachers/assign-class', {
      method: 'POST',
      body: {
        teacher_id: selectedTeacher.id,
        class_id: selectedClassId,
        session_id: selectedSessionId,
        is_class_teacher: isClassTeacher,
      },
    });

    if (result.success) {
      showToast(
        'success',
        'Teacher assigned to class successfully'
      );

      setShowAssignClassModal(false);
      setSelectedTeacher(null);
      setSelectedClassId('');
      setSelectedSessionId('');
      setIsClassTeacher(false);
    } else {
      showToast(
        'error',
        result.error || 'Failed to assign teacher to class'
      );
    }

    setAssignmentLoading(false);
  };

  const handleCreate = async () => {
    if (
      !formData.email ||
      !formData.password ||
      !formData.first_name ||
      !formData.last_name
    ) {
      showToast(
        'error',
        'Please fill in all required fields'
      );
      return;
    }

    setSubmitting(true);

    const result = await call('/teachers', {
      method: 'POST',
      body: formData,
    });

    if (result.success) {
      showToast(
        'success',
        'Teacher account created successfully'
      );

      setShowCreateModal(false);
      resetForm();
      fetchTeachers();
    } else {
      showToast(
        'error',
        result.error || 'Failed to create teacher'
      );
    }

    setSubmitting(false);
  };

  const handleDeactivate = async () => {
    if (!selectedTeacher) return;

    const result = await call(
      `/teachers/${selectedTeacher.id}/deactivate`,
      {
        method: 'POST',
      }
    );

    if (result.success) {
      showToast(
        'success',
        'Teacher deactivated successfully'
      );

      setShowDeactivateDialog(false);
      fetchTeachers();
    } else {
      showToast(
        'error',
        result.error || 'Failed to deactivate teacher'
      );
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
          {teacher.profile?.first_name}{' '}
          {teacher.profile?.last_name}
        </span>
      ),
    },
    {
      key: 'staff_number',
      header: 'Staff No.',
      render: (teacher: Teacher) =>
        teacher.staff_number,
    },
    {
      key: 'email',
      header: 'Email',
      render: (teacher: Teacher) =>
        teacher.user?.email || teacher.user_id,
    },
    {
      key: 'qualification',
      header: 'Qualification',
      render: (teacher: Teacher) =>
        teacher.qualification || '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (teacher: Teacher) => (
        <StatusBadge
          status={
            teacher.is_active
              ? 'active'
              : 'inactive'
          }
        />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (teacher: Teacher) => (
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() =>
              openAssignClassModal(teacher)
            }
            disabled={!teacher.is_active}
          >
            Assign Class
          </Button>

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
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Teachers
          </h1>

          <p className="page-description">
            Manage teacher accounts and assignments
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

      {/* Create Teacher Modal */}
      <Modal
        open={showCreateModal}
        onClose={() =>
          setShowCreateModal(false)
        }
        title="Create Teacher Account"
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
              placeholder="teacher@example.com"
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
            />

            <p className="form-hint">
              Teacher will be prompted to change
              on first login.
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
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Qualification
            </label>

            <input
              className="form-input"
              value={formData.qualification}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  qualification: e.target.value,
                })
              }
              placeholder="e.g., B.Ed, M.Sc"
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Specialization
            </label>

            <input
              className="form-input"
              value={formData.specialization}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  specialization: e.target.value,
                })
              }
              placeholder="e.g., Mathematics, English"
            />
          </div>

          <Button
            variant="primary"
            onClick={handleCreate}
            loading={submitting}
          >
            Create Teacher
          </Button>
        </div>
      </Modal>

      {/* Assign Class Modal */}
      <Modal
        open={showAssignClassModal}
        onClose={() =>
          setShowAssignClassModal(false)
        }
        title="Assign Teacher to Class"
      >
        <div className="grid gap-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm text-gray-500">
              Teacher
            </p>

            <p className="mt-1 font-semibold">
              {selectedTeacher?.profile?.first_name}{' '}
              {selectedTeacher?.profile?.last_name}
            </p>

            <p className="mt-1 text-sm text-gray-500">
              {selectedTeacher?.staff_number}
            </p>
          </div>

          {loadingAssignmentData ? (
            <div className="py-6 text-center text-sm text-gray-500">
              Loading classes and academic sessions...
            </div>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">
                  Academic Session
                </label>

                <select
                  className="form-input"
                  value={selectedSessionId}
                  onChange={(e) =>
                    setSelectedSessionId(
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    Select academic session
                  </option>

                  {sessions.map((session) => (
                    <option
                      key={session.id}
                      value={session.id}
                    >
                      {session.name}
                      {session.is_current
                        ? ' (Current)'
                        : ''}
                    </option>
                  ))}
                </select>

                {sessions.length === 0 && (
                  <p className="form-hint">
                    No academic sessions have
                    been created yet.
                  </p>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">
                  Class
                </label>

                <select
                  className="form-input"
                  value={selectedClassId}
                  onChange={(e) =>
                    setSelectedClassId(
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    Select class
                  </option>

                  {classes.map((cls) => (
                    <option
                      key={cls.id}
                      value={cls.id}
                    >
                      {cls.name}
                    </option>
                  ))}
                </select>

                {classes.length === 0 && (
                  <p className="form-hint">
                    No active classes have
                    been created yet.
                  </p>
                )}
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 p-4">
                <input
                  type="checkbox"
                  checked={isClassTeacher}
                  onChange={(e) =>
                    setIsClassTeacher(
                      e.target.checked
                    )
                  }
                />

                <div>
                  <p className="font-medium">
                    Class Teacher
                  </p>

                  <p className="text-sm text-gray-500">
                    Mark this teacher as the
                    class teacher for this class.
                  </p>
                </div>
              </label>

              <Button
                variant="primary"
                onClick={handleAssignClass}
                loading={assignmentLoading}
                disabled={
                  !selectedClassId ||
                  !selectedSessionId
                }
              >
                Assign Class
              </Button>
            </>
          )}
        </div>
      </Modal>

      {/* Deactivate Teacher Dialog */}
      <ConfirmDialog
        open={showDeactivateDialog}
        onClose={() =>
          setShowDeactivateDialog(false)
        }
        onConfirm={handleDeactivate}
        title="Deactivate Teacher"
        message={`Are you sure you want to deactivate ${selectedTeacher?.profile?.first_name} ${selectedTeacher?.profile?.last_name}?`}
        confirmText="Deactivate"
        danger
      />
    </div>
  );
}