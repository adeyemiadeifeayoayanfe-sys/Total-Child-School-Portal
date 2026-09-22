import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { Notification } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import Spinner from '../components/ui/Spinner';
function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}
function notificationBadge(type: Notification['notification_type']) {
  switch (type) {
    case 'success':
      return 'badge badge-success';
    case 'warning':
      return 'badge badge-warning';
    case 'error':
      return 'badge badge-danger';
    case 'announcement':
      return 'badge badge-info';
    default:
      return 'badge badge-info';
  }
}
export default function NotificationsPage() {
  const navigate = useNavigate();
  const { call } = useApi();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const loadNotifications = useCallback(async () => {
    setLoading(true);
    const response = await call('/notifications');
    if (response.success) {
      setNotifications(response.data || []);
    }
    setLoading(false);
  }, [call]);
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);
  const handleOpen = async (notification: Notification) => {
    if (!notification.is_read) {
      await call(`/notifications/${notification.id}/read`, {
        method: 'POST',
      });
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
    }
    if (notification.link) {
      navigate(notification.link);
    }
  };
  const handleMarkAllRead = async () => {
    if (markingAll) {
      return;
    }
    setMarkingAll(true);
    const response = await call('/notifications/read-all', {
      method: 'POST',
    });
    if (response.success) {
      setNotifications((current) =>
        current.map((item) => ({
          ...item,
          is_read: true,
          read_at: item.read_at || new Date().toISOString(),
        }))
      );
    }
    setMarkingAll(false);
  };
  const unreadCount = notifications.filter(
    (notification) => !notification.is_read
  ).length;
  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Notifications</h1>
          <p>
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
              : 'You are all caught up.'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={markingAll}
          >
            {markingAll ? 'Marking...' : 'Mark all as read'}
          </Button>
        )}
      </div>
      {loading ? (
        <Spinner />
      ) : notifications.length === 0 ? (
        <Card>
          <EmptyState
            title="No notifications"
            description="There are no notifications to display."
          />
        </Card>
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {notifications.map((notification) => (
            <Card
              key={notification.id}
              className={!notification.is_read ? 'notification-unread' : ''}
            >
              <button
                type="button"
                onClick={() => handleOpen(notification)}
                style={{
                  width: '100%',
                  border: 'none',
                  background: 'transparent',
                  padding: 0,
                  textAlign: 'left',
                  cursor: notification.link ? 'pointer' : 'default',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '1rem',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: '0.4rem',
                      }}
                    >
                      {!notification.is_read && (
                        <span
                          aria-label="Unread"
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: 'var(--color-primary)',
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <strong>{notification.title}</strong>
                      <span className={notificationBadge(notification.notification_type)}>
                        {notification.notification_type}
                      </span>
                    </div>
                    <p
                      style={{
                        margin: '0 0 0.5rem',
                        color: 'var(--color-gray-600)',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {notification.message}
                    </p>
                    <small style={{ color: 'var(--color-gray-500)' }}>
                      {formatDate(notification.created_at)}
                    </small>
                  </div>
                </div>
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

