import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import { Attendance, Class } from '../types';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { StatusBadge } from '../components/ui/Badge';
import { LoadingContainer } from '../components/ui/Spinner';

export default function AttendancePage() {
  const { call } = useApi();
  const { showToast } = useToast();
  const { user } = useAuth();

  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [attendanceRecords, setAttendanceRecords] = useState<Attendance[]>([]);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [takingAttendance, setTakingAttendance] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [attendanceForm, setAttendanceForm] = useState<Record<string, string>>({});

  const isTeacher = user?.role === 'teacher';

  const fetchClasses = useCallback(async () => {
    const endpoint = isTeacher ? '/teachers/my/classes' : '/classes';
    const result = await call(endpoint);
    if (result.success && result.data) {
      if (isTeacher) {
        const classList = result.data.map((item: any) => item.class);
        setClasses(classList);
      } else {
        setClasses(result.data);
      }
    }
  }, [call, isTeacher]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const fetchAttendance = useCallback(async () => {
    if (!selectedClass) return;
    setLoading(true);
    const result = await call(`/attendance/class/${selectedClass}?date=${attendanceDate}`);
    if (result.success && result.data) {
      setAttendanceRecords(result.data);
    }
    setLoading(false);
  }, [call, selectedClass, attendanceDate]);

  useEffect(() => {
    if (selectedClass) {
      fetchAttendance();
    }
  }, [selectedClass, attendanceDate, fetchAttendance]);

  const fetchStudentsForAttendance = async () => {
    if (!selectedClass) return;

    const sessionResult = await call('/sessions/current');
    if (!sessionResult.success || !sessionResult.data) {
      showToast('error', 'Could not find current session');
      return;
    }

    const rosterResult = await call(`/classes/${selectedClass}/roster?session_id=${sessionResult.data.id}`);
    if (rosterResult.success && rosterResult.data) {
      const studentList = rosterResult.data.map((enrollment: any) => enrollment.student);
      setStudents(studentList);

      const form: Record<string, string> = {};
      studentList.forEach((student: any) => {
        form[student.id] = 'present';
      });
      setAttendanceForm(form);
      setTakingAttendance(true);
    }
  };

  const submitAttendance = async () => {
    const sessionResult = await call('/sessions/current');
    if (!sessionResult.success || !sessionResult.data) {
      showToast('error', 'Could not find current session');
      return;
    }

    const termResult = await call('/sessions/current-term');
    if (!termResult.success || !termResult.data) {
      showToast('error', 'Could not find current term');
      return;
    }

    const records = Object.entries(attendanceForm).map(([student_id, status]) => ({
      student_id,
      status,
    }));

    const result = await call('/attendance', {
      method: 'POST',
      body: {
        class_id: selectedClass,
        session_id: sessionResult.data.id,
        term_id: termResult.data.id,
        attendance_date: attendanceDate,
        records,
      },
    });

    if (result.success) {
      showToast('success', 'Attendance recorded successfully');
      setTakingAttendance(false);
      fetchAttendance();
    } else {
      showToast('error', result.error || 'Failed to record attendance');
    }
  };

  const statusOptions = ['present', 'absent', 'late', 'excused'];
  const statusLabels: Record<string, string> = {
    present: 'Present',
    absent: 'Absent',
    late: 'Late',
    excused: 'Excused',
  };

  const columns = [
    {
      key: 'student',
      header: 'Student',
      render: (record: Attendance) => {
        const student = record.student;
        return `${student?.first_name || ''} ${student?.last_name || ''}`;
      },
    },
    {
      key: 'date',
      header: 'Date',
      render: (record: Attendance) => record.attendance_date,
    },
    {
      key: 'status',
      header: 'Status',
      render: (record: Attendance) => <StatusBadge status={record.status} />,
    },
    {
      key: 'remarks',
      header: 'Remarks',
      render: (record: Attendance) => record.remarks || '—',
    },
  ];

  if (takingAttendance) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Take Attendance</h1>
            <p className="page-description">
              Mark attendance for {new Date(attendanceDate).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
          <div className="page-actions">
            <Button variant="secondary" onClick={() => setTakingAttendance(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submitAttendance}>
              Save Attendance
            </Button>
          </div>
        </div>

        <Card>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Student</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student: any) => (
                  <tr key={student.id}>
                    <td>
                      <div className="font-medium">{student.first_name} {student.last_name}</div>
                      <div className="text-xs text-gray-400">{student.admission_number}</div>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        {statusOptions.map((status) => (
                          <button
                            key={status}
                            className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                              attendanceForm[student.id] === status
                                ? 'bg-primary-600 text-white shadow-sm'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                            onClick={() =>
                              setAttendanceForm({ ...attendanceForm, [student.id]: status })
                            }
                          >
                            {statusLabels[status]}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance</h1>
          <p className="page-description">Daily attendance tracking and history</p>
        </div>
        <div className="page-actions">
          <input
            type="date"
            className="form-input"
            value={attendanceDate}
            onChange={(e) => setAttendanceDate(e.target.value)}
            style={{ maxWidth: '180px' }}
          />
          {isTeacher && (
            <Button variant="primary" onClick={fetchStudentsForAttendance} disabled={!selectedClass}>
              Take Attendance
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4">
        <Card title="Select Class" subtitle="Choose a class to view or take attendance">
          <select
            className="form-select"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
          >
            <option value="">Select a class...</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>{cls.name}</option>
            ))}
          </select>
        </Card>

        {selectedClass && (
          <Card 
            title={`Attendance for ${new Date(attendanceDate).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}`}
          >
            <Table
              columns={columns}
              data={attendanceRecords}
              loading={loading}
              emptyMessage="No attendance records for this date"
            />
          </Card>
        )}
      </div>
    </div>
  );
}