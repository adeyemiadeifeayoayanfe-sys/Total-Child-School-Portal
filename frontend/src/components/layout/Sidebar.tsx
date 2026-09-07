import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface NavItem {
  to: string;
  icon: string;
  label: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const role = user?.role;

  const navGroups: NavGroup[] = [];

  if (role === 'super_admin' || role === 'admin') {
    navGroups.push({
      label: 'Overview',
      items: [{ to: '/dashboard', icon: 'DB', label: 'Dashboard' }],
    });
    navGroups.push({
      label: 'Management',
      items: [
        { to: '/students', icon: 'ST', label: 'Students' },
        { to: '/teachers', icon: 'TE', label: 'Teachers' },
        { to: '/parents', icon: 'PA', label: 'Parents' },
        { to: '/classes', icon: 'CL', label: 'Classes' },
        { to: '/subjects', icon: 'SU', label: 'Subjects' },
      ],
    });
    navGroups.push({
      label: 'Academics',
      items: [
        { to: '/attendance', icon: 'AT', label: 'Attendance' },
        { to: '/broadsheets', icon: 'BR', label: 'Broadsheets' },
        { to: '/results', icon: 'RE', label: 'Results' },
      ],
    });
    navGroups.push({
      label: 'Finance',
      items: [
        { to: '/payments', icon: 'PY', label: 'Payments' },
        { to: '/cashbook', icon: 'CA', label: 'Cashbook' },
        { to: '/receipts', icon: 'RC', label: 'Receipts' },
      ],
    });
  }

  if (role === 'teacher') {
    navGroups.push({
      label: 'Overview',
      items: [{ to: '/dashboard', icon: 'DB', label: 'Dashboard' }],
    });
    navGroups.push({
      label: 'Teaching',
      items: [
        { to: '/attendance', icon: 'AT', label: 'Attendance' },
        { to: '/scores', icon: 'SC', label: 'Score Entry' },
        { to: '/broadsheets', icon: 'BR', label: 'Broadsheets' },
      ],
    });
  }

  if (role === 'parent') {
    navGroups.push({
      label: 'Overview',
      items: [{ to: '/dashboard', icon: 'DB', label: 'Dashboard' }],
    });
    navGroups.push({
      label: 'My Children',
      items: [
        { to: '/children', icon: 'CH', label: 'Children' },
        { to: '/results', icon: 'RE', label: 'Results' },
        { to: '/payments', icon: 'PY', label: 'Payments' },
      ],
    });
  }

  if (role === 'super_admin') {
    navGroups.push({
      label: 'System',
      items: [
        { to: '/settings', icon: 'SE', label: 'Settings' },
        { to: '/audit-logs', icon: 'AU', label: 'Audit Logs' },
        { to: '/users', icon: 'US', label: 'Users' },
      ],
    });
  }

  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} aria-hidden="true" />}
      <aside className={`sidebar ${open ? 'open' : ''}`} role="navigation" aria-label="Main navigation">
        <div className="sidebar-header">
          <div className="sidebar-brand-icon" aria-hidden="true">TC</div>
          <div className="sidebar-brand">
            <span className="sidebar-brand-name">CEM Total Child</span>
            <span className="sidebar-brand-sub">School Management</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navGroups.map((group, index) => (
            <div key={index} className="sidebar-nav-group">
              <div className="sidebar-nav-label">{group.label}</div>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                  onClick={onClose}
                  
                >
                  <span className="sidebar-link-icon" aria-hidden="true">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <NavLink to="/profile" className="sidebar-link" onClick={onClose}>
            <span className="sidebar-link-icon" aria-hidden="true">PF</span>
            My Profile
          </NavLink>
        </div>
      </aside>
    </>
  );
}