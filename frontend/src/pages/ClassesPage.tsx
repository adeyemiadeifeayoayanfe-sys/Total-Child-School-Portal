import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/ui/Toast';
import { Class, Subject, AcademicSession } from '../types';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Card from '../components/ui/Card';
import { StatusBadge } from '../components/ui/Badge';
import ConfirmDialog from '../components/ui/ConfirmDialog';

interface ClassDetails extends Class {
enrollments?: Array<{
id: string;
student?: {
id: string;
first_name?: string;
last_name?: string;
admission_number?: string;
};
session?: {
id: string;
name?: string;
};
unenrolled_at?: string | null;
}>;
teacher_class_assignments?: Array<{
id: string;
is_class_teacher?: boolean;
teacher?: {
id: string;
profile?: {
first_name?: string;
last_name?: string;
};
};
}>;
class_subject_assignments?: Array<{
id: string;
subject?: Subject;
session?: AcademicSession;
}>;
}

export default function ClassesPage() {
const { call } = useApi();
const { showToast } = useToast();

const [classes, setClasses] = useState<Class[]>([]);
const [subjects, setSubjects] = useState<Subject[]>([]);
const [sessions, setSessions] = useState<AcademicSession[]>([]);

const [loading, setLoading] = useState(true);
const [loadingDetails, setLoadingDetails] = useState(false);
const [submitting, setSubmitting] = useState(false);

const [showCreateModal, setShowCreateModal] = useState(false);
const [showEditModal, setShowEditModal] = useState(false);
const [showAssignSubjectModal, setShowAssignSubjectModal] = useState(false);
const [showDetailsModal, setShowDetailsModal] = useState(false);
const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
const [showActivateDialog, setShowActivateDialog] = useState(false);

const [selectedClass, setSelectedClass] = useState<Class | null>(null);
const [classDetails, setClassDetails] = useState<ClassDetails | null>(null);

const [formData, setFormData] = useState({
name: '',
description: '',
});

const [editData, setEditData] = useState({
name: '',
description: '',
is_active: true,
});

const [subjectForm, setSubjectForm] = useState({
subject_id: '',
session_id: '',
});

const resetCreateForm = () => {
setFormData({
name: '',
description: '',
});
};

const resetSubjectForm = () => {
setSubjectForm({
subject_id: '',
session_id: '',
});
};

const fetchClasses = useCallback(async () => {
setLoading(true);


const result = await call('/classes');

if (result.success && result.data) {
  setClasses(result.data);
} else if (!result.success) {
  showToast('error', result.error || 'Failed to fetch classes');
}

setLoading(false);


}, [call, showToast]);

const fetchSupportData = useCallback(async () => {
const [subjectsResult, sessionsResult] = await Promise.all([
call('/subjects'),
call('/sessions'),
]);


if (subjectsResult.success && subjectsResult.data) {
  setSubjects(subjectsResult.data);
}

if (sessionsResult.success && sessionsResult.data) {
  setSessions(sessionsResult.data);
}


}, [call]);

useEffect(() => {
fetchClasses();
fetchSupportData();
}, [fetchClasses, fetchSupportData]);

const handleCreate = async () => {
const name = formData.name.trim();


if (!name) {
  showToast('error', 'Class name is required');
  return;
}

if (name.length < 2) {
  showToast('error', 'Class name must be at least 2 characters');
  return;
}

setSubmitting(true);

const result = await call('/classes', {
  method: 'POST',
  body: {
    name,
    description: formData.description.trim() || null,
  },
});

if (result.success) {
  showToast('success', 'Class created successfully');
  setShowCreateModal(false);
  resetCreateForm();
  await fetchClasses();
} else {
  showToast('error', result.error || 'Failed to create class');
}

setSubmitting(false);


};

const openEditModal = (cls: Class) => {
setSelectedClass(cls);


setEditData({
  name: cls.name || '',
  description: cls.description || '',
  is_active: cls.is_active ?? true,
});

setShowEditModal(true);


};

const handleUpdate = async () => {
if (!selectedClass) return;


const name = editData.name.trim();

if (!name) {
  showToast('error', 'Class name is required');
  return;
}

setSubmitting(true);

const result = await call(`/classes/${selectedClass.id}`, {
  method: 'PUT',
  body: {
    name,
    description: editData.description.trim() || null,
    is_active: editData.is_active,
  },
});

if (result.success) {
  showToast('success', 'Class updated successfully');
  setShowEditModal(false);
  setSelectedClass(null);
  await fetchClasses();
} else {
  showToast('error', result.error || 'Failed to update class');
}

setSubmitting(false);


};

const openDetailsModal = async (cls: Class) => {
setSelectedClass(cls);
setClassDetails(null);
setShowDetailsModal(true);
setLoadingDetails(true);


const result = await call(`/classes/${cls.id}`);

if (result.success && result.data) {
  setClassDetails(result.data);
} else {
  showToast('error', result.error || 'Failed to load class details');
  setShowDetailsModal(false);
}

setLoadingDetails(false);


};

const openAssignSubjectModal = (cls: Class) => {
setSelectedClass(cls);
resetSubjectForm();
setShowAssignSubjectModal(true);
};

const handleAssignSubject = async () => {
if (!selectedClass) return;


if (!subjectForm.subject_id) {
  showToast('error', 'Please select a subject');
  return;
}

if (!subjectForm.session_id) {
  showToast('error', 'Please select an academic session');
  return;
}

setSubmitting(true);

const result = await call('/classes/assign-subject', {
  method: 'POST',
  body: {
    class_id: selectedClass.id,
    subject_id: subjectForm.subject_id,
    session_id: subjectForm.session_id,
  },
});

if (result.success) {
  showToast('success', 'Subject assigned to class successfully');
  setShowAssignSubjectModal(false);
  resetSubjectForm();
  setSelectedClass(null);
} else {
  showToast(
    'error',
    result.error || 'Failed to assign subject to class'
  );
}

setSubmitting(false);


};

const handleDeactivate = async () => {
if (!selectedClass) return;


setSubmitting(true);

const result = await call(`/classes/${selectedClass.id}`, {
  method: 'PUT',
  body: {
    is_active: false,
  },
});

if (result.success) {
  showToast('success', 'Class deactivated successfully');
  setShowDeactivateDialog(false);
  setSelectedClass(null);
  await fetchClasses();
} else {
  showToast(
    'error',
    result.error || 'Failed to deactivate class'
  );
}

setSubmitting(false);


};

const handleActivate = async () => {
if (!selectedClass) return;


setSubmitting(true);

const result = await call(`/classes/${selectedClass.id}`, {
  method: 'PUT',
  body: {
    is_active: true,
  },
});

if (result.success) {
  showToast('success', 'Class activated successfully');
  setShowActivateDialog(false);
  setSelectedClass(null);
  await fetchClasses();
} else {
  showToast(
    'error',
    result.error || 'Failed to activate class'
  );
}

setSubmitting(false);


};

const getStudentCount = (cls: Class) => {
return cls.student_count ?? 0;
};

const getSubjectName = (subject?: Subject) => {
if (!subject) return 'Unknown subject';


return (
  (subject as Subject & { name?: string }).name ||
  'Unnamed subject'
);


};

const activeSessions = sessions.filter(
(session) =>
(session as AcademicSession & { is_active?: boolean }).is_active !==
false
);

const activeSubjects = subjects.filter(
(subject) =>
(subject as Subject & { is_active?: boolean }).is_active !== false
);

const columns = [
{
key: 'name',
header: 'Class Name',
render: (cls: Class) => ( <span className="font-semibold">{cls.name}</span>
),
},
{
key: 'description',
header: 'Description',
render: (cls: Class) => cls.description || '—',
},
{
key: 'students',
header: 'Students',
render: (cls: Class) => ( <span>{getStudentCount(cls)}</span>
),
},
{
key: 'status',
header: 'Status',
render: (cls: Class) => (
<StatusBadge
status={cls.is_active ? 'active' : 'inactive'}
/>
),
},
{
key: 'actions',
header: 'Actions',
render: (cls: Class) => ( <div className="flex flex-wrap gap-2">
<Button
variant="secondary"
size="sm"
onClick={() => openDetailsModal(cls)}
>
View </Button>


      <Button
        variant="secondary"
        size="sm"
        onClick={() => openEditModal(cls)}
      >
        Edit
      </Button>

      <Button
        variant="secondary"
        size="sm"
        onClick={() => openAssignSubjectModal(cls)}
      >
        Assign Subject
      </Button>

      {cls.is_active ? (
        <Button
                    size="sm"
          onClick={() => {
            setSelectedClass(cls);
            setShowDeactivateDialog(true);
          }}
        >
          Deactivate
        </Button>
      ) : (
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setSelectedClass(cls);
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

return ( <div> <div className="page-header"> <div> <h1 className="page-title">Classes</h1> <p className="page-description">
Manage classes, rosters, and subject assignments </p> </div>


    <div className="page-actions">
      <Button
        variant="primary"
        onClick={() => {
          resetCreateForm();
          setShowCreateModal(true);
        }}
      >
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
    onClose={() => {
      if (!submitting) {
        setShowCreateModal(false);
      }
    }}
    title="Create New Class"
  >
    <div className="grid gap-4">
      <div className="form-group">
        <label className="form-label">Class Name</label>
        <input
          className="form-input"
          value={formData.name}
          onChange={(e) =>
            setFormData({
              ...formData,
              name: e.target.value,
            })
          }
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
          onChange={(e) =>
            setFormData({
              ...formData,
              description: e.target.value,
            })
          }
          placeholder="Optional class description"
        />
      </div>

      <Button
        variant="primary"
        onClick={handleCreate}
        loading={submitting}
      >
        Create Class
      </Button>
    </div>
  </Modal>

  <Modal
    open={showEditModal}
    onClose={() => {
      if (!submitting) {
        setShowEditModal(false);
      }
    }}
    title="Edit Class"
  >
    <div className="grid gap-4">
      <div className="form-group">
        <label className="form-label">Class Name</label>
        <input
          className="form-input"
          value={editData.name}
          onChange={(e) =>
            setEditData({
              ...editData,
              name: e.target.value,
            })
          }
        />
      </div>

      <div className="form-group">
        <label className="form-label">Description</label>
        <textarea
          className="form-textarea"
          rows={3}
          value={editData.description}
          onChange={(e) =>
            setEditData({
              ...editData,
              description: e.target.value,
            })
          }
        />
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={editData.is_active}
          onChange={(e) =>
            setEditData({
              ...editData,
              is_active: e.target.checked,
            })
          }
        />
        <span>Class is active</span>
      </label>

      <Button
        variant="primary"
        onClick={handleUpdate}
        loading={submitting}
      >
        Save Changes
      </Button>
    </div>
  </Modal>

  <Modal
    open={showAssignSubjectModal}
    onClose={() => {
      if (!submitting) {
        setShowAssignSubjectModal(false);
      }
    }}
    title={
      selectedClass
        ? `Assign Subject — ${selectedClass.name}`
        : 'Assign Subject'
    }
  >
    <div className="grid gap-4">
      <div className="form-group">
        <label className="form-label">Subject</label>
        <select
          className="form-input"
          value={subjectForm.subject_id}
          onChange={(e) =>
            setSubjectForm({
              ...subjectForm,
              subject_id: e.target.value,
            })
          }
        >
          <option value="">Select subject</option>

          {activeSubjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {(subject as Subject & { name?: string }).name ||
                'Unnamed subject'}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Academic Session</label>
        <select
          className="form-input"
          value={subjectForm.session_id}
          onChange={(e) =>
            setSubjectForm({
              ...subjectForm,
              session_id: e.target.value,
            })
          }
        >
          <option value="">Select session</option>

          {activeSessions.map((session) => (
            <option key={session.id} value={session.id}>
              {session.name}
            </option>
          ))}
        </select>
      </div>

      <Button
        variant="primary"
        onClick={handleAssignSubject}
        loading={submitting}
      >
        Assign Subject
      </Button>
    </div>
  </Modal>

  <Modal
    open={showDetailsModal}
    onClose={() => setShowDetailsModal(false)}
    title={
      classDetails
        ? `${classDetails.name} Details`
        : 'Class Details'
    }
  >
    {loadingDetails ? (
      <div className="py-8 text-center">
        Loading class details...
      </div>
    ) : classDetails ? (
      <div className="grid gap-6">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border p-4">
            <div className="text-sm text-gray-500">
              Status
            </div>

            <div className="mt-1">
              <StatusBadge
                status={
                  classDetails.is_active
                    ? 'active'
                    : 'inactive'
                }
              />
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="text-sm text-gray-500">
              Students
            </div>

            <div className="mt-1 text-xl font-semibold">
              {classDetails.enrollments?.filter(
                (enrollment) => !enrollment.unenrolled_at
              ).length || 0}
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="text-sm text-gray-500">
              Subjects
            </div>

            <div className="mt-1 text-xl font-semibold">
              {classDetails.class_subject_assignments?.length ||
                0}
            </div>
          </div>
        </div>

        <div>
          <h3 className="mb-3 font-semibold">
            Assigned Teachers
          </h3>

          {classDetails.teacher_class_assignments?.length ? (
            <div className="grid gap-2">
              {classDetails.teacher_class_assignments.map(
                (assignment) => (
                  <div
                    key={assignment.id}
                    className="rounded-lg border p-3"
                  >
                    <div className="font-medium">
                      {assignment.teacher?.profile?.first_name ||
                        ''}{' '}
                      {assignment.teacher?.profile?.last_name ||
                        ''}
                    </div>

                    {assignment.is_class_teacher && (
                      <div className="text-sm text-gray-500">
                        Class Teacher
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              No teachers assigned to this class.
            </p>
          )}
        </div>

        <div>
          <h3 className="mb-3 font-semibold">
            Assigned Subjects
          </h3>

          {classDetails.class_subject_assignments?.length ? (
            <div className="grid gap-2">
              {classDetails.class_subject_assignments.map(
                (assignment) => (
                  <div
                    key={assignment.id}
                    className="rounded-lg border p-3"
                  >
                    <div className="font-medium">
                      {getSubjectName(assignment.subject)}
                    </div>

                    {assignment.session?.name && (
                      <div className="text-sm text-gray-500">
                        {assignment.session.name}
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              No subjects assigned to this class.
            </p>
          )}
        </div>

        <div>
          <h3 className="mb-3 font-semibold">
            Student Roster
          </h3>

          {classDetails.enrollments?.filter(
            (enrollment) => !enrollment.unenrolled_at
          ).length ? (
            <div className="grid gap-2">
              {classDetails.enrollments
                ?.filter(
                  (enrollment) =>
                    !enrollment.unenrolled_at
                )
                .map((enrollment) => (
                  <div
                    key={enrollment.id}
                    className="rounded-lg border p-3"
                  >
                    <div className="font-medium">
                      {enrollment.student?.first_name || ''}{' '}
                      {enrollment.student?.last_name || ''}
                    </div>

                    {enrollment.student?.admission_number && (
                      <div className="text-sm text-gray-500">
                        {enrollment.student.admission_number}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              No students are currently enrolled in this class.
            </p>
          )}
        </div>
      </div>
    ) : (
      <div className="py-8 text-center text-gray-500">
        No class details available.
      </div>
    )}
  </Modal>

  <ConfirmDialog
    open={showDeactivateDialog}
    onClose={() => {
      if (!submitting) {
        setShowDeactivateDialog(false);
      }
    }}
    onConfirm={handleDeactivate}
    title="Deactivate Class"
    message={
      selectedClass
        ? `Are you sure you want to deactivate ${selectedClass.name}?`
        : 'Are you sure you want to deactivate this class?'
    }
    confirmText="Deactivate"
        loading={submitting}
  />

  <ConfirmDialog
    open={showActivateDialog}
    onClose={() => {
      if (!submitting) {
        setShowActivateDialog(false);
      }
    }}
    onConfirm={handleActivate}
    title="Activate Class"
    message={
      selectedClass
        ? `Are you sure you want to activate ${selectedClass.name}?`
        : 'Are you sure you want to activate this class?'
    }
    confirmText="Activate"
    loading={submitting}
  />
</div>


);
}





