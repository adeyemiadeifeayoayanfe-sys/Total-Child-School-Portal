import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../ui/Button';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const roleLabels: Record<string, string> = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    teacher: 'Teacher',
    parent: 'Parent',
  };

  const getInitials = () => {
    const first = user?.profile?.first_name?.[0] || user?.email?.[0] || '?';
    const last = user?.profile?.last_name?.[0] || '';
    return (first + last).toUpperCase();
  };

  const getDisplayName = () => {
    if (user?.profile?.first_name || user?.profile?.last_name) {
      return `${user.profile.first_name || ''} ${user.profile.last_name || ''}`.trim();
    }
    return user?.email?.split('@')[0] || 'User';
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

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
        <span className="text-sm text-gray-400" style={{ display: 'none' }}> / Dashboard</span>
      </div>

      <div className="header-right">
        <div className="header-user" title={getDisplayName()}>
          <div className="header-avatar" aria-hidden="true">{getInitials()}</div>
          <div className="header-user-info">
            <span className="header-user-name">{getDisplayName()}</span>
            <span className="header-user-role">
              {roleLabels[user?.role || ''] || user?.role || 'User'}
            </span>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="no-print">
          Logout
        </Button>
      </div>
    </header>
  );
}