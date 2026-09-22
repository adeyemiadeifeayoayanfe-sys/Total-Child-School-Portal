import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../ui/Button';
import { Notification, UserRole } from '../../types';
import { useApi } from '../../hooks/useApi';
interface HeaderProps {
  onMenuClick: () => void;
}
function formatNotificationTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleString();
}
export default function Header({ onMenuClick }: HeaderProps) {
  const { user, activeRole, setActiveRole, logout } = useAuth();
  const navigate = useNavigate();
  const { call } = useApi();
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const roleMenuRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
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
  const loadUnreadCount = useCallback(async () => {
    if (!user) {
      return;
    }
    const response = await call(
      '/notifications/unread-count'
    );
    if (response.success) {
      setUnreadCount(response.data?.unread_count || 0);
    }
  }, [call, user]);
  const loadNotifications = useCallback(async () => {
    if (!user) {
      return;
    }
    const response = await call('/notifications');
    if (response.success) {
      setNotifications((response.data || []).slice(0, 8));
    }
  }, [call, user]);
  useEffect(() => {
    if (!user) {
      return;
    }
    loadUnreadCount();
    const interval = window.setInterval(() => {
      loadUnreadCount();
    }, 30000);
    return () => {
      window.clearInterval(interval);
    };
  }, [user, loadUnreadCount]);
  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (
        roleMenuRef.current &&
        !roleMenuRef.current.contains(target)
      ) {
        setRoleMenuOpen(false);
      }
      if (
        notificationRef.current &&
        !notificationRef.current.contains(target)
      ) {
        setNotificationOpen(false);
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
  const handleNotificationOpen = async (
    notification: Notification
  ) => {
    if (!notification.is_read) {
      const response = await call(
        `/notifications/${notification.id}/read`,
        {
          method: 'POST',
        }
      );
      if (response.success) {
        setNotifications((current) =>
          current.map((item) =>
            item.id === notification.id
              ? {
                  ...item,
                  is_read: true,
                  read_at: new Date().toISOString(),
                }
              : item
          )
        );
        setUnreadCount((current) => Math.max(0, current - 1));
      }
    }
    setNotificationOpen(false);
    if (notification.link) {
      navigate(notification.link);
    }
  };
  const handleMarkAllRead = async () => {
    const response = await call('/notifications/read-all', {
      method: 'POST',
    });
    if (response.success) {
      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          is_read: true,
          read_at:
            notification.read_at ||
            new Date().toISOString(),
        }))
      );
      setUnreadCount(0);
    }
  };
  const openNotificationCenter = async () => {
    setNotificationOpen((open) => !open);
    if (!notificationOpen) {
      await loadNotifications();
    }
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
        <div
          ref={notificationRef}
          style={{
            position: 'relative',
            marginRight: '0.5rem',
          }}
        >
          <button
            type="button"
            onClick={openNotificationCenter}
            aria-label={
              unreadCount > 0
                ? `${unreadCount} unread notifications`
                : 'Notifications'
            }
            aria-expanded={notificationOpen}
            style={{
              position: 'relative',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--color-gray-200)',
              borderRadius: '0.5rem',
              background: 'white',
              color: 'var(--color-gray-700)',
              cursor: 'pointer',
              fontSize: '1.1rem',
            }}
          >
            <span aria-hidden="true">NT</span>
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  minWidth: '18px',
                  height: '18px',
                  padding: '0 4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '999px',
                  background: 'var(--color-danger, #dc2626)',
                  color: 'white',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  lineHeight: 1,
                }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          {notificationOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 0.5rem)',
                right: 0,
                width: 'min(380px, calc(100vw - 2rem))',
                background: 'white',
                border: '1px solid var(--color-gray-200)',
                borderRadius: '0.75rem',
                boxShadow:
                  '0 12px 32px rgba(0, 0, 0, 0.14)',
                zIndex: 1100,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.85rem 1rem',
                  borderBottom:
                    '1px solid var(--color-gray-200)',
                }}
              >
                <strong>Notifications</strong>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--color-primary)',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div
                style={{
                  maxHeight: '360px',
                  overflowY: 'auto',
                }}
              >
                {notifications.length === 0 ? (
                  <div
                    style={{
                      padding: '2rem 1rem',
                      textAlign: 'center',
                      color: 'var(--color-gray-500)',
                    }}
                  >
                    No notifications
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() =>
                        handleNotificationOpen(notification)
                      }
                      style={{
                        width: '100%',
                        display: 'block',
                        padding: '0.85rem 1rem',
                        border: 'none',
                        borderBottom:
                          '1px solid var(--color-gray-100)',
                        background: notification.is_read
                          ? 'white'
                          : 'var(--color-gray-50, #f9fafb)',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          gap: '0.6rem',
                          alignItems: 'flex-start',
                        }}
                      >
                        {!notification.is_read && (
                          <span
                            style={{
                              width: '7px',
                              height: '7px',
                              borderRadius: '50%',
                              background:
                                'var(--color-primary)',
                              marginTop: '0.35rem',
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: '0.875rem',
                              marginBottom: '0.2rem',
                            }}
                          >
                            {notification.title}
                          </div>
                          <div
                            style={{
                              color:
                                'var(--color-gray-600)',
                              fontSize: '0.8rem',
                              lineHeight: 1.4,
                            }}
                          >
                            {notification.message}
                          </div>
                          <div
                            style={{
                              color:
                                'var(--color-gray-400)',
                              fontSize: '0.7rem',
                              marginTop: '0.35rem',
                            }}
                          >
                            {formatNotificationTime(
                              notification.created_at
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setNotificationOpen(false);
                  navigate('/notifications');
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: 'none',
                  borderTop:
                    '1px solid var(--color-gray-200)',
                  background: 'white',
                  color: 'var(--color-primary)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                }}
              >
                View all notifications
              </button>
            </div>
          )}
        </div>
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
              onClick={() =>
                setRoleMenuOpen((open) => !open)
              }
              aria-haspopup="menu"
              aria-expanded={roleMenuOpen}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 0.75rem',
                border:
                  '1px solid var(--color-gray-200)',
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
                  transition:
                    'transform 0.15s ease',
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
                  border:
                    '1px solid var(--color-gray-200)',
                  borderRadius: '0.625rem',
                  boxShadow:
                    '0 8px 24px rgba(0, 0, 0, 0.12)',
                  zIndex: 1000,
                }}
              >
                <div
                  style={{
                    padding:
                      '0.5rem 0.625rem',
                    fontSize: '0.75rem',
                    color:
                      'var(--color-gray-500)',
                    fontWeight: 600,
                  }}
                >
                  Switch dashboard
                </div>
                {availableRoles.map((role) => {
                  const isActive =
                    role === currentRole;
                  return (
                    <button
                      key={role}
                      type="button"
                      role="menuitem"
                      onClick={() =>
                        handleRoleChange(role)
                      }
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent:
                          'space-between',
                        padding:
                          '0.625rem 0.75rem',
                        border: 'none',
                        borderRadius:
                          '0.375rem',
                        background: isActive
                          ? 'var(--color-gray-100)'
                          : 'transparent',
                        color:
                          'var(--color-gray-800)',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                      }}
                    >
                      <span>
                        {roleLabels[role]}
                      </span>
                      {isActive && (
                        <span
                          aria-label="Currently selected"
                          style={{
                            fontWeight: 700,
                          }}
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

