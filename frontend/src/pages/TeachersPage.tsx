import DatePicker from '../components/ui/DatePicker';
import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/ui/Toast';
import { Teacher, Class, AcademicSession, Subject } from '../types';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Card from '../components/ui/Card';
import { StatusBadge } from '../components/ui/Badge';
import ConfirmDialog from '../components/ui/ConfirmDialog';

interface TeacherAssignmentData {
  teacher?: Teacher;
  classAssignments?: Array<{
    id: string;
    is_class_teacher?: boolean;
    class?: {
      id: string;
      name: string;
    };
    session?: {
      id: string;
      name: string;
    };
  }>;
  subjectAssignments?: Array<{
    id: string;
    subject?: {
      id: string;
      name: string;
    };
    class?: {
      id: string;
      name: string;
    };
    session?: {
      id: string;
      name: string;
    };
  }>;
}

export default function TeachersPage() {
  const { call } = useApi();
  const { showToast } = useToast();

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingAssignmentData, setLoadingAssignmentData] = useState(false);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [assignmentLoading, setAssignmentLoading] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [showActivateDialog, setShowActivateDialog] = useState(false);
  const [showAssignClassModal, setShowAssignClassModal] = useState(false);
  const [showAssignSubjectModal, setShowAssignSubjectModal] = useState(false);
  const [showAssignmentsModal, setShowAssignmentsModal] = useState(false);

  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [assignmentData, setAssignmentData] =
    useState<TeacherAssignmentData | null>(null);

  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
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
    address: '',
    date_hired: '',
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

    const [classesResult, subjectsResult, sessionsResult] =
      await Promise.all([
        call('/classes'),
        call('/subjects'),
        call('/sessions'),
      ]);

    if (!classesResult.success) {
      showToast(
        'error',
        classesResult.error || 'Failed to fetch classes'
      );
    }

    if (!subjectsResult.success) {
      showToast(
        'error',
        subjectsResult.error || 'Failed to fetch subjects'
      );
    }

    if (!sessionsResult.success) {
      showToast(
        'error',
        sessionsResult.error || 'Failed to fetch academic sessions'
      );
    }

    const availableClasses = extractArray<Class>(classesResult).filter(
      (item) => item.is_active
    );

    const availableSubjects = extractArray<Subject>(subjectsResult).filter(
      (item) => item.is_active
    );

    const availableSessions =
      extractArray<AcademicSession>(sessionsResult);

    setClasses(availableClasses);
    setSubjects(availableSubjects);
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

  const openAssignSubjectModal = async (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setSelectedSubjectId('');
    setSelectedClassId('');
    setSelectedSessionId('');
    setShowAssignSubjectModal(true);

    await fetchAssignmentData();
  };

  const openAssignmentsModal = async (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setAssignmentData(null);
    setShowAssignmentsModal(true);
    setLoadingAssignments(true);

    const result = await call(`/teachers/${teacher.id}`);

    if (result.success && result.data) {
      setAssignmentData(result.data);
    } else {
      showToast(
        'error',
        result.error || 'Failed to fetch teacher assignments'
      );
      setShowAssignmentsModal(false);
    }

    setLoadingAssignments(false);
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

  const handleAssignSubject = async () => {
    if (!selectedTeacher) {
      showToast('error', 'No teacher selected');
      return;
    }

    if (!selectedSubjectId) {
      showToast('error', 'Please select a subject');
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

    const result = await call('/teachers/assign-subject', {
      method: 'POST',
      body: {
        teacher_id: selectedTeacher.id,
        subject_id: selectedSubjectId,
        class_id: selectedClassId,
        session_id: selectedSessionId,
      },
    });

    if (result.success) {
      showToast(
        'success',
        'Teacher assigned to subject successfully'
      );

      setShowAssignSubjectModal(false);
      setSelectedTeacher(null);
      setSelectedSubjectId('');
      setSelectedClassId('');
      setSelectedSessionId('');
    } else {
      showToast(
        'error',
        result.error || 'Failed to assign teacher to subject'
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

    if (formData.password.length < 8) {
      showToast(
        'error',
        'Temporary password must be at least 8 characters'
      );
      return;
    }

    setSubmitting(true);

    const payload = {
      ...formData,
      address: formData.address || null,
      date_hired: formData.date_hired || null,
    };

    const result = await call('/teachers', {
      method: 'POST',
      body: payload,
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

    setSubmitting(true);

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
      setSelectedTeacher(null);
      fetchTeachers();
    } else {
      showToast(
        'error',
        result.error || 'Failed to deactivate teacher'
      );
    }

    setSubmitting(false);
  };

  const handleActivate = async () => {
    if (!selectedTeacher) return;

    setSubmitting(true);

    const result = await call(
      `/teachers/${selectedTeacher.id}/activate`,
      {
        method: 'POST',
      }
    );

    if (result.success) {
      showToast(
        'success',
        'Teacher activated successfully'
      );

      setShowActivateDialog(false);
      setSelectedTeacher(null);
      fetchTeachers();
    } else {
      showToast(
        'error',
        result.error || 'Failed to activate teacher'
      );
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
      qualification: '',
      specialization: '',
      address: '',
      date_hired: '',
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
        <div className="flex flex-wrap items-center gap-2">
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
            variant="primary"
            size="sm"
            onClick={() =>
              openAssignSubjectModal(teacher)
            }
            disabled={!teacher.is_active}
          >
            Assign Subject
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              openAssignmentsModal(teacher)
            }
          >
            Assignments
          </Button>

          {teacher.is_active ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedTeacher(teacher);
                setShowDeactivateDialog(true);
              }}
            >
              Deactivate
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedTeacher(teacher);
                setShowActivateDialog(true);
              }}
            >
              Activate
            </Button>
          )}
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
              Teacher will be prompted to change on first login.
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
              Address
            </label>

            <input
              className="form-input"
              value={formData.address}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  address: e.target.value,
                })
              }
              placeholder="Residential address"
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Date Hired
            </label>

            <input
              type="date"
              className="form-input"
              value={formData.date_hired}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  date_hired: e.target.value,
                })
              }
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
              Loading classes, subjects and academic sessions...
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
                    No academic sessions have been created yet.
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
                    No active classes have been created yet.
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
                    Mark this teacher as the class teacher for this class.
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

      {/* Assign Subject Modal */}
      <Modal
        open={showAssignSubjectModal}
        onClose={() =>
          setShowAssignSubjectModal(false)
        }
        title="Assign Teacher to Subject"
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
              Loading subjects, classes and academic sessions...
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
              </div>

              <div className="form-group">
                <label className="form-label">
                  Subject
                </label>

                <select
                  className="form-input"
                  value={selectedSubjectId}
                  onChange={(e) =>
                    setSelectedSubjectId(
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    Select subject
                  </option>

                  {subjects.map((subject) => (
                    <option
                      key={subject.id}
                      value={subject.id}
                    >
                      {subject.name}
                    </option>
                  ))}
                </select>

                {subjects.length === 0 && (
                  <p className="form-hint">
                    No active subjects have been created yet.
                  </p>
                )}
              </div>

              <Button
                variant="primary"
                onClick={handleAssignSubject}
                loading={assignmentLoading}
                disabled={
                  !selectedSubjectId ||
                  !selectedClassId ||
                  !selectedSessionId
                }
              >
                Assign Subject
              </Button>
            </>
          )}
        </div>
      </Modal>

      {/* Assignments Modal */}
      <Modal
        open={showAssignmentsModal}
        onClose={() =>
          setShowAssignmentsModal(false)
        }
        title="Teacher Assignments"
      >
        {loadingAssignments ? (
          <div className="py-8 text-center text-sm text-gray-500">
            Loading teacher assignments...
          </div>
        ) : (
          <div className="grid gap-6">
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

            <div>
              <h3 className="mb-3 font-semibold">
                Class Assignments
              </h3>

              {assignmentData?.classAssignments?.length ? (
                <div className="grid gap-2">
                  {assignmentData.classAssignments.map(
                    (assignment) => (
                      <div
                        key={assignment.id}
                        className="rounded-lg border border-gray-200 p-3"
                      >
                        <p className="font-medium">
                          {assignment.class?.name || 'Unknown class'}
                        </p>

                        <p className="text-sm text-gray-500">
                          {assignment.session?.name || 'Unknown session'}
                        </p>

                        {assignment.is_class_teacher && (
                          <p className="mt-1 text-sm font-medium text-blue-600">
                            Class Teacher
                          </p>
                        )}
                      </div>
                    )
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  No active class assignments.
                </p>
              )}
            </div>

            <div>
              <h3 className="mb-3 font-semibold">
                Subject Assignments
              </h3>

              {assignmentData?.subjectAssignments?.length ? (
                <div className="grid gap-2">
                  {assignmentData.subjectAssignments.map(
                    (assignment) => (
                      <div
                        key={assignment.id}
                        className="rounded-lg border border-gray-200 p-3"
                      >
                        <p className="font-medium">
                          {assignment.subject?.name || 'Unknown subject'}
                        </p>

                        <p className="text-sm text-gray-500">
                          Class: {assignment.class?.name || 'Unknown class'}
                        </p>

                        <p className="text-sm text-gray-500">
                          Session: {assignment.session?.name || 'Unknown session'}
                        </p>
                      </div>
                    )
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  No active subject assignments.
                </p>
              )}
            </div>
          </div>
        )}
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

      {/* Activate Teacher Dialog */}
      <ConfirmDialog
        open={showActivateDialog}
        onClose={() =>
          setShowActivateDialog(false)
        }
        onConfirm={handleActivate}
        title="Activate Teacher"
        message={`Are you sure you want to activate ${selectedTeacher?.profile?.first_name} ${selectedTeacher?.profile?.last_name}?`}
        confirmText="Activate"
      />
    </div>
  );
}



