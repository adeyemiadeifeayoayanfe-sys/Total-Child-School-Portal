import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/ui/Toast';
import { User } from '../types';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { StatusBadge } from '../components/ui/Badge';

export default function UsersPage() {
  const { call } = useApi();
  const { showToast } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const query = filterRole ? `?role=${filterRole}` : '';
    const result = await call(`/auth/users${query}`);
    if (result.success && result.data) {
      setUsers(result.data);
    }
    setLoading(false);
  }, [call, filterRole]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleDeactivate = async (user: User) => {
    const result = await call(`/auth/users/${user.id}/deactivate`, { method: 'POST' });
    if (result.success) {
      showToast('success', 'User deactivated successfully');
      fetchUsers();
    } else {
      showToast('error', result.error || 'Failed to deactivate user');
    }
  };

  const handleActivate = async (user: User) => {
    const result = await call(`/auth/users/${user.id}/activate`, { method: 'POST' });
    if (result.success) {
      showToast('success', 'User activated successfully');
      fetchUsers();
    } else {
      showToast('error', result.error || 'Failed to activate user');
    }
  };

  const roleLabels: Record<string, string> = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    teacher: 'Teacher',
    parent: 'Parent',
  };

  const roleColorMap: Record<string, { bg: string; text: string }> = {
    super_admin: { bg: 'var(--color-error-light)', text: 'var(--color-error)' },
    admin: { bg: 'var(--color-info-light)', text: 'var(--color-info)' },
    teacher: { bg: 'var(--color-success-light)', text: 'var(--color-success)' },
    parent: { bg: 'var(--color-warning-light)', text: 'var(--color-warning)' },
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (user: User) => (
        <span className="font-semibold">
          {user.profile?.first_name} {user.profile?.last_name}
        </span>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (user: User) => user.email,
    },
    {
      key: 'role',
      header: 'Role',
      render: (user: User) => {
        const colors = roleColorMap[user.role] || { bg: 'var(--color-gray-100)', text: 'var(--color-gray-600)' };
        return (
          <span
            className="badge badge-neutral"
            style={{ backgroundColor: colors.bg, color: colors.text }}
          >
            {roleLabels[user.role] || user.role}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (user: User) => <StatusBadge status={user.status} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (user: User) => (
        <div className="flex flex-wrap gap-2">
          {user.status === 'active' ? (
            <Button variant="ghost" size="sm" onClick={() => handleDeactivate(user)}>
              Deactivate
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => handleActivate(user)}>
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
          <h1 className="page-title">Users</h1>
          <p className="page-description">Manage all user accounts</p>
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap gap-3 mb-4">
          <select
            className="form-select"
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            style={{ maxWidth: '200px' }}
          >
            <option value="">All Roles</option>
            <option value="super_admin">Super Admin</option>
            <option value="admin">Admin</option>
            <option value="teacher">Teacher</option>
            <option value="parent">Parent</option>
          </select>
          {filterRole && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setFilterRole('')}
            >
              Clear Filter
            </Button>
          )}
        </div>
        <Table
          columns={columns}
          data={users}
          loading={loading}
          emptyMessage="No users found"
        />
      </Card>
    </div>
  );
}