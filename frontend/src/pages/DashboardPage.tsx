import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { AdminDashboardData, TeacherDashboardData, ParentDashboardData } from '../types';
import { LoadingContainer } from '../components/ui/Spinner';
import Card from '../components/ui/Card';

export default function DashboardPage() {
  const { user, activeRole } = useAuth();
  const { call } = useApi();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, [activeRole]);

  async function fetchDashboard() {
    setLoading(true);
    const endpoint =
      activeRole === 'teacher'
        ? '/dashboard/teacher'
        : activeRole === 'parent'
          ? '/dashboard/parent'
          : '/dashboard/admin';

    const result = await call(endpoint);
    if (result.success && result.data) {
      setDashboardData(result.data);
    }
    setLoading(false);
  }

  if (loading) {
    return <LoadingContainer text="Loading dashboard..." />;
  }

  if (!dashboardData) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">DB</div>
        <div className="empty-state-title">No dashboard data available</div>
      </div>
    );
  }

  if (activeRole === 'admin' || activeRole === 'super_admin') {
    const data = dashboardData as AdminDashboardData;
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-description">
              Welcome back, {user?.profile?.first_name}! Here&apos;s what&apos;s happening today.
            </p>
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="stat-card">
            <div className="stat-icon stat-icon-blue">ST</div>
            <div className="stat-content">
              <h3>{data.students}</h3>
              <p>Students</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-icon-green">TE</div>
            <div className="stat-content">
              <h3>{data.teachers}</h3>
              <p>Teachers</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-icon-yellow">PR</div>
            <div className="stat-content">
              <h3>{data.parents}</h3>
              <p>Parents</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-icon-red">CL</div>
            <div className="stat-content">
              <h3>{data.classes}</h3>
              <p>Classes</p>
            </div>
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="stat-card">
            <div className="stat-icon stat-icon-green">AT</div>
            <div className="stat-content">
              <h3>
                {data.today_attendance.present}/{data.today_attendance.total}
              </h3>
              <p>Present Today</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-icon-yellow">BR</div>
            <div className="stat-content">
              <h3>{data.pending_broadsheets}</h3>
              <p>Pending Broadsheets</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-icon-blue">RS</div>
            <div className="stat-content">
              <h3>{data.generated_results}</h3>
              <p>Generated Results</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-icon-red">PY</div>
            <div className="stat-content">
              <h3>₦{data.today_payments.total.toLocaleString()}</h3>
              <p>Today&apos;s Payments ({data.today_payments.count})</p>
            </div>
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="stat-card">
            <div className="stat-icon stat-icon-blue">CS</div>
            <div className="stat-content">
              <h3>₦{data.cashbook_balance.toLocaleString()}</h3>
              <p>Cashbook Balance</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-icon-yellow">RC</div>
            <div className="stat-content">
              <h3>{data.receipt_queue}</h3>
              <p>Receipt Queue</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeRole === 'teacher') {
    const data = dashboardData as TeacherDashboardData;
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Good morning, {user?.profile?.first_name}!</h1>
            <p className="page-description">Here&apos;s your teaching overview for today.</p>
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="stat-card">
            <div className="stat-icon stat-icon-blue">CL</div>
            <div className="stat-content">
              <h3>{data.total_classes}</h3>
              <p>My Classes</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-icon-green">SB</div>
            <div className="stat-content">
              <h3>{data.total_subjects}</h3>
              <p>My Subjects</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-icon-yellow">BR</div>
            <div className="stat-content">
              <h3>{data.pending_broadsheet_count}</h3>
              <p>Pending Broadsheets</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-icon-red">AT</div>
            <div className="stat-content">
              <h3>{data.today_attendance_taken ? 'Done' : 'Pending'}</h3>
              <p>Today&apos;s Attendance</p>
            </div>
          </div>
        </div>

        {data.classes.length > 0 && (
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
                      <td>{cls.class?.name}</td>
                      <td>{cls.session?.name}</td>
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

  if (activeRole === 'parent') {
    const data = dashboardData as ParentDashboardData;
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Welcome, {user?.profile?.first_name}!</h1>
            <p className="page-description">Here&apos;s an overview of your children.</p>
          </div>
        </div>

        {data.children.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">CH</div>
            <div className="empty-state-title">No children assigned</div>
            <p>Please contact the school administration to link your children.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {data.children.map((child, index) => (
              <Card key={index} title={`${child.student.first_name} ${child.student.last_name}`}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem',
                  }}
                >
                  <div>
                    <p style={{ color: 'var(--color-gray-500)', fontSize: '0.875rem' }}>Class</p>
                    <p style={{ fontWeight: 600 }}>{child.student.current_class?.name || 'Not assigned'}</p>
                  </div>
                  <div>
                    <p style={{ color: 'var(--color-gray-500)', fontSize: '0.875rem' }}>Latest Result</p>
                    <p style={{ fontWeight: 600 }}>
                      {child.latest_result ? `${child.latest_result.term_average}%` : 'No results yet'}
                    </p>
                  </div>
                  <div>
                    <p style={{ color: 'var(--color-gray-500)', fontSize: '0.875rem' }}>Recent Payment</p>
                    <p style={{ fontWeight: 600 }}>
                      {child.recent_payments[0] ? `₦${child.recent_payments[0].amount.toLocaleString()}` : 'No payments'}
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

  return null;
}
