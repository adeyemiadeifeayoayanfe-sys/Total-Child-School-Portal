import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/ui/Toast';
import { Student, Class, AcademicSession } from '../types';
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
  const [classes, setClasses] = useState<Class[]>([]);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);

  const [loading, setLoading] = useState(true);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [loadingAssignmentData, setLoadingAssignmentData] = useState(false);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignClassModal, setShowAssignClassModal] = useState(false);

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const [showArchiveDialog, setShowArchiveDialog] = useState(false);

  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState('');

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

  /*
   * Some API endpoints return an array directly while others return
   * an object containing a data array. This helper keeps the page
   * tolerant of either response shape.
   */
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
    } else {
      showToast(
        'error',
        result.error || 'Failed to load students'
      );
    }

    setLoading(false);
  }, [page, search, call, showToast]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  /*
   * Load classes and academic sessions for the assignment modal.
   */
  const fetchAssignmentData = useCallback(async () => {
    setLoadingAssignmentData(true);

    const [classesResult, sessionsResult] = await Promise.all([
      call('/classes'),
      call('/sessions'),
    ]);

    if (classesResult.success) {
      const classList = extractArray<Class>(classesResult);

      setClasses(
        classList.filter((item) => item.is_active)
      );
    } else {
      showToast(
        'error',
        classesResult.error || 'Failed to load classes'
      );
    }

    if (sessionsResult.success) {
      const sessionList = extractArray<AcademicSession>(
        sessionsResult
      );

      setSessions(sessionList);

      /*
       * Automatically select the current academic session.
       */
      const currentSession = sessionList.find(
        (session) => session.is_current
      );

      if (currentSession) {
        setSelectedSessionId(currentSession.id);
      } else if (sessionList.length > 0) {
        setSelectedSessionId(sessionList[0].id);
      }
    } else {
      showToast(
        'error',
        sessionsResult.error || 'Failed to load academic sessions'
      );
    }

    setLoadingAssignmentData(false);
  }, [call, showToast]);

  const openAssignClassModal = (student: Student) => {
    setSelectedStudent(student);
    setSelectedClassId(student.current_class_id || '');
    setSelectedSessionId('');
    setShowAssignClassModal(true);

    fetchAssignmentData();
  };

  const handleAssignClass = async () => {
    if (!selectedStudent) {
      showToast('error', 'No student selected');
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

    const result = await call('/students/assign-class', {
      method: 'POST',
      body: {
        student_id: selectedStudent.id,
        class_id: selectedClassId,
        session_id: selectedSessionId,
      },
    });

    if (result.success) {
      showToast(
        'success',
        `${selectedStudent.first_name} ${selectedStudent.last_name} assigned to class successfully`
      );

      setShowAssignClassModal(false);
      setSelectedStudent(null);
      setSelectedClassId('');
      setSelectedSessionId('');

      await fetchStudents();
    } else {
      showToast(
        'error',
        result.error || 'Failed to assign student to class'
      );
    }

    setAssignmentLoading(false);
  };

  const handleCreate = async () => {
    if (
      !formData.admission_number ||
      !formData.first_name ||
      !formData.last_name ||
      !formData.date_of_birth
    ) {
      showToast(
        'error',
        'Please fill in all required fields'
      );
      return;
    }

    setSubmitting(true);

    const result = await call('/students', {
      method: 'POST',
      body: formData,
    });

    if (result.success) {
      showToast(
        'success',
        'Student created successfully'
      );

      setShowCreateModal(false);
      resetForm();
      await fetchStudents();
    } else {
      showToast(
        'error',
        result.error || 'Failed to create student'
      );
    }

    setSubmitting(false);
  };

  const handleEdit = async () => {
    if (!selectedStudent) return;

    setSubmitting(true);

    const result = await call(
      `/students/${selectedStudent.id}`,
      {
        method: 'PUT',
        body: formData,
      }
    );

    if (result.success) {
      showToast(
        'success',
        'Student updated successfully'
      );

      setShowEditModal(false);
      await fetchStudents();
    } else {
      showToast(
        'error',
        result.error || 'Failed to update student'
      );
    }

    setSubmitting(false);
  };

  const handleArchive = async () => {
    if (!selectedStudent) return;

    const result = await call(
      `/students/${selectedStudent.id}/archive`,
      {
        method: 'POST',
      }
    );

    if (result.success) {
      showToast(
        'success',
        'Student archived successfully'
      );

      setShowArchiveDialog(false);
      await fetchStudents();
    } else {
      showToast(
        'error',
        result.error || 'Failed to archive student'
      );
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
        <span className="font-semibold">
          {student.admission_number}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (student: Student) =>
        `${student.first_name} ${student.last_name}`,
    },
    {
      key: 'gender',
      header: 'Gender',
      render: (student: Student) => (
        <span className="capitalize">
          {student.gender}
        </span>
      ),
    },
    {
      key: 'class',
      header: 'Class',
      render: (student: Student) => (
        <span>
          {student.current_class?.name || 'Not assigned'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (student: Student) => (
        <StatusBadge status={student.status} />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (student: Student) => (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() =>
              openAssignClassModal(student)
            }
          >
            {student.current_class
              ? 'Change Class'
              : 'Assign Class'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              openEditModal(student)
            }
          >
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
          <h1 className="page-title">
            Students
          </h1>

          <p className="page-description">
            Manage all student records
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
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            style={{ maxWidth: '400px' }}
          />

          {search && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSearch('');
                setPage(1);
              }}
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
              onClick={() =>
                setPage((p) => p - 1)
              }
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
              onClick={() =>
                setPage((p) => p + 1)
              }
            >
              Next
            </Button>
          </div>
        )}
      </Card>

      {/* =========================
          CREATE STUDENT MODAL
          ========================= */}

      <Modal
        open={showCreateModal}
        onClose={() =>
          setShowCreateModal(false)
        }
        title="Add New Student"
      >
        <div className="grid gap-4">
          <div className="form-group">
            <label className="form-label">
              Admission Number
            </label>

            <input
              className="form-input"
              value={formData.admission_number}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  admission_number:
                    e.target.value,
                })
              }
              placeholder="e.g., 2024-001"
              autoFocus
            />
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
                    first_name:
                      e.target.value,
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
                    last_name:
                      e.target.value,
                  })
                }
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              Middle Name
            </label>

            <input
              className="form-input"
              value={formData.middle_name}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  middle_name:
                    e.target.value,
                })
              }
              placeholder="Optional"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">
                Date of Birth
              </label>

              <input
                type="date"
                className="form-input"
                value={formData.date_of_birth}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    date_of_birth:
                      e.target.value,
                  })
                }
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Gender
              </label>

              <select
                className="form-select"
                value={formData.gender}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    gender:
                      e.target.value,
                  })
                }
              >
                <option value="male">
                  Male
                </option>

                <option value="female">
                  Female
                </option>

                <option value="other">
                  Other
                </option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
                Email
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
                placeholder="student@example.com"
              />
            </div>
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
            />
          </div>

          <Button
            variant="primary"
            onClick={handleCreate}
            loading={submitting}
          >
            Create Student
          </Button>
        </div>
      </Modal>

      {/* =========================
          EDIT STUDENT MODAL
          ========================= */}

      <Modal
        open={showEditModal}
        onClose={() =>
          setShowEditModal(false)
        }
        title="Edit Student"
      >
        <div className="grid gap-4">
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
                    first_name:
                      e.target.value,
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
                    last_name:
                      e.target.value,
                  })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Email
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
              />
            </div>
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
                  address:
                    e.target.value,
                })
              }
            />
          </div>

          <Button
            variant="primary"
            onClick={handleEdit}
            loading={submitting}
          >
            Update Student
          </Button>
        </div>
      </Modal>

      {/* =========================
          ASSIGN CLASS MODAL
          ========================= */}

      <Modal
        open={showAssignClassModal}
        onClose={() => {
          if (!assignmentLoading) {
            setShowAssignClassModal(false);
          }
        }}
        title="Assign Student to Class"
      >
        <div className="grid gap-4">
          {selectedStudent && (
            <div className="p-4 rounded-lg border bg-gray-50">
              <div className="text-sm text-gray-500">
                Student
              </div>

              <div className="font-semibold text-lg">
                {selectedStudent.first_name}{' '}
                {selectedStudent.middle_name
                  ? `${selectedStudent.middle_name} `
                  : ''}
                {selectedStudent.last_name}
              </div>

              <div className="text-sm text-gray-600 mt-1">
                Admission No.:{' '}
                {selectedStudent.admission_number}
              </div>

              <div className="text-sm text-gray-600 mt-1">
                Current Class:{' '}
                {selectedStudent.current_class?.name ||
                  'Not assigned'}
              </div>
            </div>
          )}

          {loadingAssignmentData ? (
            <div className="py-8 text-center text-gray-500">
              Loading classes and academic sessions...
            </div>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">
                  Academic Session
                </label>

                <select
                  className="form-select"
                  value={selectedSessionId}
                  onChange={(e) =>
                    setSelectedSessionId(
                      e.target.value
                    )
                  }
                  disabled={assignmentLoading}
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
                  className="form-select"
                  value={selectedClassId}
                  onChange={(e) =>
                    setSelectedClassId(
                      e.target.value
                    )
                  }
                  disabled={assignmentLoading}
                >
                  <option value="">
                    Select class
                  </option>

                  {classes.map((schoolClass) => (
                    <option
                      key={schoolClass.id}
                      value={schoolClass.id}
                    >
                      {schoolClass.name}
                    </option>
                  ))}
                </select>
              </div>

              {classes.length === 0 && (
                <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">
                  No active classes are available.
                  Create or activate a class before
                  assigning this student.
                </div>
              )}

              {sessions.length === 0 && (
                <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">
                  No academic sessions are available.
                  Create an academic session before
                  assigning this student.
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="secondary"
                  onClick={() =>
                    setShowAssignClassModal(false)
                  }
                  disabled={assignmentLoading}
                >
                  Cancel
                </Button>

                <Button
                  variant="primary"
                  onClick={handleAssignClass}
                  loading={assignmentLoading}
                  disabled={
                    classes.length === 0 ||
                    sessions.length === 0
                  }
                >
                  Assign Class
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* =========================
          ARCHIVE CONFIRMATION
          ========================= */}

      <ConfirmDialog
        open={showArchiveDialog}
        onClose={() =>
          setShowArchiveDialog(false)
        }
        onConfirm={handleArchive}
        title="Archive Student"
        message={`Are you sure you want to archive ${selectedStudent?.first_name} ${selectedStudent?.last_name}? This will remove them from active rosters.`}
        confirmText="Archive"
        danger
      />
    </div>
  );
}