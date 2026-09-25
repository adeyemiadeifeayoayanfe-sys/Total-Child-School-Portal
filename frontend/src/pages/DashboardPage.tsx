import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import {
  AdminDashboardData,
  TeacherDashboardData,
  ParentDashboardData,
} from '../types';
import { LoadingContainer } from '../components/ui/Spinner';
import Card from '../components/ui/Card';

export default function DashboardPage() {
  const { user, activeRole } = useAuth();
  const { call } = useApi();
  const navigate = useNavigate();

  const currentRole = activeRole || user?.role || null;

  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchDashboard() {
      if (!currentRole) {
        setDashboardData(null);
        setDashboardError('No active role is available.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setDashboardData(null);
      setDashboardError(null);

      const endpoint =
        currentRole === 'teacher'
          ? '/dashboard/teacher'
          : currentRole === 'parent'
            ? '/dashboard/parent'
            : '/dashboard/admin';

      try {
        const result = await call(endpoint);

        if (cancelled) return;

        if (result.success && result.data) {
          setDashboardData(result.data);
        } else {
          setDashboardData(null);
          setDashboardError(
            result.error || 'Unable to load dashboard data.'
          );
        }
      } catch (error: any) {
        if (cancelled) return;

        setDashboardData(null);
        setDashboardError(
          error?.message || 'Unable to load dashboard data.'
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchDashboard();

    return () => {
      cancelled = true;
    };
  }, [currentRole, call]);

  if (loading) {
    return <LoadingContainer text="Loading dashboard..." />;
  }

  if (dashboardError) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">ER</div>
        <div className="empty-state-title">
          Unable to load dashboard
        </div>
        <p>{dashboardError}</p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => window.location.reload()}
          style={{ marginTop: '1rem' }}
        >
          Reload Dashboard
        </button>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">DB</div>
        <div className="empty-state-title">
          No dashboard data available
        </div>
      </div>
    );
  }

  if (
    currentRole === 'admin' ||
    currentRole === 'super_admin'
  ) {
    const data = dashboardData as Partial<AdminDashboardData> & {
      today_attendance?: {
        present?: number;
        total?: number;
      };
      today_payments?: {
        total?: number;
        count?: number;
      };
    };

    const todayAttendance = data.today_attendance || { present: 0, total: 0 };
    const todayPayments = data.today_payments || { total: 0, count: 0 };

    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-description">
              Welcome back, {user?.profile?.first_name || 'User'}! Here&apos;s what&apos;s
              happening today.
            </p>
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="stat-card">
            <div className="stat-icon stat-icon-blue">ST</div>
            <div className="stat-content">
              <h3>{data.students ?? 0}</h3>
              <p>Students</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-icon-green">TE</div>
            <div className="stat-content">
              <h3>{data.teachers ?? 0}</h3>
              <p>Teachers</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-icon-yellow">PR</div>
            <div className="stat-content">
              <h3>{data.parents ?? 0}</h3>
              <p>Parents</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-icon-red">CL</div>
            <div className="stat-content">
              <h3>{data.classes ?? 0}</h3>
              <p>Classes</p>
            </div>
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="stat-card">
            <div className="stat-icon stat-icon-green">AT</div>
            <div className="stat-content">
              <h3>
                {todayAttendance.present ?? 0}/
                {todayAttendance.total ?? 0}
              </h3>
              <p>Present Today</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-icon-yellow">BR</div>
            <div className="stat-content">
              <h3>{data.pending_broadsheets ?? 0}</h3>
              <p>Pending Broadsheets</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-icon-blue">RS</div>
            <div className="stat-content">
              <h3>{data.generated_results ?? 0}</h3>
              <p>Generated Results</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-icon-red">PY</div>
            <div className="stat-content">
              <h3>
                ?{Number(todayPayments.total ?? 0).toLocaleString()}
              </h3>
              <p>
                Today&apos;s Payments ({todayPayments.count ?? 0})
              </p>
            </div>
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="stat-card">
            <div className="stat-icon stat-icon-blue">CS</div>
            <div className="stat-content">
              <h3>
                ?{Number(data.cashbook_balance ?? 0).toLocaleString()}
              </h3>
              <p>Cashbook Balance</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-icon-yellow">RC</div>
            <div className="stat-content">
              <h3>{data.receipt_queue ?? 0}</h3>
              <p>Receipt Queue</p>
            </div>
          </div>
        </div>

        <div className="dashboard-grid">
          <button
            type="button"
            className="stat-card"
            onClick={() => navigate('/notifications')}
            style={{
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              font: 'inherit',
            }}
          >
            <div className="stat-icon stat-icon-red">NT</div>
            <div className="stat-content">
              <h3>{data.unread_notifications ?? 0}</h3>
              <p>Unread Notifications</p>
            </div>
          </button>

          <button
            type="button"
            className="stat-card"
            onClick={() => navigate('/announcements')}
            style={{
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              font: 'inherit',
            }}
          >
            <div className="stat-icon stat-icon-blue">AN</div>
            <div className="stat-content">
              <h3>{data.published_announcements ?? 0}</h3>
              <p>Published Announcements</p>
            </div>
          </button>
        </div>
      </div>
    );
  }

  if (currentRole === 'teacher') {
    const data = dashboardData as TeacherDashboardData;

    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">
              Good morning, {user?.profile?.first_name || 'Teacher'}!
            </h1>
            <p className="page-description">
              Here&apos;s your teaching overview for today.
            </p>
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="stat-card">
            <div className="stat-icon stat-icon-blue">CL</div>
            <div className="stat-content">
              <h3>{data.total_classes ?? 0}</h3>
              <p>My Classes</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-icon-green">SB</div>
            <div className="stat-content">
              <h3>{data.total_subjects ?? 0}</h3>
              <p>My Subjects</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-icon-yellow">BR</div>
            <div className="stat-content">
              <h3>{data.pending_broadsheet_count ?? 0}</h3>
              <p>Pending Broadsheets</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-icon-red">AT</div>
            <div className="stat-content">
              <h3>
                {data.today_attendance_taken ? 'Done' : 'Pending'}
              </h3>
              <p>Today&apos;s Attendance</p>
            </div>
          </div>
        </div>

        <div className="dashboard-grid">
          <button
            type="button"
            className="stat-card"
            onClick={() => navigate('/notifications')}
            style={{
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              font: 'inherit',
            }}
          >
            <div className="stat-icon stat-icon-blue">NT</div>
            <div className="stat-content">
              <h3>{data.unread_notifications ?? 0}</h3>
              <p>Unread Notifications</p>
            </div>
          </button>

          <button
            type="button"
            className="stat-card"
            onClick={() => navigate('/announcements')}
            style={{
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              font: 'inherit',
            }}
          >
            <div className="stat-icon stat-icon-red">AN</div>
            <div className="stat-content">
              <h3>View</h3>
              <p>Announcements</p>
            </div>
          </button>
        </div>

        {Array.isArray(data.classes) && data.classes.length > 0 && (
          <Card title="My Classes" className="no-print">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Class</th>
                    <th>Session</th>
                  </tr>
                </thead>
                <tbody>
                  {data.classes.map((cls: any, index: number) => (
                    <tr key={index}>
                      <td>{cls?.class?.name || 'Unnamed class'}</td>
                      <td>{cls?.session?.name || 'Current session'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    );
  }

  if (currentRole === 'parent') {
    const data = dashboardData as ParentDashboardData;

    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">
              Welcome, {user?.profile?.first_name || 'Parent'}!
            </h1>
            <p className="page-description">
              Here&apos;s an overview of your children.
            </p>
          </div>
        </div>

        <div
          className="dashboard-grid"
          style={{ marginBottom: '1rem' }}
        >
          <button
            type="button"
            className="stat-card"
            onClick={() => navigate('/notifications')}
            style={{
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              font: 'inherit',
            }}
          >
            <div className="stat-icon stat-icon-blue">NT</div>
            <div className="stat-content">
              <h3>{data.unread_notifications ?? 0}</h3>
              <p>Unread Notifications</p>
            </div>
          </button>

          <button
            type="button"
            className="stat-card"
            onClick={() => navigate('/announcements')}
            style={{
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              font: 'inherit',
            }}
          >
            <div className="stat-icon stat-icon-red">AN</div>
            <div className="stat-content">
              <h3>View</h3>
              <p>Announcements</p>
            </div>
          </button>
        </div>

        {!Array.isArray(data.children) ||
        data.children.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">CH</div>
            <div className="empty-state-title">
              No children assigned
            </div>
            <p>
              Please contact the school administration to link your
              children.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {data.children.map((child: any, index: number) => (
              <Card
                key={index}
                title={`${child?.student?.first_name || ''} ${
                  child?.student?.last_name || ''
                }`.trim() || 'Student'}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem',
                  }}
                >
                  <div>
                    <p
                      style={{
                        color: 'var(--color-gray-500)',
                        fontSize: '0.875rem',
                      }}
                    >
                      Class
                    </p>
                    <p style={{ fontWeight: 600 }}>
                      {child?.student?.current_class?.name ||
                        'Not assigned'}
                    </p>
                  </div>

                  <div>
                    <p
                      style={{
                        color: 'var(--color-gray-500)',
                        fontSize: '0.875rem',
                      }}
                    >
                      Latest Result
                    </p>
                    <p style={{ fontWeight: 600 }}>
                      {child?.latest_result
                        ? `${child.latest_result.term_average}%`
                        : 'No results yet'}
                    </p>
                  </div>

                  <div>
                    <p
                      style={{
                        color: 'var(--color-gray-500)',
                        fontSize: '0.875rem',
                      }}
                    >
                      Recent Payment
                    </p>
                    <p style={{ fontWeight: 600 }}>
                      {child?.recent_payments?.[0]
                        ? `?${Number(
                            child.recent_payments[0].amount || 0
                          ).toLocaleString()}`
                        : 'No payments'}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="empty-state">
      <div className="empty-state-icon">RL</div>
      <div className="empty-state-title">Role not supported</div>
      <p>Please sign in again.</p>
    </div>
  );
}

