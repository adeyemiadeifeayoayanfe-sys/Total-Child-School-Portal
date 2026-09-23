import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/ui/Toast';
import { User, UserRole } from '../types';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Card from '../components/ui/Card';
import { StatusBadge } from '../components/ui/Badge';

const MANAGEABLE_ROLES: UserRole[] = ['admin', 'teacher', 'parent'];

const roleLabels: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  teacher: 'Teacher',
  parent: 'Parent',
};

const roleColorMap: Record<UserRole, { bg: string; text: string }> = {
  super_admin: {
    bg: 'var(--color-error-light)',
    text: 'var(--color-error)',
  },
  admin: {
    bg: 'var(--color-info-light)',
    text: 'var(--color-info)',
  },
  teacher: {
    bg: 'var(--color-success-light)',
    text: 'var(--color-success)',
  },
  parent: {
    bg: 'var(--color-warning-light)',
    text: 'var(--color-warning)',
  },
};

export default function UsersPage() {
  const { call } = useApi();
  const { showToast } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [filterRole, setFilterRole] = useState('');

  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>([]);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [passwordUser, setPasswordUser] = useState<User | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);

    const query = filterRole ? `?role=${filterRole}` : '';
    const result = await call(`/auth/users${query}`);

    if (result.success && result.data) {
      setUsers(result.data);
    } else {
      showToast(
        'error',
        result.error || 'Failed to fetch users'
      );
    }

    setLoading(false);
  }, [call, filterRole, showToast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const isSuperAdmin = (user: User) =>
    user.roles?.includes('super_admin') ||
    user.role === 'super_admin';

  const getUserRoles = (user: User): UserRole[] => {
    if (user.roles?.length) {
      return user.roles;
    }

    return [user.role];
  };

  const openRoleModal = (user: User) => {
    if (isSuperAdmin(user)) {
      showToast(
        'error',
        'Super Admin roles cannot be changed from user management.'
      );
      return;
    }

    const currentRoles = getUserRoles(user).filter((role) =>
      MANAGEABLE_ROLES.includes(role)
    );

    setSelectedUser(user);
    setSelectedRoles(currentRoles);
    setShowRoleModal(true);
  };

  const closeRoleModal = () => {
    if (submitting) return;

    setShowRoleModal(false);
    setSelectedUser(null);
    setSelectedRoles([]);
  };

  const toggleRole = (role: UserRole) => {
    setSelectedRoles((current) => {
      if (current.includes(role)) {
        return current.filter((item) => item !== role);
      }

      if (current.length >= 3) {
        showToast(
          'error',
          'A user can have at most three roles.'
        );
        return current;
      }

      return [...current, role];
    });
  };

  const handleUpdateRoles = async () => {
    if (!selectedUser) return;

    if (selectedRoles.length === 0) {
      showToast(
        'error',
        'At least one role must be selected.'
      );
      return;
    }

    setSubmitting(true);

    const result = await call(
      `/auth/users/${selectedUser.id}/roles`,
      {
        method: 'PUT',
        body: {
          roles: selectedRoles,
        },
      }
    );

    if (result.success) {
      showToast(
        'success',
        'User roles updated successfully.'
      );

      closeRoleModal();
      await fetchUsers();
    } else {
      showToast(
        'error',
        result.error || 'Failed to update user roles.'
      );
    }

    setSubmitting(false);
  };

  const handleResetPassword = async (user: User) => {
    if (isSuperAdmin(user)) return;
    if (!window.confirm("Reset this user's password?")) return;
    setSubmitting(true);
    const result = await call('/auth/reset-password', { method: 'POST', body: { user_id: user.id } });
    if (result.success && result.data?.temporary_password) {
      setPasswordUser(user);
      setTemporaryPassword(result.data.temporary_password);
      setShowPasswordModal(true);
    } else {
      showToast('error', result.error || 'Failed to reset password.');
    }
    setSubmitting(false);
  };

  const handleDeactivate = async (user: User) => {
    if (isSuperAdmin(user)) {
      showToast(
        'error',
        'Super Admin accounts cannot be deactivated from user management.'
      );
      return;
    }

    const confirmed = window.confirm(
      `Deactivate ${user.profile?.first_name || ''} ${user.profile?.last_name || ''}?`
    );

    if (!confirmed) return;

    setSubmitting(true);

    const result = await call(
      `/auth/users/${user.id}/deactivate`,
      {
        method: 'POST',
      }
    );

    if (result.success) {
      showToast(
        'success',
        'User deactivated successfully.'
      );
      await fetchUsers();
    } else {
      showToast(
        'error',
        result.error || 'Failed to deactivate user.'
      );
    }

    setSubmitting(false);
  };

  const handleActivate = async (user: User) => {
    if (isSuperAdmin(user)) {
      showToast(
        'error',
        'Super Admin accounts cannot be activated or deactivated from user management.'
      );
      return;
    }

    setSubmitting(true);

    const result = await call(
      `/auth/users/${user.id}/activate`,
      {
        method: 'POST',
      }
    );

    if (result.success) {
      showToast(
        'success',
        'User activated successfully.'
      );
      await fetchUsers();
    } else {
      showToast(
        'error',
        result.error || 'Failed to activate user.'
      );
    }

    setSubmitting(false);
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (user: User) => (
        <span className="font-semibold">
          {user.profile?.first_name || '—'}{' '}
          {user.profile?.last_name || ''}
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
      header: 'Roles',
      render: (user: User) => {
        const roles = getUserRoles(user);

        return (
          <div className="flex flex-wrap gap-2">
            {roles.map((role) => {
              const colors = roleColorMap[role];

              return (
                <span
                  key={role}
                  className="badge badge-neutral"
                  style={{
                    backgroundColor: colors?.bg,
                    color: colors?.text,
                  }}
                >
                  {roleLabels[role] || role}
                </span>
              );
            })}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (user: User) => (
        <StatusBadge status={user.status} />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (user: User) => {
        const protectedAccount = isSuperAdmin(user);

        return (
          <div className="flex flex-wrap gap-2">
            {!protectedAccount && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => openRoleModal(user)}
                disabled={submitting}
              >
                Roles
              </Button>
            )}

            {!protectedAccount && (
              <Button variant="outline" size="sm" onClick={() => handleResetPassword(user)} disabled={submitting}>
                Reset Password
              </Button>
            )}

            {protectedAccount ? (
              <span className="text-sm text-gray-500">
                Protected account
              </span>
            ) : user.status === 'active' ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeactivate(user)}
                disabled={submitting}
              >
                Deactivate
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleActivate(user)}
                disabled={submitting}
              >
                Activate
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Users
          </h1>

          <p className="page-description">
            Manage user accounts, roles, and account status
          </p>
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap gap-3 mb-4">
          <select
            className="form-select"
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            style={{ maxWidth: '220px' }}
          >
            <option value="">
              All Roles
            </option>

            <option value="super_admin">
              Super Admin
            </option>

            <option value="admin">
              Admin
            </option>

            <option value="teacher">
              Teacher
            </option>

            <option value="parent">
              Parent
            </option>
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

      <Modal
        open={showRoleModal}
        onClose={closeRoleModal}
        title={`Manage Roles — ${
          selectedUser?.profile?.first_name || ''
        } ${selectedUser?.profile?.last_name || ''}`}
        footer={
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={closeRoleModal}
              disabled={submitting}
            >
              Cancel
            </Button>

            <Button
              variant="primary"
              onClick={handleUpdateRoles}
              loading={submitting}
              disabled={selectedRoles.length === 0}
            >
              Save Roles
            </Button>
          </div>
        }
      >
        <div className="grid gap-4">
          <div>
            <p className="text-sm text-gray-500">
              Account
            </p>

            <p className="font-semibold">
              {selectedUser?.email}
            </p>
          </div>

          <div>
            <p className="form-label">
              Assigned Roles
            </p>

            <div className="grid gap-3">
              {MANAGEABLE_ROLES.map((role) => (
                <label
                  key={role}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 p-4"
                >
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(role)}
                    onChange={() => toggleRole(role)}
                    disabled={submitting}
                  />

                  <div>
                    <p className="font-medium">
                      {roleLabels[role]}
                    </p>

                    <p className="text-sm text-gray-500">
                      {role === 'admin'
                        ? 'Access administrative management features.'
                        : role === 'teacher'
                          ? 'Access teacher academic and attendance features.'
                          : 'Access parent portal features.'}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            <p className="form-hint">
              Select one or more roles. A user can have up to
              three roles.
            </p>
          </div>
        </div>
      </Modal>

      <Modal
        open={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          setTemporaryPassword('');
          setPasswordUser(null);
        }}
        title="Temporary Password"
        footer={
          <div className="flex justify-end">
            <Button
              variant="primary"
              onClick={() => {
                setShowPasswordModal(false);
                setTemporaryPassword('');
                setPasswordUser(null);
              }}
            >
              Done
            </Button>
          </div>
        }
      >
        <div className="grid gap-4">
          <p>
            A new temporary password has been generated for{' '}
            <strong>
              {passwordUser?.profile?.first_name || ''}{' '}
              {passwordUser?.profile?.last_name || ''}
            </strong>.
          </p>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="mb-2 text-sm text-gray-500">
              Temporary Password
            </p>
            <p className="select-all break-all font-mono text-lg font-semibold">
              {temporaryPassword}
            </p>
          </div>

          <p className="text-sm text-gray-500">
            Give this password to the user securely. It is shown only once
            and is not stored in the application.
          </p>
        </div>
      </Modal>
    </div>
  );
}







