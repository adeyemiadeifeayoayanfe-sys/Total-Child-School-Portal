import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../ui/Button';
import { UserRole } from '../../types';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { user, activeRole, setActiveRole, logout } = useAuth();
  const navigate = useNavigate();

  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const roleMenuRef = useRef<HTMLDivElement>(null);

  const roleLabels: Record<UserRole, string> = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    teacher: 'Teacher',
    parent: 'Parent',
  };

  const availableRoles: UserRole[] =
    user?.roles?.length
      ? user.roles
      : user?.role
        ? [user.role]
        : [];

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        roleMenuRef.current &&
        !roleMenuRef.current.contains(event.target as Node)
      ) {
        setRoleMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  const getInitials = () => {
    const first =
      user?.profile?.first_name?.[0] ||
      user?.email?.[0] ||
      '?';

    const last =
      user?.profile?.last_name?.[0] || '';

    return (first + last).toUpperCase();
  };

  const getDisplayName = () => {
    if (
      user?.profile?.first_name ||
      user?.profile?.last_name
    ) {
      return `${user.profile.first_name || ''} ${
        user.profile.last_name || ''
      }`.trim();
    }

    return user?.email?.split('@')[0] || 'User';
  };

  const handleRoleChange = (role: UserRole) => {
    setActiveRole(role);
    setRoleMenuOpen(false);
    navigate('/dashboard');
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const currentRole = activeRole || user?.role;

  return (
    <header className="header no-print">
      <div className="header-left">
        <button
          className="header-menu-btn"
          onClick={onMenuClick}
          aria-label="Toggle navigation menu"
        >
          &#9776;
        </button>

        <div className="header-brand">
          <img
            src="/logo.jfif"
            alt="CEM Total Child School logo"
            className="header-brand-logo"
          />

          <div className="header-brand-text">
            <span className="header-brand-name">
              CEM Total Child School
            </span>

            <span className="header-brand-sub">
              School Management Portal
            </span>
          </div>
        </div>
      </div>

      <div className="header-right">
        {availableRoles.length > 1 && (
          <div
            ref={roleMenuRef}
            style={{
              position: 'relative',
              marginRight: '0.75rem',
            }}
          >
            <button
              type="button"
              onClick={() => setRoleMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={roleMenuOpen}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 0.75rem',
                border: '1px solid var(--color-gray-200)',
                borderRadius: '0.5rem',
                background: 'white',
                color: 'var(--color-gray-700)',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
              }}
            >
              <span>
                {roleLabels[currentRole as UserRole] ||
                  currentRole ||
                  'Role'}
              </span>

              <span
                aria-hidden="true"
                style={{
                  fontSize: '0.7rem',
                  transform: roleMenuOpen
                    ? 'rotate(180deg)'
                    : 'rotate(0deg)',
                  transition: 'transform 0.15s ease',
                }}
              >
                ▼
              </span>
            </button>

            {roleMenuOpen && (
              <div
                role="menu"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 0.5rem)',
                  right: 0,
                  minWidth: '180px',
                  padding: '0.375rem',
                  background: 'white',
                  border: '1px solid var(--color-gray-200)',
                  borderRadius: '0.625rem',
                  boxShadow:
                    '0 8px 24px rgba(0, 0, 0, 0.12)',
                  zIndex: 1000,
                }}
              >
                <div
                  style={{
                    padding: '0.5rem 0.625rem',
                    fontSize: '0.75rem',
                    color: 'var(--color-gray-500)',
                    fontWeight: 600,
                  }}
                >
                  Switch dashboard
                </div>

                {availableRoles.map((role) => {
                  const isActive = role === currentRole;

                  return (
                    <button
                      key={role}
                      type="button"
                      role="menuitem"
                      onClick={() => handleRoleChange(role)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.625rem 0.75rem',
                        border: 'none',
                        borderRadius: '0.375rem',
                        background: isActive
                          ? 'var(--color-gray-100)'
                          : 'transparent',
                        color: 'var(--color-gray-800)',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                      }}
                    >
                      <span>{roleLabels[role]}</span>

                      {isActive && (
                        <span
                          aria-label="Currently selected"
                          style={{ fontWeight: 700 }}
                        >
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div
          className="header-user"
          title={getDisplayName()}
        >
          <div
            className="header-avatar"
            aria-hidden="true"
          >
            {getInitials()}
          </div>

          <div className="header-user-info">
            <span className="header-user-name">
              {getDisplayName()}
            </span>

            <span className="header-user-role">
              {roleLabels[currentRole as UserRole] ||
                currentRole ||
                'User'}
            </span>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="no-print"
        >
          Logout
        </Button>
      </div>
    </header>
  );
}